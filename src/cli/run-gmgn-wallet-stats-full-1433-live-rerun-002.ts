import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  EXPECTED_SOL_ADDRESSES_HASH,
  EXPECTED_SOL_LABELS_HASH,
  FULL_1433_RERUN_MAX_CLI_INVOCATION_BUDGET,  FULL_1433_TARGET_WALLET_COUNT,
  runGmgnWalletProfilePilot,
  type NormalizedWalletMetrics,
  type WalletProfilePilotResult,
} from "../application/gmgn/wallet-profile-pilot.js";

const TASK_ID = "SOL-GMGN-WALLET-STATS-FULL-1433-LIVE-RERUN-002";
const WALLET_BATCH_SIZE = 1;

const INPUT_DIR = path.resolve("C:/Users/10639/chainfm_out/sol");
const OUTPUT_DIR = path.resolve(
  "C:/Users/10639/chainfm_out/sol/derived/gmgn-wallet-stats-full-1433-live-rerun-002",
);
const REPORT_PATH = path.resolve(
  "harness/reports/SOL-GMGN-WALLET-STATS-FULL-1433-LIVE-RERUN-002/acceptance.md",
);

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

function sequenceFingerprint(result: WalletProfilePilotResult): string | null {
  const fingerprints = Array.from(
    new Set(result.records.map((record) => record.sourceInputFingerprint)),
  );
  return fingerprints.length === 0
    ? null
    : crypto.createHash("sha256").update(fingerprints.join("\n")).digest("hex").toUpperCase();
}

function averageCompleteness(result: WalletProfilePilotResult): number | null {
  if (result.records.length === 0) return null;
  const sum = result.records.reduce((total, record) => total + record.completeness, 0);
  return Math.round((sum / result.records.length) * 10_000) / 10_000;
}

function coverage(result: WalletProfilePilotResult, key: keyof NormalizedWalletMetrics): number | null {
  if (result.records.length === 0) return null;
  const present = result.records.filter((record) => record.aggregates[key] !== null).length;
  return Math.round((present / result.records.length) * 10_000) / 10_000;
}

function renderAcceptance(result: WalletProfilePilotResult): string {
  const warnings = Object.entries(result.warningCodeCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => `| \`${code}\` | ${count} |`)
    .join("\n") || "| none | 0 |";
  const fields = metricKeys
    .map((key) => `| \`${key}\` | ${coverage(result, key) ?? "null"} |`)
    .join("\n");

  return `# Acceptance Report: ${TASK_ID}

## Execution verdict

**${result.status}** - independent zero-network audit remains required.

## Input and selection evidence

- Input SHA-256 verification: ${result.inputHashesMatch ? "MATCH" : "MISMATCH"}
- Approved sol_addresses.txt SHA-256: \`${EXPECTED_SOL_ADDRESSES_HASH}\`
- Approved sol_address_labels.json SHA-256: \`${EXPECTED_SOL_LABELS_HASH}\`
- Selection rule: all valid unique Solana Base58 strict-32-byte addresses in deterministic cleaned-input order
- Selected count: ${result.selectedCount}
- Aggregate irreversible selection fingerprint: \`${sequenceFingerprint(result) ?? "null"}\`

## Request budget and outcomes

- Periods: \`7d\`, \`30d\`
- Wallets per CLI invocation: 1
- Planned invocations per period: 1,433
- CLI invocation/provider upper bound: ${FULL_1433_RERUN_MAX_CLI_INVOCATION_BUDGET}
- CLI invocation budget used: ${result.requestBudgetUsed}
- Budget respected: ${result.requestBudgetUsed <= FULL_1433_RERUN_MAX_CLI_INVOCATION_BUDGET}
- Execution ordering: strictly serial, at least 1,000ms between adjacent invocations
- Normalized records: ${result.records.length}
- MAPPED / PARTIAL / UNAVAILABLE: ${result.mappedCount} / ${result.partialCount} / ${result.unavailableCount}
- Average completeness: ${averageCompleteness(result) ?? "null"}
- Source semantics: \`source: "gmgn"\`, \`verificationStatus: "unverified"\`

## Field coverage

| Allowlisted normalized field | Coverage ratio |
|---|---:|
${fields}

## Allowlisted warning/error codes

| Code | Count |
|---|---:|
${warnings}

## Safety boundaries

- External normalized output was written only under \`C:/Users/10639/chainfm_out/sol/derived/gmgn-wallet-stats-full-1433-live-rerun-002/\`.
- No plaintext address or label, API/private key, credential or proxy URL, raw provider payload, raw stdout/stderr, token or transaction identifier, counterparty data, or complete exception is stored in Git evidence or external normalized output.
- Missing fields remain null. Provider-supplied zeros remain explicit zeros and are not interpreted as verified profitability.
- No Helius, signed holdings, other provider, fallback, retry, pagination, concurrency, persistence system, ranking, or LLM conclusion was used.
- Historical 100-wallet and 1,433-wallet outputs were not overwritten or reinterpreted.

## Completion boundary

This implementer delivery is not final. The batch may be marked complete only after \`SOL-GMGN-WALLET-STATS-FULL-1433-LIVE-RERUN-002-AUDIT-001\` performs a zero-network independent audit and returns GREEN.
`;
}

async function main(): Promise<void> {
  if (fs.existsSync(OUTPUT_DIR)) {
    throw new Error("Refusing to overwrite the designated full-rerun output directory");
  }

  const result = await runGmgnWalletProfilePilot({
    taskId: TASK_ID,
    inputDir: INPUT_DIR,
    outputDir: OUTPUT_DIR,
    targetWalletCount: FULL_1433_TARGET_WALLET_COUNT,
    offsetWalletCount: 0,
    maxRequestBudget: FULL_1433_RERUN_MAX_CLI_INVOCATION_BUDGET,
    walletBatchSize: WALLET_BATCH_SIZE,
  });

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, renderAcceptance(result), "utf8");

  console.log("Task ID:", result.taskId);
  console.log("Status:", result.status);
  console.log("Input Hashes Match:", result.inputHashesMatch);
  console.log("Selected Count:", result.selectedCount);
  console.log("Normalized Records:", result.records.length);
  console.log("Mapped Count:", result.mappedCount);
  console.log("Partial Count:", result.partialCount);
  console.log("Unavailable Count:", result.unavailableCount);
  console.log("Average Completeness:", averageCompleteness(result));
  console.log("CLI Invocation Budget Used:", result.requestBudgetUsed);
  console.log("CLI Invocation Budget Cap:", FULL_1433_RERUN_MAX_CLI_INVOCATION_BUDGET);
  console.log("Selection Fingerprint:", sequenceFingerprint(result));
  console.log("Warning Code Counts:", result.warningCodeCounts);
  console.log("Source: gmgn");
  console.log("Verification Status: unverified");
}

main().catch(() => {
  console.error("Full GMGN wallet stats rerun failed safely");
  process.exit(1);
});
