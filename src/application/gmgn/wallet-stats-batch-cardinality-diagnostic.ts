import { createHash } from "node:crypto";
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
  type GmgnCliInvocation,
  type GmgnCliIsolation,
} from "./gmgn-cli-boundary.js";
import {
  summarizeGmgnWalletStatsEnvelope,
  type GmgnWalletStatsEnvelopeDiagnostic,
} from "../../infrastructure/gmgn/wallet-stats-envelope-diagnostics.js";

export const BATCH_CARDINALITY_DIAGNOSTIC_TASK_ID = "SOL-GMGN-WALLET-STATS-BATCH-CARDINALITY-LIVE-DIAGNOSTIC-001";
export const EXPECTED_SOL_ADDRESSES_HASH = "64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C";
export const EXPECTED_SOL_LABELS_HASH = "B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3";
export const DIAGNOSTIC_WALLET_COUNT = 20;
export const MAX_CLI_INVOCATIONS = 1;

export type BatchCardinalityDiagnosticCode =
  | "input_manifest_mismatch"
  | "gmgn_input_selection_mismatch"
  | "gmgn_credentials_missing"
  | "gmgn_response_invalid"
  | "gmgn_batch_response_incomplete"
  | "gmgn_request_unavailable"
  | ReturnType<typeof classifyGmgnCliFailure>;

export interface DiagnosticExecutionResult { exitCode: number | null; stdout: string; stderr: string; timedOut?: boolean }
export interface BatchCardinalityDependencies {
  readFileBytes(filePath: string): Promise<Uint8Array>;
  createIsolation(): GmgnCliIsolation;
  execute(invocation: GmgnCliInvocation): Promise<DiagnosticExecutionResult>;
}
export interface BatchCardinalityOptions {
  inputDir: string;
  gmgnCliPath?: string;
  runtimeEnvironment?: NodeJS.ProcessEnv;
  expectedHashes?: { solAddressesTxtHash?: string; solAddressLabelsJsonHash?: string };
  dependencies?: Partial<BatchCardinalityDependencies>;
}
export interface BatchCardinalityResult {
  status: "SUCCESS" | "INCOMPLETE" | "FAIL_CLOSED" | "PARK" | "UNAVAILABLE";
  inputHashesMatch: boolean;
  credentialApiKeyPresent: boolean;
  requestBudgetUsed: 0 | 1;
  requestBudgetCap: 1;
  diagnosticCode: BatchCardinalityDiagnosticCode | null;
  selectionFingerprint: string | null;
  envelope: GmgnWalletStatsEnvelopeDiagnostic | null;
  period: "30d";
  source: "gmgn";
  verificationStatus: "unverified";
}

function sha256Upper(value: Uint8Array | string): string { return createHash("sha256").update(value).digest("hex").toUpperCase(); }
function selectValidUnique(text: string): string[] {
  const selected: string[] = []; const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const address = normalizeSolanaAddress(line);
    if (address === null || seen.has(address)) continue;
    seen.add(address); selected.push(address);
    if (selected.length === DIAGNOSTIC_WALLET_COUNT) break;
  }
  return selected;
}
function selectionFingerprint(wallets: readonly string[]): string { return sha256Upper(
  [BATCH_CARDINALITY_DIAGNOSTIC_TASK_ID, ...wallets].join("\n"),
); }
async function defaultExecute(invocation: GmgnCliInvocation): Promise<DiagnosticExecutionResult> {
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, invocation.args, { cwd: invocation.cwd, env: invocation.env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = ""; let stderr = ""; let settled = false;
    const finish = (value: DiagnosticExecutionResult) => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => { child.kill(); finish({ exitCode: null, stdout, stderr, timedOut: true }); }, invocation.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.once("error", () => finish({ exitCode: null, stdout, stderr }));
    child.once("close", (exitCode) => finish({ exitCode, stdout, stderr }));
  });
}
const defaults: BatchCardinalityDependencies = { readFileBytes: async p => await readFile(p), createIsolation: () => createGmgnCliIsolation(), execute: defaultExecute };

