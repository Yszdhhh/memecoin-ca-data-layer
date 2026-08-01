import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {
  resolveGmgnPeriodStatus,
  runCandidateScreeningV01,
  classifyLabelClaims,
  resolveRecommendedActions,
  assessScreeningCoverage,
  isEligibleCategoryA,
  isEligibleCategoryB,
  isEligibleCategoryC,
  isEligibleCategoryD,
  isEligibleCategoryE,
  isEligibleCategoryF,
  evaluateCategoryG,
  isEligibleCategoryH,
  CANDIDATE_SCREENING_TASK_ID,
  type CandidateCategory,
  type WalletMasterV01Record,
} from "../../../src/application/wallet-intelligence/candidate-screening-v0-1.js";
import {
  calculateBorrowedCandidateScores,
  evaluateWalletDataQuality,
  isWinRateUnitAmbiguous,
  disqualifiesCleanHighWinrateSample,
  isHighSeverityAnomalyCode,
  type GmgnPeriodStatsInput,
} from "../../../src/domain/rules/wallet-data-quality.js";
import { computeFingerprint, computeSha256 } from "../../../src/application/wallet-intelligence/master-table-builder.js";

const period = (overrides: Partial<GmgnPeriodStatsInput> = {}): GmgnPeriodStatsInput => ({
  status: "PARTIAL",
  completeness: 0.8,
  realizedProfit: 5000,
  realizedProfitPnl: 0.2,
  winRate: 55,
  buyCount: 40,
  sellCount: 30,
  boughtCost: 10000,
  soldIncome: 15000,
  tokenNum: 20,
  lastActiveTimestamp: 1_700_000_000,
  warningCodes: ["gmgn_wallet_stats_partial_fields", "gmgn_wallet_stats_period_unverified"],
  ...overrides,
});

function stubRecord(overrides: Partial<WalletMasterV01Record> = {}): WalletMasterV01Record {
  return {
    address: "Addr111111111111111111111111111111111111111",
    wallet_fingerprint: "fp",
    source_order: 1,
    existing_labels: [],
    existing_note: "",
    source_claims: [],
    existing_label: [],
    confirmed_label: null,
    confirmed_behavior_labels: null,
    gmgn_7d_status: "PARTIAL",
    gmgn_30d_status: "PARTIAL",
    gmgn_7d_completeness: 0.8,
    gmgn_30d_completeness: 0.8,
    data_confidence: "low",
    verification_status: "unverified",
    source_type: "borrowed",
    transport_requested_period: { "7d": "7d", "30d": "30d" },
    provider_attested_period: { "7d": null, "30d": null },
    confidence_cap: "low",
    profit_7d: 100,
    profit_30d: 1000,
    win_rate_7d: 50,
    win_rate_30d: 50,
    buy_count: 20,
    sell_count: 15,
    trade_count_proxy: 35,
    token_count: 10,
    last_active_at: "2026-07-29T00:00:00.000Z",
    average_profit_per_trade_proxy: 10,
    average_profit_per_token_proxy: 100,
    seven_day_vs_thirty_day_consistency: 1,
    anomaly_flags: [],
    activity_tier: "ACTIVE_7D",
    data_tier: "TIER_PARTIAL",
    data_quality_score: 70,
    data_quality_tier: "DQ-C",
    profit_percentile_30d: 80,
    winrate_percentile_30d: 70,
    trade_percentile_30d: 50,
    gmgn_lead_score: 60,
    gmgn_lead_tier: "MODERATE_LEAD",
    gmgn_lead_reason_codes: [],
    candidate_categories: [],
    candidate_reason_codes: [],
    human_review_status: "PENDING_HUMAN_REVIEW",
    alpha_score: null,
    final_wallet_score: null,
    final_wallet_grade: null,
    confirmed_behavior_labels_v2: null,
    ...overrides,
  };
}

test("period_unverified retains gmgn lead scores with confidence cap effect via DQ", () => {
  const s7d = period();
  const s30d = period({ realizedProfit: 12000 });
  const dq = evaluateWalletDataQuality(s7d, s30d);
  const scores = calculateBorrowedCandidateScores(s7d, s30d, dq, 90);
  assert.notEqual(scores.borrowedCompositeLeadScore, null);
  assert.notEqual(scores.borrowedLeadTier, "UNQUALIFIED");
  assert.ok(["DQ-C", "DQ-D", "DQ-U"].includes(dq.dataQualityTier));
});

