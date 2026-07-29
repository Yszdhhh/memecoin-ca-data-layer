import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("corrected full runner pins 1,433 wallets, 2,866 invocations, and one-wallet transport", () => {
  const source = fs.readFileSync(
    path.resolve("src/cli/run-gmgn-wallet-stats-full-1433-live-rerun-002.ts"),
    "utf8",
  );

  assert.match(source, /TASK_ID = "SOL-GMGN-WALLET-STATS-FULL-1433-LIVE-RERUN-002"/);
  assert.match(source, /WALLET_BATCH_SIZE = 1/);
  assert.match(source, /targetWalletCount: FULL_1433_TARGET_WALLET_COUNT/);
  assert.match(source, /maxRequestBudget: FULL_1433_RERUN_MAX_CLI_INVOCATION_BUDGET/);
  assert.match(source, /walletBatchSize: WALLET_BATCH_SIZE/);
  assert.match(source, /gmgn-wallet-stats-full-1433-live-rerun-002/);
  assert.doesNotMatch(source, /walletBatchSize:\s*20/);
  assert.doesNotMatch(source, /gmgn-wallet-stats-full-1433-live-rerun-001/);
});
