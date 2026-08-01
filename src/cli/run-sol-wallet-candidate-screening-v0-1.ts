import { runCandidateScreeningV01 } from "../application/wallet-intelligence/candidate-screening-v0-1.js";

async function main() {
  const inputDir = process.env.SOL_INPUT_DIR ?? "C:\\Users\\10639\\chainfm_out\\sol";
  const gmgnOutputDir =
    process.env.SOL_GMGN_OUTPUT_DIR ??
    "C:\\Users\\10639\\chainfm_out\\sol\\derived\\gmgn-wallet-stats-full-1433-live-rerun-002";
  const outputDir =
    process.env.SOL_SCREENING_OUTPUT_DIR ??
    "C:\\Users\\10639\\chainfm_out\\sol\\derived\\wallet_intelligence_v0_1";

  console.log("Starting SOL-WALLET-CANDIDATE-SCREENING-V0-1-001...");
  console.log(`Input dir: ${inputDir}`);
  console.log(`GMGN dir: ${gmgnOutputDir}`);
  console.log(`Output dir: ${outputDir}`);

  const result = await runCandidateScreeningV01({
    inputDir,
    gmgnOutputDir,
    outputDir,
  });

  console.log("Screening finished successfully");
  console.log(`Status: ${result.status}`);
  console.log(`Addresses: ${result.metrics.totalAddresses}`);
  console.log(`Address set hash: ${result.addressSetHash}`);
  console.log(`Unique candidates: ${result.metrics.uniqueCandidateCount}`);
  console.log(`Research packs: ${result.metrics.researchPackCount}`);
  console.log(`Data tiers:`, JSON.stringify(result.metrics.dataTier));
  console.log(`DQ tiers:`, JSON.stringify(result.metrics.dataQualityTiers));
  console.log(`Category counts:`, JSON.stringify(result.metrics.categoryCounts, null, 2));
}

main().catch((err) => {
  console.error("Screening failed closed:", err);
  process.exit(1);
});