export async function runBatchCardinalityDiagnostic(options: BatchCardinalityOptions): Promise<BatchCardinalityResult> {
  const environment = options.runtimeEnvironment ?? process.env;
  const dependencies = { ...defaults, ...options.dependencies };
  const base = { requestBudgetCap: 1 as const, period: "30d" as const, source: "gmgn" as const, verificationStatus: "unverified" as const };
  let addressesBytes: Uint8Array; let labelsBytes: Uint8Array;
  try { [addressesBytes, labelsBytes] = await Promise.all([dependencies.readFileBytes(path.join(options.inputDir,"sol_addresses.txt")), dependencies.readFileBytes(path.join(options.inputDir,"sol_address_labels.json"))]); }
  catch { return { ...base, status:"FAIL_CLOSED", inputHashesMatch:false, credentialApiKeyPresent:false, requestBudgetUsed:0, diagnosticCode:"input_manifest_mismatch", selectionFingerprint:null, envelope:null }; }
  const hashesMatch = sha256Upper(addressesBytes) === (options.expectedHashes?.solAddressesTxtHash ?? EXPECTED_SOL_ADDRESSES_HASH) && sha256Upper(labelsBytes) === (options.expectedHashes?.solAddressLabelsJsonHash ?? EXPECTED_SOL_LABELS_HASH);
  if (!hashesMatch) return { ...base, status:"FAIL_CLOSED", inputHashesMatch:false, credentialApiKeyPresent:false, requestBudgetUsed:0, diagnosticCode:"input_manifest_mismatch", selectionFingerprint:null, envelope:null };
  const wallets = selectValidUnique(Buffer.from(addressesBytes).toString("utf8")); addressesBytes = new Uint8Array(); labelsBytes = new Uint8Array();
  if (wallets.length !== DIAGNOSTIC_WALLET_COUNT) return { ...base, status:"FAIL_CLOSED", inputHashesMatch:true, credentialApiKeyPresent:false, requestBudgetUsed:0, diagnosticCode:"gmgn_input_selection_mismatch", selectionFingerprint:null, envelope:null };
  const fingerprint = selectionFingerprint(wallets);
  const apiKey = environment.GMGN_API_KEY; const present = apiKey !== undefined && apiKey.trim() !== "";
  if (!present) return { ...base, status:"PARK", inputHashesMatch:true, credentialApiKeyPresent:false, requestBudgetUsed:0, diagnosticCode:"gmgn_credentials_missing", selectionFingerprint:fingerprint, envelope:null };
  const isolation = dependencies.createIsolation();
  try {
    const invocation = buildGmgnStatsInvocation({ cliPath: options.gmgnCliPath ?? path.resolve("node_modules/gmgn-cli/dist/index.js"), walletAddresses: wallets, period:"30d", cwd:isolation.cwd, env:buildApiKeyOnlyGmgnCliEnvironment({ runtimeEnvironment:environment, isolatedHome:isolation.home, existAuthCredential:apiKey }) });
    const execution = await dependencies.execute(invocation);
    if (execution.exitCode !== 0) { const code=classifyGmgnCliFailure(execution); execution.stdout=""; execution.stderr=""; return { ...base,status:"UNAVAILABLE",inputHashesMatch:true,credentialApiKeyPresent:true,requestBudgetUsed:1,diagnosticCode:code,selectionFingerprint:fingerprint,envelope:null }; }
    let payload: unknown;
    try { payload=JSON.parse(execution.stdout); } catch { execution.stdout=""; execution.stderr=""; return { ...base,status:"UNAVAILABLE",inputHashesMatch:true,credentialApiKeyPresent:true,requestBudgetUsed:1,diagnosticCode:"gmgn_response_invalid",selectionFingerprint:fingerprint,envelope:null }; }
    execution.stdout=""; execution.stderr="";
    const envelope=summarizeGmgnWalletStatsEnvelope(payload,wallets); payload=undefined;
    const complete=envelope.responseCoversAllRequestedWallets;
    return { ...base,status:complete?"SUCCESS":"INCOMPLETE",inputHashesMatch:true,credentialApiKeyPresent:true,requestBudgetUsed:1,diagnosticCode:complete?null:"gmgn_batch_response_incomplete",selectionFingerprint:fingerprint,envelope };
  } catch (error) {
    const code = error instanceof GmgnCliEnvironmentError ? error.code : "gmgn_request_unavailable";
    return { ...base,status:"UNAVAILABLE",inputHashesMatch:true,credentialApiKeyPresent:true,requestBudgetUsed:1,diagnosticCode:code as BatchCardinalityDiagnosticCode,selectionFingerprint:fingerprint,envelope:null };
  } finally { isolation.cleanup(); }
}
