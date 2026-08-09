import type {
  HeliusTokenMetadata,
  RpcMint,
  RpcTokenAccount,
  SolanaHeliusDataSource,
  SourceResponse,
} from "../../infrastructure/solana/helius/helius-solana-adapter.js";
import { normalizeSolanaAddress } from "../../domain/solana-address.js";
import type { JudgmentEvidence } from "../../domain/contracts/ca-scan-response-v1.js";
import type { AnalysisResult } from "../../domain/types.js";
import { AnalysisService } from "../analysis-service.js";
import { AnalysisServiceDeepDiveQueue } from "../hotpath/analysis-deep-dive-queue.js";
import { HOLDER_OWNER_CANDIDATE_LIMIT, type DeepDiveQueue } from "../hotpath/ca-first-screen.js";
import type { AddressLibrary } from "../sedimentation/address-library.js";
import { safeSolanaLiveWarning } from "./solana-live-warning.js";

export { isSolanaAddress } from "../../domain/solana-address.js";

export const SOLANA_LIVE_CA_FIRST_VERSION = "solana-live-ca-first-v1";

export interface SolanaLiveCaFirstSource {
  getMint(ca: string): Promise<SourceResponse<RpcMint | null>>;
  getTokenMetadata(ca: string): Promise<SourceResponse<HeliusTokenMetadata | null>>;
  getTokenAccounts(ca: string): Promise<SourceResponse<RpcTokenAccount[]>>;
}

export interface SolanaLiveCaFirstResult {
  entrypointVersion: typeof SOLANA_LIVE_CA_FIRST_VERSION;
  chain: "solana";
  tokenCa: string;
  status: "OK" | "DEGRADED" | "REJECTED";
  mint: { available: boolean; decimals: number | null };
  metadata: { available: boolean };
  holderTokenAccounts: { available: boolean; count: number | null };
  completeness: {
    state: "complete" | "partial" | "unavailable";
    availableFields: number;
    requiredFields: 3;
  };
  sourceSlots: {
    mintFinalizedSlot: string | null;
    metadataIndexedSlot: string | null;
    holderAccountsIndexedSlot: string | null;
  };
  warnings: string[];
}

export interface SolanaLiveCaFirstCardDeps {
  /** Constructs the read-only Helius boundary after CA validation (fail-closed on missing credentials). */
  sourceFactory: () => SolanaHeliusDataSource;
  /** Builds the AnalysisService over the same source boundary (adapter degrades tags/facts instead of rejecting). */
  analysisFactory: (source: SolanaHeliusDataSource) => AnalysisService;
  /** Address library for holder-owner hits; never written by this entrypoint. */
  library: AddressLibrary;
  /** Deep-dive queue factory; defaults to AnalysisServiceDeepDiveQueue when omitted. */
  deepDiveQueueFactory?: (analysis: AnalysisService) => DeepDiveQueue;
}

export interface SolanaLiveCaFirstCardResult extends SolanaLiveCaFirstResult {
  holderFacts: {
    available: boolean;
    completeness: "complete" | "partial" | "unavailable";
    ownerAggregated: boolean;
    ownerCount: number | null;
    top10Pct: number | null;
    top20Pct: number | null;
    eligibleHolderCount: number | null;
    snapshotFinalizedSlot: string | null;
  };
  libraryHits: Array<{
    address: string;
    labels: string[];
    alphaScoreTier: string | null;
    verificationStatus: "unverified" | "verified";
  }>;
  judgment: JudgmentEvidence[];
  deepDiveEnqueued: boolean;
}

type ReadResult<T> =
  | { ok: true; response: SourceResponse<T> }
  | { ok: false; warning: string };

/**
 * Performs the deliberately narrow, manual first look. It does not invoke an
 * AnalysisService, persistence, queues, caches, address-library lookups, or
 * any inference layer. The caller owns the source; production CLI wiring uses
 * the read-only Helius implementation exclusively.
 */
export async function readSolanaLiveCaFirst(
  tokenCa: string,
  source: SolanaLiveCaFirstSource,
): Promise<SolanaLiveCaFirstResult> {
  const ca = normalizeSolanaAddress(tokenCa);
  if (ca === null) return rejectedResult(tokenCa.trim(), "solana_ca_invalid");
  return readValidatedSolanaLiveCaFirst(ca, source);
}

