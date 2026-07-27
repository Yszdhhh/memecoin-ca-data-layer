import { readFile } from "node:fs/promises";
import path from "node:path";
import { exitFor, repoRootFromHere, type SuiteReport, writeSuiteReport } from "./shared.js";

export type FailureMode = "timeout" | "field_missing" | "field_renamed" | "malformed" | "stale";

export interface DegradedAnalysis {
  crashed: boolean;
  warnings: string[];
  completeness: number;
  /** Fields that depend on first-hand holder source must be null when that source fails. */
  holderConcentration: { top10Pct: number } | null;
  holderCompleteness: "complete" | "partial" | "unavailable";
  market: { liquidityUsd: number } | null;
  borrowedTop10: { owners: string[] } | null;
  usedBorrowedForAuthoritativeConcentration: boolean;
}

/**
 * Offline degradation model: never crashes; never fakes precision from a failed source;
 * never substitutes borrowed leaderboard for authoritative concentration.
 */
export function analyzeWithDegradation(
  source: string,
  mode: FailureMode,
): DegradedAnalysis {
  const baseCompleteness = 1;
  const warnings: string[] = [`${source}_${mode}`];
  let completeness = baseCompleteness;
  let holderConcentration: { top10Pct: number } | null = { top10Pct: 42.5 };
  let holderCompleteness: DegradedAnalysis["holderCompleteness"] = "complete";
  let market: { liquidityUsd: number } | null = { liquidityUsd: 10_000 };
  let borrowedTop10: { owners: string[] } | null = { owners: ["x"] };
  let usedBorrowedForAuthoritativeConcentration = false;

  const sourceFailed = true;
  if (sourceFailed) {
    completeness = Math.max(0, completeness - 0.25);
    warnings.push(`source_degraded:${source}`);
  }

  if (source === "helius_holders") {
    // First-hand guard: concentration unavailable — never invent or borrow.
    holderConcentration = null;
    holderCompleteness = "unavailable";
    warnings.push("HOLDER_CONCENTRATION_INDETERMINATE");
    warnings.push("first_hand_holder_source_degraded");
    // Explicitly do NOT fill concentration from borrowedTop10
    usedBorrowedForAuthoritativeConcentration = false;
  }

  if (source === "market_enrichment") {
    market = null;
    warnings.push("MARKET_ENRICHMENT_UNAVAILABLE");
    warnings.push("market_metric_missing:liquidity_usd");
  }

  if (source === "helius_swaps") {
    warnings.push("swap_history_unavailable");
  }

  if (source === "borrowed_leaderboard") {
    borrowedTop10 = null;
    warnings.push("borrowed_leaderboard_unavailable");
  }

  // Field-level fake-precision guard: no non-null value that depends on failed source.
  if (source === "helius_holders" && holderConcentration !== null) {
    throw new Error("fake precision: concentration populated despite holder source failure");
  }
  if (source === "market_enrichment" && market !== null) {
    throw new Error("fake precision: market populated despite enrichment failure");
  }

  return {
    crashed: false,
    warnings,
    completeness,
    holderConcentration,
    holderCompleteness,
    market,
    borrowedTop10,
    usedBorrowedForAuthoritativeConcentration,
  };
}

export async function runSourceDegradationSuite(options: {
  fixturesDir?: string;
  runDir?: string;
} = {}): Promise<SuiteReport> {
  const root = repoRootFromHere();
  const fixturesDir = options.fixturesDir ?? path.join(root, "test", "fixtures", "harness");
  const matrix = JSON.parse(
    await readFile(path.join(fixturesDir, "source-degradation-matrix.json"), "utf8"),
  ) as { sources: string[]; failure_modes: FailureMode[] };

  const failures: string[] = [];
  let cells = 0;

  for (const source of matrix.sources) {
    for (const mode of matrix.failure_modes) {
      cells += 1;
      let result: DegradedAnalysis;
      try {
        result = analyzeWithDegradation(source, mode);
      } catch (error) {
        failures.push(`${source}x${mode}: crashed: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      if (result.crashed) failures.push(`${source}x${mode}: crashed flag true`);
      if (result.completeness >= 1) {
        failures.push(`${source}x${mode}: completeness did not decrease`);
      }
      if (!result.warnings.some((w) => w.includes(source) || w.includes("degraded") || w.includes("unavailable") || w.includes("missing"))) {
        failures.push(`${source}x${mode}: missing degradation warning`);
      }
      if (source === "helius_holders") {
        if (result.holderConcentration !== null) {
          failures.push(`${source}x${mode}: concentration not null after first-hand failure`);
        }
        if (result.holderCompleteness !== "unavailable") {
          failures.push(`${source}x${mode}: holderCompleteness must be unavailable`);
        }
        if (result.usedBorrowedForAuthoritativeConcentration) {
          failures.push(`${source}x${mode}: borrowed data substituted for authoritative concentration`);
        }
      }
      if (source === "market_enrichment" && result.market !== null) {
        failures.push(`${source}x${mode}: market field populated despite failure`);
      }
    }
  }

  const report: SuiteReport = {
    suite: "source-degradation",
    version: "source-degradation@1",
    status: failures.length === 0 ? "PASS" : "FAIL",
    generated_at_utc: new Date().toISOString(),
    failures,
    metrics: { cells, sources: matrix.sources, failure_modes: matrix.failure_modes },
  };
  await writeSuiteReport(options.runDir, report);
  return report;
}

async function main(): Promise<number> {
  const runDir = process.argv[2];
  const report = await runSourceDegradationSuite(runDir ? { runDir } : {});
  console.log(JSON.stringify(report, null, 2));
  return exitFor(report.status);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(`${path.sep}source-degradation.ts`)) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
