import { calculateRealHolderConcentration } from "../../../domain/rules/real-holders.js";
import type { AddressTag, ClusterMember, HolderConcentration, HolderExclusionReason } from "../../../domain/types.js";

const INFRASTRUCTURE_ROLES = new Set(["bonding_curve", "official_proxy", "liquidity_pool", "burn"] as const);
const MINIMUM_TAG_CONFIDENCE = 0.8;
const MINIMUM_CLUSTER_CONFIDENCE = 0.85;
const REAL_HOLDERS_RULE_VERSION = "v1";

export interface SolanaTokenAccountBalance {
  tokenAccountAddress: string;
  ownerAddress: string;
  balanceRaw: bigint;
}

export interface HolderSnapshotWatermark {
  source: string;
  observedAt: Date;
  finalizedSlot?: bigint;
  cursor?: string;
  completeness: "complete" | "partial";
}

export interface SolanaTokenAccountPage {
  accounts: SolanaTokenAccountBalance[];
  nextCursor?: string;
  watermark: HolderSnapshotWatermark;
}

export interface SolanaHolderSnapshotSource {
  getTokenAccountPage(tokenAddress: string, cursor?: string): Promise<SolanaTokenAccountPage>;
}

export interface SolanaHolderSnapshotRequest {
  tokenAddress: string;
  totalSupplyRaw: bigint;
  addressTags: AddressTag[];
  clusterMembers: ClusterMember[];
}

export interface HolderCleaningEvidence {
  address: string;
  balanceRaw: bigint;
  exclusionReason: HolderExclusionReason;
  confidence: number;
  ruleVersion: string;
  rawTokenAccounts: SolanaTokenAccountBalance[];
  label?: AddressTag;
  cluster?: ClusterMember;
}

export interface SolanaHolderSnapshot {
  tokenAddress: string;
  totalSupplyRaw: bigint;
  completeness: "complete" | "partial";
  rawTokenAccounts: SolanaTokenAccountBalance[];
  ownerBalances: ReadonlyMap<string, bigint>;
  watermarks: HolderSnapshotWatermark[];
  concentration: HolderConcentration | null;
  cleaningEvidence: HolderCleaningEvidence[];
  warnings: string[];
}

/**
 * Builds a replayable holder snapshot from every locally supplied account page.
 * Transport selection belongs to the source; this service does not issue RPC calls.
 */
export class SolanaHolderSnapshotService {
  constructor(private readonly source: SolanaHolderSnapshotSource) {}

  async build(request: SolanaHolderSnapshotRequest): Promise<SolanaHolderSnapshot> {
    const { accounts, watermarks } = await this.enumerateAll(request.tokenAddress);
    const ownerBalances = aggregateByOwner(accounts);
    const { completeness, warnings } = assessSnapshotCompleteness(watermarks);

    if (completeness === "partial") {
      return {
        tokenAddress: request.tokenAddress,
        totalSupplyRaw: request.totalSupplyRaw,
        completeness,
        rawTokenAccounts: accounts,
        ownerBalances,
        watermarks,
        concentration: null,
        cleaningEvidence: [],
        warnings,
      };
    }

    const concentration = calculateRealHolderConcentration({
      holders: [...ownerBalances.entries()].map(([ownerAddress, balanceRaw]) => ({
        address: ownerAddress,
        ownerAddress,
        balanceRaw,
      })),
      totalSupplyRaw: request.totalSupplyRaw,
      addressTags: request.addressTags,
      clusterMembers: request.clusterMembers,
      minimumClusterConfidence: MINIMUM_CLUSTER_CONFIDENCE,
    });
    const cleaningEvidence = buildCleaningEvidence(concentration, accounts, request.addressTags, request.clusterMembers);

    return {
      tokenAddress: request.tokenAddress,
      totalSupplyRaw: request.totalSupplyRaw,
      completeness,
      rawTokenAccounts: accounts,
      ownerBalances,
      watermarks,
      concentration,
      cleaningEvidence,
      warnings,
    };
  }

