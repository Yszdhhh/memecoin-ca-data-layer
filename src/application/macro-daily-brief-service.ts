import {
  summarizeHourlyProfile,
} from "./macro-hourly-lifecycle-contracts.js";
import { reconcileDexScreenerRolling24h } from "./macro-dex-dune-reconciliation.js";
import type {
  MacroChain,
  MacroChainBriefSection,
  MacroChainMetricName,
  MacroChainMetricObservation,
  MacroDailyBrief,
  MacroDailyBriefInput,
  MacroGlobalMetricObservation,
  MacroHourlyChainProfileObservation,
  MacroHourlyProfileMetricName,
  MacroHourlyProfileSummary,
  MacroMarketActivitySummary,
  MacroProvenance,
  MacroSentimentObservationLayer,
} from "../domain/macro-daily.js";

const CHAIN_METRICS: Record<MacroChain, readonly MacroChainMetricName[]> = {
  solana: ["dex_volume_usd", "active_trader_count", "swap_transaction_count", "trade_leg_count", "pump_launch_count", "external_pool_count"],
  bsc: ["dex_volume_usd", "active_trader_count", "swap_transaction_count", "trade_leg_count", "pancakeswap_pool_created_count", "pancakeswap_lp_net_change_usd"],
  robinhood: ["dex_volume_usd", "active_trader_count", "swap_transaction_count", "trade_leg_count", "uniswap_pool_created_count"],
};

const GLOBAL_UNITS: Record<MacroGlobalMetricObservation["metricName"], MacroGlobalMetricObservation["unit"]> = {
  dex_volume_usd: "usd",
  active_trader_count: "count",
  btc_transaction_count: "count",
  btc_fee_usd: "usd",
};

const CHAIN_UNITS: Record<MacroChainMetricName, MacroChainMetricObservation["unit"]> = {
  dex_volume_usd: "usd",
  active_trader_count: "count",
  swap_transaction_count: "count",
  trade_leg_count: "count",
  pump_launch_count: "count",
  external_pool_count: "count",
  pancakeswap_pool_created_count: "count",
  pancakeswap_lp_net_change_usd: "usd",
  uniswap_pool_created_count: "count",
};

const HOURLY_UNITS: Record<MacroHourlyProfileMetricName, MacroChainMetricObservation["unit"]> = {
  ...CHAIN_UNITS,
  active_trader_address_hour_count: "count",
  pump_create_event_count: "count",
  valid_pumpswap_pool_create_event_count: "count",
};

const HOURLY_SOLANA_ONLY = new Set<MacroHourlyProfileMetricName>([
  "active_trader_address_hour_count",
  "pump_create_event_count",
  "valid_pumpswap_pool_create_event_count",
]);

const PROFILE_WARNING_CODES: Partial<Record<MacroHourlyProfileMetricName, string>> = {
  dex_volume_usd: "volume_is_leg_sum",
  active_trader_address_hour_count: "priced_trade_rows_only",
  swap_transaction_count: "deduplicated_trade_legs",
  trade_leg_count: "deduplicated_trade_legs",
  pump_create_event_count: "pump_only",
  valid_pumpswap_pool_create_event_count: "not_migrate",
};

const CHAIN_SECTIONS: Record<MacroChainMetricName, MacroChainMetricObservation["section"]> = {
  dex_volume_usd: "capital",
  active_trader_count: "capital",
  swap_transaction_count: "activity",
  trade_leg_count: "activity",
  pump_launch_count: "supply",
  external_pool_count: "supply",
  pancakeswap_pool_created_count: "supply",
  pancakeswap_lp_net_change_usd: "capital",
  uniswap_pool_created_count: "supply",
};

const ROBINHOOD_REGISTRY_PREFIX = "spellbook:dex_robinhood:uniswap_v2_v3_v4@";
const REPORT_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_SENTIMENT_LAYER: MacroSentimentObservationLayer = {
  layer: "sentiment",
  sourceLabel: "未授权",
  sourceAuthorization: "not_authorized",
  coverageStatus: "unknown",
  observationStatus: "park",
  warnings: [{ code: "source_not_authorized" }],
};

