import { createPrivateKey } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const GMGN_CLI_PINNED_VERSION = "1.5.4";
export const GMGN_STATS_PERIODS = ["7d", "30d"] as const;
export const GMGN_CLI_TIMEOUT_MS = 30_000;
export const GMGN_STATS_BATCH_SIZE = 20;
export const GMGN_NODE_OPTIONS = "--dns-result-order=ipv4first";
export type GmgnStatsPeriod = (typeof GMGN_STATS_PERIODS)[number];

export const ALLOWLISTED_GMGN_CLI_FAILURE_CODES = [
  "gmgn_cli_timeout",
  "gmgn_cli_signing_key_invalid",
  "gmgn_cli_clock_skew",
  "gmgn_cli_auth_rejected",
  "gmgn_cli_rate_limited",
  "gmgn_cli_contract_mismatch",
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

const RUNTIME_ENVIRONMENT_KEYS = [
  "PATH",
  "SystemRoot",
  "ComSpec",
  "PATHEXT",
  "TEMP",
  "TMP",
] as const;

function copyRuntimeEnvironment(runtimeEnvironment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of RUNTIME_ENVIRONMENT_KEYS) {
    const value = runtimeEnvironment[key];
    if (value !== undefined) env[key] = value;
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
  apiKey?: string | undefined;
}): NodeJS.ProcessEnv {
  const env = addIsolatedHome(copyRuntimeEnvironment(input.runtimeEnvironment), input.isolatedHome);
  // Deliberately never read or forward GMGN_PRIVATE_KEY in this mode.
  return input.apiKey === undefined ? env : { ...env, GMGN_API_KEY: input.apiKey };
}

export function buildSignedGmgnCliEnvironment(input: {
  runtimeEnvironment: NodeJS.ProcessEnv;
  isolatedHome: string;
  apiKey?: string | undefined;
  privateKey?: string | undefined;
}): NodeJS.ProcessEnv {
  const env = buildApiKeyOnlyGmgnCliEnvironment(input);
  return input.privateKey === undefined ? env : { ...env, GMGN_PRIVATE_KEY: input.privateKey };
}

export function buildBoundedSignedGmgnCliEnvironment(input: {
  runtimeEnvironment: NodeJS.ProcessEnv;
  isolatedHome: string;
  apiKey?: string | undefined;
  privateKey?: string | undefined;
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

export function buildGmgnStatsInvocation(input: {
  cliPath: string;
  walletAddresses: readonly string[];
  period: GmgnStatsPeriod;
  cwd: string;
  env: NodeJS.ProcessEnv;
}): GmgnCliInvocation {
  if (!GMGN_STATS_PERIODS.includes(input.period)) {
    throw new Error("Unsupported GMGN stats period");
  }
  if (input.walletAddresses.length === 0 || input.walletAddresses.length > GMGN_STATS_BATCH_SIZE) {
    throw new Error("Unsupported GMGN stats wallet batch size");
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

export function classifyGmgnCliFailure(input: {
  exitCode: number | null;
  timedOut?: boolean;
  stdout?: string;
  stderr?: string;
}): AllowlistedGmgnCliFailureCode {
  if (input.timedOut) return "gmgn_cli_timeout";

  // Raw process text is inspected only in memory and is never returned.
  const opaqueText = `${input.stdout ?? ""}\n${input.stderr ?? ""}`.toLowerCase();
  if (/decoder routines|unsupported key type|could not (?:read|parse).*(?:key|pem)|invalid pem|no start line/.test(opaqueText)) {
    return "gmgn_cli_signing_key_invalid";
  }
  if (/clock skew|timestamp.*(?:expired|invalid|outside)|request.*expired|replay|client[_ -]?id.*invalid/.test(opaqueText)) {
    return "gmgn_cli_clock_skew";
  }
  if (/\b(401|403)\b|unauthorized|forbidden|invalid[ _-]?(?:api[ _-]?)?key|invalid signature|signature verification|private[ _-]?key/.test(opaqueText)) {
    return "gmgn_cli_auth_rejected";
  }
  if (/\b429\b|rate[ _-]?limit|too many requests/.test(opaqueText)) {
    return "gmgn_cli_rate_limited";
  }
  if (/unknown (?:option|command)|too many arguments|required option|invalid command/.test(opaqueText)) {
    return "gmgn_cli_contract_mismatch";
  }
  if (/enotfound|econn|enet|eaddr|fetch failed|network|socket|dns|connect/.test(opaqueText)) {
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
}
