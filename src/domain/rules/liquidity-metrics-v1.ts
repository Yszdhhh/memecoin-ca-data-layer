/**
 * LIQUIDITY-METRICS-V1-001 — pure metric derivation from raw snapshots.
 * Missing inputs stay null; never invent series.
 */

export const LIQUIDITY_METRICS_RULE_VERSION = "liquidity-metrics-v1";

export interface LiquidityRawPoint {
  observedAt: string;
  dexVolumeUsd: number | null;
  swapCount: number | null;
  activeAddresses: number | null;
  newTokens: number | null;
  graduatedTokens: number | null;
  newPools: number | null;
  protocolRevenueUsd: number | null;
  source: string;
  freshness: "fresh" | "stale" | "unavailable";
}

export interface LiquiditySnapshotV1 {
  ruleVersion: string;
  window: "latest" | "7d" | "30d";
  observedAt: string;
  metrics: {
    dexVolumeUsd: number | null;
    swapCount: number | null;
    activeAddresses: number | null;
    newTokens: number | null;
    graduatedTokens: number | null;
    newPools: number | null;
    protocolRevenueUsd: number | null;
    compositeLevel: number | null;
    compositeParts: Record<string, number | null>;
  };
  percentiles: {
    dexVolumeUsd7d: number | null;
    dexVolumeUsd30d: number | null;
  };
  freshness: "fresh" | "stale" | "unavailable";
  source: string;
  dictionaryRef: string;
  warnings: string[];
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx]!;
}

function mean(nums: Array<number | null>): number | null {
  const v = nums.filter((n): n is number => n !== null && Number.isFinite(n));
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function buildLiquiditySnapshotV1(
  history: readonly LiquidityRawPoint[],
  opts?: { now?: string },
): LiquiditySnapshotV1 {
  const warnings: string[] = [];
  if (history.length === 0) {
    return {
      ruleVersion: LIQUIDITY_METRICS_RULE_VERSION,
      window: "latest",
      observedAt: opts?.now ?? new Date().toISOString(),
      metrics: {
        dexVolumeUsd: null,
        swapCount: null,
        activeAddresses: null,
        newTokens: null,
        graduatedTokens: null,
        newPools: null,
        protocolRevenueUsd: null,
        compositeLevel: null,
        compositeParts: {},
      },
      percentiles: { dexVolumeUsd7d: null, dexVolumeUsd30d: null },
      freshness: "unavailable",
      source: "none",
      dictionaryRef: "docs/contracts/LIQUIDITY_METRIC_DICTIONARY_V1.md",
      warnings: ["no_raw_points"],
    };
  }

  const sorted = [...history].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const latest = sorted[sorted.length - 1]!;
  if (latest.freshness === "stale") warnings.push("latest_stale_retained");
  if (latest.freshness === "unavailable") warnings.push("latest_unavailable");

  const last7 = sorted.slice(-7);
  const last30 = sorted.slice(-30);
  const vol7 = last7.map((p) => p.dexVolumeUsd).filter((n): n is number => n !== null).sort((a, b) => a - b);
  const vol30 = last30.map((p) => p.dexVolumeUsd).filter((n): n is number => n !== null).sort((a, b) => a - b);

  const parts = {
    volume: latest.dexVolumeUsd,
    activity: latest.swapCount,
    addresses: latest.activeAddresses,
    launches: latest.newTokens,
    graduation: latest.graduatedTokens,
  };
  // Composite: mean of available normalized ranks is deferred; expose raw mean of available z-less parts only when all present.
  const present = Object.values(parts).filter((n): n is number => n !== null);
  const compositeLevel = present.length >= 3 ? mean(present.map((n) => Math.log10(Math.max(n, 1)))) : null;
  if (present.length < 3) warnings.push("composite_withheld_insufficient_parts");

  return {
    ruleVersion: LIQUIDITY_METRICS_RULE_VERSION,
    window: "latest",
    observedAt: latest.observedAt,
    metrics: {
      dexVolumeUsd: latest.dexVolumeUsd,
      swapCount: latest.swapCount,
      activeAddresses: latest.activeAddresses,
      newTokens: latest.newTokens,
      graduatedTokens: latest.graduatedTokens,
      newPools: latest.newPools,
      protocolRevenueUsd: latest.protocolRevenueUsd,
      compositeLevel,
      compositeParts: parts,
    },
    percentiles: {
      dexVolumeUsd7d: percentile(vol7, 50),
      dexVolumeUsd30d: percentile(vol30, 50),
    },
    freshness: latest.freshness,
    source: latest.source,
    dictionaryRef: "docs/contracts/LIQUIDITY_METRIC_DICTIONARY_V1.md",
    warnings,
  };
}

export function renderDailyBriefV1(snapshot: LiquiditySnapshotV1): string {
  const lines = [
    `# Liquidity Daily Brief`,
    ``,
    `- observedAt: ${snapshot.observedAt}`,
    `- freshness: ${snapshot.freshness}`,
    `- source: ${snapshot.source}`,
    `- rule: ${snapshot.ruleVersion}`,
    ``,
    `## Metrics`,
    `- DEX volume USD: ${snapshot.metrics.dexVolumeUsd ?? "null"}`,
    `- swaps: ${snapshot.metrics.swapCount ?? "null"}`,
    `- active addresses: ${snapshot.metrics.activeAddresses ?? "null"}`,
    `- new tokens: ${snapshot.metrics.newTokens ?? "null"}`,
    `- graduated: ${snapshot.metrics.graduatedTokens ?? "null"}`,
    `- new pools: ${snapshot.metrics.newPools ?? "null"}`,
    `- composite level: ${snapshot.metrics.compositeLevel ?? "null (withheld)"}`,
    ``,
    `## Warnings`,
    ...(snapshot.warnings.length ? snapshot.warnings.map((w) => `- ${w}`) : ["- none"]),
    ``,
    `_No narrative invented when data is null. Research aid only._`,
  ];
  return lines.join("\n");
}
