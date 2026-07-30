/**
 * Maps pilot holder-cleaning output onto strict CaScanResponseV1.
 * Provider-private fields are never introduced.
 *
 * Accounting confirmation and concentration confirmation are independent:
 * complete supply reconciliation must not imply cleaned investor concentration.
 */

import {
  CA_SCAN_RESPONSE_SCHEMA,
  CA_SCAN_RESPONSE_VERSION,
  buildRatioMetric,
  parseCaScanResponseV1,
  type CaScanResponseV1,
  type CompletenessState,
  type HolderEntry,
  type JudgmentEvidence,
  type SourceProvenance,
} from "../contracts/ca-scan-response-v1.js";
import {
  HOLDER_CLEANING_RULE_VERSION,
  type AggregatedOwner,
  type HolderCleaningResult,
} from "../rules/holder-data-cleaning.js";

export interface MapHolderCleaningToCaScanInput {
  cleaning: HolderCleaningResult;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  generatedAt: string;
  mintProvenance: SourceProvenance;
}

function completenessState(value: "complete" | "partial" | "unavailable"): CompletenessState {
  return value;
}

function ownerToEntry(owner: AggregatedOwner, rank?: number): HolderEntry {
  const entry: HolderEntry = {
    address: owner.owner,
    balanceRaw: owner.ownerRawAmount,
  };
  if (rank !== undefined) entry.rank = rank;
  if (owner.cleaningClass !== "included_holder") {
    entry.exclusionReason = owner.cleaningClass;
    entry.ruleVersion = HOLDER_CLEANING_RULE_VERSION;
  }
  return entry;
}

function accountToEntry(
  tokenAccount: string,
  owner: string,
  balanceRaw: string,
  exclusionReason?: string,
): HolderEntry {
  const entry: HolderEntry = {
    address: tokenAccount,
    balanceRaw,
    ownerAddress: owner,
  };
  if (exclusionReason) {
    entry.exclusionReason = exclusionReason;
    entry.ruleVersion = HOLDER_CLEANING_RULE_VERSION;
  }
  return entry;
}

/**
 * Build a validated CaScanResponseV1 from cleaning output.
 * Accounting may be confirmed while concentration stays unverified when pool
 * exclusion coverage is incomplete.
 */
