import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import {
  buildApiKeyOnlyGmgnCliEnvironment,
  buildBoundedSignedGmgnCliEnvironment,
  buildGmgnCumulativeHoldingsInvocation,
  buildGmgnStatsInvocation,
  buildSignedGmgnCliEnvironment,
  classifyGmgnCliFailure,
  createGmgnCliIsolation,
  GMGN_CLI_TIMEOUT_MS,
  GMGN_NODE_OPTIONS,
  GmgnCliEnvironmentError,
  validateGmgnPrivateKey,
} from "../../../src/application/gmgn/gmgn-cli-boundary.js";

const SENSITIVE_PROXY = "http://user:super-secret-proxy-token@127.0.0.1:18080";
const SENSITIVE_HTTPS_PROXY = "https://user:super-secret-proxy-token@127.0.0.1:18443";
const SENSITIVE_NO_PROXY = "localhost,127.0.0.1,.internal.example";

function assertNoProxyLeak(text: string): void {
  assert.equal(text.includes(SENSITIVE_PROXY), false);
  assert.equal(text.includes(SENSITIVE_HTTPS_PROXY), false);
  assert.equal(text.includes("super-secret-proxy-token"), false);
  assert.equal(text.includes("user:super"), false);
}

test("API-key-only GMGN environment is isolated and does not forward a private key", () => {
  const env = buildApiKeyOnlyGmgnCliEnvironment({
    runtimeEnvironment: {
      PATH: "synthetic-path",
      HOME: "ambient-home",
      GMGN_PRIVATE_KEY: "must-not-forward",
      NODE_OPTIONS: "--inspect-brk=0.0.0.0:9229",
      GMGN_DEBUG: "1",
    },
    isolatedHome: "synthetic-isolated-home",
    existAuthCredential: "fixture-key",
  });

  assert.equal(env.PATH, "synthetic-path");
  assert.equal(env.GMGN_API_KEY, "fixture-key");
  assert.equal(env.HOME, "synthetic-isolated-home");
  assert.equal(env.USERPROFILE, "synthetic-isolated-home");
  assert.equal(env.GMGN_PRIVATE_KEY, undefined);
  assert.equal(env.NODE_OPTIONS, GMGN_NODE_OPTIONS);
  assert.equal(env.NODE_OPTIONS.includes("--use-env-proxy"), true);
  assert.equal(env.NODE_OPTIONS.includes("ipv4first"), true);
  assert.equal(env.NODE_OPTIONS.includes("inspect"), false);
  assert.equal(env.GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS, "0");
  assert.equal(env.GMGN_DEBUG, undefined);
});

test("HTTP_PROXY HTTPS_PROXY NO_PROXY are forwarded into isolated child env", () => {
  const env = buildApiKeyOnlyGmgnCliEnvironment({
    runtimeEnvironment: {
      PATH: "synthetic-path",
      HTTP_PROXY: SENSITIVE_PROXY,
      HTTPS_PROXY: SENSITIVE_HTTPS_PROXY,
      NO_PROXY: SENSITIVE_NO_PROXY,
      ALL_PROXY: "socks5://127.0.0.1:1080",
      FOO_UNRELATED: "must-not-inherit",
    },
    isolatedHome: "synthetic-isolated-home",
    existAuthCredential: "fixture-key",
  });

  assert.equal(env.HTTP_PROXY, SENSITIVE_PROXY);
  assert.equal(env.HTTPS_PROXY, SENSITIVE_HTTPS_PROXY);
  assert.equal(env.NO_PROXY, SENSITIVE_NO_PROXY);
  assert.equal(env.ALL_PROXY, undefined);
  assert.equal(env.FOO_UNRELATED, undefined);
  assert.equal(env.HOME, "synthetic-isolated-home");
  assert.equal(env.NODE_OPTIONS, GMGN_NODE_OPTIONS);

  // Proxy values must not appear in any returned structural dump except the env map itself
  // used for spawning (callers never serialize env). Snapshot of public fields:
  const publicSnapshot = JSON.stringify({
    home: env.HOME,
    nodeOptions: env.NODE_OPTIONS,
    hasCredential: env.GMGN_API_KEY !== undefined,
    hasSigningMaterial: env.GMGN_PRIVATE_KEY !== undefined,
    hasHttpProxy: env.HTTP_PROXY !== undefined,
    hasHttpsProxy: env.HTTPS_PROXY !== undefined,
    hasNoProxy: env.NO_PROXY !== undefined,
    hasAllProxy: env.ALL_PROXY !== undefined,
  });
  assertNoProxyLeak(publicSnapshot);
});

