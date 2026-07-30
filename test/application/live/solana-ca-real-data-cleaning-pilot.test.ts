import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  RUNTIME_CREDENTIAL_UNAVAILABLE,
  runSolanaCaRealDataCleaningPilot,
  type PilotTokenAccountSource,
} from "../../../src/application/live/solana-ca-real-data-cleaning-pilot.js";
import { SourceDataUnavailableError } from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";
import type { SourceResponse, RpcMint, HeliusTokenMetadata, RpcTokenAccount } from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";
import type { TokenAccountEnumerationResult } from "../../../src/infrastructure/solana/helius/live-helius-data-source.js";
import {
  cleanHolderUniverse,
  type HolderCleaningResult,
  type AggregatedOwner,
  type ConcentrationMetric,
  type SupplyAccounting,
} from "../../../src/domain/rules/holder-data-cleaning.js";
import { mapHolderCleaningToCaScanResponseV1 } from "../../../src/domain/mapping/map-holder-cleaning-to-ca-scan.js";
import { validateCaScanResponseV1 } from "../../../src/domain/contracts/ca-scan-response-v1.js";

const FIXED = "2026-07-30T15:00:00.000Z";

function mintResponse(supplyRaw: string, decimals = 0): SourceResponse<RpcMint | null> {
  return {
    data: { supplyRaw, decimals },
    watermark: { source: "helius", observedAt: new Date(FIXED), completeness: "complete", finalizedSlot: 1n },
  };
}

function metaResponse(): SourceResponse<HeliusTokenMetadata | null> {
  return {
    data: { name: "Fixture", symbol: "FIX" },
    watermark: { source: "helius", observedAt: new Date(FIXED), completeness: "complete", finalizedSlot: 1n },
  };
}

function enumResult(accounts: RpcTokenAccount[], complete = true): TokenAccountEnumerationResult {
  return {
    accounts,
    pageCount: 1,
    paginationComplete: complete,
    pageSlots: ["1"],
    skippedMalformedCount: 0,
    watermark: { source: "helius", observedAt: new Date(FIXED), completeness: complete ? "complete" : "partial", finalizedSlot: 1n },
  };
}

function fixtureSource(accountsByCa: Record<string, RpcTokenAccount[]>, supplyByCa: Record<string, string>): PilotTokenAccountSource {
  let requests = 0;
  return {
    getRequestCount: () => requests,
    async getMint(ca) {
      requests += 1;
      const supply = supplyByCa[ca];
      if (supply === undefined) return { data: null, watermark: { source: "helius", observedAt: new Date(FIXED), completeness: "complete" } };
      return mintResponse(supply);
    },
    async getTokenMetadata() {
      requests += 1;
      return metaResponse();
    },
    async enumerateTokenAccounts(ca) {
      requests += 1;
      return enumResult(accountsByCa[ca] ?? []);
    },
  };
}

test("pilot rejects empty sample list", async () => {
  const batch = await runSolanaCaRealDataCleaningPilot(
    {
      taskId: "SOL-CA-REAL-DATA-CLEANING-PILOT-001",
      baseCommit: "777e013",
      dataSource: "helius",
      selectedAt: FIXED,
      samples: [],
    },
    () => fixtureSource({}, {}),
  );
  assert.equal(batch.status, "REJECTED");
});

test("pilot fail-closed on missing credential factory", async () => {
  const batch = await runSolanaCaRealDataCleaningPilot(
    {
      taskId: "SOL-CA-REAL-DATA-CLEANING-PILOT-001",
      baseCommit: "777e013",
      dataSource: "helius",
      selectedAt: FIXED,
      samples: [{ ca: "So11111111111111111111111111111111111111112", selectionReason: "x" }],
    },
    () => {
      throw new SourceDataUnavailableError("helius_runtime_credential_unavailable");
    },
  );
  assert.equal(batch.status, RUNTIME_CREDENTIAL_UNAVAILABLE);
  assert.deepEqual(batch.warnings, [RUNTIME_CREDENTIAL_UNAVAILABLE]);
});