test("resolveGmgnPeriodStatus derives PARTIAL when provider omits status but has metrics", () => {
  const resolved = resolveGmgnPeriodStatus({
    period: "30d",
    completeness: 0.82,
    aggregates: { realizedProfit: 100, buyCount: 1, sellCount: 1 },
    warningCodes: ["gmgn_wallet_stats_partial_fields", "gmgn_wallet_stats_period_unverified"],
  });
  assert.equal(resolved.status, "PARTIAL");
  assert.equal(resolved.derived, true);
  assert.ok(resolved.warningCodes.some((c) => c.includes("status_derived_partial")));
});

test("resolveGmgnPeriodStatus derives UNAVAILABLE for expected metrics missing", () => {
  const resolved = resolveGmgnPeriodStatus({
    period: "30d",
    completeness: 0,
    aggregates: {},
    warningCodes: ["gmgn_expected_metrics_unavailable"],
  });
  assert.equal(resolved.status, "UNAVAILABLE");
});

test("null metrics stay null and are not coerced to zero in score inputs", () => {
  const s7d = period({ realizedProfit: null, winRate: null, buyCount: null, sellCount: null });
  const s30d = period({ realizedProfit: null, status: "UNAVAILABLE", completeness: 0 });
  const dq = evaluateWalletDataQuality({ ...s7d, status: "UNAVAILABLE", completeness: 0 }, s30d);
  const scores = calculateBorrowedCandidateScores({ ...s7d, status: "UNAVAILABLE", completeness: 0 }, s30d, dq, 0);
  assert.equal(scores.borrowedCompositeLeadScore, null);
  assert.equal(scores.borrowedLeadTier, "UNQUALIFIED");
});

// ---- Win rate unit boundaries ----
test("win rate unit: 0.39 and 1 are ambiguous; 0, 35, 36 are not", () => {
  assert.equal(isWinRateUnitAmbiguous(0.39), true);
  assert.equal(isWinRateUnitAmbiguous(1), true);
  assert.equal(isWinRateUnitAmbiguous(0), false);
  assert.equal(isWinRateUnitAmbiguous(35), false);
  assert.equal(isWinRateUnitAmbiguous(36), false);
  assert.equal(isWinRateUnitAmbiguous(100), false);
  assert.equal(isWinRateUnitAmbiguous(null), false);
});

test("null vs real 0 are distinct for win rate and profit", () => {
  assert.equal(isWinRateUnitAmbiguous(null), false);
  assert.equal(isWinRateUnitAmbiguous(0), false);
  const s = period({ realizedProfit: 0, winRate: 0 });
  assert.equal(s.realizedProfit, 0);
  assert.equal(s.winRate, 0);
  const sNull = period({ realizedProfit: null, winRate: null });
  assert.equal(sNull.realizedProfit, null);
  assert.equal(sNull.winRate, null);
});

// ---- B anomaly disqualification (all EXTREME_* via prefix) ----
test("B disqualifiers: all EXTREME_* plus HIGH/window/unit; residuals not auto-excluded", () => {
  assert.equal(isHighSeverityAnomalyCode("ZERO_INCOME_HIGH_PROFIT_30D"), true);
  assert.equal(disqualifiesCleanHighWinrateSample("ZERO_INCOME_HIGH_PROFIT_30D"), true);
  assert.equal(disqualifiesCleanHighWinrateSample("EXTREME_PROFIT_OUTLIER"), true);
  assert.equal(disqualifiesCleanHighWinrateSample("EXTREME_TOKEN_NUM"), true);
  assert.equal(disqualifiesCleanHighWinrateSample("EXTREME_BUY_ONLY_RATIO"), true);
  assert.equal(disqualifiesCleanHighWinrateSample("EXTREME_SELL_ONLY_RATIO"), true);
  assert.equal(disqualifiesCleanHighWinrateSample("EXTREME_TRADE_FREQUENCY"), true);
  assert.equal(disqualifiesCleanHighWinrateSample("EXTREME_ANYTHING_FUTURE"), true);
  assert.equal(disqualifiesCleanHighWinrateSample("WINDOW_MONOTONICITY_VIOLATION"), true);
  assert.equal(disqualifiesCleanHighWinrateSample("WIN_RATE_UNIT_AMBIGUOUS"), true);
  assert.equal(disqualifiesCleanHighWinrateSample("ACCOUNTING_RESIDUAL_OBSERVED_30D"), false);
  assert.equal(disqualifiesCleanHighWinrateSample("PROVIDER_DATA_INCOMPLETE"), false);
});