export class MacroDailyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MacroDailyValidationError";
  }
}

export class MacroDailyBriefService {
  normalize(input: MacroDailyBriefInput): MacroDailyBrief {
    assertReportDay(input.reportDay);
    input.globalMetrics.forEach((metric) => this.validateGlobalMetric(metric, input.reportDay));
    input.chainMetrics.forEach((metric) => this.validateChainMetric(metric, input.reportDay));
    input.hourlyProfiles.forEach((profile) => this.validateHourlyProfile(profile));
    const sentimentLayer = input.sentimentLayer ?? DEFAULT_SENTIMENT_LAYER;
    this.validateSentimentLayer(sentimentLayer);
    if (input.duneRolling24hObservation && !input.dexscreenerRolling24hObservation) {
      throw new MacroDailyValidationError("Dune rolling 24H observation requires its DexScreener snapshot");
    }
    const dexDuneReconciliation = input.dexscreenerRolling24hObservation
      ? reconcileDexScreenerRolling24h(input.dexscreenerRolling24hObservation, input.duneRolling24hObservation)
      : undefined;
    assertUniqueObservations(input);
    const hourlyProfileSummaries = buildHourlyProfileSummaries(input.hourlyProfiles);

    const chainReports: MacroChainBriefSection[] = (["solana", "bsc", "robinhood"] as const).map((chain) => ({
      chain,
      metrics: input.chainMetrics
        .filter((metric) => metric.chain === chain)
        .slice()
        .sort(compareChainMetrics),
      hourlyProfiles: input.hourlyProfiles
        .filter((profile) => profile.chain === chain)
        .slice()
        .sort(compareHourlyProfiles),
      hourlyProfileSummaries: hourlyProfileSummaries.filter((summary) => summary.chain === chain),
    }));

    return {
      reportDay: input.reportDay,
      globalMetrics: input.globalMetrics.slice().sort(compareGlobalMetrics),
      chainReports,
      marketActivitySummary: summarizeMarketActivity(input.reportDay, chainReports),
      sentimentLayer,
      ...(dexDuneReconciliation ? { dexDuneReconciliation } : {}),
    };
  }

  private validateGlobalMetric(metric: MacroGlobalMetricObservation, reportDay: string): void {
    assertReportDay(metric.reportDay);
    if (metric.reportDay !== reportDay) throw new MacroDailyValidationError("global metric report day does not match brief");
    if (GLOBAL_UNITS[metric.metricName] !== metric.unit) {
      throw new MacroDailyValidationError(`invalid unit for global metric: ${metric.metricName}`);
    }
    assertFiniteNonNegative(metric.value, "global metric value");
    if (metric.percentile !== undefined && (metric.percentile < 0 || metric.percentile > 1)) {
      throw new MacroDailyValidationError("global metric percentile must be between zero and one");
    }
    assertProvenance(metric);
  }

  private validateChainMetric(metric: MacroChainMetricObservation, reportDay: string): void {
    assertReportDay(metric.reportDay);
    if (metric.reportDay !== reportDay) throw new MacroDailyValidationError("chain metric report day does not match brief");
    this.validateChainMetricIdentity(metric.chain, metric.metricName, metric.unit, metric.registryVersion, metric.coverageStatus);
    if (CHAIN_SECTIONS[metric.metricName] !== metric.section) {
      throw new MacroDailyValidationError(`invalid section for chain metric: ${metric.metricName}`);
    }
    assertFiniteNonNegative(metric.value, "chain metric value");
    assertProvenance(metric);
  }

