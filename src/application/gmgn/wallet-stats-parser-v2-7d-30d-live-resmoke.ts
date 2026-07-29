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

export const RESMOKE_TASK_ID = "SOL-GMGN-WALLET-STATS-PARSER-V2-7D-30D-LIVE-RESMOKE-001";
export const EXPECTED_SOL_ADDRESSES_HASH = "64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C";
export const EXPECTED_SOL_LABELS_HASH = "B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3";
export const MAX_CLI_INVOCATIONS_TOTAL = 2;
export const MIN_PERIOD_DELAY_MS = 1000;

export const ALLOWLISTED_RESMOKE_CODES = [
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
  "gmgn_wallet_stats_alias_conflict",
] as const;

export type AllowlistedResmokeCode = (typeof ALLOWLISTED_RESMOKE_CODES)[number];

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
  delay(ms: number): Promise<void>;
}

export interface WalletStatsParserV2ResmokeOptions {
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

export interface NormalizedPeriodRecord {
  period: "7d" | "30d";
  periodPnl: number | null;
  realizedProfit: number | null;
  realizedProfitPnl: number | null;
  winRate: number | null;
  tradeCount: number | null;
  buyCount: number | null;
  sellCount: number | null;
  boughtCost: number | null;
  soldIncome: number | null;
  lastActiveTimestamp: number | null;
  tokenNum: number | null;
  completeness: number;
  warningCodes: readonly string[];
  requestBudgetUsed: number;
  source: "gmgn";
  verificationStatus: "unverified";
  sourceInputFingerprint: string | null;
  targetFingerprint: string | null;
  fetchedAt: string;
  status: "SUCCESS" | "PARTIAL" | "UNAVAILABLE" | "FAIL_CLOSED" | "PARK";
  diagnosticCode: AllowlistedResmokeCode | null;
}

export interface WalletStatsParserV2ResmokeResult {
  status: "SUCCESS" | "PARTIAL" | "UNAVAILABLE" | "FAIL_CLOSED" | "PARK";
  taskId: string;
  runId: string;
  inputHashesMatch: boolean;
  targetFingerprint: string | null;
  credentialApiKeyPresent: boolean;
  cliInvocationBudgetCap: number;
  cliInvocationBudgetUsed: number;
  physicalProviderRequestUpperBound: number;
  stats7d: NormalizedPeriodRecord;
  stats30d: NormalizedPeriodRecord;
  source: "gmgn";
  verificationStatus: "unverified";
  outputFiles: {
    stats7dJson: string;
    stats30dJson: string;
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
  return sha256Upper(`sol-gmgn-wallet-stats-parser-v2-7d-30d-live-resmoke-001:${address}`);
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
  delay: async (ms) => await new Promise((resolve) => setTimeout(resolve, ms)),
};

function buildNormalizedPeriodRecord(
  period: "7d" | "30d",
  fingerprint: string | null,
  status: NormalizedPeriodRecord["status"],
  diagnosticCode: AllowlistedResmokeCode | null,
  parsedRecord: GmgnWalletStatsResult | null,
  requestBudgetUsed: number,
  warningCodes: readonly string[],
  fetchedAt: string,
): NormalizedPeriodRecord {
  const aggs = parsedRecord?.aggregates;
  return {
    period,
    periodPnl: aggs?.periodPnl ?? null,
    realizedProfit: aggs?.realizedProfit ?? null,
    realizedProfitPnl: aggs?.realizedProfitPnl ?? null,
    winRate: aggs?.winRate ?? null,
    tradeCount: aggs?.tradeCount ?? null,
    buyCount: aggs?.buyCount ?? null,
    sellCount: aggs?.sellCount ?? null,
    boughtCost: aggs?.boughtCost ?? null,
    soldIncome: aggs?.soldIncome ?? null,
    lastActiveTimestamp: aggs?.lastActiveTimestamp ?? null,
    tokenNum: aggs?.tokenNum ?? null,
    completeness: parsedRecord?.completeness ?? 0,
    warningCodes: Array.from(warningCodes).sort(),
    requestBudgetUsed,
    source: "gmgn",
    verificationStatus: "unverified",
    sourceInputFingerprint: fingerprint,
    targetFingerprint: fingerprint,
    fetchedAt,
    status,
    diagnosticCode,
  };
}

function writeSanitizedOutputs(
  outputDir: string,
  resultData: Omit<WalletStatsParserV2ResmokeResult, "outputFiles">,
): WalletStatsParserV2ResmokeResult["outputFiles"] {
  fs.mkdirSync(outputDir, { recursive: true });
  const stats7dJson = path.join(outputDir, "stats_7d.json");
  const stats30dJson = path.join(outputDir, "stats_30d.json");
  const summaryJson = path.join(outputDir, "summary.json");

  fs.writeFileSync(stats7dJson, JSON.stringify(resultData.stats7d, null, 2), "utf8");
  fs.writeFileSync(stats30dJson, JSON.stringify(resultData.stats30d, null, 2), "utf8");

  const externalSummary = {
    taskId: resultData.taskId,
    runId: resultData.runId,
    status: resultData.status,
    inputHashesMatch: resultData.inputHashesMatch,
    targetFingerprint: resultData.targetFingerprint,
    credentialApiKeyPresent: resultData.credentialApiKeyPresent,
    cliInvocationBudgetCap: MAX_CLI_INVOCATIONS_TOTAL,
    cliInvocationBudgetUsed: resultData.cliInvocationBudgetUsed,
    physicalProviderRequestUpperBound: resultData.physicalProviderRequestUpperBound,
    stats7d: {
      status: resultData.stats7d.status,
      completeness: resultData.stats7d.completeness,
      warningCodes: resultData.stats7d.warningCodes,
      diagnosticCode: resultData.stats7d.diagnosticCode,
    },
    stats30d: {
      status: resultData.stats30d.status,
      completeness: resultData.stats30d.completeness,
      warningCodes: resultData.stats30d.warningCodes,
      diagnosticCode: resultData.stats30d.diagnosticCode,
    },
    source: "gmgn" as const,
    verificationStatus: "unverified" as const,
    fetchedAt: resultData.stats7d.fetchedAt,
  };

  fs.writeFileSync(summaryJson, JSON.stringify(externalSummary, null, 2), "utf8");
  return { stats7dJson, stats30dJson, summaryJson };
}

export async function runWalletStatsParserV2Resmoke(
  options: WalletStatsParserV2ResmokeOptions,
): Promise<WalletStatsParserV2ResmokeResult> {
  const {
    taskId = RESMOKE_TASK_ID,
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
  const fetchedAt = new Date().toISOString();

  const finish = (
    partial: Omit<WalletStatsParserV2ResmokeResult, "outputFiles" | "source" | "verificationStatus">,
  ): WalletStatsParserV2ResmokeResult => {
    const base = {
      ...partial,
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
    const dummy7d = buildNormalizedPeriodRecord("7d", null, "FAIL_CLOSED", "input_manifest_mismatch", null, 0, ["input_manifest_mismatch"], fetchedAt);
    const dummy30d = buildNormalizedPeriodRecord("30d", null, "FAIL_CLOSED", "input_manifest_mismatch", null, 0, ["input_manifest_mismatch"], fetchedAt);
    return finish({
      status: "FAIL_CLOSED",
      taskId,
      runId,
      inputHashesMatch: false,
      targetFingerprint: null,
      credentialApiKeyPresent: false,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS_TOTAL,
      cliInvocationBudgetUsed: 0,
      physicalProviderRequestUpperBound: 0,
      stats7d: dummy7d,
      stats30d: dummy30d,
    });
  }

  const actualTxtHash = sha256Upper(addressesBytes);
  const actualJsonHash = sha256Upper(labelsBytes);
  if (actualTxtHash !== expectedTxtHash || actualJsonHash !== expectedJsonHash) {
    const dummy7d = buildNormalizedPeriodRecord("7d", null, "FAIL_CLOSED", "input_manifest_mismatch", null, 0, ["input_manifest_mismatch"], fetchedAt);
    const dummy30d = buildNormalizedPeriodRecord("30d", null, "FAIL_CLOSED", "input_manifest_mismatch", null, 0, ["input_manifest_mismatch"], fetchedAt);
    return finish({
      status: "FAIL_CLOSED",
      taskId,
      runId,
      inputHashesMatch: false,
      targetFingerprint: null,
      credentialApiKeyPresent: false,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS_TOTAL,
      cliInvocationBudgetUsed: 0,
      physicalProviderRequestUpperBound: 0,
      stats7d: dummy7d,
      stats30d: dummy30d,
    });
  }

  const addressesText = Buffer.from(addressesBytes).toString("utf8");
  addressesBytes = new Uint8Array();
  labelsBytes = new Uint8Array();

  const selectedAddress = selectFirstValidUniqueSolanaAddress(addressesText);
  if (selectedAddress === null) {
    const dummy7d = buildNormalizedPeriodRecord("7d", null, "PARK", "gmgn_input_no_valid_address", null, 0, ["gmgn_input_no_valid_address"], fetchedAt);
    const dummy30d = buildNormalizedPeriodRecord("30d", null, "PARK", "gmgn_input_no_valid_address", null, 0, ["gmgn_input_no_valid_address"], fetchedAt);
    return finish({
      status: "PARK",
      taskId,
      runId,
      inputHashesMatch: true,
      targetFingerprint: null,
      credentialApiKeyPresent: false,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS_TOTAL,
      cliInvocationBudgetUsed: 0,
      physicalProviderRequestUpperBound: 0,
      stats7d: dummy7d,
      stats30d: dummy30d,
    });
  }

  const fingerprint = targetFingerprint(selectedAddress);
  const existAuthCredential = runtimeEnvironment.GMGN_API_KEY;
  const credentialApiKeyPresent =
    existAuthCredential !== undefined && existAuthCredential.trim() !== "";

  if (!credentialApiKeyPresent) {
    const dummy7d = buildNormalizedPeriodRecord("7d", fingerprint, "PARK", "gmgn_credentials_missing", null, 0, ["gmgn_credentials_missing"], fetchedAt);
    const dummy30d = buildNormalizedPeriodRecord("30d", fingerprint, "PARK", "gmgn_credentials_missing", null, 0, ["gmgn_credentials_missing"], fetchedAt);
    return finish({
      status: "PARK",
      taskId,
      runId,
      inputHashesMatch: true,
      targetFingerprint: fingerprint,
      credentialApiKeyPresent: false,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS_TOTAL,
      cliInvocationBudgetUsed: 0,
      physicalProviderRequestUpperBound: 0,
      stats7d: dummy7d,
      stats30d: dummy30d,
    });
  }

  const resolvedCliPath = gmgnCliPath || path.resolve("node_modules/gmgn-cli/dist/index.js");
  const isolation = dependencies.createIsolation();
  let totalInvocationsUsed = 0;

  let stats7dRecord: NormalizedPeriodRecord;
  let stats30dRecord: NormalizedPeriodRecord;

  try {
    // 1. Execute 7d request
    totalInvocationsUsed++;
    const invocation7d = buildGmgnStatsInvocation({
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

    let result7dStatus: NormalizedPeriodRecord["status"] = "UNAVAILABLE";
    let diagnostic7dCode: AllowlistedResmokeCode | null = null;
    let parsed7dResult: GmgnWalletStatsResult | null = null;
    const warnings7d = new Set<string>();

    const exec7d = await dependencies.execute(invocation7d);
    if (exec7d.exitCode !== 0) {
      diagnostic7dCode = classifyGmgnCliFailure(exec7d) as AllowlistedResmokeCode;
      warnings7d.add(diagnostic7dCode);
      result7dStatus = "UNAVAILABLE";
    } else {
      let payload: unknown;
      try {
        payload = JSON.parse(exec7d.stdout);
      } catch {
        diagnostic7dCode = "gmgn_response_invalid";
        warnings7d.add(diagnostic7dCode);
        result7dStatus = "UNAVAILABLE";
      }
      if (payload !== undefined) {
        const parsedList = parseGmgnWalletStats(payload, [selectedAddress], "7d");
        const parsed = parsedList[0];
        if (parsed) {
          parsed7dResult = parsed;
          for (const w of parsed.warningCodes) warnings7d.add(w);
          if (parsed.status === "MAPPED") {
            result7dStatus = "SUCCESS";
          } else if (parsed.status === "PARTIAL") {
            result7dStatus = "PARTIAL";
          } else {
            diagnostic7dCode =
              (parsed.warningCodes[0] as AllowlistedResmokeCode | undefined) ??
              "gmgn_expected_metrics_unavailable";
            result7dStatus = "UNAVAILABLE";
          }
        }
      }
    }
    stats7dRecord = buildNormalizedPeriodRecord(
      "7d",
      fingerprint,
      result7dStatus,
      diagnostic7dCode,
      parsed7dResult,
      1,
      Array.from(warnings7d),
      fetchedAt,
    );

    // 2. Serial delay of at least 1,000ms before 30d request
    await dependencies.delay(MIN_PERIOD_DELAY_MS);

    // 3. Execute 30d request
    totalInvocationsUsed++;
    const invocation30d = buildGmgnStatsInvocation({
      cliPath: resolvedCliPath,
      walletAddresses: [selectedAddress],
      period: "30d",
      cwd: isolation.cwd,
      env: buildApiKeyOnlyGmgnCliEnvironment({
        runtimeEnvironment,
        isolatedHome: isolation.home,
        existAuthCredential,
      }),
    });

    let result30dStatus: NormalizedPeriodRecord["status"] = "UNAVAILABLE";
    let diagnostic30dCode: AllowlistedResmokeCode | null = null;
    let parsed30dResult: GmgnWalletStatsResult | null = null;
    const warnings30d = new Set<string>();

    const exec30d = await dependencies.execute(invocation30d);
    if (exec30d.exitCode !== 0) {
      diagnostic30dCode = classifyGmgnCliFailure(exec30d) as AllowlistedResmokeCode;
      warnings30d.add(diagnostic30dCode);
      result30dStatus = "UNAVAILABLE";
    } else {
      let payload: unknown;
      try {
        payload = JSON.parse(exec30d.stdout);
      } catch {
        diagnostic30dCode = "gmgn_response_invalid";
        warnings30d.add(diagnostic30dCode);
        result30dStatus = "UNAVAILABLE";
      }
      if (payload !== undefined) {
        const parsedList = parseGmgnWalletStats(payload, [selectedAddress], "30d");
        const parsed = parsedList[0];
        if (parsed) {
          parsed30dResult = parsed;
          for (const w of parsed.warningCodes) warnings30d.add(w);
          if (parsed.status === "MAPPED") {
            result30dStatus = "SUCCESS";
          } else if (parsed.status === "PARTIAL") {
            result30dStatus = "PARTIAL";
          } else {
            diagnostic30dCode =
              (parsed.warningCodes[0] as AllowlistedResmokeCode | undefined) ??
              "gmgn_expected_metrics_unavailable";
            result30dStatus = "UNAVAILABLE";
          }
        }
      }
    }
    stats30dRecord = buildNormalizedPeriodRecord(
      "30d",
      fingerprint,
      result30dStatus,
      diagnostic30dCode,
      parsed30dResult,
      1,
      Array.from(warnings30d),
      fetchedAt,
    );
  } catch (error) {
    let diagCode: AllowlistedResmokeCode = "gmgn_request_unavailable";
    if (error instanceof GmgnCliEnvironmentError) {
      diagCode = error.code as AllowlistedResmokeCode;
    }
    if (!stats7dRecord!) {
      stats7dRecord = buildNormalizedPeriodRecord("7d", fingerprint, "UNAVAILABLE", diagCode, null, 1, [diagCode], fetchedAt);
    }
    stats30dRecord = buildNormalizedPeriodRecord("30d", fingerprint, "UNAVAILABLE", diagCode, null, totalInvocationsUsed > 1 ? 1 : 0, [diagCode], fetchedAt);
  } finally {
    isolation.cleanup();
  }

  let overallStatus: WalletStatsParserV2ResmokeResult["status"] = "UNAVAILABLE";
  if (stats7dRecord.status === "SUCCESS" && stats30dRecord.status === "SUCCESS") {
    overallStatus = "SUCCESS";
  } else if (
    stats7dRecord.status === "SUCCESS" ||
    stats30dRecord.status === "SUCCESS" ||
    stats7dRecord.status === "PARTIAL" ||
    stats30dRecord.status === "PARTIAL"
  ) {
    overallStatus = "PARTIAL";
  }

  return finish({
    status: overallStatus,
    taskId,
    runId,
    inputHashesMatch: true,
    targetFingerprint: fingerprint,
    credentialApiKeyPresent: true,
    cliInvocationBudgetCap: MAX_CLI_INVOCATIONS_TOTAL,
    cliInvocationBudgetUsed: totalInvocationsUsed,
    physicalProviderRequestUpperBound: totalInvocationsUsed,
    stats7d: stats7dRecord,
    stats30d: stats30dRecord,
  });
}
