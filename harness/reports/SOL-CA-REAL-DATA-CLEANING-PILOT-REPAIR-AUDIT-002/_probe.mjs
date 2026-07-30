/**
 * Offline mixed-owner / trust-gate probe for REPAIR-AUDIT-002.
 * Zero network. Temporary auditor artifact; not a production script.
 */
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const {
  cleanHolderUniverse,
  stableSerialize,
} = await import(pathToFileURL(join(root, "dist/src/domain/rules/holder-data-cleaning.js")).href);
const { mapHolderCleaningToCaScanResponseV1 } = await import(
  pathToFileURL(join(root, "dist/src/domain/mapping/map-holder-cleaning-to-ca-scan.js")).href
);

const FIXED = "2026-07-30T15:00:00.000Z";

function obs(o) {
  return {
    source: "fixture",
    observedAt: FIXED,
    sourceWatermark: null,
    decimals: 0,
    accountState: "active",
    ...o,
  };
}

function probe(name, accounts, mint = "1000") {
  const r = cleanHolderUniverse({
    ca: "probe-ca",
    mintSupplyRaw: mint,
    decimals: 0,
    accounts: accounts.map(obs),
    paginationComplete: true,
    observedAt: FIXED,
    source: "fixture",
  });
  const owners = r.owners.map(
    (o) => `${o.owner}:${o.cleaningClass}:${o.ownerRawAmount}`,
  );
  const partitions = {
    included: r.universes.cleanedHolderUniverse.owners.map((o) => o.owner),
    excluded: r.universes.excludedInfrastructureUniverse.owners.map((o) => o.owner),
    unresolved: r.universes.unresolvedUniverse.owners.map((o) => o.owner),
  };
  const partitionSets = [partitions.included, partitions.excluded, partitions.unresolved];
  const allOwners = r.owners.map((o) => o.owner);
  const exclusive =
    allOwners.every(
      (o) =>
        partitionSets.filter((s) => s.includes(o)).length === 1,
    ) &&
    partitions.included.length + partitions.excluded.length + partitions.unresolved.length ===
      allOwners.length;
  return {
    name,
    identity: r.accounting.identity,
    enumerated: r.accounting.enumeratedTokenAccountBalanceRaw,
    included: r.accounting.includedOwnerBalanceRaw,
    excluded: r.accounting.excludedBalanceRaw,
    unresolved: r.accounting.unresolvedBalanceRaw,
    residual: r.accounting.accountingResidualRaw,
    owners,
    exclusive,
    accountingEligible: r.accountingEligible,
    exclusionCoverage: r.exclusionCoverage,
    concentrationEligible: r.concentrationEligible,
    judgmentEligible: r.judgmentEligible,
    jeEqAe: r.judgmentEligible === r.accountingEligible,
    manualReviewCodes: r.issues
      .filter((i) => i.whetherManualReviewRequired)
      .map((i) => i.code),
    cleanedAmt: r.universes.cleanedHolderUniverse.amountRaw,
  };
}

const cases = [
  probe("R1_pos_zero", [
    { tokenAccount: "a1", owner: "alice", rawAmount: "100" },
    { tokenAccount: "a2", owner: "alice", rawAmount: "0" },
  ], "100"),
  probe("R2_pos_closed0", [
    { tokenAccount: "a1", owner: "alice", rawAmount: "150" },
    { tokenAccount: "a2", owner: "alice", rawAmount: "0", accountState: "closed" },
  ], "150"),
  probe("R3_pos_closedPos", [
    { tokenAccount: "a1", owner: "alice", rawAmount: "100" },
    { tokenAccount: "a2", owner: "alice", rawAmount: "50", accountState: "closed" },
  ], "150"),
  probe("R4_pos_invalid", [
    { tokenAccount: "a1", owner: "alice", rawAmount: "100" },
    { tokenAccount: "a2", owner: "alice", rawAmount: "not-a-number" },
  ], "100"),
  probe("R5_pos_unresolved_via_closedPos", [
    { tokenAccount: "a1", owner: "alice", rawAmount: "200" },
    { tokenAccount: "a2", owner: "alice", rawAmount: "100", accountState: "closed" },
  ], "300"),
  probe("R6_hard_infra", [
    {
      tokenAccount: "a1",
      owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      rawAmount: "100",
    },
    {
      tokenAccount: "a2",
      owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      rawAmount: "0",
    },
  ], "100"),
  probe("R7_pure_zero", [
    { tokenAccount: "z1", owner: "zeroer", rawAmount: "0" },
  ], "0"),
  probe("R8_pure_closed0", [
    { tokenAccount: "z1", owner: "closer", rawAmount: "0", accountState: "closed" },
  ], "0"),
  probe("R9_multi_pos", [
    { tokenAccount: "m1", owner: "alice", rawAmount: "40" },
    { tokenAccount: "m2", owner: "alice", rawAmount: "60" },
  ], "100"),
  probe("R10_global_mix", [
    { tokenAccount: "i1", owner: "incl", rawAmount: "500" },
    { tokenAccount: "z1", owner: "zeroer", rawAmount: "0" },
    { tokenAccount: "x1", owner: "mixed", rawAmount: "100" },
    { tokenAccount: "x2", owner: "mixed", rawAmount: "not-num" },
    { tokenAccount: "c1", owner: "closedpos", rawAmount: "50", accountState: "closed" },
    { tokenAccount: "c2", owner: "closedpos", rawAmount: "250" },
  ], "900"),
];

