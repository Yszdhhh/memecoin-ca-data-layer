import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRatioConsistent,
  cleanHolderUniverse,
  normalizeAmount,
  ratioFromRaw,
  stableSerialize,
  type RawTokenAccountObservation,
} from "../../../src/domain/rules/holder-data-cleaning.js";
import { mapHolderCleaningToCaScanResponseV1 } from "../../../src/domain/mapping/map-holder-cleaning-to-ca-scan.js";
import { validateCaScanResponseV1 } from "../../../src/domain/contracts/ca-scan-response-v1.js";
import {
  cleanEnumeratedCa,
  hashStable,
  replayCleaningHash,
} from "../../../src/application/live/solana-ca-real-data-cleaning-pilot.js";

const OBSERVED = "2026-07-30T12:00:00.000Z";
const CA = "So11111111111111111111111111111111111111112";
const BURN = "1nc1nerator11111111111111111111111111111111";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

function obs(partial: Partial<RawTokenAccountObservation> & Pick<RawTokenAccountObservation, "tokenAccount" | "owner" | "rawAmount">): RawTokenAccountObservation {
  return {
    decimals: 6,
    accountState: "active",
    source: "helius",
    observedAt: OBSERVED,
    sourceWatermark: "helius|1|complete|no_cursor",
    ...partial,
  };
}

function assertPartitionIdentity(result: ReturnType<typeof cleanHolderUniverse>): void {
  const a = result.accounting;
  assert.equal(a.identity, "enumerated = included + excluded + unresolved");
  assert.equal(
    BigInt(a.includedOwnerBalanceRaw) + BigInt(a.excludedBalanceRaw) + BigInt(a.unresolvedBalanceRaw),
    BigInt(a.enumeratedTokenAccountBalanceRaw),
  );
}

// ---------------------------------------------------------------------------
// Original suite (updated for eligibility split)
// ---------------------------------------------------------------------------

test("1. merges multiple token accounts for the same owner", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "1000",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "ata1", owner: "alice", rawAmount: "100", decimals: 0 }),
      obs({ tokenAccount: "ata2", owner: "alice", rawAmount: "50", decimals: 0 }),
      obs({ tokenAccount: "ata3", owner: "bob", rawAmount: "850", decimals: 0 }),
    ],
  });
  const alice = result.owners.find((o) => o.owner === "alice");
  assert.equal(alice?.ownerRawAmount, "150");
  assert.equal(alice?.tokenAccountCount, 2);
  assert.equal(alice?.cleaningClass, "included_holder");
  assert.equal(result.universes.cleanedHolderUniverse.ownerCount, 2);
});

test("2. zero-balance accounts do not enter cleaned holder count", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "100",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "ata1", owner: "alice", rawAmount: "100", decimals: 0 }),
      obs({ tokenAccount: "ata2", owner: "zero-owner", rawAmount: "0", decimals: 0 }),
    ],
  });
  assert.equal(result.universes.cleanedHolderUniverse.ownerCount, 1);
  assert.ok(result.universes.excludedInfrastructureUniverse.owners.some((o) => o.owner === "zero-owner"));
  assert.ok(result.issues.some((i) => i.code === "zero_balance_account"));
});

test("3. unresolved addresses are not silently excluded", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "1000",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "ata1", owner: "suspicious-but-no-evidence", rawAmount: "900", decimals: 0 }),
      obs({ tokenAccount: "ata2", owner: "alice", rawAmount: "100", decimals: 0 }),
    ],
  });
  assert.equal(result.universes.cleanedHolderUniverse.ownerCount, 2);
  assert.ok(result.owners.every((o) => o.cleaningClass !== "liquidity_or_pool_account"));
  assert.equal(result.universes.unresolvedUniverse.ownerCount, 0);
});

test("4. incomplete pagination degrades accounting and concentration", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "1000",
    decimals: 0,
    paginationComplete: false,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "ata1", owner: "alice", rawAmount: "100", decimals: 0 }),
    ],
  });
  assert.equal(result.accounting.completeness, "partial");
  assert.equal(result.accountingEligible, false);
  assert.equal(result.concentrationEligible, false);
  assert.equal(result.judgmentEligible, false);
  assert.ok(result.issues.some((i) => i.code === "pagination_incomplete"));
  assert.ok(result.concentration.every((m) => m.completeness !== "complete"));
});

