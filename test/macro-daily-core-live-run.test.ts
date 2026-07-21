import assert from "node:assert/strict";
import test from "node:test";
import { runMacroDailyCoreLive, type MacroDailyCoreLiveDependencies } from "../src/application/macro-daily-core-live-run.js";
import type { CoreDuneQueryGateway, MacroCoreBriefPublisher, MacroCoreStore } from "../src/application/macro-daily-core-run-service.js";
import { CORE_QUERY_DEFINITIONS, type CoreBlueprintId } from "../src/infrastructure/dune/macro-core-query-definitions.js";
import type { Pool } from "pg";

const values: Record<CoreBlueprintId, Record<string, number>> = {
  G1_global_evm_dex_day: { dex_volume_usd: 1, active_trader_count: 2 },
  G3_btc_fee_usd: { btc_fee_usd: 3 },
  S1_solana_capital_day: { dex_volume_usd: 4, active_trader_count: 5 },
  S2_solana_pump_launch_day: { pump_launch_count: 6 },
  S3_solana_pumpswap_pool_day: { external_pool_count: 7 },
  B1_bsc_capital_day: { dex_volume_usd: 8, active_trader_count: 9 },
  B2_pancake_pool_created_day: { pancakeswap_pool_created_count: 10 },
  R1_robinhood_uni_capital_day: { dex_volume_usd: 11, active_trader_count: 12 },
  S4_solana_trade_activity_day: { swap_transaction_count: 13, trade_leg_count: 14 },
  B3_bsc_trade_activity_day: { swap_transaction_count: 15, trade_leg_count: 16 },
  R2_robinhood_uni_trade_activity_day: { swap_transaction_count: 17, trade_leg_count: 18 },
};

test("runs through injected local dependencies, defaults to dry run, and always closes the pool", async () => {
  let closed = false;
  let publishedDryRun: boolean | undefined;
  const dune: CoreDuneQueryGateway = {
    async createPrivateQuery(input) { return { queryId: CORE_QUERY_DEFINITIONS.findIndex((definition) => definition.blueprintId === input.blueprintId) + 1 }; },
    async updatePrivateQuery() { throw new Error("must not update without a prior query"); },
    async runQuery(queryId) { const definition = CORE_QUERY_DEFINITIONS[queryId - 1]!; return { reportDay: "2026-07-19", values: values[definition.blueprintId], sourceAsOf: new Date("2026-07-21T06:00:00Z"), resultSha256: hashFor(queryId) }; },
  };
  const store: MacroCoreStore = { async findQuery() { return null; }, async findLatestQuery() { return null; }, async reserveQueryCreation() { return true; }, async registerQuery() {}, async load() { return { globalMetrics: [], chainMetrics: [] }; }, async loadComparableHistory() { return { global: {}, chain: {} }; }, async save() {} };
  const publisher: MacroCoreBriefPublisher = { async publish(_input, dryRun) { publishedDryRun = dryRun; return { deliveryMode: dryRun ? "dry_run" : "lark_card_sent", payloadSha256: "b".repeat(64) }; } };
  const dependencies: MacroDailyCoreLiveDependencies = {
    createPool: () => ({ end: async () => { closed = true; } }) as unknown as Pool,
    createDune: () => dune,
    createStore: () => store,
    createPublisher: () => publisher,
  };

  const result = await runMacroDailyCoreLive({ databaseUrl: "postgres://fixture", feishuChatId: "" }, dependencies);

  assert.equal(result.deliveryMode, "dry_run");
  assert.equal(publishedDryRun, true);
  assert.equal(closed, true);
});

test("rejects a missing database URL without opening a pool", async () => {
  let opened = false;
  const dependencies: MacroDailyCoreLiveDependencies = {
    createPool: () => { opened = true; throw new Error("must not open"); },
    createDune: () => { throw new Error("must not create"); },
    createStore: () => { throw new Error("must not create"); },
    createPublisher: () => { throw new Error("must not create"); },
  };

  await assert.rejects(runMacroDailyCoreLive({ databaseUrl: "", feishuChatId: "" }, dependencies), /DATABASE_URL/);
  assert.equal(opened, false);
});

function hashFor(value: number): string {
  return value.toString(16).padStart(64, "0");
}
