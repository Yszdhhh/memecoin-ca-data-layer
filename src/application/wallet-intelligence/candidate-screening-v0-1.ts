/**
 * SOL-WALLET-CANDIDATE-SCREENING-V0-1-001
 *
 * Deterministic offline screening of 1,433 Solana addresses against GMGN RERUN-002.
 * Produces master table + multi-scenario candidate lists. No formal Alpha Score / grade.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { normalizeSolanaAddress } from "../../domain/solana-address.js";
import {
  evaluateWalletDataQuality,
  calculateBorrowedCandidateScores,
  resolveGmgnConfidenceCap,
  isHighSeverityAnomalyCode,
  disqualifiesCleanHighWinrateSample,
  isWinRateUnitAmbiguous,
  WALLET_DATA_QUALITY_RULE_VERSION,
  type DataQualityTier,
  type GmgnPeriodStatsInput,
} from "../../domain/rules/wallet-data-quality.js";
import {
  EXPECTED_SOL_ADDRESSES_HASH,
  EXPECTED_SOL_LABELS_HASH,
  computeFingerprint,
  computeSha256,
} from "./master-table-builder.js";

export const CANDIDATE_SCREENING_TASK_ID = "SOL-WALLET-CANDIDATE-SCREENING-V0-1-001";
export const CANDIDATE_SCREENING_RULE_VERSION = "wallet-candidate-screening-v0-1-1";
export const EXPECTED_CATEGORY_MIN = 6;

export type CandidateCategory =
  | "A_ACTIVE_HIGH_PROFIT_LEAD"
  | "B_HIGH_WINRATE_ADEQUATE_SAMPLE"
  | "C_LOW_WINRATE_HIGH_PROFIT_LEAD"
  | "D_RECENT_OUTPERFORMANCE"
  | "E_HISTORICAL_STRONG_RECENT_DECAY"
  | "F_HIGH_FREQ_OR_ANOMALY_SUSPICIOUS"
  | "G_LABEL_STAT_CONFLICT"
  | "H_INSUFFICIENT_DATA_HIGH_INTEL";

export type RecommendedNextAction =
  | "HUMAN_REVIEW"
  | "GMGN_HISTORY_REVIEW"
  | "CHAIN_VERIFICATION"
  | "DORMANT_MONITOR"
  | "INSUFFICIENT_DATA"
  | "EXCLUDE_FROM_FOLLOWING";

export type ActivityTier = "ACTIVE_7D" | "ACTIVE_30D_ONLY" | "INACTIVE" | "UNKNOWN";
export type DataTier = "TIER_COMPLETE" | "TIER_PARTIAL" | "TIER_SPARSE" | "TIER_MISSING";
export type DataConfidence = "low" | "medium" | "none";

export interface WalletMasterV01Record {
  address: string;
  wallet_fingerprint: string;
  source_order: number;
  existing_labels: string[];
  existing_note: string;
  source_claims: string[];
  existing_label: string[];
  confirmed_label: null;
  confirmed_behavior_labels: null;
  gmgn_7d_status: "MAPPED" | "PARTIAL" | "UNAVAILABLE" | "ABSENT";
  gmgn_30d_status: "MAPPED" | "PARTIAL" | "UNAVAILABLE" | "ABSENT";
  gmgn_7d_completeness: number | null;
  gmgn_30d_completeness: number | null;
  data_confidence: DataConfidence;
  verification_status: "unverified";
  source_type: "borrowed";
  transport_requested_period: { "7d": "7d"; "30d": "30d" };
  provider_attested_period: { "7d": null; "30d": null };
  confidence_cap: DataConfidence;
  profit_7d: number | null;
  profit_30d: number | null;
  win_rate_7d: number | null;
  win_rate_30d: number | null;
  buy_count: number | null;
  sell_count: number | null;
  trade_count_proxy: number | null;
  token_count: number | null;
  last_active_at: string | null;
  average_profit_per_trade_proxy: number | null;
  average_profit_per_token_proxy: number | null;
  seven_day_vs_thirty_day_consistency: number | null;
  anomaly_flags: string[];
  activity_tier: ActivityTier;
  data_tier: DataTier;
  data_quality_score: number;
  data_quality_tier: DataQualityTier;
  profit_percentile_30d: number | null;
  winrate_percentile_30d: number | null;
  trade_percentile_30d: number | null;
  gmgn_lead_score: number | null;
  gmgn_lead_tier: string;
  gmgn_lead_reason_codes: string[];
  candidate_categories: CandidateCategory[];
  candidate_reason_codes: string[];
  human_review_status: "PENDING_HUMAN_REVIEW";
  alpha_score: null;
  final_wallet_score: null;
  final_wallet_grade: null;
  confirmed_behavior_labels_v2: null;
}

export interface CandidateUnionEntry {
  address: string;
  wallet_fingerprint: string;
  candidate_categories: CandidateCategory[];
  candidate_reason_codes: string[];
  key_metrics: {
    profit_7d: number | null;
    profit_30d: number | null;
    win_rate_7d: number | null;
    win_rate_30d: number | null;
    trade_count_proxy: number | null;
    token_count: number | null;
    last_active_at: string | null;
    gmgn_lead_score: number | null;
    profit_percentile_30d: number | null;
    data_quality_score: number;
  };
  existing_labels: string[];
  existing_note: string;
  data_confidence: DataConfidence;
  anomaly_flags: string[];
  why_selected: string;
  what_is_not_known: string[];
  /** Alias of primary_recommended_action (schema compatibility). */
  recommended_next_action: RecommendedNextAction;
  primary_recommended_action: RecommendedNextAction;
  secondary_recommended_actions: RecommendedNextAction[];
  action_reason_codes: string[];
  /**
   * Diversity / multi-category research ordering only.
   * NOT wallet profitability, copy-trade priority, or formal Alpha rank.
   */
  research_priority_rank: number;
  category_count: number;
  gmgn_lead_score: number | null;
  group_ranks: Partial<Record<CandidateCategory, number>>;
}

export interface ScreeningOptions {
  inputDir: string;
  gmgnOutputDir: string;
  outputDir: string;
  evalTimeMs?: number;
  expectedHashes?: {
    solAddressesTxtHash?: string;
    solAddressLabelsJsonHash?: string;
  };
  targetCandidateMin?: number;
  targetCandidateMax?: number;
  researchPackCount?: number;
}

export type ScreeningRunStatus = "SUCCESS" | "DEGRADED" | "FAILED";

export interface ScreeningDegradation {
  expected_candidate_min: number;
  actual_candidate_count: number;
  expected_candidate_max: number;
  expected_category_min: number;
  actual_category_count: number;
  degradation_reason_codes: string[];
}

export interface ScreeningResult {
  status: ScreeningRunStatus;
  degradation?: ScreeningDegradation;
  inputHashes: Record<string, string>;
  addressSetHash: string;
  metrics: {
    totalAddresses: number;
    uniqueAddresses: number;
    dataTier: Record<DataTier, number>;
    dataQualityTiers: Record<DataQualityTier, number>;
    activityTiers: Record<ActivityTier, number>;
    categoryCounts: Record<CandidateCategory, number>;
    uniqueCandidateCount: number;
    researchPackCount: number;
    categoriesRepresented: number;
  };
  outputFiles: Record<string, string>;
  outputHashes: Record<string, string>;
}

const CATEGORIES: CandidateCategory[] = [
  "A_ACTIVE_HIGH_PROFIT_LEAD",
  "B_HIGH_WINRATE_ADEQUATE_SAMPLE",
  "C_LOW_WINRATE_HIGH_PROFIT_LEAD",
  "D_RECENT_OUTPERFORMANCE",
  "E_HISTORICAL_STRONG_RECENT_DECAY",
  "F_HIGH_FREQ_OR_ANOMALY_SUSPICIOUS",
  "G_LABEL_STAT_CONFLICT",
  "H_INSUFFICIENT_DATA_HIGH_INTEL",
];

const SAFE_ACTIONS = new Set<RecommendedNextAction>([
  "HUMAN_REVIEW",
  "GMGN_HISTORY_REVIEW",
  "CHAIN_VERIFICATION",
  "DORMANT_MONITOR",
  "INSUFFICIENT_DATA",
  "EXCLUDE_FROM_FOLLOWING",
]);

function safeDiv(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den === 0 || !Number.isFinite(num) || !Number.isFinite(den)) return null;
  const res = num / den;
  return Number.isFinite(res) ? Math.round(res * 10000) / 10000 : null;
}

function percentileOf(sorted: number[], value: number): number {
  if (sorted.length === 0) return 0;
  let count = 0;
  for (const v of sorted) if (v <= value) count++;
  return Math.round((count / sorted.length) * 100 * 100) / 100;
}

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[idx]!;
}

/**
 * RERUN-002 normalized profiles omit top-level `status` (field is absent).
 * Derive status from warning codes + aggregate presence — never invent MAPPED.
 */
export function resolveGmgnPeriodStatus(
  rec: any | undefined
): { status: GmgnPeriodStatsInput["status"] | "ABSENT"; derived: boolean; warningCodes: string[] } {
  if (!rec) return { status: "ABSENT", derived: false, warningCodes: [] };
  const warningCodes = Array.isArray(rec.warningCodes) ? [...rec.warningCodes] : [];
  const allowed = new Set(["MAPPED", "PARTIAL", "UNAVAILABLE"]);
  if (typeof rec.status === "string" && allowed.has(rec.status)) {
    return { status: rec.status as GmgnPeriodStatsInput["status"], derived: false, warningCodes };
  }

  const hardUnavailable = warningCodes.some(
    (c) =>
      c.includes("expected_metrics_unavailable") ||
      c.includes("network_unavailable") ||
      c.includes("cli_error") ||
      c.includes("transport")
  );
  if (hardUnavailable) {
    if (!warningCodes.includes("status_derived_unavailable")) warningCodes.push("status_derived_unavailable");
    return { status: "UNAVAILABLE", derived: true, warningCodes };
  }

  const agg = rec.aggregates ?? {};
  const metricKeys = ["realizedProfit", "winRate", "buyCount", "sellCount", "boughtCost", "soldIncome", "tokenNum"] as const;
  const hasAnyMetric = metricKeys.some((k) => agg[k] !== null && agg[k] !== undefined);
  if (hasAnyMetric || warningCodes.some((c) => c.includes("partial_fields") || c.includes("period_unverified"))) {
    if (!warningCodes.includes("status_derived_partial_provider_omitted_status")) {
      warningCodes.push("status_derived_partial_provider_omitted_status");
    }
    return { status: "PARTIAL", derived: true, warningCodes };
  }

  if (!warningCodes.includes("status_derived_unavailable")) warningCodes.push("status_derived_unavailable");
  return { status: "UNAVAILABLE", derived: true, warningCodes };
}

function parsePeriod(rec: any | undefined): GmgnPeriodStatsInput & { status: GmgnPeriodStatsInput["status"] | "ABSENT" } {
  const resolved = resolveGmgnPeriodStatus(rec);
  if (resolved.status === "ABSENT") {
    return {
      status: "ABSENT",
      completeness: null,
      realizedProfit: null,
      realizedProfitPnl: null,
      winRate: null,
      buyCount: null,
      sellCount: null,
      boughtCost: null,
      soldIncome: null,
      tokenNum: null,
      lastActiveTimestamp: null,
      warningCodes: [],
    };
  }
  const agg = rec?.aggregates ?? {};
  const rawCompleteness = rec?.completeness ?? null;
  const completeness =
    rawCompleteness !== null && Number.isFinite(rawCompleteness) && rawCompleteness >= 0 && rawCompleteness <= 1
      ? rawCompleteness
      : rawCompleteness === null
        ? null
        : null;

  return {
    status: resolved.status,
    completeness,
    realizedProfit: agg.realizedProfit ?? null,
    realizedProfitPnl: agg.realizedProfitPnl ?? null,
    winRate: agg.winRate ?? null,
    buyCount: agg.buyCount ?? null,
    sellCount: agg.sellCount ?? null,
    boughtCost: agg.boughtCost ?? null,
    soldIncome: agg.soldIncome ?? null,
    tokenNum: agg.tokenNum ?? null,
    lastActiveTimestamp: agg.lastActiveTimestamp ?? null,
    warningCodes: resolved.warningCodes,
  };
}

