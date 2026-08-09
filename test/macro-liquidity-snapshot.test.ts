import assert from "node:assert/strict";
import test from "node:test";
import { buildLiquiditySnapshot } from "../src/application/macro-liquidity-snapshot.js";
import type { LiquidityHttpTransport } from "../src/application/macro-liquidity-defillama.js";

const NOW = new Date("2026-08-09T12:00:00.000Z");

const DEXS_FIXTURE = {
  total24h: 1000,
  total7d: 7000,
  total30d: 30000,
  change_1d: 12.5,
  change_7d: -3.2,
  change_1m: 45.1,
  totalDataChart: [[1, 100], [2, 200], [3, 300], [4, 400], [5, 500], [6, 600], [7, 700], [8, 800]],
  protocols: [
    { name: "PumpSwap", total24h: 400 },
    { name: "pump.fun", total24h: 300 },
    { name: "Raydium", total24h: 200 },
    { name: "Meteora", total24h: 100 },
  ],
};

const FEES_FIXTURE = {
  total24h: 50,
  total7d: 350,
  total30d: 1500,
  change_1d: 5,
  change_7d: -1,
  change_1m: 10,
  totalDataChart: [[1, 5], [2, 10], [3, 15], [4, 20], [5, 25], [6, 30], [7, 35], [8, 40]],
  protocols: [{ name: "PumpSwap", total24h: 20 }, { name: "pump.fun", total24h: 15 }, { name: "Raydium", total24h: 10 }, { name: "Meteora", total24h: 5 }],
};

const TVL_FIXTURE = Array.from({ length: 8 }, (_, index) => ({ date: index + 1, tvl: (index + 1) * 1000 }));

const HOURLY_LIQ_FIXTURE = {
  "BTCUSDT_PERP.A": [{ t: 1000, l: 10, s: 5 }, { t: 1001, l: 20, s: 15 }],
  "ETHUSDT_PERP.A": [{ t: 1000, l: 30, s: 25 }],
  "SOLUSDT_PERP.A": [],
};

const DAILY_LIQ_FIXTURE = {
  "BTCUSDT_PERP.A": [{ t: 1000, l: 100, s: 50 }],
  "ETHUSDT_PERP.A": [{ t: 1000, l: 40, s: 30 }],
  "SOLUSDT_PERP.A": [],
};

function allGoodTransport(): LiquidityHttpTransport {
  return async (request) => {
    if (request.url.includes("/overview/dexs/")) return { status: 200, body: DEXS_FIXTURE };
    if (request.url.includes("/overview/fees/")) return { status: 200, body: FEES_FIXTURE };
    if (request.url.includes("/v2/historicalChainTvl/")) return { status: 200, body: TVL_FIXTURE };
    if (request.url.includes("interval=1hour")) return { status: 200, body: HOURLY_LIQ_FIXTURE };
    if (request.url.includes("interval=1day")) return { status: 200, body: DAILY_LIQ_FIXTURE };
    return { status: 404, body: null };
  };
}

