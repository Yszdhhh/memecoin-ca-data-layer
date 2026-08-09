import { isRecord } from "../infrastructure/type-guards.js";
import type {
  DefiLlamaLiquiditySnapshot,
  DefiLlamaOverviewObservation,
  DefiLlamaTvlObservation,
  LiquidityPercentilesByWindow,
  LiquidityProtocolShare,
  LiquidityWarning,
} from "../domain/macro-liquidity.js";
import { computePercentileStats, trailingWindowValues } from "./macro-liquidity-percentiles.js";

/**
 * DefiLlama (key-free) liquidity water-level adapter.
 * Endpoints (all HTTP GET, no auth):
 *   GET /overview/dexs/solana?excludeTotalDataChart=false&dataType=dailyVolume
 *   GET /overview/fees/solana?excludeTotalDataChart=false&dataType=dailyFees
 *   GET /v2/historicalChainTvl/Solana
 *
 * Fail-closed contract: each endpoint degrades to null + an explicit warning;
 * the aggregate snapshot never throws on provider failure.
 */

export type LiquidityHttpTransport = (request: { url: string; method: "GET"; headers: Readonly<Record<string, string>> }) => Promise<{ status: number; body: unknown }>;

const DEFILLAMA_BASE_URL = "https://api.llama.fi";

export const defaultLiquidityHttpTransport: LiquidityHttpTransport = async (request) => {
  const response = await fetch(request.url, { method: request.method, headers: request.headers, signal: AbortSignal.timeout(15_000) });
  const body: unknown = await response.json().catch(() => null);
  return { status: response.status, body };
};

export interface DefiLlamaFetchInput {
  readonly transport?: LiquidityHttpTransport;
}

interface FetchOutcome {
  readonly ok: boolean;
  readonly body?: unknown;
  readonly warning?: LiquidityWarning;
}

async function fetchJson(transport: LiquidityHttpTransport, url: string, warningCode: string): Promise<FetchOutcome> {
  try {
    const result = await transport({ url, method: "GET", headers: { Accept: "application/json" } });
    if (result.status < 200 || result.status >= 300) {
      return { ok: false, warning: { code: warningCode, message: `DefiLlama ${url} returned HTTP ${result.status}` } };
    }
    return { ok: true, body: result.body };
  } catch (error) {
    return { ok: false, warning: { code: warningCode, message: `DefiLlama ${url} fetch failed: ${error instanceof Error ? error.message : String(error)}` } };
  }
}

export async function fetchDefiLlamaLiquidity(input: DefiLlamaFetchInput = {}): Promise<DefiLlamaLiquiditySnapshot> {
  const transport = input.transport ?? defaultLiquidityHttpTransport;
  const observedAt = new Date();
  const [dexsResult, feesResult, tvlResult] = await Promise.all([
    fetchJson(transport, `${DEFILLAMA_BASE_URL}/overview/dexs/solana?excludeTotalDataChart=false&dataType=dailyVolume`, "defillama_dex_volume_unavailable"),
    fetchJson(transport, `${DEFILLAMA_BASE_URL}/overview/fees/solana?excludeTotalDataChart=false&dataType=dailyFees`, "defillama_fees_unavailable"),
    fetchJson(transport, `${DEFILLAMA_BASE_URL}/v2/historicalChainTvl/Solana`, "defillama_tvl_unavailable"),
  ]);

  const warnings: LiquidityWarning[] = [];
  const volume = dexsResult.ok ? parseOverviewBody(dexsResult.body, "dex_volume", warnings) : null;
  const fees = feesResult.ok ? parseOverviewBody(feesResult.body, "protocol_fees", warnings) : null;
  const tvl = tvlResult.ok ? parseTvlBody(tvlResult.body, warnings) : null;
  for (const outcome of [dexsResult, feesResult, tvlResult]) {
    if (!outcome.ok && outcome.warning) warnings.push(outcome.warning);
  }
  return { volume, fees, tvl, observedAt: observedAt.toISOString(), warnings };
}

function parseOverviewBody(body: unknown, kind: "dex_volume" | "protocol_fees", warnings: LiquidityWarning[]): DefiLlamaOverviewObservation | null {
  if (!isRecord(body)) {
    warnings.push({ code: `defillama_${kind}_malformed`, message: `DefiLlama ${kind} response is not a JSON object` });
    return null;
  }
  const total24h = readFiniteNumber(body, "total24h");
  if (total24h === null) {
    warnings.push({ code: `defillama_${kind}_malformed`, message: `DefiLlama ${kind} response has no finite total24h` });
    return null;
  }
  const chart = readChart(body, "totalDataChart");
  return {
    kind,
    total24h,
    total7d: readFiniteNumber(body, "total7d"),
    total30d: readFiniteNumber(body, "total30d"),
    change1dPct: readFiniteNumber(body, "change_1d"),
    change7dPct: readFiniteNumber(body, "change_7d"),
    change1mPct: readFiniteNumber(body, "change_1m"),
    protocolShares: readProtocolShares(body, total24h, kind, warnings),
    percentiles: computePercentilesFromChart(chart),
    warnings: [],
  };
}