// ---- A–H category eligibility (membership, not only actions) ----
test("A eligibility boundaries", () => {
  const base = stubRecord({
    activity_tier: "ACTIVE_7D",
    profit_30d: 10000,
    profit_percentile_30d: 80,
    trade_count_proxy: 10,
    token_count: 5,
  });
  assert.equal(isEligibleCategoryA(base), true);
  assert.equal(isEligibleCategoryA(stubRecord({ ...base, activity_tier: "INACTIVE" })), false);
  assert.equal(isEligibleCategoryA(stubRecord({ ...base, profit_percentile_30d: 74 })), false);
  assert.equal(isEligibleCategoryA(stubRecord({ ...base, profit_30d: 0 })), false);
  assert.equal(isEligibleCategoryA(stubRecord({ ...base, trade_count_proxy: 4 })), false);
  assert.equal(isEligibleCategoryA(stubRecord({ ...base, token_count: 1 })), false);
});

test("B eligibility boundaries including all EXTREME_*", () => {
  const clean = stubRecord({
    win_rate_30d: 70,
    trade_count_proxy: 15,
    profit_30d: 100,
    anomaly_flags: ["PROVIDER_DATA_INCOMPLETE", "ACCOUNTING_RESIDUAL_OBSERVED_30D"],
  });
  assert.equal(isEligibleCategoryB(clean, 40), true);
  assert.equal(isEligibleCategoryB(stubRecord({ ...clean, trade_count_proxy: 14 }), 40), false);
  assert.equal(isEligibleCategoryB(stubRecord({ ...clean, profit_30d: 0 }), 40), false);
  assert.equal(isEligibleCategoryB(stubRecord({ ...clean, profit_30d: -1 }), 40), false);
  assert.equal(
    isEligibleCategoryB(stubRecord({ ...clean, anomaly_flags: ["EXTREME_SELL_ONLY_RATIO"] }), 40),
    false
  );
  assert.equal(
    isEligibleCategoryB(stubRecord({ ...clean, anomaly_flags: ["EXTREME_TRADE_FREQUENCY"] }), 40),
    false
  );
  assert.equal(
    isEligibleCategoryB(stubRecord({ ...clean, anomaly_flags: ["WIN_RATE_UNIT_AMBIGUOUS"], win_rate_30d: 0.39 }), 40),
    false
  );
  assert.equal(isEligibleCategoryB(stubRecord({ ...clean, win_rate_30d: 0.39 }), 40), false);
});

test("C eligibility boundaries", () => {
  const base = stubRecord({
    win_rate_30d: 35,
    trade_count_proxy: 8,
    profit_30d: 5000,
    anomaly_flags: [],
  });
  assert.equal(isEligibleCategoryC(base, 1000), true);
  assert.equal(isEligibleCategoryC(stubRecord({ ...base, win_rate_30d: 36 }), 1000), false);
  assert.equal(isEligibleCategoryC(stubRecord({ ...base, trade_count_proxy: 7 }), 1000), false);
  assert.equal(isEligibleCategoryC(stubRecord({ ...base, win_rate_30d: 0.39 }), 1000), false);
  assert.equal(isEligibleCategoryC(stubRecord({ ...base, win_rate_30d: 1 }), 1000), false);
});

test("D eligibility boundaries (denominator and ratio)", () => {
  // weeklyAvg = profit_30d / 4.28; need profit_7d / weeklyAvg >= 2 and profit_30d > 50
  // profit_30d=51 → weekly≈11.915; need profit_7d >= 23.83
  const ok = stubRecord({ profit_30d: 51, profit_7d: 24, trade_count_proxy: 5 });
  assert.equal(isEligibleCategoryD(ok), true);
  assert.equal(isEligibleCategoryD(stubRecord({ profit_30d: 50, profit_7d: 100, trade_count_proxy: 5 })), false);
  assert.equal(isEligibleCategoryD(stubRecord({ profit_30d: 100, profit_7d: 10, trade_count_proxy: 5 })), false); // ratio < 2
  assert.equal(isEligibleCategoryD(stubRecord({ profit_30d: 100, profit_7d: 50, trade_count_proxy: 4 })), false);
});

