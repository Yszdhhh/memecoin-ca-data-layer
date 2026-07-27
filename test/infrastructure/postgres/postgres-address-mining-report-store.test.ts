import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Pool } from "pg";
import type { DailyMiningReport } from "../../../src/application/growth-loop/daily-toptoken-mining.js";
import { PostgresAddressMiningReportStore } from "../../../src/infrastructure/postgres/postgres-address-mining-report-store.js";

const at = new Date("2026-07-27T00:00:00.000Z");

class QueryCapture {
  readonly calls: Array<{ text: string; values: readonly unknown[] }> = [];

  async query(text: string, values: readonly unknown[] = []): Promise<{ rows: unknown[]; rowCount: number }> {
    this.calls.push({ text, values });
    return { rows: [], rowCount: 1 };
  }
}

function report(overrides: Partial<DailyMiningReport> = {}): DailyMiningReport {
  return {
    ruleVersion: "daily-toptoken-mining-v1",
    window: "daily",
    runAt: at,
    status: "GREEN",
    tokensScanned: 2,
    walletsMined: 3,
    confirmationsAttempted: 2,
    walletsConfirmed: 2,
    walletsPromoted: 1,
    newLabels: { smartMoney: 1, cluster: 0, bot: 0, other: 0 },
    quota: { firstHandWalletBudget: 10, consumed: 2, skippedWallets: [] },
    warnings: [],
    tokenReports: [{
      tokenCa: "MintA",
      borrowedLeads: 3,
      judgedCandidates: 2,
      confirmationsAttempted: 2,
      promotedWallets: ["wallet"],
      warnings: [],
    }],
    ...overrides,
  };
}

test("Postgres mining report store uses an idempotent structured upsert", async () => {
  const capture = new QueryCapture();
  const store = new PostgresAddressMiningReportStore(capture as unknown as Pool);
  await store.save(report());

  assert.equal(capture.calls.length, 1);
  const call = capture.calls[0]!;
  assert.match(call.text, /INSERT INTO address_mining_runs/);
  assert.match(call.text, /ON CONFLICT \(window, run_at, rule_version\) DO UPDATE/);
  assert.deepEqual(call.values.slice(0, 9), [
    "daily", at, "daily-toptoken-mining-v1", "GREEN", 2, 3, 2, 2, 1,
  ]);
  assert.deepEqual(JSON.parse(String(call.values[9])), { smartMoney: 1, cluster: 0, bot: 0, other: 0 });
  assert.deepEqual(JSON.parse(String(call.values[10])), { firstHandWalletBudget: 10, consumed: 2, skippedWallets: [] });
  assert.deepEqual(JSON.parse(String(call.values[12])), [{
    tokenCa: "MintA",
    borrowedLeads: 3,
    judgedCandidates: 2,
    confirmationsAttempted: 2,
    promotedWallets: ["wallet"],
    warnings: [],
  }]);
});

test("Postgres mining report store rejects invalid metrics before SQL", async () => {
  const capture = new QueryCapture();
  const store = new PostgresAddressMiningReportStore(capture as unknown as Pool);

  await assert.rejects(() => store.save(report({ walletsPromoted: -1 })), /walletsPromoted/);
  assert.equal(capture.calls.length, 0);
});

test("mining-run migration is additive, idempotent, and excludes raw payload columns", async () => {
  const sql = await readFile(new URL("../../../db/migrations/010_address_mining_runs.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE address_mining_runs/);
  assert.match(sql, /UNIQUE \(window, run_at, rule_version\)/);
  assert.match(sql, /token_reports jsonb/);
  assert.doesNotMatch(sql, /raw_payload/i);
});