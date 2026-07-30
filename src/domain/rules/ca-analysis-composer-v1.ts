/**
 * CA-ANALYSIS-COMPOSER-V1-001 — pure judgment composer.
 * Does not fetch. Every conclusion is traceable to inputs + rule version.
 */

export const CA_ANALYSIS_COMPOSER_RULE_VERSION = "ca-analysis-composer-v1";

export type VerificationStatus = "confirmed" | "partial" | "unverified" | "unavailable";

export interface EvidenceEnvelope {
  source: string;
  tier: "A" | "B" | "DERIVED";
  verificationStatus: VerificationStatus;
  observedAt: string | null;
  sourceWatermark: string | null;
  completeness: number;
  ruleVersion: string | null;
  evidenceRefs: string[];
  warnings: string[];
}

export interface HolderCoreInput {
  accountingEligible: boolean;
  exclusionCoverage: "complete" | "partial" | "unavailable";
  concentrationEligible: boolean;
  paginationComplete: boolean;
  residualRatio: number | null;
  ownerCounts: { total: number; included: number; excluded: number; unresolved: number };
  concentration: Array<{
    name: string;
    numerator: string;
    denominator: string;
    ratio: number | null;
    verificationStatus: "confirmed" | "unverified";
  }>;
  evidence: EvidenceEnvelope;
}

export interface MarketCoreInput {
  priceUsd: number | null;
  liquidityUsd: number | null;
  fdvUsd: number | null;
  volume24hUsd: number | null;
  pairAddress: string | null;
  pairAgeHours: number | null;
  evidence: EvidenceEnvelope;
}

export interface AuthorityCoreInput {
  mintAuthority: string | null;
  freezeAuthority: string | null;
  decimals: number | null;
  supplyRaw: string | null;
  program: string | null;
  evidence: EvidenceEnvelope;
}

export interface PoolEvidenceInput {
  pools: Array<{
    address: string;
    programOwner: string | null;
    role: "lp" | "bonding_curve" | "amm" | "unknown";
    exclusionStrength: "hard" | "soft" | "none";
  }>;
  coverage: "complete" | "partial" | "unavailable";
  evidence: EvidenceEnvelope;
}

export interface AddressHitInput {
  hits: Array<{
    owner: string;
    labels: string[];
    verificationStatus: VerificationStatus;
    tier: string;
  }>;
  evidence: EvidenceEnvelope;
}

export interface ComposerInput {
  mint: string;
  symbol: string | null;
  name: string | null;
  holder: HolderCoreInput | null;
  market: MarketCoreInput | null;
  authority: AuthorityCoreInput | null;
  pool: PoolEvidenceInput | null;
  addressHits: AddressHitInput | null;
  observedAt: string;
}

export interface ResearchPriorityItem {
  dimension: string;
  severity: "info" | "watch" | "review";
  summary: string;
  evidenceRefs: string[];
  /** Never a trade instruction. */
  nextAction: string;
}

export interface CaAnalysisResponseV2 {
  schemaVersion: "CaAnalysisResponseV2";
  ruleVersion: string;
  mint: string;
  symbol: string | null;
  name: string | null;
  observedAt: string;
  identity: {
    decimals: number | null;
    supplyRaw: string | null;
    program: string | null;
    mintAuthority: string | null;
    freezeAuthority: string | null;
  };
  market: {
    priceUsd: number | null;
    liquidityUsd: number | null;
    fdvUsd: number | null;
    volume24hUsd: number | null;
    pairAddress: string | null;
    pairAgeHours: number | null;
    trust: VerificationStatus;
    source: string | null;
  };
  dataQuality: {
    accountingEligible: boolean | null;
    exclusionCoverage: "complete" | "partial" | "unavailable" | null;
    concentrationEligible: boolean | null;
    paginationComplete: boolean | null;
    residualRatio: number | null;
    overall: VerificationStatus;
    warnings: string[];
  };
  holders: HolderCoreInput["ownerCounts"] | null;
  concentration: HolderCoreInput["concentration"] | null;
  pools: PoolEvidenceInput["pools"] | null;
  addressHits: AddressHitInput["hits"] | null;
  researchPriority: ResearchPriorityItem[];
  evidence: EvidenceEnvelope[];
  /** Explicit: no alpha score, no trade advice. */
  disclaimers: string[];
}

