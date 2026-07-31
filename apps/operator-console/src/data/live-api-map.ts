import { makeApiError } from "./api-error";
import type {
  CaScanListItem,
  CaScanViewModel,
  ConcentrationMetricView,
  ExclusionCoverage,
  TaskStatus,
  TaskViewModel,
} from "./types";

/** Public task JSON from Operator API `toPublicTaskSummary`. */
export interface PublicTaskSummary {
  taskId: string;
  mint: string;
  status: TaskStatus | string;
  requestBudget: number;
  requestsUsed: number;
  providerRequestCount?: number;
  providerOperationCount?: number;
  pageCount?: number;
  retryCount?: number;
  timeoutCount?: number;
  budgetUsed?: number;
  providerBudgetExhausted?: boolean;
  startedAt: string | null;
  endedAt: string | null;
  warnings: string[];
  failureReason: string | null;
  accountingEligible?: boolean | null;
  exclusionCoverage?: ExclusionCoverage | null;
  concentrationEligible?: boolean | null;
  paginationComplete?: boolean | null;
  resultStatus?: "OK" | "PARTIAL" | "REJECTED" | null;
  scrubbedOutputSha?: string | null;
}

/** Public result JSON from Operator API `toPublicResultSummary`. */
export interface PublicResultSummary {
  taskId: string;
  mint: string;
  status: "OK" | "PARTIAL" | "REJECTED" | string;
  accountingEligible: boolean | null;
  exclusionCoverage: ExclusionCoverage | null;
  concentrationEligible: boolean;
  accounting: CaScanViewModel["accounting"] | null;
  ownerCounts: {
    total: number | null;
    included: number | null;
    excluded: number | null;
    unresolved: number | null;
    tokenAccounts?: number | null;
  } | null;
  concentration: Array<{
    name: string;
    numerator: string | null;
    denominator: string | null;
    ratio: number | null;
    verificationStatus: "confirmed" | "unverified";
  }>;
  issues: Array<{
    code: string;
    severity: string;
    whetherManualReviewRequired?: boolean;
  }>;
  providerRequestCount: number;
  pageCount?: number;
  retryCount?: number;
  timeoutCount?: number;
  budgetUsed?: number;
  requestBudget?: number;
  providerBudgetExhausted?: boolean;
  heliusRequestCount?: number;
  paginationComplete: boolean | null;
  sourceWatermark: string;
  /** Must come from API — never browser Date.now() */
  observedAt: string;
  /** Must come from API/domain contract — never frontend guess */
  universeDefinition: string;
  scrubbedOutputSha?: string | null;
}

export type TerminalUiKind =
  | "queued"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "blocked_credential"
  | "budget_exhausted"
  | "timeout"
  | "schema_error"
  | "empty"
  | "stale"
  | "unknown";

export interface TerminalUiState {
  kind: TerminalUiKind;
  label: string;
  severity: "ok" | "warn" | "bad" | "muted";
  /** budget_exhausted is always partial, never failed */
  mapsToTaskStatus: TaskStatus | "partial";
}

function hasWarning(task: PublicTaskSummary, needle: string): boolean {
  const n = needle.toLowerCase();
  if ((task.failureReason ?? "").toLowerCase().includes(n)) return true;
  return (task.warnings ?? []).some((w) => String(w).toLowerCase().includes(n));
}

/**
 * Map Operator API task summary → UI terminal state.
 * budget_exhausted must surface as partial (not failed).
 */
