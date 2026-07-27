import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { HeliusSolanaAdapter, SourceDataUnavailableError } from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";
import {
  DegradingHeliusDataSource,
  FixtureHeliusDataSource,
} from "../../../src/infrastructure/solana/helius/fixture-helius-data-source.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("fixture helius source replays mint, holders, swaps and funding without network", async () => {
  const raw = await readFile(path.join(root, "test/fixtures/solana/helius/adapter-fixture.json"), "utf8");
  const source = FixtureHeliusDataSource.fromJson(JSON.parse(raw));
  const adapter = new HeliusSolanaAdapter(source);
  const mint = "Mint111111111111111111111111111111111111111";

  assert.equal(await adapter.probeToken(mint), true);
  const token = await adapter.getToken(mint);
  assert.equal(token.decimals, 6);
  const holders = await adapter.getHolders(token);
  assert.ok(holders.length >= 2);
  const trades = await adapter.getRecentTrades(token, new Date("2026-07-01T00:00:00.000Z"));
  assert.ok(trades.some((t) => t.side === "buy"));
  const transfers = await adapter.getTransfers(token, new Date("2026-07-01T00:00:00.000Z"));
  assert.ok(transfers.length >= 1);
  const funding = await adapter.getFundingEdges(["buyer"], new Date("2026-07-01T00:00:00.000Z"));
  assert.ok(funding.some((e) => e.funder === "funder" && e.recipient === "buyer"));
  assert.ok(adapter.getSourceWatermarks().length > 0);
});

test("degrading helius source fails closed without inventing mint data", async () => {
  const raw = await readFile(path.join(root, "test/fixtures/solana/helius/adapter-fixture.json"), "utf8");
  const inner = FixtureHeliusDataSource.fromJson(JSON.parse(raw));
  const degraded = new DegradingHeliusDataSource(inner, new Set(["getMint"]), "timeout");
  const adapter = new HeliusSolanaAdapter(degraded);
  await assert.rejects(
    () => adapter.getToken("Mint111111111111111111111111111111111111111"),
    (error: unknown) => error instanceof SourceDataUnavailableError || error instanceof Error,
  );
});
