import type { MacroHourlyProfileSummary, MacroWarning } from "../domain/macro-daily.js";

export interface HourlyProfilePoint {
  hourUtc: number;
  metricValue: number;
}

export interface HourlyProfileContractInput {
  profileWindowDays: number;
  profileEndDayUtc: string;
  coveredDayCount: number;
  expectedDayCount: number;
  points: readonly HourlyProfilePoint[];
}

export interface FixtureLiquiditySnapshot {
  at: Date;
  value: number;
}

export interface FixtureLiquidityRetentionInput {
  t0: Date;
  horizonSeconds: number;
  intervalSeconds: number;
  snapshots: readonly FixtureLiquiditySnapshot[];
}

export interface FixtureConversionCohort {
  launchId: string;
  mature: boolean;
  coverageComplete: boolean;
  firstVerifiedExternalPoolAfterSeconds?: number;
}

export interface FixtureLifecycleThresholdCohort {
  cohortId: string;
  observedThroughSeconds: number;
  continuousCoverage: boolean;
  thresholdReachedAtSeconds?: number;
}

export function summarizeHourlyProfile(input: HourlyProfileContractInput): Omit<MacroHourlyProfileSummary, "chain" | "metricName" | "warnings"> & { warnings: MacroWarning[] } {
  assertInteger(input.profileWindowDays, "profileWindowDays");
  assertInteger(input.expectedDayCount, "expectedDayCount");
  assertInteger(input.coveredDayCount, "coveredDayCount");
  if (input.expectedDayCount <= 0 || input.coveredDayCount < 0 || input.coveredDayCount > input.expectedDayCount) {
    throw new Error("hourly profile coverage is invalid");
  }
  if (input.points.length !== 24) throw new Error("hourly profile requires exactly 24 UTC hours");

  const byHour = new Map<number, number>();
  for (const point of input.points) {
    assertInteger(point.hourUtc, "hourUtc");
    if (point.hourUtc < 0 || point.hourUtc > 23 || byHour.has(point.hourUtc) || !Number.isFinite(point.metricValue) || point.metricValue < 0) {
      throw new Error("hourly profile points must be unique non-negative UTC-hour values");
    }
    byHour.set(point.hourUtc, point.metricValue);
  }
  if (byHour.size !== 24) throw new Error("hourly profile requires every UTC hour");

  const values = Array.from({ length: 24 }, (_value, hourUtc) => byHour.get(hourUtc)!);
  const totalMetricValue = values.reduce((sum, value) => sum + value, 0);
  const base = {
    profileWindowDays: input.profileWindowDays as 60 | 90,
    profileEndDayUtc: input.profileEndDayUtc,
    coveredDayCount: input.coveredDayCount,
    expectedDayCount: input.expectedDayCount,
    totalMetricValue,
  };

  if (input.coveredDayCount < input.expectedDayCount) {
    return { ...base, analysisStatus: "partial", warnings: [{ code: "incomplete_profile_window" }] };
  }
  if (totalMetricValue === 0) {
    return { ...base, analysisStatus: "not_applicable", warnings: [{ code: "complete_window_no_events" }] };
  }

  const shares = values.map((value) => value / totalMetricValue);
  const peakHourUtc = values.reduce((peak, value, hour) => value > values[peak]! ? hour : peak, 0);
  const intradayTimeConcentrationHhi = shares.reduce((sum, share) => sum + share ** 2, 0);
  return {
    ...base,
    analysisStatus: "complete",
    peakHourUtc,
    highActivityWindowUtc: highActivityWindow(values, shares),
    intradayTimeConcentrationHhi,
    effectiveActiveHours: 1 / intradayTimeConcentrationHhi,
    warnings: [],
  };
}

export function evaluateFixtureLiquidityRetention(input: FixtureLiquidityRetentionInput):
  | { cohortStatus: "calculated_fixture"; baselineValue: number; followupValue: number; retentionValue: number }
  | { cohortStatus: "unknown_insufficient_coverage"; warningCode: "missing_baseline_snapshot" | "missing_followup_snapshot" } {
  if (!Number.isInteger(input.horizonSeconds) || !Number.isInteger(input.intervalSeconds) || input.horizonSeconds < 0 || input.intervalSeconds <= 0) {
    throw new Error("fixture liquidity horizon and interval must be positive integers");
  }
  const ordered = input.snapshots.slice().sort((a, b) => a.at.getTime() - b.at.getTime());
  const baseline = firstSnapshotIn(ordered, input.t0.getTime(), input.t0.getTime() + input.intervalSeconds * 1_000);
  if (!baseline) return { cohortStatus: "unknown_insufficient_coverage", warningCode: "missing_baseline_snapshot" };
  const followupAt = input.t0.getTime() + input.horizonSeconds * 1_000;
  const followup = firstSnapshotIn(ordered, followupAt, followupAt + input.intervalSeconds * 1_000);
  if (!followup) return { cohortStatus: "unknown_insufficient_coverage", warningCode: "missing_followup_snapshot" };
  if (!Number.isFinite(baseline.value) || baseline.value <= 0 || !Number.isFinite(followup.value) || followup.value < 0) {
    throw new Error("fixture liquidity snapshot values are invalid");
  }
  return { cohortStatus: "calculated_fixture", baselineValue: baseline.value, followupValue: followup.value, retentionValue: followup.value / baseline.value };
}

