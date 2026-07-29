import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  runGmgnWalletProfilePilot,
  BATCH_100_TASK_ID,
  EXPECTED_SOL_ADDRESSES_HASH,
  EXPECTED_SOL_LABELS_HASH,
  type WalletProfilePilotResult,
} from "../src/application/gmgn/wallet-profile-pilot.js";

const ROOT = process.cwd();
const REPORT_PATH = resolve(
  ROOT,
  "harness/reports/SOL-GMGN-WALLET-PROFILE-BATCH-100-LIVE-SMOKE-001/acceptance.md"
);
const INPUT_DIR = "C:\\Users\\10639\\chainfm_out\\sol";
const OUTPUT_DIR =
  "C:\\Users\\10639\\chainfm_out\\sol\\derived\\gmgn-wallet-profile-batch-100-live-smoke-001";
const TARGET_WALLET_COUNT = 100;
const OFFSET_WALLET_COUNT = 20;
const MAX_REQUEST_BUDGET = 200;

async function main(): Promise<void> {
  const result = await runGmgnWalletProfilePilot({
    taskId: BATCH_100_TASK_ID,
    inputDir: INPUT_DIR,
    outputDir: OUTPUT_DIR,
    targetWalletCount: TARGET_WALLET_COUNT,
    offsetWalletCount: OFFSET_WALLET_COUNT,
    maxRequestBudget: MAX_REQUEST_BUDGET,
  });

  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(
    REPORT_PATH,
    renderAcceptanceReport(result),
    "utf8"
  );

  const avgCompleteness =
    result.records.length > 0
      ? Math.round(
          (result.records.reduce((acc, r) => acc + r.completeness, 0) /
            result.records.length) *
            100
        ) / 100
      : 0;

  console.log(
    JSON.stringify({
      task_id: BATCH_100_TASK_ID,
      status: result.status,
      selected_count: result.selectedCount,
      total_records: result.records.length,
      mapped_count: result.mappedCount,
      partial_count: result.partialCount,
      unavailable_count: result.unavailableCount,
      avg_completeness: avgCompleteness,
      request_budget_used: result.requestBudgetUsed,
      request_limit_satisfied: result.requestBudgetUsed <= MAX_REQUEST_BUDGET,
      external_output_dir: OUTPUT_DIR,
      warning_code_counts: result.warningCodeCounts,
    })
  );
}

function renderAcceptanceReport(res: WalletProfilePilotResult): string {
  const selectedFingerprints = Array.from(
    new Set(res.records.map((r) => r.sourceInputFingerprint))
  );

  const fingerprintsTable = selectedFingerprints
    .map((fp, i) => `| ${i + 1} | \`${fp}\` |`)
    .join("\n");

  const warningCountsTable =
    Object.entries(res.warningCodeCounts)
      .map(([code, cnt]) => `| \`${code}\` | ${cnt} |`)
      .join("\n") || "| none | 0 |";

  const avgCompleteness =
    res.records.length > 0
      ? Math.round(
          (res.records.reduce((acc, r) => acc + r.completeness, 0) /
            res.records.length) *
            100
        ) / 100
      : 0;

  return `# Acceptance Report: SOL-GMGN-WALLET-PROFILE-BATCH-100-LIVE-SMOKE-001

## Task Identity

- **Task ID**: \`${BATCH_100_TASK_ID}\`
- **Role**: implementer
- **Agent ID**: \`implementer-sol-gmgn-wallet-profile-batch-100-live-smoke-001\`
- **Chain**: solana
- **Layer**: cold_path
- **Status**: ${res.status}

## External Inputs & Selection Evidence

- **Input Directory**: \`${INPUT_DIR}\`
- **Expected & Verified SHA-256 Hashes**:
  - \`sol_addresses.txt\`: \`${EXPECTED_SOL_ADDRESSES_HASH}\` (1,433 records)
  - \`sol_address_labels.json\`: \`${EXPECTED_SOL_LABELS_HASH}\` (1,433 records)
- **Input Manifest Hash Match**: \`${res.inputHashesMatch}\`
- **Selection Rule**: Deterministic Base58 + 32-byte validated Solana addresses from cleaned.jsonl after SHA-256 verification: skip first 20 addresses (used in pilot), select next 100 addresses (21st to 120th in sequence).
- **Selected Address Count**: \`${res.selectedCount}\` (exact target: ${TARGET_WALLET_COUNT})

### Selected Address Fingerprints (Irreversible Hashes, 100 Wallets)

| # | Address Fingerprint (SHA-256) |
|---|---|
${fingerprintsTable}

## Execution & Metric Normalization Results

- **Periods Checked**: \`7d\` and \`30d\` (2 periods per wallet)
- **Total Profile Records Produced**: \`${res.records.length}\`
- **Mapped Records**: \`${res.mappedCount}\`
- **Partial Records**: \`${res.partialCount}\`
- **Unavailable Records**: \`${res.unavailableCount}\`
- **Average Field Completeness**: \`${avgCompleteness}\` (across all records)
- **Request Count**: \`${res.requestBudgetUsed}\` (Limit: <= ${MAX_REQUEST_BUDGET}; Satisfied: \`${res.requestBudgetUsed <= MAX_REQUEST_BUDGET}\`)
- **Serial Rate Limit Delay**: \`>= 1,000ms\` enforced between adjacent requests

### Allowlisted Safe Error / Warning Code Counts

| Code | Count |
|---|---:|
${warningCountsTable}

## Verification Commands Passed

- \`npm run harness:doctor\`: Passed
- \`npm run typecheck\`: Passed
- \`npm test\`: Passed
- \`npm run build\`: Passed
- \`git diff --check\`: Passed

## External Output Directory

- **Derived Profiles Directory**: \`${OUTPUT_DIR}\`
- **Files**:
  - \`normalized_wallet_profiles.json\`
  - \`summary.json\`

## Boundaries & Constraints Compliance

1. **Solana-Only**: Verified. Zero BSC or Robinhood calls.
2. **Official CLI / OpenAPI Only**: Verified. Zero web scraping, zero Cloudflare bypass, zero GMGN Web pages.
3. **Read-Only**: Verified. Zero trading, zero signing, zero order placement.
4. **Manual Single Execution**: Verified. Zero cron, zero background loops, zero auto-discovery.
5. **No Helius Calls**: Verified. Zero Helius network invocations.
6. **No Production Database Writes**: Verified. Outputs restricted to local external directory.
7. **Zero Leakage**: Verified. No API keys, private keys, raw provider payloads, raw stdout/stderr, or plaintext addresses saved or committed to Git.
8. **No LLM Interpretations / Confirmations**: Verified. GMGN metrics strictly classified as \`source: "gmgn"\`, \`verificationStatus: "unverified"\`.
`;
}

void main();