  private validateHourlyProfile(profile: MacroHourlyChainProfileObservation): void {
    if (isSolanaOnlyHourlyMetric(profile.metricName)) {
      if (profile.chain !== "solana") throw new MacroDailyValidationError(`unsupported hourly metric for ${profile.chain}: ${profile.metricName}`);
      if (!profile.registryVersion.trim()) throw new MacroDailyValidationError("registryVersion is required");
    } else {
      this.validateChainMetricIdentity(profile.chain, profile.metricName as MacroChainMetricName, HOURLY_UNITS[profile.metricName], profile.registryVersion, profile.coverageStatus);
    }
    if (!Number.isInteger(profile.hourUtc) || profile.hourUtc < 0 || profile.hourUtc > 23) {
      throw new MacroDailyValidationError("hourly profile hourUtc must be an integer from zero through twenty-three");
    }
    if (!Number.isInteger(profile.sampleDayCount) || profile.sampleDayCount < 0) {
      throw new MacroDailyValidationError("hourly profile sampleDayCount must be a non-negative integer");
    }
    assertFiniteNonNegative(profile.metricValue, "hourly profile metric value");
    if (!Number.isFinite(profile.metricShare) || profile.metricShare < 0 || profile.metricShare > 1) {
      throw new MacroDailyValidationError("hourly profile metricShare must be between zero and one");
    }
    assertProvenance(profile);
    assertHourlyProfileContractMetadata(profile);
  }

  private validateSentimentLayer(layer: MacroSentimentObservationLayer): void {
    if (layer.layer !== "sentiment" || !layer.sourceLabel.trim()) {
      throw new MacroDailyValidationError("sentiment layer requires a source label");
    }
    if (layer.sourceAuthorization !== "not_authorized" || layer.coverageStatus !== "unknown" || layer.observationStatus !== "park") {
      throw new MacroDailyValidationError("sentiment layer must remain not_authorized, unknown, and park");
    }
    if (!layer.warnings.some((warning) => warning.code === "source_not_authorized")) {
      throw new MacroDailyValidationError("sentiment layer requires source_not_authorized warning");
    }
    const unsupported = layer as MacroSentimentObservationLayer & Record<string, unknown>;
    if ("value" in unsupported || "score" in unsupported || "demand" in unsupported) {
      throw new MacroDailyValidationError("sentiment layer cannot carry a value, score, or demand assertion");
    }
  }

  private validateChainMetricIdentity(
    chain: MacroChain,
    metricName: MacroChainMetricName,
    unit: MacroChainMetricObservation["unit"],
    registryVersion: string,
    coverageStatus: MacroChainMetricObservation["coverageStatus"],
  ): void {
    if (!CHAIN_METRICS[chain].includes(metricName)) {
      throw new MacroDailyValidationError(`unsupported metric for ${chain}: ${metricName}`);
    }
    if (CHAIN_UNITS[metricName] !== unit) {
      throw new MacroDailyValidationError(`invalid unit for chain metric: ${metricName}`);
    }
    if (!registryVersion.trim()) throw new MacroDailyValidationError("registryVersion is required");
    if (chain === "robinhood") {
      if (coverageStatus !== "partial_coverage") {
        throw new MacroDailyValidationError("robinhood coverageStatus must be partial_coverage");
      }
      if (!/^spellbook:dex_robinhood:uniswap_v2_v3_v4@[0-9a-f]{7,64}$/.test(registryVersion)) {
        throw new MacroDailyValidationError(`robinhood registryVersion must be pinned under ${ROBINHOOD_REGISTRY_PREFIX}`);
      }
    }
  }
}

function isSolanaOnlyHourlyMetric(metricName: MacroHourlyProfileMetricName): metricName is "active_trader_address_hour_count" | "pump_create_event_count" | "valid_pumpswap_pool_create_event_count" {
  return HOURLY_SOLANA_ONLY.has(metricName);
}
function assertHourlyProfileContractMetadata(profile: MacroHourlyChainProfileObservation): void {
  const hasContractMetadata = profile.profileEndDayUtc !== undefined || profile.coveredDayCount !== undefined || profile.expectedDayCount !== undefined;
  if (!hasContractMetadata) return;
  if (profile.chain !== "solana" || profile.profileEndDayUtc === undefined || profile.coveredDayCount === undefined || profile.expectedDayCount === undefined) {
    throw new MacroDailyValidationError("hourly profile contract metadata must be complete and Solana-only");
  }
  assertReportDay(profile.profileEndDayUtc);
  if (profile.expectedDayCount !== profile.profileWindowDays || profile.coveredDayCount !== profile.sampleDayCount || profile.coveredDayCount < 0 || profile.coveredDayCount > profile.expectedDayCount) {
    throw new MacroDailyValidationError("hourly profile coverage metadata is inconsistent");
  }
  if (Math.abs(profile.completeness - profile.coveredDayCount / profile.expectedDayCount) > Number.EPSILON) {
    throw new MacroDailyValidationError("hourly profile completeness must equal covered days divided by expected days");
  }
  const requiredWarning = PROFILE_WARNING_CODES[profile.metricName];
  if (requiredWarning && !profile.warnings.some((warning) => warning.code === requiredWarning)) {
    throw new MacroDailyValidationError(`hourly profile requires warning: ${requiredWarning}`);
  }
}

