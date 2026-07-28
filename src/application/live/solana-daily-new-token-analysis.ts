import {
  DAILY_CANDIDATE_MAX,
  DAILY_CANDIDATE_MIN,
  DAILY_MIN_MARKET_CAP_USD,
  GmgnDiscoveryError,
  discoverGmgnDailyCandidates,
  type GmgnDailyCandidate,
  type GmgnDailySelection,
} from "../discovery/gmgn-daily-token-selector.js";
import { readSolanaManualCaBatch } from "./solana-live-ca-batch.js";
import { safeSolanaLiveWarning } from "./solana-live-warning.js";
import type { SolanaLiveCaFirstResult, SolanaLiveCaFirstSource } from "./solana-live-ca-first.js";

export const SOLANA_DAILY_NEW_TOKEN_ANALYSIS_VERSION = "solana-daily-new-token-analysis-v1";

export interface SolanaDailyCandidateAnalysis {
  tokenCa: string;
  symbol: string | null;
  market: Omit<GmgnDailyCandidate, "tokenCa" | "symbol">;
  helius: SolanaLiveCaFirstResult | null;
}

export interface SolanaDailyNewTokenAnalysisReport {
  schemaVersion: typeof SOLANA_DAILY_NEW_TOKEN_ANALYSIS_VERSION;
  chain: "solana";
  mode: "daily_scheduled_readonly";
  status: "OK" | "DEGRADED" | "REJECTED";
  observedAt: string;
  criteria: GmgnDailySelection["criteria"];
  selectedCount: number;
  analyzedCount: number;
  requestBounds: {
    gmgnRequestsMax: 1;
    heliusRequestsPerCaMax: 3;
    heliusRequestsBatchMax: 30;
  };
  candidates: SolanaDailyCandidateAnalysis[];
  warnings: string[];
  limitations: [
    "gmgn_market_risk_and_creator_fields_are_unverified_provider_claims",
    "helius_scope_is_mint_metadata_and_token_account_availability_only",
    "holder_concentration_owner_clustering_and_dev_history_are_not_claimed",
    "no_database_cache_queue_address_library_or_trading_side_effects",
  ];
}

export interface SolanaDailyNewTokenAnalysisDeps {
  discover?: (now: Date) => Promise<GmgnDailySelection>;
  sourceFactory: () => SolanaLiveCaFirstSource;
  now?: () => Date;
}

const CRITERIA: GmgnDailySelection["criteria"] = {
  chain: "sol",
  interval: "24h",
  maxAgeHours: 24,
  marketCapUsdExclusiveMin: DAILY_MIN_MARKET_CAP_USD,
  sort: "market_cap_desc",
  minimumCandidates: DAILY_CANDIDATE_MIN,
  maximumCandidates: DAILY_CANDIDATE_MAX,
};

const LIMITATIONS = [
  "gmgn_market_risk_and_creator_fields_are_unverified_provider_claims",
  "helius_scope_is_mint_metadata_and_token_account_availability_only",
  "holder_concentration_owner_clustering_and_dev_history_are_not_claimed",
  "no_database_cache_queue_address_library_or_trading_side_effects",
] as const;

export async function runSolanaDailyNewTokenAnalysis(
  deps: SolanaDailyNewTokenAnalysisDeps,
): Promise<SolanaDailyNewTokenAnalysisReport> {
  const now = deps.now?.() ?? new Date();
  const observedAt = validIsoDate(now);
  let selection: GmgnDailySelection;
  try {
    selection = await (deps.discover ?? discoverGmgnDailyCandidates)(now);
  } catch (error) {
    return rejectedReport(observedAt, [
      error instanceof GmgnDiscoveryError ? error.code : "gmgn_cli_unavailable",
    ]);
  }
  if (selection.status !== "READY") {
    return rejectedReport(observedAt, selection.warnings, selection.candidates);
  }

  try {
    const batch = await readSolanaManualCaBatch(selection.candidates.map((candidate) => candidate.tokenCa), deps.sourceFactory);
    const byCa = new Map(batch.results.map((result) => [result.tokenCa, result]));
    const candidates = selection.candidates.map((candidate) => analysis(candidate, byCa.get(candidate.tokenCa) ?? null));
    return {
      schemaVersion: SOLANA_DAILY_NEW_TOKEN_ANALYSIS_VERSION,
      chain: "solana",
      mode: "daily_scheduled_readonly",
      status: batch.status === "OK" ? "OK" : batch.status === "REJECTED" ? "REJECTED" : "DEGRADED",
      observedAt,
      criteria: selection.criteria,
      selectedCount: selection.candidates.length,
      analyzedCount: batch.results.length,
      requestBounds: { gmgnRequestsMax: 1, heliusRequestsPerCaMax: 3, heliusRequestsBatchMax: 30 },
      candidates,
      warnings: [...selection.warnings, ...batch.warnings],
      limitations: [...LIMITATIONS],
    };
  } catch (error) {
    return rejectedReport(observedAt, [safeSolanaLiveWarning(error)], selection.candidates);
  }
}

function rejectedReport(
  observedAt: string,
  warnings: string[],
  candidates: GmgnDailyCandidate[] = [],
): SolanaDailyNewTokenAnalysisReport {
  return {
    schemaVersion: SOLANA_DAILY_NEW_TOKEN_ANALYSIS_VERSION,
    chain: "solana",
    mode: "daily_scheduled_readonly",
    status: "REJECTED",
    observedAt,
    criteria: { ...CRITERIA },
    selectedCount: candidates.length,
    analyzedCount: 0,
    requestBounds: { gmgnRequestsMax: 1, heliusRequestsPerCaMax: 3, heliusRequestsBatchMax: 30 },
    candidates: candidates.map((candidate) => analysis(candidate, null)),
    warnings,
    limitations: [...LIMITATIONS],
  };
}

function analysis(candidate: GmgnDailyCandidate, helius: SolanaLiveCaFirstResult | null): SolanaDailyCandidateAnalysis {
  const { tokenCa, symbol, ...market } = candidate;
  return { tokenCa, symbol, market, helius };
}

function validIsoDate(value: Date): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new Error("now must be a valid date");
  return value.toISOString();
}