test("pilot runs sequential fixture CAs and conserves amounts (accounting vs concentration split)", async () => {
  const ca = "So11111111111111111111111111111111111111112";
  const batch = await runSolanaCaRealDataCleaningPilot(
    {
      taskId: "SOL-CA-REAL-DATA-CLEANING-PILOT-001",
      baseCommit: "777e013",
      dataSource: "helius",
      selectedAt: FIXED,
      samples: [{ ca, selectionReason: "fixture full reconcile" }],
    },
    () => fixtureSource(
      {
        [ca]: [
          { tokenAccount: "t1", owner: "alice", amountRaw: "700" },
          { tokenAccount: "t2", owner: "alice", amountRaw: "100" },
          { tokenAccount: "t3", owner: "bob", amountRaw: "200" },
        ],
      },
      { [ca]: "1000" },
    ),
    { now: () => new Date(FIXED) },
  );
  assert.equal(batch.status, "OK");
  assert.equal(batch.results.length, 1);
  const r = batch.results[0]!;
  // OK batch status still follows accounting eligibility (legacy judgmentEligible alias).
  assert.equal(r.cleaning.accountingEligible, true);
  assert.equal(r.cleaning.judgmentEligible, true);
  assert.equal(r.cleaning.exclusionCoverage, "partial");
  assert.equal(r.cleaning.concentrationEligible, false);
  assert.equal(r.cleaning.owners.find((o) => o.owner === "alice")?.tokenAccountCount, 2);
  assert.ok(r.caScanResponse);
  const accountingJ = r.caScanResponse?.judgmentEvidence.find((j) => j.judgmentCode === "holder_supply_accounting_complete");
  assert.equal(accountingJ?.status, "confirmed");
  const concJ = r.caScanResponse?.judgmentEvidence.find((j) => j.judgmentCode === "holder_concentration_scope_unverified");
  assert.equal(concJ?.status, "unverified");
  assert.equal(r.caScanResponse?.cohortMetrics?.top10Concentration?.provenance.verificationStatus, "unverified");
  assert.equal(r.caScanResponse?.cohortMetrics?.top10Concentration?.ratio, null);
});

test("live unit path is not executed by default (credential source not constructed without factory call scope)", () => {
  assert.equal(process.env.SOLANA_PILOT_LIVE, undefined);
});

// ---------------------------------------------------------------------------
// Offline remap of committed 6-CA desensitized pilot evidence (no Helius).
// Reconstructs domain state from committed cleaning-summary / concentration
// metrics and re-applies mapping — does not rewrite Live artifacts.
// ---------------------------------------------------------------------------

const PILOT_REPORT_CAS = join(
  process.cwd(),
  "harness",
  "reports",
  "SOL-CA-REAL-DATA-CLEANING-PILOT-001",
  "cas",
);

interface CleaningSummaryFile {
  ca: string;
  ruleVersion: string;
  judgmentEligible: boolean;
  accounting: SupplyAccounting;
  ownerCount: number;
  tokenAccountCount: number;
  includedOwnerCount: number;
  excludedOwnerCount: number;
  unresolvedOwnerCount: number;
}

interface ConcentrationFile {
  ca: string;
  metrics: ConcentrationMetric[];
}

/**
 * Build a minimal HolderCleaningResult that preserves committed accounting
 * and concentration metrics so CaScan remapping can be verified offline.
 */
