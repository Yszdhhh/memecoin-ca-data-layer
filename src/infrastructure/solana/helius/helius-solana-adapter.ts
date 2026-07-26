import type {
  AddressRole,
  AddressTag,
  CreatorProfile,
  FundingEdge,
  HolderBalance,
  NormalizedTrade,
  TokenRef,
  TokenTransfer,
  WalletFacts,
} from "../../../domain/types.js";
import type { AuditedSolanaFactsAdapter } from "../../../application/ports.js";
import {
  PUMP_IDL_COMMIT,
  PUMP_IDL_SHA256,
  PUMP_PROGRAM_ID,
} from "../pump/pump-instruction-decoder.js";
import type { PumpCreatorEvidence, SolanaDevHistoryResult } from "../dev/solana-dev-history-service.js";
import type { ClusterMember } from "../../../domain/types.js";
import type { SolanaHolderSnapshot } from "../holders/solana-holder-snapshot-service.js";

/**
 * A reproducible cursor for a response used to build an analysis.  The concrete
 * Helius/RPC client owns the transport details; this boundary keeps the facts
 * needed for a later replay without retaining credentials or full responses.
 */
export interface SourceWatermark {
  source: "helius" | "solana_rpc";
  observedAt: Date;
  finalizedSlot?: bigint;
  cursor?: string;
  completeness: "complete" | "partial";
}

export interface SourceResponse<T> {
  data: T;
  watermark: SourceWatermark;
}

export interface RpcMint {
  decimals: number;
  supplyRaw: string;
}

export interface RpcTokenAccount {
  tokenAccount: string;
  owner: string;
  amountRaw: string;
}

export interface HeliusTokenMetadata {
  name?: string;
  symbol?: string;
  createdAt?: string;
  creationTx?: string;
}

export interface HeliusTokenTransfer {
  eventIndex: number;
  mint: string;
  from: string;
  to: string;
  amountRaw: string;
  /** A swap leg must never be reported as a token transfer. */
  kind: "swap" | "transfer";
}

export interface HeliusNativeTransfer {
  eventIndex: number;
  from: string;
  to: string;
  amountRaw: string;
}

export interface HeliusSwapTokenLeg {
  mint: string;
  amountRaw: string;
}

export interface HeliusSwap {
  /** The account whose balance changed in the swap; a fee payer is not a safe substitute. */
  user: string;
  tokenInputs: HeliusSwapTokenLeg[];
  tokenOutputs: HeliusSwapTokenLeg[];
  quoteInputRaw?: string;
  quoteOutputRaw?: string;
  quoteUsd?: number;
  venueAddress?: string;
  venue?: string;
}

export interface HeliusTransaction {
  signature: string;
  slot: string;
  blockTime: string;
  swap?: HeliusSwap;
  tokenTransfers: HeliusTokenTransfer[];
  nativeTransfers: HeliusNativeTransfer[];
}

export interface HeliusAddressTag {
  address: string;
  role: AddressRole;
  source: AddressTag["source"];
  confidence: number;
  expiresAt?: string;
}

export interface HeliusWalletFacts {
  address: string;
  firstSeenAt?: string;
  transactionCount: number;
  swapsLast24h: number;
  medianSwapIntervalSeconds?: number;
  failedTxRatio?: number;
  tags: HeliusAddressTag[];
}

/**
 * The only provider-specific boundary used by the application adapter.  A live
 * Helius/RPC implementation can satisfy this interface, while tests use fixed
 * responses with their own watermarks and no network access.
 */
