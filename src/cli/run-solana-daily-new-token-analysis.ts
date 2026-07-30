import { mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { runSolanaDailyNewTokenAnalysis } from "../application/live/solana-daily-new-token-analysis.js";
import { LiveHeliusDataSource } from "../infrastructure/solana/helius/live-helius-data-source.js";

async function main(): Promise<number> {
  const report = await runSolanaDailyNewTokenAnalysis({
    sourceFactory: () => LiveHeliusDataSource.fromRuntime({
      requestBudget: 3,
      minRequestIntervalMs: 150,
      timeoutMs: 8_000,
    }),
  });
  const reportPath = await writeSanitizedReport(report.observedAt, report);
  console.log(JSON.stringify({ ...report, reportPath }));
  return report.status === "OK" ? 0 : report.status === "DEGRADED" ? 2 : 1;
}

async function writeSanitizedReport(observedAt: string, report: unknown): Promise<string> {
  const directory = resolve(process.env.SOLANA_DAILY_REPORT_DIR?.trim() || defaultReportDirectory());
  await mkdir(directory, { recursive: true });
  const fileName = `${observedAt.replace(/[:.]/g, "-")}.json`;
  const target = join(directory, fileName);
  const temporary = join(directory, `.${fileName}.${process.pid}.tmp`);
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
  return target;
}

function defaultReportDirectory(): string {
  const base = process.env.LOCALAPPDATA?.trim() || join(homedir(), ".local", "share");
  return join(base, "memecoin-ca-data-layer", "reports");
}

main()
  .then((code) => { process.exitCode = code; })
  .catch(() => {
    console.log(JSON.stringify({ chain: "solana", status: "REJECTED", warnings: ["daily_analysis_unavailable"] }));
    process.exitCode = 1;
  });
