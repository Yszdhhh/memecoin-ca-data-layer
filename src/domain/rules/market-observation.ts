import { createHash } from "node:crypto";
import type {
  MarketFreshnessStatus,
  MarketObservation,
  MarketSnapshot,
  MarketTrustClass,
} from "../types.js";

export const MARKET_SELECTION_RULE_VERSION = "market-select-v1";
export const DEFAULT_MARKET_STALE_AFTER_MS = 15 * 60_000;

export interface MarketSelectionOptions {
  at?: Date;
  staleAfterMs?: number;
  tokenId?: string;
}

/**
 * Deterministic selection from append-only observations (SOL-MARKET-DATA-DESIGN-001).
 * Never averages providers; never invents missing liquidity/price.
 */
export function selectMarketSnapshot(
  observations: readonly MarketObservation[],
  options: MarketSelectionOptions = {},
): MarketSnapshot | null {
  const at = options.at ?? new Date();
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_MARKET_STALE_AFTER_MS;
  const scoped = observations
    .filter((item) => item.chain === "solana")
    .filter((item) => (options.tokenId ? item.tokenId === options.tokenId : true))
    .filter((item) => item.trustClass === "A" || item.trustClass === "B" || item.trustClass === "C")
    .filter((item) => item.freshnessStatus !== "rejected");

  if (scoped.length === 0) return null;

  const ranked = [...scoped].sort((left, right) => compareObservations(left, right, at, staleAfterMs));
  const selected = ranked[0]!;
  const sourceTime = selected.sourceObservedAt ?? selected.retrievedAt;
  const ageMs = at.getTime() - sourceTime.getTime();
  const isStale = selected.freshnessStatus === "stale" || ageMs > staleAfterMs;
  const selectionWarnings = [
    ...selected.warnings,
    ...(isStale ? ["market_observation_stale"] : []),
    ...(selected.pairAddress ? [] : ["market_pair_unconfirmed"]),
    ...(selected.liquidityUsd === null ? ["market_metric_missing:liquidity_usd"] : []),
    ...(selected.priceUsd === null ? ["market_metric_missing:price_usd"] : []),
    ...(selected.trustClass === "C" ? ["market_provider_behavior_unverified"] : []),
  ];

  // Conflict: another same-freshness C observation with different liquidity for different pairs.
  const peers = scoped.filter((item) => item.id !== selected.id && item.pairAddress && item.pairAddress !== selected.pairAddress);
  if (peers.some((item) => item.liquidityUsd !== null && selected.liquidityUsd !== null
    && Math.abs((item.liquidityUsd ?? 0) - (selected.liquidityUsd ?? 0)) / Math.max(selected.liquidityUsd ?? 1, 1) > 0.25)) {
    selectionWarnings.push("market_source_conflict");
  }

  return {
    priceUsd: selected.priceUsd,
    fdvUsd: selected.fdvUsd,
    liquidityUsd: selected.liquidityUsd,
    ...(selected.pairAddress ? { pairAddress: selected.pairAddress } : {}),
    observedAt: sourceTime,
    source: selected.source,
    selectedObservationId: selected.id,
    trustClass: selected.trustClass,
    selectionRuleVersion: MARKET_SELECTION_RULE_VERSION,
    freshnessStatus: isStale ? "stale" : selected.freshnessStatus,
    completeness: selected.completeness,
    selectionWarnings: [...new Set(selectionWarnings)],
  };
}

