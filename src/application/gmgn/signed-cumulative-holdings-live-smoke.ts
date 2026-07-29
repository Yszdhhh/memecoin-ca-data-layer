import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

import { normalizeSolanaAddress } from "../../domain/solana-address.js";
import {
  buildBoundedSignedGmgnCliEnvironment,
  buildGmgnCumulativeHoldingsInvocation,
  classifyGmgnCliFailure,
  createGmgnCliIsolation,
  type GmgnCliInvocation,
  type GmgnCliIsolation,
  type AllowlistedGmgnCliFailureCode,
} from "./gmgn-cli-boundary.js";
import {
  parseGmgnWalletHoldingsPage,
  type ParsedGmgnWalletHoldingsPage,
} from "../../infrastructure/gmgn/wallet-holdings-parser.js";

export const GMGN_SIGNED_HOLDINGS_SMOKE_LOCAL_CODES = [
  "gmgn_input_unavailable",
  "gmgn_input_hash_mismatch",
  "gmgn_input_no_valid_address",
  "gmgn_credentials_missing",
] as const;

export type GmgnSignedHoldingsSmokeLocalCode =
  (typeof GMGN_SIGNED_HOLDINGS_SMOKE_LOCAL_CODES)[number];
export type GmgnSignedHoldingsSmokeCode =
  | GmgnSignedHoldingsSmokeLocalCode
  | AllowlistedGmgnCliFailureCode;

export interface GmgnSignedHoldingsSmokeResult {
  status: "PARK" | "UNAVAILABLE" | "MAPPED" | "PARTIAL";
  sourceInputFingerprint: string | null;
  requestBudgetUsed: number;
  requestBudgetCap: number;
  physicalProviderRequestCap: number;
  rateLimitAutoRetryMaxWaitMs: 0;
  source: "gmgn" | null;
  verificationStatus: "unverified" | null;
  warningCodes: readonly string[];
  diagnosticCode: GmgnSignedHoldingsSmokeCode | null;
  record: ParsedGmgnWalletHoldingsPage | null;
}

export interface GmgnCliExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
}

export interface BoundedSignedHoldingsSmokeDependencies {
  readFileBytes(filePath: string): Promise<Uint8Array>;
  createIsolation(): GmgnCliIsolation;
  execute(invocation: GmgnCliInvocation): Promise<GmgnCliExecutionResult>;
}

export interface RunBoundedSignedHoldingsSmokeInput {
  addressesPath: string;
  labelsPath: string;
  expectedAddressesSha256: string;
  expectedLabelsSha256: string;
  cliPath: string;
  runtimeEnvironment: NodeJS.ProcessEnv;
  dependencies?: Partial<BoundedSignedHoldingsSmokeDependencies>;
}

function sha256(value: Uint8Array | string): string {
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
  return sha256(`gmgn-signed-cumulative-holdings-live-smoke-001:${address}`);
}

function safeResult(input: {
  status: GmgnSignedHoldingsSmokeResult["status"];
  requestBudgetUsed: number;
  sourceInputFingerprint?: string | null;
  diagnosticCode?: GmgnSignedHoldingsSmokeCode | null;
  record?: ParsedGmgnWalletHoldingsPage | null;
}): GmgnSignedHoldingsSmokeResult {
  const record = input.record ?? null;
  return {
    status: input.status,
    sourceInputFingerprint: input.sourceInputFingerprint ?? null,
    requestBudgetUsed: input.requestBudgetUsed,
    requestBudgetCap: 1,
    physicalProviderRequestCap: 1,
    rateLimitAutoRetryMaxWaitMs: 0,
    source: record?.source ?? null,
    verificationStatus: record?.verificationStatus ?? null,
    warningCodes: record?.warningCodes ?? [],
    diagnosticCode: input.diagnosticCode ?? null,
    record,
  };
}

