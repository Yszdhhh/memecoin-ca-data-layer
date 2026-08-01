export const WALLET_DATA_QUALITY_RULE_VERSION = "wallet-data-quality-v3";

export type DataQualityTier = "DQ-A" | "DQ-B" | "DQ-C" | "DQ-D" | "DQ-U";

export interface AnomalyDetail {
  code: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
  evidenceFields: string[];
  ruleVersion: typeof WALLET_DATA_QUALITY_RULE_VERSION;
}

export interface WalletDataQualityAssessment {
  fieldCoverage7d: number;
  fieldCoverage30d: number;
  pairCoverage: number;
  dataQualityScore: number;
  dataQualityTier: DataQualityTier;
  internalConsistencyScore: number;
  anomalyFlags: AnomalyDetail[];
  exclusionCandidateFlags: string[];
  manualReviewRequired: boolean;
  manualReviewReasons: string[];
}

export interface GmgnPeriodStatsInput {
  status: "MAPPED" | "PARTIAL" | "UNAVAILABLE" | "ABSENT";
  completeness: number | null;
  realizedProfit: number | null;
  realizedProfitPnl: number | null;
  winRate: number | null;
  buyCount: number | null;
  sellCount: number | null;
  boughtCost: number | null;
  soldIncome: number | null;
  tokenNum: number | null;
  lastActiveTimestamp: number | null;
  warningCodes: string[];
}

export interface BorrowedCandidateScores {
  borrowedProfitabilityLeadScore: number | null;
  borrowedActivityLeadScore: number | null;
  borrowedConsistencyLeadScore: number | null;
  borrowedDataQualityScore: number;
  borrowedCompositeLeadScore: number | null;
  borrowedLeadTier: "TOP_LEAD" | "STRONG_LEAD" | "MODERATE_LEAD" | "LOW_LEAD" | "UNQUALIFIED";
}

const isPresent = (period: GmgnPeriodStatsInput): boolean =>
  period.status === "MAPPED" || period.status === "PARTIAL";

const hasUnverifiedPeriod = (period: GmgnPeriodStatsInput): boolean =>
  period.warningCodes.some((code) => code.includes("period_unverified"));

const hasPartialFields = (period: GmgnPeriodStatsInput): boolean =>
  period.warningCodes.some((code) => code.includes("partial_fields"));

const tierForScore = (score: number): DataQualityTier => {
  if (score >= 80) return "DQ-A";
  if (score >= 65) return "DQ-B";
  if (score >= 50) return "DQ-C";
  if (score > 0) return "DQ-D";
  return "DQ-U";
};

const capTier = (tier: DataQualityTier, cap: DataQualityTier): DataQualityTier => {
  const order: DataQualityTier[] = ["DQ-A", "DQ-B", "DQ-C", "DQ-D", "DQ-U"];
  return order[Math.max(order.indexOf(tier), order.indexOf(cap))]!;
};

const addResidualObservation = (
  anomalies: AnomalyDetail[],
  period: "7D" | "30D",
  stats: GmgnPeriodStatsInput
): void => {
  if (stats.realizedProfit === null || stats.soldIncome === null || stats.boughtCost === null) return;
  const residual = stats.realizedProfit - (stats.soldIncome - stats.boughtCost);
  if (Math.abs(residual) <= 1e-4) return;

  anomalies.push({
    code: `ACCOUNTING_RESIDUAL_OBSERVED_${period}`,
    severity: "LOW",
    reason: `${period.toLowerCase()} provider profit differs from soldIncome - boughtCost by ${residual.toFixed(2)}; provider accounting semantics are not assumed equivalent`,
    evidenceFields: [
      `gmgn${period === "7D" ? "7d" : "30d"}RealizedProfit`,
      `gmgn${period === "7D" ? "7d" : "30d"}SoldIncome`,
      `gmgn${period === "7D" ? "7d" : "30d"}BoughtCost`,
    ],
    ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
  });
};

