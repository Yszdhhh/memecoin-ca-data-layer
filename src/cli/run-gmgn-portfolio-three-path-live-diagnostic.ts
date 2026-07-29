import path from "node:path";
import { runGmgnPortfolioThreePathLiveDiagnostic } from "../application/gmgn/portfolio-three-path-live-diagnostic.js";

async function main() {
  const inputDir = path.resolve("C:/Users/10639/chainfm_out/sol");
  const outputDir = path.resolve("C:/Users/10639/chainfm_out/sol/derived/gmgn-portfolio-three-path-live-diagnostic-001");
  const runId = `run-${Date.now()}`;

  const result = await runGmgnPortfolioThreePathLiveDiagnostic({
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
  console.log("Private Key Present:", result.credentialPrivateKeyPresent);
  console.log("CLI Invocation Budget Cap:", result.cliInvocationBudgetCap);
  console.log("CLI Invocation Budget Used:", result.cliInvocationBudgetUsed);
  console.log("Physical Provider Request Upper Bound:", result.physicalProviderRequestUpperBound);
  console.log("7d Stats Status:", result.stats7d.status, "Code:", result.stats7d.diagnosticCode);
  console.log("30d Stats Status:", result.stats30d.status, "Code:", result.stats30d.diagnosticCode);
  console.log("Signed Holdings Status:", result.signedHoldings.status, "Code:", result.signedHoldings.diagnosticCode, "Next Cursor:", result.signedHoldings.nextCursorRemaining);
  console.log("Warning Codes:", result.warningCodes);
  console.log("Source: gmgn");
  console.log("Verification Status: unverified");
  console.log("Output Summary File:", result.outputFiles.summaryJson);
}

main().catch((err) => {
  console.error("Diagnostic execution error:", err instanceof Error ? err.message : "Unknown error");
  process.exit(1);
});
