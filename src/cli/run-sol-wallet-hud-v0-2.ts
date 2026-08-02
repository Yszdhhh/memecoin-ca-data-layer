import { runWalletHudV02 } from "../application/wallet-intelligence/hud-v0-2.js";

runWalletHudV02({
  evaluatedAt: process.env.WALLET_HUD_EVALUATED_AT ?? "2026-08-01T00:00:00.000Z",
})
  .then((result) => {
    console.log(JSON.stringify({
      status: "SUCCESS",
      output_dir: result.outputDir,
      wallet_count: result.walletCount,
      scene_peer_n: result.scenePeerN,
      scene_percentile_count: result.scenePercentileCount,
      scene_unrated_count: result.sceneUnratedCount,
      full_import_count: result.fullImportCount,
      delta_import_count: result.deltaImportCount,
      changed_wallet_count: result.changedWalletCount,
      shadow_event_count: result.shadowEventCount,
    }, null, 2));
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