function buildHourlyProfileSummaries(profiles: readonly MacroHourlyChainProfileObservation[]): MacroHourlyProfileSummary[] {
  const groups = new Map<string, MacroHourlyChainProfileObservation[]>();
  for (const profile of profiles) {
    if (profile.chain !== "solana" || profile.profileEndDayUtc === undefined) continue;
    const key = `${profile.profileWindowDays}:${profile.profileEndDayUtc}:${profile.metricName}`;
    const group = groups.get(key) ?? [];
    group.push(profile);
    groups.set(key, group);
  }

  return Array.from(groups.values(), (group) => {
    const first = group[0]!;
    if (group.some((profile) => profile.coveredDayCount !== first.coveredDayCount || profile.expectedDayCount !== first.expectedDayCount || profile.registryVersion !== first.registryVersion || profile.queryVersion !== first.queryVersion || profile.coverageStatus !== first.coverageStatus)) {
      throw new MacroDailyValidationError("hourly profile contract group has mixed coverage or provenance versions");
    }
    const summary = summarizeHourlyProfile({
      profileWindowDays: first.profileWindowDays,
      profileEndDayUtc: first.profileEndDayUtc!,
      coveredDayCount: first.coveredDayCount!,
      expectedDayCount: first.expectedDayCount!,
      points: group.map((profile) => ({ hourUtc: profile.hourUtc, metricValue: profile.metricValue })),
    });
    const total = summary.totalMetricValue;
    for (const profile of group) {
      const expectedShare = total === 0 ? 0 : profile.metricValue / total;
      if (Math.abs(profile.metricShare - expectedShare) > 1e-12) {
        throw new MacroDailyValidationError("hourly profile metricShare does not match its UTC profile total");
      }
    }
    const result: MacroHourlyProfileSummary = {
      chain: "solana",
      metricName: first.metricName,
      profileWindowDays: summary.profileWindowDays,
      profileEndDayUtc: summary.profileEndDayUtc,
      coveredDayCount: summary.coveredDayCount,
      expectedDayCount: summary.expectedDayCount,
      totalMetricValue: summary.totalMetricValue,
      analysisStatus: summary.analysisStatus,
      warnings: summary.warnings,
    };
    if (summary.analysisStatus === "complete") {
      if (summary.peakHourUtc === undefined || summary.highActivityWindowUtc === undefined || summary.intradayTimeConcentrationHhi === undefined || summary.effectiveActiveHours === undefined) {
        throw new MacroDailyValidationError("complete hourly profile summary is missing a derived value");
      }
      result.peakHourUtc = summary.peakHourUtc;
      result.highActivityWindowUtc = summary.highActivityWindowUtc;
      result.intradayTimeConcentrationHhi = summary.intradayTimeConcentrationHhi;
      result.effectiveActiveHours = summary.effectiveActiveHours;
    }
    return result;
  }).sort((a, b) => a.metricName.localeCompare(b.metricName) || a.profileWindowDays - b.profileWindowDays || a.profileEndDayUtc.localeCompare(b.profileEndDayUtc));
}

