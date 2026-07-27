import { createHash } from "node:crypto";
import type {
  AlphaPenalty,
  AlphaPosition,
  AlphaScoreResult,
  AlphaTier,
  MarketRegime,
} from "../types.js";

/** Dual-axis rule version (methods doc §1.7). */
export const ALPHA_SCORE_RULE_VERSION = "alpha-score-v1";
export const MARKET_BASELINE_VERSION_PREFIX = "market-baseline@";

export interface AlphaScoreParams {
  halfLifeDays: number;
  wEvalDays: number;
  minDistinctTokens: number;
  minClosedPositions: number;
  minHistorySpanDays: number;
  minUniverseTokens: number;
  weights: { excess: number; winrate: number; profitFactor: number; persist: number };
  luckMinTokens: number;
  luckFloor: number;
  hhiSoft: number;
  superFloor: number;
  clusterDiscount: number;
  botDiscount: number;
  borrowedConfidenceCap: number;
  bandCutpoints: Record<AlphaTier, number>;
}

export const DEFAULT_ALPHA_PARAMS: AlphaScoreParams = {
  halfLifeDays: 14,
  wEvalDays: 90,
  minDistinctTokens: 5,
  minClosedPositions: 3,
  minHistorySpanDays: 7,
  minUniverseTokens: 30,
  weights: { excess: 0.4, winrate: 0.2, profitFactor: 0.2, persist: 0.2 },
  luckMinTokens: 5,
  luckFloor: 0.3,
  hhiSoft: 0.35,
  superFloor: 0.4,
  clusterDiscount: 0.6,
  botDiscount: 0.5,
  borrowedConfidenceCap: 0.6,
  bandCutpoints: { UR: 90, SSR: 80, SR: 65, R: 50, N: 0 },
};

export interface WalletAlphaInput {
  address: string;
  positions: AlphaPosition[];
  /** True if wallet is collapsed cluster member (not independent alpha). */
  inCluster?: boolean;
  /** True if bot-pattern detector fired (or quality suspected_bot). */
  isBot?: boolean;
  /** Fraction of PnL from first-hand swap evidence [0,1]. */
  firstHandCoverage?: number;
  asOf?: Date;
}

export interface MarketBaselineInput {
  regime: MarketRegime;
  /** Dated snapshot id for marketBaselineVersion. */
  asOfDay: string;
  marketMedianRoi: number;
  universeSize: number;
}

export function ewmWeight(ageDays: number, halfLifeDays: number): number {
  return 0.5 ** (ageDays / halfLifeDays);
}

export function robustZ(value: number, population: number[]): number {
  if (population.length === 0) return 0;
  const sorted = [...population].sort((a, b) => a - b);
  const med = percentile(sorted, 50);
  const absDev = sorted.map((x) => Math.abs(x - med)).sort((a, b) => a - b);
  const mad = percentile(absDev, 50);
  return (value - med) / (1.4826 * mad + 1e-9);
}

export function percentileRank(value: number, population: number[]): number {
  if (population.length === 0) return 0;
  const below = population.filter((x) => x < value).length;
  const equal = population.filter((x) => x === value).length;
  return (below + 0.5 * equal) / population.length;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)]!;
}

function tierFromPercentile(score: number, bands: Record<AlphaTier, number>): AlphaTier {
  if (score >= bands.UR) return "UR";
  if (score >= bands.SSR) return "SSR";
  if (score >= bands.SR) return "SR";
  if (score >= bands.R) return "R";
  return "N";
}

function hashInputs(parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
}

export interface WalletFeatureVector {
  address: string;
  excessReturn: number;
  winRateExcess: number;
  logProfitFactor: number;
  persistence: number;
  profitHhi: number;
  distinctTokens: number;
  closedPositions: number;
  historySpanDays: number;
  firstHandCoverage: number;
  borrowedOnly: boolean;
  inCluster: boolean;
  isBot: boolean;
  topTokens: string[];
}