test("E eligibility: decay required; stable active high profit alone is not enough", () => {
  const decay = stubRecord({
    profit_30d: 10000,
    profit_7d: 0,
    activity_tier: "ACTIVE_7D",
  });
  assert.equal(isEligibleCategoryE(decay, 1000), true);
  const inactiveStrong = stubRecord({
    profit_30d: 10000,
    profit_7d: 500,
    activity_tier: "INACTIVE",
  });
  assert.equal(isEligibleCategoryE(inactiveStrong, 1000), true);
  const stableActive = stubRecord({
    profit_30d: 10000,
    profit_7d: 3000, // > 30d/10, still active 7d
    activity_tier: "ACTIVE_7D",
  });
  assert.equal(isEligibleCategoryE(stableActive, 1000), false);
});

test("F eligibility: EXTREME flags enter; residual alone also enters by current rule; partial-only does not", () => {
  assert.equal(isEligibleCategoryF(stubRecord({ anomaly_flags: ["EXTREME_TRADE_FREQUENCY"] }), 2000), true);
  assert.equal(isEligibleCategoryF(stubRecord({ anomaly_flags: ["EXTREME_SELL_ONLY_RATIO"] }), 2000), true);
  // Current rule includes ACCOUNTING_RESIDUAL in F pool
  assert.equal(isEligibleCategoryF(stubRecord({ anomaly_flags: ["ACCOUNTING_RESIDUAL_OBSERVED_30D"] }), 2000), true);
  // Ordinary provider incomplete alone does not match F flags/thresholds
  assert.equal(
    isEligibleCategoryF(
      stubRecord({
        anomaly_flags: ["PROVIDER_DATA_INCOMPLETE"],
        trade_count_proxy: 10,
        buy_count: 5,
        sell_count: 5,
        token_count: 3,
      }),
      2000
    ),
    false
  );
});

test("G eligibility: smart-money conflict vs KOL/rank non-conflict and conflict reasons", () => {
  const smartConflict = stubRecord({
    existing_labels: ["聪明钱"],
    existing_note: "",
    activity_tier: "INACTIVE",
    profit_30d: 0,
    trade_count_proxy: 0,
  });
  const g1 = evaluateCategoryG(smartConflict);
  assert.equal(g1.eligible, true);
  assert.ok(g1.reasonCodes.includes("CLAIM_SMART_MONEY_UNVERIFIED"));

  const kolNoConflict = stubRecord({
    existing_labels: ["KOL样例", "Top052"],
    existing_note: "",
    activity_tier: "ACTIVE_7D",
    profit_30d: 5000,
    trade_count_proxy: 40,
    data_tier: "TIER_PARTIAL",
  });
  assert.equal(evaluateCategoryG(kolNoConflict).eligible, false);

  const rankConflict = stubRecord({
    existing_labels: ["Rank073"],
    existing_note: "",
    activity_tier: "INACTIVE",
    profit_30d: 0,
    trade_count_proxy: 0,
  });
  const gRank = evaluateCategoryG(rankConflict);
  assert.equal(gRank.eligible, true);
  assert.ok(gRank.reasonCodes.includes("CLAIM_RANKING_UNVERIFIED"));
  assert.ok(!gRank.reasonCodes.includes("CLAIM_SMART_MONEY_UNVERIFIED"));

  const noLabels = stubRecord({ existing_labels: [], existing_note: "" });
  assert.equal(evaluateCategoryG(noLabels).eligible, false);
});

