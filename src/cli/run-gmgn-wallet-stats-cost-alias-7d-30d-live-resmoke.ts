import path from "node:path";

import { runWalletStatsParserV2Resmoke } from "../application/gmgn/wallet-stats-parser-v2-7d-30d-live-resmoke.js";

const TASK_ID = "SOL-GMGN-WALLET-STATS-COST-ALIAS-7D-30D-LIVE-RESMOKE-001";

async function main(): Promise<void> {
  const result = await runWalletStatsParserV2Resmoke({
    taskId: TASK_ID,
    runId: `run-${Date.now()}`,
    inputDir: path.resolve("C:/Users/10639/chainfm_out/sol"),
    outputDir: path.resolve(
      "C:/Users/10639/chainfm_out/sol/derived/gmgn-wallet-stats-cost-alias-7d-30d-live-resmoke-001",
    ),
  });

  console.log("Task ID:", result.taskId);
  console.log("Run ID:", result.runId);
  console.log("Status:", result.status);
  console.log("Input Hashes Match:", result.inputHashesMatch);
  console.log("Target Fingerprint:", result.targetFingerprint);
  console.log("API Key Present:", result.credentialApiKeyPresent);
  console.log("CLI Invocation Budget Cap:", result.cliInvocationBudgetCap);
  console.log("CLI Invocation Budget Used:", result.cliInvocationBudgetUsed);
  console.log("Physical Provider Request Upper Bound:", result.physicalProviderRequestUpperBound);
  console.log("7d Status:", result.stats7d.status);
  console.log("7d Completeness:", result.stats7d.completeness);
  console.log("7d Diagnostic Code:", result.stats7d.diagnosticCode);
  console.log("7d Warning Codes:", result.stats7d.warningCodes);
  console.log("30d Status:", result.stats30d.status);
  console.log("30d Completeness:", result.stats30d.completeness);
  console.log("30d Diagnostic Code:", result.stats30d.diagnosticCode);
  console.log("30d Warning Codes:", result.stats30d.warningCodes);
  console.log("Source:", result.source);
  console.log("Verification Status:", result.verificationStatus);
  console.log("Output Summary File:", result.outputFiles.summaryJson);
}

main().catch(() => {
  console.error("Live re-smoke execution error: safe failure");
  process.exit(1);
});
