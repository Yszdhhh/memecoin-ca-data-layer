/**
 * CaScanResponse v1 鈥?provider-neutral, versioned, fixture-driven domain
 * output contract for the judgment layer.
 *
 * Layer: judgment_layer (PROJECT_ARCHITECTURE.md 搂2).
 * This contract only composes already-normalized data and judgment evidence.
 * It does not fetch live data, implement providers, or import infrastructure.
 *
 * JSON-safe: chain amounts are decimal-digit strings; timestamps are ISO-8601
 * strings. Partial data lowers completeness and emits warnings; it never
 * fabricates precision (constitution #8). Tier-B (borrowed) fields remain
 * features, never confirmed conclusions (architecture 搂3).
 */

// ---------------------------------------------------------------------------
// Schema identity
// ---------------------------------------------------------------------------

export const CA_SCAN_RESPONSE_SCHEMA = "ca-scan-response" as const;
export const CA_SCAN_RESPONSE_VERSION = "v1" as const;

export type CaScanResponseSchema = typeof CA_SCAN_RESPONSE_SCHEMA;
export type CaScanResponseVersion = typeof CA_SCAN_RESPONSE_VERSION;

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Raw on-chain integer as a decimal-digit string (constitution #1). */
export type RawIntegerString = string;

/** ISO-8601 timestamp string (JSON-safe). */
export type IsoTimestamp = string;

/** Data trust tier (PROJECT_ARCHITECTURE.md 搂3). */
export type SourceTier = "A" | "B";

/**
 * Verification status for a field or judgment.
 * Tier-B sources must stay `unverified` until a Tier-A path confirms them.
 * `confirmed` is reserved for judgments that rest on Tier-A evidence.
 */
export type VerificationStatus = "unverified" | "confirmed";

/** Section / field completeness vocabulary (constitution #8). */
export type CompletenessState = "complete" | "partial" | "unavailable";

/** Numeric completeness in [0, 1]. */
export type CompletenessRatio = number;

export type ChainId = "solana";

export interface SourceProvenance {
  /** Stable source id, e.g. "helius-enhanced", "normalized-holder-snapshot", "address-library". */
  source: string;
  sourceTier: SourceTier;
  verificationStatus: VerificationStatus;
  observedAt: IsoTimestamp;
  /** Optional watermark / cursor / slot ref for replay. */
  watermarkRef?: string;
  /** Optional evidence blob or fixture path (never secrets). */
  evidenceRef?: string;
  ruleVersion?: string;
}

/**
 * Every ratio or concentration metric must carry numerator, denominator,
 * universe definition, rule version, completeness, and provenance.
 */
export interface RatioMetric {
  /** Raw integer numerator (string). */
  numerator: RawIntegerString;
  /** Raw integer denominator (string). */
  denominator: RawIntegerString;
  /**
   * Derived ratio in [0, 1] when both sides are known and denominator > 0.
   * `null` when incomplete or denominator is zero 鈥?never invent a precise value.
   */
  ratio: number | null;
  /**
   * Named holder / cohort universe this metric was computed against.
   * Examples: "cleaned_top_holders", "owner_aggregated_holders", "token_supply".
   */
  universeDefinition: string;
  ruleVersion: string;
  completeness: CompletenessRatio;
  provenance: SourceProvenance;
}

export interface CompletenessReport {
  overall: CompletenessState;
  /** Optional 0鈥? coverage score when more granular than the state enum. */
  ratio?: CompletenessRatio;
  sections: Record<string, CompletenessState>;
}

// ---------------------------------------------------------------------------
// Section shapes
// ---------------------------------------------------------------------------

export interface TokenIdentity {
  chain: ChainId;
  /** Token mint / contract address. */
  ca: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  /** Total supply as raw integer string; null when unavailable. */
  totalSupplyRaw: RawIntegerString | null;
  launchpad: string | null;
  createdAt: IsoTimestamp | null;
  creationTx: string | null;
  provenance: SourceProvenance;
}

export interface MarketSnapshotSection {
  priceUsd: number | null;
  fdvUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  pairAddress: string | null;
  volume24hUsd: number | null;
  observedAt: IsoTimestamp | null;
  completeness: CompletenessState;
  /** Market enrichment is Tier-B by default and never overrides chain facts. */
  provenance: SourceProvenance;
  warnings: string[];
}

export interface AuthorityFacts {
  mintAuthority: string | null;
  mintAuthorityRenounced: boolean | null;
  freezeAuthority: string | null;
  freezeAuthorityRenounced: boolean | null;
  /** Pump create.creator when available; null when unknown. */
  creatorAddress: string | null;
  creatorProvenance: SourceProvenance | null;
  completeness: CompletenessState;
  provenance: SourceProvenance;
  warnings: string[];
}

export interface HolderEntry {
  address: string;
  balanceRaw: RawIntegerString;
  rank?: number;
  /** Present when this row is a token account before owner aggregation. */
  ownerAddress?: string;
  exclusionReason?: string;
  clusterId?: string;
  confidence?: number;
  ruleVersion?: string;
}

/**
 * Holder universes must keep these six populations distinct.
 * Ranking consumers use `cleaned_top_holders` only after owner aggregation
 * and reversible exclusions (constitution #3 / #4).
 */
export interface HolderUniverses {
  raw_top_holders: HolderEntry[];
  owner_aggregated_holders: HolderEntry[];
  cleaned_top_holders: HolderEntry[];
  excluded_infrastructure: HolderEntry[];
  excluded_pools: HolderEntry[];
  excluded_burn_addresses: HolderEntry[];
  ruleVersion: string;
  completeness: CompletenessState;
  provenance: SourceProvenance;
  warnings: string[];
}

export interface CohortMetrics {
  top10Concentration: RatioMetric | null;
  top20Concentration: RatioMetric | null;
  eligibleHolderCount: number | null;
  excludedShare: RatioMetric | null;
  ruleVersion: string;
  completeness: CompletenessState;
  warnings: string[];
}

/**
 * Wallet鈥搕oken edge signals. External platform labels (if ever present) must
 * carry sourceTier B + verificationStatus unverified and must not be treated
 * as confirmed conclusions.
 */
export interface WalletTokenSignal {
  walletAddress: string;
  labels: string[];
  /** Feature labels only 鈥?never a confirmed judgment by themselves. */
  labelSourceTier: SourceTier;
  labelVerificationStatus: VerificationStatus;
  firstBuyAt: IsoTimestamp | null;
  lastActivityAt: IsoTimestamp | null;
  balanceRaw: RawIntegerString | null;
  confidence: number;
  ruleVersion: string;
  provenance: SourceProvenance;
  warnings: string[];
}

export interface ClusterSummary {
  clusterId: string;
  memberCount: number;
  aggregateBalanceRaw: RawIntegerString | null;
  confidence: number;
  /** Risk labels such as "cluster" | "insider_suspected" 鈥?always versioned. */
  riskLabels: string[];
  /** True only when Tier-A evidence crossed the confirmed threshold. */
  confirmed: boolean;
  ruleVersion: string;
  sourceTier: SourceTier;
  completeness: CompletenessState;
  evidenceRefs: string[];
  warnings: string[];
}

export interface DevBehaviorSection {
  creatorAddress: string | null;
  currentHolding: RatioMetric | null;
  relatedHolding: RatioMetric | null;
  grossBought: RatioMetric | null;
  grossSold: RatioMetric | null;
  netDisposed: RatioMetric | null;
  soldOfAcquired: RatioMetric | null;
  directSellCount: number | null;
  relatedAddresses: string[];
  calculatedAt: IsoTimestamp | null;
  ruleVersion: string;
  completeness: CompletenessState;
  provenance: SourceProvenance;
  warnings: string[];
}

export interface CrossTokenMatch {
  relatedTokenCa: string;
  matchKind: string;
  sharedWallets: string[];
  confidence: number;
  ruleVersion: string;
  sourceTier: SourceTier;
  verificationStatus: VerificationStatus;
  evidenceRefs: string[];
  completeness: CompletenessState;
  warnings: string[];
}

/**
 * Explainable judgment evidence. A confirmed conclusion requires Tier-A
 * sourceTier; Tier-B may only appear as feature corroboration (unverified).
 */
export interface JudgmentEvidence {
  judgmentCode: string;
  humanReadableSummary: string;
  evidenceRefs: string[];
  confidence: number;
  ruleVersion: string;
  sourceTier: SourceTier;
  completeness: CompletenessState;
  warnings: string[];
  /**
   * Optional status pin. When present and equal to "confirmed", sourceTier
   * must be "A". Tier-B cannot be a confirmed conclusion.
   */
  status?: VerificationStatus;
}

// ---------------------------------------------------------------------------
// Root response
// ---------------------------------------------------------------------------

export interface CaScanResponseV1 {
  schema: CaScanResponseSchema;
  version: CaScanResponseVersion;
  generatedAt: IsoTimestamp;
  tokenIdentity: TokenIdentity;
  marketSnapshot: MarketSnapshotSection | null;
  authorityFacts: AuthorityFacts | null;
  holderUniverses: HolderUniverses | null;
  cohortMetrics: CohortMetrics | null;
  walletTokenSignals: WalletTokenSignal[];
  clusterSummaries: ClusterSummary[];
  devBehavior: DevBehaviorSection | null;
  crossTokenMatches: CrossTokenMatch[];
  judgmentEvidence: JudgmentEvidence[];
  sourceProvenance: SourceProvenance[];
  completeness: CompletenessReport;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ValidationIssueCode =
  | "missing_schema"
  | "invalid_schema"
  | "missing_version"
  | "invalid_version"
  | "missing_field"
  | "invalid_type"
  | "invalid_raw_integer"
  | "invalid_completeness"
  | "missing_ratio_metric_fields"
  | "missing_holder_universe_key"
  | "tier_b_confirmed_conclusion"
  | "invalid_source_tier"
  | "invalid_verification_status"
  | "forbidden_provider_leak";

export interface ValidationIssue {
  code: ValidationIssueCode;
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  value?: CaScanResponseV1;
}

const RAW_INTEGER_PATTERN = /^\d+$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const HOLDER_UNIVERSE_KEYS = [
  "raw_top_holders",
  "owner_aggregated_holders",
  "cleaned_top_holders",
  "excluded_infrastructure",
  "excluded_pools",
  "excluded_burn_addresses",
] as const;

/** Strings that must never appear in a judgment-layer fixture or response. */
const FORBIDDEN_LEAK_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /hotsniper/i, label: "Hotsniper" },
  { pattern: /cookie\s*[:=]/i, label: "Cookie header" },
  { pattern: /api[_-]?key\s*[:=]/i, label: "API key" },
  { pattern: /authorization\s*[:=]/i, label: "Authorization header" },
  { pattern: /bearer\s+[a-z0-9._-]+/i, label: "Bearer token" },
  { pattern: /private[_-]?key/i, label: "private key" },
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRawIntegerString(value: unknown): value is string {
  return typeof value === "string" && RAW_INTEGER_PATTERN.test(value);
}

function isPositiveRawIntegerString(value: unknown): value is string {
  return isRawIntegerString(value) && BigInt(value) > 0n;
}

function isRawIntegerOrNull(value: unknown): value is string | null {
  return value === null || isRawIntegerString(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return false;
  const [datePart, timeAndZone] = value.split("T");
  if (!datePart || !timeAndZone) return false;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timeAndZone.slice(0, 8).split(":").map(Number);
  if ([year, month, day, hour, minute, second].some((part) => part === undefined)) return false;
  if ((hour as number) > 23 || (minute as number) > 59 || (second as number) > 59) return false;
  const calendar = new Date(Date.UTC(year as number, (month as number) - 1, day as number));
  return calendar.getUTCFullYear() === year && calendar.getUTCMonth() === (month as number) - 1 && calendar.getUTCDate() === day;
}

function isIsoTimestampOrNull(value: unknown): value is string | null {
  return value === null || isIsoTimestamp(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isNonNegativeIntegerOrNull(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && (value as number) >= 0);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCompletenessState(value: unknown): value is CompletenessState {
  return value === "complete" || value === "partial" || value === "unavailable";
}

function isSourceTier(value: unknown): value is SourceTier {
  return value === "A" || value === "B";
}

function isVerificationStatus(value: unknown): value is VerificationStatus {
  return value === "unverified" || value === "confirmed";
}

function isCompletenessRatio(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function isConfidence(value: unknown): value is number {
  return isCompletenessRatio(value);
}

function issue(code: ValidationIssueCode, path: string, message: string): ValidationIssue {
  return { code, path, message };
}

function childPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function requireField(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
): boolean {
  if (!hasOwn(value, key) || value[key] === undefined) {
    issues.push(issue("missing_field", childPath(path, key), `${key} is required`));
    return false;
  }
  return true;
}

function validateRequired(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
  predicate: (candidate: unknown) => boolean,
  message: string,
  code: ValidationIssueCode = "invalid_type",
): boolean {
  if (!requireField(value, key, path, issues)) return false;
  if (!predicate(value[key])) {
    issues.push(issue(code, childPath(path, key), message));
    return false;
  }
  return true;
}

function scanForbiddenLeaks(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value === "string") {
    for (const { pattern, label } of FORBIDDEN_LEAK_PATTERNS) {
      if (pattern.test(value)) {
        issues.push(issue("forbidden_provider_leak", path, `Forbidden secret/provider leak pattern matched (${label})`));
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenLeaks(item, `${path}[${index}]`, issues));
    return;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      scanForbiddenLeaks(child, path ? `${path}.${key}` : key, issues);
    }
  }
}

function validateProvenance(value: unknown, path: string, issues: ValidationIssue[]): value is SourceProvenance {
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected SourceProvenance object"));
    return false;
  }
  let ok = true;
  ok = validateRequired(value, "source", path, issues, isNonEmptyString, "source must be a non-empty string") && ok;
  ok = validateRequired(value, "sourceTier", path, issues, isSourceTier, 'sourceTier must be "A" or "B"', "invalid_source_tier") && ok;
  ok = validateRequired(value, "verificationStatus", path, issues, isVerificationStatus, 'verificationStatus must be "unverified" or "confirmed"', "invalid_verification_status") && ok;
  ok = validateRequired(value, "observedAt", path, issues, isIsoTimestamp, "observedAt must be an ISO-8601 timestamp") && ok;
  for (const key of ["watermarkRef", "evidenceRef", "ruleVersion"] as const) {
    if (hasOwn(value, key) && value[key] !== undefined && typeof value[key] !== "string") {
      issues.push(issue("invalid_type", `${path}.${key}`, `${key} must be a string when present`));
      ok = false;
    }
  }
  if (value.sourceTier === "B" && value.verificationStatus === "confirmed") {
    issues.push(issue("tier_b_confirmed_conclusion", path, "Tier-B provenance cannot have verificationStatus=confirmed"));
    ok = false;
  }
  return ok;
}

function validateRatioMetric(value: unknown, path: string, issues: ValidationIssue[]): value is RatioMetric {
  if (value === null) return true;
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected RatioMetric object or null"));
    return false;
  }
  let ok = true;
  for (const key of ["numerator", "denominator", "ratio", "universeDefinition", "ruleVersion", "completeness", "provenance"] as const) {
    if (!hasOwn(value, key) || value[key] === undefined) {
      issues.push(issue("missing_ratio_metric_fields", `${path}.${key}`, `RatioMetric.${key} is required`));
      ok = false;
    }
  }
  if (hasOwn(value, "numerator") && !isRawIntegerString(value.numerator)) {
    issues.push(issue("invalid_raw_integer", `${path}.numerator`, "numerator must be a raw integer string"));
    ok = false;
  }
  if (hasOwn(value, "denominator") && !isRawIntegerString(value.denominator)) {
    issues.push(issue("invalid_raw_integer", `${path}.denominator`, "denominator must be a raw integer string"));
    ok = false;
  }
  if (hasOwn(value, "ratio") && value.ratio !== null && !isCompletenessRatio(value.ratio)) {
    issues.push(issue("invalid_type", `${path}.ratio`, "ratio must be null or a finite number in [0, 1]"));
    ok = false;
  }
  if (!isNonEmptyString(value.universeDefinition)) {
    issues.push(issue("missing_ratio_metric_fields", `${path}.universeDefinition`, "universeDefinition must be non-empty"));
    ok = false;
  }
  if (!isNonEmptyString(value.ruleVersion)) {
    issues.push(issue("missing_ratio_metric_fields", `${path}.ruleVersion`, "ruleVersion must be non-empty"));
    ok = false;
  }
  if (!isCompletenessRatio(value.completeness)) {
    issues.push(issue("invalid_completeness", `${path}.completeness`, "completeness must be in [0, 1]"));
    ok = false;
  }
  if (value.ratio !== null && (value.completeness !== 1 || !isPositiveRawIntegerString(value.denominator))) {
    issues.push(issue("invalid_completeness", `${path}.ratio`, "ratio must be null unless evidence is complete and denominator is positive"));
    ok = false;
  }
  if (!validateProvenance(value.provenance, `${path}.provenance`, issues)) ok = false;
  return ok;
}

function validateHolderEntry(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected holder entry object"));
    return false;
  }
  let ok = true;
  ok = validateRequired(value, "address", path, issues, isNonEmptyString, "address must be non-empty") && ok;
  ok = validateRequired(value, "balanceRaw", path, issues, isRawIntegerString, "balanceRaw must be a raw integer string", "invalid_raw_integer") && ok;
  if (hasOwn(value, "rank") && value.rank !== undefined && (!Number.isInteger(value.rank) || (value.rank as number) < 1)) {
    issues.push(issue("invalid_type", `${path}.rank`, "rank must be a positive integer when present"));
    ok = false;
  }
  for (const key of ["ownerAddress", "exclusionReason", "clusterId", "ruleVersion"] as const) {
    if (hasOwn(value, key) && value[key] !== undefined && typeof value[key] !== "string") {
      issues.push(issue("invalid_type", `${path}.${key}`, `${key} must be a string when present`));
      ok = false;
    }
  }
  if (hasOwn(value, "confidence") && value.confidence !== undefined && !isConfidence(value.confidence)) {
    issues.push(issue("invalid_type", `${path}.confidence`, "confidence must be in [0, 1] when present"));
    ok = false;
  }
  return ok;
}

function validateHolderUniverses(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (value === null) return true;
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected HolderUniverses object or null"));
    return false;
  }
  let ok = true;
  for (const key of HOLDER_UNIVERSE_KEYS) {
    if (!hasOwn(value, key) || !Array.isArray(value[key])) {
      issues.push(issue("missing_holder_universe_key", `${path}.${key}`, `${key} array is required`));
      ok = false;
      continue;
    }
    (value[key] as unknown[]).forEach((entry, index) => {
      if (!validateHolderEntry(entry, `${path}.${key}[${index}]`, issues)) ok = false;
    });
  }
  ok = validateRequired(value, "ruleVersion", path, issues, isNonEmptyString, "ruleVersion must be non-empty") && ok;
  ok = validateRequired(value, "completeness", path, issues, isCompletenessState, "invalid completeness state", "invalid_completeness") && ok;
  if (!validateProvenance(value.provenance, `${path}.provenance`, issues)) ok = false;
  ok = validateRequired(value, "warnings", path, issues, isStringArray, "warnings must be a string array") && ok;
  return ok;
}

