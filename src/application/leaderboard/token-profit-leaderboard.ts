import { createHash } from "node:crypto";
import type { AddressLibrary, LibraryObservationRecord } from "../sedimentation/address-library.js";

export const PROFIT_LEADERBOARD_RULE_VERSION = "token-profit-leaderboard-v1";
export type CostBasisMethod = "fifo" | "weighted_average";
export type BorrowedLeaderboardSource = "gmgn" | "birdeye" | "dexscreener" | "other";

export interface BorrowedProfitLeadInput {
  walletAddress: string;
  realizedPnlUsd: number | null;
  roiPct: number | null;
  rank: number;
  evidence?: Record<string, unknown>;
}

export interface BorrowedProfitLead extends BorrowedProfitLeadInput {
  tokenCa: string;
  source: BorrowedLeaderboardSource;
  origin: "borrowed";
  verificationStatus: "unverified";
  observedAt: Date;
  warnings: string[];
}

export interface BorrowedLeaderboardProvider {
  readonly name: BorrowedLeaderboardSource;
  getTokenLeaderboard(tokenCa: string): Promise<BorrowedProfitLead[]>;
}

export class FixtureBorrowedLeaderboardProvider implements BorrowedLeaderboardProvider {
  constructor(
    readonly name: BorrowedLeaderboardSource,
    private readonly rows: Record<string, BorrowedProfitLeadInput[]>,
    private readonly observedAt = new Date("2026-07-27T00:00:00.000Z"),
  ) {}

  async getTokenLeaderboard(tokenCa: string): Promise<BorrowedProfitLead[]> {
    return normalizeBorrowedLeaderboard(tokenCa, this.name, this.rows[tokenCa] ?? [], this.observedAt);
  }
}

export function normalizeBorrowedLeaderboard(
  tokenCa: string,
  source: BorrowedLeaderboardSource,
  rows: BorrowedProfitLeadInput[],
  observedAt: Date,
): BorrowedProfitLead[] {
  return rows
    .filter((row) => row.walletAddress.trim().length > 0 && Number.isInteger(row.rank) && row.rank > 0)
    .map((row) => ({
      ...row,
      tokenCa,
      source,
      origin: "borrowed" as const,
      verificationStatus: "unverified" as const,
      observedAt: new Date(observedAt),
      warnings: [`borrowed_unverified:${source}`],
      evidence: { ...(row.evidence ?? {}) },
    }))
    .sort((a, b) => a.rank - b.rank || a.walletAddress.localeCompare(b.walletAddress));
}

export interface FirstHandSwap {
  tokenCa: string;
  walletAddress: string;
  side: "buy" | "sell";
  tokenAmountRaw: bigint;
  quoteAmountMicroUsd: bigint;
  signature: string;
  eventIndex: number;
  blockTime: Date;
}

export interface ConfirmedProfitRecord {
  tokenCa: string;
  walletAddress: string;
  realizedPnlMicroUsd: bigint;
  proceedsMicroUsd: bigint;
  costBasisSoldMicroUsd: bigint;
  grossBoughtRaw: bigint;
  grossSoldRaw: bigint;
  currentBalanceRaw: bigint;
  method: CostBasisMethod;
  origin: "first_hand";
  verificationStatus: "verified";
  status: "confirmed";
  completeness: number;
  ruleVersion: string;
  evidence: {
    signatures: string[];
    swapCount: number;
    inputsHash: string;
  };
  warnings: string[];
}

interface Lot {
  amountRaw: bigint;
  costMicroUsd: bigint;
}

function compareSwaps(a: FirstHandSwap, b: FirstHandSwap): number {
  return a.blockTime.getTime() - b.blockTime.getTime()
    || a.signature.localeCompare(b.signature)
    || a.eventIndex - b.eventIndex;
}

function proportional(total: bigint, part: bigint, whole: bigint): bigint {
  return whole === 0n ? 0n : total * part / whole;
}

