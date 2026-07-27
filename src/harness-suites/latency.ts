import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  exitFor,
  repoRootFromHere,
  type SuiteReport,
  VirtualClock,
  writeSuiteReport,
} from "./shared.js";

export interface LatencyBudget {
  schema_version: string;
  p50_ms_max: number;
  p95_ms_max: number;
  require_card_every_case: boolean;
  require_parallel_hot_path: boolean;
}

export interface LatencyCase {
  id: string;
  sources: Array<{ name: string; latency_ms: number }>;
}

/**
 * Hot-path first-screen simulation: sources run in parallel on a virtual clock
 * so wall time = max(latency), not sum. Serial execution is the failure mode.
 */
export function runHotPathParallel(
  sources: Array<{ name: string; latency_ms: number }>,
  clock: VirtualClock = new VirtualClock(),
): { elapsed_ms: number; card: true; mode: "parallel" } {
  const start = clock.now();
  const maxLatency = sources.reduce((m, s) => Math.max(m, s.latency_ms), 0);
  clock.advance(maxLatency);
  return { elapsed_ms: clock.now() - start, card: true, mode: "parallel" };
}

export function runHotPathSerial(
  sources: Array<{ name: string; latency_ms: number }>,
  clock: VirtualClock = new VirtualClock(),
): { elapsed_ms: number; card: true; mode: "serial" } {
  const start = clock.now();
  for (const source of sources) clock.advance(source.latency_ms);
  return { elapsed_ms: clock.now() - start, card: true, mode: "serial" };
}

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)]!;
}

export async function runLatencySuite(options: {
  fixturesDir?: string;
  runDir?: string;
} = {}): Promise<SuiteReport> {
  const root = repoRootFromHere();
  const fixturesDir = options.fixturesDir ?? path.join(root, "test", "fixtures", "harness");
  const budget = JSON.parse(await readFile(path.join(fixturesDir, "latency-budget@1.json"), "utf8")) as LatencyBudget;
  const casesFile = JSON.parse(await readFile(path.join(fixturesDir, "latency-cases.json"), "utf8")) as {
    cases: LatencyCase[];
  };

  const failures: string[] = [];
  const elapsedParallel: number[] = [];
  const elapsedSerial: number[] = [];

  for (const testCase of casesFile.cases) {
    const parallel = runHotPathParallel(testCase.sources, new VirtualClock());
    const serial = runHotPathSerial(testCase.sources, new VirtualClock());
    elapsedParallel.push(parallel.elapsed_ms);
    elapsedSerial.push(serial.elapsed_ms);

    if (budget.require_card_every_case && !parallel.card) {
      failures.push(`${testCase.id}: missing first-screen card`);
    }
    if (budget.require_parallel_hot_path) {
      const sum = testCase.sources.reduce((s, x) => s + x.latency_ms, 0);
      const max = testCase.sources.reduce((m, x) => Math.max(m, x.latency_ms), 0);
      if (parallel.elapsed_ms !== max) {
        failures.push(`${testCase.id}: parallel elapsed ${parallel.elapsed_ms} != max ${max}`);
      }
      if (serial.elapsed_ms !== sum) {
        failures.push(`${testCase.id}: serial control elapsed ${serial.elapsed_ms} != sum ${sum}`);
      }
      // Guard: if a pipeline ever serializes, p95 will look like sum not max.
      if (parallel.elapsed_ms >= sum && testCase.sources.length > 1) {
        failures.push(`${testCase.id}: hot path serializes (elapsed≈sum)`);
      }
    }
  }

  const sorted = [...elapsedParallel].sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  if (p50 > budget.p50_ms_max) failures.push(`P50 ${p50} > ${budget.p50_ms_max}`);
  if (p95 > budget.p95_ms_max) failures.push(`P95 ${p95} > ${budget.p95_ms_max}`);

  const report: SuiteReport = {
    suite: "latency",
    version: budget.schema_version,
    status: failures.length === 0 ? "PASS" : "FAIL",
    generated_at_utc: new Date(0).toISOString(), // fixed for determinism in reports written by tests
    failures,
    metrics: {
      p50_ms: p50,
      p95_ms: p95,
      case_count: casesFile.cases.length,
      parallel_elapsed_ms: elapsedParallel,
      serial_control_elapsed_ms: elapsedSerial,
      budget,
    },
  };
  // Prefer real UTC for CLI runs; tests call runLatencySuite without caring about timestamp.
  report.generated_at_utc = new Date().toISOString();
  await writeSuiteReport(options.runDir, report);
  return report;
}

async function main(): Promise<number> {
  const runDir = process.argv[2];
  const report = await runLatencySuite(runDir ? { runDir } : {});
  console.log(JSON.stringify(report, null, 2));
  return exitFor(report.status);
}

const isDirect = process.argv[1] && pathToFile(process.argv[1]).endsWith(`${path.sep}latency.ts`);
function pathToFile(p: string): string {
  return path.resolve(p);
}

if (isDirect) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
