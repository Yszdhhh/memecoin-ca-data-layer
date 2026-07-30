import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  RUNTIME_CREDENTIAL_UNAVAILABLE,
  runSolanaCaRealDataCleaningPilot,
  type PilotBatchResult,
  type PilotInputManifest,
} from "../application/live/solana-ca-real-data-cleaning-pilot.js";
import { safeSolanaLiveWarning } from "../application/live/solana-live-warning.js";
import { LiveHeliusDataSource } from "../infrastructure/solana/helius/live-helius-data-source.js";

/**
 * Manual, sequential Helius-only real-data cleaning pilot.
 * Usage:
 *   npx tsx src/cli/run-solana-ca-real-data-cleaning-pilot.ts \
 *     --manifest harness/inputs/SOL-CA-REAL-DATA-CLEANING-PILOT-001/input-manifest.json \
 *     --out harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-001
 */
async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.manifest || !args.out) {
    console.log(JSON.stringify({
      status: "REJECTED",
      warnings: ["usage_requires_manifest_and_out"],
    }));
    return 1;
  }

  let manifest: PilotInputManifest;
  try {
    manifest = JSON.parse(await readFile(args.manifest, "utf8")) as PilotInputManifest;
  } catch {
    console.log(JSON.stringify({ status: "REJECTED", warnings: ["manifest_unreadable"] }));
    return 1;
  }

  let batch: PilotBatchResult;
  try {
    batch = await runSolanaCaRealDataCleaningPilot(
      manifest,
      () => LiveHeliusDataSource.fromRuntime({
        requestBudget: args.requestBudget,
        minRequestIntervalMs: 350,
        timeoutMs: 15_000,
      }),
      {
        maxPagesPerCa: args.maxPages,
        pageSize: 1_000,
        // Zero-balance rows are optional; enable only with --show-zero-balance.
        // Default false improves parse reliability on current Helius DAS shapes.
        showZeroBalance: args.showZeroBalance,
      },
    );
  } catch (error) {
    const warning = safeSolanaLiveWarning(error);
    console.log(JSON.stringify({
      status: warning.includes("credential") ? RUNTIME_CREDENTIAL_UNAVAILABLE : "REJECTED",
      warnings: [warning.includes("credential") ? RUNTIME_CREDENTIAL_UNAVAILABLE : warning],
    }));
    return 1;
  }

  await writeBatchArtifacts(args.out, batch, manifest);
  console.log(JSON.stringify({
    status: batch.status,
    sampleCount: batch.results.length,
    okCount: batch.batchSummary.okCount,
    partialCount: batch.batchSummary.partialCount,
    rejectedCount: batch.batchSummary.rejectedCount,
    totalHeliusRequests: batch.batchSummary.totalHeliusRequests,
    out: args.out,
    warnings: batch.warnings.slice(0, 20),
  }));

  if (batch.status === RUNTIME_CREDENTIAL_UNAVAILABLE) return 2;
  if (batch.status === "REJECTED") return 1;
  return 0;
}

function parseArgs(argv: string[]): {
  manifest?: string;
  out?: string;
  maxPages: number;
  requestBudget: number;
  showZeroBalance: boolean;
} {
  const out: {
    manifest?: string;
    out?: string;
    maxPages: number;
    requestBudget: number;
    showZeroBalance: boolean;
  } = {
    maxPages: 50,
    requestBudget: 600,
    showZeroBalance: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--manifest" && value) {
      out.manifest = value;
      i += 1;
    } else if (key === "--out" && value) {
      out.out = value;
      i += 1;
    } else if (key === "--max-pages" && value) {
      out.maxPages = Number(value);
      i += 1;
    } else if (key === "--request-budget" && value) {
      out.requestBudget = Number(value);
      i += 1;
    } else if (key === "--show-zero-balance") {
      out.showZeroBalance = true;
    }
  }
  return out;
}

async function writeBatchArtifacts(
  outDir: string,
  batch: PilotBatchResult,
  manifest: PilotInputManifest,
): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const casDir = path.join(outDir, "cas");
  await mkdir(casDir, { recursive: true });

  for (const result of batch.results) {
    const dir = path.join(casDir, result.ca);
    await mkdir(dir, { recursive: true });
    await writeJson(path.join(dir, "input-manifest.json"), result.inputManifest);
    await writeJson(path.join(dir, "cleaning-summary.json"), result.cleaningSummary);
    await writeJson(path.join(dir, "holder-universes.json"), result.holderUniverses);
    await writeJson(path.join(dir, "concentration-metrics.json"), result.concentrationMetrics);
    await writeJson(path.join(dir, "data-quality-issues.json"), result.dataQualityIssues);
    if (result.caScanResponse) {
      await writeJson(path.join(dir, "ca-scan-response-v1.json"), result.caScanResponse);
    }
  }

  await writeJson(path.join(outDir, "batch-summary.json"), {
    taskId: batch.taskId,
    version: batch.version,
    status: batch.status,
    baseCommit: batch.baseCommit,
    ...batch.batchSummary,
    perCa: batch.results.map((r) => ({
      ca: r.ca,
      status: r.status,
      heliusRequestCount: r.heliusRequestCount,
      paginationComplete: r.paginationComplete,
      judgmentEligible: r.cleaning.judgmentEligible,
      accountingCompleteness: r.cleaning.accounting.completeness,
      residualRaw: r.cleaning.accounting.accountingResidualRaw,
      ownerCount: r.cleaning.owners.length,
      cleanedOwnerCount: r.cleaning.universes.cleanedHolderUniverse.ownerCount,
      issueCount: r.cleaning.issues.length,
      warnings: r.warnings,
    })),
  });

  await writeJson(path.join(outDir, "execution-manifest.json"), {
    taskId: batch.taskId,
    version: batch.version,
    baseCommit: batch.baseCommit,
    dataSource: "helius",
    readOnly: true,
    sequential: true,
    manualTrigger: true,
    sampleCount: manifest.samples.length,
    samples: manifest.samples,
    status: batch.status,
    totalHeliusRequests: batch.batchSummary.totalHeliusRequests,
    generatedAt: new Date().toISOString(),
  });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

main().then((code) => {
  process.exitCode = code;
});
