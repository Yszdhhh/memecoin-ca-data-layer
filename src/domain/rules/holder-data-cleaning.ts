/**
 * Pure holder-universe cleaning for Solana CA pilot work.
 * BigInt amounts only; no provider I/O; no silent exclusions.
 */

export const HOLDER_CLEANING_RULE_VERSION = "holder-cleaning-v1" as const;
export const CONCENTRATION_CALCULATION_VERSION = "concentration-v1" as const;
export const UNIVERSE_DEFINITION_VERSION = "holder-universe-v1" as const;

export type CleaningClass =
  | "included_holder"
  | "zero_balance"
  | "invalid_or_unparseable"
  | "closed_or_inactive"
  | "burn_or_dead_address"
  | "liquidity_or_pool_account"
  | "known_program_or_infrastructure"
  | "unresolved_exclusion_candidate";

export type DataQualityIssueCode =
  | "pagination_incomplete"
  | "supply_mismatch"
  | "owner_missing"
  | "invalid_raw_amount"
  | "decimals_mismatch"
  | "duplicate_token_account"
  | "zero_balance_account"
  | "unresolved_infrastructure_account"
  | "exclusion_evidence_missing"
  | "inconsistent_ratio"
  | "provider_shape_drift"
  | "provider_timeout"
  | "provider_rate_limited"
  | "credential_unavailable"
  | "mixed_owner_classification_conflict"
  | "mixed_owner_positive_closed_balance"
  | "mixed_owner_unparseable_sibling"
  | "pool_exclusion_coverage_incomplete"
  | "owner_partition_identity_failed";

export type IssueSeverity = "info" | "warning" | "error" | "blocking";

export type CompletenessLabel = "complete" | "partial" | "unavailable";

export interface RawTokenAccountObservation {
  tokenAccount: string;
  owner: string;
  rawAmount: string;
  decimals: number;
  accountState?: string | null;
  source: string;
  observedAt: string;
  sourceWatermark?: string | null;
}

export interface ClassifiedTokenAccount {
  tokenAccount: string;
  owner: string;
  rawAmount: string;
  decimals: number;
  normalizedAmount: string;
  accountState: string;
  source: string;
  observedAt: string;
  sourceWatermark: string | null;
  cleaningClass: CleaningClass;
  evidence: string[];
}

export interface AggregatedOwner {
  owner: string;
  ownerRawAmount: string;
  ownerNormalizedAmount: string;
  tokenAccountCount: number;
  shareOfObservedSupply: number | null;
  cleaningClass: CleaningClass;
  evidence: string[];
  tokenAccounts: string[];
}

export interface SupplyAccounting {
  mintSupplyRaw: string;
  enumeratedTokenAccountBalanceRaw: string;
  includedOwnerBalanceRaw: string;
  excludedBalanceRaw: string;
  unresolvedBalanceRaw: string;
  accountingResidualRaw: string;
  accountingResidualRatio: number | null;
  completeness: CompletenessLabel;
  paginationComplete: boolean;
  residualReasons: string[];
  identity: "enumerated = included + excluded + unresolved" | "identity_failed";
}

export interface UniverseSummary {
  name: string;
  ownerCount: number;
  tokenAccountCount: number;
  amountRaw: string;
  amountNormalized: string;
  ratio: number | null;
  completeness: CompletenessLabel;
  universeDefinition: string;
  ruleVersion: string;
  evidenceRefs: string[];
  owners: AggregatedOwner[];
}

export interface ConcentrationMetric {
  name: string;
  numerator: string;
  denominator: string;
  ratio: number | null;
  universeDefinition: string;
  completeness: CompletenessLabel;
  calculationVersion: string;
}

export interface DataQualityIssue {
  code: DataQualityIssueCode;
  ca: string;
  severity: IssueSeverity;
  affectedRecordCount: number;
  affectedBalance: string;
  evidence: string[];
  whetherManualReviewRequired: boolean;
  suggestedFollowUp: string;
}

export interface HolderCleaningInput {
  ca: string;
  mintSupplyRaw: string;
  decimals: number;
  accounts: RawTokenAccountObservation[];
  paginationComplete: boolean;
  observedAt: string;
  source: string;
  sourceWatermark?: string | null;
}

/** Pool / liquidity first-hand exclusion coverage (independent of supply accounting). */
export type ExclusionCoverage = CompletenessLabel;