export interface SolanaHeliusDataSource {
  getMint(ca: string): Promise<SourceResponse<RpcMint | null>>;
  getTokenAccounts(ca: string): Promise<SourceResponse<RpcTokenAccount[]>>;
  getTokenMetadata(ca: string): Promise<SourceResponse<HeliusTokenMetadata | null>>;
  getTransactions(addresses: string[], since: Date): Promise<SourceResponse<HeliusTransaction[]>>;
  getAddressTags(addresses: string[]): Promise<SourceResponse<HeliusAddressTag[]>>;
  getWalletFacts(addresses: string[], at: Date): Promise<SourceResponse<HeliusWalletFacts[]>>;
  getCreatorProfile?(creatorAddress: string, at: Date): Promise<SourceResponse<CreatorProfile | null>>;
  /** Outputs are built by the pinned, offline-verifiable services, not inferred from labels. */
  getHolderSnapshot?(
    token: TokenRef,
    addressTags: AddressTag[],
    clusterMembers: ClusterMember[],
  ): Promise<SourceResponse<SolanaHolderSnapshot>>;
  getPumpCreatorEvidence?(token: TokenRef): Promise<SourceResponse<PumpCreatorEvidence | null>>;
  getDevHistory?(input: {
    token: TokenRef;
    creatorEvidence: PumpCreatorEvidence;
    holderSnapshot: SolanaHolderSnapshot;
    relatedAddresses: string[];
    at: Date;
  }): Promise<SourceResponse<SolanaDevHistoryResult>>;
}

export class SourceDataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceDataUnavailableError";
  }
}

export class HeliusSolanaAdapter implements AuditedSolanaFactsAdapter {
  readonly chain = "solana" as const;
  private readonly watermarks: SourceWatermark[] = [];

  constructor(private readonly source: SolanaHeliusDataSource) {}

  /** Returns immutable copies so analysis manifests cannot mutate adapter state. */
  getSourceWatermarks(): SourceWatermark[] {
    return this.watermarks.map((watermark) => ({ ...watermark, observedAt: new Date(watermark.observedAt) }));
  }

  async probeToken(ca: string): Promise<boolean> {
    const mint = await this.record(this.source.getMint(ca));
    return mint !== null;
  }

  async getToken(ca: string): Promise<TokenRef> {
    const [mint, metadata] = await Promise.all([
      this.record(this.source.getMint(ca)),
      this.record(this.source.getTokenMetadata(ca)),
    ]);
    if (!mint) throw new SourceDataUnavailableError(`Solana mint was not found: ${ca}`);

    return {
      id: `solana:${ca}`,
      chain: "solana",
      ca,
      decimals: mint.decimals,
      totalSupplyRaw: rawInteger(mint.supplyRaw, "mint supply"),
      ...(metadata?.name ? { name: metadata.name } : {}),
      ...(metadata?.symbol ? { symbol: metadata.symbol } : {}),
      // Creator is intentionally omitted. Pump create.creator is resolved by SOL-PUMP-001.
      launchpad: "unknown",
      ...(metadata?.createdAt ? { createdAt: date(metadata.createdAt, "metadata createdAt") } : {}),
      ...(metadata?.creationTx ? { creationTx: metadata.creationTx } : {}),
    };
  }

  async getHolders(token: TokenRef): Promise<HolderBalance[]> {
    const accounts = await this.record(this.source.getTokenAccounts(token.ca));
    const byOwner = new Map<string, bigint>();
    for (const account of accounts) {
      const amount = rawInteger(account.amountRaw, `token account amount for ${account.tokenAccount}`);
      byOwner.set(account.owner, (byOwner.get(account.owner) ?? 0n) + amount);
    }
    return [...byOwner.entries()]
      .map(([ownerAddress, balanceRaw]) => ({ address: ownerAddress, ownerAddress, balanceRaw }))
      .sort((left, right) => compareBigintDesc(left.balanceRaw, right.balanceRaw));
  }

  async getAddressTags(_token: TokenRef, addresses: string[]): Promise<AddressTag[]> {
    const tags = await this.record(this.source.getAddressTags(addresses));
    return tags.map((tag) => ({
      chain: "solana",
      address: tag.address,
      role: tag.role,
      source: tag.source,
      confidence: tag.confidence,
      ...(tag.expiresAt ? { expiresAt: date(tag.expiresAt, `tag expiry for ${tag.address}`) } : {}),
    }));
  }

  async getRecentTrades(token: TokenRef, since: Date): Promise<NormalizedTrade[]> {
    const transactions = await this.record(this.source.getTransactions([token.ca], since));
    return transactions
      .filter((transaction) => date(transaction.blockTime, `blockTime for ${transaction.signature}`) >= since)
      .flatMap((transaction) => normalizeSwap(token, transaction));
  }