/** Validates before constructing the runtime source, keeping invalid input away from credentials. */
export async function readSolanaLiveCaFirstWithFactory(
  tokenCa: string,
  sourceFactory: () => SolanaLiveCaFirstSource,
): Promise<SolanaLiveCaFirstResult> {
  const ca = normalizeSolanaAddress(tokenCa);
  if (ca === null) return rejectedResult(tokenCa.trim(), "solana_ca_invalid");
  return readValidatedSolanaLiveCaFirst(ca, sourceFactory());
}

/**
 * Composes the full CA judgment card: bounded summary + AnalysisService
 * judgment + holder-owner address-library hits + deep-dive enqueue. Holder
 * owners (top HOLDER_OWNER_CANDIDATE_LIMIT by balance) drive the library
 * lookup; external labels stay features. Tier-A conclusions are confirmed
 * only when the audited holder snapshot is complete; the deep-dive queue is
 * fed off the hot path (drainAll is the caller's choice).
 */
export async function readSolanaLiveCaFirstCard(
  tokenCa: string,
  deps: SolanaLiveCaFirstCardDeps,
): Promise<SolanaLiveCaFirstCardResult> {
  const ca = normalizeSolanaAddress(tokenCa);
  if (ca === null) return rejectedCardResult(tokenCa.trim(), "solana_ca_invalid");

  const source = deps.sourceFactory();
  const analysis = deps.analysisFactory(source);
  const deepDiveQueue = deps.deepDiveQueueFactory
    ? deps.deepDiveQueueFactory(analysis)
    : new AnalysisServiceDeepDiveQueue(analysis);

  const summary = await readValidatedSolanaLiveCaFirst(ca, source);

  let analysisResult: AnalysisResult | null = null;
  let analysisWarning: string | null = null;
  try {
    analysisResult = await analysis.getQuickAnalysis(ca, { chainHint: "solana" });
  } catch (error) {
    analysisWarning = safeSolanaLiveWarning(error);
  }

  const holderOwners = holderOwnersFrom(analysisResult).slice(0, HOLDER_OWNER_CANDIDATE_LIMIT);
  let libraryDegraded = false;
  const [libraryHits, deepDiveEnqueued] = await Promise.all([
    deps.library.lookupByAddresses("solana", holderOwners)
      .then((records) => records.map((wallet) => ({
        address: wallet.address,
        labels: [...wallet.labels],
        alphaScoreTier: wallet.alphaScoreTier ?? null,
        verificationStatus: wallet.verificationStatus,
      })))
      .catch(() => {
        libraryDegraded = true;
        return [];
      }),
    deepDiveQueue.enqueue(ca).then(() => true).catch(() => false),
  ]);

  const degraded = summary.status !== "OK"
    || analysisResult === null
    || analysisResult.holderCompleteness !== "complete"
    || !deepDiveEnqueued
    || libraryDegraded;

  return {
    ...summary,
    status: degraded ? "DEGRADED" : "OK",
    holderFacts: holderFactsFrom(analysisResult),
    libraryHits,
    judgment: buildJudgment(summary, analysisResult, analysisWarning),
    deepDiveEnqueued,
    warnings: [
      ...summary.warnings,
      ...(analysisWarning ? [analysisWarning] : []),
      ...(analysisResult?.warnings ?? []),
      ...(deepDiveEnqueued ? [] : ["deep_dive_enqueue_failed"]),
      ...(libraryDegraded ? ["address_library_unavailable"] : []),
    ],
  };
}