test("5. supply mismatch rejects accounting and concentration confirmation", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "1000",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "ata1", owner: "alice", rawAmount: "400", decimals: 0 }),
    ],
  });
  assert.equal(result.accountingEligible, false);
  assert.equal(result.concentrationEligible, false);
  assert.equal(result.judgmentEligible, false);
  assert.ok(result.issues.some((i) => i.code === "supply_mismatch"));
  const mapped = mapHolderCleaningToCaScanResponseV1({
    cleaning: result,
    name: null,
    symbol: null,
    decimals: 0,
    generatedAt: OBSERVED,
    mintProvenance: {
      source: "helius-mint",
      sourceTier: "A",
      verificationStatus: "unverified",
      observedAt: OBSERVED,
    },
  });
  assert.ok(mapped.judgmentEvidence.every((j) => j.status !== "confirmed" || j.judgmentCode !== "holder_supply_accounting_complete"));
  assert.equal(mapped.cohortMetrics?.top10Concentration?.ratio, null);
  assert.equal(mapped.cohortMetrics?.top10Concentration?.provenance.verificationStatus, "unverified");
});

test("6. BigInt large balances do not lose precision", () => {
  const huge = "9007199254740993001";
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: huge,
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "ata1", owner: "whale", rawAmount: huge, decimals: 0 }),
    ],
  });
  assert.equal(result.owners[0]?.ownerRawAmount, huge);
  assert.equal(result.accounting.enumeratedTokenAccountBalanceRaw, huge);
  assert.equal(result.accounting.includedOwnerBalanceRaw, huge);
});

test("7. decimals normalization is correct", () => {
  assert.equal(normalizeAmount(1_500_000n, 6), "1.5");
  assert.equal(normalizeAmount(1n, 6), "0.000001");
  assert.equal(normalizeAmount(100n, 0), "100");
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "1500000",
    decimals: 6,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "ata1", owner: "alice", rawAmount: "1500000", decimals: 6 }),
    ],
  });
  assert.equal(result.owners[0]?.ownerNormalizedAmount, "1.5");
});

test("8. topN with fewer than N owners is deterministic (observational ratios ok)", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "300",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "a", owner: "a", rawAmount: "100", decimals: 0 }),
      obs({ tokenAccount: "b", owner: "b", rawAmount: "200", decimals: 0 }),
    ],
  });
  const top100 = result.concentration.find((m) => m.name === "top100");
  const top2 = result.concentration.find((m) => m.name === "top10");
  assert.ok(top100);
  assert.equal(top100!.numerator, "300");
  assert.equal(top2!.numerator, "300");
  assert.equal(top100!.ratio, ratioFromRaw(300n, 300n));
  // Pool coverage incomplete → concentration not confirmed.
  assert.equal(result.concentrationEligible, false);
  assert.equal(top100!.completeness, "partial");
});

test("9. excluded + included + unresolved amounts conserve enumerated", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "1000",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "a", owner: "alice", rawAmount: "500", decimals: 0 }),
      obs({ tokenAccount: "b", owner: BURN, rawAmount: "300", decimals: 0 }),
      obs({ tokenAccount: "c", owner: "zero", rawAmount: "0", decimals: 0 }),
      obs({ tokenAccount: "d", owner: TOKEN_PROGRAM, rawAmount: "200", decimals: 0 }),
    ],
  });
  assertPartitionIdentity(result);
});

test("10. inconsistent ratio fails closed (assertRatioConsistent)", () => {
  assert.equal(assertRatioConsistent("1", "2", 0.5), true);
  assert.equal(assertRatioConsistent("1", "2", 0.9), false);
  assert.equal(assertRatioConsistent("1", "0", null), true);
});

