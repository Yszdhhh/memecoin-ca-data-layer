import type { LiquidityPercentileStats } from "../domain/macro-liquidity.js";

/**
 * Pure local percentile computation for liquidity water levels.
 * No network, no I/O — deterministic and unit-tested in isolation.
 *
 * Algorithm (per docs/research/MACRO_LIQUIDITY_DATA_SOURCES_20260809.md §3):
 *   percentile_rank(x) = 100 * count(v <= x) / N
 *   P25/P50/P75 via nearest-rank; z-score vs. the sample mean.
 */

/** Nearest-rank percentile of a sample (0 < p <= 100); null when the sample is empty. */
export function percentile(sample: readonly number[], p: number): number | null {
  if (sample.length === 0) return null;
  const sorted = [...sample].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1] ?? null;
}

/** Percentile rank of `current` within `sample`: 100 * count(v <= current) / N. */
export function percentileRank(sample: readonly number[], current: number): number {
  if (sample.length === 0) return Number.NaN;
  const count = sample.reduce((acc, value) => acc + (value <= current ? 1 : 0), 0);
  return (100 * count) / sample.length;
}

/** z-score of `current` within `sample`; null when the sample has zero variance. */
export function zScore(sample: readonly number[], current: number): number | null {
  if (sample.length === 0) return null;
  const mean = sample.reduce((acc, value) => acc + value, 0) / sample.length;
  const variance = sample.reduce((acc, value) => acc + (value - mean) ** 2, 0) / sample.length;
  if (variance === 0) return null;
  return (current - mean) / Math.sqrt(variance);
}

/**
 * Water-level percentile stats: ranks `current` against `sample`.
 * Returns null when fewer than 2 finite points are available (P25/P75 and
 * variance need a real spread).
 */
export function computePercentileStats(sample: readonly number[], current: number, windowDays: 7 | 30): LiquidityPercentileStats | null {
  const clean = sample.filter((value) => Number.isFinite(value));
  if (clean.length < 2 || !Number.isFinite(current)) return null;
  return {
    windowDays,
    current,
    p25: percentile(clean, 25) as number,
    p50: percentile(clean, 50) as number,
    p75: percentile(clean, 75) as number,
    rank: percentileRank(clean, current),
    zScore: zScore(clean, current),
    sampleCount: clean.length,
    ruleVersion: "liquidity-percentiles-v1",
  };
}

/**
 * Splits a [timestamp, value] daily chart into the trailing window:
 * `current` = the latest point (the possibly-partial day being ranked),
 * `sample` = the up to `windowDays` preceding complete daily points.
 * Returns null when the chart does not have at least one point.
 */
export function trailingWindowValues(points: readonly (readonly [number, number])[], windowDays: number): { sample: number[]; current: number } | null {
  if (points.length === 0) return null;
  const tail = points.slice(-(windowDays + 1));
  const last = tail[tail.length - 1];
  if (last === undefined) return null;
  return { sample: tail.slice(0, -1).map((point) => point[1]), current: last[1] };
}