export function describeTaskTerminalState(task: PublicTaskSummary): TerminalUiState {
  const status = String(task.status ?? "").toLowerCase();

  if (status === "queued") {
    return { kind: "queued", label: "QUEUED", severity: "warn", mapsToTaskStatus: "queued" };
  }
  if (status === "running") {
    return { kind: "running", label: "RUNNING", severity: "warn", mapsToTaskStatus: "running" };
  }

  if (
    status === "blocked" ||
    hasWarning(task, "credential_unavailable") ||
    hasWarning(task, "credential")
  ) {
    return {
      kind: "blocked_credential",
      label: "BLOCKED · credential",
      severity: "bad",
      mapsToTaskStatus: "blocked",
    };
  }

  if (
    task.providerBudgetExhausted === true ||
    hasWarning(task, "request_budget_exhausted") ||
    hasWarning(task, "budget_exhausted")
  ) {
    return {
      kind: "budget_exhausted",
      label: "PARTIAL · budget exhausted",
      severity: "warn",
      mapsToTaskStatus: "partial",
    };
  }

  if (hasWarning(task, "timeout")) {
    return { kind: "timeout", label: "FAILED · timeout", severity: "bad", mapsToTaskStatus: "failed" };
  }

  if (hasWarning(task, "schema") || hasWarning(task, "malformed")) {
    return {
      kind: "schema_error",
      label: "FAILED · schema",
      severity: "bad",
      mapsToTaskStatus: "failed",
    };
  }

  if (status === "partial") {
    return { kind: "partial", label: "PARTIAL", severity: "warn", mapsToTaskStatus: "partial" };
  }
  if (status === "failed") {
    return { kind: "failed", label: "FAILED", severity: "bad", mapsToTaskStatus: "failed" };
  }
  if (status === "completed") {
    return { kind: "completed", label: "COMPLETED", severity: "ok", mapsToTaskStatus: "completed" };
  }

  // unknown status → schema error path (not success/empty fallback)
  return {
    kind: "schema_error",
    label: "FAILED · schema · unknown status",
    severity: "bad",
    mapsToTaskStatus: "failed",
  };
}

export function mapPublicTaskToViewModel(task: PublicTaskSummary): TaskViewModel {
  return {
    taskId: task.taskId,
    input: { mint: task.mint },
    provider: "operator-api-helius",
    status: (String(task.status) as TaskStatus) || "failed",
    requestBudget: task.requestBudget,
    requestsUsed: task.requestsUsed ?? task.providerRequestCount ?? 0,
    providerRequestCount: task.providerRequestCount ?? task.requestsUsed ?? 0,
    pageCount: task.pageCount ?? null,
    retryCount: task.retryCount ?? null,
    timeoutCount: task.timeoutCount ?? null,
    startedAt: task.startedAt,
    endedAt: task.endedAt,
    warnings: [...(task.warnings ?? [])],
    outputLink: task.mint ? `/ca/${encodeURIComponent(task.mint)}` : null,
    failureReason: task.failureReason,
  };
}

