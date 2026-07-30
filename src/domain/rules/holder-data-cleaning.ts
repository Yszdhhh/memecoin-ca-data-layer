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
  | "credential_unavailable";

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

function ownerClassFromAccounts(classes: CleaningClass[]): CleaningClass {
  // Prefer most restrictive exclusion when any account is excluded.
  const priority: CleaningClass[] = [
    "invalid_or_unparseable",
    "burn_or_dead_address",
    "known_program_or_infrastructure",
    "liquidity_or_pool_account",
    "closed_or_inactive",
    "unresolved_exclusion_candidate",
    "zero_balance",
    "included_holder",
  ];
  for (const p of priority) {
    if (classes.includes(p)) return p;
  }
  return "included_holder";
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

function aggregateOwners(
  accounts: ClassifiedTokenAccount[],
  observedSupply: bigint,
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
    const classes: CleaningClass[] = [];
    const evidence = new Set<string>();
    const tokenAccounts: string[] = [];
    let decimals = list[0]?.decimals ?? 0;
    for (const row of list) {
      const amount = parseRawAmount(row.rawAmount) ?? 0n;
      sum += amount;
      classes.push(row.cleaningClass);
      for (const e of row.evidence) evidence.add(e);
      tokenAccounts.push(row.tokenAccount);
      decimals = row.decimals;
    }
    const cleaningClass = ownerClassFromAccounts(classes);
    // Mixed included + excluded accounts on same owner: if any positive included amount remains
    // after exclusions, re-evaluate — task requires no silent drop; mixed → unresolved if conflicting.
    const hasInclude = classes.some(isIncludedClass);
    const hasExclude = classes.some(isExcludedClass);
    const hasUnresolved = classes.some(isUnresolvedClass);
    let finalClass = cleaningClass;
    if (hasUnresolved || (hasInclude && hasExclude && sum > 0n && cleaningClass !== "burn_or_dead_address" && cleaningClass !== "known_program_or_infrastructure")) {
      if (hasUnresolved || (hasInclude && hasExclude && !isExcludedClass(cleaningClass))) {
        finalClass = hasExclude && !hasInclude ? cleaningClass : hasInclude && hasExclude ? "unresolved_exclusion_candidate" : cleaningClass;
      }
    }
    // Pure zero-balance owners stay zero_balance.
    if (sum === 0n && classes.every((c) => c === "zero_balance" || c === "closed_or_inactive")) {
      finalClass = classes.includes("closed_or_inactive") ? "closed_or_inactive" : "zero_balance";
    }
    owners.push({
      owner,
      ownerRawAmount: sum.toString(),
      ownerNormalizedAmount: normalizeAmount(sum, decimals),
      tokenAccountCount: list.length,
      shareOfObservedSupply: ratioFromRaw(sum, observedSupply),
      cleaningClass: finalClass,
      evidence: [...evidence],
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
  const owners = aggregateOwners(rawTokenAccounts, enumerated > 0n ? enumerated : mintSupply ?? 0n);

  // Flag unresolved that still lack evidence of exclusion path.
  for (const owner of owners) {
    if (owner.cleaningClass === "unresolved_exclusion_candidate") {
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
    }
  }

  const includedOwners = owners.filter((o) => isIncludedClass(o.cleaningClass));
  const excludedOwners = owners.filter((o) => isExcludedClass(o.cleaningClass));
  const unresolvedOwners = owners.filter((o) => isUnresolvedClass(o.cleaningClass));

  const includedRaw = sumOwnerAmount(includedOwners, () => true);
  const excludedRaw = sumOwnerAmount(excludedOwners, () => true);
  const unresolvedRaw = sumOwnerAmount(unresolvedOwners, () => true);
  const partsSum = includedRaw + excludedRaw + unresolvedRaw;
  const identityOk = partsSum === enumerated;

  const residualReasons: string[] = [];
  if (!identityOk) residualReasons.push("owner_partition_sum_ne_enumerated");
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

  // Concentration only when denominator complete and > 0.
  const denomForConcentration = mint;
  const concentrationAllowed = accountingComplete === "complete" && denomForConcentration > 0n && input.paginationComplete;
  const concCompleteness: CompletenessLabel = concentrationAllowed ? "complete" : "partial";
  const universeDef = `${UNIVERSE_DEFINITION_VERSION}:cleaned_included_owners_vs_mint_supply`;

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
      ratio: concentrationAllowed && includedOwners[0]
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
      ratio: concentrationAllowed ? ratioFromRaw(unresolvedRaw, denomForConcentration) : null,
      universeDefinition: universeDef,
      completeness: concCompleteness,
      calculationVersion: CONCENTRATION_CALCULATION_VERSION,
    },
    {
      name: "excludedShare",
      numerator: excludedRaw.toString(),
      denominator: denomForConcentration.toString(),
      ratio: concentrationAllowed ? ratioFromRaw(excludedRaw, denomForConcentration) : null,
      universeDefinition: universeDef,
      completeness: concCompleteness,
      calculationVersion: CONCENTRATION_CALCULATION_VERSION,
    },
  ];

  for (const metric of concentration) {
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

  const judgmentEligible =
    input.paginationComplete
    && accountingComplete === "complete"
    && mintSupply !== null
    && residual === 0n
    && identityOk
    && !issues.some((i) => i.severity === "blocking");

  const denomForUniverse = enumerated > 0n ? enumerated : mint;
  const universeCompleteness: CompletenessLabel = input.paginationComplete ? accountingComplete : "partial";

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
        universeCompleteness,
        ["included_holder_only"],
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
