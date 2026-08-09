import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  CohortBenchmarks,
  CohortMetricSummary,
  IdentityStatus,
  RefreshOptions,
  RefreshResult,
  SocialMappingStatus,
  WalletChain,
  WalletLibraryInput,
  WalletLibraryInputRecord,
  WalletLibraryRecord,
  WalletLifecycleStatus,
  WalletSocialEnrichment,
  WalletTier,
} from "./types.js";

export const WALLET_LIBRARY_SCHEMA_VERSION = "wallet-library-v1";
export const WALLET_LIBRARY_INPUT_SCHEMA_VERSION = "wallet-library-input-v1";
export const WALLET_LIBRARY_FORMAT_STATUS = "FORMAT_PENDING_UI_SMOKE";

const NOTE_MAX_LENGTH = 32;
const TIER_TARGETS: Record<Exclude<WalletTier, null>, number> = {
  CORE: 60,
  WATCH: 120,
  LEAD: 300,
};
const TIER_CHAIN_QUOTAS: Record<Exclude<WalletTier, null>, Record<WalletChain, number>> = {
  CORE: { SOL: 36, BSC: 24 },
  WATCH: { SOL: 72, BSC: 48 },
  LEAD: { SOL: 180, BSC: 120 },
};

const OUTPUT_COLUMNS: string[] = [
  "chain",
  "address",
  "address_type",
  "current_gmgn_note",
  "canonical_identity",
  "identity_display_name",
  "raw_label_count",
  "normalized_label_count",
  "unique_source_count",
  "dominant_alias",
  "dominant_alias_count",
  "dominant_alias_share",
  "identity_confidence",
  "identity_status",
  "alias_variants",
  "identity_last_verified_at",
  "x_handle",
  "x_display_name",
  "x_followers_exact",
  "x_followers_compact",
  "x_verified_status",
  "wallet_social_mapping_status",
  "social_sources",
  "social_observed_at",
  "social_confidence",
  "win_rate_30d",
  "payoff_ratio",
  "pnl_7d",
  "pnl_30d",
  "trade_count_7d",
  "trade_count_30d",
  "profitable_token_count",
  "losing_token_count",
  "token_count",
  "multi_token_repeatability",
  "pnl_concentration",
  "activity_recency",
  "last_active_at",
  "frequency_percentile",
  "provider_data_quality",
  "provider_data_status",
  "provider_pnl_status",
  "provider_pnl_source",
  "provider_pnl_confidence",
  "pnl_currency",
  "verification_status",
  "replay_followability_status",
  "data_completeness",
  "identity_score",
  "social_influence_score",
  "trading_quality_score",
  "data_confidence_score",
  "followability_score",
  "freshness_score",
  "total_score",
  "tier",
  "lifecycle_status",
  "gmgn_note",
  "gmgn_emoji",
  "keep_recommendation",
];

const METRIC_FIELDS = [
  "win_rate_30d",
  "payoff_ratio",
  "pnl_7d",
  "pnl_30d",
  "trade_count_7d",
  "trade_count_30d",
  "frequency_percentile",
] as const;

const IDENTITY_GENERIC = new Set([
  "wallet",
  "address",
  "钱包",
  "地址",
  "unknown",
  "n/a",
  "na",
  "none",
  "无",
  "-",
  "--",
]);

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function sortText(a: string, b: string): number {
  return a.localeCompare(b, "en", { sensitivity: "base" });
}

function stableAddressKey(record: Pick<WalletLibraryRecord, "chain" | "address">): string {
  return `${record.chain}\u0000${record.address}`;
}

export function sha256(content: Buffer | string): string {
  return crypto.createHash("sha256").update(content).digest("hex").toUpperCase();
}

function stripEmoji(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\uFE0E\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]/gu, "");
}

function cleanAliasText(raw: string): string {
  let value = stripEmoji(raw.normalize("NFKC").trim());
  value = value.replace(/^(?:solana?|sol|bsc|bnb|evm)(?:\s*[:/_-]\s*|\s+)/i, "");
  value = value.replace(/\([^)]*(?:0x[a-f0-9]{4,}|地址|钱包|wallet|address)[^)]*\)$/i, "");
  value = value.replace(/(?:[\s_\-/]+(?:0x)?[a-f0-9]{4,})$/i, "");
  value = value.replace(/(?:wallet|address|钱包|地址)$/i, "");
  value = value.replace(/(?:^|[\s|])(?:wallet|address|钱包|地址)(?=$|[\s|])/gi, " ");
  value = value.replace(/[|]+/g, " ").replace(/\s+/g, " ").trim();
  return value;
}

export function normalizeAlias(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = cleanAliasText(raw);
  if (cleaned.length === 0) return null;
  const key = cleaned.toLocaleLowerCase("en-US");
  if (IDENTITY_GENERIC.has(key)) return null;
  if (/^[\p{P}\p{S}\s]+$/u.test(key)) return null;
  if (/^(?:0x)?[a-f0-9]{6,}$/i.test(key)) return null;
  if (/^\d+(?:\.\d+)?$/.test(key)) return null;
  return key;
}

function displayAlias(raw: string): string | null {
  const normalized = normalizeAlias(raw);
  if (!normalized) return null;
  return cleanAliasText(raw);
}

function chooseDisplayAlias(values: string[]): string {
  return values.sort((a, b) => a.length - b.length || sortText(a, b))[0] ?? "";
}

export interface IdentityAnalysis {
  canonical_identity: string;
  identity_display_name: string;
  raw_labels: string[];
  raw_label_count: number;
  normalized_label_count: number;
  dominant_alias: string | null;
  dominant_alias_count: number;
  dominant_alias_share: number | null;
  identity_confidence: number;
  identity_status: IdentityStatus;
  alias_variants: string[];
}