export interface HolderCleaningResult {
  ca: string;
  ruleVersion: typeof HOLDER_CLEANING_RULE_VERSION;
  observedAt: string;
  paginationComplete: boolean;
  rawTokenAccounts: ClassifiedTokenAccount[];
  owners: AggregatedOwner[];
  accounting: SupplyAccounting;
  universes: {
    rawHolderUniverse: UniverseSummary;
    cleanedHolderUniverse: UniverseSummary;
    excludedInfrastructureUniverse: UniverseSummary;
    unresolvedUniverse: UniverseSummary;
  };
  concentration: ConcentrationMetric[];
  issues: DataQualityIssue[];
  /**
   * Supply accounting eligibility only: pagination + mint parse + partition
   * identity + residual 0 + no accounting-blocking issues.
   * Does NOT imply cleaned investor concentration is trustworthy.
   */
  accountingEligible: boolean;
  /**
   * First-hand pool/liquidity exclusion coverage.
   * Pilot default is never `complete` (no full pool identification yet).
   */
  exclusionCoverage: ExclusionCoverage;
  /**
   * True only when accountingEligible, exclusionCoverage=complete,
   * no unresolved positive balance, and no concentration-blocking issues.
   */
  concentrationEligible: boolean;
  /**
   * Legacy alias of accountingEligible (batch OK/PARTIAL accounting gate).
   * Prefer accountingEligible / concentrationEligible for new consumers.
   */
  judgmentEligible: boolean;
}

/** Well-known Solana addresses with first-hand static evidence only. */
const BURN_OR_DEAD = new Map<string, string>([
  ["1nc1nerator11111111111111111111111111111111", "solana_incinerator_program_id"],
]);

const KNOWN_PROGRAM_OR_INFRA = new Map<string, string>([
  ["11111111111111111111111111111111", "system_program"],
  ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "spl_token_program"],
  ["TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", "spl_token_2022_program"],
  ["ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", "associated_token_program"],
  ["ComputeBudget111111111111111111111111111111", "compute_budget_program"],
  ["MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", "memo_program"],
  ["SysvarRent111111111111111111111111111111111", "sysvar_rent"],
  ["SysvarC1ock11111111111111111111111111111111", "sysvar_clock"],
]);

const RATIO_SCALE = 1_000_000n;

export function normalizeAmount(rawAmount: bigint, decimals: number): string {
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new Error("decimals must be a non-negative integer");
  }
  if (rawAmount < 0n) throw new Error("rawAmount must be non-negative");
  if (decimals === 0) return rawAmount.toString();
  const base = 10n ** BigInt(decimals);
  const whole = rawAmount / base;
  const frac = rawAmount % base;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr.length === 0 ? whole.toString() : `${whole.toString()}.${fracStr}`;
}

export function parseRawAmount(value: string): bigint | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function ratioFromRaw(numerator: bigint, denominator: bigint): number | null {
  if (denominator <= 0n) return null;
  if (numerator < 0n) return null;
  if (numerator > denominator) return null;
  return Number((numerator * RATIO_SCALE) / denominator) / Number(RATIO_SCALE);
}

export function assertRatioConsistent(
  numerator: string,
  denominator: string,
  ratio: number | null,
): boolean {
  const n = parseRawAmount(numerator);
  const d = parseRawAmount(denominator);
  if (n === null || d === null) return false;
  const expected = ratioFromRaw(n, d);
  if (ratio === null) return expected === null || d === 0n;
  if (expected === null) return false;
  return Math.abs(ratio - expected) <= 1e-6;
}

function classifyTokenAccount(
  account: RawTokenAccountObservation,
  ca: string,
  issues: DataQualityIssue[],
): ClassifiedTokenAccount {
  const evidence: string[] = [];
  const owner = typeof account.owner === "string" ? account.owner.trim() : "";
  const tokenAccount = typeof account.tokenAccount === "string" ? account.tokenAccount.trim() : "";
  const rawParsed = parseRawAmount(account.rawAmount);
  const decimalsOk = Number.isInteger(account.decimals) && account.decimals >= 0 && account.decimals <= 18;
  const state = (account.accountState ?? "unknown").toString();

  if (!tokenAccount) {
    issues.push(issue("invalid_raw_amount", ca, "error", 1, "0", ["missing_token_account"], true, "inspect_provider_row"));
    return classified(account, "0", "0", "invalid", "invalid_or_unparseable", ["missing_token_account"]);
  }
  if (!owner) {
    issues.push(issue("owner_missing", ca, "error", 1, account.rawAmount ?? "0", [`tokenAccount=${tokenAccount}`], true, "re-fetch_token_account"));
    return classified(account, account.rawAmount ?? "0", "0", state, "invalid_or_unparseable", ["owner_missing"]);
  }
  if (rawParsed === null) {
    issues.push(issue("invalid_raw_amount", ca, "error", 1, "0", [`tokenAccount=${tokenAccount}`], true, "inspect_provider_amount_field"));
    return classified(account, "0", "0", state, "invalid_or_unparseable", ["invalid_raw_amount"]);
  }
  if (!decimalsOk) {
    issues.push(issue("decimals_mismatch", ca, "error", 1, rawParsed.toString(), [`tokenAccount=${tokenAccount}`], true, "compare_mint_decimals"));
    return classified(account, rawParsed.toString(), "0", state, "invalid_or_unparseable", ["decimals_invalid"]);
  }

  const normalized = normalizeAmount(rawParsed, account.decimals);

  if (state === "closed" || state === "inactive") {
    evidence.push(`account_state=${state}`);
    return classified(account, rawParsed.toString(), normalized, state, "closed_or_inactive", evidence);
  }
  if (rawParsed === 0n) {
    evidence.push("raw_amount_is_zero");
    issues.push(issue("zero_balance_account", ca, "info", 1, "0", [`tokenAccount=${tokenAccount}`], false, "optional_show_zero_balance_toggle"));
    return classified(account, "0", normalized, state || "zero", "zero_balance", evidence);
  }

  const burnEvidence = BURN_OR_DEAD.get(owner);
  if (burnEvidence) {
    evidence.push(burnEvidence);
    return classified(account, rawParsed.toString(), normalized, state, "burn_or_dead_address", evidence);
  }
  const infraEvidence = KNOWN_PROGRAM_OR_INFRA.get(owner);
  if (infraEvidence) {
    evidence.push(infraEvidence);
    return classified(account, rawParsed.toString(), normalized, state, "known_program_or_infrastructure", evidence);
  }

  // No first-hand pool evidence in this pilot → never silent-exclude by appearance.
  evidence.push("default_include_no_infra_evidence");
  return classified(account, rawParsed.toString(), normalized, state || "active", "included_holder", evidence);
}

