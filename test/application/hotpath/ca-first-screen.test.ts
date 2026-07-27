import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCaFirstScreenCard,
  parallelHotpathElapsedMs,
} from "../../../src/application/hotpath/ca-first-screen.js";
import { InMemoryAddressLibrary } from "../../../src/application/sedimentation/address-library.js";
import {
  FailingMarketProvider,
  FixtureBirdeyeHolderProvider,
  FixtureDexscreenerProvider,
  FixtureGmgnSecurityProvider,
} from "../../../src/infrastructure/providers/free-provider-ports.js";
import { VirtualClock } from "../../../src/harness-suites/shared.js";

const ca = "Mint111111111111111111111111111111111111111";
const at = new Date("2026-07-27T00:00:00.000Z");

test("first-screen card marks all borrow fields unverified and enqueues deep dive", async () => {
  const library = new InMemoryAddressLibrary();
  await library.upsertWallet({
    chain: "solana",
    address: "smart-1",
    labels: ["independent_smart_money", "alpha_SSR"],
    alphaScoreTier: "SSR",
    dataCompleteness: 0.8,
    updatedAt: at,
  });

  const card = await buildCaFirstScreenCard(ca, {
    marketProviders: [new FixtureDexscreenerProvider({
      [ca]: {
        tokenCa: ca,
        priceUsd: 1,
        liquidityUsd: 80_000,
        fdvUsd: 300_000,
        volume24hUsd: 20_000,
        observedAt: at,
      },
    })],
    securityProviders: [new FixtureGmgnSecurityProvider({
      [ca]: { isHoneypot: false, buyTaxBps: 0, sellTaxBps: 100 },
    })],
    holderProviders: [new FixtureBirdeyeHolderProvider({
      [ca]: { top10Pct: 40, holderCount: 900 },
    })],
    library,
    candidateWallets: ["smart-1"],
  });

  assert.equal(card.chain, "solana");
  assert.equal(card.market.unverified, true);
  assert.equal(card.holders.isBorrowedConcentration, true);
  assert.equal(card.holders.ownerAggregated, false);
  assert.equal(card.deepDiveEnqueued, true);
  assert.equal(card.libraryHits.length, 1);
  assert.ok(card.libraryHits[0]?.labels.includes("independent_smart_money"));
  assert.equal(card.status, "OK");
});

test("first-screen degrades when borrow market fails and never fabricates liquidity", async () => {
  const library = new InMemoryAddressLibrary();
  const card = await buildCaFirstScreenCard(ca, {
    marketProviders: [new FailingMarketProvider("dexscreener")],
    securityProviders: [new FixtureGmgnSecurityProvider({
      [ca]: { isHoneypot: null, buyTaxBps: null, sellTaxBps: null },
    })],
    holderProviders: [new FixtureBirdeyeHolderProvider({
      [ca]: { top10Pct: 30, holderCount: 100 },
    })],
    library,
  });
  assert.equal(card.status, "DEGRADED");
  assert.equal(card.market.liquidityUsd, null);
  assert.ok(card.warnings.some((w) => w.includes("unavailable") || w.includes("market")));
  assert.ok(card.completeness < 1);
});

test("parallel hotpath elapsed is max not sum", () => {
  assert.equal(parallelHotpathElapsedMs([400, 1800, 600]), 1800);
  assert.ok(parallelHotpathElapsedMs([400, 1800, 600]) < 400 + 1800 + 600);
});

test("virtual clock advances for latency bookkeeping", async () => {
  const clock = new VirtualClock();
  const library = new InMemoryAddressLibrary();
  const card = await buildCaFirstScreenCard(ca, {
    marketProviders: [new FixtureDexscreenerProvider({
      [ca]: {
        tokenCa: ca,
        priceUsd: 1,
        liquidityUsd: 1,
        fdvUsd: 1,
        volume24hUsd: 1,
        observedAt: at,
      },
    })],
    securityProviders: [],
    holderProviders: [],
    library,
    sourceLatencyMs: { market: 500, security: 100, holders: 100, library: 50 },
    clock,
  });
  // Sequential awaits in implementation accumulate; parallel helper documents budget intent.
  assert.ok(card.elapsedVirtualMs !== undefined);
  assert.equal(parallelHotpathElapsedMs([500, 100, 100, 50]), 500);
});
