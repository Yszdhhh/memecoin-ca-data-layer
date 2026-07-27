import assert from "node:assert/strict";
import test from "node:test";
import {
  readSolanaLiveCaFirst,
  SOLANA_LIVE_CA_FIRST_VERSION,
  type SolanaLiveCaFirstSource,
} from "../../../src/application/live/solana-live-ca-first.js";

const ca = "DMYA7GexqPCeZeFxjDRjAgPbut24K3DhUAXcMH48JHoX";
const observedAt = new Date("2026-07-27T00:00:00.000Z");

function source(overrides: Partial<SolanaLiveCaFirstSource> = {}): SolanaLiveCaFirstSource {
  return {
    async getMint() {
      return {
        data: { decimals: 6, supplyRaw: "42000000" },
        watermark: { source: "helius", observedAt, finalizedSlot: 101n, completeness: "complete" },
      };
    },
    async getTokenMetadata() {
      return {
        data: { name: "Public token", symbol: "PUB" },
        watermark: { source: "helius", observedAt, finalizedSlot: 102n, completeness: "complete" },
      };
    },
    async getTokenAccounts() {
      return {
        data: [
          { tokenAccount: "AccountOne", owner: "OwnerOne", amountRaw: "5" },
          { tokenAccount: "AccountTwo", owner: "OwnerTwo", amountRaw: "7" },
        ],
        watermark: { source: "helius", observedAt, finalizedSlot: 103n, completeness: "complete" },
      };
    },
    ...overrides,
  };
}

test("manual CA-first result exposes only bounded Helius first-look fields", async () => {
  const result = await readSolanaLiveCaFirst(ca, source());

  assert.equal(result.entrypointVersion, SOLANA_LIVE_CA_FIRST_VERSION);
  assert.equal(result.status, "OK");
  assert.deepEqual(result.mint, { available: true, decimals: 6 });
  assert.deepEqual(result.metadata, { available: true });
  assert.deepEqual(result.holderTokenAccounts, { available: true, count: 2 });
  assert.deepEqual(result.completeness, { state: "complete", availableFields: 3, requiredFields: 3 });
  assert.deepEqual(result.sourceSlots, {
    mintFinalizedSlot: "101",
    metadataIndexedSlot: "102",
    holderAccountsIndexedSlot: "103",
  });
  assert.deepEqual(result.warnings, []);
  assert.equal("supplyRaw" in result.mint, false);
  assert.equal("name" in result.metadata, false);
  assert.equal("accounts" in result.holderTokenAccounts, false);
});

test("manual CA-first degrades safely when one bounded Helius read is unavailable", async () => {
  const result = await readSolanaLiveCaFirst(ca, source({
    async getTokenAccounts() {
      throw new Error("helius_token_accounts_truncated");
    },
  }));

  assert.equal(result.status, "DEGRADED");
  assert.deepEqual(result.holderTokenAccounts, { available: false, count: null });
  assert.deepEqual(result.completeness, { state: "partial", availableFields: 2, requiredFields: 3 });
  assert.equal(result.sourceSlots.holderAccountsIndexedSlot, null);
  assert.ok(result.warnings.includes("helius_token_accounts_truncated"));
});

test("manual CA-first rejects an invalid CA without calling the live source", async () => {
  let calls = 0;
  const result = await readSolanaLiveCaFirst("not a Solana CA", source({
    async getMint() {
      calls += 1;
      throw new Error("should not run");
    },
  }));

  assert.equal(result.status, "REJECTED");
  assert.deepEqual(result.completeness, { state: "unavailable", availableFields: 0, requiredFields: 3 });
  assert.deepEqual(result.warnings, ["solana_ca_invalid"]);
  assert.equal(calls, 0);
});

test("manual CA-first never returns arbitrary transport error text", async () => {
  const result = await readSolanaLiveCaFirst(ca, source({
    async getMint() {
      throw new Error("https://example.invalid/?api-key=credential-value");
    },
  }));

  assert.equal(result.status, "DEGRADED");
  assert.ok(result.warnings.includes("helius_live_read_unavailable"));
  assert.equal(result.warnings.some((warning) => warning.includes("credential")), false);
});
