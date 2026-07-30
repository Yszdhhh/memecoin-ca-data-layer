import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { test } from "node:test";

import { createHash } from "node:crypto";

import {
  runWalletStatsParserV2Resmoke,
  EXPECTED_SOL_ADDRESSES_HASH,
  EXPECTED_SOL_LABELS_HASH,
  type SmokeExecutionResult,
} from "../../../src/application/gmgn/wallet-stats-parser-v2-7d-30d-live-resmoke.js";
import type { GmgnCliInvocation, GmgnCliIsolation } from "../../../src/application/gmgn/gmgn-cli-boundary.js";

function createMockIsolation(): GmgnCliIsolation {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resmoke-test-"));
  return {
    home: tmpDir,
    cwd: tmpDir,
    cleanup: () => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

// Target address: 32-char valid Base58 Solana address (32 zero bytes)
const DUMMY_SOL_ADDRESS = "11111111111111111111111111111111";

function createMockBytes() {
  const txtBytes = Buffer.from(`${DUMMY_SOL_ADDRESS}\n`, "utf8");
  const jsonBytes = Buffer.from(JSON.stringify({ [DUMMY_SOL_ADDRESS]: "test_label" }), "utf8");
  const txtHash = createHash("sha256").update(txtBytes).digest("hex").toUpperCase();
  const jsonHash = createHash("sha256").update(jsonBytes).digest("hex").toUpperCase();
  return { txtBytes, jsonBytes, txtHash, jsonHash };
}

const mockPayloadFull7d = {
  wallet: DUMMY_SOL_ADDRESS,
  period: "7d",
  pnl_7d: 150.5,
  realized_profit_7d: 200.0,
  realized_profit_pnl_7d: 0.8,
  win_rate_percent: 75.0,
  trade_count_7d: 20,
  buy_count_7d: 12,
  sell_count_7d: 8,
  bought_cost_7d: 1000.0,
  soldIncome_7d: 1200.0,
  last_active_timestamp: 1700000000,
  token_num_7d: 5,
};

const mockPayloadPartial7d = {
  wallet: DUMMY_SOL_ADDRESS,
  period: "7d",
  pnl_7d: 150.5,
  trade_count_7d: 20,
};

const mockPayloadPartial30d = {
  wallet: DUMMY_SOL_ADDRESS,
  period: "30d",
  pnl_30d: 500.0,
  trade_count_30d: 50,
};

test("1. Hash mismatch -> 0 CLI invocations", async () => {
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "resmoke-out-"));
  let executionCount = 0;
  try {
    const result = await runWalletStatsParserV2Resmoke({
      inputDir: "/dummy",
      outputDir: tmpOut,
      expectedHashes: {
        solAddressesTxtHash: EXPECTED_SOL_ADDRESSES_HASH,
        solAddressLabelsJsonHash: EXPECTED_SOL_LABELS_HASH,
      },
      dependencies: {
        readFileBytes: async () => Buffer.from("wrong content"),
        createIsolation: createMockIsolation,
        execute: async () => {
          executionCount++;
          return { exitCode: 0, stdout: "{}", stderr: "" };
        },
      },
    });

    assert.equal(result.status, "FAIL_CLOSED");
    assert.equal(executionCount, 0);
    assert.equal(result.cliInvocationBudgetUsed, 0);
    assert.equal(result.inputHashesMatch, false);
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});

test("2. API Key missing -> PARK and 0 CLI invocations", async () => {
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "resmoke-out-"));
  const { txtBytes, jsonBytes, txtHash, jsonHash } = createMockBytes();
  let executionCount = 0;

  try {
    const result = await runWalletStatsParserV2Resmoke({
      inputDir: "/dummy",
      outputDir: tmpOut,
      runtimeEnvironment: {}, // empty env, no GMGN_API_KEY
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
      dependencies: {
        readFileBytes: async (filePath) => (filePath.endsWith("sol_addresses.txt") ? txtBytes : jsonBytes),
        createIsolation: createMockIsolation,
        execute: async () => {
          executionCount++;
          return { exitCode: 0, stdout: "{}", stderr: "" };
        },
      },
    });

    assert.equal(result.status, "PARK");
    assert.equal(executionCount, 0);
    assert.equal(result.cliInvocationBudgetUsed, 0);
    assert.equal(result.credentialApiKeyPresent, false);
    assert.equal(result.stats7d.diagnosticCode, "gmgn_credentials_missing");
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});

