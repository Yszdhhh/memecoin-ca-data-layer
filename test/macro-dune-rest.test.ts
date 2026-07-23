import assert from "node:assert/strict";
import test from "node:test";
import { MacroDuneRest, duneSha256, type DuneHttpTransport } from "../src/infrastructure/dune/macro-dune-rest.js";

const sql = "SELECT DATE '2026-07-20' AS report_day, 12.5 AS dex_volume_usd";
const entry = { blueprintId: "S1_solana_capital_day", queryId: 1001, queryVersion: 3, sqlSha256: duneSha256(sql), columns: ["report_day", "dex_volume_usd"] } as const;

test("runs only an allowlisted saved Dune query and retains aggregate fields only", async () => {
  const requests: Array<{ url: string; method: string; headers: Readonly<Record<string, string>>; body?: string }> = [];
  const responses: Array<{ status: number; body: unknown }> = [
    { status: 200, body: { query_id: 1001, version: 3, query_sql: sql, is_archived: false } },
    { status: 200, body: { execution_id: "execution-1" } },
    { status: 200, body: { query_id: 1001, is_execution_finished: false } },
    { status: 200, body: { query_id: 1001, is_execution_finished: true, state: "QUERY_STATE_COMPLETED", execution_ended_at: "2026-07-22T14:00:01Z", result: { metadata: { column_names: ["report_day", "dex_volume_usd"], row_count: 1, total_row_count: 1 }, rows: [{ report_day: "2026-07-20", dex_volume_usd: 12.5, ignored: "provider-only" }] } } },
  ];
  const transport: DuneHttpTransport = async (request) => { requests.push(request); return responses.shift()!; };
  const dune = new MacroDuneRest({ DUNE_API_KEY: "test-runtime-key" }, transport, async () => undefined, 2, 0);

  const result = await dune.runAggregateQuery(entry);

  assert.equal(result.reportDay, "2026-07-20");
  assert.deepEqual(result.values, { dex_volume_usd: 12.5 });
  assert.match(result.resultSha256, /^[0-9a-f]{64}$/);
  assert.equal(requests.length, 4);
  assert.ok(requests.every((request) => request.headers["X-DUNE-API-KEY"] === "test-runtime-key"));
  assert.equal(requests[1]?.body, "{}");
  assert.equal(requests[0]?.body, undefined);
});

test("fails closed before execution when saved query SQL drifts", async () => {
  let executed = false;
  const dune = new MacroDuneRest({ DUNE_API_KEY: "test-runtime-key" }, async (request) => {
    if (request.method === "POST") executed = true;
    return { status: 200, body: { query_id: 1001, version: 3, query_sql: "SELECT 0", is_archived: false } };
  });

  await assert.rejects(dune.runAggregateQuery(entry), /SQL hash drift/);
  assert.equal(executed, false);
});

test("requires a runtime DUNE_API_KEY without exposing it", async () => {
  const dune = new MacroDuneRest({}, async () => ({ status: 200, body: {} }));
  await assert.rejects(dune.runAggregateQuery(entry), /DUNE_API_KEY is required/);
});

test("sends only the exact allowlisted UTC report_day parameter", async () => {
  const requests: Array<{ body?: string }> = [];
  const responses: Array<{ status: number; body: unknown }> = [
    { status: 200, body: { query_id: 1001, version: 3, query_sql: sql, is_archived: false } },
    { status: 200, body: { execution_id: "execution-parameterized" } },
    { status: 200, body: { query_id: 1001, is_execution_finished: true, state: "QUERY_STATE_COMPLETED", execution_ended_at: "2026-07-22T14:00:01Z", result: { metadata: { column_names: ["report_day", "dex_volume_usd"], row_count: 1, total_row_count: 1 }, rows: [{ report_day: "2026-07-20", dex_volume_usd: 12.5 }] } } },
  ];
  const dune = new MacroDuneRest({ DUNE_API_KEY: "test-runtime-key" }, async (request) => { requests.push(request.body === undefined ? {} : { body: request.body }); return responses.shift()!; }, async () => undefined, 1, 0);

  await dune.runAggregateQuery({ ...entry, queryParameters: { report_day: "2026-07-20" } });

  assert.equal(requests[1]?.body, '{"query_parameters":{"report_day":"2026-07-20"}}');
});

test("rejects an invalid report_day parameter before any Dune request", async () => {
  let called = false;
  const dune = new MacroDuneRest({ DUNE_API_KEY: "test-runtime-key" }, async () => { called = true; return { status: 200, body: {} }; });

  await assert.rejects(dune.runAggregateQuery({ ...entry, queryParameters: { report_day: "2026-07-32" } }), /only a UTC report_day/);
  assert.equal(called, false);
});

test("rejects any parameter other than report_day before any Dune request", async () => {
  let called = false;
  const dune = new MacroDuneRest({ DUNE_API_KEY: "test-runtime-key" }, async () => { called = true; return { status: 200, body: {} }; });

  await assert.rejects(dune.runAggregateQuery({ ...entry, queryParameters: { report_day: "2026-07-20", extra: "no" } as never }), /only a UTC report_day/);
  assert.equal(called, false);
});
