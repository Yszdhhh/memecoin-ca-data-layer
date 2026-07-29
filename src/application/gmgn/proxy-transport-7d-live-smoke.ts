import { createHash } from "node:crypto";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { normalizeSolanaAddress } from "../../domain/solana-address.js";
import {
  buildApiKeyOnlyGmgnCliEnvironment,
  buildGmgnStatsInvocation,
  classifyGmgnCliFailure,
  createGmgnCliIsolation,
  GmgnCliEnvironmentError,
  type AllowlistedGmgnCliFailureCode,
  type GmgnCliInvocation,
  type GmgnCliIsolation,
} from "./gmgn-cli-boundary.js";
import {
  parseGmgnWalletStats,
  type GmgnWalletStatsResult,
} from "../../infrastructure/gmgn/wallet-stats-parser.js";

export const PROXY_TRANSPORT_7D_SMOKE_TASK_ID = "SOL-GMGN-PROXY-TRANSPORT-7D-LIVE-SMOKE-001";
export const EXPECTED_SOL_ADDRESSES_HASH = "64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C";
export const EXPECTED_SOL_LABELS_HASH = "B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3";
export const MAX_CLI_INVOCATIONS = 1;

export const ALLOWLISTED_7D_SMOKE_CODES = [
  "input_manifest_mismatch",
  "gmgn_input_no_valid_address",
  "gmgn_credentials_missing",
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
  "gmgn_response_invalid",
  "gmgn_expected_metrics_unavailable",
  "gmgn_wallet_stats_schema_unrecognized",
  "gmgn_wallet_stats_identity_mismatch",
  "gmgn_wallet_stats_period_mismatch",
  "gmgn_wallet_stats_period_unverified",
  "gmgn_wallet_stats_partial_fields",
  "gmgn_wallet_stats_invalid_field_type",
  "gmgn_wallet_stats_win_rate_unit_ambiguous",
] as const;

export type Allowlisted7dSmokeCode = (typeof ALLOWLISTED_7D_SMOKE_CODES)[number];

export interface SmokeExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
}

export interface SmokeDependencies {
  readFileBytes(filePath: string): Promise<Uint8Array>;
  createIsolation(): GmgnCliIsolation;
  execute(invocation: GmgnCliInvocation): Promise<SmokeExecutionResult>;
}

export interface ProxyTransport7dLiveSmokeOptions {
  taskId?: string;
  runId?: string;
  inputDir: string;
  outputDir: string;
  gmgnCliPath?: string;
  runtimeEnvironment?: NodeJS.ProcessEnv;
  expectedHashes?: {
    solAddressesTxtHash?: string;
    solAddressLabelsJsonHash?: string;
  };
  dependencies?: Partial<SmokeDependencies>;
}

export interface ProxyTransport7dLiveSmokeResult {
  status: "SUCCESS" | "PARTIAL" | "UNAVAILABLE" | "FAIL_CLOSED" | "PARK";
  taskId: string;
  runId: string;
  period: "7d";
  inputHashesMatch: boolean;
  targetFingerprint: string | null;
  credentialApiKeyPresent: boolean;
  cliInvocationBudgetCap: number;
  cliInvocationBudgetUsed: number;
  physicalProviderRequestUpperBound: number;
  diagnosticCode: Allowlisted7dSmokeCode | null;
  record: GmgnWalletStatsResult | null;
  warningCodes: readonly string[];
  source: "gmgn";
  verificationStatus: "unverified";
  outputFiles: {
    stats7dJson: string;
    summaryJson: string;
  };
}

function sha256Upper(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function selectFirstValidUniqueSolanaAddress(addressesText: string): string | null {
  const seen = new Set<string>();
  for (const line of addressesText.split(/\r?\n/)) {
    const address = normalizeSolanaAddress(line);
    if (address === null || seen.has(address)) continue;
    seen.add(address);
    return address;
  }
  return null;
}

function targetFingerprint(address: string): string {
  return sha256Upper(`sol-gmgn-proxy-transport-7d-live-smoke-001:${address}`);
}

async function defaultExecuteGmgnCli(invocation: GmgnCliInvocation): Promise<SmokeExecutionResult> {
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, invocation.args, {
      cwd: invocation.cwd,
      env: invocation.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result: SmokeExecutionResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ exitCode: null, stdout, stderr, timedOut: true });
    }, invocation.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", () => finish({ exitCode: null, stdout, stderr }));
    child.once("close", (exitCode) => finish({ exitCode, stdout, stderr }));
  });
}

const defaultDependencies: SmokeDependencies = {
  readFileBytes: async (filePath) => await readFile(filePath),
  createIsolation: () => createGmgnCliIsolation(),
  execute: defaultExecuteGmgnCli,
};

