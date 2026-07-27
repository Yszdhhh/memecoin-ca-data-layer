import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type SuiteStatus = "PASS" | "FAIL";

export interface SuiteReport {
  suite: string;
  version: string;
  status: SuiteStatus;
  generated_at_utc: string;
  failures: string[];
  metrics: Record<string, unknown>;
}

/** Deterministic virtual clock — never uses wall time for budgets. */
export class VirtualClock {
  private ms = 0;

  now(): number {
    return this.ms;
  }

  advance(deltaMs: number): void {
    if (deltaMs < 0) throw new Error("virtual clock cannot go backwards");
    this.ms += deltaMs;
  }

  reset(): void {
    this.ms = 0;
  }
}

export function repoRootFromHere(): string {
  // src/harness-suites -> repo root
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export async function writeSuiteReport(
  runDir: string | undefined,
  report: SuiteReport,
): Promise<string | null> {
  if (!runDir) return null;
  await mkdir(runDir, { recursive: true });
  const out = path.join(runDir, `suite-${report.suite}.json`);
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return out;
}

export function exitFor(status: SuiteStatus): number {
  return status === "PASS" ? 0 : 1;
}

export function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