test("3. 7d and 30d each 1 time, total 2 invocations", async () => {
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "resmoke-out-"));
  const { txtBytes, jsonBytes, txtHash, jsonHash } = createMockBytes();
  const periodsCalled: string[] = [];

  try {
    const result = await runWalletStatsParserV2Resmoke({
      inputDir: "/dummy",
      outputDir: tmpOut,
      runtimeEnvironment: { GMGN_API_KEY: "mock_key" },
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
      dependencies: {
        readFileBytes: async (filePath) => (filePath.endsWith("sol_addresses.txt") ? txtBytes : jsonBytes),
        createIsolation: createMockIsolation,
        execute: async (inv) => {
          const pIdx = inv.args.indexOf("--period");
          if (pIdx !== -1 && inv.args[pIdx + 1]) {
            periodsCalled.push(inv.args[pIdx + 1]!);
          }
          const is7d = inv.args.includes("7d");
          const stdout = JSON.stringify(is7d ? mockPayloadPartial7d : mockPayloadPartial30d);
          return { exitCode: 0, stdout, stderr: "" };
        },
        delay: async () => {},
      },
    });

    assert.deepEqual(periodsCalled, ["7d", "30d"]);
    assert.equal(result.cliInvocationBudgetUsed, 2);
    assert.equal(result.physicalProviderRequestUpperBound, 2);
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});

test("4. Strict serial execution with at least 1,000ms delay", async () => {
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "resmoke-out-"));
  const { txtBytes, jsonBytes, txtHash, jsonHash } = createMockBytes();
  let delayPassedMs = 0;

  try {
    await runWalletStatsParserV2Resmoke({
      inputDir: "/dummy",
      outputDir: tmpOut,
      runtimeEnvironment: { GMGN_API_KEY: "mock_key" },
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
      dependencies: {
        readFileBytes: async (filePath) => (filePath.endsWith("sol_addresses.txt") ? txtBytes : jsonBytes),
        createIsolation: createMockIsolation,
        execute: async (inv) => {
          const is7d = inv.args.includes("7d");
          return { exitCode: 0, stdout: JSON.stringify(is7d ? mockPayloadPartial7d : mockPayloadPartial30d), stderr: "" };
        },
        delay: async (ms) => {
          delayPassedMs += ms;
        },
      },
    });

    assert.ok(delayPassedMs >= 1000, `Expected delay >= 1000ms, got ${delayPassedMs}`);
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});

test("5 & 6. 7d PARTIAL and 30d PARTIAL correctly propagated", async () => {
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "resmoke-out-"));
  const { txtBytes, jsonBytes, txtHash, jsonHash } = createMockBytes();

  try {
    const result = await runWalletStatsParserV2Resmoke({
      inputDir: "/dummy",
      outputDir: tmpOut,
      runtimeEnvironment: { GMGN_API_KEY: "mock_key" },
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
      dependencies: {
        readFileBytes: async (filePath) => (filePath.endsWith("sol_addresses.txt") ? txtBytes : jsonBytes),
        createIsolation: createMockIsolation,
        execute: async (inv) => {
          const is7d = inv.args.includes("7d");
          return { exitCode: 0, stdout: JSON.stringify(is7d ? mockPayloadPartial7d : mockPayloadPartial30d), stderr: "" };
        },
        delay: async () => {},
      },
    });

    assert.equal(result.stats7d.status, "PARTIAL");
    assert.ok(result.stats7d.completeness > 0 && result.stats7d.completeness < 1);
    assert.equal(result.stats30d.status, "PARTIAL");
    assert.ok(result.stats30d.completeness > 0 && result.stats30d.completeness < 1);
    assert.equal(result.status, "PARTIAL");
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});

