import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  runGmgnWalletProfilePilot,
  type NormalizedWalletMetrics,
  type WalletProfilePilotResult,
} from "../application/gmgn/wallet-profile-pilot.js";

export const TASK_ID = "SOL-GMGN-WALLET-STATS-SINGLE-WALLET-TRANSPORT-7D-30D-LIVE-RESMOKE-001";
export const TARGET_WALLET_COUNT = 2;
export const MAX_CLI_INVOCATIONS = 4;
export const WALLET_BATCH_SIZE = 1;
const INPUT_DIR = path.resolve("C:/Users/10639/chainfm_out/sol");
const OUTPUT_DIR = path.resolve("C:/Users/10639/chainfm_out/sol/derived/gmgn-wallet-stats-single-wallet-transport-7d-30d-live-resmoke-001");
const REPORT_PATH = path.resolve("harness/reports", TASK_ID, "acceptance.md");

const metricKeys: Array<keyof NormalizedWalletMetrics> = [
  "periodPnl", "realizedProfit", "realizedProfitPnl", "winRate", "tradeCount",
  "buyCount", "sellCount", "boughtCost", "soldIncome", "lastActiveTimestamp", "tokenNum",
];

function aggregateFingerprint(result: WalletProfilePilotResult): string | null {
  const values = result.records.map((record) => record.sourceInputFingerprint);
  return values.length === 0 ? null : createHash("sha256").update(values.join("\n")).digest("hex").toUpperCase();
}

function coverage(result: WalletProfilePilotResult, key: keyof NormalizedWalletMetrics): number | null {
  if (result.records.length === 0) return null;
  return Math.round(result.records.filter((record) => record.aggregates[key] !== null).length / result.records.length * 10_000) / 10_000;
}

function renderAcceptance(result: WalletProfilePilotResult, fingerprint: string | null): string {
  const allUsable = result.records.length === 4 && result.unavailableCount === 0 && result.mappedCount + result.partialCount === 4;
  const warnings = Object.entries(result.warningCodeCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([warningCode, count]) => "| `" + warningCode + "` | " + count + " |")
    .join("\n") || "| none | 0 |";
  const fields = metricKeys.map((key) => "| `" + key + "` | " + (coverage(result, key) ?? "null") + " |").join("\n");
  return "# Acceptance Report: " + TASK_ID + "\n\n" +
    "## Live verdict\n\n**" + (allUsable ? "GREEN_PENDING_AUDIT" : "PARKED_DATA_QUALITY") + "**\n\n" +
    "- Input hashes: " + (result.inputHashesMatch ? "MATCH" : "MISMATCH") + "\n" +
    "- Selection: first 2 valid unique strict-32-byte Solana addresses, plaintext never persisted\n" +
    "- Aggregate irreversible fingerprint: `" + (fingerprint ?? "null") + "`\n" +
    "- Periods: 7d and 30d\n- Wallets per invocation: 1\n" +
    "- CLI/provider budget used/cap: " + result.requestBudgetUsed + " / " + MAX_CLI_INVOCATIONS + "\n" +
    "- Strict serial spacing: at least 1,000ms\n" +
    "- Records: " + result.records.length + "\n" +
    "- MAPPED / PARTIAL / UNAVAILABLE: " + result.mappedCount + " / " + result.partialCount + " / " + result.unavailableCount + "\n" +
    "- All four wallet-period observations usable: " + allUsable + "\n" +
    "- Source: `gmgn`; verificationStatus: `unverified`\n\n" +
    "## Field coverage\n\n| Field | Ratio |\n|---|---:|\n" + fields + "\n\n" +
    "## Allowlisted warnings\n\n| Code | Count |\n|---|---:|\n" + warnings + "\n\n" +
    "## Boundary\n\nNo full rerun is authorized until the independent audit returns GREEN. No raw payload, raw stdout/stderr, address, label, key, proxy URL, or complete exception is retained.\n";
}

async function main(): Promise<void> {
  if (fs.existsSync(OUTPUT_DIR)) throw new Error("Refusing to overwrite bounded re-smoke output");
  const result = await runGmgnWalletProfilePilot({
    taskId: TASK_ID,
    inputDir: INPUT_DIR,
    outputDir: OUTPUT_DIR,
    targetWalletCount: TARGET_WALLET_COUNT,
    offsetWalletCount: 0,
    maxRequestBudget: MAX_CLI_INVOCATIONS,
    walletBatchSize: WALLET_BATCH_SIZE,
  });
  const fingerprint = aggregateFingerprint(result);
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, renderAcceptance(result, fingerprint), "utf8");
  console.log("Task ID:", result.taskId);
  console.log("Status:", result.status);
  console.log("Input Hashes Match:", result.inputHashesMatch);
  console.log("Selected Count:", result.selectedCount);
  console.log("Records:", result.records.length);
  console.log("Mapped / Partial / Unavailable:", result.mappedCount, result.partialCount, result.unavailableCount);
  console.log("CLI Invocation Budget Used / Cap:", result.requestBudgetUsed, MAX_CLI_INVOCATIONS);
  console.log("Aggregate Fingerprint:", fingerprint);
  console.log("Warning Code Counts:", result.warningCodeCounts);
}

main().catch(() => {
  console.error("Bounded GMGN re-smoke failed safely");
  process.exit(1);
});