test("H eligibility: sparse+intel enters; complete data does not; sparse without intel does not", () => {
  assert.equal(
    isEligibleCategoryH(
      stubRecord({
        data_tier: "TIER_SPARSE",
        gmgn_30d_status: "UNAVAILABLE",
        existing_labels: ["a", "b", "c"],
      })
    ),
    true
  );
  assert.equal(
    isEligibleCategoryH(
      stubRecord({
        data_tier: "TIER_SPARSE",
        gmgn_30d_status: "UNAVAILABLE",
        existing_labels: ["聪明钱"],
      })
    ),
    true
  );
  assert.equal(
    isEligibleCategoryH(
      stubRecord({
        data_tier: "TIER_PARTIAL",
        gmgn_30d_status: "PARTIAL",
        existing_labels: ["a", "b", "c", "d", "e"],
      })
    ),
    false
  );
  assert.equal(
    isEligibleCategoryH(
      stubRecord({
        data_tier: "TIER_SPARSE",
        gmgn_30d_status: "UNAVAILABLE",
        existing_labels: ["tag1"],
      })
    ),
    false
  );
});

// ---- Label claim classification ----
test("G smart-money positive examples", () => {
  assert.equal(classifyLabelClaims(["聪明钱候选"], "").explicit_smart_money_claim, true);
  assert.equal(classifyLabelClaims(["smart money lead"], "").explicit_smart_money_claim, true);
  assert.equal(classifyLabelClaims(["顶级高手"], "").explicit_smart_money_claim, true);
  assert.equal(classifyLabelClaims(["高手高胜率"], "").explicit_smart_money_claim, true);
});

test("G top/rank/KOL must not auto-trigger smart-money claim", () => {
  assert.equal(classifyLabelClaims(["Top052"], "").explicit_smart_money_claim, false);
  assert.equal(classifyLabelClaims(["Rank073"], "").explicit_smart_money_claim, false);
  assert.equal(classifyLabelClaims(["KOL样例"], "").explicit_smart_money_claim, false);
  assert.equal(classifyLabelClaims(["alpha_hive"], "").explicit_smart_money_claim, false);
  assert.equal(classifyLabelClaims(["Top052"], "").ranking_claim, true);
  assert.equal(classifyLabelClaims(["Rank073"], "").ranking_claim, true);
  assert.equal(classifyLabelClaims(["KOL样例"], "").kol_claim, true);
});

// ---- Action matrix ----
test("action matrix: F + HIGH extreme → EXCLUDE", () => {
  const d = resolveRecommendedActions(["F_HIGH_FREQ_OR_ANOMALY_SUSPICIOUS"], stubRecord({ anomaly_flags: ["EXTREME_TRADE_FREQUENCY"] }));
  assert.equal(d.primary_recommended_action, "EXCLUDE_FROM_FOLLOWING");
});

test("action matrix: H → INSUFFICIENT_DATA", () => {
  const d = resolveRecommendedActions(["H_INSUFFICIENT_DATA_HIGH_INTEL"], stubRecord());
  assert.equal(d.primary_recommended_action, "INSUFFICIENT_DATA");
});

test("action matrix: G alone → GMGN_HISTORY_REVIEW", () => {
  const d = resolveRecommendedActions(["G_LABEL_STAT_CONFLICT"], stubRecord());
  assert.equal(d.primary_recommended_action, "GMGN_HISTORY_REVIEW");
});

test("action matrix: A/B active → CHAIN_VERIFICATION", () => {
  const d = resolveRecommendedActions(["A_ACTIVE_HIGH_PROFIT_LEAD", "B_HIGH_WINRATE_ADEQUATE_SAMPLE"], stubRecord({ activity_tier: "ACTIVE_7D" }));
  assert.equal(d.primary_recommended_action, "CHAIN_VERIFICATION");
});

test("action matrix: C active → CHAIN_VERIFICATION", () => {
  const d = resolveRecommendedActions(["C_LOW_WINRATE_HIGH_PROFIT_LEAD"], stubRecord({ activity_tier: "ACTIVE_7D" }));
  assert.equal(d.primary_recommended_action, "CHAIN_VERIFICATION");
});

test("action matrix: E alone → DORMANT_MONITOR", () => {
  const d = resolveRecommendedActions(["E_HISTORICAL_STRONG_RECENT_DECAY"], stubRecord({ activity_tier: "INACTIVE" }));
  assert.equal(d.primary_recommended_action, "DORMANT_MONITOR");
});