function summarizeMarketActivity(reportDay: string, reports: readonly MacroChainBriefSection[]): MacroMarketActivitySummary {
  const eligibleChains: MacroChain[] = [];
  const excludedChains: MacroMarketActivitySummary["excludedChains"] = [];
  const volumes = new Map<MacroChain, number>();

  for (const report of reports) {
    if (report.chain === "robinhood") {
      excludedChains.push({ chain: report.chain, reason: "partial_coverage" });
      continue;
    }
    const metrics = new Map(report.metrics.map((metric) => [metric.metricName, metric]));
    const required = ["dex_volume_usd", "swap_transaction_count", "trade_leg_count"] as const;
    const complete = required.every((metricName) => {
      const metric = metrics.get(metricName);
      return metric?.completeness === 1 && metric.coverageStatus === "declared_registry";
    });
    if (!complete) {
      excludedChains.push({ chain: report.chain, reason: "missing_or_partial_activity_inputs" });
      continue;
    }
    eligibleChains.push(report.chain);
    volumes.set(report.chain, metrics.get("dex_volume_usd")!.value);
  }

  if (eligibleChains.length < 2) {
    return {
      reportDay,
      basis: "complete_declared_daily_dex_activity",
      analysisStatus: "not_comparable",
      eligibleChains,
      excludedChains,
      warnings: [{ code: "insufficient_comparable_markets" }],
    };
  }

  const highestVolume = Math.max(...eligibleChains.map((chain) => volumes.get(chain)!));
  return {
    reportDay,
    basis: "complete_declared_daily_dex_activity",
    analysisStatus: "complete",
    eligibleChains,
    leadingChains: eligibleChains.filter((chain) => volumes.get(chain) === highestVolume),
    excludedChains,
    warnings: [{ code: "volume_is_leg_sum" }, { code: "not_real_users_or_demand" }],
  };
}

function assertProvenance(provenance: MacroProvenance): void {
  if (provenance.source !== "dune") throw new MacroDailyValidationError("macro metric source must be dune");
  if (!provenance.queryRef.trim()) throw new MacroDailyValidationError("queryRef is required");
  if (!provenance.queryVersion.trim()) throw new MacroDailyValidationError("queryVersion is required");
  if (!Number.isFinite(provenance.completeness) || provenance.completeness < 0 || provenance.completeness > 1) {
    throw new MacroDailyValidationError("completeness must be between zero and one");
  }
  if (!(provenance.sourceAsOf instanceof Date) || Number.isNaN(provenance.sourceAsOf.getTime())) {
    throw new MacroDailyValidationError("sourceAsOf must be a valid Date");
  }
  if (!(provenance.computedAt instanceof Date) || Number.isNaN(provenance.computedAt.getTime())) {
    throw new MacroDailyValidationError("computedAt must be a valid Date");
  }
  for (const warning of provenance.warnings) {
    if (!warning.code.trim()) throw new MacroDailyValidationError("warnings must have a machine-readable code");
  }
}

function assertReportDay(value: string): void {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!REPORT_DAY.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new MacroDailyValidationError("reportDay must be an ISO UTC calendar day");
  }
}

function assertFiniteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) throw new MacroDailyValidationError(`${field} must be finite and non-negative`);
}

function assertUniqueObservations(input: MacroDailyBriefInput): void {
  const keys = new Set<string>();
  const add = (key: string) => {
    if (keys.has(key)) throw new MacroDailyValidationError(`duplicate macro observation: ${key}`);
    keys.add(key);
  };
  input.globalMetrics.forEach((metric) => add(`global:${metric.reportDay}:${metric.metricName}:${metric.subject}`));
  input.chainMetrics.forEach((metric) => add(`chain:${metric.reportDay}:${metric.chain}:${metric.metricName}`));
  input.hourlyProfiles.forEach((profile) =>
    add(`hour:${profile.chain}:${profile.profileWindowDays}:${profile.profileEndDayUtc ?? "legacy"}:${profile.metricName}:${profile.hourUtc}`),
  );
}

function compareGlobalMetrics(a: MacroGlobalMetricObservation, b: MacroGlobalMetricObservation): number {
  return a.metricName.localeCompare(b.metricName) || a.subject.localeCompare(b.subject);
}

function compareChainMetrics(a: MacroChainMetricObservation, b: MacroChainMetricObservation): number {
  return a.metricName.localeCompare(b.metricName) || a.section.localeCompare(b.section);
}

function compareHourlyProfiles(a: MacroHourlyChainProfileObservation, b: MacroHourlyChainProfileObservation): number {
  return a.metricName.localeCompare(b.metricName) || a.profileWindowDays - b.profileWindowDays || a.hourUtc - b.hourUtc;
}