function validateJudgmentEvidence(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected JudgmentEvidence object"));
    return false;
  }
  let ok = true;
  ok = validateRequired(value, "judgmentCode", path, issues, isNonEmptyString, "judgmentCode must be non-empty") && ok;
  ok = validateRequired(value, "humanReadableSummary", path, issues, isNonEmptyString, "humanReadableSummary must be non-empty") && ok;
  ok = validateRequired(value, "evidenceRefs", path, issues, isStringArray, "evidenceRefs must be a string array") && ok;
  ok = validateRequired(value, "confidence", path, issues, isConfidence, "confidence must be in [0, 1]") && ok;
  ok = validateRequired(value, "ruleVersion", path, issues, isNonEmptyString, "ruleVersion must be non-empty") && ok;
  ok = validateRequired(value, "sourceTier", path, issues, isSourceTier, 'sourceTier must be "A" or "B"', "invalid_source_tier") && ok;
  ok = validateRequired(value, "completeness", path, issues, isCompletenessState, "invalid completeness state", "invalid_completeness") && ok;
  ok = validateRequired(value, "warnings", path, issues, isStringArray, "warnings must be a string array") && ok;
  if (hasOwn(value, "status") && value.status !== undefined && !isVerificationStatus(value.status)) {
    issues.push(issue("invalid_verification_status", `${path}.status`, "invalid verification status"));
    ok = false;
  }
  if (value.sourceTier === "B" && value.status === "confirmed") {
    issues.push(issue("tier_b_confirmed_conclusion", path, "JudgmentEvidence with sourceTier=B cannot have status=confirmed"));
    ok = false;
  }
  return ok;
}

