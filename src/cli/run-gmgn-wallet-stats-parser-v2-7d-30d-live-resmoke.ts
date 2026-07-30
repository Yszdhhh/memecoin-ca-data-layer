import path from "node:path";
import { runWalletStatsParserV2Resmoke } from "../application/gmgn/wallet-stats-parser-v2-7d-30d-live-resmoke.js";

async function main() {
  const inputDir = path.resolve("C:/Users/10639/chainfm_out/sol");
  const outputDir = path.resolve(
    "C:/Users/10639/chainfm_out/sol/derived/gmgn-wallet-stats-parser-v2-7d-30d-live-resmoke-001",
  );
  const runId = `run-${Date.now()}`;

  const result = await runWalletStatsParserV2Resmoke({
    inputDir,
    outputDir,
    runId,
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
  console.error("Resmoke execution error: safe failure");
  process.exit(1);
});
