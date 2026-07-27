import type { ClusterSignal } from "./cluster-fusion.js";
import type { SniperSignal } from "./bot-sniper.js";

export const INDEPENDENT_SMART_MONEY_RULE_VERSION = "independent-smart-money-v1";

export interface IndependenceFeatures {
  /** Profit feature 0–1; must be Tier-A recomputed to certify. */
  fProfit: number;
  fSellIndep: number;
  fMultitoken: number;
  profitableTokenCount: number;
  pnlTierA: boolean;
}

export interface IndependenceSignal {
  eligible: boolean;
  certified: boolean;
  I: number;
  multiTokenCount: number;
  pnlTierA: boolean;
  vetoReason: string | null;
  ruleVersion: string;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Conservative certification. Hard veto when cluster C≥0.85 or sniper S≥0.75.
 * Risk outranks capability by construction.
 */
export function scoreIndependentSmartMoney(
  features: IndependenceFeatures,
  cluster: ClusterSignal,
  sniper: SniperSignal,
): IndependenceSignal {
  const fProfit = clamp01(features.fProfit);
  const fIndepCluster = clamp01(1 - cluster.C);
  const fNotbot = clamp01(1 - sniper.S);
  const fSellIndep = clamp01(features.fSellIndep);
  const fMultitoken = clamp01(features.fMultitoken);

  let I = 0.3 * fProfit
    + 0.2 * fIndepCluster
    + 0.15 * fNotbot
    + 0.15 * fSellIndep
    + 0.2 * fMultitoken;

  let vetoReason: string | null = null;
  if (cluster.C >= 0.85) {
    I = 0;
    vetoReason = "cluster_veto";
  } else if (sniper.S >= 0.75) {
    I = 0;
    vetoReason = "sniper_veto";
  } else if (features.profitableTokenCount < 3) {
    I = 0;
    vetoReason = "multi_token_veto";
  }

  const certified = I >= 0.8 && features.pnlTierA && vetoReason === null;

  return {
    eligible: vetoReason === null && features.profitableTokenCount >= 3,
    certified,
    I,
    multiTokenCount: features.profitableTokenCount,
    pnlTierA: features.pnlTierA,
    vetoReason,
    ruleVersion: INDEPENDENT_SMART_MONEY_RULE_VERSION,
  };
}