function classified(
  account: RawTokenAccountObservation,
  rawAmount: string,
  normalizedAmount: string,
  accountState: string,
  cleaningClass: CleaningClass,
  evidence: string[],
): ClassifiedTokenAccount {
  return {
    tokenAccount: account.tokenAccount ?? "",
    owner: account.owner ?? "",
    rawAmount,
    decimals: account.decimals,
    normalizedAmount,
    accountState,
    source: account.source,
    observedAt: account.observedAt,
    sourceWatermark: account.sourceWatermark ?? null,
    cleaningClass,
    evidence,
  };
}

function issue(
  code: DataQualityIssueCode,
  ca: string,
  severity: IssueSeverity,
  affectedRecordCount: number,
  affectedBalance: string,
  evidence: string[],
  whetherManualReviewRequired: boolean,
  suggestedFollowUp: string,
): DataQualityIssue {
  return {
    code,
    ca,
    severity,
    affectedRecordCount,
    affectedBalance,
    evidence,
    whetherManualReviewRequired,
    suggestedFollowUp,
  };
}

function isExcludedClass(c: CleaningClass): boolean {
  return (
    c === "zero_balance"
    || c === "invalid_or_unparseable"
    || c === "closed_or_inactive"
    || c === "burn_or_dead_address"
    || c === "liquidity_or_pool_account"
    || c === "known_program_or_infrastructure"
  );
}

function isUnresolvedClass(c: CleaningClass): boolean {
  return c === "unresolved_exclusion_candidate";
}

function isIncludedClass(c: CleaningClass): boolean {
  return c === "included_holder";
}

function isHardEvidenceExclusionClass(c: CleaningClass): boolean {
  return (
    c === "burn_or_dead_address"
    || c === "known_program_or_infrastructure"
    || c === "liquidity_or_pool_account"
  );
}

/**
 * Pilot pool/liquidity exclusion coverage. Never claims `complete` until
 * first-hand pool enumeration lands in a later task.
 */
function resolvePilotExclusionCoverage(tokenAccountCount: number): ExclusionCoverage {
  if (tokenAccountCount === 0) return "unavailable";
  return "partial";
}

function isExclusionCoverageComplete(coverage: ExclusionCoverage): boolean {
  return coverage === "complete";
}

interface OwnerResolution {
  cleaningClass: CleaningClass;
  evidence: string[];
  issueHints: Array<{
    code: DataQualityIssueCode;
    severity: IssueSeverity;
    affectedBalance: string;
    evidence: string[];
    whetherManualReviewRequired: boolean;
    suggestedFollowUp: string;
  }>;
}

/**
 * Explicit mixed-owner resolution. Never "pick one strictest class and dump
 * the whole owner balance into that class" for zero/closed/invalid siblings.
 */
