import assert from "node:assert/strict";
import test from "node:test";
import {
  buildObservationRecord,
  computeSnapshotCompleteness,
  confirmFirstHand,
  isRawIntegerString,
  observationFingerprint,
  toRawIntegerString,
  type HolderConcentrationSnapshot,
  type MarketSnapshot,
  type ObservationSubject,
} from "../../src/domain/observation/observation-record.js";

const subject: ObservationSubject = { kind: "token", ref: "FixtureMint1111111111111111111111111111111" };
const capturedAt = new Date("2026-07-26T12:00:00.000Z");

function fullMarketSnapshot(): MarketSnapshot {
  return {
    priceUsd: 0.0000123,
    fdvUsd: 123_000,
    liquidityUsd: 45_000,
    marketCapUsd: 100_000,
    volume5mUsd: 500,
    volume1hUsd: 5_000,
    volume6hUsd: 30_000,
    volume24hUsd: 90_000,
    buys5m: 10,
    sells5m: 4,
    buys1h: 80,
    sells1h: 30,
    priceChange5mPct: 1.2,
    priceChange1hPct: 15.5,
    priceChange6hPct: 40.1,
    priceChange24hPct: 200.0,
    // Larger than Number.MAX_SAFE_INTEGER — only a string can carry this without loss.
    baseReserveRaw: toRawIntegerString("123456789012345678901234567890"),
    quoteReserveRaw: toRawIntegerString("9007199254740993"), // MAX_SAFE_INTEGER + 2
    baseDecimals: 6,
    quoteDecimals: 9,
    pairAddress: "pair-xyz",
    pairCreatedAt: new Date("2026-07-20T00:00:00.000Z"),
    pairAgeSeconds: 518_400,
  };
}

// --- (a) raw-integer strings: no bigint, no float, no precision loss, no Date coercion ---

