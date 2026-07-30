import path from "node:path";
import { buildWalletIntelligenceMasterTable } from "../application/wallet-intelligence/master-table-builder.js";

async function main() {
  const inputDir = process.env.SOL_INPUT_DIR ?? "C:\\Users\\10639\\chainfm_out\\sol";
  const gmgnOutputDir =
    process.env.SOL_GMGN_OUTPUT_DIR ??
    "C:\\Users\\10639\\chainfm_out\\sol\\derived\\gmgn-wallet-stats-full-1433-live-rerun-002";
  const outputDir =
    process.env.SOL_MASTER_OUTPUT_DIR ??
    "C:\\Users\\10639\\chainfm_out\\sol\\derived\\wallet-intelligence-master-clean-rank-001";

  console.log("Starting SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-001 runner...");
  console.log(`Input dir: ${inputDir}`);
  console.log(`GMGN dir: ${gmgnOutputDir}`);
  console.log(`Output dir: ${outputDir}`);

  const result = await buildWalletIntelligenceMasterTable({
    inputDir,
    gmgnOutputDir,
    outputDir,
  });

  console.log("Run finished successfully!");
  console.log(`Status: ${result.status}`);
  console.log(`Valid Unique Wallets: ${result.metrics.validUniqueWallets}`);
  console.log(`Matched 7d: ${result.metrics.matched7dCount}`);
  console.log(`Matched 30d: ${result.metrics.matched30dCount}`);
  console.log(`Data Quality Tier Distribution:`, JSON.stringify(result.metrics.dataQualityTierDistribution, null, 2));
  console.log(`Candidate Union Count: ${result.metrics.candidateUnionCount}`);
}

main().catch((err) => {
  console.error("Runner failed closed:", err);
  process.exit(1);
});
