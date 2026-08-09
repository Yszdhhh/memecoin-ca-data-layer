import assert from "node:assert/strict";
import test from "node:test";
import { computePercentileStats, percentile, percentileRank, trailingWindowValues, zScore } from "../src/application/macro-liquidity-percentiles.js";

test("percentile uses nearest-rank", () => {
  assert.equal(percentile([10, 20, 30, 40, 50, 60, 70], 25), 20);
  assert.equal(percentile([10, 20, 30, 40, 50, 60, 70], 50), 40);
  assert.equal(percentile([10, 20, 30, 40, 50, 60, 70], 75), 60);
  assert.equal(percentile([], 50), null);
});

test("percentile rank is 100 * count(v <= x) / N", () => {
  const sample = [10, 20, 30, 40, 50, 60, 70];
  assert.equal(percentileRank(sample, 70), 100);
  assert.equal(percentileRank(sample, 25), (100 * 2) / 7);
  assert.equal(percentileRank(sample, 0), 0);
  assert.ok(Number.isNaN(percentileRank([], 5)));
});

test("z-score uses population variance; null on zero variance", () => {
  assert.equal(zScore([10, 20, 30, 40, 50, 60, 70], 70), 1.5);
  assert.equal(zScore([5, 5, 5, 5], 5), null);
  assert.equal(zScore([], 5), null);
});

test("7d percentile stats: known sample and current", () => {
  const stats = computePercentileStats([10, 20, 30, 40, 50, 60, 70], 70, 7);
  assert.ok(stats !== null);
  assert.deepEqual(
    { windowDays: stats.windowDays, current: stats.current, p25: stats.p25, p50: stats.p50, p75: stats.p75, rank: stats.rank, zScore: stats.zScore, sampleCount: stats.sampleCount, ruleVersion: stats.ruleVersion },
    { windowDays: 7, current: 70, p25: 20, p50: 40, p75: 60, rank: 100, zScore: 1.5, sampleCount: 7, ruleVersion: "liquidity-percentiles-v1" },
  );
});

test("30d percentile stats window is honoured", () => {
  const stats = computePercentileStats([100, 200, 300, 400], 300, 30);
  assert.ok(stats !== null);
  assert.equal(stats.windowDays, 30);
  assert.equal(stats.rank, 75); // 3 of 4 values <= 300
});

test("empty or single-point sample yields null (no P25/P75 spread)", () => {
  assert.equal(computePercentileStats([], 5, 7), null);
  assert.equal(computePercentileStats([5], 5, 7), null);
  assert.equal(computePercentileStats([1, 2, 3], Number.NaN, 7), null);
});

test("all-zero window: rank 100, zero-variance z-score null", () => {
  const stats = computePercentileStats([0, 0, 0, 0], 0, 7);
  assert.ok(stats !== null);
  assert.equal(stats.rank, 100);
  assert.equal(stats.p25, 0);
  assert.equal(stats.p50, 0);
  assert.equal(stats.p75, 0);
  assert.equal(stats.zScore, null);
});

test("trailingWindowValues splits current (latest) from the preceding window", () => {
  const points: Array<readonly [number, number]> = [[1, 10], [2, 20], [3, 30], [4, 40], [5, 50]];
  assert.deepEqual(trailingWindowValues(points, 3), { sample: [20, 30, 40], current: 50 });
  assert.deepEqual(trailingWindowValues(points, 7), { sample: [10, 20, 30, 40], current: 50 });
  assert.deepEqual(trailingWindowValues(points, 1), { sample: [40], current: 50 });
  assert.equal(trailingWindowValues([], 7), null);
});
