import { readSolanaLiveCaFirstCard } from "../application/live/solana-live-ca-first.js";
import { safeSolanaLiveWarning } from "../application/live/solana-live-warning.js";
import { AnalysisService } from "../application/analysis-service.js";
import { InMemoryAddressLibrary } from "../application/sedimentation/address-library.js";
import { HeliusSolanaAdapter } from "../infrastructure/solana/helius/helius-solana-adapter.js";
import { LiveHeliusDataSource } from "../infrastructure/solana/helius/live-helius-data-source.js";

async function main(): Promise<number> {
  const tokenCa = process.argv[2] ?? "";
  try {
    const result = await readSolanaLiveCaFirstCard(tokenCa, {
      sourceFactory: () => LiveHeliusDataSource.fromRuntime({
        // AnalysisService needs far more bounded reads than the 3-read summary.
        requestBudget: 250,
        minRequestIntervalMs: 150,
        timeoutMs: 8_000,
      }),
      analysisFactory: (source) => new AnalysisService(
        [new HeliusSolanaAdapter(source)],
        { getMarket: async () => null },
        // In-memory no-ops: this CLI is a read-only smoke entry; nothing persists.
        { findLatest: async () => null, save: async () => undefined },
        { get: async () => null, set: async () => undefined, delete: async () => undefined },
      ),
      library: new InMemoryAddressLibrary(),
    });
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