/** Computes versioned data quality without treating provider accounting residuals as proven errors. */
export function evaluateWalletDataQuality(
  s7d: GmgnPeriodStatsInput,
  s30d: GmgnPeriodStatsInput,
  evalTimeMs: number = Date.now()
): WalletDataQualityAssessment {
  const has7d = isPresent(s7d);
  const has30d = isPresent(s30d);
  const pairCoverage = has7d && has30d ? 1 : has7d || has30d ? 0.5 : 0;
  const anomalies: AnomalyDetail[] = [];
  const manualReviewReasons: string[] = [];
  const exclusionCandidateFlags: string[] = [];
  let consistencyScore = 100;

  const validatedCompleteness = (stats: GmgnPeriodStatsInput, period: "7D" | "30D"): number => {
    if (!isPresent(stats)) return 0;
    const value = stats.completeness;
    if (value === null || !Number.isFinite(value) || value < 0 || value > 1) {
      anomalies.push({
        code: `INVALID_COMPLETENESS_${period}`,
        severity: "HIGH",
        reason: `${period.toLowerCase()} completeness must be a finite number in [0,1] for a present provider row`,
        evidenceFields: [`gmgn${period === "7D" ? "7d" : "30d"}Completeness`],
        ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
      });
      manualReviewReasons.push(`${period.toLowerCase()} completeness is missing or invalid`);
      return 0;
    }
    if (stats.status === "MAPPED" && value < 1) {
      anomalies.push({
        code: `MAPPED_COMPLETENESS_INCONSISTENT_${period}`,
        severity: "MEDIUM",
        reason: `${period.toLowerCase()} status is MAPPED but completeness is below 1`,
        evidenceFields: [`gmgn${period === "7D" ? "7d" : "30d"}Status`, `gmgn${period === "7D" ? "7d" : "30d"}Completeness`],
        ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
      });
      manualReviewReasons.push(`${period.toLowerCase()} MAPPED status conflicts with incomplete coverage`);
    }
    return value;
  };

  const c7 = validatedCompleteness(s7d, "7D");
  const c30 = validatedCompleteness(s30d, "30D");

  addResidualObservation(anomalies, "7D", s7d);
  addResidualObservation(anomalies, "30D", s30d);

  if (s30d.soldIncome === 0 && s30d.realizedProfit !== null && s30d.realizedProfit > 500) {
    anomalies.push({
      code: "ZERO_INCOME_HIGH_PROFIT_30D",
      severity: "HIGH",
      reason: `30d soldIncome is 0 but realizedProfit is ${s30d.realizedProfit}`,
      evidenceFields: ["gmgn30dSoldIncome", "gmgn30dRealizedProfit"],
      ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    });
    manualReviewReasons.push("30d zero sold income with high realized profit");
  }

  if (has7d && has30d) {
    let violations = 0;
    if (s7d.buyCount !== null && s30d.buyCount !== null && s7d.buyCount > s30d.buyCount) violations++;
    if (s7d.sellCount !== null && s30d.sellCount !== null && s7d.sellCount > s30d.sellCount) violations++;
    if (s7d.tokenNum !== null && s30d.tokenNum !== null && s7d.tokenNum > s30d.tokenNum) violations++;
    if (s7d.boughtCost !== null && s30d.boughtCost !== null && s7d.boughtCost > s30d.boughtCost * 1.05 + 10) violations++;
    if (s7d.soldIncome !== null && s30d.soldIncome !== null && s7d.soldIncome > s30d.soldIncome * 1.05 + 10) violations++;
    if (violations > 0) {
      consistencyScore -= violations * 15;
      anomalies.push({
        code: "WINDOW_MONOTONICITY_VIOLATION",
        severity: "MEDIUM",
        reason: `7d metrics exceed 30d metrics across ${violations} field(s)`,
        evidenceFields: ["gmgn7dBuyCount", "gmgn30dBuyCount", "gmgn7dSellCount", "gmgn30dSellCount"],
        ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
      });
    }
  }

  const profit30d = s30d.realizedProfit;
  if (profit30d !== null && (profit30d > 300000 || profit30d < -100000)) {
    anomalies.push({
      code: "EXTREME_PROFIT_OUTLIER",
      severity: "MEDIUM",
      reason: `30d realized profit ${profit30d} is an extreme outlier`,
      evidenceFields: ["gmgn30dRealizedProfit"],
      ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    });
    manualReviewReasons.push("extreme 30d profit or loss");
  }

  const tokenCount30d = s30d.tokenNum;
  if (tokenCount30d !== null && tokenCount30d > 1000) {
    anomalies.push({
      code: "EXTREME_TOKEN_NUM",
      severity: "MEDIUM",
      reason: `30d token count ${tokenCount30d} exceeds 1,000`,
      evidenceFields: ["gmgn30dTokenNum"],
      ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    });
    manualReviewReasons.push("extreme 30d token count");
  }

  const buys30d = s30d.buyCount ?? 0;
  const sells30d = s30d.sellCount ?? 0;
  if (buys30d > 50 && sells30d === 0) {
    anomalies.push({ code: "EXTREME_BUY_ONLY_RATIO", severity: "MEDIUM", reason: `30d buyCount is ${buys30d} but sellCount is 0`, evidenceFields: ["gmgn30dBuyCount", "gmgn30dSellCount"], ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION });
  } else if (sells30d > 50 && buys30d === 0) {
    anomalies.push({ code: "EXTREME_SELL_ONLY_RATIO", severity: "MEDIUM", reason: `30d sellCount is ${sells30d} but buyCount is 0`, evidenceFields: ["gmgn30dBuyCount", "gmgn30dSellCount"], ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION });
  }

  const trades30d = buys30d + sells30d;
  if (trades30d > 2000) {
    anomalies.push({ code: "EXTREME_TRADE_FREQUENCY", severity: "MEDIUM", reason: `30d total trades ${trades30d} exceed 2,000`, evidenceFields: ["gmgn30dBuyCount", "gmgn30dSellCount"], ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION });
    manualReviewReasons.push("extreme 30d trade frequency");
  }

  const activity7d = (s7d.buyCount ?? 0) + (s7d.sellCount ?? 0);
  if (profit30d !== null && profit30d > 5000 && activity7d === 0) {
    const ageDays = s30d.lastActiveTimestamp === null
      ? null
      : (evalTimeMs - s30d.lastActiveTimestamp * 1000) / 86_400_000;
    if (ageDays === null || ageDays > 14) {
      anomalies.push({
        code: "LONG_TERM_PROFIT_RECENTLY_INACTIVE",
        severity: "LOW",
        reason: `30d profit is ${profit30d} but 7d activity is zero`,
        evidenceFields: ["gmgn30dRealizedProfit", "activityCount7d", "gmgn30dLastActiveTimestamp"],
        ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
      });
    }
  }

  const allWarnings = [...s7d.warningCodes, ...s30d.warningCodes];
  if (allWarnings.includes("gmgn_wallet_stats_win_rate_unit_ambiguous")) {
    anomalies.push({ code: "WIN_RATE_UNIT_AMBIGUOUS", severity: "LOW", reason: "Win rate unit is ambiguous in provider payload", evidenceFields: ["gmgn7dWinRate", "gmgn30dWinRate"], ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION });
  }

  if (s7d.warningCodes.includes("invalid_gmgn_period_status")) {
    anomalies.push({
      code: "INVALID_GMGN_STATUS_7D",
      severity: "HIGH",
      reason: "7d GMGN period status is missing, mistyped, or not in {MAPPED, PARTIAL, UNAVAILABLE}; fail-closed to UNAVAILABLE",
      evidenceFields: ["gmgn7dStatus", "gmgn7dWarningCodes"],
      ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    });
    manualReviewReasons.push("invalid 7d GMGN period status");
  }
  if (s30d.warningCodes.includes("invalid_gmgn_period_status")) {
    anomalies.push({
      code: "INVALID_GMGN_STATUS_30D",
      severity: "HIGH",
      reason: "30d GMGN period status is missing, mistyped, or not in {MAPPED, PARTIAL, UNAVAILABLE}; fail-closed to UNAVAILABLE",
      evidenceFields: ["gmgn30dStatus", "gmgn30dWarningCodes"],
      ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    });
    manualReviewReasons.push("invalid 30d GMGN period status");
  }

  const partialOrUnverified = s7d.status === "PARTIAL" || s30d.status === "PARTIAL" || hasUnverifiedPeriod(s7d) || hasUnverifiedPeriod(s30d);
  if (partialOrUnverified || hasPartialFields(s7d) || hasPartialFields(s30d)) {
    anomalies.push({ code: "PROVIDER_DATA_INCOMPLETE", severity: "LOW", reason: "Provider returned partial fields or an unverified period", evidenceFields: ["gmgn7dCompleteness", "gmgn30dCompleteness"], ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION });
  }

  if (!has7d && !has30d) {
    anomalies.push({ code: "EXPECTED_METRICS_UNAVAILABLE", severity: "HIGH", reason: "GMGN metrics unavailable for both 7d and 30d", evidenceFields: ["gmgn7dStatus", "gmgn30dStatus"], ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION });
    manualReviewReasons.push("GMGN 7d and 30d metrics unavailable");
  }

  const finalConsistencyScore = Math.max(0, Math.round(consistencyScore));
  const averageCoverage = (c7 + c30) / 2;
  const highCount = anomalies.filter((a) => a.severity === "HIGH").length;
  const mediumCount = anomalies.filter((a) => a.severity === "MEDIUM").length;
  const anomalyPenalty = Math.min(100, highCount * 30 + mediumCount * 12);
  let rawScore = averageCoverage * 30 + pairCoverage * 25 + (finalConsistencyScore / 100) * 30 + (1 - anomalyPenalty / 100) * 15;
  if (!has7d && !has30d) rawScore = 0;
  const dataQualityScore = Math.max(0, Math.min(100, Math.round(rawScore * 100) / 100));

  let dataQualityTier = tierForScore(dataQualityScore);
  const hasIncompletePresentRow = (has7d && c7 < 1) || (has30d && c30 < 1);
  const hasMissingOrInvalidCompleteness =
    (has7d && (s7d.completeness === null || !Number.isFinite(s7d.completeness) || s7d.completeness < 0 || s7d.completeness > 1)) ||
    (has30d && (s30d.completeness === null || !Number.isFinite(s30d.completeness) || s30d.completeness < 0 || s30d.completeness > 1));
  if (s7d.status === "PARTIAL" || s30d.status === "PARTIAL" || hasIncompletePresentRow || hasPartialFields(s7d) || hasPartialFields(s30d)) {
    dataQualityTier = capTier(dataQualityTier, "DQ-B");
  }
  if (hasMissingOrInvalidCompleteness || hasUnverifiedPeriod(s7d) || hasUnverifiedPeriod(s30d)) {
    dataQualityTier = capTier(dataQualityTier, "DQ-C");
  }

  if (dataQualityTier === "DQ-D" || dataQualityTier === "DQ-U") exclusionCandidateFlags.push("LOW_DATA_QUALITY_EXCLUSION");
  if (highCount >= 2) exclusionCandidateFlags.push("SEVERE_DATA_ANOMALY_EXCLUSION");

  return {
    fieldCoverage7d: c7,
    fieldCoverage30d: c30,
    pairCoverage,
    dataQualityScore,
    dataQualityTier,
    internalConsistencyScore: finalConsistencyScore,
    anomalyFlags: anomalies,
    exclusionCandidateFlags,
    manualReviewRequired: manualReviewReasons.length > 0 || highCount > 0,
    manualReviewReasons,
  };
}

