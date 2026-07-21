import assert from "node:assert/strict";
import test from "node:test";
import { calculateDevBehavior } from "../src/domain/rules/dev-behavior.js";
import type { NormalizedTrade, TokenTransfer } from "../src/domain/types.js";

const trade = (trader: string, side: "buy" | "sell", amount: bigint, eventIndex: number): NormalizedTrade => ({
  chain: "solana",
  tokenId: "token",
  txHash: `tx-${eventIndex}`,
  eventIndex,
  blockNumber: 1n,
  blockTime: new Date("2026-01-01T00:00:00Z"),
  trader,
  side,
  tokenAmountRaw: amount,
  quoteAmountRaw: 1n,
});

test("separates direct sells, related sells and non-related outbound transfers", () => {
  const transfers: TokenTransfer[] = [
    { chain: "solana", tokenId: "token", txHash: "t1", eventIndex: 0, blockTime: new Date(), from: "dev", to: "related", amountRaw: 50n },
    { chain: "solana", tokenId: "token", txHash: "t2", eventIndex: 0, blockTime: new Date(), from: "dev", to: "unknown", amountRaw: 20n },
  ];
  const result = calculateDevBehavior({
    creatorAddress: "dev",
    totalSupplyRaw: 1_000n,
    directCurrentBalanceRaw: 100n,
    relatedCurrentBalances: new Map([["related", 50n]]),
    trades: [trade("dev", "buy", 300n, 0), trade("dev", "sell", 200n, 1), trade("related", "sell", 25n, 2)],
    transfers,
    relatedAddresses: ["related"],
  });

  assert.equal(result.currentHoldingPct, 10);
  assert.equal(result.relatedHoldingPct, 5);
  assert.equal(result.grossSoldPct, 20);
  assert.equal(result.netDisposedPct, 0);
  assert.equal(result.relatedGrossSoldPct, 2.5);
  assert.equal(result.outboundTransferPct, 2);
  assert.equal(result.soldOfAcquiredPct, 66.66);
});
