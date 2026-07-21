import assert from "node:assert/strict";
import test from "node:test";
import { MacroDailyCoreRunService, type CoreDuneQueryGateway, type MacroCoreBriefPublisher, type MacroCoreStore } from "../src/application/macro-daily-core-run-service.js";
import { CORE_QUERY_DEFINITIONS, type CoreBlueprintId } from "../src/infrastructure/dune/macro-core-query-definitions.js";

const values: Record<CoreBlueprintId, Record<string, number>> = {
  G1_global_evm_dex_day: { dex_volume_usd: 1000, active_trader_count: 100 },
  G3_btc_fee_usd: { btc_fee_usd: 200 },
  S1_solana_capital_day: { dex_volume_usd: 300, active_trader_count: 30 },
  S2_solana_pump_launch_day: { pump_launch_count: 40 },
  S3_solana_pumpswap_pool_day: { external_pool_count: 50 },
  B1_bsc_capital_day: { dex_volume_usd: 60, active_trader_count: 6 },
  B2_pancake_pool_created_day: { pancakeswap_pool_created_count: 7 },
  R1_robinhood_uni_capital_day: { dex_volume_usd: 8, active_trader_count: 2 },
  S4_solana_trade_activity_day: { swap_transaction_count: 15, trade_leg_count: 30 },
  B3_bsc_trade_activity_day: { swap_transaction_count: 8, trade_leg_count: 16 },
  R2_robinhood_uni_trade_activity_day: { swap_transaction_count: 2, trade_leg_count: 3 },
};

test("collects and persists only the approved core aggregate metrics, while defaulting delivery to dry run", async () => {
  let nextId = 100;
  let saved: Parameters<MacroCoreStore["save"]>[0] | undefined;
  let published: Parameters<MacroCoreBriefPublisher["publish"]>[0] | undefined;
  const dune: CoreDuneQueryGateway = {
    async createPrivateQuery() { return { queryId: nextId++ }; },
    async updatePrivateQuery() { throw new Error("must not update without a registered query"); },
    async runQuery(queryId, columns) {
      const definition = CORE_QUERY_DEFINITIONS[queryId - 100];
      assert.ok(definition);
      assert.deepEqual(columns, definition.metrics.map((metric) => metric.column));
      return { reportDay: "2026-07-19", values: values[definition.blueprintId], sourceAsOf: new Date("2026-07-21T06:00:00Z"), resultSha256: hashFor(queryId) };
    },
  };
  const store: MacroCoreStore = {
    async findQuery() { return null; },
    async findLatestQuery() { return null; },
    async reserveQueryCreation() { return true; },
    async registerQuery() {},
    async load() { return { globalMetrics: [btcObservation()], chainMetrics: [] }; },
    async loadComparableHistory() { return { global: {}, chain: {} }; },
    async save(input) { saved = input; },
  };
  const publisher: MacroCoreBriefPublisher = { async publish(input, dryRun) { published = input; return { deliveryMode: dryRun ? "dry_run" : "lark_card_sent", payloadSha256: payloadHash() }; } };

  const result = await new MacroDailyCoreRunService(dune, store, publisher).run();

  assert.equal(result.deliveryMode, "dry_run");
  assert.equal(saved?.queries.length, 11);
  assert.equal(saved?.globalMetrics.length, 3);
  assert.equal(saved?.chainMetrics.length, 15);
  assert.deepEqual(published?.dynamics.chain["solana:dex_volume_usd"], { baselineDayCount: 0 });
  assert.match(result.markdown, /BTC 链上交易数：769\.5K/);
  assert.match(result.markdown, /Pump 发射数：40/);
  assert.match(result.markdown, /Robinhood（部分覆盖：Uniswap v2\/v3\/v4）/);
  assert.doesNotMatch(result.markdown, /volume_is_leg_sum/);
  assert.match(result.markdown, /完整溯源、查询版本与告警已持久化/);
  assert.doesNotMatch(result.markdown, /Four\.meme|TVL|FDV|买入|卖出|预测/);
});

