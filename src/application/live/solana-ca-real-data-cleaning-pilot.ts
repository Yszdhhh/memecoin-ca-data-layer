import { createHash } from "node:crypto";
import {
  cleanHolderUniverse,
  stableSerialize,
  type HolderCleaningResult,
  type RawTokenAccountObservation,
} from "../../domain/rules/holder-data-cleaning.js";
import { mapHolderCleaningToCaScanResponseV1 } from "../../domain/mapping/map-holder-cleaning-to-ca-scan.js";
import type { CaScanResponseV1, SourceProvenance } from "../../domain/contracts/ca-scan-response-v1.js";
import { normalizeSolanaAddress } from "../../domain/solana-address.js";
import type {
  HeliusTokenMetadata,
  RpcMint,
  RpcTokenAccount,
  SourceResponse,
  SourceWatermark,
} from "../../infrastructure/solana/helius/helius-solana-adapter.js";
import { SourceDataUnavailableError } from "../../infrastructure/solana/helius/helius-solana-adapter.js";
import type { TokenAccountEnumerationResult } from "../../infrastructure/solana/helius/live-helius-data-source.js";
import { safeSolanaLiveWarning } from "./solana-live-warning.js";

export const SOLANA_CA_REAL_DATA_CLEANING_PILOT_VERSION = "sol-ca-real-data-cleaning-pilot-v1";
export const RUNTIME_CREDENTIAL_UNAVAILABLE = "RUNTIME_CREDENTIAL_UNAVAILABLE";

export interface PilotSampleCa {
  ca: string;
  selectionReason: string;
}

export interface PilotInputManifest {
  taskId: string;
  baseCommit: string;
  dataSource: "helius";
  selectedAt: string;
  samples: PilotSampleCa[];
}

export interface PilotTokenAccountSource {
  getMint(ca: string): Promise<SourceResponse<RpcMint | null>>;
  getTokenMetadata(ca: string): Promise<SourceResponse<HeliusTokenMetadata | null>>;
  enumerateTokenAccounts(
    ca: string,
    options?: { maxPages?: number; pageSize?: number; showZeroBalance?: boolean },
  ): Promise<TokenAccountEnumerationResult>;
  getRequestCount?(): number;
}

export interface PerCaPilotArtifacts {
  ca: string;
  status: "OK" | "PARTIAL" | "REJECTED";
  heliusRequestCount: number;
  paginationComplete: boolean;
  sourceWatermark: string | null;
  queryTime: string;
  cleaning: HolderCleaningResult;
  caScanResponse: CaScanResponseV1 | null;
  inputManifest: Record<string, unknown>;
  cleaningSummary: Record<string, unknown>;
  holderUniverses: Record<string, unknown>;
  concentrationMetrics: Record<string, unknown>;
  dataQualityIssues: Record<string, unknown>;
  warnings: string[];
}

export interface PilotBatchResult {
  taskId: string;
  version: typeof SOLANA_CA_REAL_DATA_CLEANING_PILOT_VERSION;
  status: "OK" | "PARTIAL" | "REJECTED" | "RUNTIME_CREDENTIAL_UNAVAILABLE";
  baseCommit: string;
  results: PerCaPilotArtifacts[];
  batchSummary: Record<string, unknown>;
  warnings: string[];
}

export interface RunPilotOptions {
  maxPagesPerCa?: number;
  pageSize?: number;
  showZeroBalance?: boolean;
  now?: () => Date;
}

