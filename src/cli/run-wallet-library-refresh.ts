import fs from "node:fs";
import { executeWalletLibraryRefresh } from "../application/wallet-library/wallet-library.js";
import { RefreshOptions } from "../application/wallet-library/types.js";

function optionValue(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}

function requireOption(args: string[], name: string): string {
  const value = optionValue(args, name);
  if (!value || value.startsWith("--")) throw new Error(`Missing required option ${name}`);
  return value;
}

function parseMode(value: string | null): RefreshOptions["mode"] {
  if (value === "daily" || value === "weekly" || value === "monthly") return value;
  throw new Error("--mode must be daily, weekly, or monthly");
}

function parseNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("--provider-budget must be a non-negative number");
  return parsed;
}

function parseArgs(args: string[]): RefreshOptions {
  const inputFile = requireOption(args, "--input");
  const outputRoot = requireOption(args, "--output-root");
  if (!fs.existsSync(inputFile)) throw new Error(`Input file does not exist: ${inputFile}`);
  const result: RefreshOptions = {
    inputFile,
    outputRoot,
    mode: parseMode(optionValue(args, "--mode") ?? "daily"),
    dryRun: args.includes("--dry-run"),
    cacheReplay: args.includes("--cache-replay"),
    providerBudget: parseNumber(optionValue(args, "--provider-budget")),
    previousSnapshot: optionValue(args, "--previous-snapshot"),
  };
  const runId = optionValue(args, "--run-id");
  const runAt = optionValue(args, "--run-at");
  if (runId) result.runId = runId;
  if (runAt) result.runAt = runAt;
  return result;
}

try {
  const result = executeWalletLibraryRefresh(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
