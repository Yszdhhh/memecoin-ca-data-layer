import assert from "node:assert/strict";
import test from "node:test";
import type { TokenRef } from "../../../src/domain/types.js";
import { SourceDataUnavailableError } from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";
import { LiveHeliusDataSource } from "../../../src/infrastructure/solana/helius/live-helius-data-source.js";
import type { SolanaHolderSnapshot } from "../../../src/infrastructure/solana/holders/solana-holder-snapshot-service.js";
import { PUMP_IDL_COMMIT, PUMP_IDL_SHA256, PUMP_PROGRAM_ID } from "../../../src/infrastructure/solana/pump/pump-instruction-decoder.js";

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

test("live Helius source returns a partial holder set instead of rejecting a paginated response", async () => {
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async () => json({ result: {
      token_accounts: [{ address: "AccountOne", ownership: { owner: "OwnerOne" }, token_info: { balance: "77" } }],
      total: 1_001,
      cursor: "more",
      last_indexed_slot: 456,
    } }),
  });

  const accounts = await source.getTokenAccounts(publicCa);
  assert.deepEqual(accounts.data, [{ tokenAccount: "AccountOne", owner: "OwnerOne", amountRaw: "77" }]);
  assert.equal(accounts.watermark.completeness, "partial");
  assert.equal(accounts.watermark.cursor, "more");
  assert.equal(accounts.watermark.finalizedSlot, 456n);
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

function tokenRef(ca: string, createdAt?: string, totalSupplyRaw = 1_000_000n): TokenRef {
  return {
    id: `solana:${ca}`,
    chain: "solana",
    ca,
    decimals: 6,
    totalSupplyRaw,
    launchpad: "unknown",
    ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
  };
}

test("live Helius source enumerates holders, aggregates owners, and applies cleaning evidence", async () => {
  let call = 0;
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async () => {
      call += 1;
      if (call === 1) {
        return json({ result: {
          token_accounts: [
            { address: "ata-curve", ownership: { owner: "curve" }, token_info: { balance: "600" } },
            { address: "ata-alice", ownership: { owner: "alice" }, token_info: { balance: "400" } },
          ],
          total: 3,
          cursor: "page-2",
          last_indexed_slot: 1000,
        } });
      }
      return json({ result: {
        token_accounts: [{ address: "ata-bob", ownership: { owner: "bob" }, token_info: { balance: "0" } }],
        total: 3,
        last_indexed_slot: 1000,
      } });
    },
  });

  const snapshot = await source.getHolderSnapshot(
    tokenRef(publicCa, undefined, 1_000n),
    [{ chain: "solana", address: "curve", role: "bonding_curve", source: "system", confidence: 1 }],
    [],
  );

  assert.equal(call, 2);
  assert.equal(snapshot.data.completeness, "complete");
  assert.equal(snapshot.watermark.completeness, "complete");
  assert.equal(snapshot.data.ownerBalances.get("curve"), 600n);
  assert.equal(snapshot.data.ownerBalances.get("alice"), 400n);
  assert.equal(snapshot.data.ownerBalances.get("bob"), 0n);
  assert.equal(snapshot.data.concentration?.eligibleHolderCount, 2);
  assert.equal(snapshot.data.concentration?.excludedPct, 60);
  assert.deepEqual(snapshot.data.cleaningEvidence, [{
    address: "curve",
    balanceRaw: 600n,
    exclusionReason: "bonding_curve",
    confidence: 1,
    ruleVersion: "v1",
    rawTokenAccounts: [{ tokenAccountAddress: "ata-curve", ownerAddress: "curve", balanceRaw: 600n }],
    label: { chain: "solana", address: "curve", role: "bonding_curve", source: "system", confidence: 1 },
  }]);
  assert.deepEqual(snapshot.data.warnings, []);
});

