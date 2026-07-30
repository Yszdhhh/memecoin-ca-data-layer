import assert from "node:assert/strict";
import test from "node:test";
import { createBudgetedSourceFactory } from "../../../src/application/provider-executor/budgeted-pilot-source.js";
import type { PilotTokenAccountSource } from "../../../src/application/live/solana-ca-real-data-cleaning-pilot.js";

function fakeSource(counter: { n: number }): PilotTokenAccountSource {
  return {
    getRequestCount: () => counter.n,
    async getMint() {
      counter.n += 1;
      return {
        data: { supplyRaw: "1", decimals: 0 },
        watermark: { source: "helius", observedAt: new Date(), completeness: "complete", finalizedSlot: 1n },
      };
    },
    async getTokenMetadata() {
      counter.n += 1;
      return {
        data: { name: "X", symbol: "X" },
        watermark: { source: "helius", observedAt: new Date(), completeness: "complete", finalizedSlot: 1n },
      };
    },
    async enumerateTokenAccounts() {
      counter.n += 1;
      return {
        accounts: [],
        pageCount: 1,
        paginationComplete: true,
        pageSlots: ["1"],
        skippedMalformedCount: 0,
        watermark: { source: "helius", observedAt: new Date(), completeness: "complete", finalizedSlot: 1n },
      };
    },
  };
}

test("budgeted pilot source routes all calls through ProviderExecutor", async () => {
  const counter = { n: 0 };
  const { source, executor } = createBudgetedSourceFactory(() => fakeSource(counter), {
    taskId: "t-budget",
    budget: 10,
  });
  await source.getMint("Mint");
  await source.getTokenMetadata("Mint");
  await source.enumerateTokenAccounts("Mint");
  assert.equal(executor.requestsUsed, 3);
  assert.equal(source.getRequestCount?.(), 3);
  assert.equal(executor.budgetExhausted, false);
});

test("budgeted pilot source hard-stops when budget exhausted", async () => {
  const counter = { n: 0 };
  const { source, executor } = createBudgetedSourceFactory(() => fakeSource(counter), {
    taskId: "t-budget-2",
    budget: 1,
  });
  await source.getMint("Mint");
  await assert.rejects(() => source.getTokenMetadata("Mint"), /request_budget_exhausted|budget/);
  assert.equal(executor.budgetExhausted, true);
});
