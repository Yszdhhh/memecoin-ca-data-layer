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
