import type { ClusterMember } from "../types.js";

export const CLUSTER_FUSION_RULE_VERSION = "cluster-fusion-v1";
/** Unchanged exclusion gate — fusion never lowers this. */
export const HOLDER_EXCLUSION_CLUSTER_THRESHOLD = 0.85;

export interface ClusterFusionFeatures {
  /** Seed from detectFundingClusters confidence (Tier-A). */
  fFund: number;
  fBlock: number;
  fCosell: number;
  fXtoken: number;
  fDevlink: number;
  /** Tier-B external label strength, capped later. */
  fExt?: number;
}

export interface ClusterSignal {
  isMember: boolean;
  clusterId: string | null;
  C: number;
  seedConfidence: number;
  insiderEscalated: boolean;
  riskTier: "none" | "suspected" | "cluster" | "insider";
  /** True only when C≥0.85 AND seed≥0.85 — eligible for existing real-holders gate. */
  eligibleForHolderExclusion: boolean;
  ruleVersion: string;
  features: ClusterFusionFeatures;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Overlay scorer on top of funding-clusters seed. Does not call or replace
 * detectFundingClusters; does not change the 0.85 exclusion threshold.
 */
export function scoreClusterFusion(
  seed: ClusterMember | null,
  features: Omit<ClusterFusionFeatures, "fFund"> & { fFund?: number },
): ClusterSignal {
  const seedConfidence = seed?.confidence ?? 0;
  const fFund = features.fFund ?? seedConfidence;
  const fBlock = clamp01(features.fBlock);
  const fCosell = clamp01(features.fCosell);
  const fXtoken = clamp01(features.fXtoken);
  const fDevlink = clamp01(features.fDevlink);
  const fExt = clamp01(features.fExt ?? 0);

  const cA = 0.35 * fFund + 0.2 * fBlock + 0.15 * fCosell + 0.2 * fXtoken + 0.1 * fDevlink;
  const tierAPositive = [fFund, fBlock, fCosell, fXtoken, fDevlink].filter((x) => x > 0).length;
  // G-2b: no Tier-B-only firing
  const bonusExt = tierAPositive >= 2 ? Math.min(0.1, 0.1 * fExt) : 0;
  const C = clamp01(cA + bonusExt);

  let riskTier: ClusterSignal["riskTier"] = "none";
  if (C >= 0.85 && seedConfidence >= 0.85) riskTier = "cluster";
  else if (C >= 0.7) riskTier = "suspected";

  const insiderEscalated = fDevlink >= 0.6 && fFund >= 0.85;
  if (insiderEscalated && riskTier === "cluster") riskTier = "insider";

  const eligibleForHolderExclusion = C >= HOLDER_EXCLUSION_CLUSTER_THRESHOLD
    && seedConfidence >= HOLDER_EXCLUSION_CLUSTER_THRESHOLD;

  return {
    isMember: riskTier === "cluster" || riskTier === "insider" || riskTier === "suspected",
    clusterId: seed?.clusterId ?? null,
    C,
    seedConfidence,
    insiderEscalated,
    riskTier,
    eligibleForHolderExclusion,
    ruleVersion: CLUSTER_FUSION_RULE_VERSION,
    features: { fFund, fBlock, fCosell, fXtoken, fDevlink, fExt },
  };
}
