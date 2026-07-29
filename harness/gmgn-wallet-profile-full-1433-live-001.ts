import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  runGmgnWalletProfilePilot,
  FULL_1433_TASK_ID,
  EXPECTED_SOL_ADDRESSES_HASH,
  EXPECTED_SOL_LABELS_HASH,
  type NormalizedWalletMetrics,
  type WalletProfilePilotResult,
} from "../src/application/gmgn/wallet-profile-pilot.js";

const ROOT = process.cwd();
const REPORT_PATH = resolve(
  ROOT,
  "harness/reports/SOL-GMGN-WALLET-PROFILE-FULL-1433-LIVE-001/acceptance.md"
);
const INPUT_DIR = "C:\\Users\\10639\\chainfm_out\\sol";
const OUTPUT_DIR =
  "C:\\Users\\10639\\chainfm_out\\sol\\derived\\gmgn-wallet-profile-full-1433-live-001";
const TARGET_WALLET_COUNT = 1433;
const OFFSET_WALLET_COUNT = 0;
const MAX_REQUEST_BUDGET = 2866;
const IMPLEMENTER_AGENT_ID = "implementer-sol-gmgn-wallet-profile-full-1433-live-001";

async function main(): Promise<void> {
  const result = await runGmgnWalletProfilePilot({
    taskId: FULL_1433_TASK_ID,
    inputDir: INPUT_DIR,
    outputDir: OUTPUT_DIR,
    targetWalletCount: TARGET_WALLET_COUNT,
    offsetWalletCount: OFFSET_WALLET_COUNT,
    maxRequestBudget: MAX_REQUEST_BUDGET,
  });

  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, renderAcceptanceReport(result), "utf8");

  console.log(JSON.stringify({
    task_id: FULL_1433_TASK_ID,
    status: result.status,
    selected_count: result.selectedCount,
    total_records: result.records.length,
    mapped_count: result.mappedCount,
    partial_count: result.partialCount,
    unavailable_count: result.unavailableCount,
    average_completeness: averageCompleteness(result),
    request_budget_used: result.requestBudgetUsed,
    request_budget_limit: MAX_REQUEST_BUDGET,
    request_limit_satisfied: result.requestBudgetUsed <= MAX_REQUEST_BUDGET,
    selection_fingerprint: selectionFingerprint(result),
    warning_code_counts: result.warningCodeCounts,
  }));
}

function selectionFingerprint(res: WalletProfilePilotResult): string | null {
  const fingerprints = Array.from(new Set(res.records.map((record) => record.sourceInputFingerprint)));
  return fingerprints.length > 0
    ? crypto.createHash("sha256").update(fingerprints.join("\n")).digest("hex")
    : null;
}

function averageCompleteness(res: WalletProfilePilotResult): number | null {
  return res.records.length > 0
    ? Math.round((res.records.reduce((sum, record) => sum + record.completeness, 0) / res.records.length) * 100) / 100
    : null;
}

function fieldCoverage(res: WalletProfilePilotResult): Array<[keyof NormalizedWalletMetrics, number | null]> {
  const metricKeys: Array<keyof NormalizedWalletMetrics> = [
    "periodPnl",
    "realizedProfit",
    "realizedProfitPnl",
    "winRate",
    "tradeCount",
    "buyCount",
    "sellCount",
    "boughtCost",
    "soldIncome",
    "lastActiveTimestamp",
    "tokenNum",
  ];
  return metricKeys.map((key) => {
    if (res.records.length === 0) return [key, null];
    const populated = res.records.filter((record) => record.aggregates[key] !== null).length;
    return [key, Math.round((populated / res.records.length) * 10_000) / 100];
  });
}

function renderAcceptanceReport(res: WalletProfilePilotResult): string {
  const warningCountsTable = Object.entries(res.warningCodeCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => `| \`${code}\` | ${count} |`)
    .join("\n") || "| none | 0 |";
  const fieldCoverageTable = fieldCoverage(res)
    .map(([field, coverage]) => `| \`${field}\` | ${coverage === null ? "null" : `${coverage}%`} |`)
    .join("\n");

  return `# Acceptance Report: SOL-GMGN-WALLET-PROFILE-FULL-1433-LIVE-001

## Execution Gate

- **Task ID**: \`${FULL_1433_TASK_ID}\`
- **Role / HARNESS_AGENT_ID**: implementer / \`${IMPLEMENTER_AGENT_ID}\`
- **Run status**: \`${res.status}\`
- **Independent-completion gate**: This full 1433 run is **not complete** until \`SOL-GMGN-WALLET-PROFILE-FULL-1433-LIVE-AUDIT-001\` produces valid GREEN audit evidence from a different agent identity (\`auditor-sol-gmgn-wallet-profile-full-1433-live-001\`).

## Input Evidence and Deterministic Selection

- **\`sol_addresses.txt\` SHA-256**: \`${EXPECTED_SOL_ADDRESSES_HASH}\`
- **\`sol_address_labels.json\` SHA-256**: \`${EXPECTED_SOL_LABELS_HASH}\`
- **Hash gate passed before request eligibility**: \`${res.inputHashesMatch}\`
- **Selection rule**: Base58 plus exact 32-byte validation and input-order deduplication; select all 1,433 valid unique addresses in input sequence.
- **Selected wallet count**: \`${res.selectedCount}\` (target: \`${TARGET_WALLET_COUNT}\`)
- **Irreversible selected-fingerprint sequence SHA-256**: \`${selectionFingerprint(res) ?? "null"}\`

## Request Budget and Aggregate Results

- **Periods**: \`7d\`, \`30d\`
- **Expected maximum requests**: \`${MAX_REQUEST_BUDGET}\`
- **Request budget used**: \`${res.requestBudgetUsed}\`
- **Budget respected**: \`${res.requestBudgetUsed <= MAX_REQUEST_BUDGET}\`
- **Serial request minimum interval**: \`>= 1,000ms\`
- **Normalized records**: \`${res.records.length}\`
- **Mapped / partial / unavailable**: \`${res.mappedCount}\` / \`${res.partialCount}\` / \`${res.unavailableCount}\`
- **Average completeness**: \`${averageCompleteness(res) ?? "null"}\`
- **GMGN classification**: \`source: "gmgn"\`, \`verificationStatus: "unverified"\` only.

## Field Coverage

| Allowlisted normalized field | Coverage |
|---|---:|
${fieldCoverageTable}

## Allowlisted Warning / Error Codes

| Code | Count |
|---|---:|
${warningCountsTable}

## Safety and Evidence Boundaries

- The external derived files contain only allowlisted normalized metrics, nulls for missing values, safe warning codes, request-budget data, source metadata, irreversible input fingerprints, and fetch timestamps.
- No plaintext addresses or labels, API/private keys, credential URLs, raw provider payloads, or complete provider exceptions are written to Git evidence or the normalized external output.
- The acceptance report contains only the single aggregate sequence fingerprint; no per-address fingerprint table is emitted.
- The implementation is Solana-only, manual, single-run, read-only, GMGN-only, without Helius, BSC, Robinhood, scraping, browser automation, fallback providers, persistence systems, background/cron work, wallet-quality rankings, UR/N/P grading, or LLM conclusions.
- Harness command outcomes are recorded in the Harness run manifest; this report does not pre-assert verification success.
`;
}

void main();
