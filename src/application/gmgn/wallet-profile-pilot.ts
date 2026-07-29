import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { normalizeSolanaAddress } from "../../domain/solana-address.js";
import { parseGmgnWalletStats } from "../../infrastructure/gmgn/wallet-stats-parser.js";
import {
  buildApiKeyOnlyGmgnCliEnvironment,
  buildGmgnStatsInvocation,
  classifyGmgnCliFailure,
  createGmgnCliIsolation,
  GMGN_STATS_BATCH_SIZE,
} from "./gmgn-cli-boundary.js";

export const PILOT_TASK_ID = "SOL-GMGN-WALLET-PROFILE-PILOT-001";
export const BATCH_100_TASK_ID = "SOL-GMGN-WALLET-PROFILE-BATCH-100-LIVE-SMOKE-001";
export const FULL_1433_TASK_ID = "SOL-GMGN-WALLET-PROFILE-FULL-1433-LIVE-001";
export const EXPECTED_SOL_ADDRESSES_HASH = "64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C";
export const EXPECTED_SOL_LABELS_HASH = "B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3";
export const TARGET_WALLET_COUNT = 20;
export const MAX_REQUEST_BUDGET = 40;
export const FULL_1433_TARGET_WALLET_COUNT = 1433;
export const FULL_1433_MAX_REQUEST_BUDGET = 2866;

export const ALLOWLISTED_GMGN_WARNING_CODES = [
  "input_manifest_mismatch",
  "gmgn_wallet_input_invalid",
  "gmgn_credential_unavailable",
  "gmgn_request_unavailable",
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
  "gmgn_rate_limited",
  "gmgn_response_invalid",
  "gmgn_wallet_metric_unavailable",
  "gmgn_expected_metrics_unavailable",
] as const;

type AllowlistedGmgnWarningCode = (typeof ALLOWLISTED_GMGN_WARNING_CODES)[number];

export interface PilotOptions {
  taskId?: string;
  inputDir: string;
  outputDir: string;
  targetWalletCount?: number;
  offsetWalletCount?: number;
  maxRequestBudget?: number;
  walletBatchSize?: number;
  gmgnCliPath?: string;
  skipNetworkCalls?: boolean;
  credentialAvailable?: boolean;
  sleepFn?: (ms: number) => Promise<void>;
  mockGmgnStatsRunner?: (
    walletAddresses: readonly string[],
    period: "7d" | "30d"
  ) => { exitCode: number; stdout: string; stderr?: string; timedOut?: boolean };
  expectedHashes?: {
    solAddressesTxtHash?: string;
    solAddressLabelsJsonHash?: string;
  };
}

export interface NormalizedWalletMetrics {
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
}

export interface NormalizedWalletProfileRecord {
  period: "7d" | "30d";
  /** Internal-only execution classification; never persisted to external output. */
  status: "MAPPED" | "PARTIAL" | "UNAVAILABLE";
  source: "gmgn";
  verificationStatus: "unverified";
  completeness: number;
  aggregates: NormalizedWalletMetrics;
  warningCodes: AllowlistedGmgnWarningCode[];
  requestBudgetUsed: number;
  sourceInputFingerprint: string;
  fetchedAt: string;
}

type ExternalNormalizedWalletProfileRecord = Omit<NormalizedWalletProfileRecord, "status">;

interface ExternalOutputSummary {
  completeness: number | null;
  warningCodes: AllowlistedGmgnWarningCode[];
  requestBudgetUsed: number;
  source: "gmgn";
  verificationStatus: "unverified";
  sourceInputFingerprint: string | null;
  fetchedAt: string;
}

