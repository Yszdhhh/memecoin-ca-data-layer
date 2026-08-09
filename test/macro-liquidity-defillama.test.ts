import assert from "node:assert/strict";
import test from "node:test";
import { fetchDefiLlamaLiquidity, type LiquidityHttpTransport } from "../src/application/macro-liquidity-defillama.js";

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
  protocols: [
    { name: "PumpSwap", total24h: 20 },
    { name: "pump.fun", total24h: 15 },
    { name: "Raydium", total24h: 10 },
    { name: "Meteora", total24h: 5 },
  ],
};

const TVL_FIXTURE = Array.from({ length: 8 }, (_, index) => ({ date: index + 1, tvl: (index + 1) * 1000 }));

function routingTransport(routes: Array<{ match: string; body: unknown; status?: number }>): { transport: LiquidityHttpTransport; requests: string[] } {
  const requests: string[] = [];
  const transport: LiquidityHttpTransport = async (request) => {
    requests.push(request.url);
    const route = routes.find((entry) => request.url.includes(entry.match));
    return route === undefined ? { status: 404, body: null } : { status: route.status ?? 200, body: route.body };
  };
  return { transport, requests };
}

test("parses dexs volume overview with 24h/7d/30d totals, changes, protocol shares and percentiles", async () => {
  const { transport, requests } = routingTransport([
    { match: "/overview/dexs/", body: DEXS_FIXTURE },
    { match: "/overview/fees/", body: FEES_FIXTURE },
    { match: "/v2/historicalChainTvl/", body: TVL_FIXTURE },
  ]);

  const snapshot = await fetchDefiLlamaLiquidity({ transport });

  assert.equal(requests.length, 3);
  const volume = snapshot.volume;
  assert.ok(volume !== null);
  assert.equal(volume.kind, "dex_volume");
  assert.equal(volume.total24h, 1000);
  assert.equal(volume.total7d, 7000);
  assert.equal(volume.total30d, 30000);
  assert.equal(volume.change1dPct, 12.5);
  assert.equal(volume.change7dPct, -3.2);
  assert.equal(volume.change1mPct, 45.1);

  assert.deepEqual(volume.protocolShares.map((share) => `${share.name}:${share.share24hPct}`), ["PumpSwap:40", "pump.fun:30", "Raydium:20", "Meteora:10"]);
  assert.equal(volume.protocolShares[0]?.volume24hUsd, 400);

  const percentile7d = volume.percentiles["7d"];
  assert.ok(percentile7d !== null);
  assert.deepEqual(
    { windowDays: percentile7d.windowDays, current: percentile7d.current, p25: percentile7d.p25, p50: percentile7d.p50, p75: percentile7d.p75, rank: percentile7d.rank, zScore: percentile7d.zScore, sampleCount: percentile7d.sampleCount },
    { windowDays: 7, current: 800, p25: 200, p50: 400, p75: 600, rank: 100, zScore: 2, sampleCount: 7 },
  );
  assert.equal(volume.percentiles["30d"]?.windowDays, 30);
  assert.equal(volume.percentiles["30d"]?.rank, 100);
});

test("parses fees overview and chain TVL", async () => {
  const { transport } = routingTransport([
    { match: "/overview/dexs/", body: DEXS_FIXTURE },
    { match: "/overview/fees/", body: FEES_FIXTURE },
    { match: "/v2/historicalChainTvl/", body: TVL_FIXTURE },
  ]);

  const snapshot = await fetchDefiLlamaLiquidity({ transport });

  assert.equal(snapshot.fees?.kind, "protocol_fees");
  assert.equal(snapshot.fees?.total24h, 50);
  assert.equal(snapshot.fees?.change1dPct, 5);
  assert.equal(snapshot.fees?.protocolShares[0]?.share24hPct, 40);

  assert.equal(snapshot.tvl?.tvl, 8000);
  assert.equal(snapshot.tvl?.percentiles["7d"]?.rank, 100);
  assert.equal(snapshot.tvl?.percentiles["7d"]?.p50, 4000);
  assert.equal(snapshot.warnings.length, 0);
});

test("degrades a single endpoint to null with a warning without failing the rest", async () => {
  const { transport } = routingTransport([
    { match: "/overview/dexs/", body: null, status: 500 },
    { match: "/overview/fees/", body: FEES_FIXTURE },
    { match: "/v2/historicalChainTvl/", body: TVL_FIXTURE },
  ]);

  const snapshot = await fetchDefiLlamaLiquidity({ transport });

  assert.equal(snapshot.volume, null);
  assert.equal(snapshot.fees?.total24h, 50);
  assert.equal(snapshot.tvl?.tvl, 8000);
  assert.ok(snapshot.warnings.some((warning) => warning.code === "defillama_dex_volume_unavailable"));
});