export function analyzeIdentity(input: Pick<WalletLibraryInputRecord, "chain" | "address" | "labels" | "identity_verified">): IdentityAnalysis {
  const rawLabels = input.labels.filter((label) => typeof label === "string" && label.trim().length > 0).map((label) => label.trim());
  const aliasCounts = new Map<string, number>();
  const displays = new Map<string, string[]>();

  for (const label of rawLabels) {
    const alias = normalizeAlias(label);
    const display = displayAlias(label);
    if (!alias || !display) continue;
    aliasCounts.set(alias, (aliasCounts.get(alias) ?? 0) + 1);
    const list = displays.get(alias) ?? [];
    list.push(display);
    displays.set(alias, list);
  }

  const aliases = [...aliasCounts.keys()].sort(sortText);
  const ranked = aliases
    .map((alias) => ({ alias, count: aliasCounts.get(alias) ?? 0 }))
    .sort((a, b) => b.count - a.count || sortText(a.alias, b.alias));
  const dominant = ranked[0] ?? null;
  const dominantDisplay = dominant ? chooseDisplayAlias(displays.get(dominant.alias) ?? [dominant.alias]) : null;
  const dominantShare = dominant && rawLabels.length > 0 ? round(dominant.count / rawLabels.length, 4) : null;

  let identityStatus: IdentityStatus = "UNKNOWN";
  if (input.identity_verified === true && dominantDisplay) {
    identityStatus = "VERIFIED_IDENTITY";
  } else if (dominant && dominantShare !== null && dominantShare >= 0.75 && dominant.count >= 2) {
    identityStatus = "STRONG_ALIAS_CLUSTER";
  } else if (aliases.length >= 2) {
    identityStatus = "WEAK_ALIAS_CLUSTER";
  } else if (aliases.length === 1) {
    identityStatus = "HANDLE_ONLY";
  }

  const identityConfidence =
    identityStatus === "VERIFIED_IDENTITY"
      ? 1
      : identityStatus === "STRONG_ALIAS_CLUSTER"
        ? round(Math.min(0.9, 0.5 + (dominantShare ?? 0) * 0.4), 4)
        : identityStatus === "WEAK_ALIAS_CLUSTER"
          ? 0.45
          : identityStatus === "HANDLE_ONLY"
            ? 0.25
            : 0;

  return {
    canonical_identity: `${input.chain}-${sha256(input.address).slice(0, 16)}`,
    identity_display_name: dominantDisplay ?? "身份待核",
    raw_labels: rawLabels,
    raw_label_count: rawLabels.length,
    normalized_label_count: aliases.length,
    dominant_alias: dominantDisplay,
    dominant_alias_count: dominant?.count ?? 0,
    dominant_alias_share: dominantShare,
    identity_confidence: identityConfidence,
    identity_status: identityStatus,
    alias_variants: aliases.map((alias) => chooseDisplayAlias(displays.get(alias) ?? [alias])),
  };
}

function normalizedSocial(input: WalletLibraryInputRecord["social"]): WalletSocialEnrichment {
  const mapping: SocialMappingStatus = input?.wallet_social_mapping_status ?? "NO_MATCH";
  const exactFollowers = finiteNumber(input?.x_followers_exact);
  const canKeepFollowers = mapping === "VERIFIED_WALLET_MATCH" || mapping === "MULTI_SOURCE_MATCH";
  return {
    x_handle: stringOrNull(input?.x_handle),
    x_display_name: stringOrNull(input?.x_display_name),
    x_followers_exact: canKeepFollowers ? exactFollowers : null,
    x_followers_compact: canKeepFollowers ? stringOrNull(input?.x_followers_compact) : null,
    x_verified_status: stringOrNull(input?.x_verified_status),
    wallet_social_mapping_status: mapping,
    social_sources: [...(input?.social_sources ?? [])].filter((value) => typeof value === "string").sort(sortText),
    social_observed_at: stringOrNull(input?.social_observed_at),
    social_confidence: finiteNumber(input?.social_confidence),
  };
}

function normalizedWinRate(value: number | null): number | null {
  const number = finiteNumber(value);
  if (number === null || number < 0 || number > 100) return null;
  return round(number, 4);
}

function normalizedPayoff(input: WalletLibraryInputRecord["stats"]): number | null {
  const explicit = finiteNumber(input.payoff_ratio);
  if (explicit !== null && explicit >= 0) return round(explicit, 4);
  const averageProfit = finiteNumber(input.average_profit_per_trade);
  const averageLoss = finiteNumber(input.average_loss_per_trade);
  if (averageProfit !== null && averageLoss !== null && averageLoss !== 0) {
    const ratio = averageProfit / Math.abs(averageLoss);
    return Number.isFinite(ratio) && ratio >= 0 ? round(ratio, 4) : null;
  }
  return null;
}

function recencyFor(lastActiveAt: string | null, asOf: string): string {
  if (!lastActiveAt) return "UNKNOWN";
  const activeMs = Date.parse(lastActiveAt);
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(activeMs) || !Number.isFinite(asOfMs)) return "UNKNOWN";
  const ageDays = (asOfMs - activeMs) / 86_400_000;
  if (ageDays < 0) return "UNKNOWN";
  if (ageDays <= 7) return "RECENT";
  if (ageDays <= 30) return "AGING";
  if (ageDays <= 90) return "OLD";
  return "STALE";
}

function recencyScore(recency: string): number {
  if (recency === "RECENT") return 100;
  if (recency === "AGING") return 80;
  if (recency === "OLD") return 45;
  if (recency === "STALE") return 10;
  return 0;
}

function repeatabilityScore(value: string | null): number {
  const normalized = value?.toLocaleLowerCase("en-US") ?? "";
  if (/(high|strong|高|稳定|persistent)/i.test(normalized)) return 100;
  if (/(medium|中|moderate)/i.test(normalized)) return 65;
  if (/(low|弱|低)/i.test(normalized)) return 25;
  return 40;
}

function verificationScore(value: string | null): number {
  const normalized = value?.toLocaleLowerCase("en-US") ?? "";
  if (/(verified_sample|verified|chain|partial_sample)/i.test(normalized)) return 80;
  if (/(provider_only|unverified|insufficient)/i.test(normalized)) return 30;
  return 40;
}

function followabilityScore(value: string | null): number {
  const normalized = value?.toLocaleLowerCase("en-US") ?? "";
  if (/(good|followable|可复制|worth|researchable)/i.test(normalized)) return 85;
  if (/(high_frequency|difficult|low|难|延迟|provider_only)/i.test(normalized)) return 25;
  if (/(unknown|pending)/i.test(normalized)) return 40;
  return 45;
}

function providerQualityScore(value: string | null): number {
  const normalized = value?.toLocaleUpperCase("en-US") ?? "";
  if (normalized.includes("DQ-A") || normalized === "A") return 90;
  if (normalized.includes("DQ-B") || normalized === "B") return 70;
  if (normalized.includes("DQ-C") || normalized === "C") return 40;
  if (normalized.includes("DQ-D")) return 20;
  return 35;
}

function dataConfidenceScore(record: WalletLibraryInputRecord, recency: string): number {
  const quality = providerQualityScore(record.stats.provider_data_quality);
  const coverage = finiteNumber(record.stats.data_completeness);
  const coverageScore = coverage === null ? 45 : clamp(coverage <= 1 ? coverage * 100 : coverage);
  const verification = verificationScore(record.stats.verification_status);
  return round(clamp(quality * 0.45 + coverageScore * 0.35 + verification * 0.15 + recencyScore(recency) * 0.05));
}

function socialInfluenceScore(social: WalletSocialEnrichment): number {
  if (social.wallet_social_mapping_status === "VERIFIED_WALLET_MATCH") return 100;
  if (social.wallet_social_mapping_status === "MULTI_SOURCE_MATCH") return 75;
  if (social.wallet_social_mapping_status === "HANDLE_ONLY") return 25;
  return 0;
}

