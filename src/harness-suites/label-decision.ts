import { readFile } from "node:fs/promises";
import path from "node:path";
import { exitFor, repoRootFromHere, type SuiteReport, writeSuiteReport } from "./shared.js";

export type DetectorName = "cluster_fusion" | "bot_sniper" | "independent_smart_money";

export interface LabelFeatures {
  same_funder?: boolean;
  sync_buy?: boolean;
  service_funder?: boolean;
  swaps_24h?: number;
  median_interval_s?: number;
  historical_wallet?: boolean;
  edge_count?: number;
}

/** Offline stub detectors for harness gating — real detectors land in SOL-DETECTORS-001. */
export function predictLabels(features: LabelFeatures): Record<DetectorName, boolean> {
  const cluster = Boolean(features.same_funder && features.sync_buy && !features.service_funder);
  const bot = (features.swaps_24h ?? 0) >= 150 && (features.median_interval_s ?? 999) <= 5;
  const smart = Boolean(features.historical_wallet && (features.edge_count ?? 0) >= 20) && !cluster && !bot;
  return {
    cluster_fusion: cluster,
    bot_sniper: bot,
    independent_smart_money: smart,
  };
}

export function measureFpFn(
  cases: Array<{ labels: Record<DetectorName, boolean>; pred: Record<DetectorName, boolean> }>,
  detector: DetectorName,
): { fp: number; fn: number } {
  let fp = 0;
  let fn = 0;
  for (const item of cases) {
    const truth = item.labels[detector];
    const pred = item.pred[detector];
    if (pred && !truth) fp += 1;
    if (!pred && truth) fn += 1;
  }
  return { fp, fn };
}

export async function runLabelDecisionSuite(options: {
  fixturesDir?: string;
  runDir?: string;
} = {}): Promise<SuiteReport> {
  const root = repoRootFromHere();
  const fixturesDir = options.fixturesDir ?? path.join(root, "test", "fixtures", "harness");
  const tolerance = JSON.parse(
    await readFile(path.join(fixturesDir, "label-tolerance@1.json"), "utf8"),
  ) as {
    schema_version: string;
    detectors: Record<DetectorName, { max_fp: number; max_fn: number }>;
  };
  const casesFile = JSON.parse(
    await readFile(path.join(fixturesDir, "label-cases.json"), "utf8"),
  ) as {
    attestation: string;
    cases: Array<{ id: string; features: LabelFeatures; labels: Record<DetectorName, boolean> }>;
  };

  const evaluated = casesFile.cases.map((item) => ({
    id: item.id,
    labels: item.labels,
    pred: predictLabels(item.features),
  }));

  const failures: string[] = [];
  const perDetector: Record<string, { fp: number; fn: number; max_fp: number; max_fn: number }> = {};

  for (const detector of Object.keys(tolerance.detectors) as DetectorName[]) {
    const { fp, fn } = measureFpFn(evaluated, detector);
    const bud = tolerance.detectors[detector]!;
    perDetector[detector] = { fp, fn, max_fp: bud.max_fp, max_fn: bud.max_fn };
    if (fp > bud.max_fp) failures.push(`${detector}: FP ${fp} > ${bud.max_fp}`);
    if (fn > bud.max_fn) failures.push(`${detector}: FN ${fn} > ${bud.max_fn}`);
  }

  const report: SuiteReport = {
    suite: "label-decision",
    version: tolerance.schema_version,
    status: failures.length === 0 ? "PASS" : "FAIL",
    generated_at_utc: new Date().toISOString(),
    failures,
    metrics: {
      attestation: casesFile.attestation,
      tolerance_version: tolerance.schema_version,
      case_count: casesFile.cases.length,
      per_detector: perDetector,
    },
  };
  await writeSuiteReport(options.runDir, report);
  return report;
}

async function main(): Promise<number> {
  const runDir = process.argv[2];
  const report = await runLabelDecisionSuite(runDir ? { runDir } : {});
  console.log(JSON.stringify(report, null, 2));
  return exitFor(report.status);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(`${path.sep}label-decision.ts`)) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