test("transport rejection degrades every endpoint with warnings instead of throwing", async () => {
  const transport: LiquidityHttpTransport = async () => {
    throw new Error("network down");
  };

  const snapshot = await fetchDefiLlamaLiquidity({ transport });

  assert.equal(snapshot.volume, null);
  assert.equal(snapshot.fees, null);
  assert.equal(snapshot.tvl, null);
  assert.deepEqual(snapshot.warnings.map((warning) => warning.code).sort(), ["defillama_dex_volume_unavailable", "defillama_fees_unavailable", "defillama_tvl_unavailable"]);
});

test("malformed dexs body yields null observation with a malformed warning", async () => {
  const { transport } = routingTransport([
    { match: "/overview/dexs/", body: "not an object" },
    { match: "/overview/fees/", body: FEES_FIXTURE },
    { match: "/v2/historicalChainTvl/", body: TVL_FIXTURE },
  ]);

  const snapshot = await fetchDefiLlamaLiquidity({ transport });

  assert.equal(snapshot.volume, null);
  assert.ok(snapshot.warnings.some((warning) => warning.code === "defillama_dex_volume_malformed"));
  assert.equal(snapshot.fees?.total24h, 50);
});

test("missing protocols and breakdown produce empty shares with an explicit warning", async () => {
  const { transport } = routingTransport([
    { match: "/overview/dexs/", body: { ...DEXS_FIXTURE, protocols: undefined, totalDataChartBreakdown: undefined } },
    { match: "/overview/fees/", body: FEES_FIXTURE },
    { match: "/v2/historicalChainTvl/", body: TVL_FIXTURE },
  ]);

  const snapshot = await fetchDefiLlamaLiquidity({ transport });

  assert.deepEqual(snapshot.volume?.protocolShares, []);
  assert.ok(snapshot.warnings.some((warning) => warning.code === "defillama_dex_volume_protocol_breakdown_missing"));
  assert.equal(snapshot.volume?.total24h, 1000);
});

test("legacy protocols entries using `volume` instead of total24h still parse", async () => {
  const legacyProtocols = DEXS_FIXTURE.protocols.map(({ total24h, ...rest }) => ({ volume: total24h, ...rest }));
  const { transport } = routingTransport([
    { match: "/overview/dexs/", body: { ...DEXS_FIXTURE, protocols: legacyProtocols } },
    { match: "/overview/fees/", body: FEES_FIXTURE },
    { match: "/v2/historicalChainTvl/", body: TVL_FIXTURE },
  ]);

  const snapshot = await fetchDefiLlamaLiquidity({ transport });

  assert.equal(snapshot.volume?.protocolShares[0]?.name, "PumpSwap");
  assert.equal(snapshot.volume?.protocolShares[0]?.share24hPct, 40);
});

test("new totalDataChartBreakdown array shape serves as the shares fallback", async () => {
  const breakdown = [
    [1, { Synthetify: 3 }],
    [8, { PumpSwap: 400, "pump.fun": 300, Raydium: 200, Meteora: 100 }],
  ];
  const { transport } = routingTransport([
    { match: "/overview/dexs/", body: { ...DEXS_FIXTURE, protocols: undefined, totalDataChartBreakdown: breakdown } },
    { match: "/overview/fees/", body: FEES_FIXTURE },
    { match: "/v2/historicalChainTvl/", body: TVL_FIXTURE },
  ]);

  const snapshot = await fetchDefiLlamaLiquidity({ transport });

  assert.deepEqual(snapshot.volume?.protocolShares.map((share) => `${share.name}:${share.share24hPct}`), ["PumpSwap:40", "pump.fun:30", "Raydium:20", "Meteora:10"]);
  assert.equal(snapshot.volume?.protocolShares[0]?.volume24hUsd, 400);
});

test("chart with fewer than two points yields null percentiles but a live observation", async () => {
  const { transport } = routingTransport([
    { match: "/overview/dexs/", body: { ...DEXS_FIXTURE, totalDataChart: [[1, 100], [2, 200]] } },
    { match: "/overview/fees/", body: FEES_FIXTURE },
    { match: "/v2/historicalChainTvl/", body: TVL_FIXTURE },
  ]);

  const snapshot = await fetchDefiLlamaLiquidity({ transport });

  assert.equal(snapshot.volume?.total24h, 1000);
  assert.equal(snapshot.volume?.percentiles["7d"], null);
  assert.equal(snapshot.volume?.percentiles["30d"], null);
});

test("malformed TVL response (no usable points) degrades with a warning", async () => {
  const { transport } = routingTransport([
    { match: "/overview/dexs/", body: DEXS_FIXTURE },
    { match: "/overview/fees/", body: FEES_FIXTURE },
    { match: "/v2/historicalChainTvl/", body: [{ date: "nope", tvl: 1 }] },
  ]);

  const snapshot = await fetchDefiLlamaLiquidity({ transport });

  assert.equal(snapshot.tvl, null);
  assert.ok(snapshot.warnings.some((warning) => warning.code === "defillama_tvl_malformed"));
});