export interface WalletProfilePilotResult {
  status: "SUCCESS" | "FAIL_CLOSED" | "PARK";
  taskId: string;
  inputHashesMatch: boolean;
  selectedCount: number;
  mappedCount: number;
  partialCount: number;
  unavailableCount: number;
  requestBudgetUsed: number;
  maxRequestBudget: number;
  warningCodeCounts: Record<string, number>;
  outputFiles: {
    normalizedWalletProfilesJson: string;
    summaryJson: string;
  };
  records: NormalizedWalletProfileRecord[];
}

function computeFileSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex").toUpperCase();
}

function computeStringSha256(val: string): string {
  return crypto.createHash("sha256").update(val).digest("hex");
}

function toAllowlistedWarningCode(value: string | undefined): AllowlistedGmgnWarningCode {
  return (ALLOWLISTED_GMGN_WARNING_CODES as readonly string[]).includes(value ?? "")
    ? value as AllowlistedGmgnWarningCode
    : "gmgn_expected_metrics_unavailable";
}

function externalizeRecord(record: NormalizedWalletProfileRecord): ExternalNormalizedWalletProfileRecord {
  const { status: _status, ...externalRecord } = record;
  return externalRecord;
}

function writeExternalOutputs(
  outputDir: string,
  records: NormalizedWalletProfileRecord[],
  warningCodeCounts: Record<string, number>,
  requestBudgetUsed: number,
  fetchedAt: string,
): WalletProfilePilotResult["outputFiles"] {
  fs.mkdirSync(outputDir, { recursive: true });
  const normalizedWalletProfilesJson = path.join(outputDir, "normalized_wallet_profiles.json");
  const summaryJson = path.join(outputDir, "summary.json");
  const externalRecords = records.map(externalizeRecord);
  const sourceFingerprints = Array.from(new Set(records.map((record) => record.sourceInputFingerprint)));
  const completeness = records.length > 0
    ? Math.round((records.reduce((sum, record) => sum + record.completeness, 0) / records.length) * 100) / 100
    : null;
  const summary: ExternalOutputSummary = {
    completeness,
    warningCodes: Object.keys(warningCodeCounts)
      .map((code) => toAllowlistedWarningCode(code))
      .filter((code, index, codes) => codes.indexOf(code) === index)
      .sort(),
    requestBudgetUsed,
    source: "gmgn",
    verificationStatus: "unverified",
    sourceInputFingerprint: sourceFingerprints.length > 0
      ? computeStringSha256(sourceFingerprints.join("\n"))
      : null,
    fetchedAt,
  };

  fs.writeFileSync(normalizedWalletProfilesJson, JSON.stringify(externalRecords, null, 2), "utf8");
  fs.writeFileSync(summaryJson, JSON.stringify(summary, null, 2), "utf8");
  return { normalizedWalletProfilesJson, summaryJson };
}