function resolveOwnerCleaningClass(
  owner: string,
  list: ClassifiedTokenAccount[],
  sum: bigint,
): OwnerResolution {
  const classes = list.map((r) => r.cleaningClass);
  const evidence = new Set<string>();
  for (const row of list) {
    for (const e of row.evidence) evidence.add(e);
  }

  const hasInclude = classes.some(isIncludedClass);
  const hasZero = classes.includes("zero_balance");
  const hasClosed = classes.includes("closed_or_inactive");
  const hasInvalid = classes.includes("invalid_or_unparseable");
  const hasUnresolved = classes.some(isUnresolvedClass);
  const hasHard = classes.some(isHardEvidenceExclusionClass);

  const positiveIncluded = list.filter(
    (r) => isIncludedClass(r.cleaningClass) && (parseRawAmount(r.rawAmount) ?? 0n) > 0n,
  );
  const hasPositiveIncluded = positiveIncluded.length > 0;
  const positiveIncludedSum = positiveIncluded.reduce(
    (s, r) => s + (parseRawAmount(r.rawAmount) ?? 0n),
    0n,
  );

  const closedPositive = list.filter((r) => {
    if (r.cleaningClass !== "closed_or_inactive") return false;
    return (parseRawAmount(r.rawAmount) ?? 0n) > 0n;
  });

  // 5. Hard-evidence whole-owner exclusion (owner-level first-hand static evidence only).
  // Must not be triggered by zero/closed/invalid siblings alone.
  if (hasHard && !hasPositiveIncluded) {
    const hardClass = classes.find(isHardEvidenceExclusionClass)!;
    evidence.add(`owner_hard_evidence=${hardClass}`);
    return { cleaningClass: hardClass, evidence: [...evidence], issueHints: [] };
  }
  if (hasHard && hasPositiveIncluded) {
    // Owner address itself carries hard evidence on every ATA classification path.
    const hardClass = classes.find(isHardEvidenceExclusionClass)!;
    evidence.add(`owner_hard_evidence=${hardClass}`);
    evidence.add("whole_owner_hard_evidence_exclusion");
    return { cleaningClass: hardClass, evidence: [...evidence], issueHints: [] };
  }

  // 6. Pure zero or pure closed-zero: no positive included, all parseable sum is 0.
  if (!hasPositiveIncluded && sum === 0n && classes.every((c) => c === "zero_balance" || c === "closed_or_inactive")) {
    const pure = classes.includes("closed_or_inactive") ? "closed_or_inactive" as const : "zero_balance" as const;
    evidence.add(`pure_owner_class=${pure}`);
    return { cleaningClass: pure, evidence: [...evidence], issueHints: [] };
  }

  // Positive included present — apply explicit mixed-owner rules.
  if (hasPositiveIncluded) {
    // 3. included + invalid_or_unparseable → unresolved (invalid amount cannot prove zero).
    if (hasInvalid) {
      evidence.add("mixed_owner=included+invalid_or_unparseable");
      evidence.add(`positive_included_raw=${positiveIncludedSum.toString()}`);
      return {
        cleaningClass: "unresolved_exclusion_candidate",
        evidence: [...evidence],
        issueHints: [{
          code: "mixed_owner_unparseable_sibling",
          severity: "error",
          affectedBalance: sum.toString(),
          evidence: [`owner=${owner}`, "included+invalid_or_unparseable", ...[...evidence].slice(0, 8)],
          whetherManualReviewRequired: true,
          suggestedFollowUp: "reparse_invalid_sibling_or_manual_review",
        }],
      };
    }

    // 4. included + unresolved → unresolved, full balance, manual review.
    if (hasUnresolved) {
      evidence.add("mixed_owner=included+unresolved");
      return {
        cleaningClass: "unresolved_exclusion_candidate",
        evidence: [...evidence],
        issueHints: [{
          code: "mixed_owner_classification_conflict",
          severity: "warning",
          affectedBalance: sum.toString(),
          evidence: [`owner=${owner}`, "included+unresolved"],
          whetherManualReviewRequired: true,
          suggestedFollowUp: "resolve_unresolved_sibling_with_first_hand_evidence",
        }],
      };
    }

    // 2. included + closed_or_inactive
    if (hasClosed) {
      if (closedPositive.length > 0) {
        const closedPosSum = closedPositive.reduce(
          (s, r) => s + (parseRawAmount(r.rawAmount) ?? 0n),
          0n,
        );
        evidence.add("mixed_owner=included+closed_positive");
        evidence.add(`closed_positive_raw=${closedPosSum.toString()}`);
        return {
          cleaningClass: "unresolved_exclusion_candidate",
          evidence: [...evidence],
          issueHints: [{
            code: "mixed_owner_positive_closed_balance",
            severity: "error",
            affectedBalance: sum.toString(),
            evidence: [`owner=${owner}`, `closed_positive_raw=${closedPosSum.toString()}`],
            whetherManualReviewRequired: true,
            suggestedFollowUp: "inspect_closed_account_with_positive_raw_amount",
          }],
        };
      }
      // closed siblings all raw=0 → keep included; zeros stay account-level only.
      evidence.add("mixed_owner=included+closed_zero");
      evidence.add("owner_kept_included_closed_siblings_zero");
      return { cleaningClass: "included_holder", evidence: [...evidence], issueHints: [] };
    }

    // 1. included + zero_balance → keep included; zeros do not exclude positives.
    if (hasZero) {
      evidence.add("mixed_owner=included+zero_balance");
      evidence.add("owner_kept_included_zero_siblings");
      return { cleaningClass: "included_holder", evidence: [...evidence], issueHints: [] };
    }

    // Pure included (possibly multiple positive ATAs).
    if (classes.every(isIncludedClass)) {
      evidence.add("owner_all_included");
      return { cleaningClass: "included_holder", evidence: [...evidence], issueHints: [] };
    }

    // Any other mixed conflict with positive include: fail closed to unresolved.
    evidence.add("mixed_owner=included+other_conflict");
    return {
      cleaningClass: "unresolved_exclusion_candidate",
      evidence: [...evidence],
      issueHints: [{
        code: "mixed_owner_classification_conflict",
        severity: "warning",
        affectedBalance: sum.toString(),
        evidence: [`owner=${owner}`, `classes=${[...new Set(classes)].sort().join(",")}`],
        whetherManualReviewRequired: true,
        suggestedFollowUp: "manual_review_mixed_owner_accounts",
      }],
    };
  }

  // No positive included: pure exclusion classes by most specific account class.
  if (hasUnresolved) {
    return { cleaningClass: "unresolved_exclusion_candidate", evidence: [...evidence], issueHints: [] };
  }
  if (hasInvalid) {
    return { cleaningClass: "invalid_or_unparseable", evidence: [...evidence], issueHints: [] };
  }
  if (hasClosed) {
    return { cleaningClass: "closed_or_inactive", evidence: [...evidence], issueHints: [] };
  }
  if (hasZero) {
    return { cleaningClass: "zero_balance", evidence: [...evidence], issueHints: [] };
  }
  return { cleaningClass: "included_holder", evidence: [...evidence], issueHints: [] };
}