test("11. unknown provider fields and credential fields cannot enter CaScanResponse", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "100",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [obs({ tokenAccount: "a", owner: "alice", rawAmount: "100", decimals: 0 })],
  });
  const mapped = mapHolderCleaningToCaScanResponseV1({
    cleaning: result,
    name: "Test",
    symbol: "TST",
    decimals: 0,
    generatedAt: OBSERVED,
    mintProvenance: {
      source: "helius-mint",
      sourceTier: "A",
      verificationStatus: "confirmed",
      observedAt: OBSERVED,
    },
  });
  const validation = validateCaScanResponseV1(mapped);
  assert.equal(validation.ok, true);

  const leaked = {
    ...mapped,
    apiKey: "secret",
    heliusApiKey: "x",
  };
  const bad = validateCaScanResponseV1(leaked);
  assert.equal(bad.ok, false);
  assert.ok(bad.issues.some((i) => i.code === "unexpected_field" || i.code === "forbidden_provider_leak"));
});

test("12. identical scrubbed input replays to the same hash twice", () => {
  const input = {
    ca: CA,
    selectionReason: "fixture",
    baseCommit: "777e0131ec663178c6c4cc5cc0c4584e60be2381",
    mintSupplyRaw: "1000",
    decimals: 0,
    name: "Replay",
    symbol: "RPL",
    accounts: [
      { tokenAccount: "ata1", owner: "alice", amountRaw: "600" },
      { tokenAccount: "ata2", owner: "alice", amountRaw: "100" },
      { tokenAccount: "ata3", owner: "bob", amountRaw: "300" },
    ],
    paginationComplete: true,
    observedAt: OBSERVED,
    sourceWatermark: "helius|42|complete|no_cursor",
    heliusRequestCount: 3,
  };
  const h1 = replayCleaningHash(input);
  const h2 = replayCleaningHash(input);
  assert.equal(h1, h2);
  const a = cleanEnumeratedCa(input);
  const b = cleanEnumeratedCa(input);
  assert.equal(hashStable(a.cleaning), hashStable(b.cleaning));
  assert.equal(stableSerialize(a.cleaning), stableSerialize(b.cleaning));
});

// ---------------------------------------------------------------------------
// Forced regression matrix (REPAIR-002)
// ---------------------------------------------------------------------------

test("R1. included positive + zero_balance → owner stays included", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "100",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "pos", owner: "alice", rawAmount: "100", decimals: 0 }),
      obs({ tokenAccount: "z", owner: "alice", rawAmount: "0", decimals: 0 }),
    ],
  });
  const alice = result.owners.find((o) => o.owner === "alice");
  assert.equal(alice?.cleaningClass, "included_holder");
  assert.equal(alice?.ownerRawAmount, "100");
  assert.ok(result.universes.cleanedHolderUniverse.owners.some((o) => o.owner === "alice"));
  assert.ok(!result.universes.excludedInfrastructureUniverse.owners.some((o) => o.owner === "alice"));
  assert.equal(result.rawTokenAccounts.find((a) => a.tokenAccount === "z")?.cleaningClass, "zero_balance");
  assertPartitionIdentity(result);
});

test("R2. included positive + closed zero → owner stays included", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "150",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "pos", owner: "alice", rawAmount: "150", decimals: 0 }),
      obs({ tokenAccount: "c", owner: "alice", rawAmount: "0", decimals: 0, accountState: "closed" }),
    ],
  });
  const alice = result.owners.find((o) => o.owner === "alice");
  assert.equal(alice?.cleaningClass, "included_holder");
  assert.equal(alice?.ownerRawAmount, "150");
  assert.ok(result.universes.cleanedHolderUniverse.owners.some((o) => o.owner === "alice"));
  assert.equal(result.rawTokenAccounts.find((a) => a.tokenAccount === "c")?.cleaningClass, "closed_or_inactive");
  assertPartitionIdentity(result);
});

test("R3. included positive + closed positive → unresolved + manual review", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "250",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "pos", owner: "alice", rawAmount: "100", decimals: 0 }),
      obs({ tokenAccount: "c", owner: "alice", rawAmount: "150", decimals: 0, accountState: "closed" }),
    ],
  });
  const alice = result.owners.find((o) => o.owner === "alice");
  assert.equal(alice?.cleaningClass, "unresolved_exclusion_candidate");
  assert.equal(alice?.ownerRawAmount, "250");
  assert.ok(result.universes.unresolvedUniverse.owners.some((o) => o.owner === "alice"));
  assert.ok(!result.universes.cleanedHolderUniverse.owners.some((o) => o.owner === "alice"));
  assert.ok(!result.universes.excludedInfrastructureUniverse.owners.some((o) => o.owner === "alice"));
  assert.ok(result.issues.some((i) => i.code === "mixed_owner_positive_closed_balance" && i.whetherManualReviewRequired));
  assert.equal(result.concentrationEligible, false);
  assertPartitionIdentity(result);
});