export async function runGmgnWalletProfilePilot(
  options: PilotOptions
): Promise<WalletProfilePilotResult> {
  const {
    taskId = PILOT_TASK_ID,
    inputDir,
    outputDir,
    targetWalletCount = TARGET_WALLET_COUNT,
    offsetWalletCount = 0,
    maxRequestBudget,
    walletBatchSize = GMGN_STATS_BATCH_SIZE,
    gmgnCliPath,
    skipNetworkCalls,
    credentialAvailable,
    sleepFn,
    mockGmgnStatsRunner,
    expectedHashes,
  } = options;

  if (!Number.isInteger(walletBatchSize) || walletBatchSize < 1 || walletBatchSize > GMGN_STATS_BATCH_SIZE) {
    throw new Error("Unsupported GMGN stats wallet batch size");
  }
  const actualMaxBudget = maxRequestBudget ?? Math.ceil(targetWalletCount / walletBatchSize) * 2;
  const expectedTxtHash = expectedHashes?.solAddressesTxtHash ?? EXPECTED_SOL_ADDRESSES_HASH;
  const expectedJsonHash = expectedHashes?.solAddressLabelsJsonHash ?? EXPECTED_SOL_LABELS_HASH;

  const warningCodeCounts: Record<string, number> = {};
  const addWarningCode = (code: AllowlistedGmgnWarningCode) => {
    warningCodeCounts[code] = (warningCodeCounts[code] || 0) + 1;
  };

  const sleep =
    sleepFn ||
    (async (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms)));

  // 1. Verify input directory & files exist and match exact SHA-256 hashes
  const txtPath = path.join(inputDir, "sol_addresses.txt");
  const jsonPath = path.join(inputDir, "sol_address_labels.json");

  if (!fs.existsSync(txtPath) || !fs.existsSync(jsonPath)) {
    addWarningCode("input_manifest_mismatch");
    return failClosedResult(outputDir, warningCodeCounts, "input_manifest_mismatch", taskId, actualMaxBudget);
  }

  const actualTxtHash = computeFileSha256(txtPath);
  const actualJsonHash = computeFileSha256(jsonPath);

  const inputHashesMatch =
    actualTxtHash === expectedTxtHash &&
    actualJsonHash === expectedJsonHash;

  if (!inputHashesMatch) {
    addWarningCode("input_manifest_mismatch");
    return failClosedResult(outputDir, warningCodeCounts, "input_manifest_mismatch", taskId, actualMaxBudget);
  }

  // 2. Read an existing cleaned result only. This task must never write into
  // the external input directory; a missing cleaned result therefore fails closed.
  const cleanedJsonlPath = path.join(inputDir, "cleaned.jsonl");
  if (!fs.existsSync(cleanedJsonlPath)) {
    addWarningCode("input_manifest_mismatch");
    return failClosedResult(outputDir, warningCodeCounts, "input_manifest_mismatch", taskId, actualMaxBudget);
  }

  // 3. Extract addresses from cleaned.jsonl and select target wallets using deterministic rules
  const cleanedLines = fs
    .readFileSync(cleanedJsonlPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  const validUniqueAddresses: string[] = [];
  const seenAddresses = new Set<string>();

  for (const line of cleanedLines) {
    try {
      const record = JSON.parse(line);
      const normalized = normalizeSolanaAddress(record.address);
      if (normalized && !seenAddresses.has(normalized)) {
        seenAddresses.add(normalized);
        validUniqueAddresses.push(normalized);
      }
    } catch {
      // Ignore unparseable line
    }
  }

  const selectedAddresses = validUniqueAddresses.slice(
    offsetWalletCount,
    offsetWalletCount + targetWalletCount
  );

  if (
    selectedAddresses.length !== targetWalletCount ||
    (targetWalletCount === 1433 && validUniqueAddresses.length !== 1433)
  ) {
    addWarningCode("gmgn_wallet_input_invalid");
    return failClosedResult(outputDir, warningCodeCounts, "gmgn_wallet_input_invalid", taskId, actualMaxBudget);
  }

  // 4. Determine credential status by presence only; never log or persist it.
  const credentialPresent =
    credentialAvailable !== undefined
      ? credentialAvailable
      : Object.prototype.hasOwnProperty.call(process.env, "GMGN_API_KEY");

  const fetchedAt = new Date().toISOString();
  const periods: Array<"7d" | "30d"> = ["7d", "30d"];
  const records: NormalizedWalletProfileRecord[] = [];

  let totalRequestsUsed = 0;

  if (skipNetworkCalls || !credentialPresent) {
    const warningCode = !credentialPresent
      ? "gmgn_credential_unavailable"
      : "gmgn_request_unavailable";
    addWarningCode(warningCode);

    for (const period of periods) {
      for (const walletAddress of selectedAddresses) {
        records.push(
          buildUnavailableRecord(
            walletAddress,
            period,
            warningCode,
            0,
            fetchedAt
          )
        );
      }
    }
  } else {
    // gmgn-cli portfolio stats accepts multiple wallets. A bounded batch is one
    // CLI invocation and one request-budget unit; periods remain strictly serial.
    const resolvedCliPath =
      gmgnCliPath || path.resolve("node_modules/gmgn-cli/dist/index.js");

    for (const period of periods) {
      for (let batchStart = 0; batchStart < selectedAddresses.length; batchStart += walletBatchSize) {
        const walletBatch = selectedAddresses.slice(batchStart, batchStart + walletBatchSize);
        if (totalRequestsUsed >= actualMaxBudget) {
          addWarningCode("gmgn_rate_limited");
          for (const walletAddress of walletBatch) {
            records.push(buildUnavailableRecord(
              walletAddress, period, "gmgn_rate_limited", totalRequestsUsed, fetchedAt,
            ));
          }
          continue;
        }

        if (totalRequestsUsed > 0) await sleep(1000);
        totalRequestsUsed += 1;

        let rawOutput = "";
        let rawError = "";
        let exitCode = -1;
        let timedOut = false;

        if (mockGmgnStatsRunner) {
          const result = mockGmgnStatsRunner(walletBatch, period);
          exitCode = result.exitCode;
          rawOutput = result.stdout;
          rawError = result.stderr ?? "";
          timedOut = result.timedOut ?? false;
        } else {
          const isolation = createGmgnCliIsolation();
          try {
            const invocation = buildGmgnStatsInvocation({
              cliPath: resolvedCliPath,
              walletAddresses: walletBatch,
              period,
              cwd: isolation.cwd,
              env: buildApiKeyOnlyGmgnCliEnvironment({
                runtimeEnvironment: process.env,
                isolatedHome: isolation.home,
                apiKey: process.env.GMGN_API_KEY,
              }),
            });
            const proc = spawnSync(process.execPath, invocation.args, {
              cwd: invocation.cwd,
              env: invocation.env,
              encoding: "utf8",
              maxBuffer: 2_000_000,
              shell: false,
              timeout: invocation.timeoutMs,
            });
            exitCode = proc.status ?? -1;
            rawOutput = String(proc.stdout ?? "");
            rawError = String(proc.stderr ?? "");
            timedOut = (proc.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
          } catch {
            rawOutput = "";
            rawError = "";
          } finally {
            isolation.cleanup();
          }
        }

        if (exitCode !== 0 || !rawOutput.trim()) {
          const warningCode = toAllowlistedWarningCode(
            classifyGmgnCliFailure({ exitCode, timedOut, stdout: rawOutput, stderr: rawError }),
          );
          rawOutput = "";
          rawError = "";
          addWarningCode(warningCode);
          for (const walletAddress of walletBatch) {
            records.push(buildUnavailableRecord(
              walletAddress, period, warningCode, totalRequestsUsed, fetchedAt,
            ));
          }
          continue;
        }

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(rawOutput);
        } catch {
          const warningCode = "gmgn_response_invalid";
          addWarningCode(warningCode);
          for (const walletAddress of walletBatch) {
            records.push(buildUnavailableRecord(
              walletAddress, period, warningCode, totalRequestsUsed, fetchedAt,
            ));
          }
          continue;
        } finally {
          rawOutput = "";
          rawError = "";
        }

        const parsedResults = parseGmgnWalletStats(parsedJson, walletBatch);
        for (const parsed of parsedResults) {
          const walletAddress = parsed.wallet;
          if (parsed.status === "MAPPED") {
            const aggregates: NormalizedWalletMetrics = {
              periodPnl: parsed.aggregates.periodPnl ?? null,
              realizedProfit: parsed.aggregates.realizedProfit ?? null,
              realizedProfitPnl: parsed.aggregates.realizedProfitPnl ?? null,
              winRate: parsed.aggregates.winRate ?? null,
              tradeCount: parsed.aggregates.tradeCount ?? null,
              buyCount: parsed.aggregates.buyCount ?? null,
              sellCount: parsed.aggregates.sellCount ?? null,
              boughtCost: parsed.aggregates.boughtCost ?? null,
              soldIncome: parsed.aggregates.soldIncome ?? null,
              lastActiveTimestamp: parsed.aggregates.lastActiveTimestamp ?? null,
              tokenNum: parsed.aggregates.tokenNum ?? null,
            };
            const nonNullCount = Object.values(aggregates).filter((value) => value !== null).length;
            if (nonNullCount > 0) {
              records.push({
                period,
                status: "MAPPED",
                source: "gmgn",
                verificationStatus: "unverified",
                completeness: Math.round((nonNullCount / 11) * 100) / 100,
                aggregates,
                warningCodes: [],
                requestBudgetUsed: totalRequestsUsed,
                sourceInputFingerprint: computeStringSha256(walletAddress),
                fetchedAt,
              });
              continue;
            }
          }

          const warningCode = toAllowlistedWarningCode(
            parsed.warningCodes[0] ?? "gmgn_expected_metrics_unavailable",
          );
          addWarningCode(warningCode);
          records.push(buildUnavailableRecord(
            walletAddress, period, warningCode, totalRequestsUsed, fetchedAt,
          ));
        }
      }
    }
  }

  // 5. Persist only the allowlisted normalized external representation.
  const outputFiles = writeExternalOutputs(
    outputDir,
    records,
    warningCodeCounts,
    totalRequestsUsed,
    fetchedAt,
  );

  const mappedCount = records.filter((record) => record.status === "MAPPED").length;
  const partialCount = records.filter((record) => record.status === "PARTIAL").length;
  const unavailableCount = records.filter((record) => record.status === "UNAVAILABLE").length;

  return {
    status: mappedCount > 0 ? "SUCCESS" : "PARK",
    taskId,
    inputHashesMatch,
    selectedCount: selectedAddresses.length,
    mappedCount,
    partialCount,
    unavailableCount,
    requestBudgetUsed: totalRequestsUsed,
    maxRequestBudget: actualMaxBudget,
    warningCodeCounts,
    outputFiles,
    records,
  };
}