function identityScore(status: IdentityStatus): number {
  if (status === "VERIFIED_IDENTITY") return 100;
  if (status === "STRONG_ALIAS_CLUSTER") return 80;
  if (status === "WEAK_ALIAS_CLUSTER") return 55;
  if (status === "HANDLE_ONLY") return 30;
  return 0;
}

function rankPercentiles(records: WalletLibraryInputRecord[]): Map<string, number | null> {
  const values = records
    .map((record) => ({ key: `${record.chain}\u0000${record.address}`, value: finiteNumber(record.stats.trade_count_30d) }))
    .filter((item): item is { key: string; value: number } => item.value !== null)
    .sort((a, b) => a.value - b.value || sortText(a.key, b.key));
  const result = new Map<string, number | null>();
  if (values.length === 0) return result;
  for (const item of values) {
    const rank = values.filter((candidate) => candidate.value <= item.value).length;
    result.set(item.key, round((rank / values.length) * 100));
  }
  return result;
}

function tradingQualityScore(record: WalletLibraryInputRecord, frequencyPercentile: number | null): number {
  const winRate = normalizedWinRate(record.stats.win_rate_30d);
  const winScore = winRate === null ? null : clamp(winRate);
  const repeatability = repeatabilityScore(record.stats.multi_token_repeatability);
  const pnl = finiteNumber(record.stats.pnl_30d);
  const pnlScore = pnl === null ? 40 : pnl > 0 ? 70 : pnl < 0 ? 25 : 40;
  const frequencyScore = frequencyPercentile === null ? 35 : clamp(frequencyPercentile);
  const parts: Array<[number, number]> = [];
  if (winScore !== null) parts.push([winScore, 0.4]);
  parts.push([repeatability, 0.25], [pnlScore, 0.2], [frequencyScore, 0.15]);
  const weight = parts.reduce((sum, [, itemWeight]) => sum + itemWeight, 0);
  return round(parts.reduce((sum, [value, itemWeight]) => sum + value * itemWeight, 0) / weight);
}

function safeIdentityForNote(value: string): string {
  return value
    .replace(/聪明钱/g, "标签线索")
    .replace(/确认/g, "待核")
    .replace(/直接跟单/g, "观察")
    .replace(/可跟单/g, "观察")
    .replace(/[|｜]/g, "·");
}

function shorten(value: string, maxLength: number): string {
  return Array.from(value).slice(0, maxLength).join("");
}

function formatCount(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value >= 1000) return `${round(value / 1000, value >= 10000 ? 0 : 1)}K`;
  return `${Math.round(value)}`;
}

function formatProfit(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return "异常值待核";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  if (absolute >= 1_000) return `${sign}${round(absolute / 1000, absolute >= 10_000 ? 0 : 1)}K`;
  return `${sign}${Math.round(absolute)}`;
}

function highFrequency(record: WalletLibraryRecord): boolean {
  return (record.trade_count_30d ?? 0) >= 500 || (record.frequency_percentile ?? 0) >= 98;
}

function noteCategory(record: WalletLibraryRecord): string {
  if (record.identity_status !== "UNKNOWN" && record.identity_display_name !== "身份待核") {
    const suffix = record.identity_status === "VERIFIED_IDENTITY" ? "" : "?";
    return `${shorten(safeIdentityForNote(record.identity_display_name), 7)}${suffix}`;
  }
  if (highFrequency(record)) return "高频观察";
  if ((record.token_count ?? 0) >= 3 || /high|strong|多|稳定/i.test(record.multi_token_repeatability ?? "")) return "多币复现";
  if ((record.pnl_30d ?? 0) > 0 && (record.win_rate_30d ?? 0) < 50) return "低胜高赔";
  if ((record.pnl_30d ?? 0) > 0) return "近期盈利";
  return "身份待核";
}

function noteSupplement(record: WalletLibraryRecord): string | null {
  if (record.social.wallet_social_mapping_status === "VERIFIED_WALLET_MATCH" && record.social.x_followers_compact) {
    return `X${record.social.x_followers_compact}`;
  }
  if (highFrequency(record)) {
    const count = formatCount(record.trade_count_30d);
    return count ? `${count}笔高频` : "高频观察";
  }
  if (record.identity_status === "UNKNOWN") return "身份待核";
  if (providerOnly(record)) return "平台统计";
  if ((record.token_count ?? 0) >= 3) return `多币${record.token_count}`;
  return "持续观察";
}

function providerOnly(record: Pick<WalletLibraryRecord, "provider_pnl_status" | "provider_data_quality" | "verification_status">): boolean {
  const status = `${record.provider_pnl_status ?? ""} ${record.verification_status ?? ""}`.toLocaleLowerCase("en-US");
  const quality = (record.provider_data_quality ?? "").toLocaleUpperCase("en-US");
  return /provider|partial|rpc_classified|unverified/.test(status) || quality.includes("DQ-C") || quality === "C";
}

export function generateGmgnNote(record: WalletLibraryRecord): string {
  const segments: string[] = [noteCategory(record)];
  const win = record.win_rate_30d === null ? null : `胜率${Math.round(record.win_rate_30d)}%`;
  const payoff = record.payoff_ratio === null ? null : `赔率${round(record.payoff_ratio, 1)}`;
  const winPayoff = win && payoff ? `${win}/${payoff}` : win ?? payoff;
  if (winPayoff) segments.push(winPayoff);
  const profit = formatProfit(record.pnl_30d);
  if (profit) segments.push(`30D${profit}`);
  if (providerOnly(record) && !segments.includes("平台统计")) segments.push("平台统计");
  const supplement = noteSupplement(record);
  if (supplement && !segments.includes(supplement)) segments.push(supplement);

  for (let length = segments.length; length >= 1; length -= 1) {
    const candidate = segments.slice(0, length).join("｜");
    if (Array.from(candidate).length <= NOTE_MAX_LENGTH) return candidate;
  }
  return shorten(segments[0] ?? "身份待核", NOTE_MAX_LENGTH);
}

function chooseEmoji(record: WalletLibraryRecord): string {
  if (highFrequency(record)) return "⚠️";
  if (record.identity_status === "UNKNOWN") return "🔍";
  if ((record.token_count ?? 0) >= 3) return "🧩";
  if ((record.pnl_30d ?? 0) > 0) return "📈";
  return "🧭";
}

function lifecycleStatus(record: WalletLibraryRecord, recency: string, hasSignal: boolean): WalletLifecycleStatus {
  if (record.address_type === "CONTRACT") return "EXCLUDED_CONTRACT";
  if (recency === "STALE") return "STALE";
  if (!hasSignal && record.raw_label_count === 0) return "INACTIVE";
  return "ACTIVE";
}

