import { readSolanaLiveCaFirstWithFactory } from "../application/live/solana-live-ca-first.js";
import { safeSolanaLiveWarning } from "../application/live/solana-live-warning.js";
import { LiveHeliusDataSource } from "../infrastructure/solana/helius/live-helius-data-source.js";

async function main(): Promise<number> {
  const tokenCa = process.argv[2] ?? "";
  try {
    const result = await readSolanaLiveCaFirstWithFactory(
      tokenCa,
      () => LiveHeliusDataSource.fromRuntime({
        requestBudget: 3,
        minRequestIntervalMs: 150,
        timeoutMs: 8_000,
      }),
    );
    console.log(JSON.stringify(result));
    return result.status === "OK" ? 0 : 1;
  } catch (error) {
    const warning = safeSolanaLiveWarning(error);
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
