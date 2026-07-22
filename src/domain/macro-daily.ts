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

export interface MacroDailyBriefInput {
  reportDay: string;
  globalMetrics: MacroGlobalMetricObservation[];
  chainMetrics: MacroChainMetricObservation[];
  hourlyProfiles: MacroHourlyChainProfileObservation[];
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
}