function validateTokenIdentity(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (!isObject(value)) {
    issues.push(issue("missing_field", path, "tokenIdentity is required"));
    return false;
  }
  let ok = true;
  ok = validateRequired(value, "chain", path, issues, (candidate) => candidate === "solana", 'chain must be "solana"') && ok;
  ok = validateRequired(value, "ca", path, issues, isNonEmptyString, "ca must be non-empty") && ok;
  for (const key of ["name", "symbol", "launchpad", "creationTx"] as const) {
    ok = validateRequired(value, key, path, issues, isStringOrNull, `${key} must be string or null`) && ok;
  }
  ok = validateRequired(value, "decimals", path, issues, (candidate) => candidate === null || (Number.isInteger(candidate) && (candidate as number) >= 0), "decimals must be a non-negative integer or null") && ok;
  ok = validateRequired(value, "totalSupplyRaw", path, issues, isRawIntegerOrNull, "totalSupplyRaw must be raw integer string or null", "invalid_raw_integer") && ok;
  ok = validateRequired(value, "createdAt", path, issues, isIsoTimestampOrNull, "createdAt must be an ISO-8601 timestamp or null") && ok;
  if (!validateProvenance(value.provenance, `${path}.provenance`, issues)) ok = false;
  return ok;
}

function validateMarketSnapshot(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (value === null) return true;
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected MarketSnapshotSection object or null"));
    return false;
  }
  let ok = true;
  for (const key of ["priceUsd", "fdvUsd", "liquidityUsd", "marketCapUsd", "volume24hUsd"] as const) {
    ok = validateRequired(value, key, path, issues, isFiniteNumberOrNull, `${key} must be a finite number or null`) && ok;
  }
  ok = validateRequired(value, "pairAddress", path, issues, isStringOrNull, "pairAddress must be string or null") && ok;
  ok = validateRequired(value, "observedAt", path, issues, isIsoTimestampOrNull, "observedAt must be an ISO-8601 timestamp or null") && ok;
  ok = validateRequired(value, "completeness", path, issues, isCompletenessState, "invalid completeness state", "invalid_completeness") && ok;
  if (!validateProvenance(value.provenance, `${path}.provenance`, issues)) ok = false;
  ok = validateRequired(value, "warnings", path, issues, isStringArray, "warnings must be a string array") && ok;
  return ok;
}

