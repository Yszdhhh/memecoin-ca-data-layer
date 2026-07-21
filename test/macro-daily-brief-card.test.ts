import assert from "node:assert/strict";
import test from "node:test";
import { buildMacroDailyBriefCard, hashMacroDailyBriefCard } from "../src/application/macro-daily-brief-card.js";
import type { MacroDailyDynamics } from "../src/application/macro-daily-core-run-service.js";
import type { MacroDailyBrief, MacroProvenance } from "../src/domain/macro-daily.js";

const provenance: MacroProvenance = { source: "dune", queryRef: "dune:query:fixture", queryVersion: "saved:fixture@deadbeef", sourceAsOf: new Date("2026-07-21T00:00:00Z"), computedAt: new Date("2026-07-21T00:01:00Z"), completeness: 1, warnings: [] };

test("builds a compact CardKit payload without inline query provenance", () => {
  const card = buildMacroDailyBriefCard(brief());
  const serialized = JSON.stringify(card);

  assert.equal(card.schema, "2.0");
  assert.match(hashMacroDailyBriefCard(card), /^[0-9a-f]{64}$/);
  assert.equal(card.header.title.content, "每日链上市场简讯 · 2026-07-19");
  assert.match(serialized, /\$5\.28B/);
  assert.match(serialized, /594\.3K/);
  assert.match(serialized, /交易强度：\$2\.5K/);
  assert.match(serialized, /Robinhood（Uniswap v2\/v3\/v4 部分覆盖）/);
  assert.doesNotMatch(serialized, /dune:query:fixture|saved:fixture@deadbeef|2026-07-21T00:00:00/);
});

test("renders Solana day change and seven-day relative level only from a complete baseline", () => {
  const dynamics: MacroDailyDynamics = { global: {}, chain: { "solana:dex_volume_usd": { dayChangePct: 12.5, sevenDayRelativePct: 115, baselineDayCount: 7 } } };
  const serialized = JSON.stringify(buildMacroDailyBriefCard(brief(), dynamics));

  assert.match(serialized, /日变动 \+12\.5%/);
  assert.match(serialized, /7D 水位 115%/);
  assert.doesNotMatch(serialized, /历史积累中/);
});

test("renders history accumulation instead of a synthetic seven-day baseline", () => {
  const dynamics: MacroDailyDynamics = { global: {}, chain: { "solana:dex_volume_usd": { baselineDayCount: 3 } } };
  const serialized = JSON.stringify(buildMacroDailyBriefCard(brief(), dynamics));

  assert.match(serialized, /历史积累中 3\/7/);
  assert.doesNotMatch(serialized, /7D 水位 0%/);
});

test("renders DEX transaction and trade-leg activity without user or buy-sell claims", () => {
  const serialized = JSON.stringify(buildMacroDailyBriefCard(brief()));

  assert.match(serialized, /DEX \u4ea4\u6613\u7b14\u6570\uff1a300\.0K/);
  assert.match(serialized, /DEX \u4ea4\u6613\u817f\u6570\uff1a450\.0K/);
  assert.match(serialized, /\u6bcf\u7b14\u4ea4\u6613\u817f\u6570\uff1a1\.50/);
  assert.doesNotMatch(serialized, /\u4e70\u5165|\u5356\u51fa|\u7528\u6237|\u4e70\u5bb6/);
});

function brief(): MacroDailyBrief {
  const global = (metricName: "dex_volume_usd" | "active_trader_count", value: number, unit: "usd" | "count") => ({ ...provenance, reportDay: "2026-07-19", metricName, subject: "global_evm", value, unit });
  const chain = (chainName: "solana" | "bsc" | "robinhood", metricName: "dex_volume_usd" | "active_trader_count" | "swap_transaction_count" | "trade_leg_count" | "pump_launch_count" | "external_pool_count" | "pancakeswap_pool_created_count", value: number, unit: "usd" | "count", section: "capital" | "supply" | "activity") => ({ ...provenance, reportDay: "2026-07-19", chain: chainName, metricName, value, unit, section, registryVersion: chainName === "robinhood" ? "spellbook:dex_robinhood:uniswap_v2_v3_v4@deadbeef" : "spellbook:fixture@deadbeef", coverageStatus: chainName === "robinhood" ? "partial_coverage" as const : "declared_registry" as const });
  return {
    reportDay: "2026-07-19",
    globalMetrics: [global("dex_volume_usd", 5_279_414_681, "usd"), global("active_trader_count", 594_300, "count")],
    chainReports: [
      { chain: "solana", metrics: [chain("solana", "dex_volume_usd", 1_409_966_498, "usd", "capital"), chain("solana", "active_trader_count", 558_714, "count", "capital"), chain("solana", "swap_transaction_count", 300_000, "count", "activity"), chain("solana", "trade_leg_count", 450_000, "count", "activity"), chain("solana", "pump_launch_count", 81, "count", "supply"), chain("solana", "external_pool_count", 650, "count", "supply")], hourlyProfiles: [] },
      { chain: "bsc", metrics: [chain("bsc", "dex_volume_usd", 3_429_646_660, "usd", "capital"), chain("bsc", "active_trader_count", 281_911, "count", "capital"), chain("bsc", "swap_transaction_count", 20_000, "count", "activity"), chain("bsc", "trade_leg_count", 30_000, "count", "activity"), chain("bsc", "pancakeswap_pool_created_count", 2_572, "count", "supply")], hourlyProfiles: [] },
      { chain: "robinhood", metrics: [chain("robinhood", "dex_volume_usd", 469_972_742, "usd", "capital"), chain("robinhood", "active_trader_count", 139_214, "count", "capital"), chain("robinhood", "swap_transaction_count", 2_000, "count", "activity"), chain("robinhood", "trade_leg_count", 3_000, "count", "activity")], hourlyProfiles: [] },
    ],
  };
}
