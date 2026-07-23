import assert from "node:assert/strict";
import test from "node:test";
import type { MacroDexScreenerRolling24hObservation, MacroDuneRolling24hObservation } from "../src/domain/macro-daily.js";
import { reconcileDexScreenerRolling24h } from "../src/application/macro-dex-dune-reconciliation.js";

const capturedAt = new Date("2026-07-20T12:00:00.000Z");
const rollingWindowStart = new Date("2026-07-19T12:00:00.000Z");

function dexscreener(): MacroDexScreenerRolling24hObservation {
  return {
    layer: "dexscreener_realtime",
    sourceLabel: "DexScreener chain dashboard (manual fixture)",
    chain: "solana",
    capturedAt,
    rollingWindowStart,
    rollingWindowEnd: capturedAt,
    volumeUsd: 120,
    transactionCount: 120,
    latestBlock: 400_000_000,
    warnings: [],
  };
}

function dune(): MacroDuneRolling24hObservation {
  return {
    source: "dune",
    queryRef: "fixture:dune:solana:rolling-24h",
    queryVersion: "1",
    sourceAsOf: new Date("2026-07-20T13:00:00.000Z"),
    computedAt: new Date("2026-07-20T13:01:00.000Z"),
    completeness: 1,
    warnings: [],
    chain: "solana",
    rollingWindowStart,
    rollingWindowEnd: capturedAt,
    dataWatermark: capturedAt,
    volumeUsd: 100,
    uniqueSwapTransactionCount: 100,
    tradeLegCount: 150,
    registryVersion: "spellbook:dex_solana@fixture",
    coverageStatus: "declared_registry",
  };
}

test("keeps an external DexScreener snapshot PARK until an exact Dune interval exists", () => {
  const result = reconcileDexScreenerRolling24h(dexscreener());

  assert.equal(result.analysisStatus, "park_dune_unavailable");
  assert.equal(result.directComparisonStatus, "not_directly_comparable");
  assert.ok(result.warnings.some((warning) => warning.code === "external_rolling_24h_not_utc_day"));
  assert.ok(result.warnings.some((warning) => warning.code === "volume_is_not_liquidity"));
  assert.ok(result.warnings.some((warning) => warning.code === "dune_rolling_window_unavailable"));
});

test("fails closed when Dune uses a different interval or its watermark is behind", () => {
  const mismatched = reconcileDexScreenerRolling24h(dexscreener(), {
    ...dune(),
    rollingWindowStart: new Date("2026-07-19T11:00:00.000Z"),
    rollingWindowEnd: new Date("2026-07-20T11:00:00.000Z"),
  });
  assert.equal(mismatched.analysisStatus, "park_window_mismatch");

  const behind = reconcileDexScreenerRolling24h(dexscreener(), { ...dune(), dataWatermark: new Date("2026-07-20T11:59:59.999Z") });
  assert.equal(behind.analysisStatus, "park_dune_watermark_behind");
});

test("does not promote an incomplete Dune interval into a calibration sample", () => {
  const result = reconcileDexScreenerRolling24h(dexscreener(), { ...dune(), completeness: 0.99 });

  assert.equal(result.analysisStatus, "park_dune_incomplete");
  assert.ok(result.warnings.some((warning) => warning.code === "dune_rolling_window_incomplete"));
});

test("records aligned data as calibration diagnostics, not provider equivalence", () => {
  const result = reconcileDexScreenerRolling24h(dexscreener(), dune());

  assert.equal(result.analysisStatus, "aligned_pending_calibration");
  assert.equal(result.directComparisonStatus, "not_directly_comparable");
  assert.equal(result.volumeDifferencePct, 20);
  assert.equal(result.transactionDifferenceVsUniqueSwapPct, 20);
  assert.equal(result.transactionDifferenceVsTradeLegPct, -20);
  assert.ok(result.warnings.some((warning) => warning.code === "calibration_sample_not_metric_equivalence"));
});

test("keeps zero Dune denominators visible instead of manufacturing a percentage", () => {
  const result = reconcileDexScreenerRolling24h(dexscreener(), {
    ...dune(),
    volumeUsd: 0,
    uniqueSwapTransactionCount: 0,
    tradeLegCount: 0,
  });

  assert.equal(result.volumeDifferencePct, undefined);
  assert.equal(result.transactionDifferenceVsUniqueSwapPct, undefined);
  assert.equal(result.transactionDifferenceVsTradeLegPct, undefined);
  assert.ok(result.warnings.some((warning) => warning.code === "zero_dune_volume_denominator"));
});

test("rejects a rolling window that is not exactly 24 hours", () => {
  assert.throws(() => reconcileDexScreenerRolling24h({
    ...dexscreener(),
    rollingWindowStart: new Date("2026-07-19T12:00:01.000Z"),
  }), /exactly 24 hours/);
});


test("rejects a Dune calibration candidate without query provenance", () => {
  assert.throws(() => reconcileDexScreenerRolling24h(dexscreener(), { ...dune(), queryRef: "" }), /requires query provenance/);
});
