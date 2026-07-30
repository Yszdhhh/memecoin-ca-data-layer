import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBorrowedCandidateScores,
  evaluateWalletDataQuality,
  GmgnPeriodStatsInput,
} from "../../../src/domain/rules/wallet-data-quality.js";

const period = (overrides: Partial<GmgnPeriodStatsInput> = {}): GmgnPeriodStatsInput => ({
  status: "MAPPED",
  completeness: 1,
  realizedProfit: 100,
  realizedProfitPnl: 0.1,
  winRate: 65,
  buyCount: 10,
  sellCount: 10,
  boughtCost: 100,
  soldIncome: 200,
  tokenNum: 5,
  lastActiveTimestamp: 1_700_000_000,
  warningCodes: [],
  ...overrides,
});

test("65 percent win rate contributes 65 points, not an accidental capped 100", () => {
  const s7d = period();
  const s30d = period();
  const scores = calculateBorrowedCandidateScores(s7d, s30d, evaluateWalletDataQuality(s7d, s30d), 50);
  assert.equal(scores.borrowedProfitabilityLeadScore, 54.5);
  assert.ok(scores.borrowedProfitabilityLeadScore! < 65);
});

test("missing 30d profit is unavailable and never falls back to 7d", () => {
  const s7d = period({ realizedProfit: 5000, winRate: 90 });
  const s30d = period({ status: "PARTIAL", realizedProfit: null, winRate: null });
  const scores = calculateBorrowedCandidateScores(s7d, s30d, evaluateWalletDataQuality(s7d, s30d), 99);
  assert.equal(scores.borrowedProfitabilityLeadScore, null);
  assert.equal(scores.borrowedCompositeLeadScore, null);
  assert.equal(scores.borrowedLeadTier, "UNQUALIFIED");
});

test("partial and period-unverified data are capped below DQ-A", () => {
  const partial = evaluateWalletDataQuality(period({ status: "PARTIAL" }), period());
  assert.notEqual(partial.dataQualityTier, "DQ-A");

  const unverified = evaluateWalletDataQuality(period(), period({ warningCodes: ["gmgn_wallet_stats_period_unverified"] }));
  assert.ok(["DQ-C", "DQ-D", "DQ-U"].includes(unverified.dataQualityTier));
});

test("extreme frequency is not rewarded above healthy activity", () => {
  const s7d = period();
  const healthy30d = period({ buyCount: 50, sellCount: 50, tokenNum: 10 });
  const botLike30d = period({ buyCount: 1500, sellCount: 1500, tokenNum: 10 });
  const healthy = calculateBorrowedCandidateScores(s7d, healthy30d, evaluateWalletDataQuality(s7d, healthy30d), 50);
  const botLike = calculateBorrowedCandidateScores(s7d, botLike30d, evaluateWalletDataQuality(s7d, botLike30d), 50);
  assert.ok(botLike.borrowedActivityLeadScore! < healthy.borrowedActivityLeadScore!);
});
