import assert from "node:assert/strict";
import test from "node:test";
import { detectFundingClusters, SERVICE_FUNDER_RULE_VERSION } from "../src/domain/rules/funding-clusters.js";

test("detects newly funded sibling wallets that buy in the same short window", () => {
  const base = new Date("2026-01-01T00:00:00Z");
  const result = detectFundingClusters(
    ["a", "b"].map((recipient, index) => ({
      chain: "solana" as const,
      funder: "source",
      recipient,
      amountNativeRaw: 1n,
      fundedAt: new Date(base.getTime() + index * 1_000),
      recipientFirstSeenAt: base,
    })),
    ["a", "b"].map((buyer, index) => ({
      buyer,
      boughtAt: new Date(base.getTime() + 30_000 + index * 1_000),
      amountRaw: 10n,
      txHash: `tx-${index}`,
    })),
  );
  assert.equal(result.members.length, 2);
  assert.equal(result.members[0]?.clusterId, result.members[1]?.clusterId);
  assert.ok((result.members[0]?.confidence ?? 0) >= 0.85);
  assert.equal(result.suppressedFunders.length, 0);
});

test("suppresses exchange service funders with retained evidence and forms no cluster", () => {
  const base = new Date("2026-01-01T00:00:00Z");
  const result = detectFundingClusters(
    ["a", "b"].map((recipient, index) => ({
      chain: "solana" as const,
      funder: "binance-hot",
      recipient,
      amountNativeRaw: 1n,
      fundedAt: new Date(base.getTime() + index * 1_000),
      recipientFirstSeenAt: base,
    })),
    ["a", "b"].map((buyer, index) => ({
      buyer,
      boughtAt: new Date(base.getTime() + 30_000 + index * 1_000),
      amountRaw: 10n,
      txHash: `tx-${index}`,
    })),
    {
      funderTags: [{
        chain: "solana",
        address: "binance-hot",
        role: "exchange",
        source: "system",
        confidence: 0.95,
      }],
    },
  );
  assert.equal(result.members.length, 0);
  assert.equal(result.suppressedFunders.length, 1);
  assert.equal(result.suppressedFunders[0]?.funder, "binance-hot");
  assert.equal(result.suppressedFunders[0]?.role, "exchange");
  assert.equal(result.suppressedFunders[0]?.suppressedEdgeCount, 2);
  assert.equal(result.suppressedFunders[0]?.ruleVersion, SERVICE_FUNDER_RULE_VERSION);
  assert.ok((result.suppressedFunders[0]?.confidence ?? 0) >= 0.8);
});

test("does not suppress low-confidence exchange tags", () => {
  const base = new Date("2026-01-01T00:00:00Z");
  const result = detectFundingClusters(
    ["a", "b"].map((recipient, index) => ({
      chain: "solana" as const,
      funder: "maybe-cex",
      recipient,
      amountNativeRaw: 1n,
      fundedAt: new Date(base.getTime() + index * 1_000),
      recipientFirstSeenAt: base,
    })),
    ["a", "b"].map((buyer, index) => ({
      buyer,
      boughtAt: new Date(base.getTime() + 30_000 + index * 1_000),
      amountRaw: 10n,
      txHash: `tx-${index}`,
    })),
    {
      funderTags: [{
        chain: "solana",
        address: "maybe-cex",
        role: "exchange",
        source: "heuristic",
        confidence: 0.5,
      }],
    },
  );
  assert.equal(result.members.length, 2);
  assert.equal(result.suppressedFunders.length, 0);
});
