import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MacroDailyBriefService, MacroDailyValidationError } from "../src/application/macro-daily-brief-service.js";
import type {
  MacroChainMetricObservation,
  MacroDailyBriefInput,
  MacroGlobalMetricObservation,
  MacroHourlyChainProfileObservation,
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