test("R4. included positive + invalid raw amount → unresolved + manual review", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "100",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "pos", owner: "alice", rawAmount: "100", decimals: 0 }),
      obs({ tokenAccount: "bad", owner: "alice", rawAmount: "not-a-number", decimals: 0 }),
    ],
  });
  const alice = result.owners.find((o) => o.owner === "alice");
  assert.equal(alice?.cleaningClass, "unresolved_exclusion_candidate");
  assert.ok(result.universes.unresolvedUniverse.owners.some((o) => o.owner === "alice"));
  assert.ok(!result.universes.excludedInfrastructureUniverse.owners.some((o) => o.owner === "alice"));
  assert.ok(result.issues.some((i) => i.code === "mixed_owner_unparseable_sibling" && i.whetherManualReviewRequired));
  assertPartitionIdentity(result);
});

test("R5. included positive + unresolved sibling path → unresolved + manual review", () => {
  // Force unresolved sibling by closed-positive mixed first... alternatively:
  // include + closed positive is the unresolved path; for explicit unresolved class at account
  // level, pilot has no account-level unresolved classifier. Use closed-positive as unresolved
  // producer, then verify include+unresolved upgrade is covered by R3.
  // Additional: owner with only unresolved is not applicable; test that unresolved owner
  // requires manual review (see R12). Here we use invalid as second path already covered.
  // Construct via closed positive which yields unresolved, ensure no silent exclude.
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "300",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "pos", owner: "mix", rawAmount: "200", decimals: 0 }),
      obs({ tokenAccount: "cpos", owner: "mix", rawAmount: "100", decimals: 0, accountState: "inactive" }),
    ],
  });
  const mix = result.owners.find((o) => o.owner === "mix");
  assert.equal(mix?.cleaningClass, "unresolved_exclusion_candidate");
  assert.equal(result.accounting.unresolvedBalanceRaw, "300");
  assert.ok(result.issues.some((i) => i.whetherManualReviewRequired));
  assertPartitionIdentity(result);
});

test("R6. included positive + hard-evidence infrastructure owner → whole-owner exclude", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "500",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "t1", owner: TOKEN_PROGRAM, rawAmount: "500", decimals: 0 }),
    ],
  });
  const owner = result.owners.find((o) => o.owner === TOKEN_PROGRAM);
  assert.equal(owner?.cleaningClass, "known_program_or_infrastructure");
  assert.ok(result.universes.excludedInfrastructureUniverse.owners.some((o) => o.owner === TOKEN_PROGRAM));
  assert.equal(result.universes.cleanedHolderUniverse.ownerCount, 0);
  assert.ok(owner?.evidence.some((e) => e.includes("spl_token_program") || e.includes("hard_evidence")));
  assertPartitionIdentity(result);
});

test("R7. pure zero owner → zero_balance", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "100",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "a", owner: "alice", rawAmount: "100", decimals: 0 }),
      obs({ tokenAccount: "z1", owner: "zero-only", rawAmount: "0", decimals: 0 }),
      obs({ tokenAccount: "z2", owner: "zero-only", rawAmount: "0", decimals: 0 }),
    ],
  });
  const z = result.owners.find((o) => o.owner === "zero-only");
  assert.equal(z?.cleaningClass, "zero_balance");
  assert.equal(z?.ownerRawAmount, "0");
  assertPartitionIdentity(result);
});

test("R8. pure closed-zero owner → closed_or_inactive", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "100",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "a", owner: "alice", rawAmount: "100", decimals: 0 }),
      obs({ tokenAccount: "c1", owner: "closed-only", rawAmount: "0", decimals: 0, accountState: "closed" }),
    ],
  });
  const c = result.owners.find((o) => o.owner === "closed-only");
  assert.equal(c?.cleaningClass, "closed_or_inactive");
  assertPartitionIdentity(result);
});