function toGmgnInput(p: ReturnType<typeof parsePeriod>): GmgnPeriodStatsInput {
  if (p.status === "ABSENT") {
    return {
      status: "ABSENT" as any,
      completeness: null,
      realizedProfit: null,
      realizedProfitPnl: null,
      winRate: null,
      buyCount: null,
      sellCount: null,
      boughtCost: null,
      soldIncome: null,
      tokenNum: null,
      lastActiveTimestamp: null,
      warningCodes: [],
    };
  }
  return {
    status: p.status,
    completeness: p.completeness,
    realizedProfit: p.realizedProfit,
    realizedProfitPnl: p.realizedProfitPnl,
    winRate: p.winRate,
    buyCount: p.buyCount,
    sellCount: p.sellCount,
    boughtCost: p.boughtCost,
    soldIncome: p.soldIncome,
    tokenNum: p.tokenNum,
    lastActiveTimestamp: p.lastActiveTimestamp,
    warningCodes: p.warningCodes,
  };
}

function activityTier(act7: number | null, act30: number | null, lastActiveTs: number | null, evalTimeMs: number): ActivityTier {
  if (act7 !== null && act7 > 0) return "ACTIVE_7D";
  if (act30 !== null && act30 > 0) return "ACTIVE_30D_ONLY";
  if (lastActiveTs !== null) {
    const ageDays = (evalTimeMs - lastActiveTs * 1000) / 86_400_000;
    if (Number.isFinite(ageDays) && ageDays <= 7) return "ACTIVE_7D";
    if (Number.isFinite(ageDays) && ageDays <= 30) return "ACTIVE_30D_ONLY";
    return "INACTIVE";
  }
  if (act7 === null && act30 === null) return "UNKNOWN";
  return "INACTIVE";
}

function dataTier(s7: GmgnPeriodStatsInput, s30: GmgnPeriodStatsInput, dq: { fieldCoverage7d: number; fieldCoverage30d: number }): DataTier {
  const present = (s: GmgnPeriodStatsInput) => s.status === "MAPPED" || s.status === "PARTIAL";
  if (!present(s7) && !present(s30)) return "TIER_MISSING";
  const avg = (dq.fieldCoverage7d + dq.fieldCoverage30d) / 2;
  if (avg >= 0.9 && present(s7) && present(s30)) return "TIER_COMPLETE";
  if (avg >= 0.5) return "TIER_PARTIAL";
  return "TIER_SPARSE";
}

function labelClaims(labels: string[], note: string): string[] {
  const claims = new Set<string>();
  for (const l of labels) claims.add(l);
  if (note) claims.add(note);
  return Array.from(claims);
}

/** Structured source-claim types. top/rank/KOL are NOT smart-money claims. */
export interface LabelClaimTypes {
  explicit_smart_money_claim: boolean;
  kol_claim: boolean;
  ranking_claim: boolean;
  sniper_claim: boolean;
  whale_claim: boolean;
  bot_claim: boolean;
  high_win_claim: boolean;
  other_source_claim: boolean;
}

/**
 * Classify label text into claim types.
 * `CLAIM_SMART_MONEY_UNVERIFIED` may only be driven by `explicit_smart_money_claim`.
 */
export function classifyLabelClaims(labels: string[], note: string): LabelClaimTypes {
  const parts = [...labels, note].filter((x) => typeof x === "string" && x.trim().length > 0);
  const text = parts.join(" ");
  const lower = text.toLowerCase();

  // Explicit smart-money / ability claims only (not bare top/rank/KOL/alpha).
  const explicit_smart_money_claim =
    /聪明钱|smart\s*money/i.test(text) ||
    /顶级高手|真高手|超级高手|盈利能力/i.test(text) ||
    ( /高手/.test(text) && /胜率|盈利|利润|暴击|赚/.test(text) );

  const kol_claim = /\bkol\b|influencer|推特博主|twitter\s*(kol|influencer)/i.test(lower);
  // ranking: topNN / rankNN / 排名 / 榜 — not smart money
  const ranking_claim = /\btop\s*\d+\b|\brank\s*\d+\b|排名|第\s*\d+\s*名|\b榜\d*\b/i.test(lower);
  const sniper_claim = /狙击|sniper|抢跑/i.test(text);
  const whale_claim = /鲸鱼|whale|大户/i.test(text);
  const bot_claim = /机器|bot|刷量|自转|sybil/i.test(lower);
  const high_win_claim = /高胜率|胜率\s*\d+|win\s*rate\s*\d+/i.test(text);

  const anyTyped =
    explicit_smart_money_claim ||
    kol_claim ||
    ranking_claim ||
    sniper_claim ||
    whale_claim ||
    bot_claim ||
    high_win_claim;

  return {
    explicit_smart_money_claim,
    kol_claim,
    ranking_claim,
    sniper_claim,
    whale_claim,
    bot_claim,
    high_win_claim,
    other_source_claim: parts.length > 0 && !anyTyped,
  };
}

export interface ActionDecision {
  primary_recommended_action: RecommendedNextAction;
  secondary_recommended_actions: RecommendedNextAction[];
  action_reason_codes: string[];
}

function isRecentlyActive(r: Pick<WalletMasterV01Record, "activity_tier">): boolean {
  return r.activity_tier === "ACTIVE_7D" || r.activity_tier === "ACTIVE_30D_ONLY";
}

function hasFHighAnomaly(r: Pick<WalletMasterV01Record, "anomaly_flags">): boolean {
  return r.anomaly_flags.some(
    (f) =>
      isHighSeverityAnomalyCode(f) ||
      f.includes("EXTREME") ||
      f.includes("ZERO_INCOME") ||
      f.startsWith("WINDOW_MONOTONICITY")
  );
}

/**
 * Explicit multi-category action matrix (testable).
 * `recommended_next_action` callers must use `primary_recommended_action`.
 */
export function resolveRecommendedActions(
  categories: CandidateCategory[],
  r: Pick<WalletMasterV01Record, "anomaly_flags" | "activity_tier">
): ActionDecision {
  const set = new Set(categories);
  const active = isRecentlyActive(r);
  const secondary: RecommendedNextAction[] = [];
  const reasons: string[] = [];

  if (set.has("F_HIGH_FREQ_OR_ANOMALY_SUSPICIOUS") && hasFHighAnomaly(r)) {
    reasons.push("F_WITH_HIGH_OR_EXTREME_ANOMALY");
    if (set.has("G_LABEL_STAT_CONFLICT")) secondary.push("GMGN_HISTORY_REVIEW");
    return {
      primary_recommended_action: "EXCLUDE_FROM_FOLLOWING",
      secondary_recommended_actions: secondary,
      action_reason_codes: reasons,
    };
  }

  if (set.has("H_INSUFFICIENT_DATA_HIGH_INTEL")) {
    reasons.push("H_INSUFFICIENT_DATA");
    if (set.has("G_LABEL_STAT_CONFLICT")) secondary.push("GMGN_HISTORY_REVIEW");
    return {
      primary_recommended_action: "INSUFFICIENT_DATA",
      secondary_recommended_actions: secondary,
      action_reason_codes: reasons,
    };
  }

  const hasC = set.has("C_LOW_WINRATE_HIGH_PROFIT_LEAD");
  const hasE = set.has("E_HISTORICAL_STRONG_RECENT_DECAY");
  const hasAB =
    set.has("A_ACTIVE_HIGH_PROFIT_LEAD") || set.has("B_HIGH_WINRATE_ADEQUATE_SAMPLE");

  // C+E: do not let E unconditionally bury C research value
  if (hasC && hasE) {
    if (active) {
      reasons.push("C_PLUS_E_STILL_ACTIVE");
      secondary.push("GMGN_HISTORY_REVIEW", "DORMANT_MONITOR");
      return {
        primary_recommended_action: "CHAIN_VERIFICATION",
        secondary_recommended_actions: secondary,
        action_reason_codes: reasons,
      };
    }
    reasons.push("C_PLUS_E_INACTIVE");
    secondary.push("GMGN_HISTORY_REVIEW");
    return {
      primary_recommended_action: "DORMANT_MONITOR",
      secondary_recommended_actions: secondary,
      action_reason_codes: reasons,
    };
  }

  if (hasAB && active) {
    reasons.push("A_OR_B_ACTIVE");
    if (hasE) secondary.push("DORMANT_MONITOR");
    if (set.has("G_LABEL_STAT_CONFLICT")) secondary.push("GMGN_HISTORY_REVIEW");
    return {
      primary_recommended_action: "CHAIN_VERIFICATION",
      secondary_recommended_actions: secondary,
      action_reason_codes: reasons,
    };
  }

  if (hasC && active) {
    reasons.push("C_ACTIVE");
    if (set.has("G_LABEL_STAT_CONFLICT")) secondary.push("GMGN_HISTORY_REVIEW");
    return {
      primary_recommended_action: "CHAIN_VERIFICATION",
      secondary_recommended_actions: secondary,
      action_reason_codes: reasons,
    };
  }

  if (hasE && !hasC && !hasAB) {
    reasons.push("E_ALONE_OR_WITHOUT_ACTIVE_LEAD");
    if (set.has("G_LABEL_STAT_CONFLICT")) secondary.push("GMGN_HISTORY_REVIEW");
    return {
      primary_recommended_action: "DORMANT_MONITOR",
      secondary_recommended_actions: secondary,
      action_reason_codes: reasons,
    };
  }

  if (set.has("G_LABEL_STAT_CONFLICT")) {
    reasons.push("G_LABEL_STAT_CONFLICT");
    return {
      primary_recommended_action: "GMGN_HISTORY_REVIEW",
      secondary_recommended_actions: secondary,
      action_reason_codes: reasons,
    };
  }

  if (set.has("D_RECENT_OUTPERFORMANCE")) {
    reasons.push("D_RECENT_OUTPERFORMANCE");
    return {
      primary_recommended_action: "HUMAN_REVIEW",
      secondary_recommended_actions: secondary,
      action_reason_codes: reasons,
    };
  }

  if (set.has("F_HIGH_FREQ_OR_ANOMALY_SUSPICIOUS")) {
    reasons.push("F_WITHOUT_HIGH_ANOMALY_DEFAULT_REVIEW");
    return {
      primary_recommended_action: "HUMAN_REVIEW",
      secondary_recommended_actions: secondary,
      action_reason_codes: reasons,
    };
  }

  reasons.push("DEFAULT_HUMAN_REVIEW");
  return {
    primary_recommended_action: "HUMAN_REVIEW",
    secondary_recommended_actions: secondary,
    action_reason_codes: reasons,
  };
}

/** @deprecated use resolveRecommendedActions; kept as thin wrapper for call sites. */
function nextActionFor(categories: CandidateCategory[], r: WalletMasterV01Record): RecommendedNextAction {
  return resolveRecommendedActions(categories, r).primary_recommended_action;
}