function buildBaseRecord(
  input: WalletLibraryInputRecord,
  asOf: string,
  frequencyPercentiles: Map<string, number | null>,
): WalletLibraryRecord {
  const identity = analyzeIdentity(input);
  const social = normalizedSocial(input.social);
  const stats = input.stats;
  const lastActiveAt = stringOrNull(stats.last_active_at);
  const activityRecency = recencyFor(lastActiveAt, asOf);
  const frequencyPercentile = frequencyPercentiles.get(`${input.chain}\u0000${input.address}`) ?? null;
  const winRate = normalizedWinRate(stats.win_rate_30d);
  const payoffRatio = normalizedPayoff(stats);
  const hasSignal =
    winRate !== null ||
    finiteNumber(stats.pnl_30d) !== null ||
    finiteNumber(stats.trade_count_30d) !== null ||
    finiteNumber(stats.token_count) !== null;
  const base: WalletLibraryRecord = {
    chain: input.chain,
    address: input.address,
    address_type: input.address_type,
    current_gmgn_note: stringOrNull(input.current_note),
    ...identity,
    unique_source_count: finiteNumber(input.source_count),
    identity_last_verified_at: stringOrNull(input.identity_last_verified_at),
    social,
    x_handle: social.x_handle,
    x_display_name: social.x_display_name,
    x_followers_exact: social.x_followers_exact,
    x_followers_compact: social.x_followers_compact,
    x_verified_status: social.x_verified_status,
    wallet_social_mapping_status: social.wallet_social_mapping_status,
    social_sources: social.social_sources,
    social_observed_at: social.social_observed_at,
    social_confidence: social.social_confidence,
    win_rate_30d: winRate,
    payoff_ratio: payoffRatio,
    pnl_7d: finiteNumber(stats.pnl_7d),
    pnl_30d: finiteNumber(stats.pnl_30d),
    trade_count_7d: finiteNumber(stats.trade_count_7d),
    trade_count_30d: finiteNumber(stats.trade_count_30d),
    profitable_token_count: finiteNumber(stats.profitable_token_count),
    losing_token_count: finiteNumber(stats.losing_token_count),
    token_count: finiteNumber(stats.token_count),
    multi_token_repeatability: stringOrNull(stats.multi_token_repeatability),
    pnl_concentration: typeof stats.pnl_concentration === "string" ? stringOrNull(stats.pnl_concentration) : finiteNumber(stats.pnl_concentration),
    activity_recency: activityRecency,
    last_active_at: lastActiveAt,
    frequency_percentile: frequencyPercentile,
    provider_data_quality: stringOrNull(stats.provider_data_quality),
    provider_data_status: stringOrNull(stats.provider_data_status),
    provider_pnl_status: stringOrNull(stats.provider_pnl_status),
    provider_pnl_source: stringOrNull(stats.provider_pnl_source),
    provider_pnl_confidence: stringOrNull(stats.provider_pnl_confidence),
    pnl_currency: stringOrNull(stats.pnl_currency),
    verification_status: stringOrNull(stats.verification_status),
    replay_followability_status: stringOrNull(stats.replay_followability_status),
    data_completeness: finiteNumber(stats.data_completeness),
    identity_score: identityScore(identity.identity_status),
    social_influence_score: socialInfluenceScore(social),
    trading_quality_score: tradingQualityScore(input, frequencyPercentile),
    data_confidence_score: dataConfidenceScore(input, activityRecency),
    followability_score: input.address_type === "CONTRACT" ? 0 : followabilityScore(stats.replay_followability_status),
    freshness_score: recencyScore(activityRecency),
    total_score: 0,
    tier: null,
    lifecycle_status: "ACTIVE",
    gmgn_note: "身份待核",
    gmgn_emoji: "🔍",
    keep_recommendation: "REVIEW",
  };
  base.lifecycle_status = lifecycleStatus(base, activityRecency, hasSignal);
  base.total_score = round(
    base.identity_score * 0.2 +
      base.social_influence_score * 0.05 +
      base.trading_quality_score * 0.3 +
      base.data_confidence_score * 0.15 +
      base.followability_score * 0.2 +
      base.freshness_score * 0.1,
  );
  base.gmgn_note = generateGmgnNote(base);
  base.gmgn_emoji = chooseEmoji(base);
  return base;
}

function rankingComparator(a: WalletLibraryRecord, b: WalletLibraryRecord): number {
  return (
    b.total_score - a.total_score ||
    b.trading_quality_score - a.trading_quality_score ||
    b.data_confidence_score - a.data_confidence_score ||
    b.raw_label_count - a.raw_label_count ||
    sortText(a.chain, b.chain) ||
    sortText(a.address, b.address)
  );
}

function selectTier(records: WalletLibraryRecord[], tier: Exclude<WalletTier, null>, alreadySelected: Set<string>): WalletLibraryRecord[] {
  const eligible = records.filter((record) => record.lifecycle_status === "ACTIVE" && !alreadySelected.has(stableAddressKey(record)));
  const quota = TIER_CHAIN_QUOTAS[tier];
  const selected: WalletLibraryRecord[] = [];
  for (const chain of ["SOL", "BSC"] as const) {
    selected.push(
      ...eligible
        .filter((record) => record.chain === chain)
        .sort(rankingComparator)
        .slice(0, quota[chain]),
    );
  }
  const selectedKeys = new Set(selected.map(stableAddressKey));
  const target = Math.min(TIER_TARGETS[tier], eligible.length);
  if (selected.length < target) {
    selected.push(
      ...eligible
        .filter((record) => !selectedKeys.has(stableAddressKey(record)))
        .sort(rankingComparator)
        .slice(0, target - selected.length),
    );
  }
  return selected.sort(rankingComparator);
}

function setTier(record: WalletLibraryRecord, tier: Exclude<WalletTier, null>): void {
  record.tier = tier;
  record.keep_recommendation = tier === "CORE" ? "RETAIN_CORE" : tier === "WATCH" ? "RETAIN_WATCH" : "RETAIN_LEAD";
  record.gmgn_note = generateGmgnNote(record);
  record.gmgn_emoji = chooseEmoji(record);
}

export interface BuiltLibrary {
  records: WalletLibraryRecord[];
  benchmarks: CohortBenchmarks;
  changes: Record<string, Array<Record<string, unknown>>>;
  previousSnapshot: string | null;
}

