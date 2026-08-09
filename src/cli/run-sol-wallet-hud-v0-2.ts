import { runWalletHudV02 } from "../application/wallet-intelligence/hud-v0-2.js";

function arg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const prefix = name + "=";
  const inline = args.find((item) => item.startsWith(prefix));
  if (inline) return inline.slice(prefix.length) || undefined;
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || undefined : undefined;
}

const evaluatedAt =
  arg("--evaluated-at") ??
  process.env.WALLET_HUD_EVALUATED_AT ??
  "2026-08-01T00:00:00.000Z";
const manifestPath =
  arg("--input-manifest") ??
  arg("--manifest") ??
  process.env.WALLET_HUD_MANIFEST_PATH;
const privateRoot = arg("--private-root");
const outputDir = arg("--output-private");
runWalletHudV02({
  evaluatedAt,
  ...(manifestPath ? { manifestPath } : {}),
  ...(privateRoot ? { privateRoot } : {}),
  ...(outputDir ? { outputDir } : {}),
})
  .then((result) => {
    console.log(
      JSON.stringify(
        {
          status: "SUCCESS",
          output_dir: result.outputDir,
          wallet_count: result.walletCount,
          scene_eligible_n: result.sceneEligibleN,
          scene_peer_n: result.scenePeerN,
          primary_scene_count: result.scenePrimarySceneCount,
          scene_percentile_count: result.scenePercentileCount,
          scene_unrated_count: result.sceneUnratedCount,
          full_import_count: result.fullImportCount,
          delta_import_count: result.deltaImportCount,
          changed_wallet_count: result.changedWalletCount,
          shadow_event_count: result.shadowEventCount,
          source_snapshot_hash: result.sourceSnapshotHash,
          source_snapshot_hashes: result.sourceSnapshotHashes,
          output_hashes: result.outputHashes,
        },
        null,
        2,
      ),
    );
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