async function readValidatedSolanaLiveCaFirst(
  ca: string,
  source: SolanaLiveCaFirstSource,
): Promise<SolanaLiveCaFirstResult> {
  const [mint, metadata, accounts] = await Promise.all([
    safelyRead(() => source.getMint(ca)),
    safelyRead(() => source.getTokenMetadata(ca)),
    safelyRead(() => source.getTokenAccounts(ca)),
  ]);

  const mintAvailable = mint.ok && mint.response.data !== null;
  const metadataAvailable = metadata.ok && metadata.response.data !== null;
  const accountsAvailable = accounts.ok;
  const availableFields = [mintAvailable, metadataAvailable, accountsAvailable].filter(Boolean).length;
  const warnings = [
    ...(mint.ok ? (mint.response.data === null ? ["helius_mint_not_found"] : []) : [mint.warning]),
    ...(metadata.ok ? (metadata.response.data === null ? ["helius_metadata_not_found"] : []) : [metadata.warning]),
    ...(accounts.ok ? (accounts.response.watermark.completeness === "partial" ? ["helius_holder_accounts_partial"] : []) : [accounts.warning]),
  ];
  const complete = availableFields === 3
    && accounts.ok
    && accounts.response.watermark.completeness === "complete";

  return {
    entrypointVersion: SOLANA_LIVE_CA_FIRST_VERSION,
    chain: "solana",
    tokenCa: ca,
    status: complete ? "OK" : "DEGRADED",
    mint: {
      available: mintAvailable,
      decimals: mint.ok && mint.response.data !== null ? mint.response.data.decimals : null,
    },
    metadata: { available: metadataAvailable },
    holderTokenAccounts: {
      available: accountsAvailable,
      count: accountsAvailable && accounts.ok ? accounts.response.data.length : null,
    },
    completeness: {
      state: complete ? "complete" : availableFields === 0 ? "unavailable" : "partial",
      availableFields,
      requiredFields: 3,
    },
    sourceSlots: {
      mintFinalizedSlot: mint.ok ? slot(mint.response) : null,
      metadataIndexedSlot: metadata.ok ? slot(metadata.response) : null,
      holderAccountsIndexedSlot: accounts.ok ? slot(accounts.response) : null,
    },
    warnings,
  };
}

async function safelyRead<T>(read: () => Promise<SourceResponse<T>>): Promise<ReadResult<T>> {
  try {
    return { ok: true, response: await read() };
  } catch (error) {
    return { ok: false, warning: safeSolanaLiveWarning(error) };
  }
}

function slot(response: SourceResponse<unknown>): string | null {
  return response.watermark.finalizedSlot?.toString() ?? null;
}

function holderOwnersFrom(analysis: AnalysisResult | null): string[] {
  const balances = analysis?.solanaEvidence?.holderSnapshot?.ownerBalances;
  if (!balances) return [];
  return [...balances]
    .sort((a, b) => (a.balanceRaw > b.balanceRaw ? -1 : a.balanceRaw < b.balanceRaw ? 1 : 0))
    .map((entry) => entry.owner);
}

function holderFactsFrom(analysis: AnalysisResult | null): SolanaLiveCaFirstCardResult["holderFacts"] {
  const snapshot = analysis?.solanaEvidence?.holderSnapshot ?? null;
  if (snapshot === null) {
    return {
      available: false,
      completeness: analysis?.holderCompleteness ?? "unavailable",
      ownerAggregated: false,
      ownerCount: null,
      top10Pct: null,
      top20Pct: null,
      eligibleHolderCount: null,
      snapshotFinalizedSlot: null,
    };
  }
  const concentration = analysis!.holders ?? null;
  const slot = snapshot.watermarks.find((watermark) => watermark.finalizedSlot !== undefined)?.finalizedSlot ?? null;
  return {
    available: true,
    completeness: analysis!.holderCompleteness,
    ownerAggregated: true,
    ownerCount: snapshot.ownerBalances.length,
    top10Pct: concentration?.top10Pct ?? null,
    top20Pct: concentration?.top20Pct ?? null,
    eligibleHolderCount: concentration?.eligibleHolderCount ?? null,
    snapshotFinalizedSlot: slot === null ? null : slot.toString(),
  };
}