/**
 * Computes a 30d-only borrowed lead score. Missing 30d profit never falls back to 7d.
 *
 * `period_unverified` lowers confidence via data-quality caps / reason codes; it must NOT
 * null all lead scores or force UNQUALIFIED. Formal Alpha Score remains separate and null.
 */
export function calculateBorrowedCandidateScores(
  s7d: GmgnPeriodStatsInput,
  s30d: GmgnPeriodStatsInput,
  dq: WalletDataQualityAssessment,
  profitPercentile30d: number
): BorrowedCandidateScores {
  const p30 = s30d.realizedProfit;
  const p7 = s7d.realizedProfit;
  if (p30 === null || !isPresent(s30d)) {
    return { borrowedProfitabilityLeadScore: null, borrowedActivityLeadScore: null, borrowedConsistencyLeadScore: null, borrowedDataQualityScore: dq.dataQualityScore, borrowedCompositeLeadScore: null, borrowedLeadTier: "UNQUALIFIED" };
  }

  let profitability = profitPercentile30d;
  if (s30d.winRate !== null) {
    const winRatePercent = Math.max(0, Math.min(100, s30d.winRate));
    const sampleSize = (s30d.buyCount ?? 0) + (s30d.sellCount ?? 0);
    const confidence = Math.min(1, sampleSize / 20);
    profitability = profitability * (1 - 0.3 * confidence) + winRatePercent * (0.3 * confidence);
  }
  // Explicit small-sample penalty (sample < 10 trades).
  const sampleSize30 = (s30d.buyCount ?? 0) + (s30d.sellCount ?? 0);
  if (sampleSize30 < 10) {
    profitability = profitability * Math.max(0.35, sampleSize30 / 10);
  }
  const borrowedProfitabilityLeadScore = Math.round(profitability * 100) / 100;

  const trades30d = (s30d.buyCount ?? 0) + (s30d.sellCount ?? 0);
  const tokens30d = s30d.tokenNum ?? 0;
  const healthyTradeScore = trades30d <= 300 ? Math.min(70, (trades30d / 100) * 70) : Math.max(0, 70 - ((trades30d - 300) / 1700) * 70);
  const breadthScore = Math.min(30, (tokens30d / 30) * 30);
  const borrowedActivityLeadScore = Math.round(Math.max(0, Math.min(100, healthyTradeScore + breadthScore)) * 100) / 100;

  let consistency = 50;
  if (p7 !== null && p30 > 0) {
    const ratio = p7 / (p30 / 4.28 + 1e-4);
    consistency = ratio >= 0.5 && ratio <= 2.5 ? 90 : ratio > 0 ? 70 : 30;
  }
  if (dq.internalConsistencyScore < 60) consistency *= 0.6;
  const borrowedConsistencyLeadScore = Math.round(consistency * 100) / 100;

  const rawComposite = borrowedProfitabilityLeadScore * 0.5 + borrowedActivityLeadScore * 0.2 + borrowedConsistencyLeadScore * 0.3;
  // Quality gate already caps period_unverified / partial rows; do not zero scores.
  const qualityFactor = Math.max(0.25, dq.dataQualityScore / 100);
  const borrowedCompositeLeadScore = Math.round(rawComposite * qualityFactor * 100) / 100;
  const borrowedLeadTier: BorrowedCandidateScores["borrowedLeadTier"] = borrowedCompositeLeadScore >= 80 ? "TOP_LEAD" : borrowedCompositeLeadScore >= 65 ? "STRONG_LEAD" : borrowedCompositeLeadScore >= 50 ? "MODERATE_LEAD" : borrowedCompositeLeadScore > 20 ? "LOW_LEAD" : "UNQUALIFIED";

  return { borrowedProfitabilityLeadScore, borrowedActivityLeadScore, borrowedConsistencyLeadScore, borrowedDataQualityScore: dq.dataQualityScore, borrowedCompositeLeadScore, borrowedLeadTier };
}