/** Deterministic Tier-A realized-PnL recompute from first-hand swap events. */
export function recomputeFirstHandProfit(
  tokenCa: string,
  walletAddress: string,
  swaps: FirstHandSwap[],
  method: CostBasisMethod = "fifo",
): ConfirmedProfitRecord {
  const rows = swaps
    .filter((swap) => swap.tokenCa === tokenCa && swap.walletAddress === walletAddress)
    .sort(compareSwaps);
  const warnings: string[] = [];
  const lots: Lot[] = [];
  let inventoryRaw = 0n;
  let inventoryCostMicroUsd = 0n;
  let grossBoughtRaw = 0n;
  let grossSoldRaw = 0n;
  let proceedsMicroUsd = 0n;
  let costBasisSoldMicroUsd = 0n;

  for (const swap of rows) {
    if (swap.tokenAmountRaw <= 0n || swap.quoteAmountMicroUsd < 0n) {
      warnings.push(`invalid_swap_amount:${swap.signature}:${swap.eventIndex}`);
      continue;
    }
    if (swap.side === "buy") {
      grossBoughtRaw += swap.tokenAmountRaw;
      inventoryRaw += swap.tokenAmountRaw;
      inventoryCostMicroUsd += swap.quoteAmountMicroUsd;
      if (method === "fifo") lots.push({ amountRaw: swap.tokenAmountRaw, costMicroUsd: swap.quoteAmountMicroUsd });
      continue;
    }

    grossSoldRaw += swap.tokenAmountRaw;
    const matchedRaw = swap.tokenAmountRaw > inventoryRaw ? inventoryRaw : swap.tokenAmountRaw;
    if (matchedRaw < swap.tokenAmountRaw) {
      warnings.push(`sell_exceeds_inventory:${swap.signature}:${swap.eventIndex}`);
    }
    if (matchedRaw === 0n) continue;

    const matchedProceeds = proportional(swap.quoteAmountMicroUsd, matchedRaw, swap.tokenAmountRaw);
    proceedsMicroUsd += matchedProceeds;

    if (method === "weighted_average") {
      const matchedCost = proportional(inventoryCostMicroUsd, matchedRaw, inventoryRaw);
      costBasisSoldMicroUsd += matchedCost;
      inventoryRaw -= matchedRaw;
      inventoryCostMicroUsd -= matchedCost;
      continue;
    }

    let remaining = matchedRaw;
    while (remaining > 0n && lots.length > 0) {
      const lot = lots[0]!;
      const consumed = remaining < lot.amountRaw ? remaining : lot.amountRaw;
      const consumedCost = proportional(lot.costMicroUsd, consumed, lot.amountRaw);
      costBasisSoldMicroUsd += consumedCost;
      inventoryRaw -= consumed;
      inventoryCostMicroUsd -= consumedCost;
      remaining -= consumed;
      lot.amountRaw -= consumed;
      lot.costMicroUsd -= consumedCost;
      if (lot.amountRaw === 0n) lots.shift();
    }
  }

  const signatures = [...new Set(rows.map((row) => row.signature))];
  const hashBody = rows.map((row) => ({
    side: row.side,
    tokenAmountRaw: row.tokenAmountRaw.toString(),
    quoteAmountMicroUsd: row.quoteAmountMicroUsd.toString(),
    signature: row.signature,
    eventIndex: row.eventIndex,
    blockTime: row.blockTime.toISOString(),
  }));
  return {
    tokenCa,
    walletAddress,
    realizedPnlMicroUsd: proceedsMicroUsd - costBasisSoldMicroUsd,
    proceedsMicroUsd,
    costBasisSoldMicroUsd,
    grossBoughtRaw,
    grossSoldRaw,
    currentBalanceRaw: inventoryRaw,
    method,
    origin: "first_hand",
    verificationStatus: "verified",
    status: "confirmed",
    completeness: rows.length === 0 ? 0 : warnings.length > 0 ? 0.75 : 1,
    ruleVersion: PROFIT_LEADERBOARD_RULE_VERSION,
    evidence: {
      signatures,
      swapCount: rows.length,
      inputsHash: createHash("sha256").update(JSON.stringify({ tokenCa, walletAddress, method, rows: hashBody })).digest("hex"),
    },
    warnings,
  };
}

export function confirmBorrowedLeads(
  tokenCa: string,
  leads: BorrowedProfitLead[],
  swaps: FirstHandSwap[],
  method: CostBasisMethod = "fifo",
): ConfirmedProfitRecord[] {
  const wallets = [...new Set(leads.map((lead) => lead.walletAddress))];
  return wallets
    .map((wallet) => recomputeFirstHandProfit(tokenCa, wallet, swaps, method))
    .sort((a, b) => {
      if (a.realizedPnlMicroUsd !== b.realizedPnlMicroUsd) {
        return a.realizedPnlMicroUsd > b.realizedPnlMicroUsd ? -1 : 1;
      }
      return a.walletAddress.localeCompare(b.walletAddress);
    });
}

