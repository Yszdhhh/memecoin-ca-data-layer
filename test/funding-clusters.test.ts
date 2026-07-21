import assert from "node:assert/strict";
import test from "node:test";
import { detectFundingClusters } from "../src/domain/rules/funding-clusters.js";

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
  assert.equal(result.length, 2);
  assert.equal(result[0]?.clusterId, result[1]?.clusterId);
  assert.ok((result[0]?.confidence ?? 0) >= 0.85);
});
