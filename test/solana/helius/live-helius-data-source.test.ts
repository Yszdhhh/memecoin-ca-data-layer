import assert from "node:assert/strict";
import test from "node:test";
import { SourceDataUnavailableError } from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";
import { LiveHeliusDataSource } from "../../../src/infrastructure/solana/helius/live-helius-data-source.js";

const unitCredential = ["unit", "credential", "value"].join("-");

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

test("live Helius source requires an in-memory runtime credential", () => {
  assert.throws(
    () => new LiveHeliusDataSource(),
    (error: unknown) => error instanceof SourceDataUnavailableError && error.message === "helius_runtime_credential_unavailable",
  );
});

test("live Helius source reads finalized mint data without exposing its credential", async () => {
  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async (input, init) => {
      assert.ok(input instanceof URL);
      requests.push(init === undefined ? { url: new URL(input) } : { url: new URL(input), init });
      return json({ jsonrpc: "2.0", result: { context: { slot: 123 }, value: { amount: "42000", decimals: 6 } } });
    },
  });

  const result = await source.getMint("PublicMint");
  assert.deepEqual(result.data, { decimals: 6, supplyRaw: "42000" });
  assert.equal(result.watermark.finalizedSlot, 123n);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url.origin, "https://mainnet.helius-rpc.com");
  assert.equal(requests[0]?.url.pathname, "/");
  assert.equal(requests[0]?.init?.method, "POST");
  assert.equal(requests[0]?.init?.cache, "no-store");
  assert.ok(requests[0]?.init?.signal instanceof AbortSignal);
  assert.match(String(requests[0]?.init?.body), /getTokenSupply/);
});

test("live Helius source fails closed on a paginated holder response", async () => {
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async () => json({ result: { token_accounts: [], cursor: "more" } }),
  });

  await assert.rejects(
    () => source.getTokenAccounts("PublicMint"),
    (error: unknown) => error instanceof SourceDataUnavailableError && error.message === "helius_token_accounts_truncated",
  );
});

test("live Helius source maps complete Helius DAS accounts and metadata", async () => {
  let call = 0;
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async () => {
      call += 1;
      if (call === 1) {
        return json({ result: {
          token_accounts: [{ address: "AccountOne", ownership: { owner: "OwnerOne" }, token_info: { balance: "77" } }],
          total: 1,
          last_indexed_slot: 456,
        } });
      }
      return json({ result: { content: { metadata: { name: "Public token", symbol: "PUB" } }, last_indexed_slot: 457 } });
    },
  });

  const accounts = await source.getTokenAccounts("PublicMint");
  const metadata = await source.getTokenMetadata("PublicMint");
  assert.deepEqual(accounts.data, [{ tokenAccount: "AccountOne", owner: "OwnerOne", amountRaw: "77" }]);
  assert.equal(accounts.watermark.finalizedSlot, 456n);
  assert.deepEqual(metadata.data, { name: "Public token", symbol: "PUB" });
  assert.equal(metadata.watermark.finalizedSlot, 457n);
});

test("live Helius source enforces its fixed request budget", async () => {
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    requestBudget: 1,
    minRequestIntervalMs: 0,
    fetchImpl: async () => json({ result: { context: { slot: 1 }, value: { amount: "1", decimals: 0 } } }),
  });

  await source.getMint("PublicMint");
  await assert.rejects(
    () => source.getMint("PublicMint"),
    (error: unknown) => error instanceof SourceDataUnavailableError && error.message === "helius_request_budget_exhausted",
  );
});

test("live Helius source rejects unavailable facts instead of fabricating tags or wallets", async () => {
  const source = new LiveHeliusDataSource({ apiKey: unitCredential, minRequestIntervalMs: 0 });
  await assert.rejects(() => source.getAddressTags(["PublicAddress"]), /helius_address_tags_unavailable/);
  await assert.rejects(() => source.getWalletFacts(["PublicAddress"], new Date()), /helius_wallet_facts_unavailable/);
});
