import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MacroDailyBriefService, MacroDailyValidationError } from "../src/application/macro-daily-brief-service.js";
import type {
  MacroChainMetricObservation,
  MacroDailyBriefInput,
  MacroGlobalMetricObservation,
  MacroHourlyChainProfileObservation,
  MacroSentimentObservationLayer,
  MacroWarning,
} from "../src/domain/macro-daily.js";

interface FixtureMetric {
  metric_name: string;
  subject?: string;
  value: number;
  unit: "usd" | "count";
  history_window_days?: number;
  chain?: "solana" | "bsc" | "robinhood";
  section?: "capital" | "supply" | "activity" | "timing";
  registry_version?: string;
  profile_window_days?: 60 | 90;
  hour_utc?: number;
  sample_day_count?: number;
  metric_value?: number;
  metric_share?: number;
}

interface Fixture {
  report_day: string;
  computed_at: string;
  global_metrics: FixtureMetric[];
  chain_metrics: FixtureMetric[];
  hourly_profiles: FixtureMetric[];
}

const service = new MacroDailyBriefService();

async function loadInput(): Promise<MacroDailyBriefInput> {
  const fixture = JSON.parse(
    await readFile(new URL("./fixtures/macro/daily-metric-input.json", import.meta.url), "utf8"),
  ) as Fixture;
  const provenance = {
    source: "dune" as const,
    queryRef: "fixture:macro-daily",
    queryVersion: "fixture-query-sha",
    sourceAsOf: new Date("2026-07-21T00:00:00Z"),
    computedAt: new Date(fixture.computed_at),
    completeness: 1,
    warnings: [{ code: "SYNTHETIC_FIXTURE" }] satisfies MacroWarning[],
  };

  return {
    reportDay: fixture.report_day,
    globalMetrics: fixture.global_metrics.map((metric) => ({
      ...provenance,
      reportDay: fixture.report_day,
      metricName: metric.metric_name as MacroGlobalMetricObservation["metricName"],
      subject: metric.subject!,
      value: metric.value,
      unit: metric.unit,
      ...(metric.history_window_days === undefined ? {} : { historyWindowDays: metric.history_window_days }),
    })),
    chainMetrics: fixture.chain_metrics.map((metric) => ({
      ...provenance,
      reportDay: fixture.report_day,
      chain: metric.chain!,
      section: metric.section!,
      metricName: metric.metric_name as MacroChainMetricObservation["metricName"],
      value: metric.value,
      unit: metric.unit,
      registryVersion: metric.registry_version!,
      coverageStatus: metric.chain === "robinhood" ? "partial_coverage" : "declared_registry",
    })),
    hourlyProfiles: fixture.hourly_profiles.map((metric) => ({
      ...provenance,
      chain: metric.chain!,
      profileWindowDays: metric.profile_window_days!,
      metricName: metric.metric_name as MacroHourlyChainProfileObservation["metricName"],
      hourUtc: metric.hour_utc!,
      sampleDayCount: metric.sample_day_count!,
      metricValue: metric.metric_value!,
      metricShare: metric.metric_share!,
      registryVersion: metric.registry_version!,
      coverageStatus: metric.chain === "robinhood" ? "partial_coverage" : "declared_registry",
    })),
  };
}

test("normalizes a deterministic brief while retaining separate global and chain provenance", async () => {
  const input = await loadInput();
  const brief = service.normalize(input);

  assert.equal(brief.reportDay, "2026-07-20");
  assert.equal(brief.globalMetrics.length, 2);
  assert.equal(brief.globalMetrics[0]?.metricName, "btc_transaction_count");
  assert.equal(brief.globalMetrics[0]?.queryVersion, "fixture-query-sha");
  assert.deepEqual(brief.globalMetrics[0]?.warnings, [{ code: "SYNTHETIC_FIXTURE" }]);
  assert.deepEqual(brief.chainReports.map((section) => section.chain), ["solana", "bsc", "robinhood"]);
  assert.equal(brief.chainReports[2]?.metrics[0]?.coverageStatus, "partial_coverage");
  assert.equal(brief.chainReports[2]?.hourlyProfiles[0]?.hourUtc, 19);
  assert.equal(brief.marketActivitySummary?.analysisStatus, "not_comparable");
  assert.deepEqual(brief.marketActivitySummary?.warnings, [{ code: "insufficient_comparable_markets" }]);
});