test("action matrix: C+E active keeps chain verification (E does not bury C)", () => {
  const d = resolveRecommendedActions(
    ["C_LOW_WINRATE_HIGH_PROFIT_LEAD", "E_HISTORICAL_STRONG_RECENT_DECAY"],
    stubRecord({ activity_tier: "ACTIVE_7D" })
  );
  assert.equal(d.primary_recommended_action, "CHAIN_VERIFICATION");
  assert.ok(d.action_reason_codes.includes("C_PLUS_E_STILL_ACTIVE"));
});

test("action matrix: C+E inactive → DORMANT_MONITOR", () => {
  const d = resolveRecommendedActions(
    ["C_LOW_WINRATE_HIGH_PROFIT_LEAD", "E_HISTORICAL_STRONG_RECENT_DECAY"],
    stubRecord({ activity_tier: "INACTIVE" })
  );
  assert.equal(d.primary_recommended_action, "DORMANT_MONITOR");
  assert.ok(d.action_reason_codes.includes("C_PLUS_E_INACTIVE"));
});

// ---- Coverage / DEGRADED ----
test("candidate count below min returns DEGRADED", () => {
  const r = assessScreeningCoverage({
    uniqueCandidateCount: 12,
    categoriesRepresented: 8,
    targetCandidateMin: 30,
    targetCandidateMax: 50,
  });
  assert.equal(r.status, "DEGRADED");
  assert.ok(r.degradation?.degradation_reason_codes.includes("CANDIDATE_COUNT_BELOW_MIN"));
  assert.equal(r.degradation?.expected_candidate_min, 30);
  assert.equal(r.degradation?.actual_candidate_count, 12);
});

test("category coverage below 6 returns DEGRADED", () => {
  const r = assessScreeningCoverage({
    uniqueCandidateCount: 35,
    categoriesRepresented: 4,
    targetCandidateMin: 30,
    targetCandidateMax: 50,
  });
  assert.equal(r.status, "DEGRADED");
  assert.ok(r.degradation?.degradation_reason_codes.includes("CATEGORY_COVERAGE_BELOW_MIN"));
  assert.equal(r.degradation?.expected_category_min, 6);
  assert.equal(r.degradation?.actual_category_count, 4);
});

test("in-band coverage returns SUCCESS", () => {
  const r = assessScreeningCoverage({
    uniqueCandidateCount: 32,
    categoriesRepresented: 8,
    targetCandidateMin: 30,
    targetCandidateMax: 50,
  });
  assert.equal(r.status, "SUCCESS");
  assert.equal(r.degradation, undefined);
});

