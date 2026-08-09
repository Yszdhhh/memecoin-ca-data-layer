import { isRecord } from "../infrastructure/type-guards.js";
import type { CoinalyzeLiquidationSummary, CoinalyzeLiquidationSymbolSummary, LiquidityWarning } from "../domain/macro-liquidity.js";
import { defaultLiquidityHttpTransport, type LiquidityHttpTransport } from "./macro-liquidity-defillama.js";

/**
 * Coinalyze liquidation adapter (CEX perpetual liquidation history — NOT
 * on-chain data; product copy must say so).
 *
 *   GET /v1/liquidation-history?symbols=BTCUSDT_PERP.A,ETHUSDT_PERP.A,SOLUSDT_PERP.A
 *       &interval={1hour|1day}&convert_to_usd=true&from=<unix_sec>&to=<unix_sec>
 *   header: api_key
 *
 * Fail-closed contract: without COINALYZE_API_KEY the summary is
 * `available: false` with an explicit warning and no fabricated data; the
 * transport is never called. With a key, per-symbol `l` (long liquidations)
 * and `s` (short liquidations) are summed in USD.
 */

const COINALYZE_BASE_URL = "https://api.coinalyze.net/v1";
const LIQUIDATION_SYMBOLS = ["BTCUSDT_PERP.A", "ETHUSDT_PERP.A", "SOLUSDT_PERP.A"] as const;
const NO_KEY_WARNING: LiquidityWarning = {
  code: "coinalyze_requires_api_key",
  message: "COINALYZE_API_KEY is not configured; Coinalyze liquidation data is unavailable (fail-closed). Coinalyze reports CEX perpetual liquidations, not on-chain data.",
};

export interface CoinalyzeFetchInput {
  readonly apiKey?: string;
  readonly transport?: LiquidityHttpTransport;
  readonly now?: Date;
}

export async function fetchCoinalyzeLiquidations(input: CoinalyzeFetchInput): Promise<CoinalyzeLiquidationSummary> {
  const apiKey = input.apiKey?.trim();
  if (!apiKey) {
    return { available: false, symbols: [], totals: null, window: { from: "", to: "", interval: "1hour" }, warnings: [NO_KEY_WARNING] };
  }
  const transport = input.transport ?? defaultLiquidityHttpTransport;
  const now = input.now ?? new Date();
  const warnings: LiquidityWarning[] = [];

  const hourly = await fetchInterval(transport, apiKey, "1hour", now, now.getTime() - 24 * 60 * 60 * 1_000, warnings);
  if (hourly === null) return { available: false, symbols: [], totals: null, window: { from: "", to: "", interval: "1hour" }, warnings };
  const daily = await fetchInterval(transport, apiKey, "1day", now, now.getTime() - 7 * 24 * 60 * 60 * 1_000, warnings);

  const symbols = [...hourly, ...(daily ?? [])];
  const longUsd = symbols.reduce((acc, item) => acc + item.longUsd, 0);
  const shortUsd = symbols.reduce((acc, item) => acc + item.shortUsd, 0);
  const totalUsd = longUsd + shortUsd;
  return {
    // available = the primary 24h (hourly) aggregation succeeded; a failed
    // daily fetch degrades the 7d rows with a warning instead of failing all.
    available: true,
    symbols,
    totals: { longUsd, shortUsd, totalUsd, longSharePct: totalUsd > 0 ? (longUsd / totalUsd) * 100 : null },
    window: { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000).toISOString(), to: now.toISOString(), interval: "1hour" },
    warnings,
  };
}

/** Fetches and aggregates one interval; null on failure (warning added). */
async function fetchInterval(transport: LiquidityHttpTransport, apiKey: string, interval: "1hour" | "1day", to: Date, fromMs: number, warnings: LiquidityWarning[]): Promise<CoinalyzeLiquidationSymbolSummary[] | null> {
  const fromSec = Math.floor(fromMs / 1_000);
  const toSec = Math.floor(to.getTime() / 1_000);
  const url = `${COINALYZE_BASE_URL}/liquidation-history?symbols=${LIQUIDATION_SYMBOLS.join(",")}&interval=${interval}&convert_to_usd=true&from=${fromSec}&to=${toSec}`;
  let result: { status: number; body: unknown };
  try {
    result = await transport({ url, method: "GET", headers: { Accept: "application/json", api_key: apiKey } });
  } catch (error) {
    warnings.push({ code: "coinalyze_fetch_failed", message: `Coinalyze ${interval} fetch failed: ${error instanceof Error ? error.message : String(error)}` });
    return null;
  }
  if (result.status < 200 || result.status >= 300) {
    warnings.push({ code: "coinalyze_fetch_failed", message: `Coinalyze ${interval} returned HTTP ${result.status}` });
    return null;
  }
  if (!isRecord(result.body)) {
    warnings.push({ code: "coinalyze_malformed_response", message: `Coinalyze ${interval} response is not a JSON object` });
    return null;
  }
  const summaries: CoinalyzeLiquidationSymbolSummary[] = [];
  for (const symbol of LIQUIDATION_SYMBOLS) {
    const points = result.body[symbol];
    if (!Array.isArray(points)) continue;
    let longUsd = 0;
    let shortUsd = 0;
    let pointsCount = 0;
    for (const point of points) {
      if (!isRecord(point)) continue;
      const l = typeof point.l === "number" && Number.isFinite(point.l) ? point.l : 0;
      const s = typeof point.s === "number" && Number.isFinite(point.s) ? point.s : 0;
      longUsd += l;
      shortUsd += s;
      pointsCount += 1;
    }
    if (pointsCount === 0) continue;
    const totalUsd = longUsd + shortUsd;
    summaries.push({ symbol, interval, points: pointsCount, longUsd, shortUsd, totalUsd, longSharePct: totalUsd > 0 ? (longUsd / totalUsd) * 100 : null });
  }
  return summaries;
}