test("7. SUCCESS not artificially forged when metrics are partial", async () => {
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "resmoke-out-"));
  const { txtBytes, jsonBytes, txtHash, jsonHash } = createMockBytes();

  try {
    const result = await runWalletStatsParserV2Resmoke({
      inputDir: "/dummy",
      outputDir: tmpOut,
      runtimeEnvironment: { GMGN_API_KEY: "mock_key" },
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
      dependencies: {
        readFileBytes: async (filePath) => (filePath.endsWith("sol_addresses.txt") ? txtBytes : jsonBytes),
        createIsolation: createMockIsolation,
        execute: async (inv) => {
          const is7d = inv.args.includes("7d");
          return { exitCode: 0, stdout: JSON.stringify(is7d ? mockPayloadPartial7d : mockPayloadPartial30d), stderr: "" };
        },
        delay: async () => {},
      },
    });

    assert.notEqual(result.stats7d.status, "SUCCESS");
    assert.notEqual(result.stats30d.status, "SUCCESS");
    assert.notEqual(result.status, "SUCCESS");
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});

test("8. UNAVAILABLE safe diagnostics when CLI fails or returns invalid response", async () => {
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "resmoke-out-"));
  const { txtBytes, jsonBytes, txtHash, jsonHash } = createMockBytes();

  try {
    const result = await runWalletStatsParserV2Resmoke({
      inputDir: "/dummy",
      outputDir: tmpOut,
      runtimeEnvironment: { GMGN_API_KEY: "mock_key" },
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
      dependencies: {
        readFileBytes: async (filePath) => (filePath.endsWith("sol_addresses.txt") ? txtBytes : jsonBytes),
        createIsolation: createMockIsolation,
        execute: async () => {
          return { exitCode: null, stdout: "", stderr: "Connection timeout", timedOut: true };
        },
        delay: async () => {},
      },
    });

    assert.equal(result.stats7d.status, "UNAVAILABLE");
    assert.equal(result.stats30d.status, "UNAVAILABLE");
    assert.equal(result.status, "UNAVAILABLE");
    assert.equal(result.stats7d.diagnosticCode, "gmgn_cli_timeout");
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});

test("9. Two periods do not cross-consume fields", async () => {
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "resmoke-out-"));
  const { txtBytes, jsonBytes, txtHash, jsonHash } = createMockBytes();

  try {
    const result = await runWalletStatsParserV2Resmoke({
      inputDir: "/dummy",
      outputDir: tmpOut,
      runtimeEnvironment: { GMGN_API_KEY: "mock_key" },
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
      dependencies: {
        readFileBytes: async (filePath) => (filePath.endsWith("sol_addresses.txt") ? txtBytes : jsonBytes),
        createIsolation: createMockIsolation,
        execute: async (inv) => {
          const is7d = inv.args.includes("7d");
          // Returning 30d payload to 7d request -> should result in period mismatch / UNAVAILABLE
          return { exitCode: 0, stdout: JSON.stringify(is7d ? mockPayloadPartial30d : mockPayloadPartial7d), stderr: "" };
        },
        delay: async () => {},
      },
    });

    assert.equal(result.stats7d.status, "UNAVAILABLE");
    assert.equal(result.stats30d.status, "UNAVAILABLE");
    assert.ok(result.stats7d.diagnosticCode === "gmgn_wallet_stats_period_mismatch" || result.stats7d.diagnosticCode === "gmgn_expected_metrics_unavailable");
    assert.ok(result.stats30d.diagnosticCode === "gmgn_wallet_stats_period_mismatch" || result.stats30d.diagnosticCode === "gmgn_expected_metrics_unavailable");
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});