export function buildWalletLibrary(input: WalletLibraryInput, previousRecords: WalletLibraryRecord[] = [], previousSnapshot: string | null = null): BuiltLibrary {
  if (input.schema_version !== WALLET_LIBRARY_INPUT_SCHEMA_VERSION) {
    throw new Error(`Unsupported wallet library input schema: ${input.schema_version}`);
  }
  const sortedInput = [...input.wallets].sort((a, b) => sortText(a.chain, b.chain) || sortText(a.address, b.address));
  const seen = new Set<string>();
  for (const wallet of sortedInput) {
    const key = `${wallet.chain}\u0000${wallet.address}`;
    if (seen.has(key)) throw new Error(`Duplicate wallet in input: ${wallet.chain}`);
    seen.add(key);
  }
  const frequencyPercentiles = rankPercentiles(sortedInput);
  const records = sortedInput.map((wallet) => buildBaseRecord(wallet, input.as_of, frequencyPercentiles));
  const selected = new Set<string>();
  for (const tier of ["CORE", "WATCH", "LEAD"] as const) {
    for (const record of selectTier(records, tier, selected)) {
      selected.add(stableAddressKey(record));
      setTier(record, tier);
    }
  }

  const currentKeys = new Set(records.map(stableAddressKey));
  const previousByKey = new Map(previousRecords.map((record) => [stableAddressKey(record), record]));
  for (const previous of previousRecords) {
    if (currentKeys.has(stableAddressKey(previous))) continue;
    const retained: WalletLibraryRecord = {
      ...previous,
      tier: null,
      lifecycle_status: "INACTIVE",
      keep_recommendation: "REVIEW",
    };
    records.push(retained);
  }

  const changes = compareRecords(previousByKey, records);
  records.sort((a, b) => sortText(a.chain, b.chain) || (tierOrder(a.tier) - tierOrder(b.tier)) || rankingComparator(a, b));
  return {
    records,
    benchmarks: buildCohortBenchmarks(records, input.as_of),
    changes,
    previousSnapshot,
  };
}

function tierOrder(tier: WalletTier): number {
  if (tier === "CORE") return 0;
  if (tier === "WATCH") return 1;
  if (tier === "LEAD") return 2;
  return 3;
}

function isMaterialChange(oldValue: number | null, newValue: number | null, absoluteThreshold: number): boolean {
  if (oldValue === null || newValue === null) return oldValue !== newValue;
  return Math.abs(newValue - oldValue) >= absoluteThreshold && (Math.abs(oldValue) < 1 || Math.abs(newValue - oldValue) / Math.max(Math.abs(oldValue), 1) >= 0.2);
}

function changeEntry(record: WalletLibraryRecord, previous?: WalletLibraryRecord): Record<string, unknown> {
  return {
    chain: record.chain,
    address: record.address,
    canonical_identity: record.canonical_identity,
    old_tier: previous?.tier ?? null,
    new_tier: record.tier,
    old_lifecycle_status: previous?.lifecycle_status ?? null,
    new_lifecycle_status: record.lifecycle_status,
    old_note: previous?.gmgn_note ?? null,
    new_note: record.gmgn_note,
  };
}

function compareRecords(previous: Map<string, WalletLibraryRecord>, current: WalletLibraryRecord[]): Record<string, Array<Record<string, unknown>>> {
  const changes: Record<string, Array<Record<string, unknown>>> = {
    newly_added: [],
    promoted_to_core: [],
    promoted_to_watch: [],
    demoted: [],
    removed_from_active_watch: [],
    identity_changed: [],
    social_changed: [],
    note_changed: [],
    pnl_changed_materially: [],
    win_rate_changed_materially: [],
    payoff_changed_materially: [],
    stale_addresses: [],
  };
  const currentKeys = new Set(current.map(stableAddressKey));
  for (const record of current) {
    const old = previous.get(stableAddressKey(record));
    if (!old) {
      changes.newly_added!.push(changeEntry(record));
    } else {
      if (record.tier === "CORE" && old.tier !== "CORE") changes.promoted_to_core!.push(changeEntry(record, old));
      if (record.tier === "WATCH" && old.tier !== "WATCH") changes.promoted_to_watch!.push(changeEntry(record, old));
      if (tierOrder(record.tier) > tierOrder(old.tier) && record.tier !== null && old.tier !== null) changes.demoted!.push(changeEntry(record, old));
      if (old.tier !== null && record.tier === null && record.lifecycle_status !== "ACTIVE") changes.removed_from_active_watch!.push(changeEntry(record, old));
      if (record.identity_status !== old.identity_status || record.dominant_alias !== old.dominant_alias || record.identity_display_name !== old.identity_display_name) {
        changes.identity_changed!.push(changeEntry(record, old));
      }
      if (JSON.stringify(record.social) !== JSON.stringify(old.social)) changes.social_changed!.push(changeEntry(record, old));
      if (record.gmgn_note !== old.gmgn_note || record.gmgn_emoji !== old.gmgn_emoji) changes.note_changed!.push(changeEntry(record, old));
      if (isMaterialChange(old.pnl_30d, record.pnl_30d, 100)) changes.pnl_changed_materially!.push(changeEntry(record, old));
      if (isMaterialChange(old.win_rate_30d, record.win_rate_30d, 10)) changes.win_rate_changed_materially!.push(changeEntry(record, old));
      if (isMaterialChange(old.payoff_ratio, record.payoff_ratio, 0.5)) changes.payoff_changed_materially!.push(changeEntry(record, old));
    }
    if (record.lifecycle_status === "STALE") changes.stale_addresses!.push(changeEntry(record, old));
  }
  for (const old of previous.values()) {
    if (currentKeys.has(stableAddressKey(old))) continue;
    changes.removed_from_active_watch!.push({
      chain: old.chain,
      address: old.address,
      canonical_identity: old.canonical_identity,
      old_tier: old.tier,
      new_tier: null,
      old_lifecycle_status: old.lifecycle_status,
      new_lifecycle_status: "INACTIVE",
      old_note: old.gmgn_note,
      new_note: old.gmgn_note,
    });
  }
  return changes;
}

function quantile(values: number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const index = Math.floor((values.length - 1) * fraction);
  return round(values[index] ?? values[values.length - 1]!);
}

function summarizeMetric(records: WalletLibraryRecord[], field: (typeof METRIC_FIELDS)[number]): CohortMetricSummary {
  const values = records.map((record) => finiteNumber(record[field])).filter((value): value is number => value !== null).sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    valid_count: values.length,
    null_count: records.length - values.length,
    zero_count: values.filter((value) => value === 0).length,
    mean: values.length > 0 ? round(sum / values.length, 4) : null,
    median: quantile(values, 0.5),
    p25: quantile(values, 0.25),
    p75: quantile(values, 0.75),
  };
}

export function buildCohortBenchmarks(records: WalletLibraryRecord[], asOf: string): CohortBenchmarks {
  const cohorts: Record<string, Record<string, CohortMetricSummary>> = {};
  for (const chain of ["SOL", "BSC"] as const) {
    const chainRecords = records.filter((record) => record.chain === chain);
    const groups: Record<string, WalletLibraryRecord[]> = {
      all: chainRecords,
      active: chainRecords.filter((record) => record.lifecycle_status === "ACTIVE"),
      core: chainRecords.filter((record) => record.tier === "CORE"),
      watch: chainRecords.filter((record) => record.tier === "WATCH"),
      lead: chainRecords.filter((record) => record.tier === "LEAD"),
    };
    for (const [group, groupRecords] of Object.entries(groups)) {
      const metrics: Record<string, CohortMetricSummary> = {};
      for (const field of METRIC_FIELDS) metrics[field] = summarizeMetric(groupRecords, field);
      cohorts[`${chain}_${group}`] = metrics;
    }
  }
  return { schema_version: "wallet-library-cohort-benchmarks-v1", as_of: asOf, cohorts };
}

function jsonStringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeUtf8Lf(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content.replace(/\r\n/g, "\n"), { encoding: "utf8" });
}

function writeJson(filePath: string, value: unknown): void {
  writeUtf8Lf(filePath, jsonStringify(value));
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function recordsToCsv(records: WalletLibraryRecord[]): string {
  const header = OUTPUT_COLUMNS.join(",");
  const rows = records.map((record) =>
    OUTPUT_COLUMNS.map((column) => {
      if (column === "x_handle") return escapeCsv(record.social.x_handle);
      if (column === "x_display_name") return escapeCsv(record.social.x_display_name);
      if (column === "x_followers_exact") return escapeCsv(record.social.x_followers_exact);
      if (column === "x_followers_compact") return escapeCsv(record.social.x_followers_compact);
      if (column === "x_verified_status") return escapeCsv(record.social.x_verified_status);
      if (column === "wallet_social_mapping_status") return escapeCsv(record.social.wallet_social_mapping_status);
      if (column === "social_sources") return escapeCsv(record.social.social_sources);
      if (column === "social_observed_at") return escapeCsv(record.social.social_observed_at);
      if (column === "social_confidence") return escapeCsv(record.social.social_confidence);
      if (column === "raw_labels") return escapeCsv(record.raw_labels);
      if (column === "alias_variants") return escapeCsv(record.alias_variants);
      return escapeCsv((record as unknown as Record<string, unknown>)[column]);
    }).join(","),
  );
  return `${header}\n${rows.join("\n")}\n`;
}

function gmgnRows(records: WalletLibraryRecord[]): Array<{ address: string; name: string; emoji: string }> {
  return records
    .filter((record) => record.address_type !== "CONTRACT" && record.lifecycle_status === "ACTIVE")
    .sort((a, b) => sortText(a.chain, b.chain) || tierOrder(a.tier) - tierOrder(b.tier) || rankingComparator(a, b))
    .map((record) => ({ address: record.address, name: record.gmgn_note, emoji: record.gmgn_emoji }));
}

function allGmgnRows(records: WalletLibraryRecord[], chain: WalletChain): Array<{ address: string; name: string; emoji: string }> {
  return gmgnRows(records.filter((record) => record.chain === chain && (record.tier === "CORE" || record.tier === "WATCH")));
}

function labelDensityBucket(count: number): string {
  if (count >= 10) return "10+";
  if (count >= 5) return "5-9";
  if (count >= 3) return "3-4";
  if (count >= 1) return "1-2";
  return "0";
}

export function bscLabelReviewCsv(records: WalletLibraryRecord[]): string {
  const selected = records
    .filter((record) => record.chain === "BSC" && record.raw_label_count >= 3)
    .sort((a, b) => b.raw_label_count - a.raw_label_count || rankingComparator(a, b));
  const columns = [
    "address",
    "raw_label_count",
    "raw_labels",
    "normalized_label_count",
    "dominant_alias",
    "dominant_alias_share",
    "identity_status",
    "identity_confidence",
    "current_gmgn_note",
    "new_gmgn_note",
    "tier",
    "lifecycle_status",
    "keep_recommendation",
    "review_bucket",
  ];
  const rows = selected.map((record) =>
    [
      record.address,
      record.raw_label_count,
      record.raw_labels,
      record.normalized_label_count,
      record.dominant_alias,
      record.dominant_alias_share,
      record.identity_status,
      record.identity_confidence,
      record.current_gmgn_note,
      record.gmgn_note,
      record.tier,
      record.lifecycle_status,
      record.keep_recommendation,
      labelDensityBucket(record.raw_label_count),
    ].map(escapeCsv).join(","),
  );
  return `${columns.join(",")}\n${rows.join("\n")}\n`;
}

export function labelDensitySummary(records: WalletLibraryRecord[]): Record<string, number> {
  const summary = { total_bsc: 0, zero: 0, one_to_two: 0, three_to_four: 0, five_to_nine: 0, ten_plus: 0, at_least_three: 0, at_least_five: 0, at_least_ten: 0 };
  for (const record of records.filter((item) => item.chain === "BSC")) {
    summary.total_bsc += 1;
    if (record.raw_label_count === 0) summary.zero += 1;
    else if (record.raw_label_count <= 2) summary.one_to_two += 1;
    else if (record.raw_label_count <= 4) summary.three_to_four += 1;
    else if (record.raw_label_count <= 9) summary.five_to_nine += 1;
    else summary.ten_plus += 1;
    if (record.raw_label_count >= 3) summary.at_least_three += 1;
    if (record.raw_label_count >= 5) summary.at_least_five += 1;
    if (record.raw_label_count >= 10) summary.at_least_ten += 1;
  }
  return summary;
}

function relativeOutputPath(filePath: string, outputRoot: string): string {
  return path.relative(outputRoot, filePath).replaceAll(path.sep, "/");
}

function readPreviousSnapshot(outputRoot: string, runId: string, explicit: string | null | undefined): { records: WalletLibraryRecord[]; location: string | null } {
  const candidates: string[] = [];
  if (explicit) candidates.push(explicit);
  const snapshotRoot = path.join(outputRoot, "snapshots");
  if (fs.existsSync(snapshotRoot)) {
    candidates.push(
      ...fs
        .readdirSync(snapshotRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== runId)
        .map((entry) => path.join(snapshotRoot, entry.name))
        .sort((a, b) => sortText(b, a)),
    );
  }
  const latest = path.join(outputRoot, "latest", "wallet_library_full.json");
  candidates.push(latest);
  for (const candidate of candidates) {
    const file = candidate.endsWith(".json") ? candidate : path.join(candidate, "wallet_library_full.json");
    if (!fs.existsSync(file)) continue;
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Array.isArray(parsed)) return { records: parsed as WalletLibraryRecord[], location: path.dirname(file) };
      if (parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)) {
        return { records: (parsed as { records: WalletLibraryRecord[] }).records, location: path.dirname(file) };
      }
    } catch {
      // Try the next previous snapshot; a corrupt previous artifact must not block a refresh.
    }
  }
  return { records: [], location: null };
}

function copyDirectoryContents(source: string, destination: string): void {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) fs.cpSync(from, to, { recursive: true });
    else fs.copyFileSync(from, to);
  }
}