function watermarkRef(wm: SourceWatermark | undefined): string | null {
  if (!wm) return null;
  const parts = [
    wm.source,
    wm.finalizedSlot?.toString() ?? "no_slot",
    wm.completeness,
    wm.cursor ?? "no_cursor",
  ];
  return parts.join("|");
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function hashStable(value: unknown): string {
  return sha256(stableSerialize(value));
}

function scrubbedProvenance(source: string, observedAt: string, watermark: string | null): SourceProvenance {
  return {
    source,
    sourceTier: "A",
    verificationStatus: "unverified",
    observedAt,
    ...(watermark ? { watermarkRef: watermark } : {}),
    ruleVersion: SOLANA_CA_REAL_DATA_CLEANING_PILOT_VERSION,
  };
}

function observationsFromAccounts(
  accounts: RpcTokenAccount[],
  decimals: number,
  source: string,
  observedAt: string,
  sourceWatermark: string | null,
): RawTokenAccountObservation[] {
  return accounts.map((a) => ({
    tokenAccount: a.tokenAccount,
    owner: a.owner,
    rawAmount: a.amountRaw,
    decimals,
    accountState: BigInt(a.amountRaw) === 0n ? "zero" : "active",
    source,
    observedAt,
    sourceWatermark,
  }));
}

function buildPerCaArtifacts(
  ca: string,
  queryTime: string,
  heliusRequestCount: number,
  paginationComplete: boolean,
  sourceWatermark: string | null,
  cleaning: HolderCleaningResult,
  caScanResponse: CaScanResponseV1 | null,
  selectionReason: string,
  baseCommit: string,
  warnings: string[],
): PerCaPilotArtifacts {
  const status: PerCaPilotArtifacts["status"] = caScanResponse === null
    ? "REJECTED"
    : cleaning.judgmentEligible
      ? "OK"
      : "PARTIAL";

  return {
    ca,
    status,
    heliusRequestCount,
    paginationComplete,
    sourceWatermark,
    queryTime,
    cleaning,
    caScanResponse,
    inputManifest: {
      ca,
      selectionReason,
      queryTime,
      baseCommit,
      dataSource: "helius",
      heliusRequestCount,
      paginationComplete,
      sourceWatermark,
    },
    cleaningSummary: {
      ca,
      ruleVersion: cleaning.ruleVersion,
      judgmentEligible: cleaning.judgmentEligible,
      accounting: cleaning.accounting,
      ownerCount: cleaning.owners.length,
      tokenAccountCount: cleaning.rawTokenAccounts.length,
      includedOwnerCount: cleaning.universes.cleanedHolderUniverse.ownerCount,
      excludedOwnerCount: cleaning.universes.excludedInfrastructureUniverse.ownerCount,
      unresolvedOwnerCount: cleaning.universes.unresolvedUniverse.ownerCount,
    },
    holderUniverses: {
      rawHolderUniverse: summarizeUniverse(cleaning.universes.rawHolderUniverse),
      cleanedHolderUniverse: summarizeUniverse(cleaning.universes.cleanedHolderUniverse),
      excludedInfrastructureUniverse: summarizeUniverse(cleaning.universes.excludedInfrastructureUniverse),
      unresolvedUniverse: summarizeUniverse(cleaning.universes.unresolvedUniverse),
    },
    concentrationMetrics: {
      ca,
      metrics: cleaning.concentration,
    },
    dataQualityIssues: {
      ca,
      issues: cleaning.issues,
    },
    warnings,
  };
}

function summarizeUniverse(u: HolderCleaningResult["universes"]["rawHolderUniverse"]): Record<string, unknown> {
  return {
    ownerCount: u.ownerCount,
    tokenAccountCount: u.tokenAccountCount,
    amountRaw: u.amountRaw,
    amountNormalized: u.amountNormalized,
    ratio: u.ratio,
    completeness: u.completeness,
    universeDefinition: u.universeDefinition,
    ruleVersion: u.ruleVersion,
    evidenceRefs: u.evidenceRefs,
    // Cap owner detail for scrubbed reports (top 50).
    topOwners: u.owners.slice(0, 50).map((o) => ({
      owner: o.owner,
      ownerRawAmount: o.ownerRawAmount,
      tokenAccountCount: o.tokenAccountCount,
      cleaningClass: o.cleaningClass,
      evidence: o.evidence,
    })),
  };
}

/**
 * Offline path: clean pre-enumerated accounts (fixtures / replay).
 */
export function cleanEnumeratedCa(input: {
  ca: string;
  selectionReason: string;
  baseCommit: string;
  mintSupplyRaw: string;
  decimals: number;
  name: string | null;
  symbol: string | null;
  accounts: RpcTokenAccount[];
  paginationComplete: boolean;
  observedAt: string;
  sourceWatermark?: string | null;
  heliusRequestCount?: number;
}): PerCaPilotArtifacts {
  const ca = normalizeSolanaAddress(input.ca);
  if (ca === null) {
    const empty = cleanHolderUniverse({
      ca: input.ca,
      mintSupplyRaw: "0",
      decimals: 0,
      accounts: [],
      paginationComplete: false,
      observedAt: input.observedAt,
      source: "helius",
    });
    return buildPerCaArtifacts(
      input.ca,
      input.observedAt,
      0,
      false,
      null,
      empty,
      null,
      input.selectionReason,
      input.baseCommit,
      ["solana_ca_invalid"],
    );
  }

  const observations = observationsFromAccounts(
    input.accounts,
    input.decimals,
    "helius",
    input.observedAt,
    input.sourceWatermark ?? null,
  );
  const cleaning = cleanHolderUniverse({
    ca,
    mintSupplyRaw: input.mintSupplyRaw,
    decimals: input.decimals,
    accounts: observations,
    paginationComplete: input.paginationComplete,
    observedAt: input.observedAt,
    source: "helius",
    sourceWatermark: input.sourceWatermark ?? null,
  });

  let caScan: CaScanResponseV1 | null = null;
  const warnings: string[] = [];
  try {
    caScan = mapHolderCleaningToCaScanResponseV1({
      cleaning,
      name: input.name,
      symbol: input.symbol,
      decimals: input.decimals,
      generatedAt: input.observedAt,
      mintProvenance: scrubbedProvenance("helius-mint", input.observedAt, input.sourceWatermark ?? null),
    });
  } catch (error) {
    warnings.push(safeSolanaLiveWarning(error));
  }

  return buildPerCaArtifacts(
    ca,
    input.observedAt,
    input.heliusRequestCount ?? 0,
    input.paginationComplete,
    input.sourceWatermark ?? null,
    cleaning,
    caScan,
    input.selectionReason,
    input.baseCommit,
    warnings,
  );
}

/**
 * Live pilot: sequential Helius-only reads for a fixed sample list.
 */
export async function runSolanaCaRealDataCleaningPilot(
  manifest: PilotInputManifest,
  sourceFactory: () => PilotTokenAccountSource,
  options: RunPilotOptions = {},
): Promise<PilotBatchResult> {
  if (!manifest.samples.length || manifest.samples.length > 10) {
    return {
      taskId: manifest.taskId,
      version: SOLANA_CA_REAL_DATA_CLEANING_PILOT_VERSION,
      status: "REJECTED",
      baseCommit: manifest.baseCommit,
      results: [],
      batchSummary: { error: "sample_count_must_be_1_to_10" },
      warnings: ["sample_count_must_be_1_to_10"],
    };
  }

  const cas = manifest.samples.map((s) => s.ca);
  if (new Set(cas).size !== cas.length) {
    return {
      taskId: manifest.taskId,
      version: SOLANA_CA_REAL_DATA_CLEANING_PILOT_VERSION,
      status: "REJECTED",
      baseCommit: manifest.baseCommit,
      results: [],
      batchSummary: { error: "duplicate_ca_in_manifest" },
      warnings: ["duplicate_ca_in_manifest"],
    };
  }

  let source: PilotTokenAccountSource;
  try {
    source = sourceFactory();
  } catch (error) {
    const warning = error instanceof SourceDataUnavailableError
      && error.message.includes("credential")
      ? RUNTIME_CREDENTIAL_UNAVAILABLE
      : safeSolanaLiveWarning(error);
    return {
      taskId: manifest.taskId,
      version: SOLANA_CA_REAL_DATA_CLEANING_PILOT_VERSION,
      status: warning === RUNTIME_CREDENTIAL_UNAVAILABLE ? "RUNTIME_CREDENTIAL_UNAVAILABLE" : "REJECTED",
      baseCommit: manifest.baseCommit,
      results: [],
      batchSummary: { error: warning },
      warnings: [warning],
    };
  }

  const now = options.now ?? (() => new Date());
  const results: PerCaPilotArtifacts[] = [];

  for (const sample of manifest.samples) {
    const startedRequests = source.getRequestCount?.() ?? 0;
    const queryTime = now().toISOString();
    const ca = normalizeSolanaAddress(sample.ca);
    if (ca === null) {
      results.push(buildPerCaArtifacts(
        sample.ca,
        queryTime,
        0,
        false,
        null,
        cleanHolderUniverse({
          ca: sample.ca,
          mintSupplyRaw: "0",
          decimals: 0,
          accounts: [],
          paginationComplete: false,
          observedAt: queryTime,
          source: "helius",
        }),
        null,
        sample.selectionReason,
        manifest.baseCommit,
        ["solana_ca_invalid"],
      ));
      continue;
    }

    try {
      const mint = await source.getMint(ca);
      if (mint.data === null) {
        results.push(buildPerCaArtifacts(
          ca,
          queryTime,
          (source.getRequestCount?.() ?? startedRequests) - startedRequests,
          false,
          watermarkRef(mint.watermark),
          cleanHolderUniverse({
            ca,
            mintSupplyRaw: "0",
            decimals: 0,
            accounts: [],
            paginationComplete: false,
            observedAt: queryTime,
            source: "helius",
          }),
          null,
          sample.selectionReason,
          manifest.baseCommit,
          ["helius_mint_not_found"],
        ));
        continue;
      }

      let metadata: SourceResponse<HeliusTokenMetadata | null>;
      try {
        metadata = await source.getTokenMetadata(ca);
      } catch {
        metadata = {
          data: null,
          watermark: {
            source: "helius",
            observedAt: now(),
            completeness: "partial",
          },
        };
      }

      const enumeration = await source.enumerateTokenAccounts(ca, {
        maxPages: options.maxPagesPerCa ?? 50,
        pageSize: options.pageSize ?? 1_000,
        showZeroBalance: options.showZeroBalance ?? false,
      });

      const requestCount = (source.getRequestCount?.() ?? startedRequests) - startedRequests;
      const wm = watermarkRef(enumeration.watermark);
      const artifact = cleanEnumeratedCa({
        ca,
        selectionReason: sample.selectionReason,
        baseCommit: manifest.baseCommit,
        mintSupplyRaw: mint.data.supplyRaw,
        decimals: mint.data.decimals,
        name: metadata.data?.name ?? null,
        symbol: metadata.data?.symbol ?? null,
        accounts: enumeration.accounts,
        paginationComplete: enumeration.paginationComplete,
        observedAt: queryTime,
        sourceWatermark: wm,
        heliusRequestCount: requestCount,
      });
      if (enumeration.skippedMalformedCount > 0) {
        artifact.cleaning.issues.push({
          code: "provider_shape_drift",
          ca,
          severity: "warning",
          affectedRecordCount: enumeration.skippedMalformedCount,
          affectedBalance: "0",
          evidence: [`skippedMalformedCount=${enumeration.skippedMalformedCount}`],
          whetherManualReviewRequired: true,
          suggestedFollowUp: "inspect_token_account_field_variants",
        });
        artifact.warnings.push("provider_shape_drift_partial_skip");
        if (artifact.status === "OK") artifact.status = "PARTIAL";
      }
      results.push(artifact);
    } catch (error) {
      const warning = mapProviderWarning(error);
      if (warning === RUNTIME_CREDENTIAL_UNAVAILABLE) {
        return {
          taskId: manifest.taskId,
          version: SOLANA_CA_REAL_DATA_CLEANING_PILOT_VERSION,
          status: "RUNTIME_CREDENTIAL_UNAVAILABLE",
          baseCommit: manifest.baseCommit,
          results,
          batchSummary: { error: warning, completedBeforeFailure: results.length },
          warnings: [warning],
        };
      }
      results.push(buildPerCaArtifacts(
        ca,
        queryTime,
        (source.getRequestCount?.() ?? startedRequests) - startedRequests,
        false,
        null,
        cleanHolderUniverse({
          ca,
          mintSupplyRaw: "0",
          decimals: 0,
          accounts: [],
          paginationComplete: false,
          observedAt: queryTime,
          source: "helius",
        }),
        null,
        sample.selectionReason,
        manifest.baseCommit,
        [warning],
      ));
    }
  }

  const okCount = results.filter((r) => r.status === "OK").length;
  const partialCount = results.filter((r) => r.status === "PARTIAL").length;
  const rejectedCount = results.filter((r) => r.status === "REJECTED").length;
  const status: PilotBatchResult["status"] =
    rejectedCount === results.length
      ? "REJECTED"
      : okCount === results.length
        ? "OK"
        : "PARTIAL";

  return {
    taskId: manifest.taskId,
    version: SOLANA_CA_REAL_DATA_CLEANING_PILOT_VERSION,
    status,
    baseCommit: manifest.baseCommit,
    results,
    batchSummary: {
      sampleCount: results.length,
      okCount,
      partialCount,
      rejectedCount,
      totalHeliusRequests: results.reduce((s, r) => s + r.heliusRequestCount, 0),
      judgmentEligibleCount: results.filter((r) => r.cleaning.judgmentEligible).length,
      issueCodes: [...new Set(results.flatMap((r) => r.cleaning.issues.map((i) => i.code)))],
    },
    warnings: results.flatMap((r) => r.warnings),
  };
}

function mapProviderWarning(error: unknown): string {
  if (error instanceof SourceDataUnavailableError) {
    if (error.message.includes("credential")) return RUNTIME_CREDENTIAL_UNAVAILABLE;
    if (error.message.includes("timeout")) return "provider_timeout";
    if (error.message.includes("429") || error.message.includes("rate")) return "provider_rate_limited";
    if (error.message.includes("malformed") || error.message.includes("shape")) return "provider_shape_drift";
    return safeSolanaLiveWarning(error);
  }
  return safeSolanaLiveWarning(error);
}

/** Replay helper: cleaning from scrubbed fixture must be hash-stable. */
export function replayCleaningHash(input: Parameters<typeof cleanEnumeratedCa>[0]): string {
  const once = cleanEnumeratedCa(input);
  const twice = cleanEnumeratedCa(input);
  const h1 = hashStable({
    cleaning: once.cleaning,
    caScan: once.caScanResponse,
  });
  const h2 = hashStable({
    cleaning: twice.cleaning,
    caScan: twice.caScanResponse,
  });
  if (h1 !== h2) throw new Error("replay_hash_mismatch");
  return h1;
}