test("keeps DEX trade activity as separate deduplicated chain-scoped queries", () => {
  const solana = CORE_QUERY_DEFINITIONS.find((definition) => definition.blueprintId === "S4_solana_trade_activity_day")!;
  const bsc = CORE_QUERY_DEFINITIONS.find((definition) => definition.blueprintId === "B3_bsc_trade_activity_day")!;
  const robinhood = CORE_QUERY_DEFINITIONS.find((definition) => definition.blueprintId === "R2_robinhood_uni_trade_activity_day")!;

  assert.match(solana.sql, /SELECT DISTINCT tx_id, outer_instruction_index, inner_instruction_index, tx_index, block_month/);
  assert.match(solana.sql, /COUNT\(DISTINCT tx_id\) AS swap_transaction_count, COUNT\(\*\) AS trade_leg_count/);
  assert.match(bsc.sql, /blockchain = 'bnb'/);
  assert.match(robinhood.sql, /blockchain = 'robinhood' AND project = 'uniswap' AND version IN \('2', '3', '4'\)/);
  assert.equal(robinhood.metrics.every((metric) => metric.scope === "chain" && metric.coverageStatus === "partial_coverage" && metric.warningCodes.includes("uniswap_only")), true);
  assert.equal([...solana.metrics, ...bsc.metrics, ...robinhood.metrics].every((metric) => metric.warningCodes.includes("deduplicated_trade_legs")), true);
});

test("reuses every matching saved query instead of creating duplicate Dune queries", async () => {
  let created = 0;
  let published: Parameters<MacroCoreBriefPublisher["publish"]>[0] | undefined;
  const dune: CoreDuneQueryGateway = {
    async createPrivateQuery() { created++; return { queryId: 1 }; },
    async updatePrivateQuery() { throw new Error("must not update an exact hash match"); },
    async runQuery(queryId, columns) {
      const definition = CORE_QUERY_DEFINITIONS[queryId - 1];
      assert.ok(definition);
      assert.deepEqual(columns, definition.metrics.map((metric) => metric.column));
      return { reportDay: "2026-07-19", values: values[definition.blueprintId], sourceAsOf: new Date("2026-07-21T06:00:00Z"), resultSha256: hashFor(queryId) };
    },
  };
  const queryIds = new Map(CORE_QUERY_DEFINITIONS.map((definition, index) => [definition.blueprintId, index + 1]));
  const store: MacroCoreStore = {
    async findQuery(blueprintId) { return { queryId: queryIds.get(blueprintId)! }; },
    async findLatestQuery() { throw new Error("must not read a prior query for an exact hash match"); },
    async reserveQueryCreation() { throw new Error("must not reserve an exact hash match"); },
    async registerQuery() { throw new Error("must not register a reused query"); },
    async load() { return { globalMetrics: [], chainMetrics: [] }; },
    async loadComparableHistory(input) {
      assert.equal(input.reportDay, "2026-07-19");
      assert.equal(input.chainMetrics.find((metric) => metric.chain === "solana" && metric.metricName === "dex_volume_usd")?.queryVersion.startsWith("saved:S1_solana_capital_day@"), true);
      return {
        global: {},
        chain: {
          "solana:dex_volume_usd": [
            { reportDay: "2026-07-12", value: 1100 },
            { reportDay: "2026-07-13", value: 900 },
            { reportDay: "2026-07-14", value: 700 },
            { reportDay: "2026-07-15", value: 500 },
            { reportDay: "2026-07-16", value: 300 },
            { reportDay: "2026-07-17", value: 100 },
            { reportDay: "2026-07-18", value: 200 },
          ],
        },
      };
    },
    async save() {},
  };
  const publisher: MacroCoreBriefPublisher = { async publish(input) { published = input; return { deliveryMode: "dry_run", payloadSha256: payloadHash() }; } };

  await new MacroDailyCoreRunService(dune, store, publisher).run();
  assert.equal(created, 0);
  assert.deepEqual(published?.dynamics.chain["solana:dex_volume_usd"], { dayChangePct: 50, sevenDayRelativePct: 60, baselineDayCount: 7 });
});

