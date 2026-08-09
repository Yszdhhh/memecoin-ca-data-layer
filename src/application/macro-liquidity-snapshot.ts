import type {
  CoinalyzeLiquidationSummary,
  DefiLlamaLiquiditySnapshot,
  LiquidityMetricValueV1,
  LiquidityPercentileStats,
  LiquidityProtocolShare,
  LiquiditySnapshotV1,
  LiquiditySourceWatermarkV1,
  LiquidityVerificationStatus,
  LiquidityWarning,
} from "../domain/macro-liquidity.js";
import { fetchCoinalyzeLiquidations } from "./macro-liquidity-coinalyze.js";
import { fetchDefiLlamaLiquidity, type LiquidityHttpTransport } from "./macro-liquidity-defillama.js";

/**
 * Assembles the LiquiditySnapshotV1 contract (blueprint §5.1 /api/v1/liquidity/latest):
 * metric set / window / values / freshness / quality + §5.3 source watermarks.
 *
 * Fail-closed: every missing source contributes null values + warnings; nothing
 * is fabricated. The only network access is through the injected transport.
 */

export interface LiquiditySnapshotInput {
  readonly coinalyzeApiKey?: string;
  readonly transport?: LiquidityHttpTransport;
  /** Deterministic clock for tests; defaults to now. */
  readonly now?: Date;
}

export async function buildLiquiditySnapshot(input: LiquiditySnapshotInput): Promise<LiquiditySnapshotV1> {
  const now = input.now ?? new Date();
  const [defillama, coinalyze] = await Promise.all([
    fetchDefiLlamaLiquidity(input.transport === undefined ? {} : { transport: input.transport }),
    fetchCoinalyzeLiquidations({
      ...(input.coinalyzeApiKey?.trim() ? { apiKey: input.coinalyzeApiKey } : {}),
      ...(input.transport === undefined ? {} : { transport: input.transport }),
      now,
    }),
  ]);

  const metricSets: LiquidityMetricValueV1[] = [];
  const warnings: LiquidityWarning[] = [];
  const sources: LiquiditySourceWatermarkV1[] = [];

  const defillamaStatus = defillamaSource(defillama);
  const defillamaMetrics = defillamaMetricRows(defillama);
  metricSets.push(...defillamaMetrics);
  sources.push(defillamaStatus.watermark);
  warnings.push(...defillamaStatus.warnings);

  const coinalyzeStatus = coinalyzeSource(coinalyze);
  metricSets.push(...coinalyzeMetricRows(coinalyze));
  sources.push(coinalyzeStatus.watermark);
  warnings.push(...coinalyzeStatus.warnings);

  const protocolShares: readonly LiquidityProtocolShare[] = defillama.volume?.protocolShares ?? [];
  const observedAtCandidates = [
    defillama.observedAt,
    ...(coinalyze.available && coinalyze.window.to ? [coinalyze.window.to] : []),
  ];
  const observedAt = latest(observedAtCandidates) ?? now.toISOString();
  const presentCount = metricSets.filter((row) => row.value !== null).length;
  const completeness = metricSets.length === 0 ? 0 : presentCount / metricSets.length;

  return {
    schemaVersion: "liquidity-snapshot-v1",
    generatedAt: now.toISOString(),
    metricSets,
    protocolShares,
    freshness: { observedAt, maxMetricAgeHours: maxMetricAgeHours(observedAt, now) },
    quality: { completeness, status: qualityStatus(completeness) },
    sources,
    warnings: uniqueWarnings(warnings),
  };
}

function defillamaSource(defillama: DefiLlamaLiquiditySnapshot): { watermark: LiquiditySourceWatermarkV1; warnings: readonly LiquidityWarning[] } {
  const components = [defillama.volume, defillama.fees, defillama.tvl].filter((component) => component !== null).length;
  const completeness = components / 3;
  return {
    watermark: {
      source: "defillama",
      tier: "B",
      verificationStatus: qualityStatus(completeness),
      observedAt: defillama.observedAt,
      completeness,
      warnings: defillama.warnings,
    },
    warnings: defillama.warnings,
  };
}

