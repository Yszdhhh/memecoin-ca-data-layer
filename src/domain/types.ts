export type Chain = "solana" | "bsc" | "robinhood";

export type Launchpad = "pump_fun" | "four_meme" | "pons_family" | "flap" | "unknown";

export type AddressRole =
  | "bonding_curve"
  | "official_proxy"
  | "liquidity_pool"
  | "burn"
  | "exchange"
  | "router"
  | "whitelist"
  | "blacklist"
  | "unknown";

export interface TokenRef {
  id: string;
  chain: Chain;
  ca: string;
  name?: string;
  symbol?: string;
  decimals: number;
  totalSupplyRaw: bigint;
  creatorAddress?: string;
  launchpad: Launchpad;
  createdAt?: Date;
  creationTx?: string;
}

export interface HolderBalance {
  address: string;
  balanceRaw: bigint;
  ownerAddress?: string;
}

export interface AddressTag {
  chain: Chain;
  address: string;
  role: AddressRole;
  source: "system" | "manual" | "heuristic" | "provider";
  confidence: number;
  expiresAt?: Date;
}

export interface FundingEdge {
  chain: Chain;
  funder: string;
  recipient: string;
  amountNativeRaw: bigint;
  fundedAt: Date;
  recipientFirstSeenAt?: Date;
}

export interface FirstBuy {
  buyer: string;
  boughtAt: Date;
  amountRaw: bigint;
  txHash: string;
}

export interface ClusterMember {
  address: string;
  clusterId: string;
  confidence: number;
  evidence: Record<string, unknown>;
}

export type HolderExclusionReason =
  | "bonding_curve"
  | "official_proxy"
  | "liquidity_pool"
  | "burn"
  | "same_source_cluster";

export interface CleanHolderRow extends HolderBalance {
  rank?: number;
  supplyPct: number;
  excluded: boolean;
  exclusionReason?: HolderExclusionReason;
  clusterId?: string;
}

export interface HolderConcentration {
  top10Pct: number;
  top20Pct: number;
  eligibleHolderCount: number;
  excludedPct: number;
  rows: CleanHolderRow[];
}

export type TradeSide = "buy" | "sell";

export interface NormalizedTrade {
  chain: Chain;
  tokenId: string;
  txHash: string;
  eventIndex: number;
  blockNumber: bigint;
  blockTime: Date;
  trader: string;
  side: TradeSide;
  tokenAmountRaw: bigint;
  quoteAmountRaw: bigint;
  quoteUsd?: number;
  venueAddress?: string;
  venue?: string;
}

export interface TokenTransfer {
  chain: Chain;
  tokenId: string;
  txHash: string;
  eventIndex: number;
  blockTime: Date;
  from: string;
  to: string;
  amountRaw: bigint;
}

export interface DevBehavior {
  creatorAddress: string;
  currentHoldingPct: number;
  relatedHoldingPct: number;
  grossBoughtPct: number;
  grossSoldPct: number;
  netDisposedPct: number;
  soldOfAcquiredPct: number | null;
  directSellCount: number;
  relatedGrossSoldPct: number;
  outboundTransferPct: number;
  relatedAddresses: string[];
  calculatedAt: Date;
}

export type WalletQualityLabel =
  | "new_wallet"
  | "historical_wallet"
  | "suspected_bot"
  | "whitelist"
  | "blacklist"
  | "unknown";

export interface WalletFacts {
  address: string;
  firstSeenAt?: Date;
  transactionCount: number;
  swapsLast24h: number;
  medianSwapIntervalSeconds?: number;
  failedTxRatio?: number;
  tags: AddressTag[];
}

export interface WalletQuality {
  primary: WalletQualityLabel;
  labels: WalletQualityLabel[];
  score: number;
  reasons: string[];
}

export interface LargeOrder extends NormalizedTrade {
  walletQuality: WalletQuality;
}

export interface CreatorProfile {
  chain: Chain;
  creatorAddress: string;
  tokenCount: number;
  graduatedCount: number;
  graduationRate: number | null;
  highestFdvUsd: number | null;
  successfulTokenCount: number;
  dataCompleteness: number;
  calculatedAt: Date;
}

export interface MarketSnapshot {
  priceUsd: number | null;
  fdvUsd: number | null;
  liquidityUsd: number | null;
  pairAddress?: string;
  observedAt: Date;
  source: string;
}

export interface AnalysisResult {
  token: TokenRef;
  market: MarketSnapshot | null;
  holders: HolderConcentration;
  dev: DevBehavior | null;
  largeOrders: LargeOrder[];
  creatorProfile?: CreatorProfile;
  warnings: string[];
  dataAsOf: Date;
}

export interface AnalysisOptions {
  chainHint?: Chain;
  forceRefresh?: boolean;
}