function changeCsv(changes: Record<string, Array<Record<string, unknown>>>): string {
  const rows: string[] = ["change_type,chain,address,canonical_identity,old_tier,new_tier,old_lifecycle_status,new_lifecycle_status,old_note,new_note"];
  for (const [changeType, entries] of Object.entries(changes)) {
    for (const entry of entries) {
      rows.push(
        [
          changeType,
          entry.chain,
          entry.address,
          entry.canonical_identity,
          entry.old_tier,
          entry.new_tier,
          entry.old_lifecycle_status,
          entry.new_lifecycle_status,
          entry.old_note,
          entry.new_note,
        ].map(escapeCsv).join(","),
      );
    }
  }
  return `${rows.join("\n")}\n`;
}

function identityAliases(records: WalletLibraryRecord[]): unknown[] {
  return records.map((record) => ({
    chain: record.chain,
    address: record.address,
    canonical_identity: record.canonical_identity,
    identity_display_name: record.identity_display_name,
    raw_label_count: record.raw_label_count,
    normalized_label_count: record.normalized_label_count,
    unique_source_count: record.unique_source_count,
    dominant_alias: record.dominant_alias,
    dominant_alias_count: record.dominant_alias_count,
    dominant_alias_share: record.dominant_alias_share,
    identity_confidence: record.identity_confidence,
    identity_status: record.identity_status,
    alias_variants: record.alias_variants,
    identity_last_verified_at: record.identity_last_verified_at,
  }));
}

function socialEnrichment(records: WalletLibraryRecord[]): unknown[] {
  return records.map((record) => ({ chain: record.chain, address: record.address, ...record.social }));
}

function refreshCounts(records: WalletLibraryRecord[]): RefreshResult["counts"] {
  return {
    total: records.length,
    sol: records.filter((record) => record.chain === "SOL").length,
    bsc: records.filter((record) => record.chain === "BSC").length,
    identity_address_count: records.filter((record) => record.canonical_identity.length > 0).length,
    core: records.filter((record) => record.tier === "CORE").length,
    watch: records.filter((record) => record.tier === "WATCH").length,
    lead: records.filter((record) => record.tier === "LEAD").length,
    verified_wallet_match: records.filter((record) => record.social.wallet_social_mapping_status === "VERIFIED_WALLET_MATCH").length,
    notes_with_verified_followers: records.filter(
      (record) => record.social.wallet_social_mapping_status === "VERIFIED_WALLET_MATCH" && record.social.x_followers_exact !== null,
    ).length,
    valid_win_rate: records.filter((record) => record.win_rate_30d !== null).length,
    valid_payoff: records.filter((record) => record.payoff_ratio !== null).length,
    stale: records.filter((record) => record.lifecycle_status === "STALE").length,
    contracts_excluded: records.filter((record) => record.lifecycle_status === "EXCLUDED_CONTRACT").length,
  };
}

function changeCounts(changes: Record<string, Array<Record<string, unknown>>>): Record<string, number> {
  return Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.length]));
}

function maxNoteLength(records: WalletLibraryRecord[]): number {
  return Math.max(0, ...records.map((record) => Array.from(record.gmgn_note).length));
}

function validateInput(input: WalletLibraryInput): void {
  if (input.schema_version !== WALLET_LIBRARY_INPUT_SCHEMA_VERSION) throw new Error("wallet library input schema mismatch");
  if (!Array.isArray(input.wallets)) throw new Error("wallet library input wallets must be an array");
  if (!Number.isFinite(Date.parse(input.as_of))) throw new Error("wallet library input as_of must be an ISO timestamp");
  for (const wallet of input.wallets) {
    if (!wallet || !/^(SOL|BSC)$/.test(wallet.chain)) throw new Error("wallet chain must be SOL or BSC");
    if (typeof wallet.address !== "string" || wallet.address.length === 0) throw new Error("wallet address must be a non-empty string");
    if (!Array.isArray(wallet.labels)) throw new Error("wallet labels must be an array");
    if (!wallet.stats || typeof wallet.stats !== "object") throw new Error("wallet stats are required");
  }
}

function runIdFrom(options: RefreshOptions, input: WalletLibraryInput): string {
  if (options.runId && /^[A-Za-z0-9_.-]+$/.test(options.runId)) return options.runId;
  return `${input.as_of.slice(0, 10)}_${sha256(JSON.stringify(input)).slice(0, 12)}`.replaceAll(":", "");
}

function runAtFrom(options: RefreshOptions, input: WalletLibraryInput): string {
  if (options.runAt && Number.isFinite(Date.parse(options.runAt))) return new Date(options.runAt).toISOString();
  return new Date(input.as_of).toISOString();
}