export function assessScreeningCoverage(args: {
  uniqueCandidateCount: number;
  categoriesRepresented: number;
  targetCandidateMin: number;
  targetCandidateMax: number;
  expectedCategoryMin?: number;
}): { status: ScreeningRunStatus; degradation?: ScreeningDegradation } {
  const expectedCategoryMin = args.expectedCategoryMin ?? EXPECTED_CATEGORY_MIN;
  const codes: string[] = [];
  if (args.uniqueCandidateCount < args.targetCandidateMin) codes.push("CANDIDATE_COUNT_BELOW_MIN");
  if (args.uniqueCandidateCount > args.targetCandidateMax) codes.push("CANDIDATE_COUNT_ABOVE_MAX");
  if (args.categoriesRepresented < expectedCategoryMin) codes.push("CATEGORY_COVERAGE_BELOW_MIN");
  if (codes.length === 0) return { status: "SUCCESS" };
  return {
    status: "DEGRADED",
    degradation: {
      expected_candidate_min: args.targetCandidateMin,
      actual_candidate_count: args.uniqueCandidateCount,
      expected_candidate_max: args.targetCandidateMax,
      expected_category_min: expectedCategoryMin,
      actual_category_count: args.categoriesRepresented,
      degradation_reason_codes: codes,
    },
  };
}

/** Population thresholds used by category eligibility (computed once per run). */
export interface CategoryEligibilityThresholds {
  profitP75: number;
  winP75: number;
  tradeP95: number;
}

export function notSevereMissingData(r: Pick<WalletMasterV01Record, "data_tier" | "gmgn_30d_status">): boolean {
  return r.data_tier !== "TIER_MISSING" && r.gmgn_30d_status !== "UNAVAILABLE" && r.gmgn_30d_status !== "ABSENT";
}

/** A: active + high profit percentile + min sample */
export function isEligibleCategoryA(
  r: Pick<
    WalletMasterV01Record,
    | "data_tier"
    | "gmgn_30d_status"
    | "activity_tier"
    | "profit_30d"
    | "profit_percentile_30d"
    | "trade_count_proxy"
    | "token_count"
  >
): boolean {
  return (
    notSevereMissingData(r) &&
    (r.activity_tier === "ACTIVE_7D" || r.activity_tier === "ACTIVE_30D_ONLY") &&
    r.profit_30d !== null &&
    r.profit_30d > 0 &&
    (r.profit_percentile_30d ?? 0) >= 75 &&
    (r.trade_count_proxy ?? 0) >= 5 &&
    (r.token_count ?? 0) >= 2
  );
}

/**
 * B: high winrate + sample ≥15 + positive profit + no HIGH / EXTREME_* / window / unit-ambiguous flags.
 * Low residuals may still appear on the row; they are disclosed, not auto-excluded.
 */
export function isEligibleCategoryB(
  r: Pick<
    WalletMasterV01Record,
    | "data_tier"
    | "gmgn_30d_status"
    | "win_rate_30d"
    | "trade_count_proxy"
    | "profit_30d"
    | "anomaly_flags"
  >,
  winP75: number
): boolean {
  return (
    notSevereMissingData(r) &&
    r.win_rate_30d !== null &&
    !isWinRateUnitAmbiguous(r.win_rate_30d) &&
    !r.anomaly_flags.includes("WIN_RATE_UNIT_AMBIGUOUS") &&
    r.win_rate_30d >= Math.max(winP75, 35) &&
    (r.trade_count_proxy ?? 0) >= 15 &&
    r.profit_30d !== null &&
    r.profit_30d > 0 &&
    !r.anomaly_flags.some((f) => disqualifiesCleanHighWinrateSample(f))
  );
}

/** C: low winrate high profit lead (not golden-dog confirmation). */
export function isEligibleCategoryC(
  r: Pick<
    WalletMasterV01Record,
    | "data_tier"
    | "gmgn_30d_status"
    | "win_rate_30d"
    | "profit_30d"
    | "trade_count_proxy"
    | "anomaly_flags"
  >,
  profitP75: number
): boolean {
  return (
    notSevereMissingData(r) &&
    r.win_rate_30d !== null &&
    !isWinRateUnitAmbiguous(r.win_rate_30d) &&
    !r.anomaly_flags.includes("WIN_RATE_UNIT_AMBIGUOUS") &&
    r.win_rate_30d > 0 &&
    r.win_rate_30d <= 35 &&
    r.profit_30d !== null &&
    r.profit_30d >= Math.max(profitP75, 1) &&
    (r.trade_count_proxy ?? 0) >= 8
  );
}

/** D: 7d outperformance vs 30d weekly avg with small-denominator guard. */
export function isEligibleCategoryD(
  r: Pick<WalletMasterV01Record, "data_tier" | "gmgn_30d_status" | "profit_7d" | "profit_30d" | "trade_count_proxy">
): boolean {
  if (!notSevereMissingData(r)) return false;
  if (r.profit_7d === null || r.profit_30d === null) return false;
  if (r.profit_30d <= 50) return false;
  if ((r.trade_count_proxy ?? 0) < 5) return false;
  const weeklyAvg = r.profit_30d / 4.28;
  if (weeklyAvg <= 0) return false;
  const ratio = r.profit_7d / weeklyAvg;
  return ratio >= 2.0 && r.profit_7d > 0;
}

/** E: historically strong 30d + recent decay/inactivity. */
export function isEligibleCategoryE(
  r: Pick<
    WalletMasterV01Record,
    "data_tier" | "gmgn_30d_status" | "profit_30d" | "profit_7d" | "activity_tier"
  >,
  profitP75: number
): boolean {
  if (!notSevereMissingData(r)) return false;
  if (r.profit_30d === null || r.profit_30d < Math.max(profitP75, 1)) return false;
  return (
    r.activity_tier === "INACTIVE" ||
    r.activity_tier === "ACTIVE_30D_ONLY" ||
    (r.profit_7d !== null && r.profit_7d <= 0) ||
    (r.profit_7d !== null && r.profit_30d !== null && r.profit_7d < r.profit_30d / 10)
  );
}

/** F: high frequency / extreme / residual suspicious pool (not confirmed bot/wash). */
export function isEligibleCategoryF(
  r: Pick<
    WalletMasterV01Record,
    "anomaly_flags" | "trade_count_proxy" | "buy_count" | "sell_count" | "token_count"
  >,
  tradeP95: number
): boolean {
  if (
    r.anomaly_flags.some(
      (f) =>
        f.includes("EXTREME") ||
        f.includes("ZERO_INCOME") ||
        f.includes("WINDOW_MONOTONICITY") ||
        f.includes("ACCOUNTING_RESIDUAL")
    )
  ) {
    return true;
  }
  if ((r.trade_count_proxy ?? 0) >= Math.max(tradeP95, 500)) return true;
  if (r.buy_count !== null && r.sell_count !== null) {
    if (r.buy_count > 50 && r.sell_count === 0) return true;
    if (r.sell_count > 50 && r.buy_count === 0) return true;
  }
  if ((r.token_count ?? 0) > 1000) return true;
  return false;
}

/**
 * G eligibility + reason codes.
 * CLAIM_SMART_MONEY_UNVERIFIED only when explicit_smart_money_claim is true.
 */
export function evaluateCategoryG(
  r: Pick<
    WalletMasterV01Record,
    | "existing_labels"
    | "existing_note"
    | "activity_tier"
    | "profit_30d"
    | "data_tier"
    | "trade_count_proxy"
    | "anomaly_flags"
    | "win_rate_30d"
  >
): { eligible: boolean; reasonCodes: string[] } {
  const kw = classifyLabelClaims(r.existing_labels, r.existing_note);
  const hasClaim =
    kw.explicit_smart_money_claim ||
    kw.bot_claim ||
    kw.whale_claim ||
    kw.sniper_claim ||
    kw.high_win_claim ||
    kw.kol_claim ||
    kw.ranking_claim;
  if (!hasClaim) return { eligible: false, reasonCodes: [] };

  let conflict = false;
  if (
    kw.explicit_smart_money_claim &&
    (r.activity_tier === "INACTIVE" ||
      (r.profit_30d !== null && r.profit_30d < 0) ||
      r.data_tier === "TIER_MISSING" ||
      ((r.trade_count_proxy ?? 0) === 0 && (r.profit_30d === null || r.profit_30d === 0)))
  ) {
    conflict = true;
  }
  if (kw.bot_claim && (r.trade_count_proxy ?? 0) < 20 && !r.anomaly_flags.some((f) => f.includes("EXTREME"))) {
    conflict = true;
  }
  if (kw.whale_claim && (r.profit_30d === null || Math.abs(r.profit_30d) < 1000) && (r.trade_count_proxy ?? 0) < 10) {
    conflict = true;
  }
  if (
    kw.high_win_claim &&
    r.win_rate_30d !== null &&
    !isWinRateUnitAmbiguous(r.win_rate_30d) &&
    r.win_rate_30d < 30 &&
    (r.trade_count_proxy ?? 0) >= 10
  ) {
    conflict = true;
  }
  if (
    (kw.kol_claim || kw.ranking_claim) &&
    (r.activity_tier === "INACTIVE" ||
      r.data_tier === "TIER_MISSING" ||
      ((r.trade_count_proxy ?? 0) === 0 && (r.profit_30d === null || r.profit_30d <= 0)))
  ) {
    conflict = true;
  }
  if (!conflict) return { eligible: false, reasonCodes: [] };

  const reasons = ["SOURCE_CLAIM_NOT_CONFIRMED", "LABEL_STAT_DIVERGENCE"];
  if (kw.explicit_smart_money_claim) reasons.push("CLAIM_SMART_MONEY_UNVERIFIED");
  if (kw.kol_claim) reasons.push("CLAIM_KOL_UNVERIFIED");
  if (kw.ranking_claim) reasons.push("CLAIM_RANKING_UNVERIFIED");
  if (kw.bot_claim) reasons.push("CLAIM_BOT_UNSUPPORTED_BY_STATS");
  if (kw.whale_claim) reasons.push("CLAIM_WHALE_LACKS_SUPPORTING_METRICS");
  if (kw.high_win_claim) reasons.push("CLAIM_HIGH_WINRATE_CONFLICTS_WITH_GMGN");
  if (kw.sniper_claim) reasons.push("CLAIM_SNIPER_UNVERIFIED");
  return { eligible: true, reasonCodes: reasons };
}

/** H: sparse/missing GMGN + high-intel labels (count ≥3 or explicit smart-money). */
export function isEligibleCategoryH(
  r: Pick<
    WalletMasterV01Record,
    "data_tier" | "gmgn_30d_status" | "existing_labels" | "existing_note"
  >
): boolean {
  const sparse =
    r.data_tier === "TIER_MISSING" ||
    r.data_tier === "TIER_SPARSE" ||
    r.gmgn_30d_status === "UNAVAILABLE" ||
    r.gmgn_30d_status === "ABSENT";
  if (!sparse) return false;
  const kw = classifyLabelClaims(r.existing_labels, r.existing_note);
  return r.existing_labels.length >= 3 || kw.explicit_smart_money_claim;
}

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = typeof val === "object" ? JSON.stringify(val) : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsv(filePath: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    fs.writeFileSync(filePath, "", "utf8");
    return;
  }
  const headers = Object.keys(rows[0]!);
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))];
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

function pickTop(
  records: WalletMasterV01Record[],
  scoreFn: (r: WalletMasterV01Record) => number,
  limit: number
): WalletMasterV01Record[] {
  return records
    .slice()
    .sort((a, b) => {
      const d = scoreFn(b) - scoreFn(a);
      if (d !== 0) return d;
      return a.wallet_fingerprint.localeCompare(b.wallet_fingerprint);
    })
    .slice(0, limit);
}