function validateAuthorityFacts(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (value === null) return true;
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected AuthorityFacts object or null"));
    return false;
  }
  let ok = true;
  for (const key of ["mintAuthority", "freezeAuthority", "creatorAddress"] as const) {
    ok = validateRequired(value, key, path, issues, isStringOrNull, `${key} must be string or null`) && ok;
  }
  for (const key of ["mintAuthorityRenounced", "freezeAuthorityRenounced"] as const) {
    ok = validateRequired(value, key, path, issues, (candidate) => candidate === null || typeof candidate === "boolean", `${key} must be boolean or null`) && ok;
  }
  if (requireField(value, "creatorProvenance", path, issues) && value.creatorProvenance !== null && !validateProvenance(value.creatorProvenance, `${path}.creatorProvenance`, issues)) ok = false;
  ok = validateRequired(value, "completeness", path, issues, isCompletenessState, "invalid completeness state", "invalid_completeness") && ok;
  if (!validateProvenance(value.provenance, `${path}.provenance`, issues)) ok = false;
  ok = validateRequired(value, "warnings", path, issues, isStringArray, "warnings must be a string array") && ok;
  return ok;
}

function validateCohortMetrics(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (value === null) return true;
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected CohortMetrics object or null"));
    return false;
  }
  let ok = true;
  for (const key of ["top10Concentration", "top20Concentration", "excludedShare"] as const) {
    if (!requireField(value, key, path, issues) || !validateRatioMetric(value[key], `${path}.${key}`, issues)) ok = false;
  }
  ok = validateRequired(value, "eligibleHolderCount", path, issues, isNonNegativeIntegerOrNull, "eligibleHolderCount must be a non-negative integer or null") && ok;
  ok = validateRequired(value, "ruleVersion", path, issues, isNonEmptyString, "ruleVersion must be non-empty") && ok;
  ok = validateRequired(value, "completeness", path, issues, isCompletenessState, "invalid completeness state", "invalid_completeness") && ok;
  ok = validateRequired(value, "warnings", path, issues, isStringArray, "warnings must be a string array") && ok;
  return ok;
}

