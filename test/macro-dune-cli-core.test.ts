import assert from "node:assert/strict";
import test from "node:test";
import { MacroCoreDuneCli, type DuneCommandExecutor } from "../src/infrastructure/dune/macro-dune-cli.js";

test("creates a private core query and parses only the requested aggregate result fields", async () => {
  const calls: Array<{ command: string; arguments_: readonly string[] }> = [];
  const execute: DuneCommandExecutor = async (command, arguments_) => {
    calls.push({ command, arguments_ });
    if (arguments_[1] === "create") return { stdout: JSON.stringify({ query_id: 901 }) };
    return { stdout: JSON.stringify({ state: "QUERY_STATE_COMPLETED", execution_ended_at: "2026-07-21T06:00:00Z", result: { rows: [{ report_day: "2026-07-19", dex_volume_usd: 12.5, active_trader_count: 8, ignored: "raw" }] } }) };
  };
  const dune = new MacroCoreDuneCli("dune-test", execute);

  const saved = await dune.createPrivateQuery({ blueprintId: "G1_global_evm_dex_day", sql: "SELECT 1", sqlSha256: "a".repeat(64) });
  const result = await dune.runQuery(saved.queryId, ["dex_volume_usd", "active_trader_count"]);

  assert.equal(saved.queryId, 901);
  assert.deepEqual(result.values, { dex_volume_usd: 12.5, active_trader_count: 8 });
  assert.equal(result.reportDay, "2026-07-19");
  assert.match(result.resultSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(calls[0]?.arguments_.slice(0, 4), ["query", "create", "--private", "--name"]);
  assert.deepEqual(calls[1]?.arguments_, ["query", "run", "901", "--output", "json"]);
});

test("fails closed for incomplete core Dune responses", async () => {
  const execute: DuneCommandExecutor = async () => ({ stdout: JSON.stringify({ state: "QUERY_STATE_COMPLETED", execution_ended_at: "2026-07-21T06:00:00Z", result: { rows: [{ report_day: "2026-07-19", dex_volume_usd: null }] } }) });
  const dune = new MacroCoreDuneCli("dune-test", execute);

  await assert.rejects(dune.runQuery(1, ["dex_volume_usd"]), /invalid dex_volume_usd value/);
  await assert.rejects(dune.runQuery(0, ["dex_volume_usd"]), /positive integer/);
});

test("updates an existing private query without creating another saved query", async () => {
  const calls: Array<readonly string[]> = [];
  const execute: DuneCommandExecutor = async (_command, arguments_) => { calls.push(arguments_); return { stdout: "{}" }; };
  const dune = new MacroCoreDuneCli("dune-test", execute);

  await dune.updatePrivateQuery({ queryId: 901, blueprintId: "S1_solana_capital_day", sql: "SELECT 1", sqlSha256: "b".repeat(64) });

  assert.deepEqual(calls[0], ["query", "update", "901", "--name", "Onchain Trench Macro S1_solana_capital_day", "--description", `sha256:${"b".repeat(64)}`, "--private", "--sql", "SELECT 1", "--output", "json"]);
});