function writeSanitizedOutputs(
  outputDir: string,
  resultData: Omit<ProxyTransport7dLiveSmokeResult, "outputFiles">,
): ProxyTransport7dLiveSmokeResult["outputFiles"] {
  fs.mkdirSync(outputDir, { recursive: true });
  const stats7dJson = path.join(outputDir, "stats_7d.json");
  const summaryJson = path.join(outputDir, "summary.json");
  const fetchedAt = new Date().toISOString();

  const externalStats = {
    period: "7d" as const,
    status: resultData.status,
    diagnosticCode: resultData.diagnosticCode,
    source: "gmgn" as const,
    verificationStatus: "unverified" as const,
    completeness: resultData.record?.completeness ?? 0,
    aggregates: resultData.record?.aggregates ?? null,
    warningCodes: resultData.record?.warningCodes ?? [],
    requestBudgetUsed: resultData.cliInvocationBudgetUsed,
    sourceInputFingerprint: resultData.targetFingerprint,
    fetchedAt,
  };

  const externalSummary = {
    taskId: resultData.taskId,
    runId: resultData.runId,
    status: resultData.status,
    period: "7d" as const,
    inputHashesMatch: resultData.inputHashesMatch,
    targetFingerprint: resultData.targetFingerprint,
    credentialApiKeyPresent: resultData.credentialApiKeyPresent,
    cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
    cliInvocationBudgetUsed: resultData.cliInvocationBudgetUsed,
    physicalProviderRequestUpperBound: resultData.physicalProviderRequestUpperBound,
    diagnosticCode: resultData.diagnosticCode,
    warningCodes: Array.from(resultData.warningCodes).sort(),
    source: "gmgn" as const,
    verificationStatus: "unverified" as const,
    fetchedAt,
  };

  fs.writeFileSync(stats7dJson, JSON.stringify(externalStats, null, 2), "utf8");
  fs.writeFileSync(summaryJson, JSON.stringify(externalSummary, null, 2), "utf8");
  return { stats7dJson, summaryJson };
}

