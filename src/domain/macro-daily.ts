export type MacroChain = "solana" | "bsc" | "robinhood";

export type MacroGlobalMetricName =
  | "dex_volume_usd"
  | "active_trader_count"
  | "btc_transaction_count"
  | "btc_fee_usd";

export type MacroChainMetricName =
  | "dex_volume_usd"
  | "active_trader_count"
  | "swap_transaction_count"
  | "trade_leg_count"
  | "pump_launch_count"
  | "external_pool_count"
  | "pancakeswap_pool_created_count"
  | "pancakeswap_lp_net_change_usd"
  | "uniswap_pool_created_count";

export type MacroHourlyProfileMetricName =
  | MacroChainMetricName
  | "active_trader_address_hour_count"
  | "pump_create_event_count"
  | "valid_pumpswap_pool_create_event_count";

export type MacroCoverageStatus = "declared_registry" | "partial_coverage";

export interface MacroWarning {
  code: string;
  detail?: string;
}

export interface MacroProvenance {
  source: "dune";
  queryRef: string;
  queryVersion: string;
  sourceAsOf: Date;
  computedAt: Date;
  completeness: number;
  warnings: MacroWarning[];
}

export interface MacroGlobalMetricObservation extends MacroProvenance {
  reportDay: string;
  metricName: MacroGlobalMetricName;
  subject: string;
  value: number;
  unit: "usd" | "count";
  historyWindowDays?: number;
  percentile?: number;
}

export interface MacroChainMetricObservation extends MacroProvenance {
  reportDay: string;
  chain: MacroChain;
  section: "capital" | "supply" | "activity" | "timing";
  metricName: MacroChainMetricName;
  value: number;
  unit: "usd" | "count";
  registryVersion: string;
  coverageStatus: MacroCoverageStatus;
}

export interface MacroHourlyChainProfileObservation extends MacroProvenance {
  chain: MacroChain;
  profileWindowDays: 60 | 90;
  metricName: MacroHourlyProfileMetricName;
  hourUtc: number;
  sampleDayCount: number;
  metricValue: number;
  metricShare: number;
  registryVersion: string;
  coverageStatus: MacroCoverageStatus;
  profileEndDayUtc?: string;
  coveredDayCount?: number;
  expectedDayCount?: 60 | 90;
}

export interface MacroHourlyProfileSummary {
  chain: "solana";
  profileWindowDays: 60 | 90;
  profileEndDayUtc: string;
  metricName: MacroHourlyProfileMetricName;
  coveredDayCount: number;
  expectedDayCount: number;
  totalMetricValue: number;
  analysisStatus: "complete" | "partial" | "not_applicable";
  peakHourUtc?: number;
  highActivityWindowUtc?: string;
  intradayTimeConcentrationHhi?: number;
  effectiveActiveHours?: number;
  warnings: MacroWarning[];
}

/**
 * A deliberately fail-closed boundary for a future observation-only sentiment source.
 * It cannot carry a score, count, or demand assertion until a separately authorized
 * source and coverage contract is implemented.
 */
export interface MacroSentimentObservationLayer {
  layer: "sentiment";
  sourceLabel: string;
  sourceAuthorization: "not_authorized";
  coverageStatus: "unknown";
  observationStatus: "park";
  warnings: MacroWarning[];
}

export interface MacroMarketActivitySummary {
  reportDay: string;
  basis: "complete_declared_daily_dex_activity";
  analysisStatus: "complete" | "not_comparable";
  eligibleChains: MacroChain[];
  leadingChains?: MacroChain[];
  excludedChains: Array<{
    chain: MacroChain;
    reason: "partial_coverage" | "missing_or_partial_activity_inputs";
  }>;
  warnings: MacroWarning[];
}

/**
 * A source-labelled, manually captured external snapshot. It is intentionally
 * separate from Dune UTC-day observations and carries no liquidity or demand claim.
 */
export interface MacroDexScreenerRolling24hObservation {
  layer: "dexscreener_realtime";
  sourceLabel: string;
  chain: "solana";
  capturedAt: Date;
  rollingWindowStart: Date;
  rollingWindowEnd: Date;
  volumeUsd: number;
  transactionCount: number;
  latestBlock: number;
  warnings: MacroWarning[];
}

export interface MacroDuneRolling24hObservation extends MacroProvenance {
  chain: "solana";
  rollingWindowStart: Date;
  rollingWindowEnd: Date;
  dataWatermark: Date;
  volumeUsd: number;
  uniqueSwapTransactionCount: number;
  tradeLegCount: number;
  registryVersion: string;
  coverageStatus: "declared_registry";
}

export type MacroDexDuneReconciliationStatus =
  | "park_dune_unavailable"
  | "park_window_mismatch"
  | "park_dune_watermark_behind"
  | "park_dune_incomplete"
  | "aligned_pending_calibration";

export interface MacroDexDuneReconciliation {
  layer: "dex_dune_reconciliation";
  chain: "solana";
  dexscreener: MacroDexScreenerRolling24hObservation;
  dune?: MacroDuneRolling24hObservation;
  analysisStatus: MacroDexDuneReconciliationStatus;
  directComparisonStatus: "not_directly_comparable";
  volumeDifferencePct?: number;
  transactionDifferenceVsUniqueSwapPct?: number;
  transactionDifferenceVsTradeLegPct?: number;
  warnings: MacroWarning[];
}

export interface MacroDailyBriefInput {
  reportDay: string;
  globalMetrics: MacroGlobalMetricObservation[];
  chainMetrics: MacroChainMetricObservation[];
  hourlyProfiles: MacroHourlyChainProfileObservation[];
  sentimentLayer?: MacroSentimentObservationLayer;
  dexscreenerRolling24hObservation?: MacroDexScreenerRolling24hObservation;
  duneRolling24hObservation?: MacroDuneRolling24hObservation;
}

export interface MacroChainBriefSection {
  chain: MacroChain;
  metrics: MacroChainMetricObservation[];
  hourlyProfiles: MacroHourlyChainProfileObservation[];
  hourlyProfileSummaries?: MacroHourlyProfileSummary[];
}

export interface MacroDailyBrief {
  reportDay: string;
  globalMetrics: MacroGlobalMetricObservation[];
  chainReports: MacroChainBriefSection[];
  marketActivitySummary?: MacroMarketActivitySummary;
  sentimentLayer?: MacroSentimentObservationLayer;
  dexDuneReconciliation?: MacroDexDuneReconciliation;
}