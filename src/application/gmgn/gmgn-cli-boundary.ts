import { createPrivateKey } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const GMGN_CLI_PINNED_VERSION = "1.5.4";
export const GMGN_STATS_PERIODS = ["7d", "30d"] as const;
export const GMGN_CLI_TIMEOUT_MS = 30_000;
/** Live cardinality evidence proves multi-wallet stats responses can truncate silently. */
export const GMGN_STATS_BATCH_SIZE = 1;
/** Fixed child NODE_OPTIONS — never inherit parent NODE_OPTIONS. */
export const GMGN_NODE_OPTIONS = "--use-env-proxy --dns-result-order=ipv4first";
export type GmgnStatsPeriod = (typeof GMGN_STATS_PERIODS)[number];

export const ALLOWLISTED_GMGN_CLI_FAILURE_CODES = [
  "gmgn_cli_timeout",
  "gmgn_cli_signing_key_invalid",
  "gmgn_cli_clock_skew",
  "gmgn_cli_auth_rejected",
  "gmgn_cli_rate_limited",
  "gmgn_cli_contract_mismatch",
  "gmgn_cli_dns_failed",
  "gmgn_cli_proxy_configuration_invalid",
  "gmgn_cli_proxy_connect_failed",
  "gmgn_cli_connection_refused",
  "gmgn_cli_connection_reset",
  "gmgn_cli_tls_failed",
  "gmgn_cli_network_unavailable",
  "gmgn_cli_provider_unavailable",
  "gmgn_cli_request_rejected",
  "gmgn_cli_response_unparseable",
  "gmgn_request_unavailable",
] as const;

export type AllowlistedGmgnCliFailureCode =
  (typeof ALLOWLISTED_GMGN_CLI_FAILURE_CODES)[number];

export interface GmgnCliIsolation {
  cwd: string;
  home: string;
  cleanup(): void;
}

export interface GmgnCliInvocation {
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
}

export type GmgnPrivateKeyValidation =
  | { ok: true; normalizedPrivateKey: string }
  | { ok: false; code: "gmgn_cli_signing_key_invalid" };

/** Safe environment construction error — message is only an allowlisted code, never a proxy URL. */
export class GmgnCliEnvironmentError extends Error {
  readonly code: AllowlistedGmgnCliFailureCode;

  constructor(code: AllowlistedGmgnCliFailureCode) {
    super(code);
    this.name = "GmgnCliEnvironmentError";
    this.code = code;
  }
}

const RUNTIME_ENVIRONMENT_KEYS = [
  "PATH",
  "SystemRoot",
  "ComSpec",
  "PATHEXT",
  "TEMP",
  "TMP",
] as const;

/** Canonical uppercase names written into the child env. */
const PROXY_ENVIRONMENT_KEYS = ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"] as const;

function getEnvCaseInsensitive(
  runtimeEnvironment: NodeJS.ProcessEnv,
  canonicalKey: string,
): string | undefined {
  const direct = runtimeEnvironment[canonicalKey];
  if (direct !== undefined) return direct;

  const wanted = canonicalKey.toLowerCase();
  for (const [key, value] of Object.entries(runtimeEnvironment)) {
    if (key.toLowerCase() === wanted && value !== undefined) return value;
  }
  return undefined;
}

function copyRuntimeEnvironment(runtimeEnvironment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of RUNTIME_ENVIRONMENT_KEYS) {
    const value = getEnvCaseInsensitive(runtimeEnvironment, key);
    if (value !== undefined) env[key] = value;
  }
  return env;
}

function isAllowedHttpProxyUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Copy only allowlisted proxy variables. Never forward ALL_PROXY.
 * Invalid HTTP(S) proxy schemes fail closed without embedding the URL in the error.
 */
function copyAllowlistedProxyEnvironment(
  runtimeEnvironment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of PROXY_ENVIRONMENT_KEYS) {
    const value = getEnvCaseInsensitive(runtimeEnvironment, key);
    if (value === undefined) continue;
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;

    if (key === "NO_PROXY") {
      env.NO_PROXY = trimmed;
      continue;
    }

    if (!isAllowedHttpProxyUrl(trimmed)) {
      throw new GmgnCliEnvironmentError("gmgn_cli_proxy_configuration_invalid");
    }
    env[key] = trimmed;
  }
  return env;
}

