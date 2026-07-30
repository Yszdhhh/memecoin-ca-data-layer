export const WALLET_DATA_QUALITY_RULE_VERSION = "wallet-data-quality-v1";

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

/**
 * Computes versioned Data Quality score, tier, consistency, and anomalies for 7d & 30d GMGN data.
 */
export function evaluateWalletDataQuality(
  s7d: GmgnPeriodStatsInput,
  s30d: GmgnPeriodStatsInput,
  evalTimeMs: number = Date.now()
): WalletDataQualityAssessment {
  const c7 = s7d.completeness ?? 0;
  const c30 = s30d.completeness ?? 0;
  const has7d = s7d.status === "MAPPED" || s7d.status === "PARTIAL";
  const has30d = s30d.status === "MAPPED" || s30d.status === "PARTIAL";

  const pairCoverage = has7d && has30d ? 1.0 : has7d || has30d ? 0.5 : 0.0;

  const anomalies: AnomalyDetail[] = [];
  const manualReviewReasons: string[] = [];
  const exclusionCandidateFlags: string[] = [];

  let consistencyScore = 100;

  // Check 7d accounting residual
  if (s7d.realizedProfit !== null && s7d.soldIncome !== null && s7d.boughtCost !== null) {
    const res7d = s7d.realizedProfit - (s7d.soldIncome - s7d.boughtCost);
    if (Math.abs(res7d) > 1e-4) {
      consistencyScore -= Math.min(30, (Math.abs(res7d) / (Math.abs(s7d.realizedProfit) + 100)) * 25);
      if (Math.abs(res7d) > 1000 || (Math.abs(s7d.realizedProfit) > 100 && Math.abs(res7d) > Math.abs(s7d.realizedProfit) * 0.2)) {
        anomalies.push({
          code: "ACCOUNTING_RESIDUAL_MISMATCH_7D",
          severity: "HIGH",
          reason: `7d realized profit (${s7d.realizedProfit}) differs from soldIncome - boughtCost (${s7d.soldIncome - s7d.boughtCost}) by ${res7d.toFixed(2)}`,
          evidenceFields: ["gmgn7dRealizedProfit", "gmgn7dSoldIncome", "gmgn7dBoughtCost"],
          ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
        });
      }
    }
  }

  // Check 30d accounting residual
  if (s30d.realizedProfit !== null && s30d.soldIncome !== null && s30d.boughtCost !== null) {
    const res30d = s30d.realizedProfit - (s30d.soldIncome - s30d.boughtCost);
    if (Math.abs(res30d) > 1e-4) {
      consistencyScore -= Math.min(30, (Math.abs(res30d) / (Math.abs(s30d.realizedProfit) + 100)) * 25);
      if (Math.abs(res30d) > 1000 || (Math.abs(s30d.realizedProfit) > 100 && Math.abs(res30d) > Math.abs(s30d.realizedProfit) * 0.2)) {
        anomalies.push({
          code: "ACCOUNTING_RESIDUAL_MISMATCH_30D",
          severity: "HIGH",
          reason: `30d realized profit (${s30d.realizedProfit}) differs from soldIncome - boughtCost (${s30d.soldIncome - s30d.boughtCost}) by ${res30d.toFixed(2)}`,
          evidenceFields: ["gmgn30dRealizedProfit", "gmgn30dSoldIncome", "gmgn30dBoughtCost"],
          ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
        });
      }
    }
  }

  // Zero soldIncome with non-zero/large realizedProfit
  if (s30d.soldIncome === 0 && s30d.realizedProfit !== null && s30d.realizedProfit > 500) {
    anomalies.push({
      code: "ZERO_INCOME_HIGH_PROFIT_30D",
      severity: "HIGH",
      reason: `30d soldIncome is 0 but realizedProfit is ${s30d.realizedProfit}`,
      evidenceFields: ["gmgn30dSoldIncome", "gmgn30dRealizedProfit"],
      ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    });
    manualReviewReasons.push("0 收入但有显著 realizedProfit (30d)");
  }

  // Monotonicity checks (7d vs 30d)
  if (has7d && has30d) {
    let monoViolations = 0;
    if (s7d.buyCount !== null && s30d.buyCount !== null && s7d.buyCount > s30d.buyCount) {
      monoViolations++;
    }
    if (s7d.sellCount !== null && s30d.sellCount !== null && s7d.sellCount > s30d.sellCount) {
      monoViolations++;
    }
    if (s7d.tokenNum !== null && s30d.tokenNum !== null && s7d.tokenNum > s30d.tokenNum) {
      monoViolations++;
    }
    if (s7d.boughtCost !== null && s30d.boughtCost !== null && s7d.boughtCost > s30d.boughtCost * 1.05 + 10) {
      monoViolations++;
    }
    if (s7d.soldIncome !== null && s30d.soldIncome !== null && s7d.soldIncome > s30d.soldIncome * 1.05 + 10) {
      monoViolations++;
    }

    if (monoViolations > 0) {
      consistencyScore -= monoViolations * 15;
      anomalies.push({
        code: "WINDOW_MONOTONICITY_VIOLATION",
        severity: "MEDIUM",
        reason: `7d metrics exceed 30d metrics across ${monoViolations} field(s)`,
        evidenceFields: ["gmgn7dBuyCount", "gmgn30dBuyCount", "gmgn7dSellCount", "gmgn30dSellCount"],
        ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
      });
    }
  }

  // Extreme profit / loss
  const p30 = s30d.realizedProfit ?? s7d.realizedProfit;
  if (p30 !== null && (p30 > 300000 || p30 < -100000)) {
    anomalies.push({
      code: "EXTREME_PROFIT_OUTLIER",
      severity: "MEDIUM",
      reason: `Realized profit ${p30} is an extreme outlier`,
      evidenceFields: ["gmgn30dRealizedProfit"],
      ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    });
    manualReviewReasons.push("极端 30d 盈利/亏损数值 (> $300k 或 < -$100k)");
  }

  // Extreme token count
  const t30 = s30d.tokenNum ?? s7d.tokenNum;
  if (t30 !== null && t30 > 1000) {
    anomalies.push({
      code: "EXTREME_TOKEN_NUM",
      severity: "MEDIUM",
      reason: `Token count ${t30} exceeds 1,000`,
      evidenceFields: ["gmgn30dTokenNum"],
      ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    });
    manualReviewReasons.push("高 Token 交易多样性 (> 1,000 tokens)");
  }

  // Extreme buy/sell ratio
  const b30 = s30d.buyCount ?? 0;
  const sl30 = s30d.sellCount ?? 0;
  if (b30 > 50 && sl30 === 0) {
    anomalies.push({
      code: "EXTREME_BUY_ONLY_RATIO",
      severity: "MEDIUM",
      reason: `30d buyCount is ${b30} but sellCount is 0`,
      evidenceFields: ["gmgn30dBuyCount", "gmgn30dSellCount"],
      ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    });
  } else if (sl30 > 50 && b30 === 0) {
    anomalies.push({
      code: "EXTREME_SELL_ONLY_RATIO",
      severity: "MEDIUM",
      reason: `30d sellCount is ${sl30} but buyCount is 0`,
      evidenceFields: ["gmgn30dBuyCount", "gmgn30dSellCount"],
      ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    });
  }

  // Extreme high frequency
  const totalTrades30 = b30 + sl30;
  if (totalTrades30 > 2000) {
    anomalies.push({
      code: "EXTREME_TRADE_FREQUENCY",
      severity: "MEDIUM",
      reason: `30d total trades ${totalTrades30} > 2,000`,
      evidenceFields: ["gmgn30dBuyCount", "gmgn30dSellCount"],
      ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    });
    manualReviewReasons.push("极高交易频率 (> 2,000 笔)");
  }

  // Recent inactivity despite long-term profit
  const lastActive = s30d.lastActiveTimestamp ?? s7d.lastActiveTimestamp;
  const act7 = (s7d.buyCount ?? 0) + (s7d.sellCount ?? 0);
  if (p30 !== null && p30 > 5000 && act7 === 0) {
    const ageDays = lastActive ? (evalTimeMs - lastActive * 1000) / (86400 * 1000) : null;
    if (ageDays === null || ageDays > 14) {
      anomalies.push({
        code: "LONG_TERM_PROFIT_RECENTLY_INACTIVE",
        severity: "LOW",
        reason: `30d profit is ${p30} but zero 7d activity (last active ${ageDays ? Math.round(ageDays) + 'd ago' : 'unknown'})`,
        evidenceFields: ["gmgn30dRealizedProfit", "activityCount7d", "gmgn30dLastActiveTimestamp"],
        ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
      });
    }
  }

  // Warning codes checks
  const allWarnings = [...s7d.warningCodes, ...s30d.warningCodes];
  if (allWarnings.includes("gmgn_wallet_stats_win_rate_unit_ambiguous")) {
    anomalies.push({
      code: "WIN_RATE_UNIT_AMBIGUOUS",
      severity: "LOW",
      reason: "Win rate unit is ambiguous in provider payload",
      evidenceFields: ["gmgn7dWinRate", "gmgn30dWinRate"],
      ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    });
  }
  if (allWarnings.includes("gmgn_wallet_stats_partial_fields") || s7d.status === "PARTIAL" || s30d.status === "PARTIAL") {
    anomalies.push({
      code: "PROVIDER_DATA_INCOMPLETE",
      severity: "LOW",
      reason: "Provider returned partial fields or unverified period",
      evidenceFields: ["gmgn7dCompleteness", "gmgn30dCompleteness"],
      ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    });
  }

  if (!has7d && !has30d) {
    anomalies.push({
      code: "EXPECTED_METRICS_UNAVAILABLE",
      severity: "HIGH",
      reason: "GMGN metrics unavailable for both 7d and 30d",
      evidenceFields: ["gmgn7dStatus", "gmgn30dStatus"],
      ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    });
    manualReviewReasons.push("GMGN 7d/30d 数据完全缺失");
  }

  const finalConsistencyScore = Math.max(0, Math.round(consistencyScore));

  // Compute Data Quality Score (0 - 100)
  // Weights:
  // - Field coverage average (30%)
  // - Pair coverage (25%)
  // - Internal consistency score (30%)
  // - Anomaly penalty (15%)
  const avgCoverage = (c7 + c30) / 2;
  const highSeverityAnomalyCount = anomalies.filter((a) => a.severity === "HIGH").length;
  const anomalyPenalty = Math.min(100, highSeverityAnomalyCount * 30 + anomalies.length * 10);

  let rawQualityScore =
    avgCoverage * 30 +
    pairCoverage * 25 +
    (finalConsistencyScore / 100) * 30 +
    (1 - anomalyPenalty / 100) * 15;

  if (!has7d && !has30d) {
    rawQualityScore = 0;
  }

  const dataQualityScore = Math.max(0, Math.min(100, Math.round(rawQualityScore * 100) / 100));

  let dataQualityTier: DataQualityTier = "DQ-U";
  if (!has7d && !has30d) {
    dataQualityTier = "DQ-U";
  } else if (dataQualityScore >= 80) {
    dataQualityTier = "DQ-A";
  } else if (dataQualityScore >= 65) {
    dataQualityTier = "DQ-B";
  } else if (dataQualityScore >= 50) {
    dataQualityTier = "DQ-C";
  } else if (dataQualityScore > 0) {
    dataQualityTier = "DQ-D";
  } else {
    dataQualityTier = "DQ-U";
  }

  // Exclusion candidates for data quality grounds
  if (dataQualityTier === "DQ-D" || dataQualityTier === "DQ-U") {
    exclusionCandidateFlags.push("LOW_DATA_QUALITY_EXCLUSION");
  }
  if (highSeverityAnomalyCount >= 2) {
    exclusionCandidateFlags.push("SEVERE_ACCOUNTING_ANOMALY_EXCLUSION");
  }

  const manualReviewRequired = manualReviewReasons.length > 0 || highSeverityAnomalyCount > 0;

  return {
    fieldCoverage7d: c7,
    fieldCoverage30d: c30,
    pairCoverage,
    dataQualityScore,
    dataQualityTier,
    internalConsistencyScore: finalConsistencyScore,
    anomalyFlags: anomalies,
    exclusionCandidateFlags,
    manualReviewRequired,
    manualReviewReasons,
  };
}