test("raw chain amounts survive as decimal strings through JSON round-trip with no precision loss", () => {
  const snapshot = fullMarketSnapshot();
  const record = buildObservationRecord({
    observationId: "obs-market-1",
    chain: "solana",
    subject,
    source: "helius-pool-decode",
    origin: "first_hand",
    snapshotKind: "market",
    snapshot,
    parserVersion: "market-parser-v1",
    parserInputKind: "platform_json",
    confidence: 0.99,
    capturedAt,
    trustClass: "A",
  });

  // Simulate persistence (jsonb column / wire transport) — this is where floats
  // or bigints would silently lose precision or fail to serialize.
  const roundTripped = JSON.parse(JSON.stringify(record));

  assert.equal(typeof roundTripped.snapshot.baseReserveRaw, "string");
  assert.equal(roundTripped.snapshot.baseReserveRaw, "123456789012345678901234567890");
  assert.equal(roundTripped.snapshot.quoteReserveRaw, "9007199254740993");

  // A float/Number representation would have rounded this value; the string must not.
  assert.notEqual(Number(roundTripped.snapshot.quoteReserveRaw), BigInt(roundTripped.snapshot.quoteReserveRaw));
  assert.equal(BigInt(roundTripped.snapshot.quoteReserveRaw).toString(), "9007199254740993");

  // Raw amount fields must never be Date instances or ISO date strings.
  assert.equal(roundTripped.snapshot.baseReserveRaw instanceof Date, false);
  assert.doesNotMatch(roundTripped.snapshot.baseReserveRaw, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(isRawIntegerString(record.snapshot.baseReserveRaw as string));
});

test("toRawIntegerString rejects floats, signs, and non-numeric text; accepts bigint", () => {
  assert.throws(() => toRawIntegerString("1.5"));
  assert.throws(() => toRawIntegerString("-100"));
  assert.throws(() => toRawIntegerString("1e10"));
  assert.throws(() => toRawIntegerString("not-a-number"));
  assert.equal(toRawIntegerString(123456789012345678901234567890n), "123456789012345678901234567890");
  assert.equal(isRawIntegerString("007"), true);
  assert.equal(isRawIntegerString(1000 as unknown as string), false);
});

test("observationFingerprint is stable for identical inputs (replay determinism, PD-3)", () => {
  const fp1 = observationFingerprint({
    source: "helius-pool-decode",
    subject,
    snapshotKind: "market",
    parserVersion: "market-parser-v1",
    sourceObservedAt: capturedAt,
    rawHash: "hash-abc",
  });
  const fp2 = observationFingerprint({
    source: "helius-pool-decode",
    subject,
    snapshotKind: "market",
    parserVersion: "market-parser-v1",
    sourceObservedAt: capturedAt,
    rawHash: "hash-abc",
  });
  assert.equal(fp1, fp2);
});

// --- (b) borrowed stays unverified until a first-hand confirmation path flips it ---

function borrowedHolderSnapshot(partial: boolean): HolderConcentrationSnapshot {
  return {
    holderCount: 1200,
    top10Pct: 42.5,
    top20Pct: 58.1,
    devHoldingPct: partial ? null : 12.0,
    bundlerHoldingPct: partial ? null : 3.4,
    ownerAggregated: false,
    isBorrowedConcentration: true,
  };
}

test("borrowed observation stays origin=borrowed + verification_status=unverified at capture", () => {
  const record = buildObservationRecord({
    observationId: "obs-holder-1",
    chain: "solana",
    subject,
    source: "gmgn",
    origin: "borrowed",
    snapshotKind: "holder_concentration",
    snapshot: borrowedHolderSnapshot(false),
    parserVersion: "gmgn-holder-parser-v1",
    parserInputKind: "platform_json",
    confidence: 0.9,
    capturedAt,
    trustClass: "B",
  });

  assert.equal(record.origin, "borrowed");
  assert.equal(record.verificationStatus, "unverified");
  assert.equal(record.snapshot.ownerAggregated, false);
  assert.equal(record.snapshot.isBorrowedConcentration, true);
  assert.equal(record.confirmation, null);
});

test("first-hand confirmation flips verification_status to verified but never changes origin", () => {
  const record = buildObservationRecord({
    observationId: "obs-holder-2",
    chain: "solana",
    subject,
    source: "birdeye",
    origin: "borrowed",
    snapshotKind: "holder_concentration",
    snapshot: borrowedHolderSnapshot(false),
    parserVersion: "birdeye-holder-parser-v1",
    parserInputKind: "platform_json",
    confidence: 0.85,
    capturedAt,
    trustClass: "B",
  });

  const confirmed = confirmFirstHand(record, {
    confirmedAt: new Date("2026-07-26T13:00:00.000Z"),
    confirmedBySource: "helius-owner-aggregation",
    ruleVersion: "holder-clean-v1",
    evidenceRef: "holder_snapshots/abc123",
  });

  assert.equal(confirmed.origin, "borrowed", "origin must never change after capture");
  assert.equal(confirmed.verificationStatus, "verified");
  assert.ok(confirmed.confirmation);
  assert.equal(confirmed.confirmation?.confirmedBySource, "helius-owner-aggregation");

  // Original record is untouched (pure function, no mutation).
  assert.equal(record.verificationStatus, "unverified");
});

test("confirmFirstHand refuses to 'confirm' an already first-hand observation", () => {
  const record = buildObservationRecord({
    observationId: "obs-holder-3",
    chain: "solana",
    subject,
    source: "helius-owner-aggregation",
    origin: "first_hand",
    snapshotKind: "holder_concentration",
    snapshot: {
      holderCount: 1200,
      top10Pct: 40,
      top20Pct: 55,
      devHoldingPct: 10,
      bundlerHoldingPct: 2,
      ownerAggregated: true,
      isBorrowedConcentration: false,
    },
    parserVersion: "onchain-holder-parser-v1",
    parserInputKind: "platform_json",
    confidence: 1,
    capturedAt,
    trustClass: "A",
  });

  assert.throws(() => confirmFirstHand(record, {
    confirmedAt: capturedAt,
    confirmedBySource: "x",
    ruleVersion: "y",
  }));
});

// --- (c) partial data lowers completeness and never fabricates precision ---

test("partial snapshot has lower completeness than full snapshot, with nulls (not fabricated values)", () => {
  const full = borrowedHolderSnapshot(false);
  const partial = borrowedHolderSnapshot(true);

  const fullCompleteness = computeSnapshotCompleteness(full as unknown as Record<string, unknown>);
  const partialCompleteness = computeSnapshotCompleteness(partial as unknown as Record<string, unknown>);

  assert.ok(partialCompleteness < fullCompleteness);
  assert.equal(partial.devHoldingPct, null);
  assert.equal(partial.bundlerHoldingPct, null);
  // Missing data must be null, never a coerced/guessed number like 0.
  assert.notEqual(partial.devHoldingPct, 0);
});

test("buildObservationRecord derives completeness from the snapshot and reflects partial data end to end", () => {
  const partialRecord = buildObservationRecord({
    observationId: "obs-holder-4",
    chain: "solana",
    subject,
    source: "dexscreener",
    origin: "borrowed",
    snapshotKind: "holder_concentration",
    snapshot: borrowedHolderSnapshot(true),
    parserVersion: "dexscreener-holder-parser-v1",
    parserInputKind: "platform_json",
    confidence: 0.7,
    capturedAt,
    trustClass: "B",
  });
  const fullRecord = buildObservationRecord({
    observationId: "obs-holder-5",
    chain: "solana",
    subject,
    source: "dexscreener",
    origin: "borrowed",
    snapshotKind: "holder_concentration",
    snapshot: borrowedHolderSnapshot(false),
    parserVersion: "dexscreener-holder-parser-v1",
    parserInputKind: "platform_json",
    confidence: 0.7,
    capturedAt,
    trustClass: "B",
  });

  assert.ok(partialRecord.completeness < fullRecord.completeness);
  assert.ok(partialRecord.completeness >= 0 && partialRecord.completeness <= 1);
  assert.equal(fullRecord.completeness, 1);
});

test("all six snapshot kinds construct with nullable fields and never require fabricated data", () => {
  const marketRecord = buildObservationRecord({
    observationId: "obs-m",
    chain: "solana",
    subject,
    source: "dexscreener",
    origin: "borrowed",
    snapshotKind: "market",
    snapshot: {
      priceUsd: null,
      fdvUsd: null,
      liquidityUsd: null,
      marketCapUsd: null,
      volume5mUsd: null,
      volume1hUsd: null,
      volume6hUsd: null,
      volume24hUsd: null,
      buys5m: null,
      sells5m: null,
      buys1h: null,
      sells1h: null,
      priceChange5mPct: null,
      priceChange1hPct: null,
      priceChange6hPct: null,
      priceChange24hPct: null,
      baseReserveRaw: null,
      quoteReserveRaw: null,
      baseDecimals: null,
      quoteDecimals: null,
      pairAddress: null,
      pairCreatedAt: null,
      pairAgeSeconds: null,
    },
    parserVersion: "market-parser-v1",
    parserInputKind: "platform_json",
    confidence: 0.2,
    capturedAt,
    trustClass: "C",
    warnings: ["all_fields_missing"],
  });
  assert.equal(marketRecord.completeness, 0);
  assert.equal(marketRecord.warnings.includes("all_fields_missing"), true);

  const securityRecord = buildObservationRecord({
    observationId: "obs-s",
    chain: "solana",
    subject,
    source: "goplus",
    origin: "borrowed",
    snapshotKind: "security",
    snapshot: {
      isHoneypot: null,
      buyTaxBps: null,
      sellTaxBps: null,
      mintAuthorityRenounced: true,
      freezeAuthorityRenounced: null,
      liquidityLocked: null,
      liquidityLockedPct: null,
      liquidityBurned: null,
      isOpenSource: null,
      providerRiskFlags: null,
    },
    parserVersion: "goplus-parser-v1",
    parserInputKind: "platform_json",
    confidence: 0.5,
    capturedAt,
    trustClass: "B",
  });
  // Tri-state: unknown fields are null, not fabricated `false`.
  assert.equal(securityRecord.snapshot.isHoneypot, null);
  assert.equal(securityRecord.snapshot.mintAuthorityRenounced, true);

  const walletSignalRecord = buildObservationRecord({
    observationId: "obs-w",
    chain: "solana",
    subject,
    source: "gmgn",
    origin: "borrowed",
    snapshotKind: "wallet_signal",
    snapshot: {
      freshWalletCount: 3,
      bundlerWalletCount: null,
      sniperWalletCount: null,
      devWalletCount: null,
      wallets: [{ address: "wallet-1", labels: ["sniper"], labelSource: "gmgn" }],
    },
    parserVersion: "gmgn-wallet-parser-v1",
    parserInputKind: "platform_json",
    confidence: 0.6,
    capturedAt,
    trustClass: "B",
  });
  assert.equal(walletSignalRecord.snapshot.wallets?.[0]?.labelSource, "gmgn");

  const promoRecord = buildObservationRecord({
    observationId: "obs-p",
    chain: "solana",
    subject,
    source: "dexscreener",
    origin: "borrowed",
    snapshotKind: "promotion_and_social",
    snapshot: {
      dexPaid: false,
      firstCallAt: null,
      groupSize: null,
      urls: null,
      boosts: null,
    },
    parserVersion: "promo-parser-v1",
    parserInputKind: "platform_json",
    confidence: 0.4,
    capturedAt,
    trustClass: "B",
  });
  assert.equal(promoRecord.snapshot.dexPaid, false);

  const callSourceRecord = buildObservationRecord({
    observationId: "obs-c",
    chain: "solana",
    subject,
    source: "telegram-forward",
    origin: "borrowed",
    snapshotKind: "call_source",
    snapshot: {
      callerHandle: "@alpha_caller",
      callerId: null,
      capturePath: "forwarded_text",
      groupName: "Fixture Alpha Group",
      calledAt: capturedAt,
      messageRef: "msg-123",
    },
    parserVersion: "call-source-parser-v1",
    parserInputKind: "forwarded_text",
    confidence: 0.8,
    capturedAt,
    trustClass: "D",
  });
  assert.equal(callSourceRecord.snapshot.capturePath, "forwarded_text");
});
