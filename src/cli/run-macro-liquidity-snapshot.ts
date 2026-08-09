import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildLiquiditySnapshot } from "../application/macro-liquidity-snapshot.js";

/**
 * One-shot liquidity water-level snapshot CLI.
 *   npm run macro:liquidity:snapshot               → snapshot JSON to stdout
 *   npm run macro:liquidity:snapshot -- --out <dir> → write artifacts/liquidity-style JSON file
 *
 * DefiLlama is key-free and live. Coinalyze requires COINALYZE_API_KEY and
 * fails closed (unavailable + warning) without it.
 */

export function parseLiquiditySnapshotArgs(arguments_: readonly string[]): { outDir: string | null } {
  if (arguments_.length === 0) return { outDir: null };
  if (arguments_.length === 2 && arguments_[0] === "--out") {
    const outDir = arguments_[1]?.trim();
    if (!outDir) throw new Error("Usage: npm run macro:liquidity:snapshot [-- --out <dir>]");
    return { outDir };
  }
  throw new Error("Usage: npm run macro:liquidity:snapshot [-- --out <dir>]");
}

export async function runLiquiditySnapshotCli(arguments_ = process.argv.slice(2), environment = process.env): Promise<{ outputPath: string | null; metricCount: number; qualityStatus: string; warningCount: number }> {
  const { outDir } = parseLiquiditySnapshotArgs(arguments_);
  const apiKey = environment.COINALYZE_API_KEY?.trim();
  const snapshot = await buildLiquiditySnapshot(apiKey ? { coinalyzeApiKey: apiKey } : {});
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (outDir === null) {
    process.stdout.write(json);
    return { outputPath: null, metricCount: snapshot.metricSets.length, qualityStatus: snapshot.quality.status, warningCount: snapshot.warnings.length };
  }
  const stamp = snapshot.generatedAt.slice(0, 19).replace(/[:T]/g, "-");
  const outputPath = join(outDir, `liquidity-snapshot-${stamp}.json`);
  await mkdir(outDir, { recursive: true });
  await writeFile(outputPath, json, "utf8");
  return { outputPath, metricCount: snapshot.metricSets.length, qualityStatus: snapshot.quality.status, warningCount: snapshot.warnings.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLiquiditySnapshotCli()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Liquidity snapshot run failed";
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