  async getTransfers(token: TokenRef, since: Date): Promise<TokenTransfer[]> {
    const transactions = await this.record(this.source.getTransactions([token.ca], since));
    return transactions.flatMap((transaction) => {
      const blockTime = date(transaction.blockTime, `blockTime for ${transaction.signature}`);
      if (blockTime < since) return [];
      return transaction.tokenTransfers
        .filter((transfer) => transfer.mint === token.ca && transfer.kind === "transfer")
        .map((transfer) => ({
          chain: "solana" as const,
          tokenId: token.id,
          txHash: transaction.signature,
          eventIndex: transfer.eventIndex,
          blockTime,
          from: transfer.from,
          to: transfer.to,
          amountRaw: rawInteger(transfer.amountRaw, `token transfer in ${transaction.signature}`),
        }));
    });
  }

  async getFundingEdges(addresses: string[], since: Date): Promise<FundingEdge[]> {
    const requested = new Set(addresses);
    const transactions = await this.record(this.source.getTransactions(addresses, since));
    const seen = new Set<string>();
    const edges: FundingEdge[] = [];
    for (const transaction of transactions) {
      const fundedAt = date(transaction.blockTime, `blockTime for ${transaction.signature}`);
      if (fundedAt < since) continue;
      for (const transfer of transaction.nativeTransfers) {
        if (!requested.has(transfer.to)) continue;
        const id = `${transaction.signature}:${transfer.eventIndex}`;
        if (seen.has(id)) continue;
        seen.add(id);
        edges.push({
          chain: "solana",
          funder: transfer.from,
          recipient: transfer.to,
          amountNativeRaw: rawInteger(transfer.amountRaw, `native transfer in ${transaction.signature}`),
          fundedAt,
        });
      }
    }
    return edges;
  }

  async getWalletFacts(addresses: string[], at: Date): Promise<Map<string, WalletFacts>> {
    const facts = await this.record(this.source.getWalletFacts(addresses, at));
    return new Map(facts.map((fact) => [fact.address, {
      address: fact.address,
      transactionCount: fact.transactionCount,
      swapsLast24h: fact.swapsLast24h,
      ...(fact.firstSeenAt ? { firstSeenAt: date(fact.firstSeenAt, `first seen for ${fact.address}`) } : {}),
      ...(fact.medianSwapIntervalSeconds !== undefined ? { medianSwapIntervalSeconds: fact.medianSwapIntervalSeconds } : {}),
      ...(fact.failedTxRatio !== undefined ? { failedTxRatio: fact.failedTxRatio } : {}),
      tags: fact.tags.map((tag) => ({
        chain: "solana" as const,
        address: tag.address,
        role: tag.role,
        source: tag.source,
        confidence: tag.confidence,
        ...(tag.expiresAt ? { expiresAt: date(tag.expiresAt, `tag expiry for ${tag.address}`) } : {}),
      })),
    }]));
  }

  async getCreatorProfile(token: TokenRef): Promise<CreatorProfile> {
    if (!token.creatorAddress) throw new SourceDataUnavailableError("Creator profile requires creator evidence from a create instruction");
    if (!this.source.getCreatorProfile) throw new SourceDataUnavailableError("Creator profile source is not configured");
    const profile = await this.record(this.source.getCreatorProfile(token.creatorAddress, new Date()));
    if (!profile) throw new SourceDataUnavailableError(`Creator profile was unavailable: ${token.creatorAddress}`);
    return profile;
  }

  hasAuditedSolanaFacts(): boolean {
    return this.source.getHolderSnapshot !== undefined
      && this.source.getPumpCreatorEvidence !== undefined
      && this.source.getDevHistory !== undefined;
  }

  async getAuditedHolderSnapshot(
    token: TokenRef,
    addressTags: AddressTag[],
    clusterMembers: ClusterMember[],
  ): Promise<SolanaHolderSnapshot | null> {
    if (!this.source.getHolderSnapshot) return null;
    return this.record(this.source.getHolderSnapshot(token, addressTags, clusterMembers));
  }

  async getPinnedPumpCreatorEvidence(token: TokenRef): Promise<PumpCreatorEvidence | null> {
    if (!this.source.getPumpCreatorEvidence) return null;
    const evidence = await this.record(this.source.getPumpCreatorEvidence(token));
    return isPinnedPumpCreatorEvidence(evidence) ? copyCreatorEvidence(evidence) : null;
  }

