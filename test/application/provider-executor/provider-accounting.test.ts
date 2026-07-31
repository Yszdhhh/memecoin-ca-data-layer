import assert from "node:assert/strict";
import test from "node:test";
import { ProviderExecutor } from "../../../src/application/provider-executor/provider-executor.js";
import { LiveHeliusDataSource } from "../../../src/infrastructure/solana/helius/live-helius-data-source.js";
import { SourceDataUnavailableError } from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";

const unitCredential = ["unit", "credential", "value"].join("-");
// Valid 32-byte base58 public mint used across pilot/fixture tests.
const publicCa = "H3GtwGSrYRVqp7dtjkaDfjE2inydLkHwFkFJSPzrpump";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pagePayload(opts: {
  accounts: Array<{ address: string; owner: string; amount: string }>;
  cursor?: string;
  total?: number;
  slot?: number;
}): unknown {
  return {
    jsonrpc: "2.0",
    result: {
      token_accounts: opts.accounts.map((a) => ({
        address: a.address,
        owner: a.owner,
        amount: a.amount,
      })),
      ...(opts.cursor !== undefined ? { cursor: opts.cursor } : {}),
      ...(opts.total !== undefined ? { total: opts.total } : {}),
      last_indexed_slot: opts.slot ?? 100,
    },
  };
}

test("3-page pagination: providerRequestCount=3, operation count may be 1 enumerate", async () => {
  const logs: string[] = [];
  const executor = new ProviderExecutor({ taskId: "t-page3", budget: 10, log: (l) => logs.push(l) });
  let page = 0;
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    executor,
    fetchImpl: async () => {
      page += 1;
      if (page === 1) {
        return json(pagePayload({
          accounts: [{ address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", owner: "So11111111111111111111111111111111111111112", amount: "10" }],
          cursor: "c1",
          total: 3,
          slot: 1,
        }));
      }
      if (page === 2) {
        return json(pagePayload({
          accounts: [{ address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", owner: "11111111111111111111111111111111", amount: "20" }],
          cursor: "c2",
          total: 3,
          slot: 2,
        }));
      }
      return json(pagePayload({
        accounts: [{ address: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", owner: "ComputeBudget111111111111111111111111111111", amount: "30" }],
        total: 3,
        slot: 3,
      }));
    },
  });

  await executor.executeOperation("enumerateTokenAccounts", () =>
    source.enumerateTokenAccounts(publicCa, { maxPages: 10, pageSize: 1 }),
  );

  const m = executor.metrics;
  assert.equal(m.providerRequestCount, 3, "each page is one HTTP attempt");
  assert.equal(m.providerOperationCount, 1, "enumerate is one logical operation");
  assert.equal(m.pageCount, 3);
  assert.equal(m.retryCount, 0);
  assert.equal(m.providerBudgetExhausted, false);
  // No URL / key leak in executor logs.
  const joined = logs.join("\n");
  assert.equal(joined.includes("api-key"), false);
  assert.equal(joined.includes(unitCredential), false);
  assert.equal(joined.includes("mainnet.helius-rpc.com"), false);
  assert.equal(joined.includes("https://"), false);
});

test("page-2 429 then success: retry counted in request count, retryCount=1, no key leak", async () => {
  const logs: string[] = [];
  const executor = new ProviderExecutor({ taskId: "t-retry", budget: 10, log: (l) => logs.push(l) });
  let calls = 0;
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    executor,
    fetchImpl: async () => {
      calls += 1;
      // Page 1 OK
      if (calls === 1) {
        return json(pagePayload({
          accounts: [{ address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", owner: "So11111111111111111111111111111111111111112", amount: "1" }],
          cursor: "more",
          total: 2,
        }));
      }
      // Page 2 first attempt 429
      if (calls === 2) {
        return new Response("rate limited", { status: 429 });
      }
      // Page 2 retry success
      return json(pagePayload({
        accounts: [{ address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", owner: "11111111111111111111111111111111", amount: "2" }],
        total: 2,
      }));
    },
  });

  const result = await source.enumerateTokenAccounts(publicCa, { maxPages: 5, pageSize: 1 });
  assert.equal(result.paginationComplete, true);
  assert.equal(calls, 3);
  assert.equal(executor.metrics.providerRequestCount, 3, "retry is a real HTTP attempt");
  assert.equal(executor.metrics.retryCount, 1);
  const joined = logs.join("\n");
  assert.equal(joined.includes(unitCredential), false);
  assert.equal(joined.includes("api-key="), false);
  assert.equal(joined.includes("https://"), false);
});

test("budget=2 needing 3 pages: ≤2 requests, partial incomplete, ineligible, budget exhausted", async () => {
  const executor = new ProviderExecutor({ taskId: "t-budget2", budget: 2 });
  let calls = 0;
  const source = new LiveHeliusDataSource({
    apiKey: unitCredential,
    minRequestIntervalMs: 0,
    executor,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return json(pagePayload({
          accounts: [{ address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", owner: "So11111111111111111111111111111111111111112", amount: "1" }],
          cursor: "c1",
          total: 3,
        }));
      }
      if (calls === 2) {
        return json(pagePayload({
          accounts: [{ address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", owner: "11111111111111111111111111111111", amount: "2" }],
          cursor: "c2",
          total: 3,
        }));
      }
      // Must never be reached.
      return json(pagePayload({
        accounts: [{ address: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", owner: "ComputeBudget111111111111111111111111111111", amount: "3" }],
        total: 3,
      }));
    },
  });

  const result = await source.enumerateTokenAccounts(publicCa, { maxPages: 10, pageSize: 1 });
  assert.ok(calls <= 2, `calls=${calls} must be ≤2`);
  assert.equal(executor.metrics.providerRequestCount, 2);
  assert.equal(result.paginationComplete, false);
  assert.ok(result.accounts.length >= 1, "partial pages retained");
  assert.equal(executor.metrics.providerBudgetExhausted, true);
  // No 3rd HTTP.
  assert.equal(calls, 2);
});

test("missing credential: zero requests, throws credential unavailable (not budget exhausted)", () => {
  const executor = new ProviderExecutor({ taskId: "t-cred", budget: 5 });
  assert.throws(
    () => new LiveHeliusDataSource({ executor }),
    (error: unknown) =>
      error instanceof SourceDataUnavailableError
      && error.message === "helius_runtime_credential_unavailable",
  );
  assert.equal(executor.metrics.providerRequestCount, 0);
  assert.equal(executor.metrics.providerBudgetExhausted, false);
});
