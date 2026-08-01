import { runWalletHudV02 } from "../application/wallet-intelligence/hud-v0-2.js";

function arg(name: string): string | undefined {
  const prefix = name + "=";
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return value?.slice(prefix.length) || undefined;
}

const evaluatedAt =
  arg("--evaluated-at") ?? process.env.WALLET_HUD_EVALUATED_AT;
const manifestPath = arg("--manifest") ?? process.env.WALLET_HUD_MANIFEST_PATH;
if (!evaluatedAt) {
  console.error(
    "--evaluated-at or WALLET_HUD_EVALUATED_AT is required for operational refresh",
  );
  process.exitCode = 1;
} else {
  runWalletHudV02(
    manifestPath ? { evaluatedAt, manifestPath } : { evaluatedAt },
  )
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
}