/** Build feature vector from closed swap positions only. */
export function buildFeatureVector(
  input: WalletAlphaInput,
  params: AlphaScoreParams = DEFAULT_ALPHA_PARAMS,
): WalletFeatureVector {
  const asOf = input.asOf ?? new Date();
  const windowStart = asOf.getTime() - params.wEvalDays * 86_400_000;
  const inWindow = input.positions.filter((p) => p.closedAt.getTime() >= windowStart);
  const weightedExcess: number[] = [];
  const weightedWins: number[] = [];
  const weights: number[] = [];
  const profits: number[] = [];
  const tokenSet = new Set<string>();
  let earliest = Number.POSITIVE_INFINITY;
  let latest = 0;

  for (const pos of inWindow) {
    const ageDays = Math.max(0, (asOf.getTime() - pos.closedAt.getTime()) / 86_400_000);
    const w = ewmWeight(ageDays, params.halfLifeDays);
    const haircut = pos.liquidityHaircut ?? 1;
    const excess = (pos.roi - pos.baselineRoi) * haircut;
    weightedExcess.push(excess * w);
    weightedWins.push((excess > 0 ? 1 : 0) * w);
    weights.push(w);
    // Treat excess as profit proxy for HHI when profitShare absent
    profits.push(Math.max(0, excess) * w);
    tokenSet.add(pos.tokenId);
    earliest = Math.min(earliest, pos.closedAt.getTime());
    latest = Math.max(latest, pos.closedAt.getTime());
  }

  const wSum = weights.reduce((a, b) => a + b, 0) || 1;
  const excessReturn = weightedExcess.reduce((a, b) => a + b, 0) / wSum;
  const winRate = weightedWins.reduce((a, b) => a + b, 0) / wSum;
  // Market win baseline approximated 0.45 for excess win rate feature
  const winRateExcess = winRate - 0.45;
  const grossPos = profits.reduce((a, b) => a + b, 0);
  const grossNeg = inWindow
    .filter((p) => p.roi - p.baselineRoi < 0)
    .reduce((a, p) => a + Math.abs(p.roi - p.baselineRoi), 0);
  const profitFactor = grossNeg > 0 ? grossPos / grossNeg : grossPos > 0 ? 10 : 1;
  const logProfitFactor = Math.log(Math.max(profitFactor, 1e-6));

  const profitTotal = profits.reduce((a, b) => a + b, 0) || 1;
  const shares = profits.map((p) => p / profitTotal);
  const profitHhi = shares.reduce((a, s) => a + s * s, 0);

  const distinctTokens = tokenSet.size;
  const closedPositions = inWindow.length;
  const historySpanDays = closedPositions > 0
    ? Math.max(0, (latest - earliest) / 86_400_000)
    : 0;

  const firstHandCoverage = input.firstHandCoverage
    ?? (inWindow.length === 0
      ? 0
      : inWindow.filter((p) => p.pnlSource === "first_hand_swap").length / inWindow.length);
  const borrowedOnly = firstHandCoverage === 0 && inWindow.length > 0;

  // Persistence: distinct profitable tokens * active weeks proxy
  const profitableTokens = new Set(
    inWindow.filter((p) => p.roi - p.baselineRoi > 0).map((p) => p.tokenId),
  );
  const activeWeeks = historySpanDays / 7;
  const persistence = profitableTokens.size * Math.min(activeWeeks, 12);

  const topTokens = [...inWindow]
    .sort((a, b) => (b.roi - b.baselineRoi) - (a.roi - a.baselineRoi))
    .slice(0, 3)
    .map((p) => p.tokenId);

  return {
    address: input.address,
    excessReturn,
    winRateExcess,
    logProfitFactor,
    persistence,
    profitHhi,
    distinctTokens,
    closedPositions,
    historySpanDays,
    firstHandCoverage,
    borrowedOnly,
    inCluster: Boolean(input.inCluster),
    isBot: Boolean(input.isBot),
    topTokens,
  };
}