function defillamaMetricRows(defillama: DefiLlamaLiquiditySnapshot): LiquidityMetricValueV1[] {
  const rows: LiquidityMetricValueV1[] = [];
  if (defillama.volume) {
    rows.push(
      metricRow("dex_volume_usd", "24h", defillama.volume.total24h, defillama.volume.change1dPct, null),
      metricRow("dex_volume_usd", "7d", defillama.volume.total7d, defillama.volume.change7dPct, defillama.volume.percentiles["7d"]),
      metricRow("dex_volume_usd", "30d", defillama.volume.total30d, defillama.volume.change1mPct, defillama.volume.percentiles["30d"]),
    );
  }
  if (defillama.fees) {
    rows.push(
      metricRow("protocol_fees_usd", "24h", defillama.fees.total24h, defillama.fees.change1dPct, null),
      metricRow("protocol_fees_usd", "7d", defillama.fees.total7d, defillama.fees.change7dPct, defillama.fees.percentiles["7d"]),
      metricRow("protocol_fees_usd", "30d", defillama.fees.total30d, defillama.fees.change1mPct, defillama.fees.percentiles["30d"]),
    );
  }
  if (defillama.tvl) {
    // TVL is a level, not a flow: the same level appears in each window row,
    // carrying the trailing 7d/30d water-level percentile.
    rows.push(
      metricRow("tvl_usd", "24h", defillama.tvl.tvl, null, null),
      metricRow("tvl_usd", "7d", defillama.tvl.tvl, null, defillama.tvl.percentiles["7d"]),
      metricRow("tvl_usd", "30d", defillama.tvl.tvl, null, defillama.tvl.percentiles["30d"]),
    );
  }
  return rows;
}

function coinalyzeSource(coinalyze: CoinalyzeLiquidationSummary): { watermark: LiquiditySourceWatermarkV1; warnings: readonly LiquidityWarning[] } {
  const hasHourly = coinalyze.symbols.some((item) => item.interval === "1hour");
  const hasDaily = coinalyze.symbols.some((item) => item.interval === "1day");
  const completeness = (hasHourly ? 0.5 : 0) + (hasDaily ? 0.5 : 0);
  return {
    watermark: {
      source: "coinalyze",
      tier: "B",
      verificationStatus: coinalyze.available ? qualityStatus(completeness) : "unavailable",
      observedAt: coinalyze.available ? coinalyze.window.to : null,
      completeness,
      warnings: coinalyze.warnings,
    },
    warnings: coinalyze.warnings,
  };
}

function coinalyzeMetricRows(coinalyze: CoinalyzeLiquidationSummary): LiquidityMetricValueV1[] {
  const hourly = coinalyze.symbols.filter((item) => item.interval === "1hour");
  const daily = coinalyze.symbols.filter((item) => item.interval === "1day");
  const hourlyTotals = sumTotals(hourly);
  const dailyTotals = sumTotals(daily);
  return [
    metricRow("long_liquidation_usd", "24h", hourlyTotals?.longUsd ?? null, null, null),
    metricRow("short_liquidation_usd", "24h", hourlyTotals?.shortUsd ?? null, null, null),
    metricRow("long_liquidation_usd", "7d", dailyTotals?.longUsd ?? null, null, null),
    metricRow("short_liquidation_usd", "7d", dailyTotals?.shortUsd ?? null, null, null),
  ];
}

function sumTotals(symbols: readonly CoinalyzeLiquidationSummary["symbols"][number][]): { longUsd: number; shortUsd: number } | null {
  if (symbols.length === 0) return null;
  return {
    longUsd: symbols.reduce((acc, item) => acc + item.longUsd, 0),
    shortUsd: symbols.reduce((acc, item) => acc + item.shortUsd, 0),
  };
}

function metricRow(metric: LiquidityMetricValueV1["metric"], window: LiquidityMetricValueV1["window"], value: number | null, changePct: number | null, percentile: LiquidityPercentileStats | null): LiquidityMetricValueV1 {
  return { metric, source: metric.includes("liquidation") ? "coinalyze" : "defillama", window, value, changePct, percentile };
}

function qualityStatus(completeness: number): LiquidityVerificationStatus {
  if (completeness >= 1) return "verified";
  return completeness > 0 ? "degraded" : "unavailable";
}

function maxMetricAgeHours(observedAt: string, now: Date): number | null {
  const parsed = Date.parse(observedAt);
  return Number.isFinite(parsed) ? (now.getTime() - parsed) / (60 * 60 * 1_000) : null;
}

function latest(values: readonly string[]): string | null {
  let latestValue: string | null = null;
  for (const value of values) {
    if (latestValue === null || Date.parse(value) > Date.parse(latestValue)) latestValue = value;
  }
  return latestValue;
}

function uniqueWarnings(warnings: readonly LiquidityWarning[]): LiquidityWarning[] {
  const seen = new Set<string>();
  const unique: LiquidityWarning[] = [];
  for (const warning of warnings) {
    if (seen.has(warning.code)) continue;
    seen.add(warning.code);
    unique.push(warning);
  }
  return unique;
}
