import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";

import { runProxyTransport30dLiveSmoke } from "../../../src/application/gmgn/proxy-transport-30d-live-smoke.js";

const DUMMY_SOL_ADDRESS = "So11111111111111111111111111111111111111112";

function sha256Upper(val: string | Uint8Array): string {
  return createHash("sha256").update(val).digest("hex").toUpperCase();
}

function createFixtureDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-30d-smoke-input-"));
  const txtContent = Buffer.from(`${DUMMY_SOL_ADDRESS}\n`);
  const jsonContent = Buffer.from(`{"${DUMMY_SOL_ADDRESS}":"Test Wallet"}`);
  fs.writeFileSync(path.join(tmpDir, "sol_addresses.txt"), txtContent);
  fs.writeFileSync(path.join(tmpDir, "sol_address_labels.json"), jsonContent);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-30d-smoke-output-"));
  const expectedFingerprint = sha256Upper(
    `sol-gmgn-proxy-transport-7d-live-smoke-001:${DUMMY_SOL_ADDRESS}`,
  );
  return {
    inputDir: tmpDir,
    outputDir: outDir,
    txtHash: sha256Upper(txtContent),
    jsonHash: sha256Upper(jsonContent),
    expectedFingerprint,
    cleanup() {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(outDir, { recursive: true, force: true });
    },
  };
}

test("30d proxy smoke: hash mismatch yields zero invocations", async () => {
  const fx = createFixtureDir();
  try {
    let executions = 0;
    const result = await runProxyTransport30dLiveSmoke({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      expectedHashes: {
        solAddressesTxtHash: "WRONG",
        solAddressLabelsJsonHash: fx.jsonHash,
      },
      expectedTargetFingerprint: fx.expectedFingerprint,
      dependencies: {
        execute: async () => {
          executions += 1;
          return { exitCode: 0, stdout: "{}", stderr: "" };
        },
      },
    });
    assert.equal(result.status, "FAIL_CLOSED");
    assert.equal(result.cliInvocationBudgetUsed, 0);
    assert.equal(executions, 0);
    assert.equal(result.period, "30d");
  } finally {
    fx.cleanup();
  }
});

test("30d proxy smoke: fingerprint mismatch fails closed without address leakage", async () => {
  const fx = createFixtureDir();
  try {
    let executions = 0;
    const result = await runProxyTransport30dLiveSmoke({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      runtimeEnvironment: { GMGN_API_KEY: "dummy_api_key" },
      expectedHashes: {
        solAddressesTxtHash: fx.txtHash,
        solAddressLabelsJsonHash: fx.jsonHash,
      },
      expectedTargetFingerprint: "0".repeat(64),
      dependencies: {
        execute: async () => {
          executions += 1;
          return { exitCode: 0, stdout: "{}", stderr: "" };
        },
      },
    });
    assert.equal(result.status, "FAIL_CLOSED");
    assert.equal(result.cliInvocationBudgetUsed, 0);
    assert.equal(executions, 0);
    assert.equal(result.targetFingerprint, null);
    const summary = fs.readFileSync(result.outputFiles.summaryJson, "utf8");
    assert.equal(summary.includes(DUMMY_SOL_ADDRESS), false);
  } finally {
    fx.cleanup();
  }
});

test("30d proxy smoke: missing credential parks with zero invocations", async () => {
  const fx = createFixtureDir();
  try {
    let executions = 0;
    const result = await runProxyTransport30dLiveSmoke({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      runtimeEnvironment: {},
      expectedHashes: {
        solAddressesTxtHash: fx.txtHash,
        solAddressLabelsJsonHash: fx.jsonHash,
      },
      expectedTargetFingerprint: fx.expectedFingerprint,
      dependencies: {
        execute: async () => {
          executions += 1;
          return { exitCode: 0, stdout: "{}", stderr: "" };
        },
      },
    });
    assert.equal(result.status, "PARK");
    assert.equal(result.cliInvocationBudgetUsed, 0);
    assert.equal(executions, 0);
  } finally {
    fx.cleanup();
  }
});

test("30d proxy smoke: single invocation only; never spawns 7d/holdings", async () => {
  const fx = createFixtureDir();
  try {
    let executions = 0;
    const result = await runProxyTransport30dLiveSmoke({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      runtimeEnvironment: { GMGN_API_KEY: "dummy_api_key" },
      expectedHashes: {
        solAddressesTxtHash: fx.txtHash,
        solAddressLabelsJsonHash: fx.jsonHash,
      },
      expectedTargetFingerprint: fx.expectedFingerprint,
      dependencies: {
        execute: async (inv) => {
          executions += 1;
          assert.equal(inv.args.includes("30d"), true);
          assert.equal(inv.args.includes("7d"), false);
          assert.equal(inv.args.includes("holdings"), false);
          assert.equal(inv.env.GMGN_PRIVATE_KEY, undefined);
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              data: [{ wallet: DUMMY_SOL_ADDRESS, realized_profit: 0, pnl: 0, buy_30d: 0 }],
            }),
            stderr: "",
          };
        },
      },
    });
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.cliInvocationBudgetUsed, 1);
    assert.equal(result.physicalProviderRequestUpperBound, 1);
    assert.equal(executions, 1);
    assert.equal(result.record !== null, true);
    assert.equal(result.source, "gmgn");
    assert.equal(result.verificationStatus, "unverified");
    assert.equal(result.period, "30d");

    const stats = JSON.parse(fs.readFileSync(result.outputFiles.stats30dJson, "utf8"));
    assert.equal(stats.period, "30d");
    assert.equal(stats.realizedProfit, 0);
    assert.equal(stats.periodPnl, 0);
    assert.equal(stats.lastActiveTimestamp, null);
    assert.equal(JSON.stringify(stats).includes(DUMMY_SOL_ADDRESS), false);

    const summary = fs.readFileSync(result.outputFiles.summaryJson, "utf8");
    assert.equal(summary.includes(DUMMY_SOL_ADDRESS), false);
    assert.equal(summary.includes("dummy_api_key"), false);
  } finally {
    fx.cleanup();
  }
});

test("30d proxy smoke: network failure maps to safe code without leaking stderr", async () => {
  const fx = createFixtureDir();
  try {
    const result = await runProxyTransport30dLiveSmoke({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      runtimeEnvironment: { GMGN_API_KEY: "dummy_api_key" },
      expectedHashes: {
        solAddressesTxtHash: fx.txtHash,
        solAddressLabelsJsonHash: fx.jsonHash,
      },
      expectedTargetFingerprint: fx.expectedFingerprint,
      dependencies: {
        execute: async () => ({
          exitCode: 1,
          stdout: "",
          stderr: "fetch failed via http://user:super-secret@127.0.0.1:9",
        }),
      },
    });
    assert.equal(result.status, "UNAVAILABLE");
    assert.equal(result.cliInvocationBudgetUsed, 1);
    assert.ok(result.diagnosticCode !== null);
    const summary = fs.readFileSync(result.outputFiles.summaryJson, "utf8");
    assert.equal(summary.includes("super-secret"), false);
    assert.equal(summary.includes("http://"), false);
  } finally {
    fx.cleanup();
  }
});
