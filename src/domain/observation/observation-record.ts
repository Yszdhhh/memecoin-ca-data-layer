import { createHash } from "node:crypto";
import type { Chain, MarketTrustClass } from "../types.js";

/**
 * Versioned-parser ingress contract (docs/METHODS_ALPHA_SCORE_AND_DETECTORS.md Part 3,
 * PROJECT_ARCHITECTURE.md §7). Every external text/JSON/OCR source is admitted only
 * through a versioned parser emitting one ObservationRecord with one typed snapshot;
 * downstream code (judgment layer) consumes snapshot structs, never raw text (PD-1).
 *
 * Axioms preserved here (constitution #1/#7/#8):
 * - chain amounts are raw-integer STRINGS, never floats/bigint in this JSON-safe layer.
 * - borrowed (Tier-B / platform) fields carry origin="borrowed" +
 *   verificationStatus="unverified" until a first-hand confirmation path flips the
 *   verification status (origin itself never changes after capture).
 * - partial data lowers `completeness`; it never fabricates precision.
 */

/**
 * Raw on-chain integer amount serialized as a decimal-digit string (no sign, no
 * decimal point, no exponent, no floating point). Safe for numeric(78,0) columns
 * and for JSON transport without precision loss.
 */
export type RawIntegerString = string & { readonly __brand: "RawIntegerString" };

const RAW_INTEGER_PATTERN = /^\d+$/;

export function isRawIntegerString(value: unknown): value is RawIntegerString {
  return typeof value === "string" && RAW_INTEGER_PATTERN.test(value);
}

/**
 * Pure constructor for raw-integer strings. Accepts a decimal string or a bigint
 * (never a `number`/float — a float input is a programmer error, not a runtime
 * degradation, so it throws rather than silently rounding).
 */
export function toRawIntegerString(value: string | bigint): RawIntegerString {
  const asString = typeof value === "bigint" ? value.toString() : value;
  if (!RAW_INTEGER_PATTERN.test(asString)) {
    throw new Error(`invalid raw integer string: ${JSON.stringify(asString)}`);
  }
  return asString as RawIntegerString;
}

export type ObservationOrigin = "first_hand" | "borrowed";
export type VerificationStatus = "unverified" | "verified";

/** Capture path vocabulary (PROJECT_ARCHITECTURE.md §8 — Telegram Bot API cannot read other bots' messages). */
export type ParserInputKind = "forwarded_text" | "tdlib_client" | "ocr" | "manual" | "platform_json";

export type SnapshotKind =
  | "market"
  | "security"
  | "holder_concentration"
  | "wallet_signal"
  | "promotion_and_social"
  | "call_source";

export type ObservationSubjectKind = "token" | "wallet";

export interface ObservationSubject {
  kind: ObservationSubjectKind;
  /** Chain address (token CA or wallet address). */
  ref: string;
}

/**
 * Reversible evidence that a borrowed observation was corroborated by a first-hand
 * (Tier-A) check. Never mutates `origin` — the data is still platform-sourced; this
 * is what "flips" `verificationStatus` to "verified" (constitution #4 style trail).
 */
export interface FirstHandConfirmation {
  confirmedAt: Date;
  /** e.g. "helius-swap-recompute", "solana-rpc-owner-aggregation". */
  confirmedBySource: string;
  ruleVersion: string;
  evidenceRef?: string;
}

// ---------------------------------------------------------------------------
// 1. market_snapshot — field-parity with `market_observations` (007), differs
//    by origin/trust_class; never overwrites chain facts (#7).
// ---------------------------------------------------------------------------
export interface MarketSnapshot {
  priceUsd: number | null;
  fdvUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  volume5mUsd: number | null;
  volume1hUsd: number | null;
  volume6hUsd: number | null;
  volume24hUsd: number | null;
  buys5m: number | null;
  sells5m: number | null;
  buys1h: number | null;
  sells1h: number | null;
  priceChange5mPct: number | null;
  priceChange1hPct: number | null;
  priceChange6hPct: number | null;
  priceChange24hPct: number | null;
  baseReserveRaw: RawIntegerString | null;
  quoteReserveRaw: RawIntegerString | null;
  baseDecimals: number | null;
  quoteDecimals: number | null;
  pairAddress: string | null;
  pairCreatedAt: Date | null;
  pairAgeSeconds: number | null;
}

// ---------------------------------------------------------------------------
// 2. security_snapshot — booleans are TRI-STATE: absence is `null`, never
//    `false` (#8 — collapsing "unknown" into "false" fakes precision).
// ---------------------------------------------------------------------------
export interface SecuritySnapshot {
  isHoneypot: boolean | null;
  buyTaxBps: number | null;
  sellTaxBps: number | null;
  mintAuthorityRenounced: boolean | null;
  freezeAuthorityRenounced: boolean | null;
  liquidityLocked: boolean | null;
  liquidityLockedPct: number | null;
  liquidityBurned: boolean | null;
  isOpenSource: boolean | null;
  providerRiskFlags: string[] | null;
}

