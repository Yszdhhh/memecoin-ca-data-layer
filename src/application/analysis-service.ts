import type {
  AnalysisOptions,
  AnalysisResult,
  Chain,
  FirstBuy,
  HolderBalance,
  LargeOrder,
  TokenRef,
} from "../domain/types.js";
import { calculateDevBehavior } from "../domain/rules/dev-behavior.js";
import { detectFundingClusters } from "../domain/rules/funding-clusters.js";
import { calculateRealHolderConcentration } from "../domain/rules/real-holders.js";
import { classifyWallet } from "../domain/rules/wallet-quality.js";
import type { AnalysisCache, AnalysisRepository, ChainDataAdapter, MarketDataProvider } from "./ports.js";

export interface AnalysisServiceConfig {
  quickCacheTtlSeconds: number;
  deepCacheTtlSeconds: number;
  recentTradeWindowMinutes: number;
  largeOrderMinimumUsd: number;
  devFundingLookbackDays: number;
}

const DEFAULT_CONFIG: AnalysisServiceConfig = {
  quickCacheTtlSeconds: 30,
  deepCacheTtlSeconds: 300,
  recentTradeWindowMinutes: 30,
  largeOrderMinimumUsd: 5_000,
  devFundingLookbackDays: 30,
};

export class AnalysisService {
  private readonly adapterByChain: Map<Chain, ChainDataAdapter>;
  private readonly config: AnalysisServiceConfig;