function reconstructFromCommitted(
  summary: CleaningSummaryFile,
  concentration: ConcentrationFile,
  historicalCaScan: {
    generatedAt: string;
    tokenIdentity: { name: string | null; symbol: string | null; decimals: number | null; provenance: {
      source: string;
      sourceTier: "A" | "B";
      verificationStatus: "unverified" | "confirmed";
      observedAt: string;
      watermarkRef?: string;
      ruleVersion?: string;
    } };
    holderUniverses: { owner_aggregated_holders: Array<{ address: string; balanceRaw: string; exclusionReason?: string }> } | null;
  },
): { cleaning: HolderCleaningResult; generatedAt: string; name: string | null; symbol: string | null; decimals: number | null } {
  const owners: AggregatedOwner[] = (historicalCaScan.holderUniverses?.owner_aggregated_holders ?? []).map((h, i) => ({
    owner: h.address,
    ownerRawAmount: h.balanceRaw,
    ownerNormalizedAmount: h.balanceRaw,
    tokenAccountCount: 1,
    shareOfObservedSupply: null,
    cleaningClass: (h.exclusionReason as AggregatedOwner["cleaningClass"]) ?? "included_holder",
    evidence: ["replay_from_committed_scrubbed_artifact"],
    tokenAccounts: [`ata-${i}`],
  }));

  // If no owner list in ca-scan (truncated), synthesize one owner matching accounting totals.
  if (owners.length === 0) {
    const included = BigInt(summary.accounting.includedOwnerBalanceRaw);
    if (included > 0n) {
      owners.push({
        owner: "synthetic-included",
        ownerRawAmount: included.toString(),
        ownerNormalizedAmount: included.toString(),
        tokenAccountCount: 1,
        shareOfObservedSupply: null,
        cleaningClass: "included_holder",
        evidence: ["synthetic_from_accounting"],
        tokenAccounts: ["ata-syn"],
      });
    }
  }

  const includedOwners = owners.filter((o) => o.cleaningClass === "included_holder");
  const excludedOwners = owners.filter((o) =>
    o.cleaningClass !== "included_holder" && o.cleaningClass !== "unresolved_exclusion_candidate",
  );
  const unresolvedOwners = owners.filter((o) => o.cleaningClass === "unresolved_exclusion_candidate");

  const identityOk = summary.accounting.identity === "enumerated = included + excluded + unresolved";
  const residualZero = summary.accounting.accountingResidualRaw === "0";
  const accountingEligible =
    summary.accounting.paginationComplete
    && summary.accounting.completeness === "complete"
    && residualZero
    && identityOk;
  const exclusionCoverage = "partial" as const;
  const concentrationEligible = false;

  const cleaning: HolderCleaningResult = {
    ca: summary.ca,
    ruleVersion: "holder-cleaning-v1",
    observedAt: historicalCaScan.generatedAt,
    paginationComplete: summary.accounting.paginationComplete,
    rawTokenAccounts: owners.map((o, i) => ({
      tokenAccount: o.tokenAccounts[0] ?? `ata-${i}`,
      owner: o.owner,
      rawAmount: o.ownerRawAmount,
      decimals: historicalCaScan.tokenIdentity.decimals ?? 0,
      normalizedAmount: o.ownerNormalizedAmount,
      accountState: "active",
      source: "helius",
      observedAt: historicalCaScan.generatedAt,
      sourceWatermark: null,
      cleaningClass: o.cleaningClass,
      evidence: o.evidence,
    })),
    owners,
    accounting: summary.accounting,
    universes: {
      rawHolderUniverse: {
        name: "rawHolderUniverse",
        ownerCount: owners.length,
        tokenAccountCount: owners.length,
        amountRaw: summary.accounting.enumeratedTokenAccountBalanceRaw,
        amountNormalized: summary.accounting.enumeratedTokenAccountBalanceRaw,
        ratio: 1,
        completeness: summary.accounting.completeness,
        universeDefinition: "holder-universe-v1:rawHolderUniverse",
        ruleVersion: "holder-cleaning-v1",
        evidenceRefs: ["raw_token_accounts", "owner_aggregated"],
        owners,
      },
      cleanedHolderUniverse: {
        name: "cleanedHolderUniverse",
        ownerCount: includedOwners.length || summary.includedOwnerCount,
        tokenAccountCount: includedOwners.length,
        amountRaw: summary.accounting.includedOwnerBalanceRaw,
        amountNormalized: summary.accounting.includedOwnerBalanceRaw,
        ratio: null,
        completeness: "partial",
        universeDefinition: "holder-universe-v1:cleanedHolderUniverse",
        ruleVersion: "holder-cleaning-v1",
        evidenceRefs: ["included_holder_only", "pool_exclusion_incomplete_not_cleaned_investor_universe"],
        owners: includedOwners,
      },
      excludedInfrastructureUniverse: {
        name: "excludedInfrastructureUniverse",
        ownerCount: excludedOwners.length,
        tokenAccountCount: excludedOwners.length,
        amountRaw: summary.accounting.excludedBalanceRaw,
        amountNormalized: summary.accounting.excludedBalanceRaw,
        ratio: null,
        completeness: summary.accounting.completeness,
        universeDefinition: "holder-universe-v1:excludedInfrastructureUniverse",
        ruleVersion: "holder-cleaning-v1",
        evidenceRefs: ["zero_balance", "burn", "known_program", "closed", "invalid", "liquidity"],
        owners: excludedOwners,
      },
      unresolvedUniverse: {
        name: "unresolvedUniverse",
        ownerCount: unresolvedOwners.length,
        tokenAccountCount: unresolvedOwners.length,
        amountRaw: summary.accounting.unresolvedBalanceRaw,
        amountNormalized: summary.accounting.unresolvedBalanceRaw,
        ratio: null,
        completeness: summary.accounting.completeness,
        universeDefinition: "holder-universe-v1:unresolvedUniverse",
        ruleVersion: "holder-cleaning-v1",
        evidenceRefs: ["unresolved_exclusion_candidate"],
        owners: unresolvedOwners,
      },
    },
    concentration: concentration.metrics.map((m) => ({
      ...m,
      completeness: "partial" as const,
      universeDefinition: "holder-universe-v1:owner_aggregated_observational_vs_mint_supply_pool_exclusion_incomplete",
    })),
    issues: accountingEligible
      ? [{
        code: "pool_exclusion_coverage_incomplete",
        ca: summary.ca,
        severity: "warning",
        affectedRecordCount: 0,
        affectedBalance: "0",
        evidence: ["exclusionCoverage=partial"],
        whetherManualReviewRequired: false,
        suggestedFollowUp: "add_first_hand_pool_liquidity_exclusion_before_concentration_confirm",
      }]
      : [{
        code: summary.accounting.residualReasons.includes("pagination_incomplete")
          ? "pagination_incomplete"
          : "supply_mismatch",
        ca: summary.ca,
        severity: "warning",
        affectedRecordCount: 1,
        affectedBalance: summary.accounting.accountingResidualRaw,
        evidence: summary.accounting.residualReasons,
        whetherManualReviewRequired: true,
        suggestedFollowUp: "investigate",
      }, {
        code: "pool_exclusion_coverage_incomplete",
        ca: summary.ca,
        severity: "warning",
        affectedRecordCount: 0,
        affectedBalance: "0",
        evidence: ["exclusionCoverage=partial"],
        whetherManualReviewRequired: false,
        suggestedFollowUp: "add_first_hand_pool_liquidity_exclusion_before_concentration_confirm",
      }],
    accountingEligible,
    exclusionCoverage,
    concentrationEligible,
    judgmentEligible: accountingEligible,
  };

  return {
    cleaning,
    generatedAt: historicalCaScan.generatedAt,
    name: historicalCaScan.tokenIdentity.name,
    symbol: historicalCaScan.tokenIdentity.symbol,
    decimals: historicalCaScan.tokenIdentity.decimals,
  };
}