function parseTvlBody(body: unknown, warnings: LiquidityWarning[]): DefiLlamaTvlObservation | null {
  if (!Array.isArray(body)) {
    warnings.push({ code: "defillama_tvl_malformed", message: "DefiLlama TVL response is not an array" });
    return null;
  }
  const points: Array<readonly [number, number]> = [];
  for (const entry of body) {
    if (isRecord(entry)) {
      const date = typeof entry.date === "number" ? entry.date : Number.NaN;
      const tvl = typeof entry.tvl === "number" ? entry.tvl : Number.NaN;
      if (Number.isFinite(date) && Number.isFinite(tvl)) points.push([date, tvl]);
    }
  }
  if (points.length === 0) {
    warnings.push({ code: "defillama_tvl_malformed", message: "DefiLlama TVL response has no usable [date, tvl] points" });
    return null;
  }
  const last = points[points.length - 1]!;
  return { tvl: last[1], percentiles: computePercentilesFromChart(points), warnings: [] };
}

/**
 * Percentiles for the 7d/30d water level: `current` = latest daily point,
 * sample = the up to N preceding complete daily points.
 */
function computePercentilesFromChart(chart: readonly (readonly [number, number])[]): LiquidityPercentilesByWindow {
  const seven = trailingWindowValues(chart, 7);
  const thirty = trailingWindowValues(chart, 30);
  return {
    "7d": seven === null ? null : computePercentileStats(seven.sample, seven.current, 7),
    "30d": thirty === null ? null : computePercentileStats(thirty.sample, thirty.current, 30),
  };
}

/** Protocol 24h shares from `protocols[]`; falls back to the chart breakdown. */
function readProtocolShares(record: Record<string, unknown>, total24h: number, kind: "dex_volume" | "protocol_fees", warnings: LiquidityWarning[]): LiquidityProtocolShare[] {
  const fromProtocols = readProtocolsArray(record, total24h);
  if (fromProtocols.length > 0) return fromProtocols;
  const fromBreakdown = readBreakdown(record, total24h);
  if (fromBreakdown.length > 0) return fromBreakdown;
  warnings.push({ code: `defillama_${kind}_protocol_breakdown_missing`, message: `DefiLlama ${kind} response has no protocols/breakdown; protocol shares are empty` });
  return [];
}

function readProtocolsArray(record: Record<string, unknown>, total24h: number): LiquidityProtocolShare[] {
  const protocols = record["protocols"];
  if (!Array.isArray(protocols)) return [];
  const shares: LiquidityProtocolShare[] = [];
  for (const entry of protocols) {
    if (!isRecord(entry)) continue;
    const name = typeof entry.name === "string" && entry.name.trim() ? entry.name : null;
    // Current API: per-protocol total24h; legacy API used `volume`.
    const volume = typeof entry.total24h === "number" && Number.isFinite(entry.total24h)
      ? entry.total24h
      : typeof entry.volume === "number" && Number.isFinite(entry.volume) ? entry.volume : Number.NaN;
    if (name === null || !Number.isFinite(volume) || volume < 0) continue;
    shares.push({ name, volume24hUsd: volume, share24hPct: total24h > 0 ? (volume / total24h) * 100 : 0 });
  }
  return shares.sort((a, b) => b.volume24hUsd - a.volume24hUsd);
}

/**
 * Legacy-free fallback for the current totalDataChartBreakdown shape:
 * Array<[timestamp, Record<protocolName, dailyValue>]> — shares come from the
 * latest (current-day) point's per-protocol values.
 */
function readBreakdown(record: Record<string, unknown>, total24h: number): LiquidityProtocolShare[] {
  const breakdown = record["totalDataChartBreakdown"];
  if (!Array.isArray(breakdown)) return [];
  const last = breakdown[breakdown.length - 1];
  const lastValues = Array.isArray(last) && isRecord(last[1]) ? last[1] : null;
  if (lastValues === null) return [];
  const shares: LiquidityProtocolShare[] = [];
  for (const [name, value] of Object.entries(lastValues)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
    shares.push({ name, volume24hUsd: value, share24hPct: total24h > 0 ? (value / total24h) * 100 : 0 });
  }
  return shares.sort((a, b) => b.volume24hUsd - a.volume24hUsd);
}

function readChart(record: Record<string, unknown>, field: string): Array<readonly [number, number]> {
  const raw = record[field];
  if (!Array.isArray(raw)) return [];
  const points: Array<readonly [number, number]> = [];
  for (const entry of raw) {
    if (Array.isArray(entry)) {
      const ts = entry[0];
      const value = entry[1];
      if (typeof ts === "number" && typeof value === "number" && Number.isFinite(ts) && Number.isFinite(value)) points.push([ts, value]);
    }
  }
  return points;
}

/** Reads a finite numeric field; used by 6 call sites with the same contract. */
function readFiniteNumber(record: Record<string, unknown>, field: string): number | null {
  const value = record[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
