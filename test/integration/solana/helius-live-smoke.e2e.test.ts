import assert from "node:assert/strict";
import test from "node:test";
import { LiveHeliusDataSource } from "../../../src/infrastructure/solana/helius/live-helius-data-source.js";

const runLive = process.env.RUN_HELIUS_LIVE_E2E === "1";
const publicCa = "DMYA7GexqPCeZeFxjDRjAgPbut24K3DhUAXcMH48JHoX";

test("manual Helius live smoke reads bounded public CA facts", {
  skip: runLive ? false : "set RUN_HELIUS_LIVE_E2E=1 for the manually authorized live smoke",
}, async (t) => {
  const source = LiveHeliusDataSource.fromRuntime({
    requestBudget: 5,
    minRequestIntervalMs: 150,
    timeoutMs: 8_000,
  });

  const mint = await source.getMint(publicCa);
  const metadata = await source.getTokenMetadata(publicCa);
  const accounts = await source.getTokenAccounts(publicCa);

  if (mint.data === null) throw new Error("Public CA mint was not found");
  assert.ok(mint.data.decimals >= 0);
  assert.match(mint.data.supplyRaw, /^\d+$/);
  assert.notEqual(metadata.data, null);
  assert.equal(accounts.watermark.completeness, "complete");
  assert.ok(accounts.data.length > 0);
  assert.ok(accounts.data.every((account) => /^\d+$/.test(account.amountRaw)));

  t.diagnostic(JSON.stringify({
    publicCa,
    mintDecimals: mint.data.decimals,
    metadataPresent: metadata.data !== null,
    holderAccountCount: accounts.data.length,
    mintFinalizedSlot: mint.watermark.finalizedSlot?.toString() ?? null,
    accountIndexedSlot: accounts.watermark.finalizedSlot?.toString() ?? null,
  }));
});