test("rejects inconsistent Dune report days before persistence or delivery", async () => {
  const dune: CoreDuneQueryGateway = {
    async createPrivateQuery(input) { return { queryId: CORE_QUERY_DEFINITIONS.findIndex((definition) => definition.blueprintId === input.blueprintId) + 1 }; },
    async updatePrivateQuery() { throw new Error("must not update without a prior query"); },
    async runQuery(queryId) { const definition = CORE_QUERY_DEFINITIONS[queryId - 1]!; return { reportDay: queryId === 2 ? "2026-07-18" : "2026-07-19", values: values[definition.blueprintId], sourceAsOf: new Date(), resultSha256: hashFor(queryId) }; },
  };
  let saved = false;
  const store: MacroCoreStore = { async findQuery() { return null; }, async findLatestQuery() { return null; }, async reserveQueryCreation() { return true; }, async registerQuery() {}, async load() { return { globalMetrics: [], chainMetrics: [] }; }, async loadComparableHistory() { return { global: {}, chain: {} }; }, async save() { saved = true; } };
  const publisher: MacroCoreBriefPublisher = { async publish() { throw new Error("must not publish"); } };

  await assert.rejects(new MacroDailyCoreRunService(dune, store, publisher).run(), /different report days/);
  assert.equal(saved, false);
});

test("updates prior blueprint queries instead of creating another private query", async () => {
  let created = 0;
  const updated: number[] = [];
  const queryIds = new Map(CORE_QUERY_DEFINITIONS.map((definition, index) => [definition.blueprintId, index + 1]));
  const dune: CoreDuneQueryGateway = {
    async createPrivateQuery() { created++; return { queryId: 99 }; },
    async updatePrivateQuery(input) { updated.push(input.queryId); },
    async runQuery(queryId) { const definition = CORE_QUERY_DEFINITIONS[queryId - 1]!; return { reportDay: "2026-07-19", values: values[definition.blueprintId], sourceAsOf: new Date("2026-07-21T06:00:00Z"), resultSha256: hashFor(queryId) }; },
  };
  const store: MacroCoreStore = {
    async findQuery() { return null; },
    async findLatestQuery(blueprintId) { return { queryId: queryIds.get(blueprintId)! }; },
    async reserveQueryCreation() { throw new Error("must not reserve when a prior query exists"); },
    async registerQuery() {},
    async load() { return { globalMetrics: [], chainMetrics: [] }; },
    async loadComparableHistory() { return { global: {}, chain: {} }; },
    async save() {},
  };
  const publisher: MacroCoreBriefPublisher = { async publish() { return { deliveryMode: "dry_run", payloadSha256: payloadHash() }; } };

  await new MacroDailyCoreRunService(dune, store, publisher).run();
  assert.equal(created, 0);
  assert.deepEqual(updated, CORE_QUERY_DEFINITIONS.map((_definition, index) => index + 1));
});

test("fails closed on an unresolved creation reservation without creating another private query", async () => {
  let created = false;
  const dune: CoreDuneQueryGateway = {
    async createPrivateQuery() { created = true; return { queryId: 1 }; },
    async updatePrivateQuery() { throw new Error("must not update"); },
    async runQuery() { throw new Error("must not run"); },
  };
  const store: MacroCoreStore = {
    async findQuery() { return null; },
    async findLatestQuery() { return null; },
    async reserveQueryCreation() { return false; },
    async registerQuery() { throw new Error("must not register"); },
    async load() { throw new Error("must not load"); },
    async loadComparableHistory() { throw new Error("must not load history"); },
    async save() { throw new Error("must not save"); },
  };
  const publisher: MacroCoreBriefPublisher = { async publish() { throw new Error("must not publish"); } };

  await assert.rejects(new MacroDailyCoreRunService(dune, store, publisher).run(), /pending reconciliation/);
  assert.equal(created, false);
});

function btcObservation() {
  return { reportDay: "2026-07-19", metricName: "btc_transaction_count" as const, subject: "bitcoin", value: 769494, unit: "count" as const, source: "dune" as const, queryRef: "dune:query:8048804", queryVersion: "saved:G2@fixture", sourceAsOf: new Date("2026-07-21T06:00:00Z"), computedAt: new Date("2026-07-21T06:01:00Z"), completeness: 1, warnings: [] };
}

function hashFor(value: number): string {
  return value.toString(16).padStart(64, "0");
}

function payloadHash(): string {
  return "a".repeat(64);
}