export function observationFingerprint(input: {
  source: string;
  sourceRequestRef: string;
  sourceObservedAt?: Date;
  priceUsd: number | null;
  liquidityUsd: number | null;
  fdvUsd: number | null;
  marketCapUsd: number | null;
  pairAddress?: string;
}): string {
  const payload = [
    input.source,
    input.sourceRequestRef,
    input.sourceObservedAt?.toISOString() ?? "",
    input.pairAddress ?? "",
    String(input.priceUsd),
    String(input.liquidityUsd),
    String(input.fdvUsd),
    String(input.marketCapUsd),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export function buildMarketObservation(input: {
  id: string;
  tokenId: string;
  source: string;
  trustClass?: MarketTrustClass;
  sourceRequestRef: string;
  retrievedAt: Date;
  sourceObservedAt?: Date;
  pairAddress?: string;
  venue?: string;
  priceUsd: number | null;
  liquidityUsd: number | null;
  fdvUsd: number | null;
  marketCapUsd?: number | null;
  completeness?: number;
  freshnessStatus?: MarketFreshnessStatus;
  warnings?: string[];
  supersedesObservationId?: string;
}): MarketObservation {
  const marketCapUsd = input.marketCapUsd ?? null;
  const fingerprint = observationFingerprint({
    source: input.source,
    sourceRequestRef: input.sourceRequestRef,
    ...(input.sourceObservedAt ? { sourceObservedAt: input.sourceObservedAt } : {}),
    priceUsd: input.priceUsd,
    liquidityUsd: input.liquidityUsd,
    fdvUsd: input.fdvUsd,
    marketCapUsd,
    ...(input.pairAddress ? { pairAddress: input.pairAddress } : {}),
  });
  return {
    id: input.id,
    chain: "solana",
    tokenId: input.tokenId,
    ...(input.pairAddress ? { pairAddress: input.pairAddress } : {}),
    ...(input.venue ? { venue: input.venue } : {}),
    source: input.source,
    trustClass: input.trustClass ?? "C",
    ...(input.sourceObservedAt ? { sourceObservedAt: input.sourceObservedAt } : {}),
    retrievedAt: input.retrievedAt,
    ingestedAt: input.retrievedAt,
    sourceRequestRef: input.sourceRequestRef,
    observationFingerprint: fingerprint,
    priceUsd: input.priceUsd,
    liquidityUsd: input.liquidityUsd,
    fdvUsd: input.fdvUsd,
    marketCapUsd,
    completeness: input.completeness ?? coverageCompleteness(input),
    freshnessStatus: input.freshnessStatus ?? "fresh",
    warnings: input.warnings ?? [],
    ...(input.supersedesObservationId ? { supersedesObservationId: input.supersedesObservationId } : {}),
    recordedAt: input.retrievedAt,
  };
}

/** In-memory append-only store with fingerprint idempotency (no network). */
export class InMemoryMarketObservationStore {
  private readonly rows: MarketObservation[] = [];

  append(observation: MarketObservation): { accepted: boolean; reason?: string } {
    if (observation.chain !== "solana") {
      return { accepted: false, reason: "only_solana_observations_allowed" };
    }
    const duplicate = this.rows.find(
      (row) => row.source === observation.source && row.observationFingerprint === observation.observationFingerprint,
    );
    if (duplicate) return { accepted: false, reason: "duplicate_fingerprint" };
    this.rows.push({ ...observation, warnings: [...observation.warnings] });
    return { accepted: true };
  }

  list(tokenId?: string): MarketObservation[] {
    return this.rows
      .filter((row) => (tokenId ? row.tokenId === tokenId : true))
      .map((row) => ({ ...row, warnings: [...row.warnings] }));
  }
}

function coverageCompleteness(input: {
  priceUsd: number | null;
  liquidityUsd: number | null;
  fdvUsd: number | null;
  pairAddress?: string;
  sourceObservedAt?: Date;
}): number {
  const fields = [
    input.priceUsd !== null,
    input.liquidityUsd !== null,
    input.fdvUsd !== null,
    Boolean(input.pairAddress),
    Boolean(input.sourceObservedAt),
  ];
  return fields.filter(Boolean).length / fields.length;
}

function compareObservations(
  left: MarketObservation,
  right: MarketObservation,
  at: Date,
  staleAfterMs: number,
): number {
  const leftScore = rankScore(left, at, staleAfterMs);
  const rightScore = rankScore(right, at, staleAfterMs);
  if (leftScore !== rightScore) return rightScore - leftScore;
  const leftTime = (left.sourceObservedAt ?? left.retrievedAt).getTime();
  const rightTime = (right.sourceObservedAt ?? right.retrievedAt).getTime();
  if (leftTime !== rightTime) return rightTime - leftTime;
  const leftLiq = left.liquidityUsd ?? -1;
  const rightLiq = right.liquidityUsd ?? -1;
  if (leftLiq !== rightLiq) return rightLiq - leftLiq;
  return left.id.localeCompare(right.id);
}

function rankScore(item: MarketObservation, at: Date, staleAfterMs: number): number {
  const sourceTime = item.sourceObservedAt ?? item.retrievedAt;
  const stale = item.freshnessStatus === "stale" || at.getTime() - sourceTime.getTime() > staleAfterMs;
  const trust = item.trustClass === "A" ? 300 : item.trustClass === "B" ? 200 : 100;
  const freshness = stale ? 0 : 50;
  const pair = item.pairAddress ? 10 : 0;
  return trust + freshness + pair;
}