// ---------------------------------------------------------------------------
// 3. holder_concentration_snapshot — critical #3 guard: borrowed numbers set
//    ownerAggregated=false + isBorrowedConcentration=true. This snapshot
//    displays/cross-checks only; it never feeds Real-Top-Holders, which is
//    exclusively fed by the first-hand `holder_snapshots` pipeline.
// ---------------------------------------------------------------------------
export interface HolderConcentrationSnapshot {
  holderCount: number | null;
  top10Pct: number | null;
  top20Pct: number | null;
  devHoldingPct: number | null;
  bundlerHoldingPct: number | null;
  /** Owner-aggregation (constitution #3) applied before these percentages were computed. */
  ownerAggregated: boolean;
  /** True whenever this snapshot's numbers originate from a borrowed/platform source. */
  isBorrowedConcentration: boolean;
}

// ---------------------------------------------------------------------------
// 4. wallet_signal_snapshot — labels enter judgment as FEATURES not verdicts.
//    Precedence: self_computed > birdeye > vybe > gmgn > manual.
// ---------------------------------------------------------------------------
export type LabelSource = "self_computed" | "birdeye" | "vybe" | "gmgn" | "manual";

export const LABEL_SOURCE_PRECEDENCE: readonly LabelSource[] = [
  "self_computed",
  "birdeye",
  "vybe",
  "gmgn",
  "manual",
];

export interface LabeledWallet {
  address: string;
  labels: string[];
  labelSource: LabelSource;
}

export interface WalletSignalSnapshot {
  freshWalletCount: number | null;
  bundlerWalletCount: number | null;
  sniperWalletCount: number | null;
  devWalletCount: number | null;
  wallets: LabeledWallet[] | null;
}

// ---------------------------------------------------------------------------
// 5. promotion_and_social_snapshot — soft signals only, never gate safety.
// ---------------------------------------------------------------------------
export interface PromotionAndSocialSnapshot {
  dexPaid: boolean | null;
  firstCallAt: Date | null;
  groupSize: number | null;
  urls: string[] | null;
  boosts: number | null;
}

// ---------------------------------------------------------------------------
// 6. call_source_snapshot — who surfaced the CA; records capture path because
//    the Telegram Bot API cannot read other bots' messages, so forwarded/OCR/
//    user-client captures are unified and replay-deterministic (§8).
// ---------------------------------------------------------------------------
export interface CallSourceSnapshot {
  callerHandle: string | null;
  callerId: string | null;
  capturePath: ParserInputKind;
  groupName: string | null;
  calledAt: Date | null;
  messageRef: string | null;
}

export type ObservationSnapshotMap = {
  market: MarketSnapshot;
  security: SecuritySnapshot;
  holder_concentration: HolderConcentrationSnapshot;
  wallet_signal: WalletSignalSnapshot;
  promotion_and_social: PromotionAndSocialSnapshot;
  call_source: CallSourceSnapshot;
};

interface ObservationRecordBase {
  observationId: string;
  chain: Chain;
  subject: ObservationSubject;
  source: string;
  origin: ObservationOrigin;
  verificationStatus: VerificationStatus;
  /** Raw external text/JSON, when retainable (never secrets — PD-3/#8). */
  rawTextOrJson: string | null;
  /** Reference to an out-of-band raw blob (e.g. object storage key) when text is too large to inline. */
  rawRef: string | null;
  /** Hash of the raw payload, so any output change is attributable to a parser bump (PD-3). */
  rawHash: string | null;
  parserVersion: string;
  parserInputKind: ParserInputKind;
  /** Parsed-template-correctly confidence — orthogonal to truth (§3.2). */
  confidence: number;
  /** Fraction of the target snapshot's fields that are non-null. */
  completeness: number;
  capturedAt: Date;
  sourceObservedAt: Date | null;
  warnings: string[];
  trustClass: MarketTrustClass;
  /** Present once a borrowed observation has been corroborated by a first-hand check. */
  confirmation: FirstHandConfirmation | null;
  /** Idempotency key mirroring migration 008's UNIQUE (source, observation_fingerprint). */
  observationFingerprint: string;
}

/**
 * Unified observation record (docs/METHODS_ALPHA_SCORE_AND_DETECTORS.md §3.2),
 * narrowed to a specific snapshot kind `K`. Parametrized so that
 * `record.snapshot` carries the exact typed shape for that kind instead of the
 * six-way union — callers get compile-time access to snapshot-specific fields
 * without a cast.
 */