test("R9. multiple positive included token accounts merge", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "600",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "a1", owner: "alice", rawAmount: "100", decimals: 0 }),
      obs({ tokenAccount: "a2", owner: "alice", rawAmount: "200", decimals: 0 }),
      obs({ tokenAccount: "a3", owner: "alice", rawAmount: "300", decimals: 0 }),
    ],
  });
  const alice = result.owners.find((o) => o.owner === "alice");
  assert.equal(alice?.cleaningClass, "included_holder");
  assert.equal(alice?.ownerRawAmount, "600");
  assert.equal(alice?.tokenAccountCount, 3);
  assert.equal(result.universes.cleanedHolderUniverse.amountRaw, "600");
  assertPartitionIdentity(result);
});

test("R10. global included/excluded/unresolved conservation", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "1000",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "i1", owner: "alice", rawAmount: "400", decimals: 0 }),
      obs({ tokenAccount: "i0", owner: "alice", rawAmount: "0", decimals: 0 }),
      obs({ tokenAccount: "b1", owner: BURN, rawAmount: "200", decimals: 0 }),
      obs({ tokenAccount: "m1", owner: "mixed", rawAmount: "100", decimals: 0 }),
      obs({ tokenAccount: "m2", owner: "mixed", rawAmount: "not-num", decimals: 0 }),
      obs({ tokenAccount: "z", owner: "zero", rawAmount: "0", decimals: 0 }),
      // closed positive on mixed2 contributes to unresolved, remaining 300
      obs({ tokenAccount: "u1", owner: "u", rawAmount: "200", decimals: 0 }),
      obs({ tokenAccount: "u2", owner: "u", rawAmount: "100", decimals: 0, accountState: "closed" }),
    ],
  });
  // enumerated: 400+0+200+100+0+0+200+100 = 1000 (invalid contributes 0)
  assert.equal(result.accounting.enumeratedTokenAccountBalanceRaw, "1000");
  assertPartitionIdentity(result);
  assert.equal(
    result.owners.filter((o) => o.cleaningClass === "included_holder"
      || o.cleaningClass === "zero_balance"
      || o.cleaningClass === "closed_or_inactive"
      || o.cleaningClass === "burn_or_dead_address"
      || o.cleaningClass === "known_program_or_infrastructure"
      || o.cleaningClass === "invalid_or_unparseable"
      || o.cleaningClass === "liquidity_or_pool_account"
      || o.cleaningClass === "unresolved_exclusion_candidate").length,
    result.owners.length,
  );
});

test("R11. mixed owner positive balance is not lost", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "100",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "pos", owner: "alice", rawAmount: "100", decimals: 0 }),
      obs({ tokenAccount: "z", owner: "alice", rawAmount: "0", decimals: 0 }),
    ],
  });
  assert.equal(result.accounting.includedOwnerBalanceRaw, "100");
  assert.equal(result.accounting.excludedBalanceRaw, "0");
  assert.equal(result.accounting.unresolvedBalanceRaw, "0");
  assert.equal(result.owners.find((o) => o.owner === "alice")?.ownerRawAmount, "100");
});

test("R12. unresolved owner requires manual review", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "100",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "pos", owner: "alice", rawAmount: "100", decimals: 0 }),
      obs({ tokenAccount: "bad", owner: "alice", rawAmount: "???", decimals: 0 }),
    ],
  });
  assert.ok(result.owners.some((o) => o.cleaningClass === "unresolved_exclusion_candidate"));
  assert.ok(result.issues.some((i) => i.whetherManualReviewRequired === true));
  assert.ok(BigInt(result.accounting.unresolvedBalanceRaw) > 0n);
  assert.equal(result.concentrationEligible, false);
});