export function mapHolderCleaningToCaScanResponseV1(input: MapHolderCleaningToCaScanInput): CaScanResponseV1 {
  const { cleaning } = input;
  const accountingEligible = cleaning.accountingEligible;
  const concentrationEligible = cleaning.concentrationEligible;
  const exclusionCoverage = cleaning.exclusionCoverage;

  const accountingVerification = accountingEligible ? "confirmed" as const : "unverified" as const;
  const concentrationVerification = concentrationEligible ? "confirmed" as const : "unverified" as const;

  // Holder section: raw/owner-agg/supply can be accounting-confirmed; cleaned
  // investor universe remains partial until pool exclusion is complete.
  const holderCompleteness = completenessState(
    concentrationEligible
      ? "complete"
      : cleaning.rawTokenAccounts.length === 0
        ? "unavailable"
        : accountingEligible
          ? "partial"
          : cleaning.paginationComplete && cleaning.accounting.completeness === "complete"
            ? "partial"
            : "partial",
  );

  const accountingProvenance: SourceProvenance = {
    source: "normalized-holder-snapshot",
    sourceTier: "A",
    verificationStatus: accountingVerification,
    observedAt: cleaning.observedAt,
    ...(cleaning.accounting.paginationComplete
      ? { watermarkRef: "pagination_complete" }
      : { watermarkRef: "pagination_partial" }),
    ruleVersion: HOLDER_CLEANING_RULE_VERSION,
  };

  const concentrationProvenance: SourceProvenance = {
    ...accountingProvenance,
    verificationStatus: concentrationVerification,
    evidenceRef: exclusionCoverage === "complete"
      ? "pool_exclusion_coverage_complete"
      : "pool_exclusion_coverage_incomplete",
  };

  const rawTop = cleaning.rawTokenAccounts
    .slice()
    .sort((a, b) => {
      const ba = BigInt(a.rawAmount || "0");
      const bb = BigInt(b.rawAmount || "0");
      if (ba === bb) return a.tokenAccount.localeCompare(b.tokenAccount);
      return ba > bb ? -1 : 1;
    })
    .slice(0, 100)
    .map((a) => accountToEntry(
      a.tokenAccount,
      a.owner,
      a.rawAmount,
      a.cleaningClass === "included_holder" ? undefined : a.cleaningClass,
    ));

  const ownerAgg = cleaning.owners.slice(0, 100).map((o, i) => ownerToEntry(o, i + 1));
  const cleaned = cleaning.universes.cleanedHolderUniverse.owners
    .slice(0, 100)
    .map((o, i) => ownerToEntry(o, i + 1));
  const excludedInfra = cleaning.universes.excludedInfrastructureUniverse.owners
    .filter((o) =>
      o.cleaningClass === "known_program_or_infrastructure"
      || o.cleaningClass === "closed_or_inactive"
      || o.cleaningClass === "invalid_or_unparseable"
      || o.cleaningClass === "zero_balance"
    )
    .slice(0, 100)
    .map((o) => ownerToEntry(o));
  const excludedPools = cleaning.universes.excludedInfrastructureUniverse.owners
    .filter((o) => o.cleaningClass === "liquidity_or_pool_account")
    .slice(0, 100)
    .map((o) => ownerToEntry(o));
  const excludedBurn = cleaning.universes.excludedInfrastructureUniverse.owners
    .filter((o) => o.cleaningClass === "burn_or_dead_address")
    .slice(0, 100)
    .map((o) => ownerToEntry(o));

  const top10 = cleaning.concentration.find((m) => m.name === "top10");
  const top20 = cleaning.concentration.find((m) => m.name === "top20");
  const excludedShare = cleaning.concentration.find((m) => m.name === "excludedShare");

  // CaScan RatioMetric: completeness 1 only when concentrationEligible; ratio
  // must be null otherwise (contract). Numerators/denominators still returned.
  const metricCompleteness = concentrationEligible ? 1 : 0;
  const cohortCompleteness = concentrationEligible ? "complete" as const : "partial" as const;

  const observationalUniverseDef = concentrationEligible
    ? "cleaned_investor_owners_vs_mint_supply"
    : "owner_aggregated_observational_vs_mint_supply_pool_exclusion_incomplete";

  const holderWarnings: string[] = [];
  if (!accountingEligible) holderWarnings.push("holder_accounting_not_confirmed");
  if (exclusionCoverage !== "complete") holderWarnings.push("pool_exclusion_coverage_incomplete");
  if (!concentrationEligible) holderWarnings.push("cleaned_investor_universe_unverified");

  const cohortWarnings: string[] = [];
  if (!concentrationEligible) {
    cohortWarnings.push("concentration_partial_or_unconfirmed");
    cohortWarnings.push("pool_exclusion_coverage_incomplete");
  }
  if (exclusionCoverage !== "complete") {
    cohortWarnings.push("not_cleaned_investor_concentration");
  }

  const judgmentEvidence: JudgmentEvidence[] = [];

  if (accountingEligible) {
    judgmentEvidence.push({
      judgmentCode: "holder_supply_accounting_complete",
      humanReadableSummary:
        "Token accounts were owner-aggregated and reconciled against mint supply.",
      evidenceRefs: [
        "pagination_complete",
        "owner_aggregation",
        "mint_supply_accounting",
        "partition_identity",
      ],
      confidence: 1,
      ruleVersion: HOLDER_CLEANING_RULE_VERSION,
      sourceTier: "A",
      completeness: "complete",
      warnings: [],
      status: "confirmed",
    });
  } else {
    judgmentEvidence.push({
      judgmentCode: "holder_universe_partial_or_unresolved",
      humanReadableSummary:
        "Holder universes available but pagination/accounting prevents confirmed supply reconciliation.",
      evidenceRefs: ["supply_accounting", ...cleaning.accounting.residualReasons],
      confidence: 0.4,
      ruleVersion: HOLDER_CLEANING_RULE_VERSION,
      sourceTier: "A",
      completeness: "partial",
      warnings: ["not_confirmed", "accounting_incomplete"],
      status: "unverified",
    });
  }

  // Always emit an independent concentration-scope evidence item.
  if (concentrationEligible) {
    judgmentEvidence.push({
      judgmentCode: "holder_concentration_cleaned_investor_complete",
      humanReadableSummary:
        "Cleaned investor concentration is confirmed under complete pool/liquidity exclusion coverage.",
      evidenceRefs: ["cleaned_holder_universe", "pool_exclusion_coverage_complete"],
      confidence: 1,
      ruleVersion: HOLDER_CLEANING_RULE_VERSION,
      sourceTier: "A",
      completeness: "complete",
      warnings: [],
      status: "confirmed",
    });
  } else {
    judgmentEvidence.push({
      judgmentCode: "holder_concentration_scope_unverified",
      humanReadableSummary:
        "Investor concentration (Top10/Top20 / cleaned control) is not confirmed: pool/liquidity exclusion coverage is incomplete or unresolved balances remain.",
      evidenceRefs: [
        `exclusionCoverage=${exclusionCoverage}`,
        "pool_exclusion_coverage_incomplete",
        observationalUniverseDef,
      ],
      confidence: 0.3,
      ruleVersion: HOLDER_CLEANING_RULE_VERSION,
      sourceTier: "A",
      completeness: "partial",
      warnings: ["pool_exclusion_coverage_incomplete", "not_cleaned_investor_concentration"],
      status: "unverified",
    });
  }

  const response: CaScanResponseV1 = {
    schema: CA_SCAN_RESPONSE_SCHEMA,
    version: CA_SCAN_RESPONSE_VERSION,
    generatedAt: input.generatedAt,
    tokenIdentity: {
      chain: "solana",
      ca: cleaning.ca,
      name: input.name,
      symbol: input.symbol,
      decimals: input.decimals,
      totalSupplyRaw: cleaning.accounting.mintSupplyRaw,
      launchpad: null,
      createdAt: null,
      creationTx: null,
      provenance: input.mintProvenance,
    },
    marketSnapshot: null,
    authorityFacts: null,
    holderUniverses: {
      raw_top_holders: rawTop,
      owner_aggregated_holders: ownerAgg,
      cleaned_top_holders: cleaned,
      excluded_infrastructure: excludedInfra,
      excluded_pools: excludedPools,
      excluded_burn_addresses: excludedBurn,
      ruleVersion: HOLDER_CLEANING_RULE_VERSION,
      completeness: holderCompleteness,
      // Accounting-scope confirmation when eligible; cleaned investor still warned.
      provenance: accountingProvenance,
      warnings: holderWarnings,
    },
    cohortMetrics: {
      top10Concentration: top10
        ? buildRatioMetric({
          numerator: top10.numerator,
          denominator: top10.denominator,
          universeDefinition: observationalUniverseDef,
          ruleVersion: top10.calculationVersion,
          completeness: metricCompleteness,
          provenance: concentrationProvenance,
        })
        : null,
      top20Concentration: top20
        ? buildRatioMetric({
          numerator: top20.numerator,
          denominator: top20.denominator,
          universeDefinition: observationalUniverseDef,
          ruleVersion: top20.calculationVersion,
          completeness: metricCompleteness,
          provenance: concentrationProvenance,
        })
        : null,
      eligibleHolderCount: cleaning.universes.cleanedHolderUniverse.ownerCount,
      excludedShare: excludedShare
        ? buildRatioMetric({
          numerator: excludedShare.numerator,
          denominator: excludedShare.denominator,
          universeDefinition: observationalUniverseDef,
          ruleVersion: excludedShare.calculationVersion,
          completeness: metricCompleteness,
          provenance: concentrationProvenance,
        })
        : null,
      ruleVersion: HOLDER_CLEANING_RULE_VERSION,
      completeness: cohortCompleteness,
      warnings: cohortWarnings,
    },
    walletTokenSignals: [],
    clusterSummaries: [],
    devBehavior: null,
    crossTokenMatches: [],
    judgmentEvidence,
    sourceProvenance: [input.mintProvenance, accountingProvenance, concentrationProvenance],
    completeness: {
      overall: concentrationEligible ? "complete" : accountingEligible ? "partial" : "partial",
      ratio: concentrationEligible ? 1 : accountingEligible ? 0.6 : 0.4,
      sections: {
        tokenIdentity: input.decimals !== null ? "complete" : "partial",
        holderUniverses: holderCompleteness,
        cohortMetrics: cohortCompleteness,
        marketSnapshot: "unavailable",
        authorityFacts: "unavailable",
        devBehavior: "unavailable",
        supplyAccounting: accountingEligible ? "complete" : "partial",
        exclusionCoverage: exclusionCoverage,
        concentration: concentrationEligible ? "complete" : "partial",
      },
    },
    warnings: [
      ...new Set([
        ...cleaning.issues
          .filter((i) => i.severity === "error" || i.severity === "blocking" || i.severity === "warning")
          .map((i) => i.code),
        ...(exclusionCoverage !== "complete" ? ["pool_exclusion_coverage_incomplete"] : []),
      ]),
    ].slice(0, 32),
  };

  return parseCaScanResponseV1(response);
}