export async function runProxyTransport7dLiveSmoke(
  options: ProxyTransport7dLiveSmokeOptions,
): Promise<ProxyTransport7dLiveSmokeResult> {
  const {
    taskId = PROXY_TRANSPORT_7D_SMOKE_TASK_ID,
    runId = `run-${Date.now()}`,
    inputDir,
    outputDir,
    gmgnCliPath,
    runtimeEnvironment = process.env,
    expectedHashes,
  } = options;

  const dependencies: SmokeDependencies = {
    ...defaultDependencies,
    ...options.dependencies,
  };

  const expectedTxtHash = expectedHashes?.solAddressesTxtHash ?? EXPECTED_SOL_ADDRESSES_HASH;
  const expectedJsonHash = expectedHashes?.solAddressLabelsJsonHash ?? EXPECTED_SOL_LABELS_HASH;
  const warningCodesSet = new Set<string>();

  const finish = (
    partial: Omit<ProxyTransport7dLiveSmokeResult, "outputFiles" | "source" | "verificationStatus" | "period">,
  ): ProxyTransport7dLiveSmokeResult => {
    const base = {
      ...partial,
      period: "7d" as const,
      source: "gmgn" as const,
      verificationStatus: "unverified" as const,
    };
    const outputFiles = writeSanitizedOutputs(outputDir, base);
    return { ...base, outputFiles };
  };

  let addressesBytes: Uint8Array;
  let labelsBytes: Uint8Array;
  try {
    [addressesBytes, labelsBytes] = await Promise.all([
      dependencies.readFileBytes(path.join(inputDir, "sol_addresses.txt")),
      dependencies.readFileBytes(path.join(inputDir, "sol_address_labels.json")),
    ]);
  } catch {
    warningCodesSet.add("input_manifest_mismatch");
    return finish({
      status: "FAIL_CLOSED",
      taskId,
      runId,
      inputHashesMatch: false,
      targetFingerprint: null,
      credentialApiKeyPresent: false,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
      cliInvocationBudgetUsed: 0,
      physicalProviderRequestUpperBound: 0,
      diagnosticCode: "input_manifest_mismatch",
      record: null,
      warningCodes: Array.from(warningCodesSet),
    });
  }

  const actualTxtHash = sha256Upper(addressesBytes);
  const actualJsonHash = sha256Upper(labelsBytes);
  if (actualTxtHash !== expectedTxtHash || actualJsonHash !== expectedJsonHash) {
    warningCodesSet.add("input_manifest_mismatch");
    return finish({
      status: "FAIL_CLOSED",
      taskId,
      runId,
      inputHashesMatch: false,
      targetFingerprint: null,
      credentialApiKeyPresent: false,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
      cliInvocationBudgetUsed: 0,
      physicalProviderRequestUpperBound: 0,
      diagnosticCode: "input_manifest_mismatch",
      record: null,
      warningCodes: Array.from(warningCodesSet),
    });
  }

  const addressesText = Buffer.from(addressesBytes).toString("utf8");
  addressesBytes = new Uint8Array();
  labelsBytes = new Uint8Array();

  const selectedAddress = selectFirstValidUniqueSolanaAddress(addressesText);
  if (selectedAddress === null) {
    warningCodesSet.add("gmgn_input_no_valid_address");
    return finish({
      status: "PARK",
      taskId,
      runId,
      inputHashesMatch: true,
      targetFingerprint: null,
      credentialApiKeyPresent: false,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
      cliInvocationBudgetUsed: 0,
      physicalProviderRequestUpperBound: 0,
      diagnosticCode: "gmgn_input_no_valid_address",
      record: null,
      warningCodes: Array.from(warningCodesSet),
    });
  }

  const fingerprint = targetFingerprint(selectedAddress);
  const existAuthCredential = runtimeEnvironment.GMGN_API_KEY;
  const credentialApiKeyPresent =
    existAuthCredential !== undefined && existAuthCredential.trim() !== "";

  if (!credentialApiKeyPresent) {
    warningCodesSet.add("gmgn_credentials_missing");
    return finish({
      status: "PARK",
      taskId,
      runId,
      inputHashesMatch: true,
      targetFingerprint: fingerprint,
      credentialApiKeyPresent: false,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
      cliInvocationBudgetUsed: 0,
      physicalProviderRequestUpperBound: 0,
      diagnosticCode: "gmgn_credentials_missing",
      record: null,
      warningCodes: Array.from(warningCodesSet),
    });
  }

  const resolvedCliPath = gmgnCliPath || path.resolve("node_modules/gmgn-cli/dist/index.js");
  const isolation = dependencies.createIsolation();
  let diagnosticCode: Allowlisted7dSmokeCode | null = null;
  let record: GmgnWalletStatsResult | null = null;
  let status: ProxyTransport7dLiveSmokeResult["status"] = "UNAVAILABLE";

  try {
    const invocation = buildGmgnStatsInvocation({
      cliPath: resolvedCliPath,
      walletAddresses: [selectedAddress],
      period: "7d",
      cwd: isolation.cwd,
      env: buildApiKeyOnlyGmgnCliEnvironment({
        runtimeEnvironment,
        isolatedHome: isolation.home,
        existAuthCredential,
      }),
    });
    const exec = await dependencies.execute(invocation);
    if (exec.exitCode !== 0) {
      diagnosticCode = classifyGmgnCliFailure(exec) as Allowlisted7dSmokeCode;
      warningCodesSet.add(diagnosticCode);
      status = "UNAVAILABLE";
    } else {
      let payload: unknown;
      try {
        payload = JSON.parse(exec.stdout);
      } catch {
        diagnosticCode = "gmgn_response_invalid";
        warningCodesSet.add(diagnosticCode);
        status = "UNAVAILABLE";
      }
      if (payload !== undefined) {
        const parsedList = parseGmgnWalletStats(payload, [selectedAddress], "7d");
        const parsed = parsedList[0];
        if (parsed && (parsed.status === "MAPPED" || parsed.status === "PARTIAL")) {
          record = parsed;
          status = "SUCCESS";
        } else {
          diagnosticCode =
            (parsed?.warningCodes[0] as Allowlisted7dSmokeCode | undefined) ??
            "gmgn_expected_metrics_unavailable";
          warningCodesSet.add(diagnosticCode);
          status = "UNAVAILABLE";
        }
      }
    }
    // Drop raw process text references after classification/parse.
  } catch (error) {
    if (error instanceof GmgnCliEnvironmentError) {
      diagnosticCode = error.code as Allowlisted7dSmokeCode;
    } else {
      diagnosticCode = "gmgn_request_unavailable";
    }
    warningCodesSet.add(diagnosticCode);
    status = "UNAVAILABLE";
  } finally {
    isolation.cleanup();
  }

  return finish({
    status,
    taskId,
    runId,
    inputHashesMatch: true,
    targetFingerprint: fingerprint,
    credentialApiKeyPresent: true,
    cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
    cliInvocationBudgetUsed: 1,
    physicalProviderRequestUpperBound: 1,
    diagnosticCode,
    record,
    warningCodes: Array.from(warningCodesSet),
  });
}