export function executeWalletLibraryRefresh(options: RefreshOptions): RefreshResult {
  const input: WalletLibraryInput = JSON.parse(fs.readFileSync(options.inputFile, "utf8")) as WalletLibraryInput;
  validateInput(input);
  const runId = runIdFrom(options, input);
  const runAt = runAtFrom(options, input);
  const previous = readPreviousSnapshot(options.outputRoot, runId, options.previousSnapshot);
  const built = buildWalletLibrary(input, previous.records, previous.location ? relativeOutputPath(previous.location, options.outputRoot) : null);
  const counts = refreshCounts(built.records);
  const changes = changeCounts(built.changes);
  const outputRoot = options.outputRoot;

  if (options.dryRun) {
    return {
      run_id: runId,
      status: "DRY_RUN",
      counts,
      changes,
      max_note_length: maxNoteLength(built.records),
      backup_version_count: fs.existsSync(path.join(outputRoot, "backups")) ? fs.readdirSync(path.join(outputRoot, "backups"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length : 0,
      output_hash: sha256(jsonStringify({ records: built.records, benchmarks: built.benchmarks, changes: built.changes })),
      output_root: outputRoot,
    };
  }

  const snapshotDir = path.join(outputRoot, "snapshots", runId);
  const diffDir = path.join(outputRoot, "diffs", runId);
  const exportDir = path.join(outputRoot, "exports", runId);
  const backupDir = path.join(outputRoot, "backups", runId);
  if (fs.existsSync(snapshotDir)) throw new Error(`Snapshot already exists and is immutable: ${runId}`);
  for (const directory of [snapshotDir, diffDir, exportDir, backupDir, path.join(outputRoot, "latest")]) fs.mkdirSync(directory, { recursive: true });

  const fullPayload = { schema_version: WALLET_LIBRARY_SCHEMA_VERSION, as_of: input.as_of, run_id: runId, records: built.records };
  writeJson(path.join(snapshotDir, "wallet_library_full.json"), fullPayload);
  writeUtf8Lf(path.join(snapshotDir, "wallet_library_core.csv"), recordsToCsv(built.records.filter((record) => record.tier === "CORE")));
  writeUtf8Lf(path.join(snapshotDir, "wallet_library_watch.csv"), recordsToCsv(built.records.filter((record) => record.tier === "WATCH")));
  writeUtf8Lf(path.join(snapshotDir, "wallet_library_leads.csv"), recordsToCsv(built.records.filter((record) => record.tier === "LEAD")));
  writeJson(path.join(snapshotDir, "identity_aliases.json"), identityAliases(built.records));
  writeJson(path.join(snapshotDir, "social_enrichment.json"), socialEnrichment(built.records));
  writeJson(path.join(snapshotDir, "cohort_benchmarks.json"), built.benchmarks);

  writeJson(path.join(diffDir, "wallet_changes.json"), built.changes);
  writeUtf8Lf(path.join(diffDir, "wallet_changes.csv"), changeCsv(built.changes));
  const noteChanges = built.changes.note_changed ?? [];
  const identityChanges = built.changes.identity_changed ?? [];
  const socialChanges = built.changes.social_changed ?? [];
  writeUtf8Lf(path.join(diffDir, "note_changes.csv"), changeCsv({ note_changed: noteChanges }));
  writeUtf8Lf(path.join(diffDir, "identity_changes.csv"), changeCsv({ identity_changed: identityChanges }));
  writeUtf8Lf(path.join(diffDir, "social_changes.csv"), changeCsv({ social_changed: socialChanges }));
  writeUtf8Lf(
    path.join(diffDir, "refresh_summary.md"),
    [
      "# Wallet library refresh summary",
      "",
      `- run_id: ${runId}`,
      `- refresh_type: ${options.mode}`,
      `- previous_snapshot: ${built.previousSnapshot ?? "none"}`,
      `- address_count: ${counts.total}`,
      `- SOL/BSC: ${counts.sol}/${counts.bsc}`,
      `- CORE/WATCH/LEAD: ${counts.core}/${counts.watch}/${counts.lead}`,
      `- identity_address_count: ${counts.identity_address_count}`,
      `- notes_with_verified_followers: ${counts.notes_with_verified_followers}`,
      `- max_note_length: ${maxNoteLength(built.records)}`,
      `- warning: social enrichment is cache-only; no login or browser automation was used`,
      `- warning: GMGN export remains ${WALLET_LIBRARY_FORMAT_STATUS}`,
      "",
    ].join("\n"),
  );

  const solCore = built.records.filter((record) => record.chain === "SOL" && record.tier === "CORE");
  const solWatch = built.records.filter((record) => record.chain === "SOL" && record.tier === "WATCH");
  const bscCore = built.records.filter((record) => record.chain === "BSC" && record.tier === "CORE");
  const bscWatch = built.records.filter((record) => record.chain === "BSC" && record.tier === "WATCH");
  writeJson(path.join(exportDir, "sol_gmgn_core.json"), gmgnRows(solCore));
  writeJson(path.join(exportDir, "sol_gmgn_watch.json"), gmgnRows(solWatch));
  writeJson(path.join(exportDir, "bsc_gmgn_core.json"), gmgnRows(bscCore));
  writeJson(path.join(exportDir, "bsc_gmgn_watch.json"), gmgnRows(bscWatch));
  const solPaste = jsonStringify(allGmgnRows(built.records, "SOL"));
  const bscPaste = jsonStringify(allGmgnRows(built.records, "BSC"));
  writeUtf8Lf(path.join(exportDir, "sol_gmgn_paste.txt"), solPaste);
  writeUtf8Lf(path.join(exportDir, "bsc_gmgn_paste.txt"), bscPaste);
  writeUtf8Lf(path.join(exportDir, "bsc_label_review.csv"), bscLabelReviewCsv(built.records));
  writeJson(path.join(exportDir, "bsc_label_density_summary.json"), labelDensitySummary(built.records));
  writeJson(path.join(exportDir, "export_manifest.json"), {
    schema_version: "wallet-library-gmgn-export-v1",
    status: WALLET_LIBRARY_FORMAT_STATUS,
    template_status: "MISSING_OWNER_GMGN_EXPORT_TEMPLATE",
    ui_smoke_required: true,
    sol_core_count: solCore.length,
    sol_watch_count: solWatch.length,
    bsc_core_count: bscCore.length,
    bsc_watch_count: bscWatch.length,
    json_objects_exact_keys: ["address", "name", "emoji"],
    note_max_length: maxNoteLength(built.records),
  });

  copyDirectoryContents(snapshotDir, path.join(outputRoot, "latest"));
  for (const file of [
    "sol_gmgn_core.json",
    "sol_gmgn_watch.json",
    "bsc_gmgn_core.json",
    "bsc_gmgn_watch.json",
    "sol_gmgn_paste.txt",
    "bsc_gmgn_paste.txt",
    "bsc_label_review.csv",
    "bsc_label_density_summary.json",
    "export_manifest.json",
  ]) fs.copyFileSync(path.join(exportDir, file), path.join(outputRoot, "latest", file));
  copyDirectoryContents(snapshotDir, backupDir);

  const outputFiles = [...walkFiles(snapshotDir), ...walkFiles(diffDir), ...walkFiles(exportDir)].filter((file) => !file.endsWith("refresh_manifest.json"));
  const outputHashes: Record<string, string> = {};
  for (const file of outputFiles.sort(sortText)) outputHashes[`${path.basename(path.dirname(file))}/${path.basename(file)}`] = sha256(fs.readFileSync(file));
  const manifest = {
    schema_version: "wallet-library-refresh-manifest-v1",
    run_id: runId,
    started_at: runAt,
    completed_at: runAt,
    source_versions: input.source_versions,
    input_hashes: { ...input.input_hashes, standardized_input: sha256(fs.readFileSync(options.inputFile)) },
    address_count: counts.total,
    input_address_count: input.wallets.length,
    core_count: counts.core,
    watch_count: counts.watch,
    lead_count: counts.lead,
    output_hashes: outputHashes,
    previous_snapshot: built.previousSnapshot,
    refresh_type: options.mode,
    dry_run: false,
    cache_replay: options.cacheReplay ?? false,
    provider_budget: options.providerBudget ?? null,
    warnings: [
      "SOCIAL_ENRICHMENT_CACHE_ONLY",
      "NO_LOGIN_OR_BROWSER_AUTOMATION",
      "GMGN_EXPORT_PENDING_OWNER_UI_SMOKE",
      ...(previous.location ? [] : ["NO_PREVIOUS_SNAPSHOT"]),
    ],
    failures: [],
  };
  writeJson(path.join(snapshotDir, "refresh_manifest.json"), manifest);
  fs.copyFileSync(path.join(snapshotDir, "refresh_manifest.json"), path.join(outputRoot, "latest", "refresh_manifest.json"));

  const backupCount = fs.readdirSync(path.join(outputRoot, "backups"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
  return {
    run_id: runId,
    status: "SUCCESS",
    counts,
    changes,
    max_note_length: maxNoteLength(built.records),
    backup_version_count: backupCount,
    output_hash: sha256(jsonStringify({ records: built.records, benchmarks: built.benchmarks, changes: built.changes })),
    output_root: outputRoot,
  };
}

function walkFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(file));
    else files.push(file);
  }
  return files;
}
