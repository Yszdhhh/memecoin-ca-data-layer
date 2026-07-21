import type {
  MacroChain,
  MacroChainBriefSection,
  MacroChainMetricName,
  MacroChainMetricObservation,
  MacroDailyBrief,
  MacroDailyBriefInput,
  MacroGlobalMetricObservation,
  MacroHourlyChainProfileObservation,
  MacroProvenance,
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
    assertUniqueObservations(input);

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
    }));

    return {
      reportDay: input.reportDay,
      globalMetrics: input.globalMetrics.slice().sort(compareGlobalMetrics),
      chainReports,
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
    this.validateChainMetricIdentity(
      profile.chain,
      profile.metricName,
      CHAIN_UNITS[profile.metricName],
      profile.registryVersion,
      profile.coverageStatus,
    );
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
    add(`hour:${profile.chain}:${profile.profileWindowDays}:${profile.metricName}:${profile.hourUtc}`),
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
