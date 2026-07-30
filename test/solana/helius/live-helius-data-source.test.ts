import assert from "node:assert/strict";
import test from "node:test";
import { SourceDataUnavailableError } from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";
import { LiveHeliusDataSource } from "../../../src/infrastructure/solana/helius/live-helius-data-source.js";

const unitCredential = ["unit", "credential", "value"].join("-");
const publicCa = "DMYA7GexqPCeZeFxjDRjAgPbut24K3DhUAXcMH48JHoX";

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
      return json({
        jsonrpc: "2.0",
        result: {
          context: { slot: 123 },
          value: { data: { parsed: { type: "mint", info: { supply: "42000", decimals: 6 } } } },
        },
      });
    },
  });

  const result = await source.getMint(` ${publicCa} `);
  assert.deepEqual(result.data, { decimals: 6, supplyRaw: "42000" });
  assert.equal(result.watermark.finalizedSlot, 123n);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url.origin, "https://mainnet.helius-rpc.com");
  assert.equal(requests[0]?.url.pathname, "/");
  assert.equal(requests[0]?.init?.method, "POST");
  assert.equal(requests[0]?.init?.cache, "no-store");
  assert.ok(requests[0]?.init?.signal instanceof AbortSignal);
  assert.match(String(requests[0]?.init?.body), /getAccountInfo/);
});

test("live Helius source fails closed on a paginated holder response", async () => {
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async () => json({ result: { token_accounts: [], cursor: "more" } }),
  });

  await assert.rejects(
    () => source.getTokenAccounts(publicCa),
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
          cursor: "complete-page",
          last_indexed_slot: 456,
        } });
      }
      return json({ result: { content: { metadata: { name: "Public token", symbol: "PUB" } }, last_indexed_slot: 457 } });
    },
  });

  const accounts = await source.getTokenAccounts(publicCa);
  const metadata = await source.getTokenMetadata(publicCa);
  assert.deepEqual(accounts.data, [{ tokenAccount: "AccountOne", owner: "OwnerOne", amountRaw: "77" }]);
  assert.equal(accounts.watermark.finalizedSlot, 456n);
  assert.deepEqual(metadata.data, { name: "Public token", symbol: "PUB" });
  assert.equal(metadata.watermark.finalizedSlot, 457n);
});

test("live Helius source maps the documented flat token-account shape without precision loss", async () => {
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async () => json({ result: {
      token_accounts: [{ address: "AccountTwo", owner: "OwnerTwo", amount: 88 }],
      total: 1,
      last_indexed_slot: 458,
    } }),
  });

  const accounts = await source.getTokenAccounts(publicCa);
  assert.deepEqual(accounts.data, [{ tokenAccount: "AccountTwo", owner: "OwnerTwo", amountRaw: "88" }]);

  const unsafeAmountSource = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async () => json({ result: {
      token_accounts: [{ address: "AccountThree", owner: "OwnerThree", amount: Number.MAX_SAFE_INTEGER + 1 }],
      total: 1,
    } }),
  });
  await assert.rejects(
    () => unsafeAmountSource.getTokenAccounts(publicCa),
    (error: unknown) => error instanceof SourceDataUnavailableError && error.message === "helius_token_account_malformed",
  );
});

test("live Helius source keeps a valid transaction and marks partial when a transfer cannot be normalized", async () => {
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async () => json([{
      signature: "safe-signature",
      slot: 999,
      timestamp: 1_783_000_000,
      tokenTransfers: [{
        mint: "MintOne",
        fromUserAccount: "FromOne",
        toUserAccount: "ToOne",
        tokenAmount: 1.5,
      }],
      nativeTransfers: [{ fromUserAccount: "NativeFrom", toUserAccount: "NativeTo", amount: 7 }],
    }]),
  });

  const result = await source.getTransactions([publicCa], new Date("2020-01-01T00:00:00.000Z"));
  assert.equal(result.watermark.completeness, "partial");
  assert.deepEqual(result.data, [{
    signature: "safe-signature",
    slot: "999",
    blockTime: "2026-07-02T13:46:40.000Z",
    tokenTransfers: [],
    nativeTransfers: [{ eventIndex: 0, from: "NativeFrom", to: "NativeTo", amountRaw: "7" }],
  }]);
});