  private async enumerateAll(tokenAddress: string): Promise<{ accounts: SolanaTokenAccountBalance[]; watermarks: HolderSnapshotWatermark[] }> {
    const accounts: SolanaTokenAccountBalance[] = [];
    const watermarks: HolderSnapshotWatermark[] = [];
    const seenCursors = new Set<string>();
    const seenTokenAccounts = new Set<string>();
    let cursor: string | undefined;

    do {
      const page = await this.source.getTokenAccountPage(tokenAddress, cursor);
      for (const account of page.accounts) {
        if (seenTokenAccounts.has(account.tokenAccountAddress)) {
          throw new Error(`Holder enumeration token account repeated: ${account.tokenAccountAddress}`);
        }
        seenTokenAccounts.add(account.tokenAccountAddress);
        accounts.push(copyTokenAccount(account));
      }
      watermarks.push(copyWatermark(page.watermark));
      cursor = page.nextCursor;
      if (cursor !== undefined) {
        if (seenCursors.has(cursor)) throw new Error(`Holder enumeration cursor repeated: ${cursor}`);
        seenCursors.add(cursor);
      }
    } while (cursor !== undefined);

    return { accounts, watermarks };
  }
}

function assessSnapshotCompleteness(watermarks: readonly HolderSnapshotWatermark[]): { completeness: "complete" | "partial"; warnings: string[] } {
  const warnings: string[] = [];
  if (watermarks.some((watermark) => watermark.completeness !== "complete")) {
    warnings.push("Holder enumeration is partial; concentration metrics were not calculated.");
  }

  const finalizedSlots = watermarks.map((watermark) => watermark.finalizedSlot);
  if (finalizedSlots.some((slot) => slot === undefined)) {
    warnings.push("Holder enumeration is partial because a page lacks a finalized snapshot boundary.");
  } else if (new Set(finalizedSlots.map((slot) => slot!.toString())).size !== 1) {
    warnings.push("Holder enumeration is partial because pages have different finalized snapshot boundaries.");
  }

  return warnings.length === 0 ? { completeness: "complete", warnings } : { completeness: "partial", warnings };
}

function aggregateByOwner(accounts: readonly SolanaTokenAccountBalance[]): ReadonlyMap<string, bigint> {
  const balances = new Map<string, bigint>();
  for (const account of accounts) {
    if (account.balanceRaw < 0n) throw new Error(`Token account balance must be non-negative: ${account.tokenAccountAddress}`);
    balances.set(account.ownerAddress, (balances.get(account.ownerAddress) ?? 0n) + account.balanceRaw);
  }
  return balances;
}

function buildCleaningEvidence(
  concentration: HolderConcentration,
  accounts: readonly SolanaTokenAccountBalance[],
  addressTags: readonly AddressTag[],
  clusterMembers: readonly ClusterMember[],
): HolderCleaningEvidence[] {
  const accountsByOwner = new Map<string, SolanaTokenAccountBalance[]>();
  for (const account of accounts) {
    const ownerAccounts = accountsByOwner.get(account.ownerAddress) ?? [];
    ownerAccounts.push(copyTokenAccount(account));
    accountsByOwner.set(account.ownerAddress, ownerAccounts);
  }
  const tagsByAddress = new Map(
    addressTags
      .filter((tag) => tag.confidence >= MINIMUM_TAG_CONFIDENCE && INFRASTRUCTURE_ROLES.has(tag.role as never))
      .map((tag) => [tag.address, tag] as const),
  );
  const clustersByAddress = new Map(
    clusterMembers
      .filter((member) => member.confidence >= MINIMUM_CLUSTER_CONFIDENCE)
      .map((member) => [member.address, member] as const),
  );

  return concentration.rows
    .filter((row) => row.excluded && row.exclusionReason !== undefined)
    .map((row) => {
      const label = tagsByAddress.get(row.address);
      const cluster = clustersByAddress.get(row.address);
      return {
        address: row.address,
        balanceRaw: row.balanceRaw,
        exclusionReason: row.exclusionReason!,
        confidence: label?.confidence ?? cluster!.confidence,
        ruleVersion: REAL_HOLDERS_RULE_VERSION,
        rawTokenAccounts: accountsByOwner.get(row.address) ?? [],
        ...(label ? { label: { ...label, ...(label.expiresAt ? { expiresAt: new Date(label.expiresAt) } : {}) } } : {}),
        ...(cluster ? { cluster: { ...cluster, evidence: { ...cluster.evidence } } } : {}),
      };
    });
}

function copyTokenAccount(account: SolanaTokenAccountBalance): SolanaTokenAccountBalance {
  return { ...account };
}

function copyWatermark(watermark: HolderSnapshotWatermark): HolderSnapshotWatermark {
  return { ...watermark, observedAt: new Date(watermark.observedAt) };
}