function optionalCount(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function concentrationRecord(
  rows: PublicResultSummary["concentration"] | null | undefined,
  concentrationEligible: boolean,
): Record<string, ConcentrationMetricView | null> {
  const out: Record<string, ConcentrationMetricView | null> = {};
  const list = rows ?? [];
  for (const name of ["top1", "top5", "top10", "top20", "top50", "top100"]) {
    const hit = list.find((r) => r.name === name);
    if (!hit) {
      out[name] = null;
      continue;
    }
    // ratio=null stays null when ineligible — never coerce to 0
    const ratio = concentrationEligible ? (hit.ratio === undefined ? null : hit.ratio) : null;
    const vs =
      concentrationEligible && hit.verificationStatus === "confirmed" ? "confirmed" : "unverified";
    out[name] = {
      numerator: hit.numerator ?? null,
      denominator: hit.denominator ?? null,
      ratio,
      verificationStatus: vs,
    };
  }
  return out;
}

/**
 * Strict parse of public result → view model.
 * Missing required observedAt / universeDefinition → schema_error (throw).
 * Missing optional counts/ratios → null (never 0 / never browser now).
 */
export function mapPublicResultToCaScan(result: PublicResultSummary): CaScanViewModel {
  if (!result || typeof result !== "object") {
    throw makeApiError("schema_error", { message: "result missing" });
  }
  if (typeof result.mint !== "string" || !result.mint) {
    throw makeApiError("schema_error", { message: "result.mint required" });
  }
  if (typeof result.observedAt !== "string" || !result.observedAt.trim()) {
    throw makeApiError("schema_error", {
      message: "missing required observedAt",
      taskId: typeof result.taskId === "string" ? result.taskId : null,
    });
  }
  if (typeof result.universeDefinition !== "string" || !result.universeDefinition.trim()) {
    throw makeApiError("schema_error", {
      message: "missing required universeDefinition",
      taskId: typeof result.taskId === "string" ? result.taskId : null,
    });
  }
  if (typeof result.sourceWatermark !== "string" || !result.sourceWatermark) {
    throw makeApiError("schema_error", { message: "missing required sourceWatermark" });
  }

  const knownStatus = ["OK", "PARTIAL", "REJECTED"].includes(String(result.status));
  if (!knownStatus) {
    throw makeApiError("schema_error", {
      message: `unknown result status: ${String(result.status)}`,
    });
  }

  const concentrationEligible = result.concentrationEligible === true;
  const exclusion = (result.exclusionCoverage ?? "unavailable") as ExclusionCoverage;
  const accountingEligible = result.accountingEligible === true;
  const concentration = concentrationRecord(result.concentration, concentrationEligible);
  const oc = result.ownerCounts;

  return {
    mint: result.mint,
    status: result.status,
    symbol: null,
    name: null,
    accountingEligible,
    exclusionCoverage: exclusion,
    concentrationEligible,
    observedAt: result.observedAt,
    dataSource: "operator-api-live",
    decimals: null,
    mintSupplyRaw: result.accounting?.mintSupplyRaw ?? null,
    sourceWatermark: result.sourceWatermark,
    provider: "helius",
    heliusRequestCountHistorical: result.heliusRequestCount ?? result.providerRequestCount,
    judgmentEligibleDeprecated: accountingEligible,
    accounting: result.accounting ?? {
      mintSupplyRaw: "",
      enumeratedTokenAccountBalanceRaw: "",
      includedOwnerBalanceRaw: "",
      excludedBalanceRaw: "",
      unresolvedBalanceRaw: "",
      accountingResidualRaw: "",
      accountingResidualRatio: null,
      completeness: "unavailable",
      paginationComplete: false,
      residualReasons: [],
      identity: "unavailable",
    },
    ownerCounts: {
      total: optionalCount(oc?.total),
      included: optionalCount(oc?.included),
      excluded: optionalCount(oc?.excluded),
      unresolved: optionalCount(oc?.unresolved),
      tokenAccounts: optionalCount(oc?.tokenAccounts ?? oc?.total),
    },
    paginationComplete: result.paginationComplete === true,
    concentration,
    concentrationWarnings: concentrationEligible
      ? []
      : ["concentration_unverified_exclusion_incomplete"],
    issues: (result.issues ?? []).map((i) => ({
      code: i.code,
      severity: i.severity,
      whetherManualReviewRequired: i.whetherManualReviewRequired,
    })),
    universeDefinition: result.universeDefinition,
  };
}

export function toCaScanListItem(scan: CaScanViewModel): CaScanListItem {
  return {
    mint: scan.mint,
    status: scan.status,
    symbol: scan.symbol,
    name: scan.name,
    accountingEligible: scan.accountingEligible,
    exclusionCoverage: scan.exclusionCoverage,
    concentrationEligible: scan.concentrationEligible,
    observedAt: scan.observedAt,
    dataSource: scan.dataSource,
  };
}

/** Classify empty / stale presentation hints for result views. */
export function describeResultPresence(
  result: PublicResultSummary | null | undefined,
  task?: PublicTaskSummary | null,
): TerminalUiKind | "ready" {
  if (!task && !result) return "empty";
  if (task && ["queued", "running"].includes(String(task.status))) {
    return String(task.status) as TerminalUiKind;
  }
  if (!result) {
    if (task && ["completed", "partial"].includes(String(task.status))) return "empty";
    return "empty";
  }
  if (task?.endedAt) {
    const ageMs = Date.now() - Date.parse(task.endedAt);
    if (Number.isFinite(ageMs) && ageMs > 24 * 60 * 60 * 1000) return "stale";
  }
  return "ready";
}
