import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import {
  runGmgnWalletProfilePilot,
  PILOT_TASK_ID,
  BATCH_100_TASK_ID,
} from "../../../src/application/gmgn/wallet-profile-pilot.js";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function bufferToBase58(buffer: Buffer): string {
  let num = BigInt("0x" + buffer.toString("hex"));
  if (num === 0n) return "1";
  let encoded = "";
  while (num > 0n) {
    const rem = num % 58n;
    encoded = ALPHABET[Number(rem)] + encoded;
    num = num / 58n;
  }
  for (const byte of buffer) {
    if (byte === 0) encoded = "1" + encoded;
    else break;
  }
  return encoded;
}

// Generate 130 synthetic valid Base58 Solana public key strings (32-byte public keys encoded)
const SYNTHETIC_WALLETS = Array.from({ length: 130 }, (_, i) => {
  const buf = Buffer.alloc(32);
  buf.writeUInt32BE(i + 1, 28);
  return bufferToBase58(buf);
});

function setupSyntheticInputDir(dir: string, walletList = SYNTHETIC_WALLETS): { txtHash: string; jsonHash: string } {
  const txtContent = walletList.join("\n") + "\n";
  const jsonContent = JSON.stringify(
    walletList.map((address) => ({ address, labels: ["synthetic"] }))
  );

  const txtPath = path.join(dir, "sol_addresses.txt");
  const jsonPath = path.join(dir, "sol_address_labels.json");

  fs.writeFileSync(txtPath, txtContent, "utf8");
  fs.writeFileSync(jsonPath, jsonContent, "utf8");

  const txtHash = crypto.createHash("sha256").update(txtContent).digest("hex").toUpperCase();
  const jsonHash = crypto.createHash("sha256").update(jsonContent).digest("hex").toUpperCase();

  const cleanedLines = walletList.map((address) =>
    JSON.stringify({
      address,
      labelPrimary: "synthetic",
      labels: ["synthetic"],
      labelCount: 1,
      source: "chainfm_import",
      inputConfidence: "unverified_user_label",
    })
  );
  fs.writeFileSync(
    path.join(dir, "cleaned.jsonl"),
    cleanedLines.join("\n") + "\n",
    "utf8"
  );

  return { txtHash, jsonHash };
}

test("default pilot behavior: 20 wallets, offset 0, budget 40", async () => {
  const tmpInputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-test-in-"));
  const tmpOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-test-out-"));

  try {
    const { txtHash, jsonHash } = setupSyntheticInputDir(tmpInputDir);

    const runnerCalls: Array<{ wallet: string; period: string }> = [];
    const delays: number[] = [];

    const result = await runGmgnWalletProfilePilot({
      inputDir: tmpInputDir,
      outputDir: tmpOutputDir,
      credentialAvailable: true,
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
      sleepFn: async (ms) => {
        delays.push(ms);
      },
      mockGmgnStatsRunner: (walletAddress, period) => {
        runnerCalls.push({ wallet: walletAddress, period });
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            wallet_address: walletAddress,
            realized_profit: 50.0,
            winrate: 0.75,
          }),
        };
      },
    });

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.taskId, PILOT_TASK_ID);
    assert.equal(result.selectedCount, 20);
    assert.equal(result.records.length, 40); // 20 wallets * 2 periods
    assert.equal(result.requestBudgetUsed, 40);
    assert.equal(runnerCalls.length, 40);
    assert.equal(delays.length, 39); // 39 delays for 40 serial calls
    delays.forEach((d) => assert.ok(d >= 1000, "delay must be >= 1000ms"));
  } finally {
    fs.rmSync(tmpInputDir, { recursive: true, force: true });
    fs.rmSync(tmpOutputDir, { recursive: true, force: true });
  }
});

test("batch-100 configuration: target 100 addresses, offset 20, budget 200, 199 delays >= 1000ms", async () => {
  const tmpInputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-batch-in-"));
  const tmpOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-batch-out-"));

  try {
    const { txtHash, jsonHash } = setupSyntheticInputDir(tmpInputDir);

    const runnerCalls: Array<{ wallet: string; period: string }> = [];
    const delays: number[] = [];

    const result = await runGmgnWalletProfilePilot({
      taskId: BATCH_100_TASK_ID,
      inputDir: tmpInputDir,
      outputDir: tmpOutputDir,
      targetWalletCount: 100,
      offsetWalletCount: 20,
      maxRequestBudget: 200,
      credentialAvailable: true,
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
      sleepFn: async (ms) => {
        delays.push(ms);
      },
      mockGmgnStatsRunner: (walletAddress, period) => {
        runnerCalls.push({ wallet: walletAddress, period });
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            wallet_address: walletAddress,
            realized_profit: 100.0,
            realized_profit_pnl: 0.25,
            buy: 10,
            sell: 5,
            bought_cost: 400.0,
            sold_income: 500.0,
            last_timestamp: 1715000000,
            pnl_stat: { winrate: 66.7, token_num: 8 },
          }),
        };
      },
    });

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.taskId, BATCH_100_TASK_ID);
    assert.equal(result.selectedCount, 100);
    assert.equal(result.records.length, 200);
    assert.equal(result.mappedCount, 200);
    assert.equal(result.requestBudgetUsed, 200);
    assert.equal(runnerCalls.length, 200);
    assert.equal(delays.length, 199);
    for (const d of delays) {
      assert.ok(d >= 1000, `Delay ${d} must be >= 1000ms`);
    }

    // Verify first selected wallet matches SYNTHETIC_WALLETS[20] (21st address)
    const targetAddr = SYNTHETIC_WALLETS[20]!;
    assert.equal(result.records[0]?.sourceInputFingerprint, crypto.createHash("sha256").update(targetAddr).digest("hex"));
  } finally {
    fs.rmSync(tmpInputDir, { recursive: true, force: true });
    fs.rmSync(tmpOutputDir, { recursive: true, force: true });
  }
});