test("builds a complete LiquiditySnapshotV1 from all sources", async () => {
  const snapshot = await buildLiquiditySnapshot({ coinalyzeApiKey: "test-key", transport: allGoodTransport(), now: NOW });

  assert.equal(snapshot.schemaVersion, "liquidity-snapshot-v1");
  assert.equal(snapshot.generatedAt, NOW.toISOString());
  assert.equal(snapshot.metricSets.length, 13);
  assert.equal(snapshot.quality.completeness, 1);
  assert.equal(snapshot.quality.status, "verified");

  const volume24h = snapshot.metricSets.find((row) => row.metric === "dex_volume_usd" && row.window === "24h");
  assert.deepEqual({ value: volume24h?.value, changePct: volume24h?.changePct, percentile: volume24h?.percentile }, { value: 1000, changePct: 12.5, percentile: null });

  const volume7d = snapshot.metricSets.find((row) => row.metric === "dex_volume_usd" && row.window === "7d");
  assert.equal(volume7d?.value, 7000);
  assert.equal(volume7d?.percentile?.rank, 100);
  assert.equal(volume7d?.percentile?.ruleVersion, "liquidity-percentiles-v1");

  const tvl24h = snapshot.metricSets.find((row) => row.metric === "tvl_usd" && row.window === "24h");
  assert.equal(tvl24h?.value, 8000);
  assert.equal(snapshot.metricSets.find((row) => row.metric === "tvl_usd" && row.window === "30d")?.percentile?.windowDays, 30);

  const long24h = snapshot.metricSets.find((row) => row.metric === "long_liquidation_usd" && row.window === "24h");
  assert.equal(long24h?.value, 60); // 30 BTC + 30 ETH hourly longs
  assert.equal(long24h?.source, "coinalyze");
  const short7d = snapshot.metricSets.find((row) => row.metric === "short_liquidation_usd" && row.window === "7d");
  assert.equal(short7d?.value, 80); // 50 BTC + 30 ETH daily shorts

  assert.deepEqual(snapshot.protocolShares.map((share) => share.name), ["PumpSwap", "pump.fun", "Raydium", "Meteora"]);
  assert.equal(snapshot.protocolShares[0]?.share24hPct, 40);

  assert.equal(typeof snapshot.freshness.maxMetricAgeHours === "number" && Number.isFinite(snapshot.freshness.maxMetricAgeHours), true);
  assert.equal(snapshot.sources.length, 2);
  assert.equal(snapshot.sources[0]?.source, "defillama");
  assert.equal(snapshot.sources[0]?.verificationStatus, "verified");
  assert.equal(snapshot.sources[0]?.completeness, 1);
  assert.equal(snapshot.sources[1]?.source, "coinalyze");
  assert.equal(snapshot.sources[1]?.verificationStatus, "verified");
  assert.equal(snapshot.warnings.length, 0);
});

test("without a Coinalyze key the liquidation metrics fail closed with a warning", async () => {
  const snapshot = await buildLiquiditySnapshot({ transport: allGoodTransport(), now: NOW });

  assert.equal(snapshot.metricSets.length, 13);
  const long24h = snapshot.metricSets.find((row) => row.metric === "long_liquidation_usd" && row.window === "24h");
  assert.equal(long24h?.value, null);
  assert.equal(snapshot.metricSets.filter((row) => row.metric.includes("liquidation")).every((row) => row.value === null), true);

  assert.equal(snapshot.quality.completeness, 9 / 13);
  assert.equal(snapshot.quality.status, "degraded");
  const coinalyze = snapshot.sources.find((source) => source.source === "coinalyze");
  assert.equal(coinalyze?.verificationStatus, "unavailable");
  assert.equal(coinalyze?.completeness, 0);
  assert.ok(snapshot.warnings.some((warning) => warning.code === "coinalyze_requires_api_key"));
});

test("when DefiLlama and Coinalyze are both unavailable the snapshot is wholly unavailable", async () => {
  const failingTransport: LiquidityHttpTransport = async () => {
    throw new Error("network down");
  };

  const snapshot = await buildLiquiditySnapshot({ transport: failingTransport, now: NOW });

  assert.equal(snapshot.quality.completeness, 0);
  assert.equal(snapshot.quality.status, "unavailable");
  assert.equal(snapshot.metricSets.every((row) => row.value === null), true);
  assert.equal(snapshot.protocolShares.length, 0);
  const defillama = snapshot.sources.find((source) => source.source === "defillama");
  assert.equal(defillama?.verificationStatus, "unavailable");
  assert.ok(snapshot.warnings.some((warning) => warning.code === "defillama_dex_volume_unavailable"));
  assert.ok(snapshot.warnings.some((warning) => warning.code === "coinalyze_requires_api_key"));
});

test("warnings are deduplicated by code", async () => {
  const transport: LiquidityHttpTransport = async () => {
    throw new Error("network down");
  };

  const snapshot = await buildLiquiditySnapshot({ transport, now: NOW });

  const codes = snapshot.warnings.map((warning) => warning.code);
  assert.equal(new Set(codes).size, codes.length);
});