function validateWalletTokenSignal(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected WalletTokenSignal object"));
    return false;
  }
  let ok = true;
  ok = validateRequired(value, "walletAddress", path, issues, isNonEmptyString, "walletAddress must be non-empty") && ok;
  ok = validateRequired(value, "labels", path, issues, isStringArray, "labels must be a string array") && ok;
  ok = validateRequired(value, "labelSourceTier", path, issues, isSourceTier, 'labelSourceTier must be "A" or "B"', "invalid_source_tier") && ok;
  ok = validateRequired(value, "labelVerificationStatus", path, issues, isVerificationStatus, "invalid verification status", "invalid_verification_status") && ok;
  for (const key of ["firstBuyAt", "lastActivityAt"] as const) {
    ok = validateRequired(value, key, path, issues, isIsoTimestampOrNull, `${key} must be an ISO-8601 timestamp or null`) && ok;
  }
  ok = validateRequired(value, "balanceRaw", path, issues, isRawIntegerOrNull, "balanceRaw must be raw integer string or null", "invalid_raw_integer") && ok;
  ok = validateRequired(value, "confidence", path, issues, isConfidence, "confidence must be in [0, 1]") && ok;
  ok = validateRequired(value, "ruleVersion", path, issues, isNonEmptyString, "ruleVersion must be non-empty") && ok;
  if (!validateProvenance(value.provenance, `${path}.provenance`, issues)) ok = false;
  ok = validateRequired(value, "warnings", path, issues, isStringArray, "warnings must be a string array") && ok;
  if (value.labelSourceTier === "B" && value.labelVerificationStatus === "confirmed") {
    issues.push(issue("tier_b_confirmed_conclusion", path, "Tier-B wallet labels cannot be confirmed conclusions"));
    ok = false;
  }
  return ok;
}

