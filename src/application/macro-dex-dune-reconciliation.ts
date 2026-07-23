import type {
  MacroDexDuneReconciliation,
  MacroDexScreenerRolling24hObservation,
  MacroDuneRolling24hObservation,
  MacroWarning,
} from "../domain/macro-daily.js";

const ROLLING_24H_MS = 24 * 60 * 60 * 1_000;

/**
 * Reconciles a manually captured DexScreener rolling-24H snapshot with a Dune
 * observation over the exact same interval. This is a calibration record, not
 * a historical comparison or a statement that either provider's counts match.
 */
export function reconcileDexScreenerRolling24h(
  dexscreener: MacroDexScreenerRolling24hObservation,
  dune?: MacroDuneRolling24hObservation,
): MacroDexDuneReconciliation {
  assertDexScreenerSnapshot(dexscreener);
  const warnings: MacroWarning[] = [
    { code: "external_rolling_24h_not_utc_day" },
    { code: "volume_is_not_liquidity" },
    { code: "latest_block_is_liveness_only" },
    { code: "not_directly_comparable" },
  ];
  const base = {
    layer: "dex_dune_reconciliation" as const,
    chain: "solana" as const,
    dexscreener,
    directComparisonStatus: "not_directly_comparable" as const,
  };

  if (!dune) {
    return { ...base, analysisStatus: "park_dune_unavailable", warnings: [...warnings, { code: "dune_rolling_window_unavailable" }] };
  }
  assertDuneObservation(dune);
  if (!sameWindow(dexscreener, dune)) {
    return { ...base, dune, analysisStatus: "park_window_mismatch", warnings: [...warnings, { code: "dex_dune_window_mismatch" }] };
  }
  if (dune.dataWatermark.getTime() < dune.rollingWindowEnd.getTime()) {
    return { ...base, dune, analysisStatus: "park_dune_watermark_behind", warnings: [...warnings, { code: "dune_watermark_behind_snapshot" }] };
  }
  if (dune.completeness !== 1) {
    return { ...base, dune, analysisStatus: "park_dune_incomplete", warnings: [...warnings, { code: "dune_rolling_window_incomplete" }] };
  }

  const differences = {
    volumeDifferencePct: differencePct(dexscreener.volumeUsd, dune.volumeUsd),
    transactionDifferenceVsUniqueSwapPct: differencePct(dexscreener.transactionCount, dune.uniqueSwapTransactionCount),
    transactionDifferenceVsTradeLegPct: differencePct(dexscreener.transactionCount, dune.tradeLegCount),
  };
  const zeroDenominatorWarnings: MacroWarning[] = [];
  if (differences.volumeDifferencePct === undefined) zeroDenominatorWarnings.push({ code: "zero_dune_volume_denominator" });
  if (differences.transactionDifferenceVsUniqueSwapPct === undefined) zeroDenominatorWarnings.push({ code: "zero_dune_unique_swap_denominator" });
  if (differences.transactionDifferenceVsTradeLegPct === undefined) zeroDenominatorWarnings.push({ code: "zero_dune_trade_leg_denominator" });

  return {
    ...base,
    dune,
    analysisStatus: "aligned_pending_calibration",
    ...(differences.volumeDifferencePct === undefined ? {} : { volumeDifferencePct: differences.volumeDifferencePct }),
    ...(differences.transactionDifferenceVsUniqueSwapPct === undefined ? {} : { transactionDifferenceVsUniqueSwapPct: differences.transactionDifferenceVsUniqueSwapPct }),
    ...(differences.transactionDifferenceVsTradeLegPct === undefined ? {} : { transactionDifferenceVsTradeLegPct: differences.transactionDifferenceVsTradeLegPct }),
    warnings: [...warnings, { code: "calibration_sample_not_metric_equivalence" }, ...zeroDenominatorWarnings],
  };
}

function assertDexScreenerSnapshot(snapshot: MacroDexScreenerRolling24hObservation): void {
  if (snapshot.layer !== "dexscreener_realtime" || snapshot.chain !== "solana" || !snapshot.sourceLabel.trim()) {
    throw new Error("DexScreener rolling 24H snapshot must be labelled and Solana-only");
  }
  assertExactRollingWindow(snapshot.rollingWindowStart, snapshot.rollingWindowEnd, snapshot.capturedAt, "DexScreener");
  assertFiniteNonNegative(snapshot.volumeUsd, "DexScreener volumeUsd");
  assertNonNegativeInteger(snapshot.transactionCount, "DexScreener transactionCount");
  assertNonNegativeInteger(snapshot.latestBlock, "DexScreener latestBlock");
}

function assertDuneObservation(observation: MacroDuneRolling24hObservation): void {
  if (observation.source !== "dune" || observation.chain !== "solana" || observation.coverageStatus !== "declared_registry" || !observation.registryVersion.trim()) {
    throw new Error("Dune rolling 24H observation must be Solana declared-registry coverage");
  }
  if (!observation.queryRef.trim() || !observation.queryVersion.trim()) {
    throw new Error("Dune rolling 24H observation requires query provenance");
  }
  assertExactRollingWindow(observation.rollingWindowStart, observation.rollingWindowEnd, undefined, "Dune");
  assertValidDate(observation.sourceAsOf, "Dune sourceAsOf");
  assertValidDate(observation.computedAt, "Dune computedAt");
  assertValidDate(observation.dataWatermark, "Dune dataWatermark");
  assertFiniteNonNegative(observation.completeness, "Dune completeness");
  if (observation.completeness > 1) throw new Error("Dune completeness must not exceed one");
  assertFiniteNonNegative(observation.volumeUsd, "Dune volumeUsd");
  assertNonNegativeInteger(observation.uniqueSwapTransactionCount, "Dune uniqueSwapTransactionCount");
  assertNonNegativeInteger(observation.tradeLegCount, "Dune tradeLegCount");
}

function assertExactRollingWindow(start: Date, end: Date, capturedAt: Date | undefined, source: string): void {
  assertValidDate(start, `${source} rollingWindowStart`);
  assertValidDate(end, `${source} rollingWindowEnd`);
  if (end.getTime() - start.getTime() !== ROLLING_24H_MS) throw new Error(`${source} rolling window must be exactly 24 hours`);
  if (capturedAt) {
    assertValidDate(capturedAt, `${source} capturedAt`);
    if (capturedAt.getTime() !== end.getTime()) throw new Error(`${source} rolling window must end at capturedAt`);
  }
}

function assertValidDate(value: Date, label: string): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error(`${label} must be a valid Date`);
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative`);
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
}

function sameWindow(a: { rollingWindowStart: Date; rollingWindowEnd: Date }, b: { rollingWindowStart: Date; rollingWindowEnd: Date }): boolean {
  return a.rollingWindowStart.getTime() === b.rollingWindowStart.getTime()
    && a.rollingWindowEnd.getTime() === b.rollingWindowEnd.getTime();
}

function differencePct(observed: number, baseline: number): number | undefined {
  return baseline === 0 ? undefined : ((observed - baseline) / baseline) * 100;
}