/** Build a 1433-address synthetic fixture for offline pipeline smoke. */
function buildSyntheticFixture(opts?: {
  forceFewCandidates?: boolean;
  labelsOverride?: (i: number, address: string) => string[];
}): {
  inputDir: string;
  gmgnDir: string;
  outputDir: string;
  cleanup: () => void;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wallet-screen-v01-"));
  const inputDir = path.join(root, "sol");
  const gmgnDir = path.join(root, "gmgn");
  const outputDir = path.join(root, "out");
  fs.mkdirSync(inputDir, { recursive: true });
  fs.mkdirSync(gmgnDir, { recursive: true });

  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const encodeBase58 = (bytes: Uint8Array): string => {
    let zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
    let n = 0n;
    for (const b of bytes) n = (n << 8n) + BigInt(b);
    let s = "";
    while (n > 0n) {
      const rem = Number(n % 58n);
      n = n / 58n;
      s = alphabet[rem] + s;
    }
    return "1".repeat(zeros) + (s || "1");
  };
  const addresses: string[] = [];
  for (let i = 0; i < 1433; i++) {
    const bytes = crypto.createHash("sha256").update(`wallet-screen-seed-${i}`).digest();
    addresses.push(encodeBase58(bytes));
  }

  fs.writeFileSync(path.join(inputDir, "sol_addresses.txt"), addresses.join("\n") + "\n", "utf8");
  const labels = addresses.map((address, i) => {
    const base =
      opts?.labelsOverride?.(i, address) ??
      (i % 50 === 0 ? ["聪明钱候选", "观察"] : i % 17 === 0 ? ["疑似机器"] : i % 23 === 0 ? ["Top052"] : [`tag${i % 9}`]);
    return {
      address,
      labels: base,
      label_primary: base[0] ?? `tag${i % 9}`,
      labels_joined: base.join(" | "),
      label_count: base.length,
    };
  });
  fs.writeFileSync(path.join(inputDir, "sol_address_labels.json"), JSON.stringify(labels), "utf8");

  const profiles: any[] = [];
  const fetchedAt = "2026-07-29T20:22:55.568Z";
  for (let i = 0; i < addresses.length; i++) {
    const fp = computeFingerprint(addresses[i]!);
    const active = i % 3 === 0;
    const highProfit = i % 11 === 0;
    const highWin = i % 13 === 0;
    const lowWinHighProfit = i % 19 === 0;
    const extreme = i % 29 === 0;
    const missing = i % 31 === 0;
    const ambiguousWin = i === 7; // inject one ambiguous 0.39

    for (const periodKey of ["7d", "30d"] as const) {
      if (missing || opts?.forceFewCandidates) {
        profiles.push({
          period: periodKey,
          source: "gmgn",
          verificationStatus: "unverified",
          completeness: 0,
          aggregates: {},
          warningCodes: ["gmgn_expected_metrics_unavailable"],
          requestBudgetUsed: 1,
          sourceInputFingerprint: fp,
          fetchedAt,
        });
        continue;
      }
      const mult = periodKey === "7d" ? 0.3 : 1;
      const profit = highProfit ? 50000 * mult : lowWinHighProfit ? 20000 * mult : active ? 500 * mult : 0;
      const win = ambiguousWin ? 0.39 : highWin ? 70 : lowWinHighProfit ? 20 : active ? 40 : 0;
      const buys = extreme ? 3000 : active ? 40 : 0;
      const sells = extreme ? 0 : active ? 30 : 0;
      profiles.push({
        period: periodKey,
        source: "gmgn",
        verificationStatus: "unverified",
        completeness: 0.82,
        aggregates: {
          periodPnl: null,
          realizedProfit: profit,
          realizedProfitPnl: 0.1,
          winRate: win,
          tradeCount: null,
          buyCount: buys,
          sellCount: sells,
          boughtCost: 1000,
          soldIncome: extreme ? 0 : 1000 + profit,
          lastActiveTimestamp: active ? 1_785_000_000 : null,
          tokenNum: extreme ? 2001 : active ? 25 : 0,
        },
        warningCodes: ["gmgn_wallet_stats_partial_fields", "gmgn_wallet_stats_period_unverified"],
        requestBudgetUsed: 1,
        sourceInputFingerprint: fp,
        fetchedAt,
      });
    }
  }
  fs.writeFileSync(path.join(gmgnDir, "normalized_wallet_profiles.json"), JSON.stringify(profiles), "utf8");
  fs.writeFileSync(
    path.join(gmgnDir, "summary.json"),
    JSON.stringify({
      completeness: 0.74,
      warningCodes: ["gmgn_wallet_stats_period_unverified"],
      verificationStatus: "unverified",
      source: "gmgn",
    }),
    "utf8"
  );

  return {
    inputDir,
    gmgnDir,
    outputDir,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

test("synthetic 1433 pipeline produces master, candidates, research packs; alpha null", async () => {
  const fx = buildSyntheticFixture();
  try {
    const addrHash = computeSha256(fs.readFileSync(path.join(fx.inputDir, "sol_addresses.txt")));
    const labelHash = computeSha256(fs.readFileSync(path.join(fx.inputDir, "sol_address_labels.json")));
    const result = await runCandidateScreeningV01({
      inputDir: fx.inputDir,
      gmgnOutputDir: fx.gmgnDir,
      outputDir: fx.outputDir,
      expectedHashes: {
        solAddressesTxtHash: addrHash,
        solAddressLabelsJsonHash: labelHash,
      },
      targetCandidateMin: 30,
      targetCandidateMax: 50,
      researchPackCount: 15,
    });

    assert.ok(result.status === "SUCCESS" || result.status === "DEGRADED");
    assert.equal(result.metrics.totalAddresses, 1433);
    assert.ok(result.metrics.uniqueCandidateCount > 0);
    assert.equal(result.metrics.researchPackCount, 15);

    const masterLines = fs.readFileSync(path.join(fx.outputDir, "wallet_master_v0_1.jsonl"), "utf8").trim().split("\n");
    assert.equal(masterLines.length, 1433);
    const sample = JSON.parse(masterLines[0]!);
    assert.equal(sample.alpha_score, null);
    assert.equal(sample.final_wallet_score, null);
    assert.equal(sample.final_wallet_grade, null);
    assert.equal(sample.confirmed_label, null);
    assert.equal(sample.confirmed_behavior_labels, null);
    assert.equal(sample.source_type, "borrowed");
    assert.equal(sample.verification_status, "unverified");

    const union = JSON.parse(fs.readFileSync(path.join(fx.outputDir, "candidate_union_v0_1.json"), "utf8"));
    assert.ok(union.candidates.length > 0);
    for (const c of union.candidates) {
      assert.ok(typeof c.research_priority_rank === "number");
      assert.equal(c.recommended_next_action, c.primary_recommended_action);
      assert.ok(Array.isArray(c.secondary_recommended_actions));
      assert.ok(Array.isArray(c.action_reason_codes));
      // B must never carry the deleted false reason
      if ((c.candidate_categories as string[]).includes("B_HIGH_WINRATE_ADEQUATE_SAMPLE")) {
        assert.ok(!(c.candidate_reason_codes as string[]).includes("NOT_SINGLE_FIELD_ANOMALY_ONLY"));
        assert.ok((c.candidate_reason_codes as string[]).includes("NO_HIGH_SEVERITY_ANOMALY"));
        assert.ok(!(c.anomaly_flags as string[]).some((f: string) => disqualifiesCleanHighWinrateSample(f)));
      }
    }

    // Ambiguous win-rate row flagged, not scaled
    const ambiguous = masterLines.map((l) => JSON.parse(l)).find((r) => r.win_rate_30d === 0.39);
    if (ambiguous) {
      assert.ok(ambiguous.anomaly_flags.includes("WIN_RATE_UNIT_AMBIGUOUS"));
      assert.equal(ambiguous.win_rate_30d, 0.39);
      assert.ok(!(ambiguous.candidate_categories as CandidateCategory[]).includes("B_HIGH_WINRATE_ADEQUATE_SAMPLE"));
      assert.ok(!(ambiguous.candidate_categories as CandidateCategory[]).includes("C_LOW_WINRATE_HIGH_PROFIT_LEAD"));
    }

    // Top/rank labels must not produce CLAIM_SMART_MONEY_UNVERIFIED alone
    for (const c of union.candidates) {
      const reasons = c.candidate_reason_codes as string[];
      if (reasons.includes("CLAIM_SMART_MONEY_UNVERIFIED")) {
        const text = [...(c.existing_labels as string[]), c.existing_note as string].join(" ");
        assert.ok(/聪明钱|smart\s*money|顶级高手|真高手|超级高手|盈利能力|高手/.test(text));
      }
    }

    assert.equal(CANDIDATE_SCREENING_TASK_ID, "SOL-WALLET-CANDIDATE-SCREENING-V0-1-001");
  } finally {
    fx.cleanup();
  }
});

test("synthetic all-missing metrics yields DEGRADED not silent SUCCESS", async () => {
  const fx = buildSyntheticFixture({ forceFewCandidates: true });
  try {
    const addrHash = computeSha256(fs.readFileSync(path.join(fx.inputDir, "sol_addresses.txt")));
    const labelHash = computeSha256(fs.readFileSync(path.join(fx.inputDir, "sol_address_labels.json")));
    const result = await runCandidateScreeningV01({
      inputDir: fx.inputDir,
      gmgnOutputDir: fx.gmgnDir,
      outputDir: fx.outputDir,
      expectedHashes: {
        solAddressesTxtHash: addrHash,
        solAddressLabelsJsonHash: labelHash,
      },
      targetCandidateMin: 30,
      targetCandidateMax: 50,
      researchPackCount: 5,
    });
    assert.equal(result.status, "DEGRADED");
    assert.ok(result.degradation);
    assert.ok(result.degradation!.degradation_reason_codes.length >= 1);
    assert.equal(result.metrics.totalAddresses, 1433);
    // Artifacts still written
    assert.ok(fs.existsSync(path.join(fx.outputDir, "wallet_master_v0_1.jsonl")));
    assert.ok(fs.existsSync(path.join(fx.outputDir, "screening_degradation_v0_1.json")));
  } finally {
    fx.cleanup();
  }
});