test("live Helius source returns a partial holder snapshot with warnings when enumeration is truncated by budget", async () => {
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    requestBudget: 1,
    minRequestIntervalMs: 0,
    fetchImpl: async () => json({ result: {
      token_accounts: [{ address: "ata-alice", ownership: { owner: "alice" }, token_info: { balance: "400" } }],
      total: 10,
      cursor: "page-2",
      last_indexed_slot: 1000,
    } }),
  });

  const snapshot = await source.getHolderSnapshot(tokenRef(publicCa), [], []);

  assert.equal(snapshot.data.completeness, "partial");
  assert.equal(snapshot.watermark.completeness, "partial");
  assert.equal(snapshot.data.concentration, null);
  assert.deepEqual(snapshot.data.cleaningEvidence, []);
  assert.match(snapshot.data.warnings.join(" "), /Holder enumeration is partial/);
});

test("live Helius source decodes pinned Pump create evidence from raw transactions", async () => {
  const pumpMint = "GyjN383QnJvUPbgNxaJBcWsKK35wU8HUnorKACsDpump";
  const pumpAccounts = [
    pumpMint,
    "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM",
    "264oL748gtjJ1DVMFxyAMxsZMVo1ZS4aSVG6i7VAqwWw",
    "AKjd7FPHnHbA4EDJNs9jWiUFs6Y3H6SKrfUjGBABDbEb",
    "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf",
    "AjqkgiKvFqDs44wZQ3Zzd1FwkzrGN2hQ68FgrkyS6J9t",
    "11111111111111111111111111111111",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e",
    "13ec7XdrjF3h3YcqBTFDSReRcUFwbCnJaAQspM4j6DDJ",
    "BwWK17cbHxwWBKZkUYvzxLcNQ1YVyaFezduWbtm2de6s",
    "Hh6rWxCLXgkZ3Kc7weSzSwggrTeQCmrySYh1JhjNgtJF",
    "EMxKgzhkK1YdqTCK2kwQr9XhrmVb6N22agZbwJsRD7sY",
    "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1",
    PUMP_PROGRAM_ID,
  ];
  const createDataBase58 = "7A4gXKnR533VcdxJ85Szdwps5LxLpGqNVoc4sdGn4NHgM27Yw6VPdUJFwatvexkZC5gGtQv7BTEd4ejHJJuWhgCgqEinjcfokqS59qHwbi1T2aXN6gvt4xaAjq7xoCUg425fYeBFBcyjEPG1uifa";
  const createSignature = "4VXF3mBhmFYkSXuminmxq9g3VK59bVtBESy3dE3NVjFdEQXPpwvmT8DwobgwNZALiJzv8BgQsp2tDBoPTL73rMq9";
  const createSlot = 434_047_786;
  const createBlockTime = 1_784_528_592;
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async (input, init) => {
      assert.ok(input instanceof URL);
      if (init?.method === "GET") {
        assert.equal(input.pathname, `/v0/addresses/${pumpMint}/transactions`);
        return json([{
          signature: createSignature,
          slot: createSlot,
          timestamp: createBlockTime,
          tokenTransfers: [],
          nativeTransfers: [],
        }]);
      }
      assert.match(String(init?.body ?? ""), /getTransaction/);
      return json({
        result: {
          slot: createSlot,
          blockTime: createBlockTime,
          transaction: {
            message: {
              accountKeys: pumpAccounts,
              instructions: [{
                programIdIndex: 15,
                accounts: pumpAccounts.map((_, index) => index),
                data: createDataBase58,
              }],
            },
          },
        },
      });
    },
  });

  const evidence = await source.getPumpCreatorEvidence(tokenRef(pumpMint));

  assert.equal(evidence.watermark.completeness, "complete");
  assert.deepEqual(evidence.data, {
    source: "pump_create.creator",
    creatorAddress: "AjqkgiKvFqDs44wZQ3Zzd1FwkzrGN2hQ68FgrkyS6J9t",
    signature: createSignature,
    slot: BigInt(createSlot),
    blockTime: new Date(createBlockTime * 1_000),
    programId: PUMP_PROGRAM_ID,
    sourceCommit: PUMP_IDL_COMMIT,
    idlSha256: PUMP_IDL_SHA256,
  });
});

