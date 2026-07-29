import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  runBoundedSignedHoldingsSmoke,
  type BoundedSignedHoldingsSmokeDependencies,
} from "../../../src/application/gmgn/signed-cumulative-holdings-live-smoke.js";

function encodeBase58(bytes: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    encoded = alphabet[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  return "1".repeat(leadingZeroes) + (encoded || "1");
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function syntheticInput() {
  const selected = encodeBase58(new Uint8Array(32).fill(7));
  const addresses = Buffer.from(`invalid\n${selected}\n${selected}\n`, "utf8");
  const labels = Buffer.from("{}", "utf8");
  return { addresses, labels };
}

function reader(files: Record<string, Uint8Array>): BoundedSignedHoldingsSmokeDependencies["readFileBytes"] {
  return async (filePath) => {
    const value = files[filePath];
    if (value === undefined) throw new Error("synthetic missing input");
    return value;
  };
}

function baseRunInput(dependencies: Partial<BoundedSignedHoldingsSmokeDependencies> = {}) {
  const { addresses, labels } = syntheticInput();
  return {
    addressesPath: "synthetic-addresses",
    labelsPath: "synthetic-labels",
    expectedAddressesSha256: sha256(addresses),
    expectedLabelsSha256: sha256(labels),
    cliPath: "synthetic-gmgn-cli.js",
    runtimeEnvironment: {
      PATH: "synthetic-path",
      GMGN_API_KEY: "fixture-api-key",
      GMGN_PRIVATE_KEY: "fixture-private-key",
      GMGN_DEBUG: "ambient-debug",
    } as NodeJS.ProcessEnv,
    dependencies: {
      readFileBytes: reader({ "synthetic-addresses": addresses, "synthetic-labels": labels }),
      ...dependencies,
    },
  };
}

test("bounded holdings smoke fails closed on an input hash mismatch before spawn", async () => {
  let spawnCount = 0;
  const input = baseRunInput({
    execute: async () => {
      spawnCount += 1;
      return { exitCode: 0, stdout: "{}", stderr: "" };
    },
  });
  input.expectedLabelsSha256 = "0".repeat(64);

  const result = await runBoundedSignedHoldingsSmoke(input);

  assert.equal(result.status, "PARK");
  assert.equal(result.requestBudgetUsed, 0);
  assert.equal(result.diagnosticCode, "gmgn_input_hash_mismatch");
  assert.equal(spawnCount, 0);
});

test("bounded holdings smoke parks for absent credentials before spawn", async () => {
  let spawnCount = 0;
  const input = baseRunInput({
    execute: async () => {
      spawnCount += 1;
      return { exitCode: 0, stdout: "{}", stderr: "" };
    },
  });
  input.runtimeEnvironment = { PATH: "synthetic-path" };

  const result = await runBoundedSignedHoldingsSmoke(input);

  assert.equal(result.status, "PARK");
  assert.equal(result.requestBudgetUsed, 0);
  assert.equal(result.diagnosticCode, "gmgn_credentials_missing");
  assert.equal(spawnCount, 0);
});

test("bounded holdings smoke makes one fixed no-cursor invocation with retry disabled", async () => {
  let spawnCount = 0;
  const input = baseRunInput({
    execute: async (invocation) => {
      spawnCount += 1;
      assert.deepEqual(invocation.args.slice(1), [
        "portfolio", "holdings", "--chain", "sol", "--wallet", invocation.args[6],
        "--limit", "50", "--hide-closed", "false", "--raw",
      ]);
      assert.equal(invocation.args.includes("--cursor"), false);
      assert.equal(invocation.env.GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS, "0");
      assert.equal(invocation.env.GMGN_DEBUG, undefined);
      assert.notEqual(invocation.cwd, process.cwd());
      assert.equal(invocation.env.HOME, invocation.env.USERPROFILE);
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          holdings: [{ realized_profit: 3, history_bought_cost: 8, history_sold_income: 11, last_active_timestamp: 12 }],
          token_num: 1,
        }),
        stderr: "",
      };
    },
  });

  const result = await runBoundedSignedHoldingsSmoke(input);

  assert.equal(spawnCount, 1);
  assert.equal(result.status, "MAPPED");
  assert.equal(result.requestBudgetUsed, 1);
  assert.equal(result.physicalProviderRequestCap, 1);
  assert.equal(result.rateLimitAutoRetryMaxWaitMs, 0);
  assert.equal(result.source, "gmgn");
  assert.equal(result.verificationStatus, "unverified");
  assert.equal(result.record?.aggregates.realizedProfit, 3);
  assert.equal(result.record?.aggregates.tokenNum, 1);
  assert.equal(typeof result.sourceInputFingerprint, "string");
  assert.equal(result.sourceInputFingerprint?.length, 64);
  assert.equal(JSON.stringify(result).includes("fixture-api-key"), false);
  assert.equal(JSON.stringify(result).includes("fixture-private-key"), false);
});

test("bounded holdings smoke discards raw child failure text after safe classification", async () => {
  const result = await runBoundedSignedHoldingsSmoke(baseRunInput({
    execute: async () => ({ exitCode: 1, stdout: "", stderr: "synthetic opaque 429 response" }),
  }));

  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.diagnosticCode, "gmgn_cli_rate_limited");
  assert.equal(JSON.stringify(result).includes("synthetic opaque"), false);
});