export interface PromotionInput {
  tokenId: string;
  tokenCa: string;
  record: ConfirmedProfitRecord;
  labels: string[];
  confidence: number;
  promotedAt: Date;
  minimumRealizedPnlMicroUsd?: bigint;
  evidence?: Record<string, unknown>;
}

/** Promote only a complete Tier-A confirmation; borrowed leads can never enter. */
export async function promoteConfirmedLeaderboardWallet(
  library: AddressLibrary,
  input: PromotionInput,
): Promise<{ promoted: boolean; newLabels: string[] }> {
  const minimum = input.minimumRealizedPnlMicroUsd ?? 0n;
  const record = input.record;
  if (
    record.origin !== "first_hand"
    || record.verificationStatus !== "verified"
    || record.status !== "confirmed"
    || record.completeness < 1
    || record.realizedPnlMicroUsd < minimum
  ) {
    return { promoted: false, newLabels: [] };
  }

  const existing = await library.getWallet("solana", record.walletAddress);
  const labels = [...new Set([...(existing?.labels ?? []), ...input.labels])].sort();
  const newLabels = labels.filter((label) => !existing?.labels.includes(label));
  await library.upsertWallet({
    chain: "solana",
    address: record.walletAddress,
    origin: "first_hand",
    verificationStatus: "verified",
    ...(existing?.fundingSource ? { fundingSource: existing.fundingSource } : {}),
    ...(existing?.fundingSourceConfidence !== undefined
      ? { fundingSourceConfidence: existing.fundingSourceConfidence }
      : {}),
    ...(existing?.alphaScore !== undefined ? { alphaScore: existing.alphaScore } : {}),
    ...(existing?.alphaScoreTier !== undefined ? { alphaScoreTier: existing.alphaScoreTier } : {}),
    ...(existing?.alphaScoreStatus !== undefined ? { alphaScoreStatus: existing.alphaScoreStatus } : {}),
    labels,
    dataCompleteness: Math.max(existing?.dataCompleteness ?? 0, record.completeness),
    updatedAt: input.promotedAt,
  });
  await library.upsertWalletTokenEdge({
    chain: "solana",
    walletAddress: record.walletAddress,
    tokenId: input.tokenId,
    grossBoughtRaw: record.grossBoughtRaw.toString(),
    grossSoldRaw: record.grossSoldRaw.toString(),
    currentBalanceRaw: record.currentBalanceRaw.toString(),
    realizedPnlUsd: record.realizedPnlMicroUsd <= BigInt(Number.MAX_SAFE_INTEGER)
      && record.realizedPnlMicroUsd >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(record.realizedPnlMicroUsd) / 1_000_000
      : null,
    pnlSource: "self_computed",
    origin: "first_hand",
    verificationStatus: "verified",
    confidence: input.confidence,
    evidence: {
      tokenCa: input.tokenCa,
      leaderboardRuleVersion: record.ruleVersion,
      ...record.evidence,
      ...(input.evidence ?? {}),
    },
    calculatedAt: input.promotedAt,
  });
  const observation: LibraryObservationRecord = {
    id: `leaderboard:${record.evidence.inputsHash}:${record.walletAddress}`,
    chain: "solana",
    subjectKind: "wallet",
    subjectRef: record.walletAddress,
    snapshotKind: "profit_leaderboard_confirmation",
    source: "self_computed",
    origin: "first_hand",
    verificationStatus: "verified",
    trustClass: "A",
    parserVersion: record.ruleVersion,
    observationFingerprint: record.evidence.inputsHash,
    snapshot: {
      tokenCa: input.tokenCa,
      realizedPnlMicroUsd: record.realizedPnlMicroUsd.toString(),
      labels,
      confidence: input.confidence,
      evidence: { ...(input.evidence ?? {}) },
    },
    warnings: [...record.warnings],
    capturedAt: input.promotedAt,
  };
  await library.appendObservation(observation);
  return { promoted: true, newLabels };
}