test("live Helius source finds the Pump create by paging to the oldest transactions", async () => {
  const pumpMint = "GyjN383QnJvUPbgNxaJBcWsKK35wU8HUnorKACsDpump";
  const pumpAccounts = [
    pumpMint,
    "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM",
    "264oL748gtjJ1DVMFxyAMxsZMVo1ZS4aSVG6i7VAqwWw",
    "AKjd7FPHnHbA4EDJNs9jWiUFs6Y3H6SKrfUjGBABDbEb",
    "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf",
    "AjqkgiKvFqDs44wZQ3Zzd1FwkzrGN2hQ68FgrkyS6J9t",
    "11111111111111111111111111111111",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e",
    "13ec7XdrjF3h3YcqBTFDSReRcUFwbCnJaAQspM4j6DDJ",
    "BwWK17cbHxwWBKZkUYvzxLcNQ1YVyaFezduWbtm2de6s",
    "Hh6rWxCLXgkZ3Kc7weSzSwggrTeQCmrySYh1JhjNgtJF",
    "EMxKgzhkK1YdqTCK2kwQr9XhrmVb6N22agZbwJsRD7sY",
    "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1",
    PUMP_PROGRAM_ID,
  ];
  const createDataBase58 = "7A4gXKnR533VcdxJ85Szdwps5LxLpGqNVoc4sdGn4NHgM27Yw6VPdUJFwatvexkZC5gGtQv7BTEd4ejHJJuWhgCgqEinjcfokqS59qHwbi1T2aXN6gvt4xaAjq7xoCUg425fYeBFBcyjEPG1uifa";
  const createSignature = "4VXF3mBhmFYkSXuminmxq9g3VK59bVtBESy3dE3NVjFdEQXPpwvmT8DwobgwNZALiJzv8BgQsp2tDBoPTL73rMq9";
  const createSlot = 434_047_786;
  const createBlockTime = 1_784_528_592;
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    requestBudget: 30,
    minRequestIntervalMs: 0,
    fetchImpl: async (input, init) => {
      assert.ok(input instanceof URL);
      if (init?.method === "GET") {
        assert.equal(input.pathname, `/v0/addresses/${pumpMint}/transactions`);
        const before = input.searchParams.get("before");
        if (before === null) {
          // Newest page: 100 ordinary transactions (>=100 tx makes the create
          // fall outside the first page, which previously hid it forever).
          return json(Array.from({ length: 100 }, (_, index) => ({
            signature: `filler-${String(index).padStart(3, "0")}`,
            slot: 433_000_000 + index,
            timestamp: 1_783_500_000 + index,
            tokenTransfers: [],
            nativeTransfers: [],
          })));
        }
        // Oldest page: the create transaction.
        return json([{
          signature: createSignature,
          slot: createSlot,
          timestamp: createBlockTime,
          tokenTransfers: [],
          nativeTransfers: [],
        }]);
      }
      assert.match(String(init?.body ?? ""), /getTransaction/);
      return json({
        result: {
          slot: createSlot,
          blockTime: createBlockTime,
          transaction: {
            message: {
              accountKeys: pumpAccounts,
              instructions: [{
                programIdIndex: 15,
                accounts: pumpAccounts.map((_, index) => index),
                data: createDataBase58,
              }],
            },
          },
        },
      });
    },
  });

  const evidence = await source.getPumpCreatorEvidence(tokenRef(pumpMint));

  assert.equal(evidence.watermark.completeness, "complete");
  assert.deepEqual(evidence.data, {
    source: "pump_create.creator",
    creatorAddress: "AjqkgiKvFqDs44wZQ3Zzd1FwkzrGN2hQ68FgrkyS6J9t",
    signature: createSignature,
    slot: BigInt(createSlot),
    blockTime: new Date(createBlockTime * 1_000),
    programId: PUMP_PROGRAM_ID,
    sourceCommit: PUMP_IDL_COMMIT,
    idlSha256: PUMP_IDL_SHA256,
  });
});