test("compares declared complete daily DEX activity while excluding Robinhood partial coverage", async () => {
  const input = await loadInput();
  const base = input.chainMetrics.find((metric) => metric.chain === "solana" && metric.metricName === "dex_volume_usd")!;
  const activityMetric = (
    chain: "solana" | "bsc",
    metricName: "dex_volume_usd" | "swap_transaction_count" | "trade_leg_count",
    value: number,
  ): MacroChainMetricObservation => ({
    ...base,
    chain,
    metricName,
    value,
    unit: metricName === "dex_volume_usd" ? "usd" : "count",
    section: metricName === "dex_volume_usd" ? "capital" : "activity",
    registryVersion: `spellbook:${chain}:fixture@deadbeef`,
    coverageStatus: "declared_registry",
  });
  input.chainMetrics.push(
    activityMetric("solana", "swap_transaction_count", 100),
    activityMetric("solana", "trade_leg_count", 150),
    activityMetric("bsc", "dex_volume_usd", 750_000),
    activityMetric("bsc", "swap_transaction_count", 120),
    activityMetric("bsc", "trade_leg_count", 180),
  );

  const summary = service.normalize(input).marketActivitySummary!;
  assert.equal(summary.analysisStatus, "complete");
  assert.deepEqual(summary.eligibleChains, ["solana", "bsc"]);
  assert.deepEqual(summary.leadingChains, ["bsc"]);
  assert.deepEqual(summary.excludedChains, [{ chain: "robinhood", reason: "partial_coverage" }]);
  assert.deepEqual(summary.warnings, [{ code: "volume_is_leg_sum" }, { code: "not_real_users_or_demand" }]);
});

test("keeps sentiment as a separate source-labelled PARK layer and rejects values", async () => {
  const input = await loadInput();
  const defaultBrief = service.normalize(input);
  assert.deepEqual(defaultBrief.sentimentLayer, {
    layer: "sentiment",
    sourceLabel: "未授权",
    sourceAuthorization: "not_authorized",
    coverageStatus: "unknown",
    observationStatus: "park",
    warnings: [{ code: "source_not_authorized" }],
  });

  const layer: MacroSentimentObservationLayer = {
    layer: "sentiment",
    sourceLabel: "fixture-source-not-authorized",
    sourceAuthorization: "not_authorized",
    coverageStatus: "unknown",
    observationStatus: "park",
    warnings: [{ code: "source_not_authorized" }],
  };
  const labelledBrief = service.normalize({ ...input, sentimentLayer: layer });
  assert.equal(labelledBrief.sentimentLayer?.sourceLabel, "fixture-source-not-authorized");

  assert.throws(
    () => service.normalize({ ...input, sentimentLayer: { ...layer, value: 1 } as unknown as MacroSentimentObservationLayer }),
    MacroDailyValidationError,
  );
});

test("rejects an unverified metric family instead of treating it as a normal macro input", async () => {
  const input = await loadInput();
  const unsupported = { ...input.chainMetrics[2]!, metricName: "four_meme_launch_count" as never };
  input.chainMetrics[2] = unsupported;

  assert.throws(() => service.normalize(input), /unsupported metric for bsc: four_meme_launch_count/);
});

test("keeps each accepted chain metric in its declared brief section", async () => {
  const input = await loadInput();
  input.chainMetrics[2] = { ...input.chainMetrics[2]!, section: "capital" };

  assert.throws(() => service.normalize(input), /invalid section for chain metric: pancakeswap_pool_created_count/);
});

test("accepts declared DEX transaction and trade-leg activity metrics", async () => {
  const input = await loadInput();
  const base = input.chainMetrics.find((metric) => metric.chain === "solana")!;
  input.chainMetrics.push(
    { ...base, section: "activity", metricName: "swap_transaction_count", value: 123, unit: "count" },
    { ...base, section: "activity", metricName: "trade_leg_count", value: 456, unit: "count" },
  );

  const brief = service.normalize(input);
  assert.deepEqual(brief.chainReports.find((report) => report.chain === "solana")?.metrics.filter((metric) => metric.section === "activity").map((metric) => metric.metricName), ["swap_transaction_count", "trade_leg_count"]);
});

