import assert from "node:assert/strict";
import test from "node:test";
import { MacroFeishuTestDelivery } from "../src/application/macro-feishu-delivery.js";
import { MacroLiveSolanaTimeSeriesService, createSolanaDuneAllowlist } from "../src/application/macro-live-timeseries-service.js";
import { LIVE_SOLANA_QUERY_DEFINITIONS } from "../src/infrastructure/dune/macro-core-query-definitions.js";
import type { DuneAggregateQueryResult } from "../src/infrastructure/dune/macro-dune-rest.js";
import type { CoreQueryExecution } from "../src/application/macro-daily-core-run-service.js";

const savedQueries = {
  S1_solana_capital_day: { queryId: 101, queryVersion: 1 },
  S2_solana_pump_launch_day: { queryId: 102, queryVersion: 1 },
  S3_solana_pumpswap_pool_day: { queryId: 103, queryVersion: 1 },
  S4_solana_trade_activity_day: { queryId: 104, queryVersion: 1 },
} as const;

function resultFor(entry: ReturnType<typeof createSolanaDuneAllowlist>[number]): DuneAggregateQueryResult {
  const values = Object.fromEntries(entry.columns.filter((column) => column !== "report_day").map((column, index) => [column, index + 1]));
  return { blueprintId: entry.blueprintId, queryId: entry.queryId, queryVersion: entry.queryVersion, reportDay: "2026-07-20", values, sourceAsOf: new Date("2026-07-22T14:00:01Z"), resultSha256: "a".repeat(64) };
}

test("persists Solana-only aggregate time series after an idempotent test delivery", async () => {
  const allowlist = createSolanaDuneAllowlist(savedQueries, "2026-07-20");
  const saved: Array<{ queries: readonly CoreQueryExecution[]; chainCount: number; deliveryMode: string }> = [];
  const messages: Array<{ chatId: string; text: string; idempotencyKey: string }> = [];
  const service = new MacroLiveSolanaTimeSeriesService({
    dune: { runAggregateQuery: async (entry) => { assert.deepEqual(entry.queryParameters, { report_day: "2026-07-20" }); return resultFor(entry); } },
    store: {
      findQuery: async (blueprintId, sqlSha256) => {
        const found = allowlist.find((entry) => entry.blueprintId === blueprintId && entry.sqlSha256 === sqlSha256);
        return found === undefined ? null : { queryId: found.queryId };
      },
      save: async (input) => { saved.push({ queries: input.queries, chainCount: input.chainMetrics.length, deliveryMode: input.deliveryMode }); },
    },
    delivery: new MacroFeishuTestDelivery("test-chat", async (message) => { messages.push(message); }),
    now: () => new Date("2026-07-22T14:01:00Z"),
  });

  const outcome = await service.run({ reportDay: "2026-07-20", savedQueries, sendTestDelivery: true });

  assert.equal(outcome.manifest.scope, "solana_only");
  assert.equal(outcome.manifest.deliveryMode, "lark_card_sent");
  assert.equal(outcome.metrics.length, 6);
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0], { queries: saved[0]!.queries, chainCount: 6, deliveryMode: "lark_card_sent" });
  assert.equal(messages.length, 1);
  assert.match(messages[0]!.idempotencyKey, /^macro-live:solana:2026-07-20:/);
  assert.match(messages[0]!.text, /not users, buyers, demand, or a trading signal/);
  assert.match(messages[0]!.text, /^\[TEST\]/);
  assert.match(messages[0]!.text, /BSC and Robinhood are not executed/);
});

test("rejects a run before the D+1 14:00 UTC boundary", async () => {
  const service = new MacroLiveSolanaTimeSeriesService({
    dune: { runAggregateQuery: async () => { throw new Error("must not execute"); } },
    store: { findQuery: async () => null, save: async () => undefined },
    delivery: new MacroFeishuTestDelivery("test-chat", async () => undefined),
    now: () => new Date("2026-07-21T13:59:59Z"),
  });
  await assert.rejects(service.run({ reportDay: "2026-07-20", savedQueries }), /D\+1 14:00 UTC/);
});

test("does not permit a missing Solana query registry entry", async () => {
  const service = new MacroLiveSolanaTimeSeriesService({
    dune: { runAggregateQuery: async () => { throw new Error("must not execute"); } },
    store: { findQuery: async () => null, save: async () => undefined },
    delivery: new MacroFeishuTestDelivery("test-chat", async () => undefined),
    now: () => new Date("2026-07-22T14:01:00Z"),
  });
  await assert.rejects(service.run({ reportDay: "2026-07-20", savedQueries }), /registry does not allow S1_solana_capital_day/);
});

test("queries manually without a Feishu send unless test delivery is explicit", async () => {
  const allowlist = createSolanaDuneAllowlist(savedQueries, "2026-07-20");
  let sent = false;
  const service = new MacroLiveSolanaTimeSeriesService({
    dune: { runAggregateQuery: async (entry) => resultFor(entry) },
    store: {
      findQuery: async (blueprintId, sqlSha256) => {
        const found = allowlist.find((entry) => entry.blueprintId === blueprintId && entry.sqlSha256 === sqlSha256);
        return found === undefined ? null : { queryId: found.queryId };
      },
      save: async () => undefined,
    },
    delivery: new MacroFeishuTestDelivery("", async () => { sent = true; }),
    now: () => new Date("2026-07-22T14:01:00Z"),
  });

  const outcome = await service.run({ reportDay: "2026-07-20", savedQueries });

  assert.equal(outcome.manifest.deliveryMode, "dry_run");
  assert.equal(sent, false);
  assert.match(outcome.report, /^\[MANUAL QUERY\]/);
});

test("requires an exact UTC report day when constructing the Solana allowlist", () => {
  assert.throws(() => createSolanaDuneAllowlist(savedQueries, "2026-07-32"), /UTC report day/);
});


test("uses static S1-S4 SQL with the report_day placeholder instead of a relative day", () => {
  assert.equal(LIVE_SOLANA_QUERY_DEFINITIONS.length, 4);
  for (const definition of LIVE_SOLANA_QUERY_DEFINITIONS) {
    assert.match(definition.sql, /\{\{report_day\}\}/);
    assert.doesNotMatch(definition.sql, /CURRENT_DATE/);
  }
});