/**
 * Computes borrowed-data candidate lead scores for initial candidate screening ONLY.
 * Explicitly marked as borrowed / unverified.
 */
export function calculateBorrowedCandidateScores(
  s7d: GmgnPeriodStatsInput,
  s30d: GmgnPeriodStatsInput,
  dq: WalletDataQualityAssessment,
  profitPercentile30d: number
): BorrowedCandidateScores {
  const p30 = s30d.realizedProfit;
  const p7 = s7d.realizedProfit;

  if (p30 === null && p7 === null) {
    return {
      borrowedProfitabilityLeadScore: null,
      borrowedActivityLeadScore: null,
      borrowedConsistencyLeadScore: null,
      borrowedDataQualityScore: dq.dataQualityScore,
      borrowedCompositeLeadScore: null,
      borrowedLeadTier: "UNQUALIFIED",
    };
  }

  // 1. Profitability Lead Score (0 - 100)
  let profitScore = profitPercentile30d;
  const winRate30 = s30d.winRate ?? s7d.winRate;
  if (winRate30 !== null) {
    const winFactor = winRate30 > 100 ? winRate30 / 100 : winRate30;
    profitScore = profitScore * 0.7 + Math.min(100, winFactor * 100) * 0.3;
  }
  const borrowedProfitabilityLeadScore = Math.round(profitScore * 100) / 100;

  // 2. Activity Lead Score (0 - 100)
  const act30 = (s30d.buyCount ?? 0) + (s30d.sellCount ?? 0);
  const act7 = (s7d.buyCount ?? 0) + (s7d.sellCount ?? 0);
  const tokens = s30d.tokenNum ?? s7d.tokenNum ?? 0;

  let actScore = Math.min(100, (act30 / 150) * 50 + (act7 / 35) * 30 + Math.min(20, tokens / 5));
  const borrowedActivityLeadScore = Math.round(actScore * 100) / 100;

  // 3. Consistency Lead Score (0 - 100)
  let consistencyScore = 50;
  if (p7 !== null && p30 !== null && p30 > 0) {
    const expected7dShare = p30 / 4.28;
    const ratio = p7 / (expected7dShare + 1e-4);
    if (ratio >= 0.5 && ratio <= 2.5) {
      consistencyScore = 90;
    } else if (ratio > 0) {
      consistencyScore = 70;
    } else {
      consistencyScore = 30; // negative 7d vs positive 30d
    }
  }
  if (dq.internalConsistencyScore < 60) {
    consistencyScore *= 0.6;
  }
  const borrowedConsistencyLeadScore = Math.round(consistencyScore * 100) / 100;

  // 4. Composite Lead Score (0 - 100)
  // Weighted combination penalized by low Data Quality
  const dqMultiplier = dq.dataQualityScore / 100;
  const rawComposite =
    borrowedProfitabilityLeadScore * 0.45 +
    borrowedActivityLeadScore * 0.25 +
    borrowedConsistencyLeadScore * 0.30;

  const borrowedCompositeLeadScore = Math.round(rawComposite * dqMultiplier * 100) / 100;

  let borrowedLeadTier: BorrowedCandidateScores["borrowedLeadTier"] = "UNQUALIFIED";
  if (borrowedCompositeLeadScore >= 80) {
    borrowedLeadTier = "TOP_LEAD";
  } else if (borrowedCompositeLeadScore >= 65) {
    borrowedLeadTier = "STRONG_LEAD";
  } else if (borrowedCompositeLeadScore >= 50) {
    borrowedLeadTier = "MODERATE_LEAD";
  } else if (borrowedCompositeLeadScore > 20) {
    borrowedLeadTier = "LOW_LEAD";
  } else {
    borrowedLeadTier = "UNQUALIFIED";
  }

  return {
    borrowedProfitabilityLeadScore,
    borrowedActivityLeadScore,
    borrowedConsistencyLeadScore,
    borrowedDataQualityScore: dq.dataQualityScore,
    borrowedCompositeLeadScore,
    borrowedLeadTier,
  };
}
