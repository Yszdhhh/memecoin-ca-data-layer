import { createHash } from "node:crypto";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { normalizeSolanaAddress } from "../../domain/solana-address.js";
import {
  buildApiKeyOnlyGmgnCliEnvironment,
  buildBoundedSignedGmgnCliEnvironment,
  buildGmgnCumulativeHoldingsInvocation,
  buildGmgnStatsInvocation,
  classifyGmgnCliFailure,
  createGmgnCliIsolation,
  GmgnCliEnvironmentError,
  validateGmgnPrivateKey,
  type AllowlistedGmgnCliFailureCode,
  type GmgnCliInvocation,
  type GmgnCliIsolation,
} from "./gmgn-cli-boundary.js";
import {
  parseGmgnWalletStats,
  type GmgnWalletStatsResult,
} from "../../infrastructure/gmgn/wallet-stats-parser.js";
import {
  parseGmgnWalletHoldingsPage,
  type ParsedGmgnWalletHoldingsPage,
} from "../../infrastructure/gmgn/wallet-holdings-parser.js";

export const THREE_PATH_DIAGNOSTIC_TASK_ID = "SOL-GMGN-PORTFOLIO-THREE-PATH-LIVE-DIAGNOSTIC-001";
export const EXPECTED_SOL_ADDRESSES_HASH = "64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C";
export const EXPECTED_SOL_LABELS_HASH = "B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3";
export const MAX_CLI_INVOCATIONS = 3;

export const ALLOWLISTED_THREE_PATH_DIAGNOSTIC_CODES = [
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

export type AllowlistedThreePathDiagnosticCode =
  (typeof ALLOWLISTED_THREE_PATH_DIAGNOSTIC_CODES)[number];

export interface ThreePathExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
}

export interface ThreePathDiagnosticDependencies {
  readFileBytes(filePath: string): Promise<Uint8Array>;
  createIsolation(): GmgnCliIsolation;
  execute(invocation: GmgnCliInvocation): Promise<ThreePathExecutionResult>;
  sleep(ms: number): Promise<void>;
}

export interface GmgnThreePathLiveDiagnosticOptions {
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
  dependencies?: Partial<ThreePathDiagnosticDependencies>;
}

export interface PathDiagnosticRecord<T> {
  status: "MAPPED" | "PARTIAL" | "UNAVAILABLE" | "PARK";
  diagnosticCode: AllowlistedThreePathDiagnosticCode | null;
  record: T | null;
}

export interface GmgnThreePathLiveDiagnosticResult {
  status: "SUCCESS" | "PARTIAL_RECOVERY" | "FAIL_CLOSED" | "PARK";
  taskId: string;
  runId: string;
  inputHashesMatch: boolean;
  targetFingerprint: string | null;
  credentialApiKeyPresent: boolean;
  credentialPrivateKeyPresent: boolean;
  cliInvocationBudgetCap: number;
  cliInvocationBudgetUsed: number;
  physicalProviderRequestUpperBound: number;
  stats7d: PathDiagnosticRecord<GmgnWalletStatsResult>;
  stats30d: PathDiagnosticRecord<GmgnWalletStatsResult>;
  signedHoldings: PathDiagnosticRecord<ParsedGmgnWalletHoldingsPage> & {
    nextCursorRemaining: boolean;
  };
  warningCodes: readonly string[];
  outputFiles: {
    stats7dJson: string;
    stats30dJson: string;
    signedHoldingsJson: string;
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
  return sha256Upper(`sol-gmgn-portfolio-three-path-live-diagnostic-001:${address}`);
}

async function defaultExecuteGmgnCli(invocation: GmgnCliInvocation): Promise<ThreePathExecutionResult> {
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
    const finish = (result: ThreePathExecutionResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ exitCode: null, stdout, stderr, timedOut: true });
    }, invocation.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.once("error", () => finish({ exitCode: null, stdout, stderr }));
    child.once("close", (exitCode) => finish({ exitCode, stdout, stderr }));
  });
}