function buildJudgment(
  summary: SolanaLiveCaFirstResult,
  analysis: AnalysisResult | null,
  analysisWarning: string | null,
): JudgmentEvidence[] {
  const items: JudgmentEvidence[] = [];

  items.push(summary.completeness.state === "complete"
    ? {
      judgmentCode: "ca_live_read_complete",
      humanReadableSummary: "Mint, metadata, and holder token accounts were all read from the Helius boundary.",
      evidenceRefs: ["mint", "metadata", "holder_token_accounts"],
      confidence: 1,
      ruleVersion: SOLANA_LIVE_CA_FIRST_VERSION,
      sourceTier: "A",
      completeness: "complete",
      warnings: [],
      status: "confirmed",
    }
    : {
      judgmentCode: "ca_live_read_partial",
      humanReadableSummary: "One or more bounded Helius reads were unavailable; the card is partial.",
      evidenceRefs: [],
      confidence: 0.3,
      ruleVersion: SOLANA_LIVE_CA_FIRST_VERSION,
      sourceTier: "A",
      completeness: summary.completeness.state,
      warnings: summary.warnings,
      status: "unverified",
    });

  if (analysis === null) {
    items.push({
      judgmentCode: "ca_analysis_unavailable",
      humanReadableSummary: "AnalysisService could not produce holder facts for this CA.",
      evidenceRefs: [],
      confidence: 0,
      ruleVersion: SOLANA_LIVE_CA_FIRST_VERSION,
      sourceTier: "A",
      completeness: "unavailable",
      warnings: analysisWarning ? [analysisWarning] : ["analysis_service_unavailable"],
      status: "unverified",
    });
    return items;
  }

  if (analysis.holderCompleteness === "complete" && analysis.holders !== null) {
    const exclusionInputsPresent = analysis.walletCleaningEvidence?.holderExclusionInputsPresent === true;
    if (exclusionInputsPresent) {
      items.push({
        judgmentCode: "holder_concentration_confirmed",
        humanReadableSummary: "Holder concentration is confirmed from a complete owner-aggregated audited snapshot.",
        evidenceRefs: ["audited_holder_snapshot_complete", "owner_aggregation"],
        confidence: 1,
        ruleVersion: SOLANA_LIVE_CA_FIRST_VERSION,
        sourceTier: "A",
        completeness: "complete",
        warnings: [],
        status: "confirmed",
      });
    } else {
      // Fail closed: the owner enumeration is complete, but without exclusion
      // inputs (tags/clusters) the concentration may count addresses that
      // would otherwise be excluded, so it must never be confirmed.
      items.push({
        judgmentCode: "holder_concentration_partial",
        humanReadableSummary: "Holder concentration is not confirmed: the complete owner set was aggregated without any exclusion inputs (tags/clusters missing or empty).",
        evidenceRefs: ["audited_holder_snapshot_complete", "exclusion_inputs_missing"],
        confidence: 0.4,
        ruleVersion: SOLANA_LIVE_CA_FIRST_VERSION,
        sourceTier: "A",
        completeness: "complete",
        warnings: [...analysis.warnings, "HOLDER_EXCLUSION_INPUTS_MISSING"],
        status: "unverified",
      });
    }
  } else if (analysis.holderCompleteness === "partial") {
    items.push({
      judgmentCode: "holder_concentration_partial",
      humanReadableSummary: "Holder concentration is partial and must not be treated as conclusive.",
      evidenceRefs: ["audited_holder_snapshot_partial"],
      confidence: 0.4,
      ruleVersion: SOLANA_LIVE_CA_FIRST_VERSION,
      sourceTier: "A",
      completeness: "partial",
      warnings: analysis.warnings,
      status: "unverified",
    });
  } else {
    items.push({
      judgmentCode: "holder_concentration_indeterminate",
      humanReadableSummary: "Holder concentration is indeterminate: a complete audited owner snapshot is unavailable.",
      evidenceRefs: ["audited_holder_snapshot_unavailable"],
      confidence: 0,
      ruleVersion: SOLANA_LIVE_CA_FIRST_VERSION,
      sourceTier: "A",
      completeness: "unavailable",
      warnings: analysis.warnings,
      status: "unverified",
    });
  }

  return items;
}

function rejectedCardResult(tokenCa: string, warning: string): SolanaLiveCaFirstCardResult {
  return {
    ...rejectedResult(tokenCa, warning),
    holderFacts: {
      available: false,
      completeness: "unavailable",
      ownerAggregated: false,
      ownerCount: null,
      top10Pct: null,
      top20Pct: null,
      eligibleHolderCount: null,
      snapshotFinalizedSlot: null,
    },
    libraryHits: [],
    judgment: [],
    deepDiveEnqueued: false,
  };
}

function rejectedResult(tokenCa: string, warning: string): SolanaLiveCaFirstResult {
  return {
    entrypointVersion: SOLANA_LIVE_CA_FIRST_VERSION,
    chain: "solana",
    tokenCa,
    status: "REJECTED",
    mint: { available: false, decimals: null },
    metadata: { available: false },
    holderTokenAccounts: { available: false, count: null },
    completeness: { state: "unavailable", availableFields: 0, requiredFields: 3 },
    sourceSlots: {
      mintFinalizedSlot: null,
      metadataIndexedSlot: null,
      holderAccountsIndexedSlot: null,
    },
    warnings: [warning],
  };
}