function validateClusterSummary(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected ClusterSummary object"));
    return false;
  }
  let ok = true;
  ok = validateRequired(value, "clusterId", path, issues, isNonEmptyString, "clusterId must be non-empty") && ok;
  ok = validateRequired(value, "memberCount", path, issues, (candidate) => Number.isInteger(candidate) && (candidate as number) >= 0, "memberCount must be a non-negative integer") && ok;
  ok = validateRequired(value, "aggregateBalanceRaw", path, issues, isRawIntegerOrNull, "aggregateBalanceRaw must be raw integer string or null", "invalid_raw_integer") && ok;
  ok = validateRequired(value, "confidence", path, issues, isConfidence, "confidence must be in [0, 1]") && ok;
  ok = validateRequired(value, "riskLabels", path, issues, isStringArray, "riskLabels must be a string array") && ok;
  ok = validateRequired(value, "confirmed", path, issues, (candidate) => typeof candidate === "boolean", "confirmed must be boolean") && ok;
  ok = validateRequired(value, "ruleVersion", path, issues, isNonEmptyString, "ruleVersion must be non-empty") && ok;
  ok = validateRequired(value, "sourceTier", path, issues, isSourceTier, 'sourceTier must be "A" or "B"', "invalid_source_tier") && ok;
  ok = validateRequired(value, "completeness", path, issues, isCompletenessState, "invalid completeness state", "invalid_completeness") && ok;
  ok = validateRequired(value, "evidenceRefs", path, issues, isStringArray, "evidenceRefs must be a string array") && ok;
  ok = validateRequired(value, "warnings", path, issues, isStringArray, "warnings must be a string array") && ok;
  if (value.confirmed === true && value.sourceTier === "B") {
    issues.push(issue("tier_b_confirmed_conclusion", path, "cluster cannot be confirmed from Tier-B alone"));
    ok = false;
  }
  return ok;
}