test("lowercase parent proxy keys are accepted (Windows case compatibility)", () => {
  const env = buildApiKeyOnlyGmgnCliEnvironment({
    runtimeEnvironment: {
      PATH: "synthetic-path",
      http_proxy: SENSITIVE_PROXY,
      https_proxy: SENSITIVE_HTTPS_PROXY,
      no_proxy: SENSITIVE_NO_PROXY,
    },
    isolatedHome: "synthetic-isolated-home",
  });

  assert.equal(env.HTTP_PROXY, SENSITIVE_PROXY);
  assert.equal(env.HTTPS_PROXY, SENSITIVE_HTTPS_PROXY);
  assert.equal(env.NO_PROXY, SENSITIVE_NO_PROXY);
  assert.equal(env.http_proxy, undefined);
});

test("no proxy environment remains direct mode without forged proxy vars", () => {
  const env = buildApiKeyOnlyGmgnCliEnvironment({
    runtimeEnvironment: { PATH: "synthetic-path" },
    isolatedHome: "synthetic-isolated-home",
    existAuthCredential: "fixture-key",
  });

  assert.equal(env.HTTP_PROXY, undefined);
  assert.equal(env.HTTPS_PROXY, undefined);
  assert.equal(env.NO_PROXY, undefined);
  assert.equal(env.ALL_PROXY, undefined);
  assert.equal(env.NODE_OPTIONS, GMGN_NODE_OPTIONS);
});

test("illegal proxy scheme fails closed without leaking URL", () => {
  const bad = "socks5://127.0.0.1:1080";
  try {
    buildApiKeyOnlyGmgnCliEnvironment({
      runtimeEnvironment: { PATH: "synthetic-path", HTTP_PROXY: bad },
      isolatedHome: "synthetic-isolated-home",
    });
    assert.fail("expected GmgnCliEnvironmentError");
  } catch (error) {
    assert.ok(error instanceof GmgnCliEnvironmentError);
    assert.equal(error.code, "gmgn_cli_proxy_configuration_invalid");
    assert.equal(error.message, "gmgn_cli_proxy_configuration_invalid");
    assert.equal(String(error).includes(bad), false);
    assert.equal(String(error).includes("socks5"), false);
  }
});

test("parent NODE_OPTIONS is never inherited; child uses fixed safe value", () => {
  const env = buildBoundedSignedGmgnCliEnvironment({
    runtimeEnvironment: {
      PATH: "synthetic-path",
      NODE_OPTIONS: "--max-old-space-size=8192 --inspect",
      HTTP_PROXY: SENSITIVE_PROXY,
    },
    isolatedHome: "synthetic-isolated-home",
    existAuthCredential: "fixture-key",
    signingMaterial: "fixture-private",
  });

  assert.equal(env.NODE_OPTIONS, GMGN_NODE_OPTIONS);
  assert.equal(env.NODE_OPTIONS.includes("inspect"), false);
  assert.equal(env.NODE_OPTIONS.includes("max-old-space"), false);
  assert.equal(env.HTTP_PROXY, SENSITIVE_PROXY);
  assert.equal(env.GMGN_PRIVATE_KEY, "fixture-private");
});

test("proxy configuration coexists with disposable HOME and CWD isolation", () => {
  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), "gmgn-proxy-iso-"));
  const isolation = createGmgnCliIsolation(tempParent);
  try {
    const env = buildApiKeyOnlyGmgnCliEnvironment({
      runtimeEnvironment: {
        PATH: "synthetic-path",
        HTTP_PROXY: SENSITIVE_PROXY,
        HTTPS_PROXY: SENSITIVE_HTTPS_PROXY,
        NO_PROXY: SENSITIVE_NO_PROXY,
      },
      isolatedHome: isolation.home,
      existAuthCredential: "fixture-key",
    });
    assert.equal(env.HOME, isolation.home);
    assert.equal(env.USERPROFILE, isolation.home);
    assert.ok(env.APPDATA?.startsWith(isolation.home));
    assert.ok(env.LOCALAPPDATA?.startsWith(isolation.home));
    assert.equal(env.HTTP_PROXY, SENSITIVE_PROXY);
    assert.ok(fs.existsSync(isolation.cwd));
  } finally {
    isolation.cleanup();
    fs.rmSync(tempParent, { recursive: true, force: true });
  }
});

