import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runGmgnWalletProfilePilot } from "../../../src/application/gmgn/wallet-profile-pilot.js";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(buffer: Buffer): string {
  let value = BigInt("0x" + buffer.toString("hex"));
  let encoded = "";
  while (value > 0n) { encoded = ALPHABET[Number(value % 58n)] + encoded; value /= 58n; }
  for (const byte of buffer) { if (byte === 0) encoded = "1" + encoded; else break; }
  return encoded || "1";
}
const wallets = [1, 2].map((n) => { const buffer = Buffer.alloc(32); buffer.writeUInt32BE(n, 28); return base58(buffer); });

function prepareInput(directory: string): { txt: string; labels: string } {
  const txtContent = wallets.join("\n") + "\n";
  const labelsContent = JSON.stringify(wallets.map((address) => ({ address, labels: ["synthetic"] })));
  fs.writeFileSync(path.join(directory, "sol_addresses.txt"), txtContent);
  fs.writeFileSync(path.join(directory, "sol_address_labels.json"), labelsContent);
  fs.writeFileSync(path.join(directory, "cleaned.jsonl"), wallets.map((address) => JSON.stringify({ address })).join("\n") + "\n");
  return {
    txt: crypto.createHash("sha256").update(txtContent).digest("hex").toUpperCase(),
    labels: crypto.createHash("sha256").update(labelsContent).digest("hex").toUpperCase(),
  };
}

test("bounded two-wallet re-smoke plans four serial one-wallet invocations", async () => {
  const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-two-in-"));
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-two-out-"));
  try {
    const hashes = prepareInput(inputDir);
    const calls: Array<{ wallets: readonly string[]; period: string }> = [];
    const delays: number[] = [];
    const result = await runGmgnWalletProfilePilot({
      taskId: "synthetic-two-wallet-resmoke",
      inputDir,
      outputDir,
      targetWalletCount: 2,
      maxRequestBudget: 4,
      walletBatchSize: 1,
      credentialAvailable: true,
      expectedHashes: { solAddressesTxtHash: hashes.txt, solAddressLabelsJsonHash: hashes.labels },
      sleepFn: async (ms) => { delays.push(ms); },
      mockGmgnStatsRunner: (requestedWallets, period) => {
        calls.push({ wallets: requestedWallets, period });
        return { exitCode: 0, stdout: JSON.stringify({
          wallet: requestedWallets[0], period,
          pnl: 1, realized_profit: 1, realized_profit_pnl: 1,
          trade_count: 2, buy_count: 1, sell_count: 1,
          bought_cost: 3, sold_income: 4, last_active_timestamp: 5,
          pnl_stat: { token_num: 1, winrate: 0.5 },
        }) };
      },
    });
    assert.equal(result.requestBudgetUsed, 4);
    assert.equal(result.records.length, 4);
    assert.equal(result.unavailableCount, 0);
    assert.equal(calls.length, 4);
    assert.ok(calls.every((call) => call.wallets.length === 1));
    assert.deepEqual(calls.map((call) => call.period), ["7d", "7d", "30d", "30d"]);
    assert.deepEqual(delays, [1000, 1000, 1000]);
  } finally {
    fs.rmSync(inputDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test("bounded live runner pins two wallets, four invocations, and one-wallet batch size", () => {
  const source = fs.readFileSync(path.resolve("src/cli/run-gmgn-wallet-stats-single-wallet-transport-7d-30d-live-resmoke.ts"), "utf8");
  assert.match(source, /TARGET_WALLET_COUNT = 2/);
  assert.match(source, /MAX_CLI_INVOCATIONS = 4/);
  assert.match(source, /WALLET_BATCH_SIZE = 1/);
  assert.doesNotMatch(source, /walletBatchSize:\s*20/);
});