const expected = {
  R1_pos_zero: { class: "included_holder", incl: "100", unresolved: "0" },
  R2_pos_closed0: { class: "included_holder", incl: "150", unresolved: "0" },
  R3_pos_closedPos: { class: "unresolved_exclusion_candidate", incl: "0", unresolved: "150" },
  R4_pos_invalid: { class: "unresolved_exclusion_candidate", incl: "0" },
  R5_pos_unresolved_via_closedPos: { class: "unresolved_exclusion_candidate", unresolved: "300" },
  R6_hard_infra: { class: "known_program_or_infrastructure", incl: "0", excl: "100" },
  R7_pure_zero: { class: "zero_balance" },
  R8_pure_closed0: { class: "closed_or_inactive" },
  R9_multi_pos: { class: "included_holder", incl: "100" },
};

const results = [];
for (const c of cases) {
  const exp = expected[c.name] ?? {};
  const primaryClass = c.owners[0]?.split(":")[1];
  const pass =
    c.identity === "enumerated = included + excluded + unresolved" &&
    c.exclusive &&
    c.jeEqAe &&
    c.exclusionCoverage === "partial" &&
    c.concentrationEligible === false &&
    (exp.class ? primaryClass === exp.class : true) &&
    (exp.incl !== undefined ? c.included === exp.incl : true) &&
    (exp.unresolved !== undefined ? c.unresolved === exp.unresolved : true) &&
    (exp.excl !== undefined ? c.excluded === exp.excl : true) &&
    (c.name.startsWith("R3") || c.name.startsWith("R4") || c.name.startsWith("R5")
      ? c.manualReviewCodes.length > 0
      : true);
  results.push({ ...c, primaryClass, pass });
}

// Deterministic replay
const input = {
  ca: "det",
  mintSupplyRaw: "100",
  decimals: 0,
  accounts: [obs({ tokenAccount: "t", owner: "o", rawAmount: "100" })],
  paginationComplete: true,
  observedAt: FIXED,
  source: "fixture",
};
const a = cleanHolderUniverse(input);
const b = cleanHolderUniverse(input);
const ha = createHash("sha256").update(stableSerialize(a)).digest("hex");
const hb = createHash("sha256").update(stableSerialize(b)).digest("hex");

// Accounting complete + concentration unverified mapping
const complete = cleanHolderUniverse({
  ca: "acct-ok",
  mintSupplyRaw: "100",
  decimals: 0,
  accounts: [obs({ tokenAccount: "t", owner: "holder1", rawAmount: "100" })],
  paginationComplete: true,
  observedAt: FIXED,
  source: "fixture",
});
const mapped = mapHolderCleaningToCaScanResponseV1({
  cleaning: complete,
  generatedAt: FIXED,
  name: "Probe",
  symbol: "PRB",
  decimals: 0,
  mintProvenance: {
    source: "normalized-holder-snapshot",
    sourceTier: "A",
    verificationStatus: "unverified",
    observedAt: FIXED,
    ruleVersion: "holder-cleaning-v1",
  },
});
const accountingJudgment = mapped.judgmentEvidence.find(
  (j) => j.judgmentCode === "holder_supply_accounting_complete",
);
const concJudgment = mapped.judgmentEvidence.find(
  (j) => j.judgmentCode === "holder_concentration_scope_unverified",
);
const top10 = mapped.cohortMetrics?.top10Concentration;

const out = {
  matrix: results.map((r) => ({
    id: r.name,
    pass: r.pass,
    primaryClass: r.primaryClass,
    identity: r.identity,
    exclusive: r.exclusive,
    included: r.included,
    excluded: r.excluded,
    unresolved: r.unresolved,
    accountingEligible: r.accountingEligible,
    concentrationEligible: r.concentrationEligible,
    exclusionCoverage: r.exclusionCoverage,
    jeEqAe: r.jeEqAe,
    manualReviewCodes: r.manualReviewCodes,
  })),
  summary: {
    total: results.length,
    pass: results.filter((r) => r.pass).length,
    fail: results.filter((r) => !r.pass).length,
  },
  deterministic: { hashEqual: ha === hb, ha, hb },
  trustSplit: {
    accountingEligible: complete.accountingEligible,
    exclusionCoverage: complete.exclusionCoverage,
    concentrationEligible: complete.concentrationEligible,
    judgmentEligibleAliasOfAccounting: complete.judgmentEligible === complete.accountingEligible,
    mappingAccountingConfirmed: accountingJudgment?.status === "confirmed",
    mappingConcentrationUnverified: concJudgment?.status === "unverified",
    top10Verification: top10?.provenance?.verificationStatus,
    top10RatioNull: top10?.ratio === null,
    top10CompletenessNotOne: top10?.completeness !== 1,
    universeDef: top10?.universeDefinition,
    warnings: mapped.cohortMetrics?.warnings ?? [],
  },
};
console.log(JSON.stringify(out, null, 2));
process.exit(out.summary.fail === 0 && out.deterministic.hashEqual && out.trustSplit.accountingEligible && !out.trustSplit.concentrationEligible && out.trustSplit.top10RatioNull ? 0 : 2);
