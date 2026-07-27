import assert from "node:assert/strict";
import test from "node:test";
import {
  ALPHA_SCORE_RULE_VERSION,
  buildFeatureVector,
  ewmWeight,
  scorePopulation,
  scoreWallet,
  type WalletAlphaInput,
} from "../src/domain/rules/alpha-score.js";
import type { AlphaPosition } from "../src/domain/types.js";

const asOf = new Date("2026-07-01T00:00:00.000Z");
const market = {
  regime: "neutral" as const,
  asOfDay: "2026-07-01",
  marketMedianRoi: 0,
  universeSize: 40,
};

function pos(
  tokenId: string,
  roi: number,
  daysAgo: number,
  source: AlphaPosition["pnlSource"] = "first_hand_swap",
  extra: Partial<AlphaPosition> = {},
): AlphaPosition {
  return {
    tokenId,
    roi,
    baselineRoi: 0,
    closedAt: new Date(asOf.getTime() - daysAgo * 86_400_000),
    pnlSource: source,
    ...extra,
  };
}

function strongWallet(address: string, n = 8): WalletAlphaInput {
  const positions = Array.from({ length: n }, (_, i) =>
    pos(`tok-${address}-${i}`, 0.8 + i * 0.05, 10 + i * 3));
  return { address, positions, asOf, firstHandCoverage: 1 };
}

function weakWallet(address: string): WalletAlphaInput {
  const positions = Array.from({ length: 6 }, (_, i) =>
    pos(`tok-w-${address}-${i}`, -0.2, 12 + i * 2));
  return { address, positions, asOf, firstHandCoverage: 1 };
}

test("ewm half-life 14d: weight halves every 14 days", () => {
  assert.ok(Math.abs(ewmWeight(0, 14) - 1) < 1e-9);
  assert.ok(Math.abs(ewmWeight(14, 14) - 0.5) < 1e-9);
  assert.ok(Math.abs(ewmWeight(28, 14) - 0.25) < 1e-9);
});

test("insufficient evidence never becomes tier N", () => {
  const thin: WalletAlphaInput = {
    address: "thin",
    asOf,
    positions: [pos("t1", 5, 1), pos("t2", 3, 2)],
    firstHandCoverage: 1,
  };
  const features = buildFeatureVector(thin);
  const result = scoreWallet(features, [features], market);
  assert.equal(result.status, "insufficient");
  assert.equal(result.tier, null);
  assert.equal(result.alphaScore, null);
  assert.ok(result.warnings.includes("alpha_status_insufficient_not_N"));
  assert.ok(result.whyNotHigher.includes("insufficient_evidence"));
});

test("borrowed-only PnL is provisional with confidence cap", () => {
  // Meet minimum evidence (5 tokens, 3+ closes, ≥7d span) while PnL stays borrowed.
  const positions = Array.from({ length: 6 }, (_, i) =>
    pos(`b-${i}`, 1.2, 5 + i * 4, "borrowed_unverified"));
  const wallet: WalletAlphaInput = {
    address: "borrowed",
    positions,
    asOf,
    firstHandCoverage: 0,
  };
  const pop = [wallet, strongWallet("s1"), strongWallet("s2"), weakWallet("w1")];
  const results = scorePopulation(pop, market);
  const mine = results.find((r) => r.address === "borrowed")!;
  assert.equal(mine.status, "provisional");
  assert.ok((mine.confidence ?? 1) <= 0.6);
  assert.ok(mine.warnings.includes("alpha_pnl_borrowed_unverified"));
});

test("population scoring is deterministic and ranks strong above weak", () => {
  const pop = [
    strongWallet("alpha"),
    weakWallet("beta"),
    strongWallet("gamma", 7),
    weakWallet("delta"),
  ];
  const a = scorePopulation(pop, market);
  const b = scorePopulation(pop, market);
  assert.deepEqual(
    a.map((r) => [r.address, r.alphaScore, r.tier, r.status]),
    b.map((r) => [r.address, r.alphaScore, r.tier, r.status]),
  );
  const alpha = a.find((r) => r.address === "alpha")!;
  const beta = a.find((r) => r.address === "beta")!;
  assert.equal(alpha.status, "scored");
  assert.equal(beta.status, "scored");
  assert.ok((alpha.alphaScore ?? 0) > (beta.alphaScore ?? 0));
  assert.equal(alpha.provenance.alphaScoreRuleVersion, ALPHA_SCORE_RULE_VERSION);
});

test("anti-gaming: cluster and bot penalties reduce coreAlpha", () => {
  const base = strongWallet("solo");
  const clustered = { ...strongWallet("clu"), inCluster: true };
  const bot = { ...strongWallet("bot"), isBot: true };
  const luck: WalletAlphaInput = {
    address: "luck",
    asOf,
    firstHandCoverage: 1,
    positions: [
      pos("super", 20, 5, "first_hand_swap", { liquidityHaircut: 1 }),
      pos("a", 0.1, 10),
      pos("b", 0.1, 12),
      pos("c", 0.1, 14),
      pos("d", 0.1, 16),
      pos("e", 0.05, 18),
    ],
  };

  const pop = [base, clustered, bot, luck, weakWallet("w")];
  const results = scorePopulation(pop, market);
  const solo = results.find((r) => r.address === "solo")!;
  const clu = results.find((r) => r.address === "clu")!;
  const botR = results.find((r) => r.address === "bot")!;
  const luckR = results.find((r) => r.address === "luck")!;

  assert.ok(clu.penalties.some((p) => p.code === "pen_cluster"));
  assert.ok(botR.penalties.some((p) => p.code === "pen_bot"));
  assert.ok((clu.coreAlpha ?? 0) < (solo.coreAlpha ?? 0));
  assert.ok((botR.coreAlpha ?? 0) < (solo.coreAlpha ?? 0));
  // One super token should attract supertoken or still score but not free UR without persistence
  assert.ok(
    luckR.penalties.some((p) => p.code === "pen_supertoken")
      || (luckR.alphaScore ?? 100) < 95,
  );
});

test("liquidity haircut reduces counted excess on paper pumps", () => {
  const paper: WalletAlphaInput = {
    address: "paper",
    asOf,
    firstHandCoverage: 1,
    positions: Array.from({ length: 6 }, (_, i) =>
      pos(`p-${i}`, 10, 8 + i * 3, "first_hand_swap", { liquidityHaircut: 0.05 })),
  };
  const real: WalletAlphaInput = {
    address: "real",
    asOf,
    firstHandCoverage: 1,
    positions: Array.from({ length: 6 }, (_, i) =>
      pos(`r-${i}`, 10, 8 + i * 3, "first_hand_swap", { liquidityHaircut: 1 })),
  };
  const pf = buildFeatureVector(paper);
  const rf = buildFeatureVector(real);
  assert.ok(pf.excessReturn < rf.excessReturn);
  const results = scorePopulation([paper, real, weakWallet("w"), strongWallet("s")], market);
  const p = results.find((r) => r.address === "paper")!;
  const r = results.find((r) => r.address === "real")!;
  assert.ok((p.coreAlpha ?? 0) <= (r.coreAlpha ?? 0));
});