test("zero network requests on hash mismatch", async () => {
  const tmpInputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-test-in-"));
  const tmpOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-test-out-"));

  try {
    setupSyntheticInputDir(tmpInputDir);

    let runnerCalled = false;
    const result = await runGmgnWalletProfilePilot({
      inputDir: tmpInputDir,
      outputDir: tmpOutputDir,
      credentialAvailable: true,
      // Pass expected hashes that do not match the synthetic files
      expectedHashes: {
        solAddressesTxtHash: "0000000000000000000000000000000000000000000000000000000000000000",
        solAddressLabelsJsonHash: "0000000000000000000000000000000000000000000000000000000000000000",
      },
      mockGmgnStatsRunner: () => {
        runnerCalled = true;
        return { exitCode: 0, stdout: "{}" };
      },
    });

    assert.equal(result.status, "FAIL_CLOSED");
    assert.equal(result.inputHashesMatch, false);
    assert.equal(runnerCalled, false);
    assert.equal(result.warningCodeCounts["input_manifest_mismatch"], 1);
  } finally {
    fs.rmSync(tmpInputDir, { recursive: true, force: true });
    fs.rmSync(tmpOutputDir, { recursive: true, force: true });
  }
});

test("credentials unavailable returns PARK without mutating process.env", async () => {
  const tmpInputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-test-in-"));
  const tmpOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-test-out-"));

  try {
    const { txtHash, jsonHash } = setupSyntheticInputDir(tmpInputDir);

    const apiKeyBefore = process.env.GMGN_API_KEY;
    const privateKeyBefore = process.env.GMGN_PRIVATE_KEY;

    const result = await runGmgnWalletProfilePilot({
      inputDir: tmpInputDir,
      outputDir: tmpOutputDir,
      credentialAvailable: false,
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
    });

    assert.equal(result.status, "PARK");
    assert.equal(result.requestBudgetUsed, 0);
    assert.equal(result.warningCodeCounts["gmgn_credential_unavailable"], 1);

    // Verify process.env GMGN keys were not mutated
    assert.equal(process.env.GMGN_API_KEY, apiKeyBefore);
    assert.equal(process.env.GMGN_PRIVATE_KEY, privateKeyBefore);
  } finally {
    fs.rmSync(tmpInputDir, { recursive: true, force: true });
    fs.rmSync(tmpOutputDir, { recursive: true, force: true });
  }
});

test("missing numeric metrics remain null and incomplete, never fake 0", async () => {
  const tmpInputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-test-in-"));
  const tmpOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-test-out-"));

  try {
    const { txtHash, jsonHash } = setupSyntheticInputDir(tmpInputDir);

    const result = await runGmgnWalletProfilePilot({
      inputDir: tmpInputDir,
      outputDir: tmpOutputDir,
      credentialAvailable: true,
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
      mockGmgnStatsRunner: (walletAddress) => ({
        exitCode: 0,
        stdout: JSON.stringify({
          wallet_address: walletAddress,
          winrate: 66.7,
          // All other fields missing!
        }),
      }),
    });

    assert.equal(result.status, "SUCCESS");
    assert.ok(result.records.length > 0);

    const record = result.records[0];
    assert.ok(record);
    assert.equal(record.aggregates.winRate, 66.7);
    assert.equal(record.aggregates.periodPnl, null);
    assert.equal(record.aggregates.realizedProfit, null);
    assert.equal(record.aggregates.buyCount, null);
    assert.equal(record.aggregates.sellCount, null);
    assert.equal(record.aggregates.boughtCost, null);
    assert.equal(record.aggregates.soldIncome, null);
  } finally {
    fs.rmSync(tmpInputDir, { recursive: true, force: true });
    fs.rmSync(tmpOutputDir, { recursive: true, force: true });
  }
});

test("insufficient or invalid target address count fails closed", async () => {
  const tmpInputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-test-in-"));
  const tmpOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-test-out-"));

  try {
    // Only 10 synthetic wallets provided, but target is 20
    const shortWallets = SYNTHETIC_WALLETS.slice(0, 10);
    const { txtHash, jsonHash } = setupSyntheticInputDir(tmpInputDir, shortWallets);

    const result = await runGmgnWalletProfilePilot({
      inputDir: tmpInputDir,
      outputDir: tmpOutputDir,
      targetWalletCount: 20,
      credentialAvailable: true,
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
    });

    assert.equal(result.status, "FAIL_CLOSED");
    assert.equal(result.warningCodeCounts["gmgn_wallet_input_invalid"], 1);
  } finally {
    fs.rmSync(tmpInputDir, { recursive: true, force: true });
    fs.rmSync(tmpOutputDir, { recursive: true, force: true });
  }
});
