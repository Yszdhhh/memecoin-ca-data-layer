import assert from "node:assert/strict";
import test from "node:test";
import { classifyWallet } from "../src/domain/rules/wallet-quality.js";
import { calculateRealHolderConcentration } from "../src/domain/rules/real-holders.js";

test("classifies suspected bots without claiming holder exclusion authority", () => {
  const at = new Date("2026-07-01T00:00:00.000Z");
  const quality = classifyWallet({
    address: "bot",
    firstSeenAt: new Date("2026-06-01T00:00:00.000Z"),
    transactionCount: 100,
    swapsLast24h: 200,
    medianSwapIntervalSeconds: 2,
    failedTxRatio: 0.4,
    tags: [],
  }, at);
  assert.equal(quality.primary, "suspected_bot");
  assert.ok(quality.labels.includes("suspected_bot"));
});

test("holder concentration ignores wallet-quality labels (bot/blacklist never exclude)", () => {
  const concentration = calculateRealHolderConcentration({
    holders: [
      { address: "bot-wallet", ownerAddress: "bot-wallet", balanceRaw: 500n },
      { address: "human", ownerAddress: "human", balanceRaw: 500n },
    ],
    totalSupplyRaw: 1_000n,
    addressTags: [{
      chain: "solana",
      address: "bot-wallet",
      role: "blacklist",
      source: "manual",
      confidence: 0.99,
    }],
    clusterMembers: [],
  });
  // blacklist is a wallet-quality label role, not an infrastructure exclusion role
  assert.equal(concentration.eligibleHolderCount, 2);
  assert.equal(concentration.rows.every((row) => !row.excluded), true);
});
