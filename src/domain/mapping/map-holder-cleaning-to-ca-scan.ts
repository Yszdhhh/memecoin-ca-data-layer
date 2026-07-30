/**
 * Maps pilot holder-cleaning output onto strict CaScanResponseV1.
 * Provider-private fields are never introduced.
 */

import {
  CA_SCAN_RESPONSE_SCHEMA,
  CA_SCAN_RESPONSE_VERSION,
  buildRatioMetric,
  parseCaScanResponseV1,
  type CaScanResponseV1,
  type CompletenessState,
  type HolderEntry,
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
 * Holder judgments are never confirmed when pagination/accounting incomplete.
 */
export function mapHolderCleaningToCaScanResponseV1(input: MapHolderCleaningToCaScanInput): CaScanResponseV1 {
  const { cleaning } = input;
  const verificationStatus = cleaning.judgmentEligible ? "confirmed" as const : "unverified" as const;
  const holderCompleteness = completenessState(
    cleaning.paginationComplete && cleaning.accounting.completeness === "complete"
      ? "complete"
      : cleaning.rawTokenAccounts.length === 0
        ? "unavailable"
        : "partial",
  );

  const holderProvenance: SourceProvenance = {
    source: "normalized-holder-snapshot",
    sourceTier: "A",
    verificationStatus,
    observedAt: cleaning.observedAt,
    ...(cleaning.accounting.paginationComplete ? { watermarkRef: "pagination_complete" } : { watermarkRef: "pagination_partial" }),
    ruleVersion: HOLDER_CLEANING_RULE_VERSION,
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
    .filter((o) => o.cleaningClass === "known_program_or_infrastructure" || o.cleaningClass === "closed_or_inactive" || o.cleaningClass === "invalid_or_unparseable" || o.cleaningClass === "zero_balance")
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
  const metricCompleteness = cleaning.judgmentEligible ? 1 : 0;

  const ratioProv: SourceProvenance = {
    ...holderProvenance,
    verificationStatus: cleaning.judgmentEligible ? "confirmed" : "unverified",
  };

  const cohortCompleteness = cleaning.judgmentEligible ? "complete" as const : "partial" as const;

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
      provenance: holderProvenance,
      warnings: cleaning.judgmentEligible ? [] : ["holder_judgment_not_confirmed"],
    },
    cohortMetrics: {
      top10Concentration: top10
        ? buildRatioMetric({
          numerator: top10.numerator,
          denominator: top10.denominator,
          universeDefinition: top10.universeDefinition,
          ruleVersion: top10.calculationVersion,
          completeness: metricCompleteness,
          provenance: ratioProv,
        })
        : null,
      top20Concentration: top20
        ? buildRatioMetric({
          numerator: top20.numerator,
          denominator: top20.denominator,
          universeDefinition: top20.universeDefinition,
          ruleVersion: top20.calculationVersion,
          completeness: metricCompleteness,
          provenance: ratioProv,
        })
        : null,
      eligibleHolderCount: cleaning.universes.cleanedHolderUniverse.ownerCount,
      excludedShare: excludedShare
        ? buildRatioMetric({
          numerator: excludedShare.numerator,
          denominator: excludedShare.denominator,
          universeDefinition: excludedShare.universeDefinition,
          ruleVersion: excludedShare.calculationVersion,
          completeness: metricCompleteness,
          provenance: ratioProv,
        })
        : null,
      ruleVersion: HOLDER_CLEANING_RULE_VERSION,
      completeness: cohortCompleteness,
      warnings: cleaning.judgmentEligible ? [] : ["concentration_partial_or_unconfirmed"],
    },
    walletTokenSignals: [],
    clusterSummaries: [],
    devBehavior: null,
    crossTokenMatches: [],
    judgmentEvidence: cleaning.judgmentEligible
      ? [{
        judgmentCode: "holder_universe_accounting_complete",
        humanReadableSummary: "Owner-aggregated holder universes reconciled against mint supply with complete pagination.",
        evidenceRefs: ["supply_accounting", "cleaned_holder_universe"],
        confidence: 1,
        ruleVersion: HOLDER_CLEANING_RULE_VERSION,
        sourceTier: "A",
        completeness: "complete",
        warnings: [],
        status: "confirmed",
      }]
      : [{
        judgmentCode: "holder_universe_partial_or_unresolved",
        humanReadableSummary: "Holder universes available but pagination/accounting prevents confirmed judgment.",
        evidenceRefs: ["supply_accounting", ...cleaning.accounting.residualReasons],
        confidence: 0.4,
        ruleVersion: HOLDER_CLEANING_RULE_VERSION,
        sourceTier: "A",
        completeness: "partial",
        warnings: ["not_confirmed"],
        status: "unverified",
      }],
    sourceProvenance: [input.mintProvenance, holderProvenance],
    completeness: {
      overall: cleaning.judgmentEligible ? "complete" : "partial",
      ratio: cleaning.judgmentEligible ? 1 : 0.5,
      sections: {
        tokenIdentity: input.decimals !== null ? "complete" : "partial",
        holderUniverses: holderCompleteness,
        cohortMetrics: cohortCompleteness,
        marketSnapshot: "unavailable",
        authorityFacts: "unavailable",
        devBehavior: "unavailable",
      },
    },
    warnings: cleaning.issues
      .filter((i) => i.severity === "error" || i.severity === "blocking" || i.severity === "warning")
      .map((i) => i.code)
      .slice(0, 32),
  };

  return parseCaScanResponseV1(response);
}