test("R13. accounting complete + pool coverage partial → accounting confirmed, Top10/Top20 unverified", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "1000",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "a", owner: "alice", rawAmount: "600", decimals: 0 }),
      obs({ tokenAccount: "b", owner: "bob", rawAmount: "400", decimals: 0 }),
    ],
  });
  assert.equal(result.accountingEligible, true);
  assert.equal(result.exclusionCoverage, "partial");
  assert.equal(result.concentrationEligible, false);
  assert.equal(result.judgmentEligible, true);

  const mapped = mapHolderCleaningToCaScanResponseV1({
    cleaning: result,
    name: "T",
    symbol: "T",
    decimals: 0,
    generatedAt: OBSERVED,
    mintProvenance: {
      source: "helius-mint",
      sourceTier: "A",
      verificationStatus: "confirmed",
      observedAt: OBSERVED,
    },
  });
  assert.equal(validateCaScanResponseV1(mapped).ok, true);

  const accountingJudgment = mapped.judgmentEvidence.find((j) => j.judgmentCode === "holder_supply_accounting_complete");
  assert.ok(accountingJudgment);
  assert.equal(accountingJudgment!.status, "confirmed");
  assert.match(accountingJudgment!.humanReadableSummary, /owner-aggregated|reconciled against mint supply/i);

  const concJudgment = mapped.judgmentEvidence.find((j) => j.judgmentCode === "holder_concentration_scope_unverified");
  assert.ok(concJudgment);
  assert.equal(concJudgment!.status, "unverified");

  assert.equal(mapped.cohortMetrics?.top10Concentration?.provenance.verificationStatus, "unverified");
  assert.equal(mapped.cohortMetrics?.top20Concentration?.provenance.verificationStatus, "unverified");
  assert.notEqual(mapped.cohortMetrics?.top10Concentration?.completeness, 1);
  assert.equal(mapped.cohortMetrics?.top10Concentration?.ratio, null);
  assert.ok(mapped.cohortMetrics?.warnings.includes("pool_exclusion_coverage_incomplete"));
  assert.ok(mapped.holderUniverses?.warnings.includes("pool_exclusion_coverage_incomplete"));
  assert.match(
    mapped.cohortMetrics?.top10Concentration?.universeDefinition ?? "",
    /pool_exclusion_incomplete|observational/,
  );
  assert.ok(!mapped.judgmentEvidence.some(
    (j) => j.humanReadableSummary.includes("Owner-aggregated holder universes reconciled against mint supply with complete pagination."),
  ));
});

test("R14. pagination partial → accounting unverified, concentration unverified", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "100",
    decimals: 0,
    paginationComplete: false,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [obs({ tokenAccount: "a", owner: "alice", rawAmount: "100", decimals: 0 })],
  });
  assert.equal(result.accountingEligible, false);
  assert.equal(result.concentrationEligible, false);
  const mapped = mapHolderCleaningToCaScanResponseV1({
    cleaning: result,
    name: null,
    symbol: null,
    decimals: 0,
    generatedAt: OBSERVED,
    mintProvenance: {
      source: "helius-mint",
      sourceTier: "A",
      verificationStatus: "unverified",
      observedAt: OBSERVED,
    },
  });
  assert.ok(mapped.judgmentEvidence.every((j) => j.status !== "confirmed"));
  assert.equal(mapped.cohortMetrics?.top10Concentration?.provenance.verificationStatus, "unverified");
});

test("R15. supply residual → accounting unverified, concentration unverified", () => {
  const result = cleanHolderUniverse({
    ca: CA,
    mintSupplyRaw: "1000",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [obs({ tokenAccount: "a", owner: "alice", rawAmount: "500", decimals: 0 })],
  });
  assert.equal(result.accountingEligible, false);
  assert.equal(result.concentrationEligible, false);
  assert.ok(result.issues.some((i) => i.code === "supply_mismatch"));
});

test("R16. identical input double-run hash consistency", () => {
  const input = {
    ca: CA,
    mintSupplyRaw: "350",
    decimals: 0,
    paginationComplete: true,
    observedAt: OBSERVED,
    source: "helius",
    accounts: [
      obs({ tokenAccount: "pos", owner: "alice", rawAmount: "100", decimals: 0 }),
      obs({ tokenAccount: "z", owner: "alice", rawAmount: "0", decimals: 0 }),
      obs({ tokenAccount: "c", owner: "alice", rawAmount: "0", decimals: 0, accountState: "closed" }),
      obs({ tokenAccount: "bad", owner: "bob", rawAmount: "50", decimals: 0 }),
      obs({ tokenAccount: "bad2", owner: "bob", rawAmount: "xx", decimals: 0 }),
      obs({ tokenAccount: "burn", owner: BURN, rawAmount: "200", decimals: 0 }),
    ],
  };
  const a = cleanHolderUniverse(input);
  const b = cleanHolderUniverse(input);
  assert.equal(stableSerialize(a), stableSerialize(b));
  assert.equal(hashStable(a), hashStable(b));
  assertPartitionIdentity(a);
});