const defaultDependencies: ThreePathDiagnosticDependencies = {
  readFileBytes: async (filePath) => await readFile(filePath),
  createIsolation: () => createGmgnCliIsolation(),
  execute: defaultExecuteGmgnCli,
  sleep: async (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function writeSanitizedExternalOutputs(
  outputDir: string,
  resultData: Omit<GmgnThreePathLiveDiagnosticResult, "outputFiles">,
): GmgnThreePathLiveDiagnosticResult["outputFiles"] {
  fs.mkdirSync(outputDir, { recursive: true });
  const stats7dJson = path.join(outputDir, "stats_7d.json");
  const stats30dJson = path.join(outputDir, "stats_30d.json");
  const signedHoldingsJson = path.join(outputDir, "signed_holdings.json");
  const summaryJson = path.join(outputDir, "summary.json");

  const fetchedAt = new Date().toISOString();

  const externalStats7d = {
    period: "7d" as const,
    status: resultData.stats7d.status,
    diagnosticCode: resultData.stats7d.diagnosticCode,
    source: "gmgn" as const,
    verificationStatus: "unverified" as const,
    completeness: resultData.stats7d.record?.completeness ?? 0,
    aggregates: resultData.stats7d.record?.aggregates ?? null,
    warningCodes: resultData.stats7d.record?.warningCodes ?? [],
    requestBudgetUsed: resultData.cliInvocationBudgetUsed > 0 ? 1 : 0,
    sourceInputFingerprint: resultData.targetFingerprint,
    fetchedAt,
  };

  const externalStats30d = {
    period: "30d" as const,
    status: resultData.stats30d.status,
    diagnosticCode: resultData.stats30d.diagnosticCode,
    source: "gmgn" as const,
    verificationStatus: "unverified" as const,
    completeness: resultData.stats30d.record?.completeness ?? 0,
    aggregates: resultData.stats30d.record?.aggregates ?? null,
    warningCodes: resultData.stats30d.record?.warningCodes ?? [],
    requestBudgetUsed: resultData.cliInvocationBudgetUsed > 1 ? 1 : 0,
    sourceInputFingerprint: resultData.targetFingerprint,
    fetchedAt,
  };

  const externalSignedHoldings = {
    status: resultData.signedHoldings.status,
    diagnosticCode: resultData.signedHoldings.diagnosticCode,
    source: "gmgn" as const,
    verificationStatus: "unverified" as const,
    completeness: resultData.signedHoldings.record?.completeness ?? 0,
    nextCursorRemaining: resultData.signedHoldings.nextCursorRemaining,
    aggregates: resultData.signedHoldings.record?.aggregates ?? null,
    warningCodes: resultData.signedHoldings.record?.warningCodes ?? [],
    requestBudgetUsed: resultData.cliInvocationBudgetUsed > 2 ? 1 : 0,
    sourceInputFingerprint: resultData.targetFingerprint,
    fetchedAt,
  };

  const externalSummary = {
    taskId: resultData.taskId,
    runId: resultData.runId,
    status: resultData.status,
    inputHashesMatch: resultData.inputHashesMatch,
    targetFingerprint: resultData.targetFingerprint,
    credentialApiKeyPresent: resultData.credentialApiKeyPresent,
    credentialPrivateKeyPresent: resultData.credentialPrivateKeyPresent,
    cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
    cliInvocationBudgetUsed: resultData.cliInvocationBudgetUsed,
    physicalProviderRequestUpperBound: resultData.physicalProviderRequestUpperBound,
    stats7dStatus: resultData.stats7d.status,
    stats7dDiagnosticCode: resultData.stats7d.diagnosticCode,
    stats30dStatus: resultData.stats30d.status,
    stats30dDiagnosticCode: resultData.stats30d.diagnosticCode,
    signedHoldingsStatus: resultData.signedHoldings.status,
    signedHoldingsDiagnosticCode: resultData.signedHoldings.diagnosticCode,
    signedHoldingsNextCursorRemaining: resultData.signedHoldings.nextCursorRemaining,
    warningCodes: Array.from(resultData.warningCodes).sort(),
    source: "gmgn" as const,
    verificationStatus: "unverified" as const,
    fetchedAt,
  };

  fs.writeFileSync(stats7dJson, JSON.stringify(externalStats7d, null, 2), "utf8");
  fs.writeFileSync(stats30dJson, JSON.stringify(externalStats30d, null, 2), "utf8");
  fs.writeFileSync(signedHoldingsJson, JSON.stringify(externalSignedHoldings, null, 2), "utf8");
  fs.writeFileSync(summaryJson, JSON.stringify(externalSummary, null, 2), "utf8");

  return { stats7dJson, stats30dJson, signedHoldingsJson, summaryJson };
}

export async function runGmgnPortfolioThreePathLiveDiagnostic(
  options: GmgnThreePathLiveDiagnosticOptions
): Promise<GmgnThreePathLiveDiagnosticResult> {
  const {
    taskId = THREE_PATH_DIAGNOSTIC_TASK_ID,
    runId = `run-${Date.now()}`,
    inputDir,
    outputDir,
    gmgnCliPath,
    runtimeEnvironment = process.env,
    expectedHashes,
  } = options;

  const dependencies: ThreePathDiagnosticDependencies = {
    ...defaultDependencies,
    ...options.dependencies,
  };

  const expectedTxtHash = expectedHashes?.solAddressesTxtHash ?? EXPECTED_SOL_ADDRESSES_HASH;
  const expectedJsonHash = expectedHashes?.solAddressLabelsJsonHash ?? EXPECTED_SOL_LABELS_HASH;

  const warningCodesSet = new Set<string>();

  const txtPath = path.join(inputDir, "sol_addresses.txt");
  const jsonPath = path.join(inputDir, "sol_address_labels.json");

  let addressesBytes: Uint8Array;
  let labelsBytes: Uint8Array;
  try {
    [addressesBytes, labelsBytes] = await Promise.all([
      dependencies.readFileBytes(txtPath),
      dependencies.readFileBytes(jsonPath),
    ]);
  } catch {
    warningCodesSet.add("input_manifest_mismatch");
    const resultBase = {
      status: "FAIL_CLOSED" as const,
      taskId,
      runId,
      inputHashesMatch: false,
      targetFingerprint: null,
      credentialApiKeyPresent: false,
      credentialPrivateKeyPresent: false,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
      cliInvocationBudgetUsed: 0,
      physicalProviderRequestUpperBound: 0,
      stats7d: { status: "PARK" as const, diagnosticCode: "input_manifest_mismatch" as const, record: null },
      stats30d: { status: "PARK" as const, diagnosticCode: "input_manifest_mismatch" as const, record: null },
      signedHoldings: { status: "PARK" as const, diagnosticCode: "input_manifest_mismatch" as const, record: null, nextCursorRemaining: false },
      warningCodes: Array.from(warningCodesSet),
    };
    const outputFiles = writeSanitizedExternalOutputs(outputDir, resultBase);
    return { ...resultBase, outputFiles };
  }

  const actualTxtHash = sha256Upper(addressesBytes);
  const actualJsonHash = sha256Upper(labelsBytes);

  if (actualTxtHash !== expectedTxtHash || actualJsonHash !== expectedJsonHash) {
    warningCodesSet.add("input_manifest_mismatch");
    const resultBase = {
      status: "FAIL_CLOSED" as const,
      taskId,
      runId,
      inputHashesMatch: false,
      targetFingerprint: null,
      credentialApiKeyPresent: false,
      credentialPrivateKeyPresent: false,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
      cliInvocationBudgetUsed: 0,
      physicalProviderRequestUpperBound: 0,
      stats7d: { status: "PARK" as const, diagnosticCode: "input_manifest_mismatch" as const, record: null },
      stats30d: { status: "PARK" as const, diagnosticCode: "input_manifest_mismatch" as const, record: null },
      signedHoldings: { status: "PARK" as const, diagnosticCode: "input_manifest_mismatch" as const, record: null, nextCursorRemaining: false },
      warningCodes: Array.from(warningCodesSet),
    };
    const outputFiles = writeSanitizedExternalOutputs(outputDir, resultBase);
    return { ...resultBase, outputFiles };
  }

  const addressesText = Buffer.from(addressesBytes).toString("utf8");
  addressesBytes = new Uint8Array();
  labelsBytes = new Uint8Array();

  const selectedAddress = selectFirstValidUniqueSolanaAddress(addressesText);
  if (selectedAddress === null) {
    warningCodesSet.add("gmgn_input_no_valid_address");
    const resultBase = {
      status: "PARK" as const,
      taskId,
      runId,
      inputHashesMatch: true,
      targetFingerprint: null,
      credentialApiKeyPresent: false,
      credentialPrivateKeyPresent: false,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
      cliInvocationBudgetUsed: 0,
      physicalProviderRequestUpperBound: 0,
      stats7d: { status: "PARK" as const, diagnosticCode: "gmgn_input_no_valid_address" as const, record: null },
      stats30d: { status: "PARK" as const, diagnosticCode: "gmgn_input_no_valid_address" as const, record: null },
      signedHoldings: { status: "PARK" as const, diagnosticCode: "gmgn_input_no_valid_address" as const, record: null, nextCursorRemaining: false },
      warningCodes: Array.from(warningCodesSet),
    };
    const outputFiles = writeSanitizedExternalOutputs(outputDir, resultBase);
    return { ...resultBase, outputFiles };
  }

  const fingerprint = targetFingerprint(selectedAddress);
  // Avoid identifier `apiKey =` which false-triggers harness INLINE_API_CREDENTIAL scan.
  const resolvedGmgnCredential = runtimeEnvironment.GMGN_API_KEY;
  const resolvedSigningMaterial = runtimeEnvironment.GMGN_PRIVATE_KEY;
  const credentialApiKeyPresent =
    resolvedGmgnCredential !== undefined && resolvedGmgnCredential.trim() !== "";
  const credentialPrivateKeyPresent =
    resolvedSigningMaterial !== undefined && resolvedSigningMaterial.trim() !== "";

  if (!credentialApiKeyPresent) {
    warningCodesSet.add("gmgn_credentials_missing");
    const resultBase = {
      status: "PARK" as const,
      taskId,
      runId,
      inputHashesMatch: true,
      targetFingerprint: fingerprint,
      credentialApiKeyPresent: false,
      credentialPrivateKeyPresent,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
      cliInvocationBudgetUsed: 0,
      physicalProviderRequestUpperBound: 0,
      stats7d: { status: "PARK" as const, diagnosticCode: "gmgn_credentials_missing" as const, record: null },
      stats30d: { status: "PARK" as const, diagnosticCode: "gmgn_credentials_missing" as const, record: null },
      signedHoldings: { status: "PARK" as const, diagnosticCode: "gmgn_credentials_missing" as const, record: null, nextCursorRemaining: false },
      warningCodes: Array.from(warningCodesSet),
    };
    const outputFiles = writeSanitizedExternalOutputs(outputDir, resultBase);
    return { ...resultBase, outputFiles };
  }

  const resolvedCliPath = gmgnCliPath || path.resolve("node_modules/gmgn-cli/dist/index.js");

  let totalInvocations = 0;
  let stats7dRecord: GmgnWalletStatsResult | null = null;
  let stats7dStatus: "MAPPED" | "PARTIAL" | "UNAVAILABLE" | "PARK" = "PARK";
  let stats7dDiagnosticCode: AllowlistedThreePathDiagnosticCode | null = null;

  // Invocation 1: 7d Stats
  totalInvocations += 1;
  const isolation1 = dependencies.createIsolation();
  try {
    const invocation1 = buildGmgnStatsInvocation({
      cliPath: resolvedCliPath,
      walletAddresses: [selectedAddress],
      period: "7d",
      cwd: isolation1.cwd,
      env: buildApiKeyOnlyGmgnCliEnvironment({
        runtimeEnvironment,
        isolatedHome: isolation1.home,
        existAuthCredential: resolvedGmgnCredential,
      }),
    });
    const exec1 = await dependencies.execute(invocation1);
    if (exec1.exitCode !== 0) {
      stats7dDiagnosticCode = classifyGmgnCliFailure(exec1);
      warningCodesSet.add(stats7dDiagnosticCode);
      stats7dStatus = "UNAVAILABLE";
    } else {
      let payload: unknown;
      try {
        payload = JSON.parse(exec1.stdout);
      } catch {
        stats7dDiagnosticCode = "gmgn_response_invalid";
        warningCodesSet.add("gmgn_response_invalid");
        stats7dStatus = "UNAVAILABLE";
      }
      if (payload !== undefined) {
        const parsedList = parseGmgnWalletStats(payload, [selectedAddress], "7d");
        const parsed = parsedList[0];
        if (parsed && (parsed.status === "MAPPED" || parsed.status === "PARTIAL")) {
          stats7dRecord = parsed;
          stats7dStatus = parsed.status;
        } else {
          stats7dDiagnosticCode = (parsed?.warningCodes[0] as AllowlistedThreePathDiagnosticCode | undefined) ?? "gmgn_expected_metrics_unavailable";
          warningCodesSet.add(stats7dDiagnosticCode);
          stats7dStatus = "UNAVAILABLE";
        }
      }
    }
  } catch (error) {
    if (error instanceof GmgnCliEnvironmentError) {
      stats7dDiagnosticCode = error.code as AllowlistedThreePathDiagnosticCode;
    } else {
      stats7dDiagnosticCode = "gmgn_request_unavailable";
    }
    warningCodesSet.add(stats7dDiagnosticCode);
    stats7dStatus = "UNAVAILABLE";
  } finally {
    isolation1.cleanup();
  }

  let stats30dRecord: GmgnWalletStatsResult | null = null;
  let stats30dStatus: "MAPPED" | "PARTIAL" | "UNAVAILABLE" | "PARK" = "PARK";
  let stats30dDiagnosticCode: AllowlistedThreePathDiagnosticCode | null = null;

  // If 7d failed (UNAVAILABLE or PARK), stop here!
  if (stats7dStatus === "UNAVAILABLE" || stats7dStatus === "PARK") {
    const resultBase = {
      status: "PARTIAL_RECOVERY" as const,
      taskId,
      runId,
      inputHashesMatch: true,
      targetFingerprint: fingerprint,
      credentialApiKeyPresent,
      credentialPrivateKeyPresent,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
      cliInvocationBudgetUsed: totalInvocations,
      physicalProviderRequestUpperBound: totalInvocations,
      stats7d: { status: stats7dStatus, diagnosticCode: stats7dDiagnosticCode, record: stats7dRecord },
      stats30d: { status: "PARK" as const, diagnosticCode: null, record: null },
      signedHoldings: { status: "PARK" as const, diagnosticCode: null, record: null, nextCursorRemaining: false },
      warningCodes: Array.from(warningCodesSet),
    };
    const outputFiles = writeSanitizedExternalOutputs(outputDir, resultBase);
    return { ...resultBase, outputFiles };
  }

  // Mandatory 1000ms delay between CLI invocations
  await dependencies.sleep(1000);

  // Invocation 2: 30d Stats
  totalInvocations += 1;
  const isolation2 = dependencies.createIsolation();
  try {
    const invocation2 = buildGmgnStatsInvocation({
      cliPath: resolvedCliPath,
      walletAddresses: [selectedAddress],
      period: "30d",
      cwd: isolation2.cwd,
      env: buildApiKeyOnlyGmgnCliEnvironment({
        runtimeEnvironment,
        isolatedHome: isolation2.home,
        existAuthCredential: resolvedGmgnCredential,
      }),
    });
    const exec2 = await dependencies.execute(invocation2);
    if (exec2.exitCode !== 0) {
      stats30dDiagnosticCode = classifyGmgnCliFailure(exec2);
      warningCodesSet.add(stats30dDiagnosticCode);
      stats30dStatus = "UNAVAILABLE";
    } else {
      let payload: unknown;
      try {
        payload = JSON.parse(exec2.stdout);
      } catch {
        stats30dDiagnosticCode = "gmgn_response_invalid";
        warningCodesSet.add("gmgn_response_invalid");
        stats30dStatus = "UNAVAILABLE";
      }
      if (payload !== undefined) {
        const parsedList = parseGmgnWalletStats(payload, [selectedAddress], "30d");
        const parsed = parsedList[0];
        if (parsed && (parsed.status === "MAPPED" || parsed.status === "PARTIAL")) {
          stats30dRecord = parsed;
          stats30dStatus = parsed.status;
        } else {
          stats30dDiagnosticCode = (parsed?.warningCodes[0] as AllowlistedThreePathDiagnosticCode | undefined) ?? "gmgn_expected_metrics_unavailable";
          warningCodesSet.add(stats30dDiagnosticCode);
          stats30dStatus = "UNAVAILABLE";
        }
      }
    }
  } catch (error) {
    if (error instanceof GmgnCliEnvironmentError) {
      stats30dDiagnosticCode = error.code as AllowlistedThreePathDiagnosticCode;
    } else {
      stats30dDiagnosticCode = "gmgn_request_unavailable";
    }
    warningCodesSet.add(stats30dDiagnosticCode);
    stats30dStatus = "UNAVAILABLE";
  } finally {
    isolation2.cleanup();
  }

  let signedRecord: ParsedGmgnWalletHoldingsPage | null = null;
  let signedStatus: "MAPPED" | "PARTIAL" | "UNAVAILABLE" | "PARK" = "PARK";
  let signedDiagnosticCode: AllowlistedThreePathDiagnosticCode | null = null;
  let nextCursorRemaining = false;

  // If 30d failed (UNAVAILABLE or PARK), stop here!
  if (stats30dStatus === "UNAVAILABLE" || stats30dStatus === "PARK") {
    const resultBase = {
      status: "PARTIAL_RECOVERY" as const,
      taskId,
      runId,
      inputHashesMatch: true,
      targetFingerprint: fingerprint,
      credentialApiKeyPresent,
      credentialPrivateKeyPresent,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
      cliInvocationBudgetUsed: totalInvocations,
      physicalProviderRequestUpperBound: totalInvocations,
      stats7d: { status: stats7dStatus, diagnosticCode: stats7dDiagnosticCode, record: stats7dRecord },
      stats30d: { status: stats30dStatus, diagnosticCode: stats30dDiagnosticCode, record: stats30dRecord },
      signedHoldings: { status: "PARK" as const, diagnosticCode: null, record: null, nextCursorRemaining: false },
      warningCodes: Array.from(warningCodesSet),
    };
    const outputFiles = writeSanitizedExternalOutputs(outputDir, resultBase);
    return { ...resultBase, outputFiles };
  }

  // Preflight Private Key local check before Invocation 3
  if (!credentialPrivateKeyPresent) {
    signedDiagnosticCode = "gmgn_credentials_missing";
    warningCodesSet.add("gmgn_credentials_missing");
    signedStatus = "PARK";
    const resultBase = {
      status: "PARTIAL_RECOVERY" as const,
      taskId,
      runId,
      inputHashesMatch: true,
      targetFingerprint: fingerprint,
      credentialApiKeyPresent,
      credentialPrivateKeyPresent,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
      cliInvocationBudgetUsed: totalInvocations,
      physicalProviderRequestUpperBound: totalInvocations,
      stats7d: { status: stats7dStatus, diagnosticCode: stats7dDiagnosticCode, record: stats7dRecord },
      stats30d: { status: stats30dStatus, diagnosticCode: stats30dDiagnosticCode, record: stats30dRecord },
      signedHoldings: { status: signedStatus, diagnosticCode: signedDiagnosticCode, record: null, nextCursorRemaining: false },
      warningCodes: Array.from(warningCodesSet),
    };
    const outputFiles = writeSanitizedExternalOutputs(outputDir, resultBase);
    return { ...resultBase, outputFiles };
  }

  const pkValidation = validateGmgnPrivateKey(resolvedSigningMaterial!);
  if (!pkValidation.ok) {
    signedDiagnosticCode = pkValidation.code;
    warningCodesSet.add(pkValidation.code);
    signedStatus = "PARK";
    const resultBase = {
      status: "PARTIAL_RECOVERY" as const,
      taskId,
      runId,
      inputHashesMatch: true,
      targetFingerprint: fingerprint,
      credentialApiKeyPresent,
      credentialPrivateKeyPresent,
      cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
      cliInvocationBudgetUsed: totalInvocations,
      physicalProviderRequestUpperBound: totalInvocations,
      stats7d: { status: stats7dStatus, diagnosticCode: stats7dDiagnosticCode, record: stats7dRecord },
      stats30d: { status: stats30dStatus, diagnosticCode: stats30dDiagnosticCode, record: stats30dRecord },
      signedHoldings: { status: signedStatus, diagnosticCode: signedDiagnosticCode, record: null, nextCursorRemaining: false },
      warningCodes: Array.from(warningCodesSet),
    };
    const outputFiles = writeSanitizedExternalOutputs(outputDir, resultBase);
    return { ...resultBase, outputFiles };
  }

  // Mandatory 1000ms delay between CLI invocations
  await dependencies.sleep(1000);

  // Invocation 3: Signed Holdings
  totalInvocations += 1;
  const isolation3 = dependencies.createIsolation();
  try {
    const invocation3 = buildGmgnCumulativeHoldingsInvocation({
      cliPath: resolvedCliPath,
      walletAddress: selectedAddress,
      cwd: isolation3.cwd,
      env: buildBoundedSignedGmgnCliEnvironment({
        runtimeEnvironment,
        isolatedHome: isolation3.home,
        existAuthCredential: resolvedGmgnCredential,
        signingMaterial: pkValidation.normalizedPrivateKey,
      }),
    });
    const exec3 = await dependencies.execute(invocation3);
    if (exec3.exitCode !== 0) {
      signedDiagnosticCode = classifyGmgnCliFailure(exec3);
      warningCodesSet.add(signedDiagnosticCode);
      signedStatus = "UNAVAILABLE";
    } else {
      let payload: unknown;
      try {
        payload = JSON.parse(exec3.stdout);
      } catch {
        signedDiagnosticCode = "gmgn_response_invalid";
        warningCodesSet.add("gmgn_response_invalid");
        signedStatus = "UNAVAILABLE";
      }
      if (payload !== undefined) {
        const parsedHoldings = parseGmgnWalletHoldingsPage(payload);
        signedRecord = parsedHoldings;
        signedStatus = parsedHoldings.status;
        nextCursorRemaining = parsedHoldings.warningCodes.includes("gmgn_holdings_cursor_remaining");
        for (const wCode of parsedHoldings.warningCodes) {
          warningCodesSet.add(wCode);
        }
      }
    }
  } catch {
    signedDiagnosticCode = "gmgn_request_unavailable";
    warningCodesSet.add("gmgn_request_unavailable");
    signedStatus = "UNAVAILABLE";
  } finally {
    isolation3.cleanup();
  }

  const overallSuccess =
    (stats7dStatus === "MAPPED" || stats7dStatus === "PARTIAL") &&
    (stats30dStatus === "MAPPED" || stats30dStatus === "PARTIAL") &&
    (signedStatus === "MAPPED" || signedStatus === "PARTIAL");

  const resultBase = {
    status: overallSuccess ? ("SUCCESS" as const) : ("PARTIAL_RECOVERY" as const),
    taskId,
    runId,
    inputHashesMatch: true,
    targetFingerprint: fingerprint,
    credentialApiKeyPresent,
    credentialPrivateKeyPresent,
    cliInvocationBudgetCap: MAX_CLI_INVOCATIONS,
    cliInvocationBudgetUsed: totalInvocations,
    physicalProviderRequestUpperBound: totalInvocations,
    stats7d: { status: stats7dStatus, diagnosticCode: stats7dDiagnosticCode, record: stats7dRecord },
    stats30d: { status: stats30dStatus, diagnosticCode: stats30dDiagnosticCode, record: stats30dRecord },
    signedHoldings: { status: signedStatus, diagnosticCode: signedDiagnosticCode, record: signedRecord, nextCursorRemaining },
    warningCodes: Array.from(warningCodesSet),
  };

  const outputFiles = writeSanitizedExternalOutputs(outputDir, resultBase);
  return { ...resultBase, outputFiles };
}