test("live Helius source returns null partial evidence when the Pump create cannot be decoded", async () => {
  const pumpMint = "GyjN383QnJvUPbgNxaJBcWsKK35wU8HUnorKACsDpump";
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async (input, init) => {
      assert.ok(input instanceof URL);
      if (init?.method === "GET") {
        return json([{
          signature: "create-signature",
          slot: 434_047_786,
          timestamp: 1_784_528_592,
          tokenTransfers: [],
          nativeTransfers: [],
        }]);
      }
      assert.match(String(init?.body ?? ""), /getTransaction/);
      return json({
        result: {
          slot: 434_047_786,
          blockTime: 1_784_528_592,
          transaction: {
            message: {
              accountKeys: [pumpMint, "AjqkgiKvFqDs44wZQ3Zzd1FwkzrGN2hQ68FgrkyS6J9t", PUMP_PROGRAM_ID],
              instructions: [{
                programIdIndex: 2,
                accounts: [0, 1, 2],
                data: "1",
              }],
            },
          },
        },
      });
    },
  });

  const evidence = await source.getPumpCreatorEvidence(tokenRef(pumpMint));

  assert.equal(evidence.data, null);
  assert.equal(evidence.watermark.completeness, "partial");
});

test("live Helius source computes complete dev history from creation when the full list is present", async () => {
  const ca = "GyjN383QnJvUPbgNxaJBcWsKK35wU8HUnorKACsDpump";
  const createdAt = "2026-07-20T00:00:00.000Z";
  const epoch = (iso: string) => Math.floor(new Date(iso).getTime() / 1_000);
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async (input, init) => {
      assert.ok(input instanceof URL);
      assert.equal(init?.method, "GET");
      return json([
        {
          signature: "sell-sig",
          slot: 600,
          timestamp: epoch("2026-07-21T00:00:00.000Z"),
          swap: {
            fromUserAccount: "creator",
            tokenInputs: [{ mint: ca, rawTokenAmount: { tokenAmount: "50000", decimals: 6 } }],
            tokenOutputs: [],
            nativeOutput: { account: "creator", amount: "100000" },
            programId: PUMP_PROGRAM_ID,
            programName: "pump.fun",
          },
          tokenTransfers: [],
          nativeTransfers: [],
        },
        {
          signature: "buy-sig",
          slot: 550,
          timestamp: epoch("2026-07-20T12:00:00.000Z"),
          swap: {
            fromUserAccount: "creator",
            tokenInputs: [],
            tokenOutputs: [{ mint: ca, rawTokenAmount: { tokenAmount: "200000", decimals: 6 } }],
            nativeInput: { account: "creator", amount: "500000000" },
            programId: PUMP_PROGRAM_ID,
            programName: "pump.fun",
          },
          tokenTransfers: [],
          nativeTransfers: [],
        },
        {
          signature: "create-sig",
          slot: 500,
          timestamp: epoch(createdAt),
          tokenTransfers: [],
          nativeTransfers: [],
        },
      ]);
    },
  });
  const holderSnapshot: SolanaHolderSnapshot = {
    tokenAddress: ca,
    totalSupplyRaw: 1_000_000n,
    completeness: "complete",
    rawTokenAccounts: [],
    ownerBalances: new Map([["creator", 150_000n], ["related", 50_000n], ["alice", 800_000n]]),
    watermarks: [{ source: "helius", observedAt: new Date(createdAt), finalizedSlot: 600n, completeness: "complete" }],
    concentration: null,
    cleaningEvidence: [],
    warnings: [],
  };
  const creatorEvidence = {
    source: "pump_create.creator" as const,
    creatorAddress: "creator",
    signature: "create-sig",
    slot: 500n,
    blockTime: new Date(createdAt),
    programId: PUMP_PROGRAM_ID,
    sourceCommit: PUMP_IDL_COMMIT,
    idlSha256: PUMP_IDL_SHA256,
  };

  const result = await source.getDevHistory({
    token: tokenRef(ca, createdAt),
    creatorEvidence,
    holderSnapshot,
    relatedAddresses: ["related"],
    at: new Date("2026-07-24T00:00:00.000Z"),
  });

  assert.equal(result.watermark.completeness, "complete");
  assert.equal(result.data.coverage.completeFromCreation, true);
  assert.deepEqual(result.data.warnings, []);
  assert.equal(result.data.dev?.currentHoldingPct, 15);
  assert.equal(result.data.dev?.relatedHoldingPct, 5);
  assert.equal(result.data.dev?.grossBoughtPct, 20);
  assert.equal(result.data.dev?.grossSoldPct, 5);
  assert.equal(result.data.dev?.soldOfAcquiredPct, 25);
  assert.equal(result.data.dev?.directSellCount, 1);
  assert.equal(result.data.dev?.outboundTransferPct, 0);
});

