/**
 * Pure aggregation helpers for SOL-CA-HOLDER-STABILITY-BATCHES-001.
 * Operates only on scrubbed task records — never raw provider payloads.
 */

export type StabilityTaskRecord = {
  batchId: string;
  sampleId: string;
  taskId: string | null;
  mint: string | null;
  mintFingerprint: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  providerRequestCount: number | null;
  providerOperationCount: number | null;
  requestBudget: number | null;
  pageCount: number | null;
  retryCount: number | null;
  timeoutCount: number | null;
  resultStatus: string | null;
  failureReason: string | null;
  paginationComplete: boolean | null;
  accountingEligible: boolean | null;
  exclusionCoverage: string | null;
  concentrationEligible: boolean | null;
  residualRatio: string | number | null;
  warningCodes: string[];
  sourceWatermark: string | null;
  observedAt: string | null;
  scrubbedOutputSha: string | null;
  browserStatusShown: string | null;
  browserDirectHelius: number;
  credentialExposure: number;
  shapeDrift: boolean;
  positiveBalanceViolation: boolean;
  ratioInconsistency: boolean;
  wrongConfirmed: boolean;
  uiStatusMismatch: boolean;
  warnings: string[];
};

export type DomainDeterminismInput = {
  mint: string;
  status: string;
  accountingEligible: boolean | null;
  exclusionCoverage: string | null;
  concentrationEligible: boolean | null;
  residual: string | number | null;
  warningCodes: string[];
};

/** null + warning when field unavailable — never invent 0/now. */
export function nullWithWarning<T>(
  value: T | null | undefined,
  field: string,
  warnings: string[],
): T | null {
  if (value === null || value === undefined) {
    const code = `field_unavailable:${field}`;
    if (!warnings.includes(code)) warnings.push(code);
    return null;
  }
  return value;
}

/**
 * Fail-closed trust rules:
 * - accounting ineligible → concentration ineligible
 * - exclusion partial/unavailable → concentration ineligible
 * - concentration ratios must be null (not 0%) when concentration ineligible
 *
 * Accounting residualRatio is independent: a real residual of 0 is valid and
 * is NOT a ratio inconsistency. ratioInconsistency only flags fabricated
 * concentration ratios when ineligible (e.g. confirmed 0% concentration).
 */
export function applyIneligibilityRules(rec: {
  accountingEligible: boolean | null;
  concentrationEligible: boolean | null;
  residualRatio: string | number | null;
  /** Optional concentration top-N ratio when present in result. */
  concentrationRatio?: string | number | null;
  exclusionCoverage: string | null;
  resultStatus: string | null;
  warnings: string[];
}): {
  accountingEligible: boolean | null;
  concentrationEligible: boolean | null;
  residualRatio: string | number | null;
  concentrationRatio: string | number | null;
  wrongConfirmed: boolean;
  ratioInconsistency: boolean;
} {
  let concentrationEligible = rec.concentrationEligible;
  const residualRatio = rec.residualRatio;
  let concentrationRatio =
    rec.concentrationRatio === undefined ? null : rec.concentrationRatio;
  let wrongConfirmed = false;
  let ratioInconsistency = false;

  if (rec.accountingEligible === false) {
    if (concentrationEligible === true) {
      wrongConfirmed = true;
      rec.warnings.push("wrong_confirmed:concentration_with_ineligible_accounting");
    }
    concentrationEligible = false;
  }

  if (
    rec.exclusionCoverage === "partial" ||
    rec.exclusionCoverage === "unavailable"
  ) {
    if (concentrationEligible === true) {
      wrongConfirmed = true;
      rec.warnings.push("wrong_confirmed:concentration_with_partial_exclusion");
    }
    concentrationEligible = false;
  }

  // Concentration display: never show 0% when ineligible — force null.
  if (concentrationEligible !== true) {
    if (
      concentrationRatio === 0 ||
      concentrationRatio === "0" ||
      concentrationRatio === "0.0" ||
      concentrationRatio === "0.00"
    ) {
      ratioInconsistency = true;
      rec.warnings.push("ratio_inconsistency:concentration_zero_while_ineligible");
    }
    if (concentrationRatio !== null && concentrationRatio !== undefined) {
      concentrationRatio = null;
      if (!rec.warnings.includes("concentration_ratio_null_when_ineligible")) {
        rec.warnings.push("concentration_ratio_null_when_ineligible");
      }
    }
  }

  return {
    accountingEligible: rec.accountingEligible,
    concentrationEligible,
    residualRatio,
    concentrationRatio,
    wrongConfirmed,
    ratioInconsistency,
  };
}

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0]!;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const w = rank - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