export function summarizeFixtureExternalPoolConversion(cohorts: readonly FixtureConversionCohort[], horizonSeconds: number): {
  eligible: number;
  converted: number;
  notConvertedWithinHorizon: number;
  unknownLinkageOrCoverage: number;
  notYetMature: number;
  conversionRate?: number;
} {
  if (!Number.isInteger(horizonSeconds) || horizonSeconds <= 0) throw new Error("fixture conversion horizon must be a positive integer");
  let eligible = 0;
  let converted = 0;
  let notConvertedWithinHorizon = 0;
  let unknownLinkageOrCoverage = 0;
  let notYetMature = 0;
  for (const cohort of cohorts) {
    if (!cohort.mature) { notYetMature++; continue; }
    if (!cohort.coverageComplete) { unknownLinkageOrCoverage++; continue; }
    eligible++;
    if (cohort.firstVerifiedExternalPoolAfterSeconds !== undefined && cohort.firstVerifiedExternalPoolAfterSeconds <= horizonSeconds) converted++;
    else notConvertedWithinHorizon++;
  }
  return { eligible, converted, notConvertedWithinHorizon, unknownLinkageOrCoverage, notYetMature, ...(eligible === 0 ? {} : { conversionRate: converted / eligible }) };
}

export function summarizeFixtureLifecycleThreshold(cohorts: readonly FixtureLifecycleThresholdCohort[], horizonSeconds: number): {
  reached: number;
  rightCensoredNotReached: number;
  notYetMature: number;
  unknownInsufficientCoverage: number;
  reachedRate?: number;
  medianReachedSeconds?: number;
} {
  if (!Number.isInteger(horizonSeconds) || horizonSeconds <= 0) throw new Error("fixture lifecycle horizon must be a positive integer");
  const reachedTimes: number[] = [];
  let rightCensoredNotReached = 0;
  let notYetMature = 0;
  let unknownInsufficientCoverage = 0;
  for (const cohort of cohorts) {
    if (!cohort.continuousCoverage) { unknownInsufficientCoverage++; continue; }
    if (cohort.observedThroughSeconds < horizonSeconds) { notYetMature++; continue; }
    if (cohort.thresholdReachedAtSeconds !== undefined && cohort.thresholdReachedAtSeconds <= horizonSeconds) reachedTimes.push(cohort.thresholdReachedAtSeconds);
    else rightCensoredNotReached++;
  }
  reachedTimes.sort((a, b) => a - b);
  const eligible = reachedTimes.length + rightCensoredNotReached;
  return {
    reached: reachedTimes.length,
    rightCensoredNotReached,
    notYetMature,
    unknownInsufficientCoverage,
    ...(eligible === 0 ? {} : { reachedRate: reachedTimes.length / eligible }),
    ...(reachedTimes.length === 0 ? {} : { medianReachedSeconds: median(reachedTimes) }),
  };
}

function highActivityWindow(values: readonly number[], shares: readonly number[]): string {
  const threshold = Math.max(...values) * 0.8;
  const high = values.map((value) => value >= threshold);
  if (high.every(Boolean)) return "00:00–24:00 UTC";
  const candidates: Array<{ start: number; length: number; share: number }> = [];
  for (let start = 0; start < 24; start++) {
    if (!high[start] || high[(start + 23) % 24]) continue;
    let length = 0;
    let share = 0;
    while (length < 24 && high[(start + length) % 24]) {
      share += shares[(start + length) % 24]!;
      length++;
    }
    candidates.push({ start, length, share });
  }
  candidates.sort((a, b) => b.share - a.share || b.length - a.length || a.start - b.start);
  const winner = candidates[0]!;
  return `${padHour(winner.start)}:00–${padHour((winner.start + winner.length) % 24)}:00 UTC`;
}

function firstSnapshotIn(snapshots: readonly FixtureLiquiditySnapshot[], start: number, end: number): FixtureLiquiditySnapshot | undefined {
  return snapshots.find((snapshot) => snapshot.at.getTime() >= start && snapshot.at.getTime() <= end);
}

function median(values: readonly number[]): number {
  const midpoint = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[midpoint - 1]! + values[midpoint]!) / 2 : values[midpoint]!;
}

function assertInteger(value: number, field: string): void {
  if (!Number.isInteger(value)) throw new Error(`${field} must be an integer`);
}

function padHour(hour: number): string {
  return hour.toString().padStart(2, "0");
}