test("live Helius source refuses dev totals with a warning when history does not reach creation", async () => {
  const ca = "GyjN383QnJvUPbgNxaJBcWsKK35wU8HUnorKACsDpump";
  const createdAt = "2026-07-20T00:00:00.000Z";
  const epoch = (iso: string) => Math.floor(new Date(iso).getTime() / 1_000);
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    fetchImpl: async () => json([
      {
        signature: "sell-sig",
        slot: 600,
        timestamp: epoch("2026-07-21T00:00:00.000Z"),
        swap: {
          fromUserAccount: "creator",
          tokenInputs: [{ mint: ca, rawTokenAmount: { tokenAmount: "50000", decimals: 6 } }],
          tokenOutputs: [],
          nativeOutput: { account: "creator", amount: "100000" },
          programId: PUMP_PROGRAM_ID,
          programName: "pump.fun",
        },
        tokenTransfers: [],
        nativeTransfers: [],
      },
      {
        signature: "buy-sig",
        slot: 550,
        timestamp: epoch("2026-07-20T12:00:00.000Z"),
        swap: {
          fromUserAccount: "creator",
          tokenInputs: [],
          tokenOutputs: [{ mint: ca, rawTokenAmount: { tokenAmount: "200000", decimals: 6 } }],
          nativeInput: { account: "creator", amount: "500000000" },
          programId: PUMP_PROGRAM_ID,
          programName: "pump.fun",
        },
        tokenTransfers: [],
        nativeTransfers: [],
      },
    ]),
  });
  const holderSnapshot: SolanaHolderSnapshot = {
    tokenAddress: ca,
    totalSupplyRaw: 1_000_000n,
    completeness: "complete",
    rawTokenAccounts: [],
    ownerBalances: new Map([["creator", 150_000n]]),
    watermarks: [{ source: "helius", observedAt: new Date(createdAt), finalizedSlot: 600n, completeness: "complete" }],
    concentration: null,
    cleaningEvidence: [],
    warnings: [],
  };
  const creatorEvidence = {
    source: "pump_create.creator" as const,
    creatorAddress: "creator",
    signature: "create-sig",
    slot: 500n,
    blockTime: new Date(createdAt),
    programId: PUMP_PROGRAM_ID,
    sourceCommit: PUMP_IDL_COMMIT,
    idlSha256: PUMP_IDL_SHA256,
  };

  const result = await source.getDevHistory({
    token: tokenRef(ca, createdAt),
    creatorEvidence,
    holderSnapshot,
    relatedAddresses: [],
    at: new Date("2026-07-24T00:00:00.000Z"),
  });

  assert.equal(result.watermark.completeness, "partial");
  assert.equal(result.data.coverage.completeFromCreation, false);
  assert.equal(result.data.dev, null);
  assert.ok(result.data.warnings.includes("DEV_HISTORY_INCOMPLETE_FROM_CREATION"));
});
