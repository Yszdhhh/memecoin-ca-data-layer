import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateFixtureLiquidityRetention,
  summarizeFixtureExternalPoolConversion,
  summarizeFixtureLifecycleThreshold,
  summarizeHourlyProfile,
} from "../src/application/macro-hourly-lifecycle-contracts.js";
import { CORE_QUERY_DEFINITIONS, OFFLINE_HOURLY_PROFILE_QUERY_DEFINITIONS } from "../src/infrastructure/dune/macro-core-query-definitions.js";

const hours = (values: Record<number, number>) => Array.from({ length: 24 }, (_value, hourUtc) => ({ hourUtc, metricValue: values[hourUtc] ?? 0 }));

test("V1 derives a complete hourly profile, peak, high-activity window, and time HHI", () => {
  const summary = summarizeHourlyProfile({ profileWindowDays: 3, profileEndDayUtc: "2026-07-19", coveredDayCount: 3, expectedDayCount: 3, points: hours({ 0: 50, 1: 30, 2: 20 }) });

  assert.equal(summary.totalMetricValue, 100);
  assert.equal(summary.analysisStatus, "complete");
  assert.equal(summary.peakHourUtc, 0);
  assert.equal(summary.highActivityWindowUtc, "00:00–01:00 UTC");
  assert.equal(summary.intradayTimeConcentrationHhi, 0.38);
  assert.equal(summary.effectiveActiveHours, 1 / 0.38);
});

test("V2 suppresses peak, high-window, and HHI claims for an incomplete 60-day window", () => {
  const summary = summarizeHourlyProfile({ profileWindowDays: 60, profileEndDayUtc: "2026-07-19", coveredDayCount: 57, expectedDayCount: 60, points: hours({ 13: 100 }) });

  assert.equal(summary.analysisStatus, "partial");
  assert.equal(summary.totalMetricValue, 100);
  assert.deepEqual(summary.warnings, [{ code: "incomplete_profile_window" }]);
  assert.equal(summary.peakHourUtc, undefined);
  assert.equal(summary.highActivityWindowUtc, undefined);
  assert.equal(summary.intradayTimeConcentrationHhi, undefined);
});

test("V3 uses only baseline and follow-up snapshots inside their declared intervals", () => {
  const t0 = new Date("2026-07-19T00:00:00Z");
  const calculated = evaluateFixtureLiquidityRetention({
    t0,
    horizonSeconds: 24 * 60 * 60,
    intervalSeconds: 5 * 60,
    snapshots: [
      { at: new Date("2026-07-19T00:04:00Z"), value: 100 },
      { at: new Date("2026-07-20T00:03:00Z"), value: 40 },
    ],
  });
  assert.deepEqual(calculated, { cohortStatus: "calculated_fixture", baselineValue: 100, followupValue: 40, retentionValue: 0.4 });

  const missing = evaluateFixtureLiquidityRetention({
    t0,
    horizonSeconds: 24 * 60 * 60,
    intervalSeconds: 5 * 60,
    snapshots: [{ at: new Date("2026-07-19T00:04:00Z"), value: 100 }, { at: new Date("2026-07-20T23:58:00Z"), value: 40 }],
  });
  assert.deepEqual(missing, { cohortStatus: "unknown_insufficient_coverage", warningCode: "missing_followup_snapshot" });
});

test("V4 excludes unknown linkage or coverage from the external-pool conversion denominator", () => {
  const summary = summarizeFixtureExternalPoolConversion([
    { launchId: "A", mature: true, coverageComplete: true, firstVerifiedExternalPoolAfterSeconds: 2 * 60 * 60 },
    { launchId: "B", mature: true, coverageComplete: true, firstVerifiedExternalPoolAfterSeconds: 26 * 60 * 60 },
    { launchId: "C", mature: true, coverageComplete: true },
    { launchId: "D", mature: true, coverageComplete: false },
  ], 24 * 60 * 60);

  assert.deepEqual(summary, { eligible: 3, converted: 1, notConvertedWithinHorizon: 2, unknownLinkageOrCoverage: 1, notYetMature: 0, conversionRate: 1 / 3 });
});

test("V5 keeps reached, right-censored, immature, and insufficient-coverage cohorts separate", () => {
  const fiftyPct = summarizeFixtureLifecycleThreshold([
    { cohortId: "A", observedThroughSeconds: 24 * 60 * 60, continuousCoverage: true, thresholdReachedAtSeconds: 2 * 60 * 60 },
    { cohortId: "B", observedThroughSeconds: 24 * 60 * 60, continuousCoverage: true, thresholdReachedAtSeconds: 4 * 60 * 60 },
    { cohortId: "C", observedThroughSeconds: 24 * 60 * 60, continuousCoverage: true },
    { cohortId: "D", observedThroughSeconds: 24 * 60 * 60, continuousCoverage: false },
    { cohortId: "E", observedThroughSeconds: 3 * 60 * 60, continuousCoverage: true },
  ], 24 * 60 * 60);
  assert.deepEqual(fiftyPct, { reached: 2, rightCensoredNotReached: 1, notYetMature: 1, unknownInsufficientCoverage: 1, reachedRate: 2 / 3, medianReachedSeconds: 3 * 60 * 60 });

  const ninetyPct = summarizeFixtureLifecycleThreshold([
    { cohortId: "A", observedThroughSeconds: 24 * 60 * 60, continuousCoverage: true },
    { cohortId: "B", observedThroughSeconds: 24 * 60 * 60, continuousCoverage: true, thresholdReachedAtSeconds: 4 * 60 * 60 },
    { cohortId: "C", observedThroughSeconds: 24 * 60 * 60, continuousCoverage: true },
  ], 24 * 60 * 60);
  assert.deepEqual(ninetyPct, { reached: 1, rightCensoredNotReached: 2, notYetMature: 0, unknownInsufficientCoverage: 0, reachedRate: 1 / 3, medianReachedSeconds: 4 * 60 * 60 });
});

test("offline hourly blueprints are Solana-only and never register in the live core query list", () => {
  assert.deepEqual(OFFLINE_HOURLY_PROFILE_QUERY_DEFINITIONS.map((definition) => definition.profileWindowDays), [60, 90, 60, 90]);
  assert.ok(OFFLINE_HOURLY_PROFILE_QUERY_DEFINITIONS.every((definition) => definition.blueprintId.startsWith("S")));
  assert.ok(OFFLINE_HOURLY_PROFILE_QUERY_DEFINITIONS.every((definition) => definition.metrics.every((metric) => !metric.warningCodes.includes("external_listing"))));
  assert.ok(OFFLINE_HOURLY_PROFILE_QUERY_DEFINITIONS.every((definition) => !CORE_QUERY_DEFINITIONS.some((core) => String(core.blueprintId) === definition.blueprintId)));
});