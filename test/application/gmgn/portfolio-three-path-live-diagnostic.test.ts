import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash, generateKeyPairSync } from "node:crypto";

import {
  runGmgnPortfolioThreePathLiveDiagnostic,
  EXPECTED_SOL_ADDRESSES_HASH,
  EXPECTED_SOL_LABELS_HASH,
} from "../../../src/application/gmgn/portfolio-three-path-live-diagnostic.js";

const DUMMY_SOL_ADDRESS = "So11111111111111111111111111111111111111112";

function syntheticEd25519Pem(): string {
  const { privateKey } = generateKeyPairSync("ed25519");
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

function sha256Upper(val: string | Uint8Array): string {
  return createHash("sha256").update(val).digest("hex").toUpperCase();
}

function createFixtureDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-three-path-input-"));
  const txtPath = path.join(tmpDir, "sol_addresses.txt");
  const jsonPath = path.join(tmpDir, "sol_address_labels.json");
  const txtContent = Buffer.from(`${DUMMY_SOL_ADDRESS}\n`);
  const jsonContent = Buffer.from(`{"${DUMMY_SOL_ADDRESS}":"Test Wallet"}`);
  fs.writeFileSync(txtPath, txtContent);
  fs.writeFileSync(jsonPath, jsonContent);

  const txtHash = sha256Upper(txtContent);
  const jsonHash = sha256Upper(jsonContent);

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-three-path-output-"));
  return {
    inputDir: tmpDir,
    outputDir: outDir,
    txtHash,
    jsonHash,
    cleanup() {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(outDir, { recursive: true, force: true });
    },
  };
}

test("runGmgnPortfolioThreePathLiveDiagnostic: input hash mismatch causes 0 invocations", async () => {
  const fx = createFixtureDir();
  try {
    let executionsCount = 0;
    const result = await runGmgnPortfolioThreePathLiveDiagnostic({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      expectedHashes: {
        solAddressesTxtHash: "WRONG_HASH",
        solAddressLabelsJsonHash: fx.jsonHash,
      },
      dependencies: {
        execute: async () => {
          executionsCount++;
          return { exitCode: 0, stdout: "{}", stderr: "" };
        },
      },
    });

    assert.equal(result.status, "FAIL_CLOSED");
    assert.equal(result.inputHashesMatch, false);
    assert.equal(result.cliInvocationBudgetUsed, 0);
    assert.equal(executionsCount, 0);
    assert.equal(result.stats7d.diagnosticCode, "input_manifest_mismatch");
  } finally {
    fx.cleanup();
  }
});

test("runGmgnPortfolioThreePathLiveDiagnostic: missing GMGN_API_KEY causes PARK with 0 invocations", async () => {
  const fx = createFixtureDir();
  try {
    let executionsCount = 0;
    const result = await runGmgnPortfolioThreePathLiveDiagnostic({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      runtimeEnvironment: {},
      expectedHashes: {
        solAddressesTxtHash: fx.txtHash,
        solAddressLabelsJsonHash: fx.jsonHash,
      },
      dependencies: {
        execute: async () => {
          executionsCount++;
          return { exitCode: 0, stdout: "{}", stderr: "" };
        },
      },
    });

    assert.equal(result.status, "PARK");
    assert.equal(result.credentialApiKeyPresent, false);
    assert.equal(result.cliInvocationBudgetUsed, 0);
    assert.equal(executionsCount, 0);
    assert.equal(result.stats7d.diagnosticCode, "gmgn_credentials_missing");
  } finally {
    fx.cleanup();
  }
});

