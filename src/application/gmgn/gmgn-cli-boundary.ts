import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const GMGN_CLI_PINNED_VERSION = "1.5.4";
export const GMGN_STATS_PERIODS = ["7d", "30d"] as const;
export type GmgnStatsPeriod = (typeof GMGN_STATS_PERIODS)[number];

export const ALLOWLISTED_GMGN_CLI_FAILURE_CODES = [
  "gmgn_cli_timeout",
  "gmgn_cli_auth_rejected",
  "gmgn_cli_rate_limited",
  "gmgn_cli_network_unavailable",
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
}

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
  // gmgn-cli loads both os.homedir()/.config/gmgn/.env and cwd/.env. The caller
  // supplies an empty, disposable home/cwd so an ambient config file cannot
  // alter the intended credential mode.
  return {
    ...env,
    HOME: home,
    USERPROFILE: home,
    APPDATA: path.join(home, "AppData", "Roaming"),
    LOCALAPPDATA: path.join(home, "AppData", "Local"),
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

export function buildGmgnStatsInvocation(input: {
  cliPath: string;
  walletAddress: string;
  period: GmgnStatsPeriod;
  cwd: string;
  env: NodeJS.ProcessEnv;
}): GmgnCliInvocation {
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
      input.walletAddress,
      "--period",
      input.period,
      "--raw",
    ],
    cwd: input.cwd,
    env: input.env,
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
  return { args, cwd: input.cwd, env: input.env };
}

export function classifyGmgnCliFailure(input: {
  exitCode: number | null;
  timedOut?: boolean;
  stdout?: string;
  stderr?: string;
}): AllowlistedGmgnCliFailureCode {
  if (input.timedOut) return "gmgn_cli_timeout";

  // These strings are inspected only in process memory. The function returns a
  // stable safe code and never exposes the original text to a caller.
  const opaqueText = `${input.stdout ?? ""}\n${input.stderr ?? ""}`.toLowerCase();
  if (/\b(401|403)\b|unauthorized|forbidden|invalid[ _-]?key|signature|private[ _-]?key/.test(opaqueText)) {
    return "gmgn_cli_auth_rejected";
  }
  if (/\b429\b|rate[ _-]?limit|too many requests/.test(opaqueText)) {
    return "gmgn_cli_rate_limited";
  }
  if (/enotfound|econn|fetch failed|network|socket|dns|connect/.test(opaqueText)) {
    return "gmgn_cli_network_unavailable";
  }
  if (input.exitCode === 0 && (input.stdout ?? "").trim().length > 0) {
    return "gmgn_cli_response_unparseable";
  }
  return "gmgn_request_unavailable";
}
