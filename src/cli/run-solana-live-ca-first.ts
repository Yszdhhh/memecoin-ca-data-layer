import { readSolanaLiveCaFirst } from "../application/live/solana-live-ca-first.js";
import { LiveHeliusDataSource } from "../infrastructure/solana/helius/live-helius-data-source.js";

async function main(): Promise<number> {
  const tokenCa = process.argv[2] ?? "";
  try {
    const result = await readSolanaLiveCaFirst(
      tokenCa,
      LiveHeliusDataSource.fromRuntime({
        requestBudget: 3,
        minRequestIntervalMs: 150,
        timeoutMs: 8_000,
      }),
    );
    console.log(JSON.stringify(result));
    return result.status === "OK" ? 0 : 1;
  } catch (error) {
    const warning = error instanceof Error && /^helius_[a-z0-9_]+$/.test(error.message)
      ? error.message
      : "helius_live_read_unavailable";
    console.log(JSON.stringify({
      entrypointVersion: "solana-live-ca-first-v1",
      chain: "solana",
      status: "REJECTED",
      warnings: [warning],
    }));
    return 1;
  }
}

main().then((code) => {
  process.exitCode = code;
});