test("live Helius source still rejects a transaction with invalid core identity fields", async () => {
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async () => json([{
      signature: "",
      slot: 999,
      timestamp: 1_783_000_000,
    }]),
  });

  await assert.rejects(
    () => source.getTransactions([publicCa], new Date("2020-01-01T00:00:00.000Z")),
    (error: unknown) => error instanceof SourceDataUnavailableError && error.message === "helius_transaction_malformed",
  );
});
test("live Helius source enforces its fixed request budget", async () => {
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    requestBudget: 1,
    minRequestIntervalMs: 0,
    fetchImpl: async () => json({
      result: { context: { slot: 1 }, value: { data: { parsed: { type: "mint", info: { supply: "1", decimals: 0 } } } } },
    }),
  });

  await source.getMint(publicCa);
  await assert.rejects(
    () => source.getMint(publicCa),
    (error: unknown) => error instanceof SourceDataUnavailableError && error.message === "helius_request_budget_exhausted",
  );
});

test("live Helius source rejects invalid addresses before fetch", async () => {
  let fetchCalls = 0;
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async () => {
      fetchCalls += 1;
      return json({ result: null });
    },
  });
  const invalidCalls = [
    () => source.getMint("abc"),
    () => source.getTokenAccounts("not-a-solana-address"),
    () => source.getTokenMetadata(`${publicCa}0`),
    () => source.getTransactions(["1".repeat(31)], new Date(0)),
  ];

  for (const call of invalidCalls) {
    await assert.rejects(
      call,
      (error: unknown) => error instanceof SourceDataUnavailableError && error.message === "helius_address_invalid",
    );
  }
  assert.equal(fetchCalls, 0);
});

test("live Helius source rejects unavailable facts instead of fabricating tags or wallets", async () => {
  const source = new LiveHeliusDataSource({ apiKey: unitCredential, minRequestIntervalMs: 0 });
  await assert.rejects(() => source.getAddressTags(["PublicAddress"]), /helius_address_tags_unavailable/);
  await assert.rejects(() => source.getWalletFacts(["PublicAddress"], new Date()), /helius_wallet_facts_unavailable/);
});

test("live Helius source supports only the allowlisted gatekeeper beta RPC endpoint", async () => {
  const requests: URL[] = [];
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    rpcEndpointMode: "gatekeeper_beta",
    minRequestIntervalMs: 0,
    fetchImpl: async (input) => {
      assert.ok(input instanceof URL);
      requests.push(new URL(input));
      return json({
        result: {
          context: { slot: 123 },
          value: { data: { parsed: { type: "mint", info: { supply: "1", decimals: 0 } } } },
        },
      });
    },
  });

  await source.getMint(publicCa);
  assert.equal(requests[0]?.origin, "https://beta.helius-rpc.com");
});

test("runtime Helius endpoint mode fails closed instead of accepting an arbitrary URL", () => {
  const previousKey = process.env.HELIUS_API_KEY;
  const previousMode = process.env.HELIUS_RPC_ENDPOINT_MODE;
  try {
    Reflect.set(process.env, "HELIUS_API_KEY", unitCredential);
    Reflect.set(process.env, "HELIUS_RPC_ENDPOINT_MODE", "https://attacker.invalid");
    assert.throws(
      () => LiveHeliusDataSource.fromRuntime(),
      (error: unknown) => error instanceof SourceDataUnavailableError && error.message === "helius_rpc_endpoint_mode_invalid",
    );
  } finally {
    if (previousKey === undefined) Reflect.deleteProperty(process.env, "HELIUS_API_KEY");
    else Reflect.set(process.env, "HELIUS_API_KEY", previousKey);
    if (previousMode === undefined) Reflect.deleteProperty(process.env, "HELIUS_RPC_ENDPOINT_MODE");
    else Reflect.set(process.env, "HELIUS_RPC_ENDPOINT_MODE", previousMode);
  }
});