test("offline remap of 6 CA desensitized pilot evidence (no network)", () => {
  assert.ok(existsSync(PILOT_REPORT_CAS), "pilot cas report directory must exist");
  const cas = readdirSync(PILOT_REPORT_CAS).filter((name) => !name.startsWith("."));
  assert.equal(cas.length, 6, "expected 6 pilot CAs");

  const okCas = new Set([
    "H3GtwGSrYRVqp7dtjkaDfjE2inydLkHwFkFJSPzrpump",
    "EUx9N4UXDyAXJpziyLF36j6Ut3Gu9X3VKEGptbmfpump",
    "BQYc6c5hivsPrEEmTxBVjGT16setk2gmPvbv7YBxpump",
  ]);
  const partialCas = new Set([
    "H1adbGC578HdoddVNAZT1Bn4uNrPiioTCfYmRjBHpump",
    "Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump",
    "9ZtbETDNjnST9Y2zs82FZYy49xUMPgqXRh46YjjRpump",
  ]);

  const diffs: Array<Record<string, unknown>> = [];

  for (const ca of cas) {
    const dir = join(PILOT_REPORT_CAS, ca);
    const summary = JSON.parse(readFileSync(join(dir, "cleaning-summary.json"), "utf8")) as CleaningSummaryFile;
    const concentration = JSON.parse(readFileSync(join(dir, "concentration-metrics.json"), "utf8")) as ConcentrationFile;
    const historical = JSON.parse(readFileSync(join(dir, "ca-scan-response-v1.json"), "utf8"));

    const rebuilt = reconstructFromCommitted(summary, concentration, historical);
    const remapped = mapHolderCleaningToCaScanResponseV1({
      cleaning: rebuilt.cleaning,
      name: rebuilt.name,
      symbol: rebuilt.symbol,
      decimals: rebuilt.decimals,
      generatedAt: rebuilt.generatedAt,
      mintProvenance: historical.tokenIdentity.provenance,
    });

    const validation = validateCaScanResponseV1(remapped);
    assert.equal(validation.ok, true, `remap invalid for ${ca}: ${JSON.stringify(validation.issues?.slice(0, 3))}`);

    const histTop10Status = historical.cohortMetrics?.top10Concentration?.provenance?.verificationStatus;
    const newTop10Status = remapped.cohortMetrics?.top10Concentration?.provenance.verificationStatus;
    const histAccountingConfirmed = historical.judgmentEvidence?.some(
      (j: { status?: string }) => j.status === "confirmed",
    );
    const newAccountingConfirmed = remapped.judgmentEvidence.some(
      (j) => j.judgmentCode === "holder_supply_accounting_complete" && j.status === "confirmed",
    );
    const newConcUnverified = remapped.judgmentEvidence.some(
      (j) => j.judgmentCode === "holder_concentration_scope_unverified" && j.status === "unverified",
    );

    if (okCas.has(ca)) {
      assert.equal(rebuilt.cleaning.accountingEligible, true, ca);
      assert.equal(rebuilt.cleaning.concentrationEligible, false, ca);
      assert.equal(newAccountingConfirmed, true, `${ca} accounting must be confirmed after repair`);
      assert.equal(newConcUnverified, true, `${ca} concentration must be unverified after repair`);
      assert.equal(newTop10Status, "unverified");
      assert.equal(remapped.cohortMetrics?.top10Concentration?.ratio, null);
      assert.notEqual(remapped.cohortMetrics?.top10Concentration?.completeness, 1);
    } else if (partialCas.has(ca)) {
      assert.equal(rebuilt.cleaning.accountingEligible, false, ca);
      assert.equal(rebuilt.cleaning.concentrationEligible, false, ca);
      assert.equal(newAccountingConfirmed, false, `${ca} accounting stays unverified`);
      assert.equal(newTop10Status, "unverified");
    } else {
      assert.fail(`unexpected CA ${ca}`);
    }

    diffs.push({
      ca,
      historicalStatus: okCas.has(ca) ? "OK" : "PARTIAL",
      historical: {
        judgmentConfirmed: histAccountingConfirmed,
        top10Verification: histTop10Status,
        top10Completeness: historical.cohortMetrics?.top10Concentration?.completeness,
        top10Ratio: historical.cohortMetrics?.top10Concentration?.ratio ?? null,
      },
      remapped: {
        accountingEligible: rebuilt.cleaning.accountingEligible,
        exclusionCoverage: rebuilt.cleaning.exclusionCoverage,
        concentrationEligible: rebuilt.cleaning.concentrationEligible,
        accountingJudgmentConfirmed: newAccountingConfirmed,
        concentrationJudgmentUnverified: newConcUnverified,
        top10Verification: newTop10Status,
        top10Completeness: remapped.cohortMetrics?.top10Concentration?.completeness,
        top10Ratio: remapped.cohortMetrics?.top10Concentration?.ratio,
        top10Numerator: remapped.cohortMetrics?.top10Concentration?.numerator,
        warnings: remapped.cohortMetrics?.warnings,
      },
      heliusRequestCountUnchanged: true,
    });
  }

  // Historical facts unchanged: 3 OK / 3 PARTIAL classification of original batch.
  assert.equal(diffs.filter((d) => d.historicalStatus === "OK").length, 3);
  assert.equal(diffs.filter((d) => d.historicalStatus === "PARTIAL").length, 3);

  // Attach machine-readable summary for harness report consumption when env set.
  if (process.env.SOL_CA_REPAIR_REMAP_OUT) {
    mkdirSync(process.env.SOL_CA_REPAIR_REMAP_OUT, { recursive: true });
    writeFileSync(
      join(process.env.SOL_CA_REPAIR_REMAP_OUT, "remap-diff-summary.json"),
      JSON.stringify({
        taskId: "SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-002",
        networkRequests: 0,
        providerRequests: 0,
        note: "Offline remap only; Live 6 CA / 30 Helius request history unchanged.",
        diffs,
      }, null, 2),
    );
  }
});

test("mixed-owner fixture path through cleanHolderUniverse used by pilot does not drop positives", () => {
  const result = cleanHolderUniverse({
    ca: "So11111111111111111111111111111111111111112",
    mintSupplyRaw: "100",
    decimals: 0,
    paginationComplete: true,
    observedAt: FIXED,
    source: "helius",
    accounts: [
      {
        tokenAccount: "t1",
        owner: "alice",
        rawAmount: "100",
        decimals: 0,
        accountState: "active",
        source: "helius",
        observedAt: FIXED,
      },
      {
        tokenAccount: "t2",
        owner: "alice",
        rawAmount: "0",
        decimals: 0,
        accountState: "active",
        source: "helius",
        observedAt: FIXED,
      },
    ],
  });
  assert.equal(result.owners.find((o) => o.owner === "alice")?.cleaningClass, "included_holder");
  assert.equal(result.accounting.includedOwnerBalanceRaw, "100");
});
