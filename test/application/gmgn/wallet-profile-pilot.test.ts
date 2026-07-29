import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  runGmgnWalletProfilePilot,
  EXPECTED_SOL_ADDRESSES_HASH,
  EXPECTED_SOL_LABELS_HASH,
  PILOT_TASK_ID,
} from "../../../src/application/gmgn/wallet-profile-pilot.js";

// Valid 32-byte Base58 Solana public key sample
const VALID_SAMPLE_ADDRESS = "5K3N1vqmdgPNfk79SXJdmdhbR2q5KvcunZiWd6D7iTUT";

test("fails closed with input_manifest_mismatch when input files do not match expected SHA-256 hashes", async () => {
  const tmpInputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-pilot-test-"));
  const tmpOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-pilot-out-"));

  try {
    fs.writeFileSync(path.join(tmpInputDir, "sol_addresses.txt"), "invalid-content", "utf8");
    fs.writeFileSync(path.join(tmpInputDir, "sol_address_labels.json"), "[]", "utf8");

    const result = await runGmgnWalletProfilePilot({
      inputDir: tmpInputDir,
      outputDir: tmpOutputDir,
      skipNetworkCalls: true,
    });

    assert.equal(result.status, "FAIL_CLOSED");
    assert.equal(result.inputHashesMatch, false);
    assert.equal(result.selectedCount, 0);
    assert.equal(result.requestBudgetUsed, 0);
    assert.equal(result.warningCodeCounts["input_manifest_mismatch"], 1);

    const summaryRaw = fs.readFileSync(path.join(tmpOutputDir, "summary.json"), "utf8");
    assert.match(summaryRaw, /input_manifest_mismatch/);
    assert.doesNotMatch(summaryRaw, /API_KEY|PRIVATE_KEY|secret/i);
  } finally {
    fs.rmSync(tmpInputDir, { recursive: true, force: true });
    fs.rmSync(tmpOutputDir, { recursive: true, force: true });
  }
});

test("returns PARK with gmgn_credential_unavailable when credentials are absent", async () => {
  const actualInputDir = "C:\\Users\\10639\\chainfm_out\\sol";
  const tmpOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-pilot-out-"));

  const originalApiKey = process.env.GMGN_API_KEY;
  try {
    delete process.env.GMGN_API_KEY;

    const result = await runGmgnWalletProfilePilot({
      inputDir: actualInputDir,
      outputDir: tmpOutputDir,
    });

    assert.equal(result.status, "PARK");
    assert.equal(result.inputHashesMatch, true);
    assert.equal(result.selectedCount, 20);
    assert.equal(result.requestBudgetUsed, 0);
    assert.equal(result.records.length, 40); // 20 wallets x 2 periods (7d & 30d)

    for (const record of result.records) {
      assert.equal(record.source, "gmgn");
      assert.equal(record.verificationStatus, "unverified");
      assert.equal(record.status, "UNAVAILABLE");
      assert.equal(record.completeness, 0);
      assert.deepEqual(record.warningCodes, ["gmgn_credential_unavailable"]);
      // Confirm missing fields are null, never fake 0
      assert.equal(record.aggregates.periodPnl, null);
      assert.equal(record.aggregates.winRate, null);
      assert.equal(record.aggregates.tradeCount, null);
      assert.equal(record.aggregates.buyCount, null);
      assert.equal(record.aggregates.sellCount, null);
      assert.equal(record.aggregates.lastActiveTimestamp, null);
    }
  } finally {
    if (originalApiKey !== undefined) {
      process.env.GMGN_API_KEY = originalApiKey;
    }
    fs.rmSync(tmpOutputDir, { recursive: true, force: true });
  }
});

test("normalizes 7D / 30D fields correctly and enforces unverified borrowed status", async () => {
  const actualInputDir = "C:\\Users\\10639\\chainfm_out\\sol";
  const tmpOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-pilot-out-"));

  try {
    const result = await runGmgnWalletProfilePilot({
      inputDir: actualInputDir,
      outputDir: tmpOutputDir,
      skipNetworkCalls: true,
    });

    assert.equal(result.inputHashesMatch, true);
    assert.equal(result.selectedCount, 20);
    assert.equal(result.records.length, 40);

    const periods = new Set(result.records.map((r) => r.period));
    assert.deepEqual(Array.from(periods).sort(), ["30d", "7d"]);

    for (const record of result.records) {
      assert.equal(record.source, "gmgn");
      assert.equal(record.verificationStatus, "unverified");
      assert.equal(typeof record.sourceInputFingerprint, "string");
      assert.equal(record.sourceInputFingerprint.length, 64);
      assert.doesNotMatch(record.sourceInputFingerprint, /^5[1-9A-HJ-NP-Za-km-z]{31,43}$/); // Not plaintext address
    }
  } finally {
    fs.rmSync(tmpOutputDir, { recursive: true, force: true });
  }
});

test("does not leak arbitrary provider error text or sensitive keys to result JSON", async () => {
  const actualInputDir = "C:\\Users\\10639\\chainfm_out\\sol";
  const tmpOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-pilot-out-"));

  try {
    const result = await runGmgnWalletProfilePilot({
      inputDir: actualInputDir,
      outputDir: tmpOutputDir,
      skipNetworkCalls: true,
    });

    const jsonText = JSON.stringify(result);
    assert.doesNotMatch(jsonText, /GMGN_API_KEY|GMGN_PRIVATE_KEY|bearer|secret/i);

    // Verify output file on disk is scrubbed
    const outputRaw = fs.readFileSync(path.join(tmpOutputDir, "normalized_wallet_profiles.json"), "utf8");
    assert.doesNotMatch(outputRaw, /GMGN_API_KEY|GMGN_PRIVATE_KEY|bearer|secret/i);
  } finally {
    fs.rmSync(tmpOutputDir, { recursive: true, force: true });
  }
});
