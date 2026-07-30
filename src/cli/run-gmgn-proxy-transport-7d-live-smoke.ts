import path from "node:path";
import { runProxyTransport7dLiveSmoke } from "../application/gmgn/proxy-transport-7d-live-smoke.js";

async function main() {
  const inputDir = path.resolve("C:/Users/10639/chainfm_out/sol");
  const outputDir = path.resolve(
    "C:/Users/10639/chainfm_out/sol/derived/gmgn-proxy-transport-7d-live-smoke-001",
  );
  const runId = `run-${Date.now()}`;

  const result = await runProxyTransport7dLiveSmoke({
    inputDir,
    outputDir,
    runId,
  });

  console.log("Task ID:", result.taskId);
  console.log("Run ID:", result.runId);
  console.log("Status:", result.status);
  console.log("Period:", result.period);
  console.log("Input Hashes Match:", result.inputHashesMatch);
  console.log("Target Fingerprint:", result.targetFingerprint);
  console.log("API Key Present:", result.credentialApiKeyPresent);
  console.log("CLI Invocation Budget Cap:", result.cliInvocationBudgetCap);
  console.log("CLI Invocation Budget Used:", result.cliInvocationBudgetUsed);
  console.log("Physical Provider Request Upper Bound:", result.physicalProviderRequestUpperBound);
  console.log("Diagnostic Code:", result.diagnosticCode);
  console.log("Mapped Record Present:", result.record !== null);
  console.log("Record Status:", result.record?.status ?? null);
  console.log("Warning Codes:", result.warningCodes);
  console.log("Source:", result.source);
  console.log("Verification Status:", result.verificationStatus);
  console.log("Output Summary File:", result.outputFiles.summaryJson);
}

main().catch(() => {
  console.error("Smoke execution error: safe failure");
  process.exit(1);
});
