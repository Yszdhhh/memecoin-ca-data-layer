import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";

import { runProxyTransport7dLiveSmoke } from "../../../src/application/gmgn/proxy-transport-7d-live-smoke.js";

const DUMMY_SOL_ADDRESS = "So11111111111111111111111111111111111111112";

function sha256Upper(val: string | Uint8Array): string {
  return createHash("sha256").update(val).digest("hex").toUpperCase();
}

function createFixtureDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-7d-smoke-input-"));
  const txtContent = Buffer.from(`${DUMMY_SOL_ADDRESS}\n`);
  const jsonContent = Buffer.from(`{"${DUMMY_SOL_ADDRESS}":"Test Wallet"}`);
  fs.writeFileSync(path.join(tmpDir, "sol_addresses.txt"), txtContent);
  fs.writeFileSync(path.join(tmpDir, "sol_address_labels.json"), jsonContent);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-7d-smoke-output-"));
  return {
    inputDir: tmpDir,
    outputDir: outDir,
    txtHash: sha256Upper(txtContent),
    jsonHash: sha256Upper(jsonContent),
    cleanup() {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(outDir, { recursive: true, force: true });
    },
  };
}

test("7d proxy smoke: hash mismatch yields zero invocations", async () => {
  const fx = createFixtureDir();
  try {
    let executions = 0;
    const result = await runProxyTransport7dLiveSmoke({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      expectedHashes: {
        solAddressesTxtHash: "WRONG",
        solAddressLabelsJsonHash: fx.jsonHash,
      },
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
    assert.equal(result.period, "7d");
  } finally {
    fx.cleanup();
  }
});

test("7d proxy smoke: missing credential parks with zero invocations", async () => {
  const fx = createFixtureDir();
  try {
    let executions = 0;
    const result = await runProxyTransport7dLiveSmoke({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      runtimeEnvironment: {},
      expectedHashes: {
        solAddressesTxtHash: fx.txtHash,
        solAddressLabelsJsonHash: fx.jsonHash,
      },
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

test("7d proxy smoke: single invocation only; never spawns second path", async () => {
  const fx = createFixtureDir();
  try {
    let executions = 0;
    const result = await runProxyTransport7dLiveSmoke({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      runtimeEnvironment: { GMGN_API_KEY: "dummy_api_key" },
      expectedHashes: {
        solAddressesTxtHash: fx.txtHash,
        solAddressLabelsJsonHash: fx.jsonHash,
      },
      dependencies: {
        execute: async (inv) => {
          executions += 1;
          assert.equal(inv.args.includes("7d"), true);
          assert.equal(inv.args.includes("30d"), false);
          assert.equal(inv.args.includes("holdings"), false);
          assert.equal(inv.env.GMGN_PRIVATE_KEY, undefined);
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              data: [{ wallet: DUMMY_SOL_ADDRESS, realized_profit: 100, pnl: 0.5 }],
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
    const summary = fs.readFileSync(result.outputFiles.summaryJson, "utf8");
    assert.equal(summary.includes(DUMMY_SOL_ADDRESS), false);
    assert.equal(summary.includes("dummy_api_key"), false);
  } finally {
    fx.cleanup();
  }
});

test("7d proxy smoke: network failure maps to safe code without leaking stderr", async () => {
  const fx = createFixtureDir();
  try {
    const result = await runProxyTransport7dLiveSmoke({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      runtimeEnvironment: { GMGN_API_KEY: "dummy_api_key" },
      expectedHashes: {
        solAddressesTxtHash: fx.txtHash,
        solAddressLabelsJsonHash: fx.jsonHash,
      },
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