function buildUnavailableRecord(
  walletAddress: string,
  period: "7d" | "30d",
  warningCode: AllowlistedGmgnWarningCode,
  requestBudgetUsed: number,
  fetchedAt: string
): NormalizedWalletProfileRecord {
  return {
    period,
    status: "UNAVAILABLE",
    source: "gmgn",
    verificationStatus: "unverified",
    completeness: 0,
    aggregates: {
      periodPnl: null,
      realizedProfit: null,
      realizedProfitPnl: null,
      winRate: null,
      tradeCount: null,
      buyCount: null,
      sellCount: null,
      boughtCost: null,
      soldIncome: null,
      lastActiveTimestamp: null,
      tokenNum: null,
    },
    warningCodes: [warningCode],
    requestBudgetUsed,
    sourceInputFingerprint: computeStringSha256(walletAddress),
    fetchedAt,
  };
}

function failClosedResult(
  outputDir: string,
  warningCodeCounts: Record<string, number>,
  primaryErrorCode: string,
  taskId: string = PILOT_TASK_ID,
  maxRequestBudget: number = MAX_REQUEST_BUDGET
): WalletProfilePilotResult {
  const fetchedAt = new Date().toISOString();
  const safePrimaryErrorCode = toAllowlistedWarningCode(primaryErrorCode);
  const outputFiles = writeExternalOutputs(
    outputDir,
    [],
    { ...warningCodeCounts, [safePrimaryErrorCode]: warningCodeCounts[safePrimaryErrorCode] ?? 1 },
    0,
    fetchedAt,
  );

  return {
    status: "FAIL_CLOSED",
    taskId,
    inputHashesMatch: false,
    selectedCount: 0,
    mappedCount: 0,
    partialCount: 0,
    unavailableCount: 0,
    requestBudgetUsed: 0,
    maxRequestBudget,
    warningCodeCounts,
    outputFiles,
    records: [],
  };
}