test("requires Robinhood partial coverage and a pinned Uniswap-only registry", async () => {
  const input = await loadInput();
  input.chainMetrics[3] = { ...input.chainMetrics[3]!, coverageStatus: "declared_registry" };

  assert.throws(() => service.normalize(input), /robinhood coverageStatus must be partial_coverage/);

  const validInput = await loadInput();
  validInput.hourlyProfiles[2] = {
    ...validInput.hourlyProfiles[2]!,
    registryVersion: "spellbook:dex_robinhood:all_venues@deadbeef",
  };
  assert.throws(() => service.normalize(validInput), /robinhood registryVersion must be pinned/);
});

test("rejects incomplete provenance and non-UTC hourly bounds", async () => {
  const input = await loadInput();
  input.globalMetrics[0] = { ...input.globalMetrics[0]!, queryVersion: "" };
  assert.throws(() => service.normalize(input), MacroDailyValidationError);

  const invalidHour = await loadInput();
  invalidHour.hourlyProfiles[0] = { ...invalidHour.hourlyProfiles[0]!, hourUtc: 24 };
  assert.throws(() => service.normalize(invalidHour), /hourUtc must be an integer/);
});

test("derives a complete Solana hourly summary only from a full UTC profile contract", async () => {
  const input = await loadInput();
  const base = input.hourlyProfiles[0]!;
  input.hourlyProfiles = Array.from({ length: 24 }, (_value, hourUtc) => {
    const metricValue = hourUtc === 0 ? 50 : hourUtc === 1 ? 30 : hourUtc === 2 ? 20 : 0;
    return {
      ...base,
      queryRef: "fixture:hourly-profile",
      warnings: [{ code: "volume_is_leg_sum" }],
      chain: "solana" as const,
      profileWindowDays: 60 as const,
      profileEndDayUtc: "2026-07-19",
      coveredDayCount: 60 as const,
      expectedDayCount: 60 as const,
      sampleDayCount: 60,
      hourUtc,
      metricValue,
      metricShare: metricValue / 100,
    };
  });

  const brief = service.normalize(input);
  const summary = brief.chainReports.find((report) => report.chain === "solana")!.hourlyProfileSummaries![0]!;
  assert.equal(summary.analysisStatus, "complete");
  assert.equal(summary.peakHourUtc, 0);
  assert.equal(summary.highActivityWindowUtc, "00:00–01:00 UTC");
  assert.equal(summary.intradayTimeConcentrationHhi, 0.38);
});
test("normalizes a source-labelled DexScreener snapshot as a separate PARK observation", async () => {
  const input = await loadInput();
  input.dexscreenerRolling24hObservation = {
    layer: "dexscreener_realtime",
    sourceLabel: "DexScreener manual fixture",
    chain: "solana",
    capturedAt: new Date("2026-07-21T12:00:00.000Z"),
    rollingWindowStart: new Date("2026-07-20T12:00:00.000Z"),
    rollingWindowEnd: new Date("2026-07-21T12:00:00.000Z"),
    volumeUsd: 100,
    transactionCount: 50,
    latestBlock: 400_000_000,
    warnings: [],
  };

  const brief = service.normalize(input);
  assert.equal(brief.dexDuneReconciliation?.analysisStatus, "park_dune_unavailable");
  assert.equal(brief.dexDuneReconciliation?.directComparisonStatus, "not_directly_comparable");
});

test("rejects a Dune rolling observation without its source-labelled DexScreener snapshot", async () => {
  const input = await loadInput();
  input.duneRolling24hObservation = {
    source: "dune",
    queryRef: "fixture:dune:rolling-24h",
    queryVersion: "1",
    sourceAsOf: new Date("2026-07-21T13:00:00.000Z"),
    computedAt: new Date("2026-07-21T13:01:00.000Z"),
    completeness: 1,
    warnings: [],
    chain: "solana",
    rollingWindowStart: new Date("2026-07-20T12:00:00.000Z"),
    rollingWindowEnd: new Date("2026-07-21T12:00:00.000Z"),
    dataWatermark: new Date("2026-07-21T12:00:00.000Z"),
    volumeUsd: 100,
    uniqueSwapTransactionCount: 50,
    tradeLegCount: 75,
    registryVersion: "spellbook:dex_solana@fixture",
    coverageStatus: "declared_registry",
  };

  assert.throws(() => service.normalize(input), /requires its DexScreener snapshot/);
});