async function executeGmgnCli(invocation: GmgnCliInvocation): Promise<GmgnCliExecutionResult> {
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, invocation.args, {
      cwd: invocation.cwd,
      env: invocation.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.once("error", () => resolve({ exitCode: null, stdout, stderr }));
    child.once("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
}

const defaultDependencies: BoundedSignedHoldingsSmokeDependencies = {
  readFileBytes: async (filePath) => await readFile(filePath),
  createIsolation: () => createGmgnCliIsolation(),
  execute: executeGmgnCli,
};

/**
 * The only path that may invoke the signed holdings CLI for this smoke.
 * It returns no selected address, raw payload, raw stdout/stderr, or error text.
 */
export async function runBoundedSignedHoldingsSmoke(
  input: RunBoundedSignedHoldingsSmokeInput,
): Promise<GmgnSignedHoldingsSmokeResult> {
  const dependencies: BoundedSignedHoldingsSmokeDependencies = {
    ...defaultDependencies,
    ...input.dependencies,
  };

  let addressesBytes: Uint8Array;
  let labelsBytes: Uint8Array;
  try {
    [addressesBytes, labelsBytes] = await Promise.all([
      dependencies.readFileBytes(input.addressesPath),
      dependencies.readFileBytes(input.labelsPath),
    ]);
  } catch {
    return safeResult({ status: "PARK", requestBudgetUsed: 0, diagnosticCode: "gmgn_input_unavailable" });
  }

  if (sha256(addressesBytes) !== input.expectedAddressesSha256 || sha256(labelsBytes) !== input.expectedLabelsSha256) {
    return safeResult({ status: "PARK", requestBudgetUsed: 0, diagnosticCode: "gmgn_input_hash_mismatch" });
  }

  const selectedAddress = selectFirstValidUniqueSolanaAddress(Buffer.from(addressesBytes).toString("utf8"));
  addressesBytes = new Uint8Array();
  labelsBytes = new Uint8Array();
  if (selectedAddress === null) {
    return safeResult({ status: "PARK", requestBudgetUsed: 0, diagnosticCode: "gmgn_input_no_valid_address" });
  }

  const apiKey = input.runtimeEnvironment.GMGN_API_KEY;
  const privateKey = input.runtimeEnvironment.GMGN_PRIVATE_KEY;
  if (apiKey === undefined || apiKey === "" || privateKey === undefined || privateKey === "") {
    return safeResult({
      status: "PARK",
      requestBudgetUsed: 0,
      sourceInputFingerprint: targetFingerprint(selectedAddress),
      diagnosticCode: "gmgn_credentials_missing",
    });
  }

  const fingerprint = targetFingerprint(selectedAddress);
  const isolation = dependencies.createIsolation();
  try {
    const environment = buildBoundedSignedGmgnCliEnvironment({
      runtimeEnvironment: input.runtimeEnvironment,
      isolatedHome: isolation.home,
      apiKey,
      privateKey,
    });
    const invocation = buildGmgnCumulativeHoldingsInvocation({
      cliPath: input.cliPath,
      walletAddress: selectedAddress,
      cwd: isolation.cwd,
      env: environment,
    });
    const execution = await dependencies.execute(invocation);
    if (execution.exitCode !== 0) {
      const diagnosticCode = classifyGmgnCliFailure(execution);
      return safeResult({
        status: "UNAVAILABLE",
        requestBudgetUsed: 1,
        sourceInputFingerprint: fingerprint,
        diagnosticCode,
      });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(execution.stdout);
    } catch {
      const diagnosticCode = classifyGmgnCliFailure(execution);
      return safeResult({
        status: "UNAVAILABLE",
        requestBudgetUsed: 1,
        sourceInputFingerprint: fingerprint,
        diagnosticCode,
      });
    }

    const record = parseGmgnWalletHoldingsPage(payload);
    return safeResult({
      status: record.status,
      requestBudgetUsed: 1,
      sourceInputFingerprint: fingerprint,
      record,
    });
  } catch {
    return safeResult({
      status: "UNAVAILABLE",
      requestBudgetUsed: 1,
      sourceInputFingerprint: fingerprint,
      diagnosticCode: "gmgn_request_unavailable",
    });
  } finally {
    isolation.cleanup();
  }
}
