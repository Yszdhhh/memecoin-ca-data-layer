/**
 * TIERB-WALLET-IMPORT-001 — local-only import of chainfm_out usable pool.
 * Writes store under local data dir. Prints counts + irreversible digest only.
 * Never upload address plaintext to Git.
 *
 *   npx tsx src/cli/import-local-address-pool.ts --input <path> --data-dir <local>
 */
import path from "node:path";
import { LocalAddressStore } from "../application/address-store/local-address-store.js";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!;
  if (fallback !== undefined) return fallback;
  throw new Error(`missing_${name}`);
}

async function main(): Promise<void> {
  const input = arg("--input");
  const dataDir = arg("--data-dir", path.join(process.cwd(), ".local-data", "address-store"));
  const store = new LocalAddressStore(dataDir);
  const summary = store.importFromLocalFile(input);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        status: "ok",
        imported: summary.imported,
        skipped: summary.skipped,
        usablePool: summary.usablePool,
        sourceSha256: summary.sourceSha256,
        irreversibleDigest: summary.irreversibleDigest,
        storeCount: store.count(),
        dataDir,
        note: "Tier-B unverified only; Alpha=0; plaintext not for Git",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ status: "failed", error: e instanceof Error ? e.message : "import_failed" }));
  process.exit(1);
});