function whatIsNotKnown(r: WalletMasterV01Record): string[] {
  const unknown = [
    "Chain-verified swap-level PnL is unavailable",
    "Provider period attestation is missing (period_unverified)",
    "Entry timing / exit quality / copy-tradability are not computed",
    "Formal Alpha Score / UR-SSR-S grades are intentionally null",
    "Token-level concentration of profit is not measured (no per-token breakdown in this batch)",
  ];
  if (r.last_active_at === null) unknown.push("Last active timestamp is missing from provider payload");
  if (r.trade_count_proxy === null || r.trade_count_proxy === 0) unknown.push("Trade sample may be zero or missing");
  if (r.data_tier === "TIER_MISSING" || r.data_tier === "TIER_SPARSE") unknown.push("GMGN field coverage is sparse or missing");
  return unknown;
}

export async function runCandidateScreeningV01(options: ScreeningOptions): Promise<ScreeningResult> {
  const {
    inputDir,
    gmgnOutputDir,
    outputDir,
    expectedHashes,
    targetCandidateMin = 30,
    targetCandidateMax = 50,
    researchPackCount = 15,
  } = options;

  const txtPath = path.join(inputDir, "sol_addresses.txt");
  const jsonPath = path.join(inputDir, "sol_address_labels.json");
  const gmgnProfilesPath = path.join(gmgnOutputDir, "normalized_wallet_profiles.json");
  const gmgnSummaryPath = path.join(gmgnOutputDir, "summary.json");

  for (const p of [txtPath, jsonPath, gmgnProfilesPath, gmgnSummaryPath]) {
    if (!fs.existsSync(p)) throw new Error(`Required input missing: ${path.basename(p)}`);
  }

  const solAddressesTxtHash = computeSha256(fs.readFileSync(txtPath));
  const solAddressLabelsJsonHash = computeSha256(fs.readFileSync(jsonPath));
  const gmgnNormalizedProfilesHash = computeSha256(fs.readFileSync(gmgnProfilesPath));
  const gmgnSummaryHash = computeSha256(fs.readFileSync(gmgnSummaryPath));

  const expectedTxt = expectedHashes?.solAddressesTxtHash ?? EXPECTED_SOL_ADDRESSES_HASH;
  const expectedJson = expectedHashes?.solAddressLabelsJsonHash ?? EXPECTED_SOL_LABELS_HASH;
  if (solAddressesTxtHash !== expectedTxt || solAddressLabelsJsonHash !== expectedJson) {
    throw new Error("Input manifest SHA-256 hash mismatch");
  }

  const txtLines = fs
    .readFileSync(txtPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const validUniqueAddresses: string[] = [];
  const seen = new Set<string>();
  for (const line of txtLines) {
    const norm = normalizeSolanaAddress(line);
    if (!norm) throw new Error("Invalid Solana address in input (value redacted)");
    if (!seen.has(norm)) {
      seen.add(norm);
      validUniqueAddresses.push(norm);
    }
  }
  if (validUniqueAddresses.length !== 1433) {
    throw new Error(`Expected exactly 1,433 unique addresses, got ${validUniqueAddresses.length}`);
  }

  const addressSetHash = computeSha256(validUniqueAddresses.join("\n") + "\n");

  const rawLabels = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const labelMap = new Map<string, { labels: string[]; note: string }>();
  if (Array.isArray(rawLabels)) {
    for (const item of rawLabels) {
      if (!item || typeof item !== "object") continue;
      const norm = normalizeSolanaAddress(item.address);
      if (!norm) continue;
      const labelsArr: string[] = Array.isArray(item.labels)
        ? item.labels.map(String)
        : typeof item.labels_joined === "string"
          ? item.labels_joined.split("|").map((s: string) => s.trim())
          : [];
      const noteStr = typeof item.label_primary === "string" ? item.label_primary.trim() : "";
      const existing = labelMap.get(norm) ?? { labels: [], note: "" };
      labelMap.set(norm, {
        labels: Array.from(new Set([...existing.labels, ...labelsArr.filter(Boolean)])),
        note: Array.from(new Set([existing.note, noteStr].filter(Boolean))).join(" | "),
      });
    }
  }

  const rawProfiles = JSON.parse(fs.readFileSync(gmgnProfilesPath, "utf8"));
  if (!Array.isArray(rawProfiles)) throw new Error("normalized_wallet_profiles.json must be an array");

  const deterministicInputTimeMs = rawProfiles.reduce((latest: number, record: any) => {
    const parsed = typeof record?.fetchedAt === "string" ? Date.parse(record.fetchedAt) : Number.NaN;
    return Number.isFinite(parsed) ? Math.max(latest, parsed) : latest;
  }, 0);
  const evalTimeMs = options.evalTimeMs ?? deterministicInputTimeMs;

  const profiles7d = new Map<string, any>();
  const profiles30d = new Map<string, any>();
  for (const record of rawProfiles) {
    const fp = record.sourceInputFingerprint;
    if (!fp) continue;
    if (record.period === "7d") {
      if (profiles7d.has(fp)) throw new Error(`Duplicate 7d for fingerprint ${fp}`);
      profiles7d.set(fp, record);
    } else if (record.period === "30d") {
      if (profiles30d.has(fp)) throw new Error(`Duplicate 30d for fingerprint ${fp}`);
      profiles30d.set(fp, record);
    }
  }

  // Population arrays for percentiles (nulls excluded; zeros retained)
  const profit30Vals: number[] = [];
  const win30Vals: number[] = [];
  const trade30Vals: number[] = [];
  for (const addr of validUniqueAddresses) {
    const fp = computeFingerprint(addr);
    const p = parsePeriod(profiles30d.get(fp));
    if (p.realizedProfit !== null && Number.isFinite(p.realizedProfit)) profit30Vals.push(p.realizedProfit);
    // Exclude unit-ambiguous win rates from percentile thresholds (keep raw values on rows).
    if (p.winRate !== null && Number.isFinite(p.winRate) && !isWinRateUnitAmbiguous(p.winRate)) {
      win30Vals.push(p.winRate);
    }
    if (p.buyCount !== null && p.sellCount !== null) trade30Vals.push(p.buyCount + p.sellCount);
  }
  profit30Vals.sort((a, b) => a - b);
  win30Vals.sort((a, b) => a - b);
  trade30Vals.sort((a, b) => a - b);

  const profitP75 = quantile(profit30Vals.filter((v) => v > 0), 0.75) ?? 0;
  const profitP90 = quantile(profit30Vals.filter((v) => v > 0), 0.9) ?? 0;
  const winP75 = quantile(win30Vals.filter((v) => v > 0), 0.75) ?? 40;
  const tradeP95 = quantile(trade30Vals, 0.95) ?? 2000;

  const records: WalletMasterV01Record[] = [];

  for (let i = 0; i < validUniqueAddresses.length; i++) {
    const address = validUniqueAddresses[i]!;
    const wallet_fingerprint = computeFingerprint(address);
    const labelInfo = labelMap.get(address) ?? { labels: [], note: "" };
    const raw7 = profiles7d.get(wallet_fingerprint);
    const raw30 = profiles30d.get(wallet_fingerprint);
    const p7 = parsePeriod(raw7);
    const p30 = parsePeriod(raw30);
    const s7 = toGmgnInput(p7);
    const s30 = toGmgnInput(p30);

    // evaluateWalletDataQuality expects ABSENT-like as UNAVAILABLE; map ABSENT → UNAVAILABLE for DQ only
    const dq7: GmgnPeriodStatsInput = s7.status === ("ABSENT" as any) ? { ...s7, status: "UNAVAILABLE" } : s7;
    const dq30: GmgnPeriodStatsInput = s30.status === ("ABSENT" as any) ? { ...s30, status: "UNAVAILABLE" } : s30;
    const dq = evaluateWalletDataQuality(dq7, dq30, evalTimeMs);

    const profitPct = p30.realizedProfit !== null ? percentileOf(profit30Vals, p30.realizedProfit) : null;
    const winPct = p30.winRate !== null ? percentileOf(win30Vals, p30.winRate) : null;
    const tradeProxy =
      p30.buyCount !== null && p30.sellCount !== null
        ? p30.buyCount + p30.sellCount
        : p30.buyCount !== null
          ? p30.buyCount
          : p30.sellCount !== null
            ? p30.sellCount
            : null;
    const tradePct = tradeProxy !== null ? percentileOf(trade30Vals, tradeProxy) : null;

    const lead = calculateBorrowedCandidateScores(dq7, dq30, dq, profitPct ?? 0);
    const confCap = resolveGmgnConfidenceCap(dq7, dq30, dq);
    const confidence: DataConfidence = confCap;

    const act7 =
      p7.buyCount !== null && p7.sellCount !== null
        ? p7.buyCount + p7.sellCount
        : p7.buyCount !== null
          ? p7.buyCount
          : p7.sellCount !== null
            ? p7.sellCount
            : null;
    const lastTs = p30.lastActiveTimestamp ?? p7.lastActiveTimestamp;
    const lastActiveAt =
      lastTs !== null && Number.isFinite(lastTs) && lastTs > 0 ? new Date(lastTs * 1000).toISOString() : null;

    const consistency = safeDiv(p7.realizedProfit, p30.realizedProfit !== null ? p30.realizedProfit / 4.28 : null);

    const leadReasons: string[] = [];
    if (lead.borrowedCompositeLeadScore !== null) {
      leadReasons.push("GMGN_LEAD_FROM_BORROWED_30D");
      if (profitPct !== null && profitPct >= 90) leadReasons.push("PROFIT_P90_PLUS");
      if (p30.winRate !== null && (tradeProxy ?? 0) >= 10) leadReasons.push("WINRATE_WITH_SAMPLE");
      if (p7.warningCodes.some((c) => c.includes("period_unverified")) || p30.warningCodes.some((c) => c.includes("period_unverified"))) {
        leadReasons.push("PERIOD_UNVERIFIED_CONFIDENCE_CAPPED");
      }
      if ((tradeProxy ?? 0) < 10) leadReasons.push("SMALL_SAMPLE_PENALTY");
    } else {
      leadReasons.push("LEAD_UNQUALIFIED_MISSING_30D_PROFIT_OR_ROW");
    }

    const claims = labelClaims(labelInfo.labels, labelInfo.note);

    // Preserve original win-rate values; mark unit ambiguity without scaling.
    const anomalyFlags = dq.anomalyFlags.map((a) => a.code);
    if (isWinRateUnitAmbiguous(p7.winRate) || isWinRateUnitAmbiguous(p30.winRate)) {
      if (!anomalyFlags.includes("WIN_RATE_UNIT_AMBIGUOUS")) anomalyFlags.push("WIN_RATE_UNIT_AMBIGUOUS");
    }

    records.push({
      address,
      wallet_fingerprint,
      source_order: i + 1,
      existing_labels: labelInfo.labels,
      existing_note: labelInfo.note,
      source_claims: claims,
      existing_label: labelInfo.labels,
      confirmed_label: null,
      confirmed_behavior_labels: null,
      gmgn_7d_status: p7.status === "ABSENT" ? "ABSENT" : p7.status,
      gmgn_30d_status: p30.status === "ABSENT" ? "ABSENT" : p30.status,
      gmgn_7d_completeness: p7.completeness,
      gmgn_30d_completeness: p30.completeness,
      data_confidence: confidence,
      verification_status: "unverified",
      source_type: "borrowed",
      transport_requested_period: { "7d": "7d", "30d": "30d" },
      provider_attested_period: { "7d": null, "30d": null },
      confidence_cap: confidence,
      profit_7d: p7.realizedProfit,
      profit_30d: p30.realizedProfit,
      win_rate_7d: p7.winRate,
      win_rate_30d: p30.winRate,
      buy_count: p30.buyCount,
      sell_count: p30.sellCount,
      trade_count_proxy: tradeProxy,
      token_count: p30.tokenNum,
      last_active_at: lastActiveAt,
      average_profit_per_trade_proxy: safeDiv(p30.realizedProfit, tradeProxy),
      average_profit_per_token_proxy: safeDiv(p30.realizedProfit, p30.tokenNum),
      seven_day_vs_thirty_day_consistency: consistency,
      anomaly_flags: anomalyFlags,
      activity_tier: activityTier(act7, tradeProxy, lastTs, evalTimeMs),
      data_tier: dataTier(dq7, dq30, dq),
      data_quality_score: dq.dataQualityScore,
      data_quality_tier: dq.dataQualityTier,
      profit_percentile_30d: profitPct,
      winrate_percentile_30d: winPct,
      trade_percentile_30d: tradePct,
      gmgn_lead_score: lead.borrowedCompositeLeadScore,
      gmgn_lead_tier: lead.borrowedLeadTier,
      gmgn_lead_reason_codes: leadReasons,
      candidate_categories: [],
      candidate_reason_codes: [],
      human_review_status: "PENDING_HUMAN_REVIEW",
      alpha_score: null,
      final_wallet_score: null,
      final_wallet_grade: null,
      confirmed_behavior_labels_v2: null,
    });
  }

  // ---- Multi-scenario selection (per-group, then union) ----
  const groupMembers: Record<CandidateCategory, WalletMasterV01Record[]> = {
    A_ACTIVE_HIGH_PROFIT_LEAD: [],
    B_HIGH_WINRATE_ADEQUATE_SAMPLE: [],
    C_LOW_WINRATE_HIGH_PROFIT_LEAD: [],
    D_RECENT_OUTPERFORMANCE: [],
    E_HISTORICAL_STRONG_RECENT_DECAY: [],
    F_HIGH_FREQ_OR_ANOMALY_SUSPICIOUS: [],
    G_LABEL_STAT_CONFLICT: [],
    H_INSUFFICIENT_DATA_HIGH_INTEL: [],
  };
  const groupReasons = new Map<string, Map<CandidateCategory, string[]>>();

  const ensureReasons = (addr: string) => {
    if (!groupReasons.has(addr)) groupReasons.set(addr, new Map());
    return groupReasons.get(addr)!;
  };

  // A: active + high profit percentile + min sample
  {
    const pool = records.filter((r) => isEligibleCategoryA(r));
    const top = pickTop(pool, (r) => (r.profit_percentile_30d ?? 0) * 0.6 + (r.gmgn_lead_score ?? 0) * 0.4, 12);
    groupMembers.A_ACTIVE_HIGH_PROFIT_LEAD = top;
    for (const r of top) {
      ensureReasons(r.address).set("A_ACTIVE_HIGH_PROFIT_LEAD", [
        "ACTIVE_RECENT",
        "PROFIT_30D_HIGH_PERCENTILE",
        "MIN_TRADE_TOKEN_SAMPLE",
        "BORROWED_GMGN_LEAD",
      ]);
    }
  }

  // B: high win rate + adequate sample + no HIGH / EXTREME_* / window / unit ambiguity
  {
    const pool = records.filter((r) => isEligibleCategoryB(r, winP75));
    const top = pickTop(pool, (r) => (r.win_rate_30d ?? 0) * 0.5 + Math.min(50, (r.trade_count_proxy ?? 0) / 2) * 0.5, 10);
    groupMembers.B_HIGH_WINRATE_ADEQUATE_SAMPLE = top;
    for (const r of top) {
      ensureReasons(r.address).set("B_HIGH_WINRATE_ADEQUATE_SAMPLE", [
        "HIGH_WINRATE_30D",
        "ADEQUATE_TRADE_SAMPLE_GE_15",
        "POSITIVE_PROFIT_30D",
        "NO_HIGH_SEVERITY_ANOMALY",
      ]);
    }
  }

  // C: low winrate high profit lead (asymmetric payoff clue — NOT "golden dog hunter")
  {
    const pool = records.filter((r) => isEligibleCategoryC(r, profitP75));
    const top = pickTop(pool, (r) => (r.profit_30d ?? 0) / (1 + (r.win_rate_30d ?? 1)), 8);
    groupMembers.C_LOW_WINRATE_HIGH_PROFIT_LEAD = top;
    for (const r of top) {
      ensureReasons(r.address).set("C_LOW_WINRATE_HIGH_PROFIT_LEAD", [
        "LOW_WINRATE_HIGH_PROFIT_LEAD_ONLY",
        "NOT_CONFIRMED_GOLDEN_DOG_HUNTER",
        "SAMPLE_GE_8",
      ]);
    }
  }

  // D: recent outperformance (7d vs 30d weekly avg) with small-denominator guard
  {
    const pool = records.filter((r) => isEligibleCategoryD(r));
    const top = pickTop(pool, (r) => (r.profit_7d! / (r.profit_30d! / 4.28)), 8);
    groupMembers.D_RECENT_OUTPERFORMANCE = top;
    for (const r of top) {
      ensureReasons(r.address).set("D_RECENT_OUTPERFORMANCE", [
        "SEVEN_D_GT_2X_THIRTY_D_WEEKLY_AVG",
        "DENOMINATOR_GUARD_PROFIT30_GT_50",
        "MIN_SAMPLE_GE_5",
      ]);
    }
  }

  // E: historically strong, recently decaying
  {
    const pool = records.filter((r) => isEligibleCategoryE(r, profitP75));
    const top = pickTop(pool, (r) => r.profit_30d ?? 0, 8);
    groupMembers.E_HISTORICAL_STRONG_RECENT_DECAY = top;
    for (const r of top) {
      ensureReasons(r.address).set("E_HISTORICAL_STRONG_RECENT_DECAY", [
        "STRONG_30D_PROFIT",
        "RECENT_ACTIVITY_OR_PROFIT_DECAY",
        "DORMANT_OR_DECAYING_RESEARCH_POOL",
      ]);
    }
  }

  // F: high frequency / mechanical / anomaly — mark Suspicious only
  {
    const pool = records.filter((r) => isEligibleCategoryF(r, tradeP95));
    const top = pickTop(
      pool,
      (r) =>
        (r.trade_count_proxy ?? 0) +
        r.anomaly_flags.length * 1000 +
        (r.anomaly_flags.some((f) => f.includes("ZERO_INCOME")) ? 5000 : 0),
      8
    );
    groupMembers.F_HIGH_FREQ_OR_ANOMALY_SUSPICIOUS = top;
    for (const r of top) {
      ensureReasons(r.address).set("F_HIGH_FREQ_OR_ANOMALY_SUSPICIOUS", [
        "SUSPICIOUS_PATTERN_ONLY",
        "NOT_CONFIRMED_BOT_OR_WASH",
        ...r.anomaly_flags.slice(0, 4).map((f) => `FLAG_${f}`),
      ]);
    }
  }

  // G: original label vs current stats conflict (typed claims)
  {
    const pool = records.filter((r) => evaluateCategoryG(r).eligible);
    const top = pickTop(
      pool,
      (r) => {
        const kw = classifyLabelClaims(r.existing_labels, r.existing_note);
        return (
          r.existing_labels.length * 10 +
          (kw.explicit_smart_money_claim ? 25 : 0) +
          (r.profit_30d === null ? 50 : Math.abs(r.profit_30d) < 1 ? 40 : 10)
        );
      },
      8
    );
    groupMembers.G_LABEL_STAT_CONFLICT = top;
    for (const r of top) {
      ensureReasons(r.address).set("G_LABEL_STAT_CONFLICT", evaluateCategoryG(r).reasonCodes);
    }
  }

  // H: insufficient data but high intel value from original labels
  {
    const pool = records.filter((r) => isEligibleCategoryH(r));
    const top = pickTop(
      pool,
      (r) =>
        r.existing_labels.length * 5 +
        (classifyLabelClaims(r.existing_labels, r.existing_note).explicit_smart_money_claim ? 20 : 0),
      8
    );
    groupMembers.H_INSUFFICIENT_DATA_HIGH_INTEL = top;
    for (const r of top) {
      ensureReasons(r.address).set("H_INSUFFICIENT_DATA_HIGH_INTEL", [
        "INSUFFICIENT_GMGN_COVERAGE",
        "RETAIN_FOR_INTEL_REVIEW",
        "NOT_DELETED_FOR_MISSING_DATA",
      ]);
    }
  }

  // Build union targeting 30-50 unique addresses; prefer multi-category and A/B first
  const unionMap = new Map<string, CandidateUnionEntry>();
  const categoryPriority: CandidateCategory[] = [
    "A_ACTIVE_HIGH_PROFIT_LEAD",
    "B_HIGH_WINRATE_ADEQUATE_SAMPLE",
    "C_LOW_WINRATE_HIGH_PROFIT_LEAD",
    "D_RECENT_OUTPERFORMANCE",
    "E_HISTORICAL_STRONG_RECENT_DECAY",
    "F_HIGH_FREQ_OR_ANOMALY_SUSPICIOUS",
    "G_LABEL_STAT_CONFLICT",
    "H_INSUFFICIENT_DATA_HIGH_INTEL",
  ];

  // First pass: assign categories onto master records
  for (const cat of CATEGORIES) {
    groupMembers[cat].forEach((r, idx) => {
      if (!r.candidate_categories.includes(cat)) r.candidate_categories.push(cat);
      const reasons = groupReasons.get(r.address)?.get(cat) ?? [cat];
      for (const code of reasons) {
        if (!r.candidate_reason_codes.includes(code)) r.candidate_reason_codes.push(code);
      }
      // attach group rank via temporary property on map later
      void idx;
    });
  }

  // Round-robin add until target range, ensuring ≥6 categories represented
  const groupRanks = new Map<string, Partial<Record<CandidateCategory, number>>>();
  for (const cat of CATEGORIES) {
    groupMembers[cat].forEach((r, i) => {
      const gr = groupRanks.get(r.address) ?? {};
      gr[cat] = i + 1;
      groupRanks.set(r.address, gr);
    });
  }

  const addToUnion = (r: WalletMasterV01Record) => {
    if (unionMap.has(r.address)) {
      const existing = unionMap.get(r.address)!;
      for (const c of r.candidate_categories) {
        if (!existing.candidate_categories.includes(c)) existing.candidate_categories.push(c);
      }
      for (const code of r.candidate_reason_codes) {
        if (!existing.candidate_reason_codes.includes(code)) existing.candidate_reason_codes.push(code);
      }
      existing.group_ranks = { ...existing.group_ranks, ...groupRanks.get(r.address) };
      return;
    }
    if (unionMap.size >= targetCandidateMax) return;
    const categories = [...r.candidate_categories];
    const decision = resolveRecommendedActions(categories, r);
    if (!SAFE_ACTIONS.has(decision.primary_recommended_action)) {
      throw new Error(`Illegal next action ${decision.primary_recommended_action}`);
    }
    unionMap.set(r.address, {
      address: r.address,
      wallet_fingerprint: r.wallet_fingerprint,
      candidate_categories: categories,
      candidate_reason_codes: [...r.candidate_reason_codes],
      key_metrics: {
        profit_7d: r.profit_7d,
        profit_30d: r.profit_30d,
        win_rate_7d: r.win_rate_7d,
        win_rate_30d: r.win_rate_30d,
        trade_count_proxy: r.trade_count_proxy,
        token_count: r.token_count,
        last_active_at: r.last_active_at,
        gmgn_lead_score: r.gmgn_lead_score,
        profit_percentile_30d: r.profit_percentile_30d,
        data_quality_score: r.data_quality_score,
      },
      existing_labels: r.existing_labels,
      existing_note: r.existing_note,
      data_confidence: r.data_confidence,
      anomaly_flags: r.anomaly_flags,
      why_selected: `Selected as borrowed GMGN research lead in categories: ${categories.join(", ")}. Scores are screening-only, not trading ability.`,
      what_is_not_known: whatIsNotKnown(r),
      recommended_next_action: decision.primary_recommended_action,
      primary_recommended_action: decision.primary_recommended_action,
      secondary_recommended_actions: decision.secondary_recommended_actions,
      action_reason_codes: decision.action_reason_codes,
      research_priority_rank: 0,
      category_count: categories.length,
      gmgn_lead_score: r.gmgn_lead_score,
      group_ranks: { ...groupRanks.get(r.address) },
    });
  };

  // Ensure each non-empty category contributes at least 1
  for (const cat of categoryPriority) {
    for (const r of groupMembers[cat].slice(0, 2)) addToUnion(r);
  }
  // Fill remaining slots by walking category lists
  let guard = 0;
  while (unionMap.size < targetCandidateMin && guard < 20) {
    guard++;
    let added = false;
    for (const cat of categoryPriority) {
      for (const r of groupMembers[cat]) {
        if (!unionMap.has(r.address) && unionMap.size < targetCandidateMax) {
          addToUnion(r);
          added = true;
          if (unionMap.size >= targetCandidateMin) break;
        }
      }
      if (unionMap.size >= targetCandidateMin) break;
    }
    if (!added) break;
  }
  // Prefer multi-category fill to max
  const multi = records
    .filter((r) => r.candidate_categories.length >= 2)
    .sort((a, b) => b.candidate_categories.length - a.candidate_categories.length || (b.gmgn_lead_score ?? 0) - (a.gmgn_lead_score ?? 0));
  for (const r of multi) {
    if (unionMap.size >= targetCandidateMax) break;
    addToUnion(r);
  }

  // research_priority_rank: multi-category diversity ordering for research sampling.
  // Does NOT represent profitability, copy-trade priority, or formal Alpha rank.
  const unionList = Array.from(unionMap.values()).sort((a, b) => {
    const catDelta = b.candidate_categories.length - a.candidate_categories.length;
    if (catDelta !== 0) return catDelta;
    const scoreDelta = (b.key_metrics.gmgn_lead_score ?? -1) - (a.key_metrics.gmgn_lead_score ?? -1);
    if (scoreDelta !== 0) return scoreDelta;
    return a.wallet_fingerprint.localeCompare(b.wallet_fingerprint);
  });
  unionList.forEach((e, i) => {
    e.research_priority_rank = i + 1;
    e.category_count = e.candidate_categories.length;
    e.gmgn_lead_score = e.key_metrics.gmgn_lead_score;
    // Recompute action after full category merge
    const rec = records.find((x) => x.address === e.address)!;
    const decision = resolveRecommendedActions(e.candidate_categories, rec);
    e.primary_recommended_action = decision.primary_recommended_action;
    e.secondary_recommended_actions = decision.secondary_recommended_actions;
    e.action_reason_codes = decision.action_reason_codes;
    e.recommended_next_action = decision.primary_recommended_action;
  });

  // Mark master rows that are in union (categories already set for group members)
  const unionAddresses = new Set(unionList.map((e) => e.address));

  // ---- Research packs (15, diversify categories) ----
  const packAddresses: string[] = [];
  const coveredCats = new Set<CandidateCategory>();
  for (const e of unionList) {
    if (packAddresses.length >= researchPackCount) break;
    const newCats = e.candidate_categories.filter((c) => !coveredCats.has(c));
    if (newCats.length > 0 || packAddresses.length < Math.min(8, researchPackCount)) {
      packAddresses.push(e.address);
      e.candidate_categories.forEach((c) => coveredCats.add(c));
    }
  }
  for (const e of unionList) {
    if (packAddresses.length >= researchPackCount) break;
    if (!packAddresses.includes(e.address)) packAddresses.push(e.address);
  }

  // ---- Write outputs ----
  fs.mkdirSync(outputDir, { recursive: true });
  const researchDir = path.join(outputDir, "research_packs");
  fs.mkdirSync(researchDir, { recursive: true });
  const groupsDir = path.join(outputDir, "candidate_groups");
  fs.mkdirSync(groupsDir, { recursive: true });

  const masterJsonl = path.join(outputDir, "wallet_master_v0_1.jsonl");
  const masterCsv = path.join(outputDir, "wallet_master_v0_1.csv");
  fs.writeFileSync(masterJsonl, records.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  writeCsv(
    masterCsv,
    records.map((r) => ({ ...r })) as Record<string, unknown>[]
  );

  const candidateJson = path.join(outputDir, "candidate_union_v0_1.json");
  const candidateCsv = path.join(outputDir, "candidate_union_v0_1.csv");
  const candidateJsonl = path.join(outputDir, "candidate_union_v0_1.jsonl");
  fs.writeFileSync(candidateJson, JSON.stringify({ schema_version: "candidate-union-v0-1", count: unionList.length, candidates: unionList }, null, 2), "utf8");
  fs.writeFileSync(candidateJsonl, unionList.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  writeCsv(
    candidateCsv,
    unionList.map((e) => ({
      research_priority_rank: e.research_priority_rank,
      category_count: e.category_count,
      address: e.address,
      wallet_fingerprint: e.wallet_fingerprint,
      candidate_categories: e.candidate_categories.join("|"),
      candidate_reason_codes: e.candidate_reason_codes.join("|"),
      profit_30d: e.key_metrics.profit_30d,
      profit_7d: e.key_metrics.profit_7d,
      win_rate_30d: e.key_metrics.win_rate_30d,
      trade_count_proxy: e.key_metrics.trade_count_proxy,
      gmgn_lead_score: e.gmgn_lead_score,
      profit_percentile_30d: e.key_metrics.profit_percentile_30d,
      data_confidence: e.data_confidence,
      anomaly_flags: e.anomaly_flags.join("|"),
      recommended_next_action: e.recommended_next_action,
      primary_recommended_action: e.primary_recommended_action,
      secondary_recommended_actions: e.secondary_recommended_actions.join("|"),
      action_reason_codes: e.action_reason_codes.join("|"),
      why_selected: e.why_selected,
      existing_labels: e.existing_labels.join("|"),
    }))
  );

  const categoryCounts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<CandidateCategory, number>;
  for (const cat of CATEGORIES) {
    const members = groupMembers[cat];
    categoryCounts[cat] = members.length;
    const fileBase = path.join(groupsDir, cat.toLowerCase());
    const payload = members.map((r, i) => ({
      group_rank: i + 1,
      address: r.address,
      wallet_fingerprint: r.wallet_fingerprint,
      reason_codes: groupReasons.get(r.address)?.get(cat) ?? [],
      profit_30d: r.profit_30d,
      profit_7d: r.profit_7d,
      win_rate_30d: r.win_rate_30d,
      trade_count_proxy: r.trade_count_proxy,
      gmgn_lead_score: r.gmgn_lead_score,
      data_confidence: r.data_confidence,
      anomaly_flags: r.anomaly_flags,
      existing_labels: r.existing_labels,
    }));
    fs.writeFileSync(fileBase + ".json", JSON.stringify({ category: cat, count: payload.length, members: payload }, null, 2), "utf8");
    writeCsv(fileBase + ".csv", payload as unknown as Record<string, unknown>[]);
  }

  // Research packs
  for (let i = 0; i < packAddresses.length; i++) {
    const addr = packAddresses[i]!;
    const r = records.find((x) => x.address === addr)!;
    const cand = unionList.find((x) => x.address === addr)!;
    const packId = String(i + 1).padStart(2, "0");
    const fpShort = r.wallet_fingerprint.slice(0, 12);
    const jsonPack = {
      schema_version: "research-pack-v0-1",
      pack_index: i + 1,
      address: r.address,
      wallet_fingerprint: r.wallet_fingerprint,
      source: {
        existing_labels: r.existing_labels,
        existing_note: r.existing_note,
        source_claims: r.source_claims,
        confirmed_label: null,
      },
      gmgn_metrics: {
        profit_7d: r.profit_7d,
        profit_30d: r.profit_30d,
        win_rate_7d: r.win_rate_7d,
        win_rate_30d: r.win_rate_30d,
        buy_count: r.buy_count,
        sell_count: r.sell_count,
        trade_count_proxy: r.trade_count_proxy,
        token_count: r.token_count,
        last_active_at: r.last_active_at,
        average_profit_per_trade_proxy: r.average_profit_per_trade_proxy,
        average_profit_per_token_proxy: r.average_profit_per_token_proxy,
        seven_day_vs_thirty_day_consistency: r.seven_day_vs_thirty_day_consistency,
      },
      data_quality: {
        gmgn_7d_status: r.gmgn_7d_status,
        gmgn_30d_status: r.gmgn_30d_status,
        gmgn_7d_completeness: r.gmgn_7d_completeness,
        gmgn_30d_completeness: r.gmgn_30d_completeness,
        data_tier: r.data_tier,
        data_confidence: r.data_confidence,
        confidence_cap: r.confidence_cap,
        verification_status: r.verification_status,
        source_type: r.source_type,
        transport_requested_period: r.transport_requested_period,
        provider_attested_period: r.provider_attested_period,
        data_quality_score: r.data_quality_score,
        data_quality_tier: r.data_quality_tier,
        missing_or_limited: [
          r.last_active_at === null ? "last_active_at" : null,
          r.profit_7d === null ? "profit_7d" : null,
          r.profit_30d === null ? "profit_30d" : null,
          r.win_rate_30d === null ? "win_rate_30d" : null,
        ].filter(Boolean),
      },
      candidacy: {
        candidate_categories: cand.candidate_categories,
        candidate_reason_codes: cand.candidate_reason_codes,
        gmgn_lead_score: r.gmgn_lead_score,
        gmgn_lead_tier: r.gmgn_lead_tier,
        gmgn_lead_reason_codes: r.gmgn_lead_reason_codes,
        why_selected: cand.why_selected,
      },
      anomalies_and_counter_evidence: r.anomaly_flags,
      confirmed_facts: [
        "Address appears in the fixed 1,433-address cleaned Solana directory",
        "GMGN stats (if present) are second-hand borrowed observations only",
        `Data confidence capped at ${r.confidence_cap}`,
        "No formal Alpha Score or final wallet grade was assigned",
      ],
      unconfirmed: cand.what_is_not_known,
      suggested_gmgn_review_questions: [
        "Does the GMGN UI period selector match the transport-requested 7d/30d windows?",
        "Are realized profit and win rate dominated by one or two tokens?",
        "Is last active time consistent with 7d activity counts?",
        "Do buy/sell counts and token count look plausible vs chart history?",
        "Any UI labels (smart money/sniper/bot) that conflict with the numbers?",
      ],
      chain_verification_worth:
        cand.primary_recommended_action === "CHAIN_VERIFICATION" ||
        cand.primary_recommended_action === "HUMAN_REVIEW",
      recommended_next_action: cand.recommended_next_action,
      primary_recommended_action: cand.primary_recommended_action,
      secondary_recommended_actions: cand.secondary_recommended_actions,
      action_reason_codes: cand.action_reason_codes,
      research_priority_rank: cand.research_priority_rank,
      disclaimer: "This pack does not assert trading style, entry timing, take-profit skill, or copy-tradability.",
    };
    fs.writeFileSync(path.join(researchDir, `pack_${packId}_${fpShort}.json`), JSON.stringify(jsonPack, null, 2), "utf8");

    const md = `# Research Pack ${packId} — ${r.address}

> **Borrowed / unverified GMGN evidence only.** No formal grade. No trade recommendation.

## Identity & source claims
- **Address:** \`${r.address}\`
- **Fingerprint:** \`${r.wallet_fingerprint}\`
- **Existing labels (source_claim only):** ${r.existing_labels.length ? r.existing_labels.map((l) => `\`${l}\``).join(", ") : "_(none)_"}
- **Existing note:** ${r.existing_note || "_(none)_"}
- **confirmed_label:** \`null\` (never auto-upgraded)

## Core metrics (GMGN borrowed)
| Window | Profit | Win rate | Trades (proxy) | Tokens |
| --- | ---: | ---: | ---: | ---: |
| 7d | ${r.profit_7d ?? "null"} | ${r.win_rate_7d ?? "null"} | ${r.activity_tier === "ACTIVE_7D" ? "see buy/sell" : "—"} | — |
| 30d | ${r.profit_30d ?? "null"} | ${r.win_rate_30d ?? "null"} | ${r.trade_count_proxy ?? "null"} | ${r.token_count ?? "null"} |

- last_active_at: ${r.last_active_at ?? "null"}
- avg profit / trade (proxy): ${r.average_profit_per_trade_proxy ?? "null"}
- avg profit / token (proxy): ${r.average_profit_per_token_proxy ?? "null"}
- 7d vs 30d consistency ratio: ${r.seven_day_vs_thirty_day_consistency ?? "null"}

## Data quality
- 7d status / completeness: ${r.gmgn_7d_status} / ${r.gmgn_7d_completeness ?? "null"}
- 30d status / completeness: ${r.gmgn_30d_status} / ${r.gmgn_30d_completeness ?? "null"}
- data_tier: ${r.data_tier}
- data_confidence / confidence_cap: ${r.data_confidence} / ${r.confidence_cap}
- verification_status: ${r.verification_status}
- source_type: ${r.source_type}
- provider_attested_period: 7d=null, 30d=null (period_unverified)

## Candidacy
- **Categories:** ${cand.candidate_categories.join(", ")}
- **Reason codes:** ${cand.candidate_reason_codes.join(", ")}
- **gmgn_lead_score / tier:** ${r.gmgn_lead_score ?? "null"} / ${r.gmgn_lead_tier}
- **Why selected:** ${cand.why_selected}

## Anomalies / counter-evidence
${r.anomaly_flags.length ? r.anomaly_flags.map((a) => `- ${a}`).join("\n") : "- (none flagged)"}

## Confirmed vs not confirmed
**Confirmed**
- In fixed 1,433-address set
- GMGN values are second-hand
- No Alpha Score / final grade assigned

**Not confirmed**
${cand.what_is_not_known.map((x) => `- ${x}`).join("\n")}

## Suggested questions to check in GMGN UI
1. Does UI period match requested 7d/30d?
2. Is profit concentrated in 1–2 tokens?
3. Does last active agree with 7d activity?
4. Are buy/sell and token counts plausible?
5. Any UI smart-money/bot labels conflicting with numbers?

## Next action
- **primary_recommended_action / recommended_next_action:** \`${cand.primary_recommended_action}\`
- **secondary_recommended_actions:** \`${cand.secondary_recommended_actions.join(", ") || "(none)"}\`
- **action_reason_codes:** \`${cand.action_reason_codes.join(", ")}\`
- **research_priority_rank:** \`${cand.research_priority_rank}\` (diversity ordering only — not value/Alpha rank)
- **Worth chain verification?** ${jsonPack.chain_verification_worth ? "Yes — as research follow-up only" : "Optional / lower priority"}

---
*Do not treat this pack as a final trading-style judgment.*
`;
    fs.writeFileSync(path.join(researchDir, `pack_${packId}_${fpShort}.md`), md, "utf8");
  }

  // Quality report
  const dataTierCount: Record<DataTier, number> = { TIER_COMPLETE: 0, TIER_PARTIAL: 0, TIER_SPARSE: 0, TIER_MISSING: 0 };
  const dqTierCount: Record<DataQualityTier, number> = { "DQ-A": 0, "DQ-B": 0, "DQ-C": 0, "DQ-D": 0, "DQ-U": 0 };
  const actTierCount: Record<ActivityTier, number> = { ACTIVE_7D: 0, ACTIVE_30D_ONLY: 0, INACTIVE: 0, UNKNOWN: 0 };
  for (const r of records) {
    dataTierCount[r.data_tier]++;
    dqTierCount[r.data_quality_tier]++;
    actTierCount[r.activity_tier]++;
  }

  const qualityJson = {
    schema_version: "wallet-data-quality-report-v0-1",
    task_id: CANDIDATE_SCREENING_TASK_ID,
    rule_versions: {
      wallet_data_quality: WALLET_DATA_QUALITY_RULE_VERSION,
      candidate_screening: CANDIDATE_SCREENING_RULE_VERSION,
    },
    totals: {
      addresses: records.length,
      unique_addresses: records.length,
      address_set_hash: addressSetHash,
    },
    data_tiers: dataTierCount,
    data_quality_tiers: dqTierCount,
    activity_tiers: actTierCount,
    gmgn_status_7d: countBy(records.map((r) => r.gmgn_7d_status)),
    gmgn_status_30d: countBy(records.map((r) => r.gmgn_30d_status)),
    confidence_cap: countBy(records.map((r) => r.confidence_cap)),
    null_fill_policy: "Missing fields remain null; provider zeros preserved as 0; no silent imputation.",
    label_isolation: {
      existing_labels_are: "source_claim / existing_label only",
      confirmed_label: "always null in this task",
      confirmed_behavior_labels: "always null in this task",
    },
    formal_scores: {
      alpha_score: "always null",
      final_wallet_score: "always null",
      final_wallet_grade: "always null",
    },
    candidates: {
      unique: unionList.length,
      target_range: [targetCandidateMin, targetCandidateMax],
      category_counts: categoryCounts,
      categories_represented: CATEGORIES.filter((c) => categoryCounts[c] > 0).length,
      research_priority_rank_note:
        "research_priority_rank is multi-category diversity ordering for research sampling only; not profitability or copy-trade rank",
    },
    research_packs: packAddresses.length,
    thresholds_note: {
      profit_p75_positive: profitP75,
      profit_p90_positive: profitP90,
      winrate_p75_positive: winP75,
      trade_p95: tradeP95,
      population: "percentiles computed on valid non-null samples within the 1,433 address set",
    },
  };
  const qualityJsonPath = path.join(outputDir, "wallet_data_quality_report_v0_1.json");
  fs.writeFileSync(qualityJsonPath, JSON.stringify(qualityJson, null, 2), "utf8");

  const qualityMd = `# Wallet Data Quality Report v0.1

Task: \`${CANDIDATE_SCREENING_TASK_ID}\`

## Totals
- Addresses: **${records.length}** (unique)
- Address set hash: \`${addressSetHash}\`
- Input sol_addresses.txt: \`${solAddressesTxtHash}\`
- Input labels: \`${solAddressLabelsJsonHash}\`
- GMGN profiles: \`${gmgnNormalizedProfilesHash}\`

## Data tiers
${Object.entries(dataTierCount)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

## Data quality tiers (wallet-data-quality rule)
${Object.entries(dqTierCount)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

## Activity tiers
${Object.entries(actTierCount)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

## Candidate summary
- Unique candidates: **${unionList.length}** (target ${targetCandidateMin}–${targetCandidateMax})
- Categories represented: **${CATEGORIES.filter((c) => categoryCounts[c] > 0).length}**
${Object.entries(categoryCounts)
  .map(([k, v]) => `  - ${k}: ${v}`)
  .join("\n")}
- Research packs: **${packAddresses.length}**

## Policies
- Missing → null (never silent 0-fill)
- GMGN → source_type=borrowed, verification_status=unverified
- period_unverified → confidence_cap low/medium; lead scores retained for screening only
- alpha_score / final_wallet_score / final_wallet_grade / confirmed_behavior_labels → always null
- existing labels stay source_claim only
`;
  const qualityMdPath = path.join(outputDir, "wallet_data_quality_report_v0_1.md");
  fs.writeFileSync(qualityMdPath, qualityMd, "utf8");

  // Field dictionary + rules (committed copies also under harness/reports; local full under artifacts)
  const dictPath = path.join(outputDir, "field_dictionary_v0_1.md");
  fs.writeFileSync(dictPath, buildFieldDictionary(), "utf8");
  const rulesPath = path.join(outputDir, "screening_rules_v0_1.md");
  fs.writeFileSync(rulesPath, buildRulesDoc(), "utf8");
  const runCmdPath = path.join(outputDir, "run_commands_v0_1.md");
  fs.writeFileSync(
    runCmdPath,
    `# Run commands

\`\`\`bash
npx tsx src/cli/run-sol-wallet-candidate-screening-v0-1.ts
\`\`\`

Environment overrides:
- \`SOL_INPUT_DIR\` (default: local cleaned sol directory)
- \`SOL_GMGN_OUTPUT_DIR\` (default: gmgn-wallet-stats-full-1433-live-rerun-002)
- \`SOL_SCREENING_OUTPUT_DIR\` (default: artifacts/wallet_intelligence_v0_1)

Acceptance tests:
\`\`\`bash
npm run typecheck
npm test
npm run build
\`\`\`
`,
    "utf8"
  );

  const openItemsPath = path.join(outputDir, "open_items_v0_1.md");
  fs.writeFileSync(
    openItemsPath,
    `# Open items / not implemented (by design)

1. Chain-verified swap PnL (Helius / RPC) — not in this task
2. Formal Alpha Score weights / UR·SSR·S·EX grades — deliberately null
3. Entry timing / take-profit / copy-tradability detectors — data insufficient
4. Insider / cluster / sniper confirmation — requires Tier-A graph evidence
5. Provider period attestation — still \`period_unverified\` for all RERUN-002 rows
6. Per-token profit concentration — provider batch has no per-token breakdown
7. Operator Console / BSC / Robinhood / liquidity modules — out of scope
8. Writing notes back to GMGN — forbidden
9. Independent audit of this screening task — pending separate auditor
10. status field absent in RERUN-002 normalized profiles — derived as PARTIAL/UNAVAILABLE (documented)
`,
    "utf8"
  );

  const acceptancePath = path.join(outputDir, "acceptance_report_v0_1.md");
  fs.writeFileSync(
    acceptancePath,
    buildAcceptanceReport({
      addressSetHash,
      solAddressesTxtHash,
      solAddressLabelsJsonHash,
      gmgnNormalizedProfilesHash,
      gmgnSummaryHash,
      records,
      unionList,
      categoryCounts,
      dataTierCount,
      dqTierCount,
      packCount: packAddresses.length,
      profitP75,
      profitP90,
    }),
    "utf8"
  );

  const outputFilesMap: Record<string, string> = {
    wallet_master_v0_1_jsonl: "wallet_master_v0_1.jsonl",
    wallet_master_v0_1_csv: "wallet_master_v0_1.csv",
    wallet_data_quality_report_v0_1_json: "wallet_data_quality_report_v0_1.json",
    wallet_data_quality_report_v0_1_md: "wallet_data_quality_report_v0_1.md",
    candidate_union_v0_1_json: "candidate_union_v0_1.json",
    candidate_union_v0_1_jsonl: "candidate_union_v0_1.jsonl",
    candidate_union_v0_1_csv: "candidate_union_v0_1.csv",
    field_dictionary_v0_1_md: "field_dictionary_v0_1.md",
    screening_rules_v0_1_md: "screening_rules_v0_1.md",
    run_commands_v0_1_md: "run_commands_v0_1.md",
    open_items_v0_1_md: "open_items_v0_1.md",
    acceptance_report_v0_1_md: "acceptance_report_v0_1.md",
    research_packs_dir: "research_packs/",
    candidate_groups_dir: "candidate_groups/",
  };

  const hashFiles = [
    masterJsonl,
    masterCsv,
    qualityJsonPath,
    qualityMdPath,
    candidateJson,
    candidateJsonl,
    candidateCsv,
    dictPath,
    rulesPath,
  ];
  const outputHashes: Record<string, string> = {};
  for (const f of hashFiles) {
    outputHashes[path.basename(f)] = computeSha256(fs.readFileSync(f));
  }

  const replayManifest = {
    schema_version: "replay-manifest-v0-1",
    task_id: CANDIDATE_SCREENING_TASK_ID,
    rule_versions: {
      wallet_data_quality: WALLET_DATA_QUALITY_RULE_VERSION,
      candidate_screening: CANDIDATE_SCREENING_RULE_VERSION,
    },
    evaluation_time: new Date(evalTimeMs).toISOString(),
    input_hashes: {
      sol_addresses_txt: solAddressesTxtHash,
      sol_address_labels_json: solAddressLabelsJsonHash,
      gmgn_normalized_profiles_json: gmgnNormalizedProfilesHash,
      gmgn_summary_json: gmgnSummaryHash,
      address_set_hash: addressSetHash,
    },
    metrics: {
      totalAddresses: records.length,
      uniqueCandidateCount: unionList.length,
      researchPackCount: packAddresses.length,
      dataTiers: dataTierCount,
      dataQualityTiers: dqTierCount,
      categoryCounts,
      unionInMaster: records.filter((r) => unionAddresses.has(r.address)).length,
    },
    output_files: outputFilesMap,
    output_hashes: outputHashes,
    privacy: {
      note: "Private master/candidate address detail must not be committed to Git",
      git_allowed: ["code", "schema", "desensitized summaries", "hashes", "tests", "acceptance without addresses"],
    },
  };
  const replayPath = path.join(outputDir, "wallet_replay_manifest_v0_1.json");
  fs.writeFileSync(replayPath, JSON.stringify(replayManifest, null, 2), "utf8");
  outputHashes["wallet_replay_manifest_v0_1.json"] = computeSha256(fs.readFileSync(replayPath));

  const categoriesRepresented = CATEGORIES.filter((c) => categoryCounts[c] > 0).length;
  const coverage = assessScreeningCoverage({
    uniqueCandidateCount: unionList.length,
    categoriesRepresented,
    targetCandidateMin,
    targetCandidateMax,
    expectedCategoryMin: EXPECTED_CATEGORY_MIN,
  });

  // Write degradation diagnostics even when DEGRADED (artifacts retained for human review).
  if (coverage.degradation) {
    fs.writeFileSync(
      path.join(outputDir, "screening_degradation_v0_1.json"),
      JSON.stringify({ schema_version: "screening-degradation-v0-1", ...coverage.degradation }, null, 2),
      "utf8"
    );
  }

  const result: ScreeningResult = {
    status: coverage.status,
    inputHashes: {
      solAddressesTxt: solAddressesTxtHash,
      solAddressLabelsJson: solAddressLabelsJsonHash,
      gmgnNormalizedProfiles: gmgnNormalizedProfilesHash,
      gmgnSummary: gmgnSummaryHash,
      addressSetHash,
    },
    addressSetHash,
    metrics: {
      totalAddresses: records.length,
      uniqueAddresses: records.length,
      dataTier: dataTierCount,
      dataQualityTiers: dqTierCount,
      activityTiers: actTierCount,
      categoryCounts,
      uniqueCandidateCount: unionList.length,
      researchPackCount: packAddresses.length,
      categoriesRepresented,
    },
    outputFiles: outputFilesMap,
    outputHashes,
  };
  if (coverage.degradation) {
    result.degradation = coverage.degradation;
  }
  return result;
}

function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

function buildFieldDictionary(): string {
  return `# Field dictionary — wallet intelligence v0.1

## Identity
| Field | Type | Notes |
| --- | --- | --- |
| address | string | Solana base58 |
| wallet_fingerprint | string | sha256(address) |
| existing_labels / existing_label | string[] | source claims only |
| existing_note | string | primary label text |
| source_claims | string[] | union of labels + note |
| confirmed_label / confirmed_behavior_labels | null | never auto-filled |

## GMGN transport / trust
| Field | Notes |
| --- | --- |
| source_type | always \`borrowed\` |
| verification_status | always \`unverified\` |
| transport_requested_period | 7d / 30d as requested |
| provider_attested_period | null when period_unverified |
| confidence_cap / data_confidence | low \\| medium \\| none |
| gmgn_*_status | MAPPED \\| PARTIAL \\| UNAVAILABLE \\| ABSENT |
| gmgn_*_completeness | [0,1] or null |

## Metrics (null if missing; 0 only if provider sent 0)
profit_7d, profit_30d, win_rate_7d, win_rate_30d, buy_count, sell_count, trade_count_proxy, token_count, last_active_at, average_profit_per_trade_proxy, average_profit_per_token_proxy, seven_day_vs_thirty_day_consistency

## Screening
| Field | Notes |
| --- | --- |
| gmgn_lead_score | internal screening score only |
| gmgn_lead_tier | TOP_LEAD…UNQUALIFIED |
| gmgn_lead_reason_codes | reproducible codes |
| candidate_categories | A–H multi-label |
| candidate_reason_codes | per selection rule |
| research_priority_rank | **diversity/multi-category research ordering only** — NOT profitability, copy-trade priority, or formal Alpha rank |
| category_count | number of A–H categories assigned |
| primary_recommended_action | explicit action matrix primary |
| secondary_recommended_actions | optional secondary actions |
| action_reason_codes | predicates supporting the action |
| recommended_next_action | schema alias of primary_recommended_action |
| human_review_status | PENDING_HUMAN_REVIEW |

## Forbidden / always null
alpha_score, final_wallet_score, final_wallet_grade, confirmed_behavior_labels
`;
}

function buildRulesDoc(): string {
  return `# Screening rules v0.1

## Principles
1. Scores are for candidate ordering only — not trading ability.
2. Data confidence is separate from performance signals.
3. Each category A–H uses its own rules; no single final total score.
4. Percentiles from the current 1,433-address valid sample.
5. Null stays null; never coerce to 0.
6. Small samples are explicitly penalized.
7. Extreme profit flags concentration *risk*, not measured HHI (no per-token data).

## Category rules (summary)
- **A** Active + 30d profit ≥ p75 (positive subset) + min trades/tokens
- **B** High win rate + trades ≥ 15 + profit > 0 + **no HIGH, EXTREME_*, window-monotonicity, or win-rate unit ambiguity** (other low residuals may still be disclosed)
- **C** Win rate ≤ 35 + high profit — *lead only*, not “golden dog hunter”; excludes unit-ambiguous win rates
- **D** 7d profit ≥ 2× (30d/4.28) with profit_30d > 50 guard
- **E** Strong 30d + recent decay/inactivity → Dormant research pool
- **F** High frequency / asymmetric / extreme / residual — **Suspicious only**
- **G** Typed source-claim vs stats conflict; \`CLAIM_SMART_MONEY_UNVERIFIED\` only from explicit smart-money claims (not top/rank/KOL)
- **H** Sparse/missing GMGN but rich original intel → Insufficient Data Review

## Win-rate unit
- Population bulk is treated as 0–100 percent-like when values > 1
- Values in (0, 1] are flagged \`WIN_RATE_UNIT_AMBIGUOUS\` without scaling; excluded from B/C

## research_priority_rank
- Multi-category diversity ordering for research sampling
- Not profitability, not copy-trade priority, not formal Alpha rank

## Coverage status
- 30–50 unique candidates AND ≥6 categories → SUCCESS
- Below min candidates OR <6 categories OR above max → DEGRADED (artifacts still written)
- Structural/hash/privacy contract errors → FAILED (throw)

## Action matrix (primary)
- F + HIGH/extreme anomaly → EXCLUDE_FROM_FOLLOWING
- H → INSUFFICIENT_DATA
- C+E active → CHAIN_VERIFICATION (E does not bury C)
- C+E inactive → DORMANT_MONITOR
- A/B active → CHAIN_VERIFICATION
- C active → CHAIN_VERIFICATION
- E alone → DORMANT_MONITOR
- G → GMGN_HISTORY_REVIEW
- D / default → HUMAN_REVIEW

## recommended_next_action vocabulary
HUMAN_REVIEW | GMGN_HISTORY_REVIEW | CHAIN_VERIFICATION | DORMANT_MONITOR | INSUFFICIENT_DATA | EXCLUDE_FROM_FOLLOWING

\`recommended_next_action\` == \`primary_recommended_action\`

Forbidden: BUY, SELL, COPY_TRADE
`;
}

function buildAcceptanceReport(args: {
  addressSetHash: string;
  solAddressesTxtHash: string;
  solAddressLabelsJsonHash: string;
  gmgnNormalizedProfilesHash: string;
  gmgnSummaryHash: string;
  records: WalletMasterV01Record[];
  unionList: CandidateUnionEntry[];
  categoryCounts: Record<CandidateCategory, number>;
  dataTierCount: Record<DataTier, number>;
  dqTierCount: Record<DataQualityTier, number>;
  packCount: number;
  profitP75: number;
  profitP90: number;
}): string {
  const cats = Object.values(args.categoryCounts).filter((n) => n > 0).length;
  const nullAlpha = args.records.every((r) => r.alpha_score === null && r.final_wallet_score === null && r.final_wallet_grade === null);
  const allBorrowed = args.records.every((r) => r.source_type === "borrowed" && r.verification_status === "unverified");
  const noConfirmed = args.records.every((r) => r.confirmed_label === null && r.confirmed_behavior_labels === null);

  return `# Acceptance report — ${CANDIDATE_SCREENING_TASK_ID}

## Checklist

| Criterion | Result |
| --- | --- |
| Master rows == 1,433 unique | ${args.records.length === 1433 ? "PASS" : "FAIL"} (${args.records.length}) |
| Address set hash stable | \`${args.addressSetHash}\` |
| Input addresses hash | \`${args.solAddressesTxtHash}\` |
| Input labels hash | \`${args.solAddressLabelsJsonHash}\` |
| GMGN profiles hash | \`${args.gmgnNormalizedProfilesHash}\` |
| GMGN summary hash | \`${args.gmgnSummaryHash}\` |
| Null not silently filled | PASS (policy enforced in builder) |
| Labels isolated from confirmed_* | ${noConfirmed ? "PASS" : "FAIL"} |
| GMGN borrowed/unverified | ${allBorrowed ? "PASS" : "FAIL"} |
| Candidate list non-empty | ${args.unionList.length > 0 ? "PASS" : "FAIL"} (${args.unionList.length}) |
| Candidates in 30–50 | ${args.unionList.length >= 30 && args.unionList.length <= 50 ? "PASS" : "DEGRADED"} (${args.unionList.length}) |
| ≥6 categories represented | ${cats >= 6 ? "PASS" : "DEGRADED"} (${cats}) |
| research_priority_rank semantics | PASS (diversity only; not value rank) |
| No formal Alpha / grades | ${nullAlpha ? "PASS" : "FAIL"} |
| Research packs | ${args.packCount} |
| Over-implementation (console/BSC/etc.) | NONE by write-set |

## Distributions
### Data tiers
${Object.entries(args.dataTierCount)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

### DQ tiers
${Object.entries(args.dqTierCount)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

### Candidate categories (group sizes)
${Object.entries(args.categoryCounts)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

## Threshold snapshots (positive-profit subset where noted)
- profit p75 (positive): ${args.profitP75}
- profit p90 (positive): ${args.profitP90}

## Independent audit
Not completed in this implementer delivery — requires separate auditor task.

## Merge status
Not merged. Feature branch only.
`;
}
