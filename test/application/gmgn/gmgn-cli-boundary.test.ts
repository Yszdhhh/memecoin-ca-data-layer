import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildApiKeyOnlyGmgnCliEnvironment,
  buildBoundedSignedGmgnCliEnvironment,
  buildGmgnCumulativeHoldingsInvocation,
  buildGmgnStatsInvocation,
  buildSignedGmgnCliEnvironment,
  classifyGmgnCliFailure,
  createGmgnCliIsolation,
} from "../../../src/application/gmgn/gmgn-cli-boundary.js";

test("API-key-only GMGN environment is isolated and does not forward a private key", () => {
  const env = buildApiKeyOnlyGmgnCliEnvironment({
    runtimeEnvironment: {
      PATH: "synthetic-path",
      HOME: "ambient-home",
      GMGN_PRIVATE_KEY: "must-not-forward",
    },
    isolatedHome: "synthetic-isolated-home",
    apiKey: "fixture-key",
  });

  assert.equal(env.PATH, "synthetic-path");
  assert.equal(env.GMGN_API_KEY, "fixture-key");
  assert.equal(env.HOME, "synthetic-isolated-home");
  assert.equal(env.USERPROFILE, "synthetic-isolated-home");
  assert.equal(env.GMGN_PRIVATE_KEY, undefined);
});

test("signed holdings command includes closed positions without unsupported flags", () => {
  const env = buildSignedGmgnCliEnvironment({
    runtimeEnvironment: { PATH: "synthetic-path" },
    isolatedHome: "synthetic-isolated-home",
    apiKey: "fixture-key",
    privateKey: "fixture-private",
  });
  const invocation = buildGmgnCumulativeHoldingsInvocation({
    cliPath: "synthetic-cli.js",
    walletAddress: "synthetic-wallet",
    cwd: "synthetic-cwd",
    env,
    cursor: "synthetic-cursor",
  });

  assert.deepEqual(invocation.args, [
    "synthetic-cli.js",
    "portfolio",
    "holdings",
    "--chain",
    "sol",
    "--wallet",
    "synthetic-wallet",
    "--limit",
    "50",
    "--hide-closed",
    "false",
    "--raw",
    "--cursor",
    "synthetic-cursor",
  ]);
  assert.equal(invocation.args.includes("--sell-out"), false);
  assert.equal(invocation.env.GMGN_PRIVATE_KEY, "fixture-private");
});

test("stats command remains limited to 7d or 30d", () => {
  const invocation = buildGmgnStatsInvocation({
    cliPath: "synthetic-cli.js",
    walletAddress: "synthetic-wallet",
    period: "30d",
    cwd: "synthetic-cwd",
    env: {},
  });

  assert.deepEqual(invocation.args.slice(1), [
    "portfolio",
    "stats",
    "--chain",
    "sol",
    "--wallet",
    "synthetic-wallet",
    "--period",
    "30d",
    "--raw",
  ]);
});

test("CLI failure classifier returns only safe diagnostic codes", () => {
  assert.equal(classifyGmgnCliFailure({ exitCode: -1, timedOut: true }), "gmgn_cli_timeout");
  assert.equal(classifyGmgnCliFailure({ exitCode: 1, stderr: "HTTP 403 forbidden" }), "gmgn_cli_auth_rejected");
  assert.equal(classifyGmgnCliFailure({ exitCode: 1, stderr: "HTTP 429 too many requests" }), "gmgn_cli_rate_limited");
  assert.equal(classifyGmgnCliFailure({ exitCode: 1, stderr: "fetch failed: ENOTFOUND" }), "gmgn_cli_network_unavailable");
  assert.equal(classifyGmgnCliFailure({ exitCode: 0, stdout: "not json" }), "gmgn_cli_response_unparseable");
  assert.equal(classifyGmgnCliFailure({ exitCode: 1 }), "gmgn_request_unavailable");
});

test("CLI isolation uses a disposable empty home and working directory", () => {
  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-boundary-test-"));
  const isolation = createGmgnCliIsolation(tempParent);
  try {
    assert.ok(fs.existsSync(isolation.cwd));
    assert.ok(fs.existsSync(isolation.home));
    assert.equal(path.dirname(isolation.home), isolation.cwd);
  } finally {
    isolation.cleanup();
    fs.rmSync(tempParent, { recursive: true, force: true });
  }
  assert.equal(fs.existsSync(isolation.cwd), false);
});

test("bounded signed GMGN environment disables CLI rate-limit auto retry", () => {
  const env = buildBoundedSignedGmgnCliEnvironment({
    runtimeEnvironment: { PATH: "synthetic-path", GMGN_DEBUG: "ambient-debug" },
    isolatedHome: "synthetic-isolated-home",
    apiKey: "fixture-key",
    privateKey: "fixture-private",
  });

  assert.equal(env.GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS, "0");
  assert.equal(env.GMGN_DEBUG, undefined);
  assert.equal(env.GMGN_API_KEY, "fixture-key");
  assert.equal(env.GMGN_PRIVATE_KEY, "fixture-private");
});