function aggregateOwners(
  accounts: ClassifiedTokenAccount[],
  observedSupply: bigint,
  ca: string,
  issues: DataQualityIssue[],
): AggregatedOwner[] {
  const byOwner = new Map<string, ClassifiedTokenAccount[]>();
  for (const account of accounts) {
    const key = account.owner || `missing-owner:${account.tokenAccount}`;
    const list = byOwner.get(key) ?? [];
    list.push(account);
    byOwner.set(key, list);
  }

  const owners: AggregatedOwner[] = [];
  for (const [owner, list] of byOwner) {
    let sum = 0n;
    const tokenAccounts: string[] = [];
    let decimals = list[0]?.decimals ?? 0;
    for (const row of list) {
      const amount = parseRawAmount(row.rawAmount) ?? 0n;
      sum += amount;
      tokenAccounts.push(row.tokenAccount);
      decimals = row.decimals;
    }
    const resolved = resolveOwnerCleaningClass(owner, list, sum);
    for (const hint of resolved.issueHints) {
      issues.push(issue(
        hint.code,
        ca,
        hint.severity,
        1,
        hint.affectedBalance,
        hint.evidence,
        hint.whetherManualReviewRequired,
        hint.suggestedFollowUp,
      ));
    }
    owners.push({
      owner,
      ownerRawAmount: sum.toString(),
      ownerNormalizedAmount: normalizeAmount(sum, decimals),
      tokenAccountCount: list.length,
      shareOfObservedSupply: ratioFromRaw(sum, observedSupply),
      cleaningClass: resolved.cleaningClass,
      evidence: resolved.evidence,
      tokenAccounts,
    });
  }

  return owners.sort((a, b) => {
    const ba = BigInt(a.ownerRawAmount);
    const bb = BigInt(b.ownerRawAmount);
    if (ba === bb) return a.owner.localeCompare(b.owner);
    return ba > bb ? -1 : 1;
  });
}

function sumOwnerAmount(owners: AggregatedOwner[], predicate: (o: AggregatedOwner) => boolean): bigint {
  let sum = 0n;
  for (const o of owners) {
    if (predicate(o)) sum += BigInt(o.ownerRawAmount);
  }
  return sum;
}

function sumAccountAmount(accounts: ClassifiedTokenAccount[]): bigint {
  let sum = 0n;
  for (const a of accounts) {
    const n = parseRawAmount(a.rawAmount);
    if (n !== null) sum += n;
  }
  return sum;
}

function buildUniverse(
  name: string,
  owners: AggregatedOwner[],
  accounts: ClassifiedTokenAccount[],
  denominator: bigint,
  completeness: CompletenessLabel,
  evidenceRefs: string[],
): UniverseSummary {
  const amountRaw = sumOwnerAmount(owners, () => true);
  const decimals = accounts[0]?.decimals ?? 0;
  return {
    name,
    ownerCount: owners.length,
    tokenAccountCount: accounts.length,
    amountRaw: amountRaw.toString(),
    amountNormalized: normalizeAmount(amountRaw, decimals),
    ratio: ratioFromRaw(amountRaw, denominator),
    completeness,
    universeDefinition: `${UNIVERSE_DEFINITION_VERSION}:${name}`,
    ruleVersion: HOLDER_CLEANING_RULE_VERSION,
    evidenceRefs,
    owners,
  };
}

function topNMetric(
  name: string,
  cleaned: AggregatedOwner[],
  denominator: bigint,
  n: number,
  completeness: CompletenessLabel,
  universeDefinition: string,
): ConcentrationMetric {
  const eligible = cleaned.filter((o) => isIncludedClass(o.cleaningClass) && BigInt(o.ownerRawAmount) > 0n);
  const slice = eligible.slice(0, n);
  const numerator = slice.reduce((s, o) => s + BigInt(o.ownerRawAmount), 0n);
  const complete = completeness === "complete" && denominator > 0n;
  return {
    name,
    numerator: numerator.toString(),
    denominator: denominator.toString(),
    ratio: complete ? ratioFromRaw(numerator, denominator) : null,
    universeDefinition,
    completeness: complete ? "complete" : completeness === "unavailable" ? "unavailable" : "partial",
    calculationVersion: CONCENTRATION_CALCULATION_VERSION,
  };
}