test("signed holdings command includes closed positions without unsupported flags", () => {
  const env = buildSignedGmgnCliEnvironment({
    runtimeEnvironment: { PATH: "synthetic-path" },
    isolatedHome: "synthetic-isolated-home",
    existAuthCredential: "fixture-key",
    signingMaterial: "fixture-private",
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
  assert.equal(invocation.timeoutMs, GMGN_CLI_TIMEOUT_MS);
});

test("stats command remains limited to 7d or 30d and is unaffected by proxy repair", () => {
  const env = buildApiKeyOnlyGmgnCliEnvironment({
    runtimeEnvironment: {
      PATH: "synthetic-path",
      HTTP_PROXY: SENSITIVE_PROXY,
    },
    isolatedHome: "synthetic-isolated-home",
    existAuthCredential: "fixture-key",
  });
  const invocation = buildGmgnStatsInvocation({
    cliPath: "synthetic-cli.js",
    walletAddresses: ["synthetic-wallet-a", "synthetic-wallet-b"],
    period: "30d",
    cwd: "synthetic-cwd",
    env,
  });

  assert.deepEqual(invocation.args.slice(1), [
    "portfolio",
    "stats",
    "--chain",
    "sol",
    "--wallet",
    "synthetic-wallet-a",
    "synthetic-wallet-b",
    "--period",
    "30d",
    "--raw",
  ]);
  assert.equal(invocation.timeoutMs, GMGN_CLI_TIMEOUT_MS);
  assert.equal(invocation.env.HTTP_PROXY, SENSITIVE_PROXY);
  assert.equal(invocation.env.GMGN_PRIVATE_KEY, undefined);
  assertNoProxyLeak(JSON.stringify(invocation.args));
});

test("CLI failure classifier returns only safe diagnostic codes and never echoes raw text", () => {
  const rawSecret = "fetch failed via " + SENSITIVE_PROXY;
  const cases: Array<{ input: Parameters<typeof classifyGmgnCliFailure>[0]; code: string }> = [
    { input: { exitCode: -1, timedOut: true }, code: "gmgn_cli_timeout" },
    { input: { exitCode: 1, stderr: "DECODER routines: invalid PEM" }, code: "gmgn_cli_signing_key_invalid" },
    { input: { exitCode: 1, stderr: "timestamp expired due to clock skew" }, code: "gmgn_cli_clock_skew" },
    { input: { exitCode: 1, stderr: "HTTP 403 forbidden" }, code: "gmgn_cli_auth_rejected" },
    { input: { exitCode: 1, stderr: "HTTP 429 too many requests" }, code: "gmgn_cli_rate_limited" },
    { input: { exitCode: 1, stderr: "unknown option --synthetic" }, code: "gmgn_cli_contract_mismatch" },
    { input: { exitCode: 1, stderr: "getaddrinfo ENOTFOUND api.example" }, code: "gmgn_cli_dns_failed" },
    { input: { exitCode: 1, stderr: "unsupported proxy protocol" }, code: "gmgn_cli_proxy_configuration_invalid" },
    { input: { exitCode: 1, stderr: "connecting to proxy failed" }, code: "gmgn_cli_proxy_connect_failed" },
    { input: { exitCode: 1, stderr: "connect ECONNREFUSED 127.0.0.1:1" }, code: "gmgn_cli_connection_refused" },
    { input: { exitCode: 1, stderr: "read ECONNRESET" }, code: "gmgn_cli_connection_reset" },
    { input: { exitCode: 1, stderr: "unable to verify the first certificate TLS" }, code: "gmgn_cli_tls_failed" },
    { input: { exitCode: 1, stderr: "fetch failed: network error" }, code: "gmgn_cli_network_unavailable" },
    { input: { exitCode: 1, stderr: "HTTP 503 service unavailable" }, code: "gmgn_cli_provider_unavailable" },
    { input: { exitCode: 1, stderr: "HTTP 422 invalid parameter" }, code: "gmgn_cli_request_rejected" },
    { input: { exitCode: 0, stdout: "not json" }, code: "gmgn_cli_response_unparseable" },
    { input: { exitCode: 1 }, code: "gmgn_request_unavailable" },
    { input: { exitCode: 1, stderr: rawSecret }, code: "gmgn_cli_network_unavailable" },
  ];

  for (const item of cases) {
    const code = classifyGmgnCliFailure(item.input);
    assert.equal(code, item.code);
    assertNoProxyLeak(code);
    assert.equal(code.includes("http"), false);
    assert.equal(code.includes("secret"), false);
  }
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
    existAuthCredential: "fixture-key",
    signingMaterial: "fixture-private",
  });

  assert.equal(env.GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS, "0");
  assert.equal(env.GMGN_DEBUG, undefined);
  assert.equal(env.GMGN_API_KEY, "fixture-key");
  assert.equal(env.GMGN_PRIVATE_KEY, "fixture-private");
});