  async getAuditedDevHistory(input: {
    token: TokenRef;
    creatorEvidence: PumpCreatorEvidence;
    holderSnapshot: SolanaHolderSnapshot;
    relatedAddresses: string[];
    at: Date;
  }): Promise<SolanaDevHistoryResult | null> {
    if (!this.source.getDevHistory) return null;
    if (!isPinnedPumpCreatorEvidence(input.creatorEvidence)) return null;
    if (input.holderSnapshot.completeness !== "complete") return null;
    return this.record(this.source.getDevHistory({
      ...input,
      creatorEvidence: copyCreatorEvidence(input.creatorEvidence),
      relatedAddresses: [...input.relatedAddresses],
      at: new Date(input.at),
    }));
  }

  private async record<T>(request: Promise<SourceResponse<T>>): Promise<T> {
    const response = await request;
    this.watermarks.push({ ...response.watermark, observedAt: new Date(response.watermark.observedAt) });
    return response.data;
  }
}

function normalizeSwap(token: TokenRef, transaction: HeliusTransaction): NormalizedTrade[] {
  const swap = transaction.swap;
  if (!swap) return [];
  const inputs = swap.tokenInputs.filter((leg) => leg.mint === token.ca);
  const outputs = swap.tokenOutputs.filter((leg) => leg.mint === token.ca);
  // A same-mint input/output is ambiguous (for example a route or token-2022 fee).
  if ((inputs.length === 0 && outputs.length === 0) || (inputs.length > 0 && outputs.length > 0)) return [];
  const side = outputs.length > 0 ? "buy" : "sell";
  const tokenAmountRaw = sumRaw(side === "buy" ? outputs : inputs, `swap in ${transaction.signature}`);
  const quoteAmountRaw = rawInteger(
    side === "buy" ? (swap.quoteInputRaw ?? "0") : (swap.quoteOutputRaw ?? "0"),
    `swap quote in ${transaction.signature}`,
  );
  return [{
    chain: "solana",
    tokenId: token.id,
    txHash: transaction.signature,
    eventIndex: 0,
    blockNumber: rawInteger(transaction.slot, `slot for ${transaction.signature}`),
    blockTime: date(transaction.blockTime, `blockTime for ${transaction.signature}`),
    trader: swap.user,
    side,
    tokenAmountRaw,
    quoteAmountRaw,
    ...(swap.quoteUsd !== undefined ? { quoteUsd: swap.quoteUsd } : {}),
    ...(swap.venueAddress ? { venueAddress: swap.venueAddress } : {}),
    ...(swap.venue ? { venue: swap.venue } : {}),
  }];
}

function sumRaw(legs: HeliusSwapTokenLeg[], context: string): bigint {
  return legs.reduce((total, leg) => total + rawInteger(leg.amountRaw, context), 0n);
}

function rawInteger(value: string, context: string): bigint {
  if (!/^\d+$/.test(value)) throw new SourceDataUnavailableError(`Expected a non-negative raw integer for ${context}`);
  return BigInt(value);
}

function date(value: string, context: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new SourceDataUnavailableError(`Expected an ISO timestamp for ${context}`);
  return parsed;
}

function compareBigintDesc(left: bigint, right: bigint): number {
  return left === right ? 0 : left > right ? -1 : 1;
}

function isPinnedPumpCreatorEvidence(evidence: PumpCreatorEvidence | null): evidence is PumpCreatorEvidence {
  return evidence !== null
    && evidence.source === "pump_create.creator"
    && evidence.creatorAddress.trim().length > 0
    && evidence.signature.trim().length > 0
    && evidence.slot >= 0n
    && evidence.blockTime instanceof Date
    && !Number.isNaN(evidence.blockTime.getTime())
    && evidence.programId === PUMP_PROGRAM_ID
    && evidence.sourceCommit === PUMP_IDL_COMMIT
    && evidence.idlSha256 === PUMP_IDL_SHA256;
}

function copyCreatorEvidence(evidence: PumpCreatorEvidence): PumpCreatorEvidence {
  return { ...evidence, blockTime: new Date(evidence.blockTime) };
}