/** Confidence cap for borrowed GMGN rows. Never promotes period_unverified data above medium. */
export function resolveGmgnConfidenceCap(
  s7d: GmgnPeriodStatsInput,
  s30d: GmgnPeriodStatsInput,
  dq: WalletDataQualityAssessment
): "low" | "medium" | "none" {
  if (!isPresent(s7d) && !isPresent(s30d)) return "none";
  if (hasUnverifiedPeriod(s7d) || hasUnverifiedPeriod(s30d) || dq.dataQualityTier === "DQ-D" || dq.dataQualityTier === "DQ-U") {
    return "low";
  }
  if (s7d.status === "PARTIAL" || s30d.status === "PARTIAL" || hasPartialFields(s7d) || hasPartialFields(s30d) || dq.dataQualityTier === "DQ-C") {
    return "medium";
  }
  return "medium"; // borrowed GMGN is never high-confidence without chain verification
}

/**
 * Severity lookup that reuses the codes emitted by `evaluateWalletDataQuality`.
 * Does not invent a second severity system — only mirrors existing rule severities.
 */
export function isHighSeverityAnomalyCode(code: string): boolean {
  if (code.startsWith("INVALID_COMPLETENESS_")) return true;
  if (code.startsWith("INVALID_GMGN_STATUS_")) return true;
  if (code === "EXPECTED_METRICS_UNAVAILABLE") return true;
  if (code.includes("ZERO_INCOME_HIGH_PROFIT")) return true;
  return false;
}

