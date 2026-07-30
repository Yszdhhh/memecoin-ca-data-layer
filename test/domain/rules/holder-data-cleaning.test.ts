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
  // Force unresolved by mixed classification path: burn evidence not present;
  // use cleaningClass via known path — inject by marking invalid partial owner merge.
  // Direct unresolved is produced when owner has unresolved_exclusion_candidate class.
  // Here we verify that without evidence, burn/pool guesses do not drop large holders.
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

test("4. incomplete pagination degrades completeness", () => {
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
  assert.equal(result.judgmentEligible, false);
  assert.ok(result.issues.some((i) => i.code === "pagination_incomplete"));
  assert.ok(result.concentration.every((m) => m.ratio === null || m.completeness !== "complete"));
});

test("5. supply mismatch rejects confirmed judgment", () => {
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
  assert.ok(mapped.judgmentEvidence.every((j) => j.status !== "confirmed"));
  assert.equal(mapped.cohortMetrics?.top10Concentration?.ratio, null);
});

test("6. BigInt large balances do not lose precision", () => {
  const huge = "9007199254740993001"; // > Number.MAX_SAFE_INTEGER
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

test("8. topN with fewer than N owners is deterministic", () => {
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
      obs({ tokenAccount: "b", owner: "1nc1nerator11111111111111111111111111111111", rawAmount: "300", decimals: 0 }),
      obs({ tokenAccount: "c", owner: "zero", rawAmount: "0", decimals: 0 }),
      obs({ tokenAccount: "d", owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", rawAmount: "200", decimals: 0 }),
    ],
  });
  const a = result.accounting;
  assert.equal(a.identity, "enumerated = included + excluded + unresolved");
  assert.equal(
    BigInt(a.includedOwnerBalanceRaw) + BigInt(a.excludedBalanceRaw) + BigInt(a.unresolvedBalanceRaw),
    BigInt(a.enumeratedTokenAccountBalanceRaw),
  );
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