test("runGmgnPortfolioThreePathLiveDiagnostic: 7d failure stops execution at 1 invocation", async () => {
  const fx = createFixtureDir();
  try {
    let executionsCount = 0;
    const result = await runGmgnPortfolioThreePathLiveDiagnostic({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      runtimeEnvironment: { GMGN_API_KEY: "dummy_api_key" },
      expectedHashes: {
        solAddressesTxtHash: fx.txtHash,
        solAddressLabelsJsonHash: fx.jsonHash,
      },
      dependencies: {
        execute: async () => {
          executionsCount++;
          return { exitCode: 1, stdout: "", stderr: "Network connection refused" };
        },
      },
    });

    assert.equal(result.status, "PARTIAL_RECOVERY");
    assert.equal(result.cliInvocationBudgetUsed, 1);
    assert.equal(executionsCount, 1);
    assert.equal(result.stats7d.status, "UNAVAILABLE");
    assert.equal(result.stats7d.diagnosticCode, "gmgn_cli_connection_refused");
    assert.equal(result.stats30d.status, "PARK");
    assert.equal(result.signedHoldings.status, "PARK");
  } finally {
    fx.cleanup();
  }
});

test("runGmgnPortfolioThreePathLiveDiagnostic: 7d succeeds but 30d fails stops execution at 2 invocations", async () => {
  const fx = createFixtureDir();
  try {
    let executionsCount = 0;
    const delays: number[] = [];
    const result = await runGmgnPortfolioThreePathLiveDiagnostic({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      runtimeEnvironment: { GMGN_API_KEY: "dummy_api_key" },
      expectedHashes: {
        solAddressesTxtHash: fx.txtHash,
        solAddressLabelsJsonHash: fx.jsonHash,
      },
      dependencies: {
        sleep: async (ms) => { delays.push(ms); },
        execute: async (inv) => {
          executionsCount++;
          if (inv.args.includes("7d")) {
            return {
              exitCode: 0,
              stdout: JSON.stringify({
                data: [{
                  wallet: DUMMY_SOL_ADDRESS,
                  pnl: 100,
                  realized_profit: 80,
                  realized_profit_pnl: 0.2,
                  win_rate_percent: 80,
                  trade_count: 10,
                  buy_count: 6,
                  sell_count: 4,
                  bought_cost: 200,
                  sold_income: 300,
                  last_active_timestamp: 1715000000,
                  token_num: 5,
                }],
              }),
              stderr: "",
            };
          }
          return { exitCode: 1, stdout: "", stderr: "502 Bad Gateway" };
        },
      },
    });

    assert.equal(result.status, "PARTIAL_RECOVERY");
    assert.equal(result.cliInvocationBudgetUsed, 2);
    assert.equal(executionsCount, 2);
    assert.equal(result.stats7d.status, "MAPPED");
    assert.equal(result.stats30d.status, "UNAVAILABLE");
    assert.equal(result.stats30d.diagnosticCode, "gmgn_cli_provider_unavailable");
    assert.equal(result.signedHoldings.status, "PARK");
    assert.deepEqual(delays, [1000]);
  } finally {
    fx.cleanup();
  }
});

test("runGmgnPortfolioThreePathLiveDiagnostic: malformed Private Key fails preflight after 7d/30d succeed without spawning Signed CLI", async () => {
  const fx = createFixtureDir();
  try {
    let executionsCount = 0;
    const result = await runGmgnPortfolioThreePathLiveDiagnostic({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      runtimeEnvironment: { GMGN_API_KEY: "dummy_api_key", GMGN_PRIVATE_KEY: "INVALID_PEM_KEY" },
      expectedHashes: {
        solAddressesTxtHash: fx.txtHash,
        solAddressLabelsJsonHash: fx.jsonHash,
      },
      dependencies: {
        sleep: async () => {},
        execute: async () => {
          executionsCount++;
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              data: [{
                wallet: DUMMY_SOL_ADDRESS,
                pnl: 100,
                realized_profit: 80,
                realized_profit_pnl: 0.2,
                win_rate_percent: 80,
                trade_count: 10,
                buy_count: 6,
                sell_count: 4,
                bought_cost: 200,
                sold_income: 300,
                last_active_timestamp: 1715000000,
                token_num: 5,
              }],
            }),
            stderr: "",
          };
        },
      },
    });

    assert.equal(result.status, "PARTIAL_RECOVERY");
    assert.equal(result.cliInvocationBudgetUsed, 2);
    assert.equal(executionsCount, 2);
    assert.equal(result.stats7d.status, "MAPPED");
    assert.equal(result.stats30d.status, "MAPPED");
    assert.equal(result.signedHoldings.status, "PARK");
    assert.equal(result.signedHoldings.diagnosticCode, "gmgn_cli_signing_key_invalid");
  } finally {
    fx.cleanup();
  }
});

