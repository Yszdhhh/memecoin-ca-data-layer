import assert from "node:assert/strict";
import test from "node:test";
import { calculateRealHolderConcentration } from "../src/domain/rules/real-holders.js";

test("aggregates Solana token accounts and excludes infrastructure plus high-confidence clusters", () => {
  const result = calculateRealHolderConcentration({
    totalSupplyRaw: 1_000n,
    holders: [
      { address: "ata-a-1", ownerAddress: "alice", balanceRaw: 100n },
      { address: "ata-a-2", ownerAddress: "alice", balanceRaw: 50n },
      { address: "curve", balanceRaw: 300n },
      { address: "cluster-1", balanceRaw: 120n },
      { address: "bob", balanceRaw: 80n },
    ],
    addressTags: [
      { chain: "solana", address: "curve", role: "bonding_curve", source: "system", confidence: 1 },
    ],
    clusterMembers: [
      { address: "cluster-1", clusterId: "c1", confidence: 0.92, evidence: {} },
    ],
  });

  assert.equal(result.eligibleHolderCount, 2);
  assert.equal(result.top10Pct, 23);
  assert.equal(result.top20Pct, 23);
  assert.equal(result.excludedPct, 42);
  assert.equal(result.rows.find((row) => row.address === "alice")?.balanceRaw, 150n);
});

test("does not exclude a low-confidence cluster", () => {
  const result = calculateRealHolderConcentration({
    totalSupplyRaw: 100n,
    holders: [{ address: "a", balanceRaw: 25n }],
    addressTags: [],
    clusterMembers: [{ address: "a", clusterId: "weak", confidence: 0.7, evidence: {} }],
  });
  assert.equal(result.top10Pct, 25);
  assert.equal(result.rows[0]?.excluded, false);
});
