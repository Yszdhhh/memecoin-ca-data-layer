/**
 * Macro liquidity water-level domain types (LiquiditySnapshotV1).
 *
 * Aligned with docs/blueprints/GOAL_EXECUTION_BLUEPRINT_V1.md §5.1
 * (/api/v1/liquidity/latest contract idea: metric set / window / values /
 * freshness / quality) and the §5.3 evidence envelope (source, tier,
 * verificationStatus, observedAt, sourceWatermark, completeness, warnings).
 *
 * Sources:
 * - DefiLlama (no key): Solana DEX volume / protocol fees / chain TVL.
 * - Coinalyze (API key): CEX perpetual liquidation history — NOT on-chain data.
 *
 * Fail-closed contract: a source that could not be read contributes
 * `null` values plus an explicit warning; nothing is ever fabricated.
 */

export type LiquiditySourceName = "defillama" | "coinalyze";

export type LiquidityVerificationStatus = "verified" | "degraded" | "unavailable";

export type LiquidityWindowId = "24h" | "7d" | "30d";

export type LiquidityMetricId =
  | "dex_volume_usd"
  | "protocol_fees_usd"
  | "tvl_usd"
  | "long_liquidation_usd"
  | "short_liquidation_usd";

export interface LiquidityWarning {
  readonly code: string;
  readonly message: string;
}

/**
 * Local water-level percentile stats for one window.
 * `rank` is the percentile rank of `current` within the trailing sample
 * (100 * count(v <= current) / sampleCount), 0..100. `zScore` is null when
 * the window has zero variance.
 */
export interface LiquidityPercentileStats {
  readonly windowDays: 7 | 30;
  readonly current: number;
  readonly p25: number;
  readonly p50: number;
  readonly p75: number;
  readonly rank: number;
  readonly zScore: number | null;
  readonly sampleCount: number;
  /** Versioned pure-function rule that produced these stats (blueprint §5.3 DERIVED). */
  readonly ruleVersion: string;
}

export interface LiquidityPercentilesByWindow {
  readonly "7d": LiquidityPercentileStats | null;
  readonly "30d": LiquidityPercentileStats | null;
}

export interface LiquidityProtocolShare {
  readonly name: string;
  readonly volume24hUsd: number;
  /** 0..100 share of the 24h chain total. */
  readonly share24hPct: number;
}

/** Parsed DefiLlama /overview/{dexs,fees}/solana snapshot (daily-volume/daily-fees dataType). */
export interface DefiLlamaOverviewObservation {
  readonly kind: "dex_volume" | "protocol_fees";
  readonly total24h: number;
  readonly total7d: number | null;
  readonly total30d: number | null;
  readonly change1dPct: number | null;
  readonly change7dPct: number | null;
  readonly change1mPct: number | null;
  readonly protocolShares: readonly LiquidityProtocolShare[];
  readonly percentiles: LiquidityPercentilesByWindow;
  readonly warnings: readonly LiquidityWarning[];
}

/** Parsed DefiLlama /v2/historicalChainTvl/Solana snapshot (latest level + percentiles). */
export interface DefiLlamaTvlObservation {
  readonly tvl: number;
  readonly percentiles: LiquidityPercentilesByWindow;
  readonly warnings: readonly LiquidityWarning[];
}

/** Per-symbol Coinalyze liquidation aggregation over one interval. */
export interface CoinalyzeLiquidationSymbolSummary {
  readonly symbol: string;
  readonly interval: "1hour" | "1day";
  readonly points: number;
  readonly longUsd: number;
  readonly shortUsd: number;
  readonly totalUsd: number;
  /** 0..100 share of long liquidations; null when there is no liquidation volume. */
  readonly longSharePct: number | null;
}

export interface CoinalyzeLiquidationSummary {
  /** False = fail-closed (no API key or fetch failure). Never fakes data. */
  readonly available: boolean;
  readonly symbols: readonly CoinalyzeLiquidationSymbolSummary[];
  readonly totals: { readonly longUsd: number; readonly shortUsd: number; readonly totalUsd: number; readonly longSharePct: number | null } | null;
  readonly window: { readonly from: string; readonly to: string; readonly interval: "1hour" | "1day" };
  readonly warnings: readonly LiquidityWarning[];
}

/** Aggregated DefiLlama water-level snapshot; components degrade to null individually. */
export interface DefiLlamaLiquiditySnapshot {
  readonly volume: DefiLlamaOverviewObservation | null;
  readonly fees: DefiLlamaOverviewObservation | null;
  readonly tvl: DefiLlamaTvlObservation | null;
  readonly observedAt: string;
  readonly warnings: readonly LiquidityWarning[];
}

/** One row of the snapshot metric set: metric + window + value (+ derived percentile). */
export interface LiquidityMetricValueV1 {
  readonly metric: LiquidityMetricId;
  readonly source: LiquiditySourceName;
  readonly window: LiquidityWindowId;
  readonly value: number | null;
  readonly changePct: number | null;
  readonly percentile: LiquidityPercentileStats | null;
}

/** Evidence-envelope style source watermark (§5.3). */
export interface LiquiditySourceWatermarkV1 {
  readonly source: LiquiditySourceName;
  readonly tier: "B" | "DERIVED";
  readonly verificationStatus: LiquidityVerificationStatus;
  readonly observedAt: string | null;
  /** 0..1 share of the source's expected components that were read. */
  readonly completeness: number;
  readonly warnings: readonly LiquidityWarning[];
}

/**
 * Top-level snapshot contract for the future /api/v1/liquidity/latest
 * (blueprint §5.1). JSON-serializable; nulls mean "not available", never 0.
 */
export interface LiquiditySnapshotV1 {
  readonly schemaVersion: "liquidity-snapshot-v1";
  readonly generatedAt: string;
  readonly metricSets: readonly LiquidityMetricValueV1[];
  readonly protocolShares: readonly LiquidityProtocolShare[];
  readonly freshness: { readonly observedAt: string; readonly maxMetricAgeHours: number | null };
  readonly quality: { readonly completeness: number; readonly status: LiquidityVerificationStatus };
  readonly sources: readonly LiquiditySourceWatermarkV1[];
  readonly warnings: readonly LiquidityWarning[];
}
