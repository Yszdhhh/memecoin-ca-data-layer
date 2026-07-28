import assert from "node:assert/strict";
import test from "node:test";
import { readSolanaManualCaBatch } from "../../../src/application/live/solana-live-ca-batch.js";
import type { SolanaLiveCaFirstSource } from "../../../src/application/live/solana-live-ca-first.js";

const cas = ["DMYA7GexqPCeZeFxjDRjAgPbut24K3DhUAXcMH48JHoX", "So11111111111111111111111111111111111111112"];
function source(): SolanaLiveCaFirstSource {
  const watermark = { source: "helius" as const, observedAt: new Date(0), completeness: "complete" as const };
  return {
    async getMint() { return { data: { decimals: 6, supplyRaw: "1" }, watermark }; },
    async getTokenMetadata() { return { data: {}, watermark }; },
    async getTokenAccounts() { return { data: [], watermark }; },
  };
}

test("manual batch is capped, de-duplicated, and creates one bounded source per CA", async () => {
  let created = 0;
  const result = await readSolanaManualCaBatch(cas, () => { created += 1; return source(); });
  assert.equal(result.status, "OK");
  assert.equal(result.requestedCount, 2);
  assert.equal(result.results.length, 2);
  assert.equal(created, 2);
});

test("manual batch rejects empty, over-limit, duplicate, and invalid input without a source", async () => {
  let created = 0;
  const factory = () => { created += 1; return source(); };
  assert.equal((await readSolanaManualCaBatch([], factory)).warnings[0], "manual_ca_batch_count_must_be_1_to_10");
  assert.equal((await readSolanaManualCaBatch(Array.from({ length: 11 }, (_, i) => `${cas[0]}${i}`), factory)).status, "REJECTED");
  assert.equal((await readSolanaManualCaBatch([cas[0]!, cas[0]!], factory)).warnings[0], "manual_ca_batch_duplicate_ca");
  assert.equal((await readSolanaManualCaBatch([cas[0]!, "not-a-solana-ca"], factory)).warnings[0], "manual_ca_batch_invalid_ca");
  assert.equal(created, 0);
});