export function computePenalties(
  features: WalletFeatureVector,
  params: AlphaScoreParams = DEFAULT_ALPHA_PARAMS,
): AlphaPenalty[] {
  const penalties: AlphaPenalty[] = [];
  if (features.distinctTokens < params.luckMinTokens) {
    const factor = Math.max(
      params.luckFloor,
      features.distinctTokens / params.luckMinTokens,
    );
    penalties.push({
      code: "pen_luck",
      factor,
      reason: `distinct profitable universe tokens ${features.distinctTokens} < ${params.luckMinTokens}`,
      confidence: 0.9,
      ruleVersion: ALPHA_SCORE_RULE_VERSION,
      evidence: { distinctTokens: features.distinctTokens },
    });
  }
  if (features.profitHhi > params.hhiSoft) {
    const factor = Math.max(
      params.superFloor,
      1 - (features.profitHhi - params.hhiSoft),
    );
    penalties.push({
      code: "pen_supertoken",
      factor,
      reason: `profit HHI ${features.profitHhi.toFixed(3)} > soft ${params.hhiSoft}`,
      confidence: 0.85,
      ruleVersion: ALPHA_SCORE_RULE_VERSION,
      evidence: { profitHhi: features.profitHhi },
    });
  }
  if (features.inCluster) {
    penalties.push({
      code: "pen_cluster",
      factor: params.clusterDiscount,
      reason: "wallet is cluster-collapsed actor, not independent alpha",
      confidence: 0.95,
      ruleVersion: ALPHA_SCORE_RULE_VERSION,
      evidence: { inCluster: true },
    });
  }
  if (features.isBot) {
    penalties.push({
      code: "pen_bot",
      factor: params.botDiscount,
      reason: "bot-pattern wallet: real but not human alpha",
      confidence: 0.9,
      ruleVersion: ALPHA_SCORE_RULE_VERSION,
      evidence: { isBot: true },
    });
  }
  return penalties;
}

function meetsMinimumEvidence(
  features: WalletFeatureVector,
  params: AlphaScoreParams,
): boolean {
  return features.distinctTokens >= params.minDistinctTokens
    && features.closedPositions >= params.minClosedPositions
    && features.historySpanDays >= params.minHistorySpanDays;
}

/**
 * Score one wallet against a precomputed feature population (same regime).
 * Pure / deterministic — no network, no wall-clock dependence beyond asOf in features.
 */
