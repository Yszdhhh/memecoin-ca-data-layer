import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryAddressLibrary } from "../../../src/application/sedimentation/address-library.js";
import {
  FixtureBorrowedLeaderboardProvider,
  confirmBorrowedLeads,
  normalizeBorrowedLeaderboard,
  promoteConfirmedLeaderboardWallet,
  recomputeFirstHandProfit,
  type FirstHandSwap,
} from "../../../src/application/leaderboard/token-profit-leaderboard.js";

const tokenCa = "Mint111111111111111111111111111111111111111";
const at = new Date("2026-07-27T00:00:00.000Z");

function swap(
  walletAddress: string,
  side: "buy" | "sell",
  tokenAmountRaw: bigint,
  quoteAmountMicroUsd: bigint,
  minute: number,
  signature: string,
): FirstHandSwap {
  return {
    tokenCa,
    walletAddress,
    side,
    tokenAmountRaw,
    quoteAmountMicroUsd,
    signature,
    eventIndex: 0,
    blockTime: new Date(at.getTime() + minute * 60_000),
  };
}

test("borrowed leaderboard is always unverified and deterministic", async () => {
  const provider = new FixtureBorrowedLeaderboardProvider("gmgn", {
    [tokenCa]: [
      { walletAddress: "w2", realizedPnlUsd: 10, roiPct: 5, rank: 2 },
      { walletAddress: "w1", realizedPnlUsd: 20, roiPct: 10, rank: 1 },
    ],
  }, at);
  const rows = await provider.getTokenLeaderboard(tokenCa);
  assert.deepEqual(rows.map((row) => row.walletAddress), ["w1", "w2"]);
  assert.ok(rows.every((row) => row.origin === "borrowed" && row.verificationStatus === "unverified"));
});

test("FIFO first-hand recompute uses only matched inventory", () => {
  const rows = [
    swap("w1", "buy", 100n, 100_000_000n, 0, "a"),
    swap("w1", "buy", 100n, 300_000_000n, 1, "b"),
    swap("w1", "sell", 150n, 450_000_000n, 2, "c"),
  ];
  const result = recomputeFirstHandProfit(tokenCa, "w1", rows, "fifo");
  assert.equal(result.costBasisSoldMicroUsd, 250_000_000n);
  assert.equal(result.realizedPnlMicroUsd, 200_000_000n);
  assert.equal(result.currentBalanceRaw, 50n);
  assert.equal(result.verificationStatus, "verified");
  assert.equal(result.completeness, 1);
});

test("weighted-average recompute is distinct from FIFO and deterministic", () => {
  const rows = [
    swap("w1", "buy", 100n, 100_000_000n, 0, "a"),
    swap("w1", "buy", 100n, 300_000_000n, 1, "b"),
    swap("w1", "sell", 100n, 300_000_000n, 2, "c"),
  ];
  const fifo = recomputeFirstHandProfit(tokenCa, "w1", rows, "fifo");
  const weighted = recomputeFirstHandProfit(tokenCa, "w1", rows, "weighted_average");
  assert.equal(fifo.realizedPnlMicroUsd, 200_000_000n);
  assert.equal(weighted.realizedPnlMicroUsd, 100_000_000n);
  assert.equal(weighted.currentBalanceRaw, 100n);
  assert.equal(weighted.evidence.inputsHash, recomputeFirstHandProfit(tokenCa, "w1", [...rows].reverse(), "weighted_average").evidence.inputsHash);
});

test("sell beyond observed inventory degrades completeness and cannot promote", async () => {
  const rows = [
    swap("w1", "buy", 10n, 10_000_000n, 0, "a"),
    swap("w1", "sell", 20n, 40_000_000n, 1, "b"),
  ];
  const record = recomputeFirstHandProfit(tokenCa, "w1", rows);
  assert.equal(record.completeness, 0.75);
  assert.ok(record.warnings.some((warning) => warning.startsWith("sell_exceeds_inventory")));
  const library = new InMemoryAddressLibrary();
  const promotion = await promoteConfirmedLeaderboardWallet(library, {
    tokenId: "token-1",
    tokenCa,
    record,
    labels: ["independent_smart_money"],
    confidence: 0.9,
    promotedAt: at,
  });
  assert.equal(promotion.promoted, false);
  assert.equal(await library.getWallet("solana", "w1"), null);
});

test("only first-hand confirmed profit promotes a wallet into the library", async () => {
  const leads = normalizeBorrowedLeaderboard(tokenCa, "gmgn", [{
    walletAddress: "w1",
    realizedPnlUsd: 999,
    roiPct: 900,
    rank: 1,
  }], at);
  const records = confirmBorrowedLeads(tokenCa, leads, [
    swap("w1", "buy", 100n, 100_000_000n, 0, "a"),
    swap("w1", "sell", 100n, 250_000_000n, 1, "b"),
  ]);
  const library = new InMemoryAddressLibrary();
  const promotion = await promoteConfirmedLeaderboardWallet(library, {
    tokenId: "token-1",
    tokenCa,
    record: records[0]!,
    labels: ["independent_smart_money", "alpha_SSR"],
    confidence: 0.92,
    promotedAt: at,
    minimumRealizedPnlMicroUsd: 100_000_000n,
    evidence: { fixture: true },
  });
  assert.equal(promotion.promoted, true);
  const wallet = await library.getWallet("solana", "w1");
  assert.equal(wallet?.verificationStatus, "verified");
  assert.ok(wallet?.labels.includes("independent_smart_money"));
  assert.deepEqual((await library.listWalletsForToken("solana", "token-1")).map((row) => row.address), ["w1"]);
});