export function histogram(values: string[]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const v of values) {
    const key = v || "unknown";
    h[key] = (h[key] ?? 0) + 1;
  }
  return h;
}

export function mintFingerprint(mint: string): string {
  // Short stable fingerprint without requiring crypto in pure tests.
  let h = 0;
  for (let i = 0; i < mint.length; i += 1) {
    h = (Math.imul(31, h) + mint.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function domainDeterminismKey(input: DomainDeterminismInput): string {
  // Canonical JSON for domain-level determinism (order-stable warnings).
  const payload = {
    mint: input.mint,
    status: input.status,
    accountingEligible: input.accountingEligible,
    exclusionCoverage: input.exclusionCoverage,
    concentrationEligible: input.concentrationEligible,
    residual: input.residual,
    warningCodes: [...input.warningCodes].sort(),
  };
  return JSON.stringify(payload);
}

export function aggregateStabilityMetrics(records: StabilityTaskRecord[]): {
  uniqueCaCount: number;
  executionCount: number;
  completed: number;
  partial: number;
  failed: number;
  blocked: number;
  accountingEligibleRate: number | null;
  paginationCompleteRate: number | null;
  concentrationEligibleDistribution: Record<string, number>;
  exclusionCoverageDistribution: Record<string, number>;
  request: {
    min: number | null;
    median: number | null;
    p50: number | null;
    p95: number | null;
    max: number | null;
    total: number;
  };
  duration: {
    min: number | null;
    p50: number | null;
    p95: number | null;
    max: number | null;
  };
  pageDistribution: Record<string, number>;
  retryRate: number | null;
  timeoutRate: number | null;
  budgetExhaustionCount: number;
  shapeDriftCount: number;
  shapeDriftRate: number | null;
  residualDistribution: Record<string, number>;
  warningHistogram: Record<string, number>;
  failureHistogram: Record<string, number>;
  uiMismatchCount: number;
  browserDirectHelius: number;
  credentialExposure: number;
  positiveBalanceViolations: number;
  ratioInconsistency: number;
  wrongConfirmed: number;
} {
  const mints = new Set(
    records.map((r) => r.mint).filter((m): m is string => typeof m === "string" && m.length > 0),
  );
  const statuses = (s: string) => records.filter((r) => r.resultStatus === s).length;
  const completed = statuses("completed") + statuses("OK");
  const partial = statuses("partial") + statuses("PARTIAL");
  const failed = statuses("failed") + statuses("FAILED") + statuses("REJECTED");
  const blocked = statuses("blocked") + statuses("BLOCKED");

  const accElig = records.filter((r) => r.accountingEligible !== null);
  const pageDone = records.filter((r) => r.paginationComplete !== null);

  const reqs = records
    .map((r) => r.providerRequestCount)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  const durs = records
    .map((r) => r.durationMs)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);

  const concDist = histogram(
    records.map((r) =>
      r.concentrationEligible === null
        ? "null"
        : r.concentrationEligible
          ? "true"
          : "false",
    ),
  );
  const exclDist = histogram(
    records.map((r) => r.exclusionCoverage ?? "null"),
  );
  const pageDist = histogram(
    records.map((r) => (r.pageCount === null ? "null" : String(r.pageCount))),
  );
  const residualDist = histogram(
    records.map((r) => {
      if (r.residualRatio === null || r.residualRatio === undefined) return "null";
      const n = Number(r.residualRatio);
      if (!Number.isFinite(n)) return "non_numeric";
      if (n === 0) return "zero";
      if (n < 0.001) return "lt_0.1pct";
      if (n < 0.01) return "lt_1pct";
      return "gte_1pct";
    }),
  );

  const warningCodes = records.flatMap((r) => r.warningCodes ?? []);
  const failures = records
    .map((r) => r.failureReason)
    .filter((f): f is string => typeof f === "string" && f.length > 0);

  const withRetry = records.filter((r) => (r.retryCount ?? 0) > 0).length;
  const withTimeout = records.filter((r) => (r.timeoutCount ?? 0) > 0).length;
  const budgetEx = records.filter(
    (r) =>
      r.failureReason === "request_budget_exhausted" ||
      (r.warningCodes ?? []).includes("request_budget_exhausted"),
  ).length;
  const shapeDrift = records.filter((r) => r.shapeDrift).length;

  const totalReq = reqs.reduce((a, b) => a + b, 0);
  const n = records.length;

  return {
    uniqueCaCount: mints.size,
    executionCount: n,
    completed,
    partial,
    failed,
    blocked,
    accountingEligibleRate:
      accElig.length === 0
        ? null
        : accElig.filter((r) => r.accountingEligible === true).length / accElig.length,
    paginationCompleteRate:
      pageDone.length === 0
        ? null
        : pageDone.filter((r) => r.paginationComplete === true).length / pageDone.length,
    concentrationEligibleDistribution: concDist,
    exclusionCoverageDistribution: exclDist,
    request: {
      min: reqs.length ? reqs[0]! : null,
      median: percentile(reqs, 50),
      p50: percentile(reqs, 50),
      p95: percentile(reqs, 95),
      max: reqs.length ? reqs[reqs.length - 1]! : null,
      total: totalReq,
    },
    duration: {
      min: durs.length ? durs[0]! : null,
      p50: percentile(durs, 50),
      p95: percentile(durs, 95),
      max: durs.length ? durs[durs.length - 1]! : null,
    },
    pageDistribution: pageDist,
    retryRate: n === 0 ? null : withRetry / n,
    timeoutRate: n === 0 ? null : withTimeout / n,
    budgetExhaustionCount: budgetEx,
    shapeDriftCount: shapeDrift,
    shapeDriftRate: n === 0 ? null : shapeDrift / n,
    residualDistribution: residualDist,
    warningHistogram: histogram(warningCodes),
    failureHistogram: histogram(failures),
    uiMismatchCount: records.filter((r) => r.uiStatusMismatch).length,
    browserDirectHelius: records.reduce((a, r) => a + (r.browserDirectHelius ?? 0), 0),
    credentialExposure: records.reduce((a, r) => a + (r.credentialExposure ?? 0), 0),
    positiveBalanceViolations: records.filter((r) => r.positiveBalanceViolation).length,
    ratioInconsistency: records.filter((r) => r.ratioInconsistency).length,
    wrongConfirmed: records.filter((r) => r.wrongConfirmed).length,
  };
}

/**
 * Pause rules (launch §7). Soft shape-drift PARTIAL (provider_shape_drift_partial_skip
 * with remaining usable fields) is measured but not a hard pause by itself — it is the
 * fail-closed path for provider field variance (AUD-P2-004 / Stability P2).
 * Hard shape-drift FAIL (terminal failed + provider_shape_drift) on ≥2 CAs or hard rate
 * >10% still pauses for finding + bounded repair.
 */
export function shouldPauseBatches(metrics: {
  shapeDriftCount: number;
  hardShapeDriftCount?: number;
  executionCount: number;
  positiveBalanceViolations: number;
  ratioInconsistency: number;
  wrongConfirmed: number;
  credentialExposure: number;
  request: { total: number; max: number | null };
  affectedShapeDriftCas?: number;
  affectedHardShapeDriftCas?: number;
}): { pause: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const hard = metrics.hardShapeDriftCount ?? 0;
  const hardRate =
    metrics.executionCount === 0 ? 0 : hard / metrics.executionCount;
  if (hardRate > 0.1) reasons.push("hard_shape_drift_rate_gt_10pct");
  if ((metrics.affectedHardShapeDriftCas ?? 0) >= 2) {
    reasons.push("hard_shape_drift_repeat_across_cas");
  }
  if (metrics.positiveBalanceViolations > 0) reasons.push("positive_balance_violation");
  if (metrics.ratioInconsistency > 0) reasons.push("ratio_inconsistency");
  if (metrics.wrongConfirmed > 0) reasons.push("wrong_confirmed");
  if (metrics.credentialExposure > 0) reasons.push("credential_exposure");
  if (metrics.request.total > 600) reasons.push("total_budget_exceeded");
  if ((metrics.request.max ?? 0) > 20) reasons.push("per_task_budget_exceeded");
  return { pause: reasons.length > 0, reasons };
}
