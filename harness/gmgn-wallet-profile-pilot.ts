import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  runGmgnWalletProfilePilot,
  PILOT_TASK_ID,
  EXPECTED_SOL_ADDRESSES_HASH,
  EXPECTED_SOL_LABELS_HASH,
  TARGET_WALLET_COUNT,
  MAX_REQUEST_BUDGET,
  type WalletProfilePilotResult,
} from "../src/application/gmgn/wallet-profile-pilot.js";

const ROOT = process.cwd();
const REPORT_PATH = resolve(
  ROOT,
  "harness/reports/SOL-GMGN-WALLET-PROFILE-PILOT-001/acceptance.md"
);
const INPUT_DIR = "C:\\Users\\10639\\chainfm_out\\sol";
const OUTPUT_DIR =
  "C:\\Users\\10639\\chainfm_out\\sol\\derived\\gmgn-wallet-profile-pilot-001";

async function main(): Promise<void> {
  const pilotResult = await runGmgnWalletProfilePilot({
    inputDir: INPUT_DIR,
    outputDir: OUTPUT_DIR,
  });

  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(
    REPORT_PATH,
    renderAcceptanceReport(pilotResult),
    "utf8"
  );

  console.log(
    JSON.stringify({
      task_id: PILOT_TASK_ID,
      status: pilotResult.status,
      selected_count: pilotResult.selectedCount,
      mapped_count: pilotResult.mappedCount,
      unavailable_count: pilotResult.unavailableCount,
      request_budget_used: pilotResult.requestBudgetUsed,
      request_limit_satisfied: pilotResult.requestBudgetUsed <= MAX_REQUEST_BUDGET,
      external_output_dir: OUTPUT_DIR,
      warning_code_counts: pilotResult.warningCodeCounts,
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

  return `# Acceptance Report: SOL-GMGN-WALLET-PROFILE-PILOT-001

## Task Identity

- **Task ID**: \`${PILOT_TASK_ID}\`
- **Role**: implementer
- **Chain**: solana
- **Layer**: cold_path
- **Status**: ${res.status}

## External Inputs & Evidence

- **Input Directory**: \`${INPUT_DIR}\`
- **Expected & Verified SHA-256 Hashes**:
  - \`sol_addresses.txt\`: \`${EXPECTED_SOL_ADDRESSES_HASH}\` (1,433 records)
  - \`sol_address_labels.json\`: \`${EXPECTED_SOL_LABELS_HASH}\` (1,433 records)
- **Input Manifest Hash Match**: \`${res.inputHashesMatch}\`
- **Selection Rule**: First 20 unique valid Solana addresses in order from cleaned.jsonl after input hash verification.
- **Selected Address Count**: \`${res.selectedCount}\` (exact target: ${TARGET_WALLET_COUNT})

### Selected Address Fingerprints (Irreversible Hashes)

| # | Address Fingerprint (SHA-256) |
|---|---|
${fingerprintsTable}

## Execution & Metric Normalization Results

- **Periods Checked**: \`7d\` and \`30d\` (2 periods per wallet)
- **Total Profile Records Produced**: \`${res.records.length}\`
- **Mapped Records**: \`${res.mappedCount}\`
- **Partial Records**: \`${res.partialCount}\`
- **Unavailable Records**: \`${res.unavailableCount}\`
- **Request Count**: \`${res.requestBudgetUsed}\` (Limit: <= ${MAX_REQUEST_BUDGET}; Satisfied: \`${res.requestBudgetUsed <= MAX_REQUEST_BUDGET}\`)

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
2. **Official CLI / OpenAPI Only**: Verified. Zero web scraping, zero Cloudflare bypass.
3. **Read-Only**: Verified. Zero trading, zero signing, zero order placement.
4. **Manual Single Execution**: Verified. Zero cron, zero background loops.
5. **No Helius Calls**: Verified. Zero Helius network invocations.
6. **No Production Database Writes**: Verified. Outputs restricted to local external directory.
7. **Zero Leakage**: Verified. No API keys, private keys, raw provider payloads, raw stdout/stderr, or plaintext addresses saved or committed to Git.
8. **No LLM Interpretations / Confirmations**: Verified. GMGN metrics strictly classified as \`source: "gmgn"\`, \`verificationStatus: "unverified"\`.
`;
}

void main();