function validateDevBehavior(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (value === null) return true;
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected DevBehaviorSection object or null"));
    return false;
  }
  let ok = true;
  ok = validateRequired(value, "creatorAddress", path, issues, isStringOrNull, "creatorAddress must be string or null") && ok;
  for (const key of ["currentHolding", "relatedHolding", "grossBought", "grossSold", "netDisposed", "soldOfAcquired"] as const) {
    if (!requireField(value, key, path, issues) || !validateRatioMetric(value[key], `${path}.${key}`, issues)) ok = false;
  }
  ok = validateRequired(value, "directSellCount", path, issues, isNonNegativeIntegerOrNull, "directSellCount must be a non-negative integer or null") && ok;
  ok = validateRequired(value, "relatedAddresses", path, issues, isStringArray, "relatedAddresses must be a string array") && ok;
  ok = validateRequired(value, "calculatedAt", path, issues, isIsoTimestampOrNull, "calculatedAt must be an ISO-8601 timestamp or null") && ok;
  ok = validateRequired(value, "ruleVersion", path, issues, isNonEmptyString, "ruleVersion must be non-empty") && ok;
  ok = validateRequired(value, "completeness", path, issues, isCompletenessState, "invalid completeness state", "invalid_completeness") && ok;
  if (!validateProvenance(value.provenance, `${path}.provenance`, issues)) ok = false;
  ok = validateRequired(value, "warnings", path, issues, isStringArray, "warnings must be a string array") && ok;
  return ok;
}

function validateCrossTokenMatch(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected CrossTokenMatch object"));
    return false;
  }
  let ok = true;
  ok = validateRequired(value, "relatedTokenCa", path, issues, isNonEmptyString, "relatedTokenCa must be non-empty") && ok;
  ok = validateRequired(value, "matchKind", path, issues, isNonEmptyString, "matchKind must be non-empty") && ok;
  ok = validateRequired(value, "sharedWallets", path, issues, isStringArray, "sharedWallets must be a string array") && ok;
  ok = validateRequired(value, "confidence", path, issues, isConfidence, "confidence must be in [0, 1]") && ok;
  ok = validateRequired(value, "ruleVersion", path, issues, isNonEmptyString, "ruleVersion must be non-empty") && ok;
  ok = validateRequired(value, "sourceTier", path, issues, isSourceTier, 'sourceTier must be "A" or "B"', "invalid_source_tier") && ok;
  ok = validateRequired(value, "verificationStatus", path, issues, isVerificationStatus, "invalid verification status", "invalid_verification_status") && ok;
  ok = validateRequired(value, "evidenceRefs", path, issues, isStringArray, "evidenceRefs must be a string array") && ok;
  ok = validateRequired(value, "completeness", path, issues, isCompletenessState, "invalid completeness state", "invalid_completeness") && ok;
  ok = validateRequired(value, "warnings", path, issues, isStringArray, "warnings must be a string array") && ok;
  if (value.sourceTier === "B" && value.verificationStatus === "confirmed") {
    issues.push(issue("tier_b_confirmed_conclusion", path, "cross-token match cannot be confirmed from Tier-B alone"));
    ok = false;
  }
  return ok;
}

function validateCompletenessReport(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (!isObject(value)) {
    issues.push(issue("missing_field", path, "completeness report is required"));
    return false;
  }
  let ok = true;
  ok = validateRequired(value, "overall", path, issues, isCompletenessState, "invalid overall completeness", "invalid_completeness") && ok;
  if (hasOwn(value, "ratio") && value.ratio !== undefined && !isCompletenessRatio(value.ratio)) {
    issues.push(issue("invalid_completeness", `${path}.ratio`, "ratio must be in [0, 1] when present"));
    ok = false;
  }
  if (!requireField(value, "sections", path, issues) || !isObject(value.sections)) {
    if (hasOwn(value, "sections")) issues.push(issue("invalid_type", `${path}.sections`, "sections must be an object"));
    ok = false;
  } else {
    for (const [key, state] of Object.entries(value.sections)) {
      if (!isCompletenessState(state)) {
        issues.push(issue("invalid_completeness", `${path}.sections.${key}`, "invalid section completeness"));
        ok = false;
      }
    }
  }
  return ok;
}