test("runGmgnPortfolioThreePathLiveDiagnostic: three paths succeed with 3 serial invocations and >=1000ms delay", async () => {
  const fx = createFixtureDir();
  try {
    let executionsCount = 0;
    const delays: number[] = [];
    const calledArgs: string[][] = [];

    const result = await runGmgnPortfolioThreePathLiveDiagnostic({
      inputDir: fx.inputDir,
      outputDir: fx.outputDir,
      runtimeEnvironment: { GMGN_API_KEY: "dummy_api_key", GMGN_PRIVATE_KEY: syntheticEd25519Pem() },
      expectedHashes: {
        solAddressesTxtHash: fx.txtHash,
        solAddressLabelsJsonHash: fx.jsonHash,
      },
      dependencies: {
        sleep: async (ms) => { delays.push(ms); },
        execute: async (inv) => {
          executionsCount++;
          calledArgs.push(inv.args);
          if (inv.args.includes("stats") && inv.args.includes("7d")) {
            return {
              exitCode: 0,
              stdout: JSON.stringify({
                data: [{
                  wallet: DUMMY_SOL_ADDRESS,
                  pnl: 100,
                  realized_profit: 80,
                  realized_profit_pnl: 0.2,
                  win_rate_percent: 80,
                  trade_count: 10,
                  buy_count: 6,
                  sell_count: 4,
                  bought_cost: 200,
                  sold_income: 300,
                  last_active_timestamp: 1715000000,
                  token_num: 5,
                }],
              }),
              stderr: "",
            };
          }
          if (inv.args.includes("stats") && inv.args.includes("30d")) {
            return {
              exitCode: 0,
              stdout: JSON.stringify({
                data: [{
                  wallet: DUMMY_SOL_ADDRESS,
                  pnl_30d: 500,
                  realized_profit_30d: 400,
                  realized_profit_pnl_30d: 0.3,
                  win_rate_percent: 75,
                  trade_count_30d: 20,
                  buy_30d: 12,
                  sell_30d: 8,
                  bought_cost_30d: 1000,
                  sold_income_30d: 1400,
                  last_active_timestamp: 1715000000,
                  token_num_30d: 8,
                }],
              }),
              stderr: "",
            };
          }
          if (inv.args.includes("holdings")) {
            return {
              exitCode: 0,
              stdout: JSON.stringify({
                data: {
                  holdings: [{ realized_profit: 500, history_bought_cost: 1000, history_sold_income: 1500 }],
                  next_cursor: "cursor_page_2",
                },
              }),
              stderr: "",
            };
          }
          return { exitCode: 1, stdout: "", stderr: "Unknown" };
        },
      },
    });

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.cliInvocationBudgetUsed, 3);
    assert.equal(executionsCount, 3);
    assert.equal(result.stats7d.status, "MAPPED");
    assert.equal(result.stats30d.status, "MAPPED");
    assert.equal(result.signedHoldings.status, "PARTIAL");
    assert.equal(result.signedHoldings.nextCursorRemaining, true);
    assert.deepEqual(delays, [1000, 1000]);

    // Check external output files exist and contain no plaintext address or credentials
    const summaryText = fs.readFileSync(result.outputFiles.summaryJson, "utf8");
    assert.equal(summaryText.includes(DUMMY_SOL_ADDRESS), false);
    assert.equal(summaryText.includes("dummy_api_key"), false);
    assert.equal(summaryText.includes("PRIVATE KEY"), false);

    const holdingsText = fs.readFileSync(result.outputFiles.signedHoldingsJson, "utf8");
    assert.equal(holdingsText.includes(DUMMY_SOL_ADDRESS), false);
    assert.equal(holdingsText.includes("cursor_page_2"), false);

    // Verify source and verificationStatus
    const summaryObj = JSON.parse(summaryText);
    assert.equal(summaryObj.source, "gmgn");
    assert.equal(summaryObj.verificationStatus, "unverified");
  } finally {
    fx.cleanup();
  }
});