  constructor(
    adapters: ChainDataAdapter[],
    private readonly marketData: MarketDataProvider,
    private readonly repository: AnalysisRepository,
    private readonly cache: AnalysisCache,
    config: Partial<AnalysisServiceConfig> = {},
  ) {
    this.adapterByChain = new Map(adapters.map((adapter) => [adapter.chain, adapter]));
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async getQuickAnalysis(ca: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const adapter = await this.resolveAdapter(ca, options.chainHint);
    const cacheKey = `analysis:quick:${adapter.chain}:${ca.toLowerCase()}`;
    if (!options.forceRefresh) {
      const cached = await this.cache.get(cacheKey);
      if (cached) return cached;
      const stored = await this.repository.findLatest(adapter.chain, ca, this.config.quickCacheTtlSeconds);
      if (stored) return stored;
    }

    const result = await this.buildAnalysis(adapter, ca, false);
    await Promise.all([
      this.repository.save(result),
      this.cache.set(cacheKey, result, this.config.quickCacheTtlSeconds),
    ]);
    return result;
  }

  async getDeepAnalysis(ca: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const adapter = await this.resolveAdapter(ca, options.chainHint);
    const cacheKey = `analysis:deep:${adapter.chain}:${ca.toLowerCase()}`;
    if (!options.forceRefresh) {
      const cached = await this.cache.get(cacheKey);
      if (cached) return cached;
    }
    const result = await this.buildAnalysis(adapter, ca, true);
    await Promise.all([
      this.repository.save(result),
      this.cache.set(cacheKey, result, this.config.deepCacheTtlSeconds),
    ]);
    return result;
  }

  async refreshTokenData(ca: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const adapter = await this.resolveAdapter(ca, options.chainHint);
    await Promise.all([
      this.cache.delete(`analysis:quick:${adapter.chain}:${ca.toLowerCase()}`),
      this.cache.delete(`analysis:deep:${adapter.chain}:${ca.toLowerCase()}`),
    ]);
    return this.getQuickAnalysis(ca, { ...options, chainHint: adapter.chain, forceRefresh: true });
  }

  private async resolveAdapter(ca: string, chainHint?: Chain): Promise<ChainDataAdapter> {
    if (chainHint) {
      const hinted = this.adapterByChain.get(chainHint);
      if (!hinted) throw new Error(`Chain adapter is not configured: ${chainHint}`);
      return hinted;
    }
    const candidates: Chain[] = ca.startsWith("0x") ? ["bsc", "robinhood"] : ["solana"];
    const probes = await Promise.all(
      candidates.map(async (chain) => {
        const adapter = this.adapterByChain.get(chain);
        if (!adapter) return null;
        return (await adapter.probeToken(ca)) ? adapter : null;
      }),
    );
    const matches = probes.filter((value): value is ChainDataAdapter => value !== null);
    if (matches.length === 0) throw new Error(`Token not found on configured chains: ${ca}`);
    if (matches.length > 1) throw new Error("EVM contract exists on multiple chains; pass chainHint explicitly");
    return matches[0]!;
  }

  private async buildAnalysis(adapter: ChainDataAdapter, ca: string, deep: boolean): Promise<AnalysisResult> {
    const now = new Date();
    const since = new Date(now.getTime() - this.config.recentTradeWindowMinutes * 60_000);
    const token = await adapter.getToken(ca);

    const [market, rawHolders, trades, transfers] = await Promise.all([
      this.marketData.getMarket(token),
      adapter.getHolders(token),
      adapter.getRecentTrades(token, since),
      adapter.getTransfers(token, token.createdAt ?? new Date(0)),
    ]);

    const ownerAddresses = uniqueOwners(rawHolders).slice(0, 100);
    const fundingSince = new Date(now.getTime() - this.config.devFundingLookbackDays * 86_400_000);
    const [addressTags, fundingEdges] = await Promise.all([
      adapter.getAddressTags(token, ownerAddresses),
      adapter.getFundingEdges(ownerAddresses, fundingSince),
    ]);
    const firstBuys: FirstBuy[] = firstBuyPerWallet(trades);
    const clusterMembers = detectFundingClusters(fundingEdges, firstBuys);
    const holders = calculateRealHolderConcentration({
      holders: rawHolders,
      totalSupplyRaw: token.totalSupplyRaw,
      addressTags,
      clusterMembers,
    });

    const largeTrades = trades.filter((trade) => (trade.quoteUsd ?? 0) >= this.config.largeOrderMinimumUsd);
    const largeTradeAddresses = [...new Set(largeTrades.map((trade) => trade.trader))];
    const walletFacts = await adapter.getWalletFacts(largeTradeAddresses, now);
    const largeOrders: LargeOrder[] = largeTrades.map((trade) => ({
      ...trade,
      walletQuality: classifyWallet(
        walletFacts.get(trade.trader) ?? {
          address: trade.trader,
          transactionCount: 0,
          swapsLast24h: 0,
          tags: addressTags.filter((tag) => tag.address === trade.trader),
        },
        trade.blockTime,
      ),
    }));

    const dev = token.creatorAddress
      ? buildDevBehavior(token, rawHolders, trades, transfers, fundingEdges, now)
      : null;
    const creatorProfile = deep && token.creatorAddress ? await adapter.getCreatorProfile(token) : undefined;
    const warnings: string[] = [];
    if (!token.creatorAddress) warnings.push("未能从创建指令/工厂事件中确认 creator，Dev 指标暂缺");
    if (!market) warnings.push("补充市场数据不可用；链上持仓与交易口径不受影响");
    if (clusterMembers.length > 0) warnings.push(`已从真实集中度中排除 ${clusterMembers.length} 个高置信同源地址`);

    return {
      token,
      market,
      holders,
      dev,
      largeOrders,
      ...(creatorProfile ? { creatorProfile } : {}),
      warnings,
      dataAsOf: now,
    };
  }
}

function uniqueOwners(holders: HolderBalance[]): string[] {
  return [...new Set(holders.sort((a, b) => (a.balanceRaw > b.balanceRaw ? -1 : 1)).map((item) => item.ownerAddress ?? item.address))];
}

function firstBuyPerWallet(trades: import("../domain/types.js").NormalizedTrade[]): FirstBuy[] {
  const first = new Map<string, FirstBuy>();
  for (const trade of trades.filter((item) => item.side === "buy").sort((a, b) => a.blockTime.getTime() - b.blockTime.getTime())) {
    if (!first.has(trade.trader)) {
      first.set(trade.trader, {
        buyer: trade.trader,
        boughtAt: trade.blockTime,
        amountRaw: trade.tokenAmountRaw,
        txHash: trade.txHash,
      });
    }
  }
  return [...first.values()];
}

function buildDevBehavior(
  token: TokenRef,
  holders: HolderBalance[],
  trades: import("../domain/types.js").NormalizedTrade[],
  transfers: import("../domain/types.js").TokenTransfer[],
  fundingEdges: import("../domain/types.js").FundingEdge[],
  now: Date,
) {
  const creator = token.creatorAddress!;
  const relatedAddresses = [...new Set(fundingEdges.filter((edge) => edge.funder === creator).map((edge) => edge.recipient))];
  const balanceByOwner = new Map<string, bigint>();
  for (const holder of holders) {
    const owner = holder.ownerAddress ?? holder.address;
    balanceByOwner.set(owner, (balanceByOwner.get(owner) ?? 0n) + holder.balanceRaw);
  }
  return calculateDevBehavior({
    creatorAddress: creator,
    totalSupplyRaw: token.totalSupplyRaw,
    directCurrentBalanceRaw: balanceByOwner.get(creator) ?? 0n,
    relatedCurrentBalances: new Map(relatedAddresses.map((address) => [address, balanceByOwner.get(address) ?? 0n])),
    trades,
    transfers,
    relatedAddresses,
    calculatedAt: now,
  });
}