test("10. Does not forward GMGN_PRIVATE_KEY to sub-process environment", async () => {
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "resmoke-out-"));
  const { txtBytes, jsonBytes, txtHash, jsonHash } = createMockBytes();
  let capturedEnv: NodeJS.ProcessEnv | undefined;

  try {
    await runWalletStatsParserV2Resmoke({
      inputDir: "/dummy",
      outputDir: tmpOut,
      runtimeEnvironment: { GMGN_API_KEY: "mock_key", GMGN_PRIVATE_KEY: "secret_private_key" },
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
      dependencies: {
        readFileBytes: async (filePath) => (filePath.endsWith("sol_addresses.txt") ? txtBytes : jsonBytes),
        createIsolation: createMockIsolation,
        execute: async (inv) => {
          capturedEnv = inv.env;
          return { exitCode: 0, stdout: JSON.stringify(mockPayloadPartial7d), stderr: "" };
        },
        delay: async () => {},
      },
    });

    assert.ok(capturedEnv);
    assert.equal(capturedEnv.GMGN_PRIVATE_KEY, undefined);
    assert.equal(capturedEnv.GMGN_API_KEY, "mock_key");
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});

test("11. External outputs do not contain plaintext address or raw payload", async () => {
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "resmoke-out-"));
  const { txtBytes, jsonBytes, txtHash, jsonHash } = createMockBytes();

  try {
    const result = await runWalletStatsParserV2Resmoke({
      inputDir: "/dummy",
      outputDir: tmpOut,
      runtimeEnvironment: { GMGN_API_KEY: "mock_key" },
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
      dependencies: {
        readFileBytes: async (filePath) => (filePath.endsWith("sol_addresses.txt") ? txtBytes : jsonBytes),
        createIsolation: createMockIsolation,
        execute: async (inv) => {
          const is7d = inv.args.includes("7d");
          return { exitCode: 0, stdout: JSON.stringify(is7d ? mockPayloadPartial7d : mockPayloadPartial30d), stderr: "" };
        },
        delay: async () => {},
      },
    });

    const fileContent7d = fs.readFileSync(result.outputFiles.stats7dJson, "utf8");
    const fileContent30d = fs.readFileSync(result.outputFiles.stats30dJson, "utf8");
    const fileContentSummary = fs.readFileSync(result.outputFiles.summaryJson, "utf8");

    assert.equal(fileContent7d.includes(DUMMY_SOL_ADDRESS), false);
    assert.equal(fileContent30d.includes(DUMMY_SOL_ADDRESS), false);
    assert.equal(fileContentSummary.includes(DUMMY_SOL_ADDRESS), false);

    assert.equal(fileContent7d.includes("mock_key"), false);
    assert.equal(fileContent30d.includes("mock_key"), false);
    assert.equal(fileContentSummary.includes("mock_key"), false);

    assert.equal(fileContent7d.includes("stdout"), false);
    assert.equal(fileContent30d.includes("stdout"), false);
    assert.equal(fileContentSummary.includes("stdout"), false);
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});

test("12. Request budget cannot exceed 2 CLI invocations", async () => {
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "resmoke-out-"));
  const { txtBytes, jsonBytes, txtHash, jsonHash } = createMockBytes();

  try {
    const result = await runWalletStatsParserV2Resmoke({
      inputDir: "/dummy",
      outputDir: tmpOut,
      runtimeEnvironment: { GMGN_API_KEY: "mock_key" },
      expectedHashes: {
        solAddressesTxtHash: txtHash,
        solAddressLabelsJsonHash: jsonHash,
      },
      dependencies: {
        readFileBytes: async (filePath) => (filePath.endsWith("sol_addresses.txt") ? txtBytes : jsonBytes),
        createIsolation: createMockIsolation,
        execute: async (inv) => {
          const is7d = inv.args.includes("7d");
          return { exitCode: 0, stdout: JSON.stringify(is7d ? mockPayloadPartial7d : mockPayloadPartial30d), stderr: "" };
        },
        delay: async () => {},
      },
    });

    assert.ok(result.cliInvocationBudgetUsed <= 2);
    assert.equal(result.cliInvocationBudgetCap, 2);
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});