/** Structural + invariant validation for a CaScanResponse v1 value. Pure and offline. */
export function validateCaScanResponseV1(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  scanForbiddenLeaks(input, "", issues);
  if (!isObject(input)) {
    issues.push(issue("invalid_type", "", "CaScanResponse v1 must be an object"));
    return { ok: false, issues };
  }

  if (!hasOwn(input, "schema")) issues.push(issue("missing_schema", "schema", "schema field is required"));
  else if (input.schema !== CA_SCAN_RESPONSE_SCHEMA) issues.push(issue("invalid_schema", "schema", `schema must be "${CA_SCAN_RESPONSE_SCHEMA}"`));
  if (!hasOwn(input, "version")) issues.push(issue("missing_version", "version", "version field is required"));
  else if (input.version !== CA_SCAN_RESPONSE_VERSION) issues.push(issue("invalid_version", "version", `version must be "${CA_SCAN_RESPONSE_VERSION}"`));
  validateRequired(input, "generatedAt", "", issues, isIsoTimestamp, "generatedAt must be an ISO-8601 timestamp");

  if (requireField(input, "tokenIdentity", "", issues)) validateTokenIdentity(input.tokenIdentity, "tokenIdentity", issues);
  if (requireField(input, "marketSnapshot", "", issues)) validateMarketSnapshot(input.marketSnapshot, "marketSnapshot", issues);
  if (requireField(input, "authorityFacts", "", issues)) validateAuthorityFacts(input.authorityFacts, "authorityFacts", issues);
  if (requireField(input, "holderUniverses", "", issues)) validateHolderUniverses(input.holderUniverses, "holderUniverses", issues);
  if (requireField(input, "cohortMetrics", "", issues)) validateCohortMetrics(input.cohortMetrics, "cohortMetrics", issues);
  if (requireField(input, "devBehavior", "", issues)) validateDevBehavior(input.devBehavior, "devBehavior", issues);
  if (requireField(input, "completeness", "", issues)) validateCompletenessReport(input.completeness, "completeness", issues);

  const arrayValidators: ReadonlyArray<[string, (item: unknown, path: string, issues: ValidationIssue[]) => boolean]> = [
    ["walletTokenSignals", validateWalletTokenSignal],
    ["clusterSummaries", validateClusterSummary],
    ["crossTokenMatches", validateCrossTokenMatch],
    ["judgmentEvidence", validateJudgmentEvidence],
    ["sourceProvenance", validateProvenance],
  ];
  for (const [key, validator] of arrayValidators) {
    if (!requireField(input, key, "", issues)) continue;
    const value = input[key];
    if (!Array.isArray(value)) {
      issues.push(issue("invalid_type", key, `${key} must be an array`));
      continue;
    }
    value.forEach((item, index) => validator(item, `${key}[${index}]`, issues));
  }
  validateRequired(input, "warnings", "", issues, isStringArray, "warnings must be a string array");

  return issues.length === 0
    ? { ok: true, issues: [], value: input as unknown as CaScanResponseV1 }
    : { ok: false, issues };
}

/**
 * Asserting parse for fixtures and pure consumers. Throws AggregateError-style
 * message listing all issues when invalid.
 */
export function parseCaScanResponseV1(input: unknown): CaScanResponseV1 {
  const result = validateCaScanResponseV1(input);
  if (!result.ok || !result.value) {
    const detail = result.issues.map((i) => `${i.path}: [${i.code}] ${i.message}`).join("\n");
    throw new Error(`CaScanResponse v1 validation failed:\n${detail}`);
  }
  return result.value;
}

/** Helper for building RatioMetric values without dropping required fields. */
export function buildRatioMetric(input: {
  numerator: RawIntegerString;
  denominator: RawIntegerString;
  universeDefinition: string;
  ruleVersion: string;
  completeness: CompletenessRatio;
  provenance: SourceProvenance;
  /** When omitted, derived as numerator/denominator when both valid and denom > 0. */
  ratio?: number | null;
}): RatioMetric {
  let ratio: number | null = null;
  if (
    input.completeness === 1 &&
    isRawIntegerString(input.numerator) &&
    isPositiveRawIntegerString(input.denominator)
  ) {
    const denominator = BigInt(input.denominator);
    if (input.ratio !== undefined) {
      ratio = input.ratio === null || isCompletenessRatio(input.ratio) ? input.ratio : null;
    } else {
      const numerator = BigInt(input.numerator);
      ratio = numerator <= denominator
        ? Number((numerator * 1_000_000n) / denominator) / 1_000_000
        : null;
    }
  }

  return {
    numerator: input.numerator,
    denominator: input.denominator,
    ratio,
    universeDefinition: input.universeDefinition,
    ruleVersion: input.ruleVersion,
    completeness: input.completeness,
    provenance: input.provenance,
  };
}

export const HOLDER_UNIVERSE_KEY_LIST = HOLDER_UNIVERSE_KEYS;
