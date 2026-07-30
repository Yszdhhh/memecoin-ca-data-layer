/**
 * CaScanResponse v1 — provider-neutral, versioned, fixture-driven domain
 * output contract for the judgment layer.
 *
 * Layer: judgment_layer (PROJECT_ARCHITECTURE.md §2).
 * This contract only composes already-normalized data and judgment evidence.
 * It does not fetch live data, implement providers, or import infrastructure.
 *
 * JSON-safe: chain amounts are decimal-digit strings; timestamps are ISO-8601
 * strings. Partial data lowers completeness and emits warnings; it never
 * fabricates precision (constitution #8). Tier-B (borrowed) fields remain
 * features, never confirmed conclusions (architecture §3).
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

/** Data trust tier (PROJECT_ARCHITECTURE.md §3). */
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
   * `null` when incomplete or denominator is zero — never invent a precise value.
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
  /** Optional 0–1 coverage score when more granular than the state enum. */
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
 * Wallet–token edge signals. External platform labels (if ever present) must
 * carry sourceTier B + verificationStatus unverified and must not be treated
 * as confirmed conclusions.
 */
export interface WalletTokenSignal {
  walletAddress: string;
  labels: string[];
  /** Feature labels only — never a confirmed judgment by themselves. */
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
  /** Risk labels such as "cluster" | "insider_suspected" — always versioned. */
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

function isRawIntegerString(value: unknown): value is string {
  return typeof value === "string" && RAW_INTEGER_PATTERN.test(value);
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
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function issue(
  code: ValidationIssueCode,
  path: string,
  message: string,
): ValidationIssue {
  return { code, path, message };
}

function scanForbiddenLeaks(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value === "string") {
    for (const { pattern, label } of FORBIDDEN_LEAK_PATTERNS) {
      if (pattern.test(value)) {
        issues.push(
          issue(
            "forbidden_provider_leak",
            path,
            `Forbidden secret/provider leak pattern matched (${label})`,
          ),
        );
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

function validateProvenance(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is SourceProvenance {
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected SourceProvenance object"));
    return false;
  }
  let ok = true;
  if (typeof value.source !== "string" || value.source.length === 0) {
    issues.push(issue("missing_field", `${path}.source`, "source is required"));
    ok = false;
  }
  if (!isSourceTier(value.sourceTier)) {
    issues.push(issue("invalid_source_tier", `${path}.sourceTier`, 'sourceTier must be "A" or "B"'));
    ok = false;
  }
  if (!isVerificationStatus(value.verificationStatus)) {
    issues.push(
      issue(
        "invalid_verification_status",
        `${path}.verificationStatus`,
        'verificationStatus must be "unverified" or "confirmed"',
      ),
    );
    ok = false;
  }
  if (typeof value.observedAt !== "string") {
    issues.push(issue("missing_field", `${path}.observedAt`, "observedAt ISO timestamp required"));
    ok = false;
  }
  // Tier-B may never be marked confirmed at the provenance level.
  if (value.sourceTier === "B" && value.verificationStatus === "confirmed") {
    issues.push(
      issue(
        "tier_b_confirmed_conclusion",
        path,
        "Tier-B provenance cannot have verificationStatus=confirmed",
      ),
    );
    ok = false;
  }
  return ok;
}

function validateRatioMetric(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is RatioMetric {
  if (value === null) {
    return true;
  }
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected RatioMetric object or null"));
    return false;
  }
  let ok = true;
  const required: Array<keyof RatioMetric> = [
    "numerator",
    "denominator",
    "universeDefinition",
    "ruleVersion",
    "completeness",
    "provenance",
  ];
  for (const key of required) {
    if (!(key in value) || value[key] === undefined) {
      issues.push(
        issue(
          "missing_ratio_metric_fields",
          `${path}.${key}`,
          `RatioMetric.${key} is required (numerator, denominator, universeDefinition, ruleVersion, completeness, provenance)`,
        ),
      );
      ok = false;
    }
  }
  if ("numerator" in value && value.numerator !== undefined && !isRawIntegerString(value.numerator)) {
    issues.push(issue("invalid_raw_integer", `${path}.numerator`, "numerator must be a raw integer string"));
    ok = false;
  }
  if (
    "denominator" in value &&
    value.denominator !== undefined &&
    !isRawIntegerString(value.denominator)
  ) {
    issues.push(
      issue("invalid_raw_integer", `${path}.denominator`, "denominator must be a raw integer string"),
    );
    ok = false;
  }
  if ("universeDefinition" in value && typeof value.universeDefinition !== "string") {
    issues.push(
      issue("invalid_type", `${path}.universeDefinition`, "universeDefinition must be a string"),
    );
    ok = false;
  }
  if ("universeDefinition" in value && value.universeDefinition === "") {
    issues.push(
      issue("missing_field", `${path}.universeDefinition`, "universeDefinition must be non-empty"),
    );
    ok = false;
  }
  if ("ruleVersion" in value && typeof value.ruleVersion !== "string") {
    issues.push(issue("invalid_type", `${path}.ruleVersion`, "ruleVersion must be a string"));
    ok = false;
  }
  if ("completeness" in value && !isCompletenessRatio(value.completeness)) {
    issues.push(
      issue("invalid_completeness", `${path}.completeness`, "completeness must be a number in [0, 1]"),
    );
    ok = false;
  }
  if ("ratio" in value) {
    const ratio = value.ratio;
    if (ratio !== null && (typeof ratio !== "number" || !Number.isFinite(ratio))) {
      issues.push(issue("invalid_type", `${path}.ratio`, "ratio must be number | null"));
      ok = false;
    }
  } else {
    issues.push(issue("missing_field", `${path}.ratio`, "ratio (number | null) is required"));
    ok = false;
  }
  if ("provenance" in value) {
    if (!validateProvenance(value.provenance, `${path}.provenance`, issues)) {
      ok = false;
    }
  }
  return ok;
}

function validateHolderEntry(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected HolderEntry object"));
    return false;
  }
  let ok = true;
  if (typeof value.address !== "string") {
    issues.push(issue("missing_field", `${path}.address`, "address required"));
    ok = false;
  }
  if (!isRawIntegerString(value.balanceRaw)) {
    issues.push(issue("invalid_raw_integer", `${path}.balanceRaw`, "balanceRaw must be raw integer string"));
    ok = false;
  }
  return ok;
}

function validateHolderUniverses(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): boolean {
  if (value === null) return true;
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected HolderUniverses object or null"));
    return false;
  }
  let ok = true;
  for (const key of HOLDER_UNIVERSE_KEYS) {
    if (!(key in value)) {
      issues.push(
        issue(
          "missing_holder_universe_key",
          `${path}.${key}`,
          `HolderUniverses must include ${key}`,
        ),
      );
      ok = false;
      continue;
    }
    const list = value[key];
    if (!Array.isArray(list)) {
      issues.push(issue("invalid_type", `${path}.${key}`, "expected array of HolderEntry"));
      ok = false;
      continue;
    }
    list.forEach((entry, index) => {
      if (!validateHolderEntry(entry, `${path}.${key}[${index}]`, issues)) {
        ok = false;
      }
    });
  }
  if (typeof value.ruleVersion !== "string") {
    issues.push(issue("missing_field", `${path}.ruleVersion`, "ruleVersion required"));
    ok = false;
  }
  if (!isCompletenessState(value.completeness)) {
    issues.push(issue("invalid_completeness", `${path}.completeness`, "invalid completeness state"));
    ok = false;
  }
  if (!validateProvenance(value.provenance, `${path}.provenance`, issues)) {
    ok = false;
  }
  if (!Array.isArray(value.warnings)) {
    issues.push(issue("invalid_type", `${path}.warnings`, "warnings must be an array"));
    ok = false;
  }
  return ok;
}

function validateJudgmentEvidence(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): boolean {
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected JudgmentEvidence object"));
    return false;
  }
  let ok = true;
  const requiredString = [
    "judgmentCode",
    "humanReadableSummary",
    "ruleVersion",
  ] as const;
  for (const key of requiredString) {
    if (typeof value[key] !== "string" || value[key] === "") {
      issues.push(issue("missing_field", `${path}.${key}`, `${key} is required`));
      ok = false;
    }
  }
  if (!Array.isArray(value.evidenceRefs)) {
    issues.push(issue("missing_field", `${path}.evidenceRefs`, "evidenceRefs array required"));
    ok = false;
  }
  if (typeof value.confidence !== "number" || !Number.isFinite(value.confidence)) {
    issues.push(issue("invalid_type", `${path}.confidence`, "confidence must be a finite number"));
    ok = false;
  }
  if (!isSourceTier(value.sourceTier)) {
    issues.push(issue("invalid_source_tier", `${path}.sourceTier`, 'sourceTier must be "A" or "B"'));
    ok = false;
  }
  if (!isCompletenessState(value.completeness)) {
    issues.push(issue("invalid_completeness", `${path}.completeness`, "invalid completeness state"));
    ok = false;
  }
  if (!Array.isArray(value.warnings)) {
    issues.push(issue("missing_field", `${path}.warnings`, "warnings array required"));
    ok = false;
  }
  if (value.status !== undefined && !isVerificationStatus(value.status)) {
    issues.push(
      issue(
        "invalid_verification_status",
        `${path}.status`,
        'status must be "unverified" or "confirmed" when present',
      ),
    );
    ok = false;
  }
  // Binding: Tier-B labels/features must never become confirmed conclusions.
  if (value.sourceTier === "B" && value.status === "confirmed") {
    issues.push(
      issue(
        "tier_b_confirmed_conclusion",
        path,
        "JudgmentEvidence with sourceTier=B cannot have status=confirmed",
      ),
    );
    ok = false;
  }
  return ok;
}

function validateTokenIdentity(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): boolean {
  if (!isObject(value)) {
    issues.push(issue("missing_field", path, "tokenIdentity is required"));
    return false;
  }
  let ok = true;
  if (value.chain !== "solana") {
    issues.push(issue("invalid_type", `${path}.chain`, 'chain must be "solana" in active stage'));
    ok = false;
  }
  if (typeof value.ca !== "string" || value.ca.length === 0) {
    issues.push(issue("missing_field", `${path}.ca`, "ca is required"));
    ok = false;
  }
  if (value.totalSupplyRaw !== null && !isRawIntegerString(value.totalSupplyRaw)) {
    issues.push(
      issue(
        "invalid_raw_integer",
        `${path}.totalSupplyRaw`,
        "totalSupplyRaw must be raw integer string or null",
      ),
    );
    ok = false;
  }
  if (!validateProvenance(value.provenance, `${path}.provenance`, issues)) {
    ok = false;
  }
  return ok;
}

function validateCompletenessReport(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): boolean {
  if (!isObject(value)) {
    issues.push(issue("missing_field", path, "completeness report is required"));
    return false;
  }
  let ok = true;
  if (!isCompletenessState(value.overall)) {
    issues.push(issue("invalid_completeness", `${path}.overall`, "invalid overall completeness"));
    ok = false;
  }
  if (value.ratio !== undefined && !isCompletenessRatio(value.ratio)) {
    issues.push(issue("invalid_completeness", `${path}.ratio`, "ratio must be in [0, 1] when present"));
    ok = false;
  }
  if (!isObject(value.sections)) {
    issues.push(issue("missing_field", `${path}.sections`, "sections map is required"));
    ok = false;
  } else {
    for (const [key, state] of Object.entries(value.sections)) {
      if (!isCompletenessState(state)) {
        issues.push(
          issue("invalid_completeness", `${path}.sections.${key}`, "invalid section completeness"),
        );
        ok = false;
      }
    }
  }
  return ok;
}

function validateOptionalSection(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  ratioPaths: string[],
): boolean {
  if (value === null || value === undefined) return true;
  if (!isObject(value)) {
    issues.push(issue("invalid_type", path, "expected object or null"));
    return false;
  }
  let ok = true;
  for (const rel of ratioPaths) {
    const parts = rel.split(".");
    let cursor: unknown = value;
    let full = path;
    for (const part of parts) {
      if (!isObject(cursor) || !(part in cursor)) {
        cursor = undefined;
        break;
      }
      cursor = cursor[part];
      full = `${full}.${part}`;
    }
    if (cursor !== undefined && !validateRatioMetric(cursor, full, issues)) {
      ok = false;
    }
  }
  if ("provenance" in value && value.provenance !== null && value.provenance !== undefined) {
    if (!validateProvenance(value.provenance, `${path}.provenance`, issues)) {
      ok = false;
    }
  }
  if ("completeness" in value && !isCompletenessState(value.completeness)) {
    issues.push(issue("invalid_completeness", `${path}.completeness`, "invalid completeness state"));
    ok = false;
  }
  return ok;
}

/**
 * Structural + invariant validation for a CaScanResponse v1 value.
 * Pure function: no I/O, no network, no provider imports.
 */
export function validateCaScanResponseV1(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  scanForbiddenLeaks(input, "", issues);

  if (!isObject(input)) {
    return {
      ok: false,
      issues: [issue("invalid_type", "", "root must be an object"), ...issues],
    };
  }

  if (!("schema" in input)) {
    issues.push(issue("missing_schema", "schema", "schema field is required"));
  } else if (input.schema !== CA_SCAN_RESPONSE_SCHEMA) {
    issues.push(
      issue(
        "invalid_schema",
        "schema",
        `schema must be "${CA_SCAN_RESPONSE_SCHEMA}", got ${JSON.stringify(input.schema)}`,
      ),
    );
  }

  if (!("version" in input)) {
    issues.push(issue("missing_version", "version", "version field is required"));
  } else if (input.version !== CA_SCAN_RESPONSE_VERSION) {
    issues.push(
      issue(
        "invalid_version",
        "version",
        `version must be "${CA_SCAN_RESPONSE_VERSION}", got ${JSON.stringify(input.version)}`,
      ),
    );
  }

  if (typeof input.generatedAt !== "string") {
    issues.push(issue("missing_field", "generatedAt", "generatedAt ISO timestamp required"));
  }

  validateTokenIdentity(input.tokenIdentity, "tokenIdentity", issues);
  validateCompletenessReport(input.completeness, "completeness", issues);

  if (!Array.isArray(input.warnings)) {
    issues.push(issue("missing_field", "warnings", "warnings array required"));
  }

  if (!Array.isArray(input.sourceProvenance)) {
    issues.push(issue("missing_field", "sourceProvenance", "sourceProvenance array required"));
  } else {
    input.sourceProvenance.forEach((p, i) => {
      validateProvenance(p, `sourceProvenance[${i}]`, issues);
    });
  }

  validateOptionalSection(input.marketSnapshot, "marketSnapshot", issues, []);
  validateOptionalSection(input.authorityFacts, "authorityFacts", issues, []);
  validateHolderUniverses(input.holderUniverses, "holderUniverses", issues);
  validateOptionalSection(input.cohortMetrics, "cohortMetrics", issues, [
    "top10Concentration",
    "top20Concentration",
    "excludedShare",
  ]);
  validateOptionalSection(input.devBehavior, "devBehavior", issues, [
    "currentHolding",
    "relatedHolding",
    "grossBought",
    "grossSold",
    "netDisposed",
    "soldOfAcquired",
  ]);

  if (!Array.isArray(input.walletTokenSignals)) {
    issues.push(issue("missing_field", "walletTokenSignals", "walletTokenSignals array required"));
  } else {
    input.walletTokenSignals.forEach((signal, i) => {
      if (!isObject(signal)) {
        issues.push(issue("invalid_type", `walletTokenSignals[${i}]`, "expected object"));
        return;
      }
      if (!isSourceTier(signal.labelSourceTier)) {
        issues.push(
          issue(
            "invalid_source_tier",
            `walletTokenSignals[${i}].labelSourceTier`,
            'labelSourceTier must be "A" or "B"',
          ),
        );
      }
      if (!isVerificationStatus(signal.labelVerificationStatus)) {
        issues.push(
          issue(
            "invalid_verification_status",
            `walletTokenSignals[${i}].labelVerificationStatus`,
            "invalid verification status",
          ),
        );
      }
      if (
        signal.labelSourceTier === "B" &&
        signal.labelVerificationStatus === "confirmed"
      ) {
        issues.push(
          issue(
            "tier_b_confirmed_conclusion",
            `walletTokenSignals[${i}]`,
            "Tier-B wallet labels cannot be confirmed conclusions",
          ),
        );
      }
      if ("provenance" in signal) {
        validateProvenance(signal.provenance, `walletTokenSignals[${i}].provenance`, issues);
      }
    });
  }

  if (!Array.isArray(input.clusterSummaries)) {
    issues.push(issue("missing_field", "clusterSummaries", "clusterSummaries array required"));
  } else {
    input.clusterSummaries.forEach((cluster, i) => {
      if (!isObject(cluster)) {
        issues.push(issue("invalid_type", `clusterSummaries[${i}]`, "expected object"));
        return;
      }
      if (cluster.confirmed === true && cluster.sourceTier === "B") {
        issues.push(
          issue(
            "tier_b_confirmed_conclusion",
            `clusterSummaries[${i}]`,
            "cluster cannot be confirmed from Tier-B alone",
          ),
        );
      }
    });
  }

  if (!Array.isArray(input.crossTokenMatches)) {
    issues.push(issue("missing_field", "crossTokenMatches", "crossTokenMatches array required"));
  } else {
    input.crossTokenMatches.forEach((match, i) => {
      if (!isObject(match)) {
        issues.push(issue("invalid_type", `crossTokenMatches[${i}]`, "expected object"));
        return;
      }
      if (match.verificationStatus === "confirmed" && match.sourceTier === "B") {
        issues.push(
          issue(
            "tier_b_confirmed_conclusion",
            `crossTokenMatches[${i}]`,
            "cross-token match cannot be confirmed from Tier-B alone",
          ),
        );
      }
    });
  }

  if (!Array.isArray(input.judgmentEvidence)) {
    issues.push(issue("missing_field", "judgmentEvidence", "judgmentEvidence array required"));
  } else {
    input.judgmentEvidence.forEach((je, i) => {
      validateJudgmentEvidence(je, `judgmentEvidence[${i}]`, issues);
    });
  }

  const ok = issues.length === 0;
  return ok
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
  let ratio: number | null;
  if (input.ratio !== undefined) {
    ratio = input.ratio;
  } else if (
    isRawIntegerString(input.numerator) &&
    isRawIntegerString(input.denominator) &&
    input.denominator !== "0" &&
    input.completeness > 0
  ) {
    const n = BigInt(input.numerator);
    const d = BigInt(input.denominator);
    ratio = Number((n * 1_000_000n) / d) / 1_000_000;
  } else {
    ratio = null;
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
