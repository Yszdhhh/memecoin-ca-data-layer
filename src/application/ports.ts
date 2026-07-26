import type {
  AddressTag,
  AnalysisResult,
  Chain,
  CreatorProfile,
  FundingEdge,
  HolderBalance,
  MarketSnapshot,
  NormalizedTrade,
  TokenRef,
  TokenTransfer,
  WalletFacts,
} from "../domain/types.js";
import type { PumpCreatorEvidence, SolanaDevHistoryResult } from "../infrastructure/solana/dev/solana-dev-history-service.js";
import type { SolanaHolderSnapshot } from "../infrastructure/solana/holders/solana-holder-snapshot-service.js";

export interface ChainDataAdapter {
  readonly chain: Chain;
  probeToken(ca: string): Promise<boolean>;
  getToken(ca: string): Promise<TokenRef>;
  getHolders(token: TokenRef): Promise<HolderBalance[]>;
  getAddressTags(token: TokenRef, addresses: string[]): Promise<AddressTag[]>;
  getRecentTrades(token: TokenRef, since: Date): Promise<NormalizedTrade[]>;
  getTransfers(token: TokenRef, since: Date): Promise<TokenTransfer[]>;
  getFundingEdges(addresses: string[], since: Date): Promise<FundingEdge[]>;
  getWalletFacts(addresses: string[], at: Date): Promise<Map<string, WalletFacts>>;
  getCreatorProfile(token: TokenRef): Promise<CreatorProfile>;
}

/**
 * Solana's final report uses this narrow extension instead of deriving creator,
 * holder concentration, or Dev totals from the generic adapter calls.  The
 * returned values are products of the audited Pump, holder-snapshot and Dev
 * history services and remain fixture-friendly.
 */
export interface AuditedSolanaFactsAdapter extends ChainDataAdapter {
  readonly chain: "solana";
  hasAuditedSolanaFacts(): boolean;
  getAuditedHolderSnapshot(
    token: TokenRef,
    addressTags: AddressTag[],
    clusterMembers: import("../domain/types.js").ClusterMember[],
  ): Promise<SolanaHolderSnapshot | null>;
  getPinnedPumpCreatorEvidence(token: TokenRef): Promise<PumpCreatorEvidence | null>;
  getAuditedDevHistory(input: {
    token: TokenRef;
    creatorEvidence: PumpCreatorEvidence;
    holderSnapshot: SolanaHolderSnapshot;
    relatedAddresses: string[];
    at: Date;
  }): Promise<SolanaDevHistoryResult | null>;
}

export interface MarketDataProvider {
  getMarket(token: TokenRef): Promise<MarketSnapshot | null>;
}

export interface AnalysisRepository {
  findLatest(chain: Chain, ca: string, maximumAgeSeconds: number): Promise<AnalysisResult | null>;
  save(result: AnalysisResult): Promise<void>;
}

export interface AnalysisCache {
  get(key: string): Promise<AnalysisResult | null>;
  set(key: string, value: AnalysisResult, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}