export function scoreWallet(
  features: WalletFeatureVector,
  population: WalletFeatureVector[],
  market: MarketBaselineInput,
  params: AlphaScoreParams = DEFAULT_ALPHA_PARAMS,
): AlphaScoreResult {
  const warnings: string[] = [];
  const marketBaselineVersion = `${MARKET_BASELINE_VERSION_PREFIX}${market.asOfDay}`;
  const inputsHash = hashInputs([
    features.address,
    features.excessReturn,
    features.winRateExcess,
    features.logProfitFactor,
    features.persistence,
    features.distinctTokens,
    features.closedPositions,
    features.firstHandCoverage,
    features.inCluster,
    features.isBot,
  ]);
  const provenanceBase = {
    alphaScoreRuleVersion: ALPHA_SCORE_RULE_VERSION,
    marketBaselineVersion,
    inputsHash,
    bandCutpoints: { ...params.bandCutpoints },
  };

  if (market.universeSize < params.minUniverseTokens) {
    warnings.push("market_baseline_thin");
  }

  if (!meetsMinimumEvidence(features, params)) {
    return {
      address: features.address,
      alphaScore: null,
      tier: null,
      status: "insufficient",
      confidence: 0,
      completeness: Math.min(
        1,
        (features.distinctTokens / params.minDistinctTokens
          + features.closedPositions / params.minClosedPositions
          + features.historySpanDays / params.minHistorySpanDays) / 3,
      ),
      coreAlpha: null,
      regime: market.regime,
      contributions: {},
      penalties: [],
      whyNotHigher: "insufficient_evidence: need ≥5 tokens, ≥3 closed positions, ≥7d span",
      provenance: provenanceBase,
      warnings: [...warnings, "alpha_status_insufficient_not_N"],
    };
  }

  const eligible = population.filter((f) => meetsMinimumEvidence(f, params) && !f.inCluster);
  const excessPop = eligible.map((f) => f.excessReturn);
  const winPop = eligible.map((f) => f.winRateExcess);
  const pfPop = eligible.map((f) => f.logProfitFactor);
  const persistPop = eligible.map((f) => f.persistence);

  const zExcess = robustZ(features.excessReturn, excessPop);
  const zWin = robustZ(features.winRateExcess, winPop);
  const zPf = robustZ(features.logProfitFactor, pfPop);
  const zPersist = robustZ(features.persistence, persistPop);

  const contributions = {
    excess: params.weights.excess * zExcess,
    winrate: params.weights.winrate * zWin,
    profit_factor: params.weights.profitFactor * zPf,
    persist: params.weights.persist * zPersist,
  };

  const penalties = computePenalties(features, params);
  const penProduct = penalties.reduce((p, x) => p * x.factor, 1);
  const coreAlpha = (contributions.excess
    + contributions.winrate
    + contributions.profit_factor
    + contributions.persist) * penProduct;

  const corePop = eligible.map((f) => {
    const c = params.weights.excess * robustZ(f.excessReturn, excessPop)
      + params.weights.winrate * robustZ(f.winRateExcess, winPop)
      + params.weights.profitFactor * robustZ(f.logProfitFactor, pfPop)
      + params.weights.persist * robustZ(f.persistence, persistPop);
    const pens = computePenalties(f, params).reduce((p, x) => p * x.factor, 1);
    return c * pens;
  });

  const rank = percentileRank(coreAlpha, corePop);
  const alphaScore = 100 * rank;
  const tier = tierFromPercentile(alphaScore, params.bandCutpoints);

  let confidence = 1;
  confidence *= Math.min(1, features.closedPositions / 10);
  confidence *= Math.min(1, features.historySpanDays / 30);
  confidence *= 0.5 + 0.5 * features.firstHandCoverage;
  if (market.universeSize < params.minUniverseTokens) confidence *= 0.7;

  let status: AlphaScoreResult["status"] = "scored";
  if (features.borrowedOnly || features.firstHandCoverage < 0.5) {
    status = "provisional";
    confidence = Math.min(confidence, params.borrowedConfidenceCap);
    warnings.push("alpha_pnl_borrowed_unverified");
  }

  const nextBandGap = tier === "UR"
    ? 0
    : params.bandCutpoints[tier === "N" ? "R" : tier === "R" ? "SR" : tier === "SR" ? "SSR" : "UR"] - alphaScore;
  const heaviestPen = [...penalties].sort((a, b) => a.factor - b.factor)[0];
  const lowestZ = Object.entries({
    excess: zExcess,
    winrate: zWin,
    profit_factor: zPf,
    persist: zPersist,
  }).sort((a, b) => a[1] - b[1])[0];

  let whyNotHigher = "at_top_band";
  if (heaviestPen && heaviestPen.factor < 0.85) {
    whyNotHigher = `penalty:${heaviestPen.code}`;
  } else if (lowestZ && lowestZ[1] < 0) {
    whyNotHigher = `weak_factor:${lowestZ[0]}`;
  } else if (nextBandGap > 0) {
    whyNotHigher = `percentile_gap_to_next:${nextBandGap.toFixed(1)}`;
  } else if (status === "provisional") {
    whyNotHigher = "coverage_cap_provisional";
  }

  return {
    address: features.address,
    alphaScore,
    tier,
    status,
    confidence,
    completeness: Math.min(1, features.firstHandCoverage * 0.5 + 0.5),
    coreAlpha,
    regime: market.regime,
    contributions,
    penalties,
    whyNotHigher,
    provenance: provenanceBase,
    warnings,
  };
}

/** Score an entire fixture population deterministically. */
export function scorePopulation(
  wallets: WalletAlphaInput[],
  market: MarketBaselineInput,
  params: AlphaScoreParams = DEFAULT_ALPHA_PARAMS,
): AlphaScoreResult[] {
  const features = wallets.map((w) => buildFeatureVector(w, params));
  return features.map((f) => scoreWallet(f, features, market, params));
}
