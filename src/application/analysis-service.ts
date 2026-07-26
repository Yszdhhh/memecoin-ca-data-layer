import type {
  AnalysisOptions,
  AnalysisResult,
  Chain,
  ClusterMember,
  FirstBuy,
  HolderBalance,
  HolderSnapshotEvidence,
  LargeOrder,
  SolanaAnalysisEvidence,
  TokenRef,
} from "../domain/types.js";
import { detectFundingClusters } from "../domain/rules/funding-clusters.js";
import { calculateDevBehavior } from "../domain/rules/dev-behavior.js";
import { calculateRealHolderConcentration } from "../domain/rules/real-holders.js";
import { classifyWallet } from "../domain/rules/wallet-quality.js";
import type { AnalysisCache, AnalysisRepository, AuditedSolanaFactsAdapter, ChainDataAdapter, MarketDataProvider } from "./ports.js";
import type { PumpCreatorEvidence, SolanaDevHistoryResult } from "../infrastructure/solana/dev/solana-dev-history-service.js";
import type { HolderCleaningEvidence, SolanaHolderSnapshot } from "../infrastructure/solana/holders/solana-holder-snapshot-service.js";

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

    const [marketResult, rawHolders, trades, transfers] = await Promise.all([
      this.getMarketSafely(token),
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

    const warnings: string[] = [...marketResult.warnings];
    let resultToken = token;
    let holders = null;
    let holderCompleteness: AnalysisResult["holderCompleteness"] = "unavailable";
    let dev = null;
    let devCompleteness: AnalysisResult["devCompleteness"] = "unavailable";
    let solanaEvidence: SolanaAnalysisEvidence | undefined;

    if (adapter.chain === "solana") {
      const solanaAdapter = asAuditedSolanaFactsAdapter(adapter);
      if (!solanaAdapter || !solanaAdapter.hasAuditedSolanaFacts()) {
        warnings.push("SOLANA_AUDITED_FACT_SERVICES_UNAVAILABLE");
        warnings.push("HOLDER_CONCENTRATION_INDETERMINATE");
        warnings.push("DEV_TOTALS_INDETERMINATE");
      } else {
        const [holderSnapshot, creatorEvidence] = await Promise.all([
          solanaAdapter.getAuditedHolderSnapshot(token, addressTags, clusterMembers),
          solanaAdapter.getPinnedPumpCreatorEvidence(token),
        ]);
        holderCompleteness = snapshotCompleteness(holderSnapshot);
        if (holderSnapshot?.completeness === "complete" && holderSnapshot.concentration !== null) {
          holders = holderSnapshot.concentration;
        } else {
          warnings.push("HOLDER_CONCENTRATION_INDETERMINATE");
          if (holderSnapshot) warnings.push(...holderSnapshot.warnings);
        }

        if (creatorEvidence === null) {
          devCompleteness = "partial";
          warnings.push("CREATOR_EVIDENCE_MISSING_OR_UNTRUSTED");
          warnings.push("DEV_TOTALS_INDETERMINATE");
          solanaEvidence = {
            creator: null,
            holderSnapshot: holderSnapshot ? holderSnapshotEvidence(holderSnapshot) : null,
            devHistory: null,
          };
        } else {
          resultToken = { ...token, creatorAddress: creatorEvidence.creatorAddress };
          const relatedAddresses = relatedAddressesFor(creatorEvidence.creatorAddress, fundingEdges);
          const devHistory = holderSnapshot?.completeness === "complete"
            ? await solanaAdapter.getAuditedDevHistory({ token, creatorEvidence, holderSnapshot, relatedAddresses, at: now })
            : null;
          devCompleteness = devHistory === null
            ? (holderSnapshot?.completeness === "partial" ? "partial" : "unavailable")
            : (devHistory.coverage.completeFromCreation ? "complete" : "partial");
          if (devHistory?.dev !== null && devHistory?.coverage.completeFromCreation) {
            dev = devHistory.dev;
          } else {
            warnings.push("DEV_TOTALS_INDETERMINATE");
            if (devHistory) warnings.push(...devHistory.warnings);
          }
          solanaEvidence = {
            creator: creatorEvidence,
            holderSnapshot: holderSnapshot ? holderSnapshotEvidence(holderSnapshot) : null,
            devHistory: devHistory ? copyDevCoverage(devHistory) : null,
          };
        }
      }
    } else {
      holders = calculateRealHolderConcentration({
        holders: rawHolders,
        totalSupplyRaw: token.totalSupplyRaw,
        addressTags,
        clusterMembers,
      });
      holderCompleteness = "complete";
      dev = token.creatorAddress
        ? buildDevBehavior(token, rawHolders, trades, transfers, fundingEdges, now)
        : null;
      devCompleteness = token.creatorAddress ? "complete" : "unavailable";
    }

    const creatorProfile = deep && resultToken.creatorAddress ? await adapter.getCreatorProfile(resultToken) : undefined;
    if (!marketResult.market) warnings.push("补充市场数据不可用；链上持仓与交易口径不受影响");
    if (clusterMembers.length > 0) warnings.push(`已从真实集中度中排除 ${clusterMembers.length} 个高置信同源地址`);

    return {
      token: resultToken,
      market: marketResult.market,
      holders,
      holderCompleteness,
      dev,
      devCompleteness,
      largeOrders,
      ...(creatorProfile ? { creatorProfile } : {}),
      ...(solanaEvidence ? { solanaEvidence } : {}),
      warnings,
      dataAsOf: now,
    };
  }

  private async getMarketSafely(token: TokenRef): Promise<{ market: AnalysisResult["market"]; warnings: string[] }> {
    try {
      return { market: await this.marketData.getMarket(token), warnings: [] };
    } catch {
      return { market: null, warnings: ["MARKET_ENRICHMENT_UNAVAILABLE"] };
    }
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

function asAuditedSolanaFactsAdapter(adapter: ChainDataAdapter): AuditedSolanaFactsAdapter | null {
  if (adapter.chain !== "solana") return null;
  return "getAuditedHolderSnapshot" in adapter
    && "getPinnedPumpCreatorEvidence" in adapter
    && "getAuditedDevHistory" in adapter
    && "hasAuditedSolanaFacts" in adapter
    ? adapter as AuditedSolanaFactsAdapter
    : null;
}

function snapshotCompleteness(snapshot: SolanaHolderSnapshot | null): AnalysisResult["holderCompleteness"] {
  if (snapshot === null) return "unavailable";
  return snapshot.completeness;
}

function holderSnapshotEvidence(snapshot: SolanaHolderSnapshot): HolderSnapshotEvidence {
  return {
    completeness: snapshot.completeness,
    rawTokenAccounts: snapshot.rawTokenAccounts.map((account) => ({
      address: account.tokenAccountAddress,
      ownerAddress: account.ownerAddress,
      balanceRaw: account.balanceRaw,
    })),
    ownerBalances: new Map(snapshot.ownerBalances),
    watermarks: snapshot.watermarks.map((watermark) => ({ ...watermark, observedAt: new Date(watermark.observedAt) })),
    cleaningEvidence: snapshot.cleaningEvidence.map(copyCleaningEvidence),
    warnings: [...snapshot.warnings],
  };
}

function copyCleaningEvidence(evidence: HolderCleaningEvidence) {
  return {
    address: evidence.address,
    balanceRaw: evidence.balanceRaw,
    exclusionReason: evidence.exclusionReason,
    confidence: evidence.confidence,
    ruleVersion: evidence.ruleVersion,
    rawTokenAccounts: evidence.rawTokenAccounts.map((account) => ({
      address: account.tokenAccountAddress,
      ownerAddress: account.ownerAddress,
      balanceRaw: account.balanceRaw,
    })),
    evidence: {
      ...(evidence.label ? { label: { ...evidence.label, ...(evidence.label.expiresAt ? { expiresAt: new Date(evidence.label.expiresAt) } : {}) } } : {}),
      ...(evidence.cluster ? { cluster: { ...evidence.cluster, evidence: { ...evidence.cluster.evidence } } } : {}),
    },
  };
}

function copyDevCoverage(history: SolanaDevHistoryResult) {
  return { ...history.coverage, observedAt: new Date(history.coverage.observedAt) };
}

function relatedAddressesFor(creatorAddress: string, fundingEdges: import("../domain/types.js").FundingEdge[]): string[] {
  return [...new Set(fundingEdges.filter((edge) => edge.funder === creatorAddress).map((edge) => edge.recipient))];
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
  const relatedAddresses = relatedAddressesFor(creator, fundingEdges);
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
