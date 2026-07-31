import { createHash, randomUUID } from "node:crypto";
import {
  RUNTIME_CREDENTIAL_UNAVAILABLE,
  runSolanaCaRealDataCleaningPilot,
  type PilotTokenAccountSource,
  type PerCaPilotArtifacts,
} from "../live/solana-ca-real-data-cleaning-pilot.js";
import { normalizeSolanaAddress } from "../../domain/solana-address.js";
import {
  createBudgetedSourceFactory,
  isBudgetExhaustedError,
} from "../provider-executor/budgeted-pilot-source.js";
import type { ProviderExecutor, ProviderExecutorMetrics } from "../provider-executor/provider-executor.js";

export type CaHolderTaskStatus = "queued" | "running" | "completed" | "partial" | "failed" | "blocked";

export interface CaHolderTaskRecord {
  taskId: string;
  idempotencyKey: string;
  mint: string;
  status: CaHolderTaskStatus;
  requestBudget: number;
  requestsUsed: number;
  providerRequestCount: number;
  providerOperationCount: number;
  pageCount: number;
  retryCount: number;
  timeoutCount: number;
  budgetUsed: number;
  providerBudgetExhausted: boolean;
  startedAt: string | null;
  endedAt: string | null;
  warnings: string[];
  failureReason: string | null;
  accountingEligible: boolean | null;
  exclusionCoverage: "complete" | "partial" | "unavailable" | null;
  concentrationEligible: boolean | null;
  paginationComplete: boolean | null;
  resultStatus: "OK" | "PARTIAL" | "REJECTED" | null;
  scrubbedOutputSha: string | null;
  /** In-memory only; not persisted. */
  result: PerCaPilotArtifacts | null;
}

export interface CreateCaHolderTaskInput {
  mint: string;
  idempotencyKey?: string;
}

export interface CaHolderTaskServiceOptions {
  /**
   * Build a pilot source. When executor is provided (Live path), inject it so
   * every real HTTP attempt shares the task budget.
   */
  sourceFactory: (executor?: ProviderExecutor) => PilotTokenAccountSource;
  requestBudget?: number;
  maxPages?: number;
  now?: () => Date;
  baseCommit?: string;
  /** When false, createTask fails closed without calling sourceFactory. */
  liveEnabled?: boolean;
}

const FORBIDDEN_BODY_KEYS = new Set([
  "apiKey",
  "api_key",
  "heliusApiKey",
  "provider",
  "rpcUrl",
  "endpoint",
  "chain",
  "privateKey",
  "credential",
]);

const EMPTY_METRICS = (budget: number): ProviderExecutorMetrics => ({
  providerRequestCount: 0,
  providerOperationCount: 0,
  pageCount: 0,
  retryCount: 0,
  timeoutCount: 0,
  budgetUsed: 0,
  requestBudget: budget,
  providerBudgetExhausted: false,
});

export class CaHolderTaskService {
  private readonly tasks = new Map<string, CaHolderTaskRecord>();
  private readonly byIdempotency = new Map<string, string>();
  private readonly byMintRunning = new Map<string, string>();
  private queue: Promise<void> = Promise.resolve();
  private active = 0;
  private readonly requestBudget: number;
  private readonly maxPages: number;
  private readonly now: () => Date;
  private readonly baseCommit: string;
  private readonly liveEnabled: boolean;
  private readonly sourceFactory: (executor?: ProviderExecutor) => PilotTokenAccountSource;

  constructor(options: CaHolderTaskServiceOptions) {
    this.sourceFactory = options.sourceFactory;
    this.requestBudget = options.requestBudget ?? 20;
    this.maxPages = options.maxPages ?? 8;
    this.now = options.now ?? (() => new Date());
    this.baseCommit = options.baseCommit ?? "unknown";
    this.liveEnabled = options.liveEnabled === true;
  }