test("signed private-key preflight accepts escaped-newline Ed25519 PEM and rejects malformed text", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const escaped = pem.replace(/\n/g, "\\n");

  const valid = validateGmgnPrivateKey(escaped);
  assert.equal(valid.ok, true);
  if (valid.ok) assert.equal(valid.normalizedPrivateKey.includes("\n"), true);

  assert.deepEqual(validateGmgnPrivateKey("not-a-private-key"), {
    ok: false,
    code: "gmgn_cli_signing_key_invalid",
  });
});

test("timeout settles once and kills the child process", async () => {
  let settleCount = 0;
  const script = `
    setInterval(() => {}, 1000);
  `;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", script], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      settleCount += 1;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      child.kill();
      finish();
    }, 50);
    child.once("error", (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
    child.once("close", () => finish());
  });
  assert.equal(settleCount, 1);
});

test("isolated child process receives proxy env and fixed NODE_OPTIONS without unrelated inheritance", async () => {
  const isolation = createGmgnCliIsolation();
  try {
    const env = buildApiKeyOnlyGmgnCliEnvironment({
      runtimeEnvironment: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        ComSpec: process.env.ComSpec,
        PATHEXT: process.env.PATHEXT,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        HTTP_PROXY: SENSITIVE_PROXY,
        HTTPS_PROXY: SENSITIVE_HTTPS_PROXY,
        NO_PROXY: SENSITIVE_NO_PROXY,
        ALL_PROXY: "socks5://127.0.0.1:1080",
        NODE_OPTIONS: "--inspect",
        LEAK_ME: "should-not-appear",
      },
      isolatedHome: isolation.home,
      existAuthCredential: "fixture-key",
    });

    const probe = `
      const out = {
        hasHttp: process.env.HTTP_PROXY === ${JSON.stringify(SENSITIVE_PROXY)},
        hasHttps: process.env.HTTPS_PROXY === ${JSON.stringify(SENSITIVE_HTTPS_PROXY)},
        hasNo: process.env.NO_PROXY === ${JSON.stringify(SENSITIVE_NO_PROXY)},
        hasAll: process.env.ALL_PROXY !== undefined,
        hasLeak: process.env.LEAK_ME !== undefined,
        nodeOptions: process.env.NODE_OPTIONS,
        homeMatches: process.env.HOME === ${JSON.stringify(isolation.home)},
      };
      process.stdout.write(JSON.stringify(out));
    `;

    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(process.execPath, ["-e", probe], {
        cwd: isolation.cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (c: Buffer) => {
        stdout += c.toString("utf8");
      });
      child.stderr.on("data", (c: Buffer) => {
        stderr += c.toString("utf8");
      });
      child.once("close", (code) => resolve({ code, stdout, stderr }));
    });

    assert.equal(result.code, 0);
    const parsed = JSON.parse(result.stdout) as {
      hasHttp: boolean;
      hasHttps: boolean;
      hasNo: boolean;
      hasAll: boolean;
      hasLeak: boolean;
      nodeOptions: string;
      homeMatches: boolean;
    };
    assert.equal(parsed.hasHttp, true);
    assert.equal(parsed.hasHttps, true);
    assert.equal(parsed.hasNo, true);
    assert.equal(parsed.hasAll, false);
    assert.equal(parsed.hasLeak, false);
    assert.equal(parsed.nodeOptions, GMGN_NODE_OPTIONS);
    assert.equal(parsed.homeMatches, true);
    // Child stdout is a boolean summary only �?no proxy URL echo expected.
    assertNoProxyLeak(result.stdout);
    assertNoProxyLeak(result.stderr);
  } finally {
    isolation.cleanup();
  }
});