function addIsolatedHome(env: NodeJS.ProcessEnv, home: string): NodeJS.ProcessEnv {
  return {
    ...env,
    HOME: home,
    USERPROFILE: home,
    APPDATA: path.join(home, "AppData", "Roaming"),
    LOCALAPPDATA: path.join(home, "AppData", "Local"),
    // Fixed value only — parent NODE_OPTIONS is never copied into env above.
    NODE_OPTIONS: GMGN_NODE_OPTIONS,
    GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS: "0",
  };
}

export function createGmgnCliIsolation(tempParent = os.tmpdir()): GmgnCliIsolation {
  const root = fs.mkdtempSync(path.join(tempParent, "memecoin-gmgn-cli-"));
  const home = path.join(root, "home");
  fs.mkdirSync(home, { recursive: true });
  let cleaned = false;

  return {
    cwd: root,
    home,
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

export function buildApiKeyOnlyGmgnCliEnvironment(input: {
  runtimeEnvironment: NodeJS.ProcessEnv;
  isolatedHome: string;
  /** Exist-auth credential value placed into child env as GMGN_API_KEY only. */
  existAuthCredential?: string | undefined;
}): NodeJS.ProcessEnv {
  const base = copyRuntimeEnvironment(input.runtimeEnvironment);
  const proxy = copyAllowlistedProxyEnvironment(input.runtimeEnvironment);
  const env = addIsolatedHome({ ...base, ...proxy }, input.isolatedHome);
  // Deliberately never read or forward GMGN_PRIVATE_KEY in this mode.
  return input.existAuthCredential === undefined
    ? env
    : { ...env, GMGN_API_KEY: input.existAuthCredential };
}

export function buildSignedGmgnCliEnvironment(input: {
  runtimeEnvironment: NodeJS.ProcessEnv;
  isolatedHome: string;
  existAuthCredential?: string | undefined;
  signingMaterial?: string | undefined;
}): NodeJS.ProcessEnv {
  const env = buildApiKeyOnlyGmgnCliEnvironment(input);
  return input.signingMaterial === undefined
    ? env
    : { ...env, GMGN_PRIVATE_KEY: input.signingMaterial };
}

export function buildBoundedSignedGmgnCliEnvironment(input: {
  runtimeEnvironment: NodeJS.ProcessEnv;
  isolatedHome: string;
  existAuthCredential?: string | undefined;
  signingMaterial?: string | undefined;
}): NodeJS.ProcessEnv {
  return buildSignedGmgnCliEnvironment(input);
}

/** Validates only the local PEM structure and supported key family. */
export function validateGmgnPrivateKey(privateKey: string): GmgnPrivateKeyValidation {
  const normalizedPrivateKey = privateKey.replace(/\\n/g, "\n").trim();
  if (normalizedPrivateKey.length === 0) {
    return { ok: false, code: "gmgn_cli_signing_key_invalid" };
  }

  try {
    const parsed = createPrivateKey(normalizedPrivateKey);
    if (parsed.asymmetricKeyType !== "ed25519" && parsed.asymmetricKeyType !== "rsa") {
      return { ok: false, code: "gmgn_cli_signing_key_invalid" };
    }
    return { ok: true, normalizedPrivateKey };
  } catch {
    return { ok: false, code: "gmgn_cli_signing_key_invalid" };
  }
}

interface GmgnStatsInvocationInput {
  cliPath: string;
  walletAddresses: readonly string[];
  period: GmgnStatsPeriod;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

function buildGmgnStatsInvocationArgs(input: GmgnStatsInvocationInput): GmgnCliInvocation {
  if (!GMGN_STATS_PERIODS.includes(input.period)) {
    throw new Error("Unsupported GMGN stats period");
  }
  return {
    args: [
      input.cliPath,
      "portfolio",
      "stats",
      "--chain",
      "sol",
      "--wallet",
      ...input.walletAddresses,
      "--period",
      input.period,
      "--raw",
    ],
    cwd: input.cwd,
    env: input.env,
    timeoutMs: GMGN_CLI_TIMEOUT_MS,
  };
}

export function buildGmgnStatsInvocation(input: GmgnStatsInvocationInput): GmgnCliInvocation {
  if (input.walletAddresses.length !== GMGN_STATS_BATCH_SIZE) {
    throw new Error("GMGN stats requires exactly one wallet per invocation");
  }
  return buildGmgnStatsInvocationArgs(input);
}

/** Historical diagnostic-only builder. Production stats flows must not use this. */
export function buildGmgnBatchCardinalityDiagnosticInvocation(
  input: GmgnStatsInvocationInput,
): GmgnCliInvocation {
  if (input.walletAddresses.length !== 20) {
    throw new Error("GMGN batch cardinality diagnostic requires exactly twenty wallets");
  }
  return buildGmgnStatsInvocationArgs(input);
}

export function buildGmgnCumulativeHoldingsInvocation(input: {
  cliPath: string;
  walletAddress: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  cursor?: string;
}): GmgnCliInvocation {
  const args = [
    input.cliPath,
    "portfolio",
    "holdings",
    "--chain",
    "sol",
    "--wallet",
    input.walletAddress,
    "--limit",
    "50",
    "--hide-closed",
    "false",
    "--raw",
  ];
  if (input.cursor !== undefined) args.push("--cursor", input.cursor);
  return { args, cwd: input.cwd, env: input.env, timeoutMs: GMGN_CLI_TIMEOUT_MS };
}

/**
 * Inspect raw process text only in memory, map to an allowlisted code, then drop references.
 * Callers must not retain stdout/stderr after classification.
 */
export function classifyGmgnCliFailure(input: {
  exitCode: number | null;
  timedOut?: boolean;
  stdout?: string;
  stderr?: string;
}): AllowlistedGmgnCliFailureCode {
  if (input.timedOut) return "gmgn_cli_timeout";

  // Opaque inspection only — never returned.
  const opaqueText = `${input.stdout ?? ""}\n${input.stderr ?? ""}`.toLowerCase();
  try {
    if (/decoder routines|unsupported key type|could not (?:read|parse).*(?:key|pem)|invalid pem|no start line/.test(opaqueText)) {
      return "gmgn_cli_signing_key_invalid";
    }
    if (/clock skew|timestamp.*(?:expired|invalid|outside)|request.*expired|replay|client[_ -]?id.*invalid/.test(opaqueText)) {
      return "gmgn_cli_clock_skew";
    }
    if (/\b(401|403)\b|unauthorized|forbidden|invalid[ _-]?(?:api[ _-]?)?key|invalid signature|signature verification/.test(opaqueText)) {
      return "gmgn_cli_auth_rejected";
    }
    if (/\b429\b|rate[ _-]?limit|too many requests/.test(opaqueText)) {
      return "gmgn_cli_rate_limited";
    }
    if (/unknown (?:option|command)|too many arguments|required option|invalid command/.test(opaqueText)) {
      return "gmgn_cli_contract_mismatch";
    }
    if (/\benotfound\b|getaddrinfo|nxdomain|err_name_not_resolved|dns resolution|could not resolve/.test(opaqueText)) {
      return "gmgn_cli_dns_failed";
    }
    if (/unsupported proxy|invalid proxy|proxy.*(?:invalid|misconfig|not supported)|malformed proxy/.test(opaqueText)) {
      return "gmgn_cli_proxy_configuration_invalid";
    }
    if (/\b407\b|proxy authentication|proxy connect|tunnel.*fail|err_proxy|connecting to proxy/.test(opaqueText)) {
      return "gmgn_cli_proxy_connect_failed";
    }
    if (/\beconnrefused\b|connection refused/.test(opaqueText)) {
      return "gmgn_cli_connection_refused";
    }
    if (/\beconnreset\b|connection reset|socket hang up/.test(opaqueText)) {
      return "gmgn_cli_connection_reset";
    }
    if (/\bcert\b|certificate|tls|ssl|unable to verify|self[_ -]?signed|err_tls|handshake failure/.test(opaqueText)) {
      return "gmgn_cli_tls_failed";
    }
    if (/\beconn|\benet|\beaddr|fetch failed|network|socket|connect|und_err|other side closed/.test(opaqueText)) {
      return "gmgn_cli_network_unavailable";
    }
    if (/\b50[0-9]\b|service unavailable|bad gateway|gateway timeout/.test(opaqueText)) {
      return "gmgn_cli_provider_unavailable";
    }
    if (/\b(400|404|405|409|422)\b|invalid (?:argument|parameter)|bad request|not found|method not allowed/.test(opaqueText)) {
      return "gmgn_cli_request_rejected";
    }
    if (input.exitCode === 0 && (input.stdout ?? "").trim().length > 0) {
      return "gmgn_cli_response_unparseable";
    }
    return "gmgn_request_unavailable";
  } finally {
    // Classification complete — callers should also drop their own stdout/stderr refs.
  }
}