  static rejectUnknownFields(body: unknown): string | null {
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return "body_must_be_object";
    }
    const obj = body as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (key === "mint" || key === "idempotencyKey") continue;
      if (FORBIDDEN_BODY_KEYS.has(key)) return `forbidden_field:${key}`;
      return `unknown_field:${key}`;
    }
    if (typeof obj.mint !== "string") return "mint_required";
    return null;
  }

  listTasks(): CaHolderTaskRecord[] {
    return [...this.tasks.values()].sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
  }

  getTask(taskId: string): CaHolderTaskRecord | null {
    return this.tasks.get(taskId) ?? null;
  }

  getResult(taskId: string): PerCaPilotArtifacts | null {
    return this.tasks.get(taskId)?.result ?? null;
  }

  /** Safe for health — boolean only, never credential material. */
  isLiveEnabled(): boolean {
    return this.liveEnabled;
  }

  async createTask(input: CreateCaHolderTaskInput): Promise<CaHolderTaskRecord> {
    if (!this.liveEnabled) {
      throw new Error("live_gate_disabled");
    }

    const mint = normalizeSolanaAddress(input.mint);
    if (mint === null) {
      throw new Error("invalid_mint");
    }

    const idempotencyKey = (input.idempotencyKey?.trim() || `mint:${mint}`).slice(0, 200);
    const existingId = this.byIdempotency.get(idempotencyKey);
    if (existingId) {
      const existing = this.tasks.get(existingId);
      if (existing) return existing;
    }

    const runningId = this.byMintRunning.get(mint);
    if (runningId) {
      const running = this.tasks.get(runningId);
      if (running && (running.status === "queued" || running.status === "running")) {
        return running;
      }
    }

    const taskId = randomUUID();
    const task: CaHolderTaskRecord = {
      taskId,
      idempotencyKey,
      mint,
      status: "queued",
      requestBudget: this.requestBudget,
      requestsUsed: 0,
      providerRequestCount: 0,
      providerOperationCount: 0,
      pageCount: 0,
      retryCount: 0,
      timeoutCount: 0,
      budgetUsed: 0,
      providerBudgetExhausted: false,
      startedAt: null,
      endedAt: null,
      warnings: [],
      failureReason: null,
      accountingEligible: null,
      exclusionCoverage: null,
      concentrationEligible: null,
      paginationComplete: null,
      resultStatus: null,
      scrubbedOutputSha: null,
      result: null,
    };
    this.tasks.set(taskId, task);
    this.byIdempotency.set(idempotencyKey, taskId);
    this.byMintRunning.set(mint, taskId);

    this.queue = this.queue.then(() => this.runTask(taskId)).catch(() => undefined);
    return task;
  }

  private applyMetrics(task: CaHolderTaskRecord, metrics: ProviderExecutorMetrics): void {
    task.providerRequestCount = metrics.providerRequestCount;
    task.providerOperationCount = metrics.providerOperationCount;
    task.pageCount = metrics.pageCount;
    task.retryCount = metrics.retryCount;
    task.timeoutCount = metrics.timeoutCount;
    task.budgetUsed = metrics.budgetUsed;
    task.requestBudget = metrics.requestBudget;
    task.providerBudgetExhausted = metrics.providerBudgetExhausted;
    task.requestsUsed = metrics.providerRequestCount;
  }

  private async runTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    if (this.active >= 1) {
      task.status = "failed";
      task.failureReason = "concurrency_limit";
      task.endedAt = this.now().toISOString();
      this.byMintRunning.delete(task.mint);
      return;
    }

    this.active = 1;
    task.status = "running";
    task.startedAt = this.now().toISOString();

    let metrics: ProviderExecutorMetrics = EMPTY_METRICS(this.requestBudget);

    try {
      // Single task-level budget: every HTTP attempt inside LiveHelius consumes it.
      const budgeted = createBudgetedSourceFactory(
        (executor) => this.sourceFactory(executor),
        { taskId: `operator-api:${taskId}`, budget: this.requestBudget },
      );
      metrics = budgeted.executor.metrics;

      const batch = await runSolanaCaRealDataCleaningPilot(
        {
          taskId: `operator-api:${taskId}`,
          baseCommit: this.baseCommit,
          dataSource: "helius",
          selectedAt: task.startedAt,
          samples: [{ ca: task.mint, selectionReason: "operator_api_manual" }],
        },
        () => budgeted.source,
        {
          maxPagesPerCa: this.maxPages,
          pageSize: 1_000,
          showZeroBalance: false,
          now: this.now,
        },
      );

      metrics = budgeted.executor.metrics;
      this.applyMetrics(task, metrics);

      if (batch.status === RUNTIME_CREDENTIAL_UNAVAILABLE) {
        task.status = "blocked";
        task.failureReason = "credential_unavailable";
        task.warnings = task.warnings.filter((w) => w !== "request_budget_exhausted");
        if (!task.warnings.includes(RUNTIME_CREDENTIAL_UNAVAILABLE)) {
          task.warnings.push(RUNTIME_CREDENTIAL_UNAVAILABLE);
        }
        // Credential path must report zero provider requests and must not claim budget exhaustion.
        task.providerRequestCount = 0;
        task.requestsUsed = 0;
        task.budgetUsed = 0;
        task.providerBudgetExhausted = false;
        task.endedAt = this.now().toISOString();
        return;
      }

      const result = batch.results[0] ?? null;
      // Only true when a further HTTP attempt was refused (not mere full utilization).
      const budgetStop =
        budgeted.executor.budgetExhausted
        || batch.warnings.some((w) => w === "request_budget_exhausted" || w === "helius_request_budget_exhausted")
        || (result?.warnings.some((w) => w === "request_budget_exhausted" || w === "helius_request_budget_exhausted") ?? false);

      if (budgetStop) {
        task.providerBudgetExhausted = true;
        if (!task.warnings.includes("request_budget_exhausted")) {
          task.warnings.push("request_budget_exhausted");
        }
      } else {
        // Full utilization of budget without a refused attempt is not exhaustion.
        task.providerBudgetExhausted = false;
      }

      if (!result) {
        if (budgetStop) {
          task.status = "partial";
          task.failureReason = "request_budget_exhausted";
          task.accountingEligible = false;
          task.concentrationEligible = false;
          task.paginationComplete = false;
        } else {
          task.status = "failed";
          task.failureReason = "empty_result";
        }
        task.warnings = [...new Set([...task.warnings, ...batch.warnings])].slice(0, 32);
        task.endedAt = this.now().toISOString();
        return;
      }

      task.result = result;
      task.resultStatus = result.status;
      task.paginationComplete = result.paginationComplete;
      if (budgeted.executor.metrics.pageCount > 0) {
        task.pageCount = budgeted.executor.metrics.pageCount;
      }

      if (budgetStop) {
        // Mid-flight refuse: incomplete data path.
        task.accountingEligible = false;
        task.concentrationEligible = false;
        task.paginationComplete = false;
      } else if (!result.paginationComplete) {
        task.accountingEligible = false;
        task.concentrationEligible = false;
      } else {
        task.accountingEligible = result.cleaning.accountingEligible;
        task.concentrationEligible = result.cleaning.concentrationEligible;
      }
      task.exclusionCoverage = result.cleaning.exclusionCoverage;

      task.warnings = [...new Set([
        ...result.warnings,
        ...batch.warnings,
        ...result.cleaning.issues.map((i) => i.code),
        ...task.warnings,
      ])].filter((w) => budgetStop || w !== "request_budget_exhausted").slice(0, 32);

      task.scrubbedOutputSha = createHash("sha256")
        .update(JSON.stringify({
          mint: result.ca,
          status: result.status,
          accountingEligible: task.accountingEligible,
          exclusionCoverage: task.exclusionCoverage,
          concentrationEligible: task.concentrationEligible,
          residual: result.cleaning.accounting.accountingResidualRaw,
        }))
        .digest("hex");

      if (budgetStop) {
        task.status = "partial";
        task.failureReason = "request_budget_exhausted";
      } else if (result.status === "OK") {
        task.status = "completed";
        task.failureReason = null;
      } else if (result.status === "PARTIAL") {
        task.status = "partial";
      } else {
        task.status = "failed";
        task.failureReason = result.warnings[0] ?? "rejected";
      }
      task.endedAt = this.now().toISOString();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "unknown_error";
      this.applyMetrics(task, metrics);

      if (msg.includes("credential") || msg.includes("helius_runtime_credential")) {
        task.status = "blocked";
        task.failureReason = "credential_unavailable";
        task.providerRequestCount = 0;
        task.requestsUsed = 0;
        task.budgetUsed = 0;
        task.providerBudgetExhausted = false;
        task.warnings = task.warnings.filter((w) => w !== "request_budget_exhausted");
        if (!task.warnings.includes("credential_unavailable")) {
          task.warnings.push("credential_unavailable");
        }
      } else if (isBudgetExhaustedError(error) || msg.includes("budget")) {
        task.status = "partial";
        task.failureReason = "request_budget_exhausted";
        task.providerBudgetExhausted = true;
        task.accountingEligible = false;
        task.concentrationEligible = false;
        task.paginationComplete = false;
        if (!task.warnings.includes("request_budget_exhausted")) {
          task.warnings.push("request_budget_exhausted");
        }
      } else {
        task.status = "failed";
        task.failureReason = "provider_error";
        task.warnings.push(task.failureReason);
      }
      task.endedAt = this.now().toISOString();
    } finally {
      this.active = 0;
      this.byMintRunning.delete(task.mint);
    }
  }
}

