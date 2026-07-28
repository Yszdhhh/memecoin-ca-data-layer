import { readSolanaManualCaBatch } from "../application/live/solana-live-ca-batch.js";
import { LiveHeliusDataSource } from "../infrastructure/solana/helius/live-helius-data-source.js";

async function main(): Promise<number> {
  try {
    const result = await readSolanaManualCaBatch(process.argv.slice(2), () => LiveHeliusDataSource.fromRuntime({
      requestBudget: 3,
      minRequestIntervalMs: 150,
      timeoutMs: 8_000,
    }));
    console.log(JSON.stringify(result));
    return result.status === "OK" ? 0 : 1;
  } catch (error) {
    const warning = error instanceof Error && /^helius_[a-z0-9_]+$/.test(error.message)
      ? error.message
      : "helius_live_read_unavailable";
    console.log(JSON.stringify({ chain: "solana", status: "REJECTED", warnings: [warning] }));
    return 1;
  }
}

main().then((code) => { process.exitCode = code; });