export type ObservationRecordFor<K extends SnapshotKind> = ObservationRecordBase & {
  snapshotKind: K;
  snapshot: ObservationSnapshotMap[K];
};

/** Discriminated union over all six typed observation records. */
export type ObservationRecord = { [K in SnapshotKind]: ObservationRecordFor<K> }[SnapshotKind];

/**
 * Counts non-null fields of a snapshot over its total declared fields. Pure and
 * deterministic: partial data lowers the result; it never invents a value to
 * keep the ratio high (constitution #8).
 */
export function computeSnapshotCompleteness(snapshot: Record<string, unknown>): number {
  const keys = Object.keys(snapshot);
  if (keys.length === 0) return 0;
  const filled = keys.filter((key) => {
    const value = snapshot[key];
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }).length;
  return filled / keys.length;
}

/**
 * Deterministic fingerprint mirroring `observationFingerprint` in
 * `rules/market-observation.ts`: stable across re-parses of the same raw input
 * at the same parser version, so idempotent append-only storage can dedupe
 * (PD-3 replay determinism).
 */
export function observationFingerprint(input: {
  source: string;
  subject: ObservationSubject;
  snapshotKind: SnapshotKind;
  parserVersion: string;
  sourceObservedAt: Date | null;
  rawHash: string | null;
}): string {
  const payload = [
    input.source,
    input.subject.kind,
    input.subject.ref,
    input.snapshotKind,
    input.parserVersion,
    input.sourceObservedAt?.toISOString() ?? "",
    input.rawHash ?? "",
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export interface BuildObservationRecordInput<K extends SnapshotKind> {
  observationId: string;
  chain: Chain;
  subject: ObservationSubject;
  source: string;
  origin: ObservationOrigin;
  snapshotKind: K;
  snapshot: ObservationSnapshotMap[K];
  parserVersion: string;
  parserInputKind: ParserInputKind;
  confidence: number;
  capturedAt: Date;
  trustClass: MarketTrustClass;
  sourceObservedAt?: Date;
  rawTextOrJson?: string;
  rawRef?: string;
  rawHash?: string;
  warnings?: string[];
  /** Override the derived completeness (e.g. when caller has richer knowledge of the target shape). */
  completeness?: number;
}

/**
 * Pure constructor for an `ObservationRecord`. Borrowed observations always
 * start `verificationStatus="unverified"` — there is no input path to construct
 * a borrowed+verified record directly; verification only happens via
 * `confirmFirstHand` below (constitution #7 / trust-tier discipline).
 */
export function buildObservationRecord<K extends SnapshotKind>(
  input: BuildObservationRecordInput<K>,
): ObservationRecordFor<K> {
  const warnings = input.warnings ?? [];
  const completeness = input.completeness ?? computeSnapshotCompleteness(
    input.snapshot as unknown as Record<string, unknown>,
  );
  const sourceObservedAt = input.sourceObservedAt ?? null;
  const rawHash = input.rawHash ?? null;

  const base: ObservationRecordBase = {
    observationId: input.observationId,
    chain: input.chain,
    subject: input.subject,
    source: input.source,
    origin: input.origin,
    verificationStatus: "unverified",
    rawTextOrJson: input.rawTextOrJson ?? null,
    rawRef: input.rawRef ?? null,
    rawHash,
    parserVersion: input.parserVersion,
    parserInputKind: input.parserInputKind,
    confidence: input.confidence,
    completeness,
    capturedAt: input.capturedAt,
    sourceObservedAt,
    warnings,
    trustClass: input.trustClass,
    confirmation: null,
    observationFingerprint: observationFingerprint({
      source: input.source,
      subject: input.subject,
      snapshotKind: input.snapshotKind,
      parserVersion: input.parserVersion,
      sourceObservedAt,
      rawHash,
    }),
  };

  return {
    ...base,
    snapshotKind: input.snapshotKind,
    snapshot: input.snapshot,
  };
}

/**
 * Flips `verificationStatus` to "verified" once a first-hand (Tier-A) path has
 * corroborated a borrowed observation. `origin` is intentionally left
 * untouched — the data still came from a platform source; only its trust state
 * changes, and the change carries its own reversible evidence trail (#4-style).
 * A first-hand-origin record is already trusted at capture and cannot be
 * "confirmed" again (would silently launder provenance).
 */
export function confirmFirstHand<K extends SnapshotKind>(
  record: ObservationRecordFor<K>,
  confirmation: FirstHandConfirmation,
): ObservationRecordFor<K> {
  if (record.origin !== "borrowed") {
    throw new Error("confirmFirstHand is only valid for origin=\"borrowed\" observations");
  }
  return {
    ...record,
    verificationStatus: "verified",
    confirmation,
  };
}