export function toPublicTaskSummary(task: CaHolderTaskRecord): Record<string, unknown> {
  return {
    taskId: task.taskId,
    mint: task.mint,
    status: task.status,
    requestBudget: task.requestBudget,
    requestsUsed: task.requestsUsed,
    providerRequestCount: task.providerRequestCount,
    providerOperationCount: task.providerOperationCount,
    pageCount: task.pageCount,
    retryCount: task.retryCount,
    timeoutCount: task.timeoutCount,
    budgetUsed: task.budgetUsed,
    providerBudgetExhausted: task.providerBudgetExhausted,
    startedAt: task.startedAt,
    endedAt: task.endedAt,
    warnings: task.warnings,
    failureReason: task.failureReason,
    accountingEligible: task.accountingEligible,
    exclusionCoverage: task.exclusionCoverage,
    concentrationEligible: task.concentrationEligible,
    paginationComplete: task.paginationComplete,
    resultStatus: task.resultStatus,
    scrubbedOutputSha: task.scrubbedOutputSha,
  };
}

/** Domain universe label for Console trust strip — never invent on frontend. */
export const CLEANED_HOLDER_UNIVERSE_DEFINITION = "cleaned_holder_universe";

export function toPublicResultSummary(task: CaHolderTaskRecord): Record<string, unknown> | null {
  if (!task.result) return null;
  const c = task.result.cleaning;
  const concentrationEligible = task.concentrationEligible === true;
  const observedAt = task.endedAt ?? task.startedAt;
  if (!observedAt) return null;
  return {
    taskId: task.taskId,
    mint: task.mint,
    status: task.result.status,
    accountingEligible: task.accountingEligible,
    exclusionCoverage: task.exclusionCoverage,
    concentrationEligible,
    accounting: c.accounting,
    ownerCounts: {
      total: c.owners.length,
      included: c.universes.cleanedHolderUniverse.ownerCount,
      excluded: c.universes.excludedInfrastructureUniverse.ownerCount,
      unresolved: c.universes.unresolvedUniverse.ownerCount,
    },
    concentration: c.concentration
      .filter((m) => ["top1", "top5", "top10", "top20", "top50", "top100"].includes(m.name))
      .map((m) => ({
        name: m.name,
        numerator: m.numerator,
        denominator: m.denominator,
        ratio: concentrationEligible ? m.ratio : null,
        verificationStatus: concentrationEligible ? "confirmed" : "unverified",
      })),
    issues: c.issues.slice(0, 32).map((i) => ({
      code: i.code,
      severity: i.severity,
      whetherManualReviewRequired: i.whetherManualReviewRequired,
    })),
    providerRequestCount: task.providerRequestCount,
    providerOperationCount: task.providerOperationCount,
    pageCount: task.pageCount,
    retryCount: task.retryCount,
    timeoutCount: task.timeoutCount,
    budgetUsed: task.budgetUsed,
    requestBudget: task.requestBudget,
    providerBudgetExhausted: task.providerBudgetExhausted,
    heliusRequestCount: task.providerRequestCount,
    paginationComplete: task.paginationComplete,
    sourceWatermark: task.result.sourceWatermark,
    observedAt,
    universeDefinition: CLEANED_HOLDER_UNIVERSE_DEFINITION,
    caScanPresent: task.result.caScanResponse !== null,
    scrubbedOutputSha: task.scrubbedOutputSha,
  };
}
