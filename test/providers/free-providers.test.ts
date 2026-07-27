import assert from "node:assert/strict";
import test from "node:test";
import {
  collectBorrowedMarket,
  FailingMarketProvider,
  FixtureBirdeyeHolderProvider,
  FixtureBirdeyeMarketProvider,
  FixtureDexscreenerProvider,
  FixtureGmgnSecurityProvider,
} from "../../src/infrastructure/providers/free-provider-ports.js";

const ca = "Mint111111111111111111111111111111111111111";
const at = new Date("2026-07-27T00:00:00.000Z");

test("borrowed market is always unverified and never elevates origin", async () => {
  const dex = new FixtureDexscreenerProvider({
    [ca]: {
      tokenCa: ca,
      priceUsd: 1.2,
      liquidityUsd: 50_000,
      fdvUsd: 200_000,
      volume24hUsd: 10_000,
      pairAddress: "pair-1",
      observedAt: at,
    },
  });
  const { quote, warnings } = await collectBorrowedMarket([dex], ca);
  assert.ok(quote);
  assert.equal(quote!.origin, "borrowed");
  assert.equal(quote!.verificationStatus, "unverified");
  assert.equal(quote!.liquidityUsd, 50_000);
  assert.deepEqual(warnings, []);
});

test("market fan-out degrades when providers fail", async () => {
  const { quote, warnings } = await collectBorrowedMarket(
    [new FailingMarketProvider("birdeye"), new FailingMarketProvider("dexscreener")],
    ca,
  );
  assert.equal(quote, null);
  assert.ok(warnings.includes("borrowed_market_unavailable"));
});

test("holder borrow path marks concentration as borrowed and not owner-aggregated", async () => {
  const holders = new FixtureBirdeyeHolderProvider({
    [ca]: { top10Pct: 55, holderCount: 1200 },
  });
  const hint = await holders.getHolderHint(ca);
  assert.ok(hint);
  assert.equal(hint!.isBorrowedConcentration, true);
  assert.equal(hint!.ownerAggregated, false);
  assert.equal(hint!.verificationStatus, "unverified");
});

test("security and market fixtures compose", async () => {
  const security = await new FixtureGmgnSecurityProvider({
    [ca]: { isHoneypot: false, buyTaxBps: 0, sellTaxBps: 0 },
  }).getSecurityHint(ca);
  const market = await new FixtureBirdeyeMarketProvider({
    [ca]: { priceUsd: 0.5, liquidityUsd: 9_000, fdvUsd: 40_000, volume24hUsd: 1_000, observedAt: at },
  }).getMarketQuote(ca);
  assert.equal(security?.isHoneypot, false);
  assert.equal(market?.origin, "borrowed");
});
