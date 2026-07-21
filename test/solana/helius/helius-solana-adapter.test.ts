import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  HeliusSolanaAdapter,
  type HeliusAddressTag,
  type HeliusTokenMetadata,
  type HeliusTransaction,
  type HeliusWalletFacts,
  type RpcMint,
  type RpcTokenAccount,
  type SolanaHeliusDataSource,
  type SourceResponse,
} from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";

interface Fixture {
  mint: string;
  rpcMint: RpcMint;
  metadata: HeliusTokenMetadata;
  tokenAccounts: RpcTokenAccount[];
  transactions: HeliusTransaction[];
  tags: HeliusAddressTag[];
  walletFacts: HeliusWalletFacts[];
}

const fixture = JSON.parse(
  await readFile(new URL("../../fixtures/solana/helius/adapter-fixture.json", import.meta.url), "utf8"),
) as Fixture;

function sourceResponse<T>(source: "helius" | "solana_rpc", data: T): SourceResponse<T> {
  return {
    data,
    watermark: {
      source,
      observedAt: new Date("2026-07-10T12:05:00.000Z"),
      finalizedSlot: 102n,
      cursor: "fixture-v1",
      completeness: "complete",
    },
  };
}

function fixtureSource(): SolanaHeliusDataSource {
  return {
    getMint: async () => sourceResponse("solana_rpc", fixture.rpcMint),
    getTokenAccounts: async () => sourceResponse("solana_rpc", fixture.tokenAccounts),
    getTokenMetadata: async () => sourceResponse("helius", fixture.metadata),
    getTransactions: async () => sourceResponse("helius", fixture.transactions),
    getAddressTags: async () => sourceResponse("helius", fixture.tags),
    getWalletFacts: async () => sourceResponse("helius", fixture.walletFacts),
  };
}

test("normalizes mint metadata and aggregates every token account by owner", async () => {
  const adapter = new HeliusSolanaAdapter(fixtureSource());
  const token = await adapter.getToken(fixture.mint);
  const holders = await adapter.getHolders(token);

  assert.deepEqual(token, {
    id: `solana:${fixture.mint}`,
    chain: "solana",
    ca: fixture.mint,
    name: "Fixture Token",
    symbol: "FIX",
    decimals: 6,
    totalSupplyRaw: 1_000_000n,
    launchpad: "unknown",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    creationTx: "create-signature",
  });
  assert.deepEqual(holders, [
    { address: "alice", ownerAddress: "alice", balanceRaw: 125n },
    { address: "bob", ownerAddress: "bob", balanceRaw: 75n },
  ]);
});

test("emits trades only from swap evidence and keeps ordinary token transfers separate", async () => {
  const adapter = new HeliusSolanaAdapter(fixtureSource());
  const token = await adapter.getToken(fixture.mint);
  const since = new Date("2026-07-10T11:00:00.000Z");
  const [trades, transfers, funding, walletFacts, tags] = await Promise.all([
    adapter.getRecentTrades(token, since),
    adapter.getTransfers(token, since),
    adapter.getFundingEdges(["buyer", "unrelated"], since),
    adapter.getWalletFacts(["buyer"], new Date("2026-07-10T12:05:00.000Z")),
    adapter.getAddressTags(token, ["curve"]),
  ]);

  assert.deepEqual(trades.map((trade) => [trade.trader, trade.side, trade.tokenAmountRaw, trade.quoteAmountRaw]), [
    ["buyer", "buy", 300n, 2_000_000n],
    ["seller", "sell", 120n, 800_000n],
  ]);
  assert.deepEqual(transfers.map((transfer) => [transfer.from, transfer.to, transfer.amountRaw]), [
    ["creator", "related", 50n],
  ]);
  assert.deepEqual(funding.map((edge) => [edge.funder, edge.recipient, edge.amountNativeRaw]), [
    ["funder", "buyer", 100_000_000n],
  ]);
  assert.equal(walletFacts.get("buyer")?.transactionCount, 2);
  assert.equal(tags[0]?.role, "bonding_curve");
  assert.deepEqual(
    adapter.getSourceWatermarks().map((watermark) => [watermark.source, watermark.cursor, watermark.completeness]),
    [
      ["solana_rpc", "fixture-v1", "complete"],
      ["helius", "fixture-v1", "complete"],
      ["helius", "fixture-v1", "complete"],
      ["helius", "fixture-v1", "complete"],
      ["helius", "fixture-v1", "complete"],
      ["helius", "fixture-v1", "complete"],
      ["helius", "fixture-v1", "complete"],
    ],
  );
});

test("does not turn ambiguous same-mint swap legs into a trade", async () => {
  const adapter = new HeliusSolanaAdapter({
    ...fixtureSource(),
    getTransactions: async () => sourceResponse("helius", [{
      signature: "ambiguous-route",
      slot: "103",
      blockTime: "2026-07-10T12:03:00.000Z",
      swap: {
        user: "router-user",
        tokenInputs: [{ mint: fixture.mint, amountRaw: "10" }],
        tokenOutputs: [{ mint: fixture.mint, amountRaw: "9" }],
      },
      tokenTransfers: [],
      nativeTransfers: [],
    }]),
  });
  const token = await adapter.getToken(fixture.mint);
  assert.deepEqual(await adapter.getRecentTrades(token, new Date("2026-07-10T12:00:00.000Z")), []);
});