/**
 * Codes that must not enter the clean high-winrate sample (category B).
 * - All HIGH DQ codes
 * - Any EXTREME_* code (prefix match — do not hand-list subsets)
 * - WINDOW_MONOTONICITY*
 * - WIN_RATE_UNIT_AMBIGUOUS
 * Low-signal residuals (ACCOUNTING_RESIDUAL_*, PROVIDER_DATA_INCOMPLETE) are NOT auto-excluded
 * but remain disclosed on the row.
 */
export function disqualifiesCleanHighWinrateSample(code: string): boolean {
  if (isHighSeverityAnomalyCode(code)) return true;
  if (code.startsWith("EXTREME_")) return true;
  if (code.startsWith("WINDOW_MONOTONICITY")) return true;
  if (code === "WIN_RATE_UNIT_AMBIGUOUS") return true;
  return false;
}

/**
 * Win-rate unit ambiguity for values in (0, 1] when bulk population is 0–100.
 * Does NOT scale the value; callers must keep the original number.
 * Real 0 stays 0 (not ambiguous). Values > 1 are treated as percent-like.
 */
export function isWinRateUnitAmbiguous(winRate: number | null | undefined): boolean {
  if (winRate === null || winRate === undefined || !Number.isFinite(winRate)) return false;
  return winRate > 0 && winRate <= 1;
}