/**
 * Deterministic holder cleaning. Same scrubbed input always yields the same result.
 */
export function cleanHolderUniverse(input: HolderCleaningInput): HolderCleaningResult {
  const issues: DataQualityIssue[] = [];
  const ca = input.ca;
  const mintSupply = parseRawAmount(input.mintSupplyRaw);
  if (mintSupply === null) {
    issues.push(issue("invalid_raw_amount", ca, "blocking", 0, "0", ["mint_supply_unparseable"], true, "re-fetch_mint"));
  }

  // Duplicate token-account detection
  const seen = new Set<string>();
  const uniqueAccounts: RawTokenAccountObservation[] = [];
  for (const account of input.accounts) {
    const key = account.tokenAccount;
    if (seen.has(key)) {
      issues.push(issue("duplicate_token_account", ca, "error", 1, account.rawAmount, [key], true, "dedupe_provider_pages"));
      continue;
    }
    seen.add(key);
    uniqueAccounts.push(account);
    if (account.decimals !== input.decimals) {
      issues.push(issue(
        "decimals_mismatch",
        ca,
        "warning",
        1,
        account.rawAmount,
        [`tokenAccount=${account.tokenAccount}`, `accountDecimals=${account.decimals}`, `mintDecimals=${input.decimals}`],
        true,
        "prefer_mint_decimals",
      ));
    }
  }

  // Force mint decimals on classification for normalization consistency.
  const normalizedInput = uniqueAccounts.map((a) => ({ ...a, decimals: input.decimals }));
  const rawTokenAccounts = normalizedInput.map((a) => classifyTokenAccount(a, ca, issues));
  const enumerated = sumAccountAmount(rawTokenAccounts);
  const owners = aggregateOwners(
    rawTokenAccounts,
    enumerated > 0n ? enumerated : mintSupply ?? 0n,
    ca,
    issues,
  );

  // Unresolved owners always require manual review; never silent whole-owner exclude.
  for (const owner of owners) {
    if (owner.cleaningClass === "unresolved_exclusion_candidate") {
      const alreadyMixed = issues.some(
        (i) =>
          (i.code === "mixed_owner_classification_conflict"
            || i.code === "mixed_owner_positive_closed_balance"
            || i.code === "mixed_owner_unparseable_sibling")
          && i.evidence.some((e) => e === `owner=${owner.owner}` || e.startsWith("owner=")),
      );
      if (!alreadyMixed) {
        issues.push(issue(
          "unresolved_infrastructure_account",
          ca,
          "warning",
          1,
          owner.ownerRawAmount,
          [`owner=${owner.owner}`, ...owner.evidence],
          true,
          "add_first_hand_pool_or_program_evidence",
        ));
      }
      if (owner.evidence.length === 0) {
        issues.push(issue(
          "exclusion_evidence_missing",
          ca,
          "error",
          1,
          owner.ownerRawAmount,
          [`owner=${owner.owner}`],
          true,
          "attach_evidence_or_keep_included",
        ));
      }
      if (BigInt(owner.ownerRawAmount) > 0n && !issues.some(
        (i) => i.whetherManualReviewRequired && i.evidence.some((e) => e.includes(owner.owner)),
      )) {
        issues.push(issue(
          "unresolved_infrastructure_account",
          ca,
          "warning",
          1,
          owner.ownerRawAmount,
          [`owner=${owner.owner}`, "unresolved_positive_balance"],
          true,
          "manual_review_unresolved_positive_balance",
        ));
      }
    }
  }

  const includedOwners = owners.filter((o) => isIncludedClass(o.cleaningClass));
  const excludedOwners = owners.filter((o) => isExcludedClass(o.cleaningClass));
  const unresolvedOwners = owners.filter((o) => isUnresolvedClass(o.cleaningClass));

  // Partition conservation: every owner lands in exactly one of the three sets.
  const partitionedOwnerCount = includedOwners.length + excludedOwners.length + unresolvedOwners.length;
  if (partitionedOwnerCount !== owners.length) {
    issues.push(issue(
      "owner_partition_identity_failed",
      ca,
      "blocking",
      owners.length - partitionedOwnerCount,
      "0",
      ["owner_not_in_exactly_one_partition"],
      true,
      "fail_closed_reclassify_owners",
    ));
  }

  const includedRaw = sumOwnerAmount(includedOwners, () => true);
  const excludedRaw = sumOwnerAmount(excludedOwners, () => true);
  const unresolvedRaw = sumOwnerAmount(unresolvedOwners, () => true);
  const partsSum = includedRaw + excludedRaw + unresolvedRaw;
  const identityOk = partsSum === enumerated;

  const residualReasons: string[] = [];
  if (!identityOk) {
    residualReasons.push("owner_partition_sum_ne_enumerated");
    issues.push(issue(
      "owner_partition_identity_failed",
      ca,
      "blocking",
      1,
      (partsSum > enumerated ? partsSum - enumerated : enumerated - partsSum).toString(),
      [
        `enumerated=${enumerated.toString()}`,
        `included=${includedRaw.toString()}`,
        `excluded=${excludedRaw.toString()}`,
        `unresolved=${unresolvedRaw.toString()}`,
      ],
      true,
      "fail_closed_partition_recompute",
    ));
  }
  if (!input.paginationComplete) {
    residualReasons.push("pagination_incomplete");
    issues.push(issue(
      "pagination_incomplete",
      ca,
      "warning",
      rawTokenAccounts.length,
      enumerated.toString(),
      ["paginationComplete=false"],
      true,
      "increase_page_budget_or_accept_partial",
    ));
  }

  const mint = mintSupply ?? 0n;
  const residual = mint - enumerated;
  const residualAbs = residual < 0n ? -residual : residual;
  if (mintSupply !== null && residual !== 0n) {
    residualReasons.push(residual > 0n ? "mint_gt_enumerated" : "enumerated_gt_mint");
    issues.push(issue(
      "supply_mismatch",
      ca,
      input.paginationComplete ? "error" : "warning",
      1,
      residualAbs.toString(),
      [
        `mintSupplyRaw=${mint.toString()}`,
        `enumerated=${enumerated.toString()}`,
        `paginationComplete=${input.paginationComplete}`,
      ],
      true,
      "investigate_unindexed_accounts_or_burns",
    ));
  }

  const accountingComplete: CompletenessLabel = !input.paginationComplete || mintSupply === null || !identityOk
    ? "partial"
    : residual === 0n
      ? "complete"
      : "partial";

  // Pilot has no complete first-hand pool/liquidity exclusion capability.
  // Typed as ExclusionCoverage so future first-hand pool evidence can return "complete".
  const exclusionCoverage: ExclusionCoverage = resolvePilotExclusionCoverage(rawTokenAccounts.length);
  if (exclusionCoverage === "partial" || exclusionCoverage === "unavailable") {
    issues.push(issue(
      "pool_exclusion_coverage_incomplete",
      ca,
      "warning",
      0,
      "0",
      [`exclusionCoverage=${exclusionCoverage}`, "no_first_hand_pool_liquidity_enumeration"],
      false,
      "add_first_hand_pool_liquidity_exclusion_before_concentration_confirm",
    ));
  }

  const accountingBlocking = issues.some(
    (i) =>
      i.severity === "blocking"
      && (i.code === "owner_partition_identity_failed"
        || i.code === "inconsistent_ratio"
        || i.code === "invalid_raw_amount" && i.evidence.includes("mint_supply_unparseable")),
  );
  const accountingEligible =
    input.paginationComplete
    && mintSupply !== null
    && identityOk
    && residual === 0n
    && accountingComplete === "complete"
    && !accountingBlocking;

  const unresolvedPositive = unresolvedRaw > 0n;
  const concentrationBlocking = issues.some(
    (i) => i.severity === "blocking" || i.code === "inconsistent_ratio",
  );
  const poolCoverageComplete = isExclusionCoverageComplete(exclusionCoverage);
  const concentrationEligible =
    accountingEligible
    && poolCoverageComplete
    && !unresolvedPositive
    && !concentrationBlocking;

  // Observational concentration numerators always available; completeness stays
  // partial until concentrationEligible. Ratios may be present as observations.
  const denomForConcentration = mint;
  const concCompleteness: CompletenessLabel = concentrationEligible ? "complete" : "partial";
  const universeDef = concentrationEligible
    ? `${UNIVERSE_DEFINITION_VERSION}:cleaned_investor_owners_vs_mint_supply`
    : `${UNIVERSE_DEFINITION_VERSION}:owner_aggregated_observational_vs_mint_supply_pool_exclusion_incomplete`;

  const concentration: ConcentrationMetric[] = [
    topNMetric("top1", includedOwners, denomForConcentration, 1, concCompleteness, universeDef),
    topNMetric("top5", includedOwners, denomForConcentration, 5, concCompleteness, universeDef),
    topNMetric("top10", includedOwners, denomForConcentration, 10, concCompleteness, universeDef),
    topNMetric("top20", includedOwners, denomForConcentration, 20, concCompleteness, universeDef),
    topNMetric("top50", includedOwners, denomForConcentration, 50, concCompleteness, universeDef),
    topNMetric("top100", includedOwners, denomForConcentration, 100, concCompleteness, universeDef),
    {
      name: "largestOwnerShare",
      numerator: (includedOwners[0] ? includedOwners[0].ownerRawAmount : "0"),
      denominator: denomForConcentration.toString(),
      ratio: denomForConcentration > 0n && includedOwners[0]
        ? ratioFromRaw(BigInt(includedOwners[0].ownerRawAmount), denomForConcentration)
        : null,
      universeDefinition: universeDef,
      completeness: concCompleteness,
      calculationVersion: CONCENTRATION_CALCULATION_VERSION,
    },
    {
      name: "unresolvedShare",
      numerator: unresolvedRaw.toString(),
      denominator: denomForConcentration.toString(),
      ratio: denomForConcentration > 0n ? ratioFromRaw(unresolvedRaw, denomForConcentration) : null,
      universeDefinition: universeDef,
      completeness: concCompleteness,
      calculationVersion: CONCENTRATION_CALCULATION_VERSION,
    },
    {
      name: "excludedShare",
      numerator: excludedRaw.toString(),
      denominator: denomForConcentration.toString(),
      ratio: denomForConcentration > 0n ? ratioFromRaw(excludedRaw, denomForConcentration) : null,
      universeDefinition: universeDef,
      completeness: concCompleteness,
      calculationVersion: CONCENTRATION_CALCULATION_VERSION,
    },
  ];

  // topNMetric nulls ratio when completeness !== complete; re-attach observational
  // ratios when denom > 0 so numerators remain interpretable without claiming complete.
  for (const metric of concentration) {
    if (metric.ratio === null && denomForConcentration > 0n && metric.completeness !== "complete") {
      const n = parseRawAmount(metric.numerator);
      if (n !== null) metric.ratio = ratioFromRaw(n, denomForConcentration);
    }
    if (metric.ratio !== null && !assertRatioConsistent(metric.numerator, metric.denominator, metric.ratio)) {
      issues.push(issue(
        "inconsistent_ratio",
        ca,
        "blocking",
        1,
        metric.numerator,
        [`metric=${metric.name}`],
        true,
        "fail_closed_recompute",
      ));
      metric.ratio = null;
    }
  }

  // Legacy alias: accounting eligibility only (not concentration confirmation).
  const judgmentEligible = accountingEligible;

  const denomForUniverse = enumerated > 0n ? enumerated : mint;
  const universeCompleteness: CompletenessLabel = input.paginationComplete ? accountingComplete : "partial";
  // Cleaned investor universe is partial until pool exclusion coverage is complete.
  const cleanedUniverseCompleteness: CompletenessLabel = concentrationEligible ? "complete" : "partial";

  const includedAccounts = rawTokenAccounts.filter((a) => {
    const owner = owners.find((o) => o.tokenAccounts.includes(a.tokenAccount));
    return owner ? isIncludedClass(owner.cleaningClass) : isIncludedClass(a.cleaningClass);
  });
  const excludedAccounts = rawTokenAccounts.filter((a) => {
    const owner = owners.find((o) => o.tokenAccounts.includes(a.tokenAccount));
    return owner ? isExcludedClass(owner.cleaningClass) : isExcludedClass(a.cleaningClass);
  });
  const unresolvedAccounts = rawTokenAccounts.filter((a) => {
    const owner = owners.find((o) => o.tokenAccounts.includes(a.tokenAccount));
    return owner ? isUnresolvedClass(owner.cleaningClass) : isUnresolvedClass(a.cleaningClass);
  });

  return {
    ca,
    ruleVersion: HOLDER_CLEANING_RULE_VERSION,
    observedAt: input.observedAt,
    paginationComplete: input.paginationComplete,
    rawTokenAccounts,
    owners,
    accounting: {
      mintSupplyRaw: mintSupply !== null ? mintSupply.toString() : "0",
      enumeratedTokenAccountBalanceRaw: enumerated.toString(),
      includedOwnerBalanceRaw: includedRaw.toString(),
      excludedBalanceRaw: excludedRaw.toString(),
      unresolvedBalanceRaw: unresolvedRaw.toString(),
      accountingResidualRaw: residualAbs.toString(),
      accountingResidualRatio: mintSupply !== null && mintSupply > 0n ? ratioFromRaw(residualAbs, mintSupply) : null,
      completeness: accountingComplete,
      paginationComplete: input.paginationComplete,
      residualReasons,
      identity: identityOk ? "enumerated = included + excluded + unresolved" : "identity_failed",
    },
    universes: {
      rawHolderUniverse: buildUniverse(
        "rawHolderUniverse",
        owners,
        rawTokenAccounts,
        denomForUniverse,
        universeCompleteness,
        ["raw_token_accounts", "owner_aggregated"],
      ),
      cleanedHolderUniverse: buildUniverse(
        "cleanedHolderUniverse",
        includedOwners,
        includedAccounts,
        denomForUniverse,
        cleanedUniverseCompleteness,
        concentrationEligible
          ? ["included_holder_only", "pool_exclusion_complete"]
          : ["included_holder_only", "pool_exclusion_incomplete_not_cleaned_investor_universe"],
      ),
      excludedInfrastructureUniverse: buildUniverse(
        "excludedInfrastructureUniverse",
        excludedOwners,
        excludedAccounts,
        denomForUniverse,
        universeCompleteness,
        ["zero_balance", "burn", "known_program", "closed", "invalid", "liquidity"],
      ),
      unresolvedUniverse: buildUniverse(
        "unresolvedUniverse",
        unresolvedOwners,
        unresolvedAccounts,
        denomForUniverse,
        universeCompleteness,
        ["unresolved_exclusion_candidate"],
      ),
    },
    concentration,
    issues,
    accountingEligible,
    exclusionCoverage,
    concentrationEligible,
    judgmentEligible,
  };
}

/** Stable JSON serialization for deterministic replay hashing. */
export function stableSerialize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeys(obj[key]);
    }
    return out;
  }
  return value;
}
