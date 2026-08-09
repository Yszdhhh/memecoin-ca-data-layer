import assert from "node:assert/strict";
import test from "node:test";
import { fetchCoinalyzeLiquidations } from "../src/application/macro-liquidity-coinalyze.js";
import type { LiquidityHttpTransport } from "../src/application/macro-liquidity-defillama.js";

const NOW = new Date("2026-08-09T12:00:00.000Z");

const HOURLY_FIXTURE = {
  "BTCUSDT_PERP.A": [
    { t: 1000, l: 10, s: 5 },
    { t: 1001, l: 20, s: 15 },
  ],
  "ETHUSDT_PERP.A": [{ t: 1000, l: 30, s: 25 }],
  "SOLUSDT_PERP.A": [],
};

const DAILY_FIXTURE = {
  "BTCUSDT_PERP.A": [{ t: 1000, l: 100, s: 50 }],
  "ETHUSDT_PERP.A": [{ t: 1000, l: 40, s: 30 }],
  "SOLUSDT_PERP.A": [],
};

function intervalTransport(hourly: unknown, daily: unknown): { transport: LiquidityHttpTransport; requests: Array<{ url: string; headers: Readonly<Record<string, string>> }> } {
  const requests: Array<{ url: string; headers: Readonly<Record<string, string>> }> = [];
  const transport: LiquidityHttpTransport = async (request) => {
    requests.push({ url: request.url, headers: request.headers });
    const body = request.url.includes("interval=1hour") ? hourly : daily;
    return body === null ? { status: 500, body: null } : { status: 200, body };
  };
  return { transport, requests };
}

test("fails closed without an API key and never calls the transport", async () => {
  let called = false;
  const transport: LiquidityHttpTransport = async () => {
    called = true;
    return { status: 200, body: {} };
  };

  const summary = await fetchCoinalyzeLiquidations({ transport, now: NOW });

  assert.equal(summary.available, false);
  assert.equal(summary.symbols.length, 0);
  assert.equal(summary.totals, null);
  assert.ok(summary.warnings.some((warning) => warning.code === "coinalyze_requires_api_key"));
  assert.equal(called, false);
});

test("with a key, aggregates long/short liquidation USD across symbols and intervals", async () => {
  const { transport, requests } = intervalTransport(HOURLY_FIXTURE, DAILY_FIXTURE);

  const summary = await fetchCoinalyzeLiquidations({ apiKey: "test-key", transport, now: NOW });

  assert.equal(summary.available, true);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => request.headers["api_key"] === "test-key"));
  assert.ok(requests.every((request) => request.url.includes("convert_to_usd=true")));

  const hourly = summary.symbols.filter((item) => item.interval === "1hour");
  assert.equal(hourly.length, 2); // SOL has no points and is skipped
  assert.deepEqual(
    { symbol: hourly[0]?.symbol, longUsd: hourly[0]?.longUsd, shortUsd: hourly[0]?.shortUsd, points: hourly[0]?.points },
    { symbol: "BTCUSDT_PERP.A", longUsd: 30, shortUsd: 20, points: 2 },
  );
  assert.equal(hourly[1]?.symbol, "ETHUSDT_PERP.A");
  assert.equal(hourly[1]?.longUsd, 30);
  assert.equal(hourly[1]?.shortUsd, 25);

  const daily = summary.symbols.filter((item) => item.interval === "1day");
  assert.equal(daily.length, 2);
  assert.equal(daily[0]?.longUsd, 100);
  assert.equal(daily[1]?.longUsd, 40);

  assert.equal(summary.totals?.longUsd, 200); // 30+20 hourly + 100+40 daily
  assert.equal(summary.totals?.shortUsd, 125);
  assert.equal(summary.totals?.totalUsd, 325);
  assert.equal(summary.totals?.longSharePct, (200 / 325) * 100);
  assert.equal(summary.window.to, NOW.toISOString());
});

test("with a key and an HTTP failure, fails closed with a fetch warning", async () => {
  const { transport } = intervalTransport(null, DAILY_FIXTURE);

  const summary = await fetchCoinalyzeLiquidations({ apiKey: "test-key", transport, now: NOW });

  assert.equal(summary.available, false);
  assert.equal(summary.symbols.length, 0);
  assert.ok(summary.warnings.some((warning) => warning.code === "coinalyze_fetch_failed"));
});

test("with a key and a malformed body, fails closed with a malformed warning", async () => {
  const transport: LiquidityHttpTransport = async () => ({ status: 200, body: "not an object" });

  const summary = await fetchCoinalyzeLiquidations({ apiKey: "test-key", transport, now: NOW });

  assert.equal(summary.available, false);
  assert.ok(summary.warnings.some((warning) => warning.code === "coinalyze_malformed_response"));
});

test("hourly success with a failed daily fetch stays available with 24h data and a warning", async () => {
  const { transport } = intervalTransport(HOURLY_FIXTURE, null);

  const summary = await fetchCoinalyzeLiquidations({ apiKey: "test-key", transport, now: NOW });

  assert.equal(summary.available, true);
  assert.equal(summary.symbols.filter((item) => item.interval === "1hour").length, 2);
  assert.equal(summary.symbols.filter((item) => item.interval === "1day").length, 0);
  assert.ok(summary.warnings.some((warning) => warning.code === "coinalyze_fetch_failed"));
});

test("all-liquidations-zero yields a null long-share split, not NaN", async () => {
  const zero = {
    "BTCUSDT_PERP.A": [{ t: 1000, l: 0, s: 0 }],
    "ETHUSDT_PERP.A": [],
    "SOLUSDT_PERP.A": [],
  };
  const { transport } = intervalTransport(zero, zero);

  const summary = await fetchCoinalyzeLiquidations({ apiKey: "test-key", transport, now: NOW });

  assert.equal(summary.available, true);
  assert.equal(summary.totals?.longSharePct, null);
  assert.equal(summary.symbols[0]?.longSharePct, null);
  assert.equal(summary.symbols[0]?.longUsd, 0);
});
