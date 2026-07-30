/**
 * JUDGMENT-ENGINE-V1-001 — multi-dimension judgment from evidence only.
 * LLM must not be called here; this is pure structured verdicts.
 */

export const JUDGMENT_ENGINE_RULE_VERSION = "judgment-engine-v1";

export type Verdict = "low_risk" | "watch" | "elevated" | "unknown" | "insufficient_data";

export interface JudgmentDimension {
  dimension: string;
  verdict: Verdict;
  confidence: number;
  summary: string;
  evidenceRefs: string[];
  ruleVersion: string;
}

export interface JudgmentBundleV1 {
  ruleVersion: string;
  subject: { kind: "ca" | "wallet"; id: string };
  dimensions: JudgmentDimension[];
  overall: Verdict;
  disclaimers: string[];
}

export function judgeCaFromEvidence(input: {
  mint: string;
  accountingEligible: boolean | null;
  concentrationEligible: boolean | null;
  mintAuthorityPresent: boolean | null;
  poolCoverage: "complete" | "partial" | "unavailable" | null;
  liquidityUsd: number | null;
  addressHitCount: number;
  paginationComplete: boolean | null;
}): JudgmentBundleV1 {
  const dims: JudgmentDimension[] = [];

  // Safety / authority
  if (input.mintAuthorityPresent === null) {
    dims.push({
      dimension: "safety_authority",
      verdict: "insufficient_data",
      confidence: 0,
      summary: "Authority fields unavailable.",
      evidenceRefs: [],
      ruleVersion: JUDGMENT_ENGINE_RULE_VERSION,
    });
  } else if (input.mintAuthorityPresent) {
    dims.push({
      dimension: "safety_authority",
      verdict: "watch",
      confidence: 0.7,
      summary: "Mint authority still present.",
      evidenceRefs: ["authority:mint"],
      ruleVersion: JUDGMENT_ENGINE_RULE_VERSION,
    });
  } else {
    dims.push({
      dimension: "safety_authority",
      verdict: "low_risk",
      confidence: 0.6,
      summary: "Mint authority null (observe freeze separately).",
      evidenceRefs: ["authority:mint_null"],
      ruleVersion: JUDGMENT_ENGINE_RULE_VERSION,
    });
  }

  // Holders
  if (!input.accountingEligible || input.paginationComplete === false) {
    dims.push({
      dimension: "holders",
      verdict: "insufficient_data",
      confidence: 0.2,
      summary: "Holder accounting incomplete — fail-closed.",
      evidenceRefs: ["holder:accounting"],
      ruleVersion: JUDGMENT_ENGINE_RULE_VERSION,
    });
  } else if (!input.concentrationEligible) {
    dims.push({
      dimension: "holders",
      verdict: "watch",
      confidence: 0.5,
      summary: "Accounting OK but concentration not eligible (exclusion coverage).",
      evidenceRefs: ["holder:concentration_gate"],
      ruleVersion: JUDGMENT_ENGINE_RULE_VERSION,
    });
  } else {
    dims.push({
      dimension: "holders",
      verdict: "low_risk",
      confidence: 0.55,
      summary: "Holder gates eligible; still review top owners manually.",
      evidenceRefs: ["holder:eligible"],
      ruleVersion: JUDGMENT_ENGINE_RULE_VERSION,
    });
  }

  // Liquidity (Tier-B observation)
  if (input.liquidityUsd === null) {
    dims.push({
      dimension: "liquidity",
      verdict: "unknown",
      confidence: 0,
      summary: "No market liquidity observation.",
      evidenceRefs: [],
      ruleVersion: JUDGMENT_ENGINE_RULE_VERSION,
    });
  } else if (input.liquidityUsd < 5_000) {
    dims.push({
      dimension: "liquidity",
      verdict: "elevated",
      confidence: 0.5,
      summary: "Low observed liquidity (Tier-B).",
      evidenceRefs: ["market:liquidity"],
      ruleVersion: JUDGMENT_ENGINE_RULE_VERSION,
    });
  } else {
    dims.push({
      dimension: "liquidity",
      verdict: "watch",
      confidence: 0.4,
      summary: "Liquidity observation present (unverified Tier-B).",
      evidenceRefs: ["market:liquidity"],
      ruleVersion: JUDGMENT_ENGINE_RULE_VERSION,
    });
  }

  // Address library hits
  dims.push({
    dimension: "address_quality",
    verdict: input.addressHitCount > 0 ? "watch" : "unknown",
    confidence: input.addressHitCount > 0 ? 0.45 : 0.1,
    summary:
      input.addressHitCount > 0
        ? `${input.addressHitCount} local address-library hit(s); labels remain source-tagged.`
        : "No local address-library hits.",
    evidenceRefs: input.addressHitCount > 0 ? ["address_store:hits"] : [],
    ruleVersion: JUDGMENT_ENGINE_RULE_VERSION,
  });

  // Completeness
  dims.push({
    dimension: "completeness",
    verdict:
      input.accountingEligible && input.paginationComplete && input.poolCoverage === "complete"
        ? "low_risk"
        : "insufficient_data",
    confidence: 0.8,
    summary: "Overall data completeness gate.",
    evidenceRefs: ["gates:completeness"],
    ruleVersion: JUDGMENT_ENGINE_RULE_VERSION,
  });

  const rank: Record<Verdict, number> = {
    elevated: 4,
    watch: 3,
    unknown: 2,
    insufficient_data: 2,
    low_risk: 1,
  };
  let overall: Verdict = "low_risk";
  for (const d of dims) {
    if (rank[d.verdict] > rank[overall]) overall = d.verdict;
  }

  return {
    ruleVersion: JUDGMENT_ENGINE_RULE_VERSION,
    subject: { kind: "ca", id: input.mint },
    dimensions: dims,
    overall,
    disclaimers: [
      "Not trade execution advice.",
      "LLM must only rephrase these fields; must not invent facts.",
      "Tier-B never upgrades to confirmed without Tier-A evidence.",
    ],
  };
}