export function composeCaAnalysisV1(input: ComposerInput): CaAnalysisResponseV2 {
  const warnings: string[] = [];
  const evidence: EvidenceEnvelope[] = [];

  if (input.holder) evidence.push(input.holder.evidence);
  if (input.market) evidence.push(input.market.evidence);
  if (input.authority) evidence.push(input.authority.evidence);
  if (input.pool) evidence.push(input.pool.evidence);
  if (input.addressHits) evidence.push(input.addressHits.evidence);

  const accountingEligible = input.holder?.accountingEligible ?? null;
  const exclusionCoverage = input.holder?.exclusionCoverage ?? null;
  const concentrationEligible = input.holder?.concentrationEligible ?? null;
  const paginationComplete = input.holder?.paginationComplete ?? null;

  let overall: VerificationStatus = "unavailable";
  if (input.holder) {
    if (accountingEligible && paginationComplete && exclusionCoverage === "complete") {
      overall = "confirmed";
    } else if (accountingEligible || paginationComplete === false || exclusionCoverage === "partial") {
      overall = "partial";
    } else {
      overall = "unverified";
    }
  }

  if (paginationComplete === false) warnings.push("pagination_incomplete");
  if (exclusionCoverage === "partial") warnings.push("exclusion_coverage_partial");
  if (concentrationEligible === false) warnings.push("concentration_not_eligible");
  if (!input.market) warnings.push("market_unavailable");
  if (!input.authority) warnings.push("authority_unavailable");
  if (input.pool?.coverage !== "complete") warnings.push("pool_coverage_incomplete");

  const researchPriority: ResearchPriorityItem[] = [];

  if (overall === "partial" || overall === "unavailable") {
    researchPriority.push({
      dimension: "data_quality",
      severity: "review",
      summary: "Holder accounting or pagination incomplete — fail-closed; do not treat concentration as confirmed.",
      evidenceRefs: input.holder?.evidence.evidenceRefs ?? [],
      nextAction: "Re-run holder hotpath with higher page budget or resolve residual owners.",
    });
  }

  if (input.authority?.mintAuthority) {
    researchPriority.push({
      dimension: "authority",
      severity: "watch",
      summary: "Mint authority is non-null.",
      evidenceRefs: input.authority.evidence.evidenceRefs,
      nextAction: "Confirm whether authority was revoked after launch (Tier-A account evidence).",
    });
  }

  if (input.market?.liquidityUsd !== null && input.market?.liquidityUsd !== undefined && input.market.liquidityUsd < 5_000) {
    researchPriority.push({
      dimension: "liquidity",
      severity: "watch",
      summary: "Observed liquidity is low (Tier-B market observation).",
      evidenceRefs: input.market.evidence.evidenceRefs,
      nextAction: "Cross-check pool reserves on-chain before any capital decision.",
    });
  }

  if (input.addressHits && input.addressHits.hits.length > 0) {
    researchPriority.push({
      dimension: "address_library",
      severity: "info",
      summary: `${input.addressHits.hits.length} owner(s) hit local address library.`,
      evidenceRefs: input.addressHits.evidence.evidenceRefs,
      nextAction: "Open address detail for labels and verification status; Tier-B labels stay unverified.",
    });
  }

  if (researchPriority.length === 0) {
    researchPriority.push({
      dimension: "baseline",
      severity: "info",
      summary: "Core CA card composed; no automatic trade recommendation.",
      evidenceRefs: evidence.flatMap((e) => e.evidenceRefs).slice(0, 8),
      nextAction: "Review evidence tabs and decide manual follow-up only.",
    });
  }

  return {
    schemaVersion: "CaAnalysisResponseV2",
    ruleVersion: CA_ANALYSIS_COMPOSER_RULE_VERSION,
    mint: input.mint,
    symbol: input.symbol,
    name: input.name,
    observedAt: input.observedAt,
    identity: {
      decimals: input.authority?.decimals ?? null,
      supplyRaw: input.authority?.supplyRaw ?? null,
      program: input.authority?.program ?? null,
      mintAuthority: input.authority?.mintAuthority ?? null,
      freezeAuthority: input.authority?.freezeAuthority ?? null,
    },
    market: {
      priceUsd: input.market?.priceUsd ?? null,
      liquidityUsd: input.market?.liquidityUsd ?? null,
      fdvUsd: input.market?.fdvUsd ?? null,
      volume24hUsd: input.market?.volume24hUsd ?? null,
      pairAddress: input.market?.pairAddress ?? null,
      pairAgeHours: input.market?.pairAgeHours ?? null,
      trust: input.market?.evidence.verificationStatus ?? "unavailable",
      source: input.market?.evidence.source ?? null,
    },
    dataQuality: {
      accountingEligible,
      exclusionCoverage,
      concentrationEligible,
      paginationComplete,
      residualRatio: input.holder?.residualRatio ?? null,
      overall,
      warnings: [...new Set([...warnings, ...(input.holder?.evidence.warnings ?? [])])],
    },
    holders: input.holder?.ownerCounts ?? null,
    concentration: input.holder?.concentration ?? null,
    pools: input.pool?.pools ?? null,
    addressHits: input.addressHits?.hits ?? null,
    researchPriority,
    evidence,
    disclaimers: [
      "Research aid only — not trade execution advice.",
      "Tier-B market fields are unverified observations and never override Tier-A supply/holders.",
      "confirmed requires Tier-A completeness; PARTIAL never upgrades silently.",
      `composer=${CA_ANALYSIS_COMPOSER_RULE_VERSION}`,
    ],
  };
}
