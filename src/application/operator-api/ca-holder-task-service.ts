import { createHash, randomUUID } from "node:crypto";
import {
  RUNTIME_CREDENTIAL_UNAVAILABLE,
  runSolanaCaRealDataCleaningPilot,
  type PilotTokenAccountSource,
  type PerCaPilotArtifacts,
} from "../live/solana-ca-real-data-cleaning-pilot.js";
import { normalizeSolanaAddress } from "../../domain/solana-address.js";

export type CaHolderTaskStatus = "queued" | "running" | "completed" | "partial" | "failed";

export interface CaHolderTaskRecord {
  taskId: string;
  idempotencyKey: string;
  mint: string;
  status: CaHolderTaskStatus;
  requestBudget: number;
  requestsUsed: number;
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
  sourceFactory: () => PilotTokenAccountSource;
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
  private readonly sourceFactory: () => PilotTokenAccountSource;

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

  private async runTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    if (this.active >= 1) {
      // Serialize via queue; should not happen, fail closed if it does.
      task.status = "failed";
      task.failureReason = "concurrency_limit";
      task.endedAt = this.now().toISOString();
      this.byMintRunning.delete(task.mint);
      return;
    }

    this.active = 1;
    task.status = "running";
    task.startedAt = this.now().toISOString();

    try {
      const batch = await runSolanaCaRealDataCleaningPilot(
        {
          taskId: `operator-api:${taskId}`,
          baseCommit: this.baseCommit,
          dataSource: "helius",
          selectedAt: task.startedAt,
          samples: [{ ca: task.mint, selectionReason: "operator_api_manual" }],
        },
        this.sourceFactory,
        {
          maxPagesPerCa: this.maxPages,
          pageSize: 1_000,
          showZeroBalance: false,
          now: this.now,
        },
      );

      if (batch.status === RUNTIME_CREDENTIAL_UNAVAILABLE) {
        task.status = "failed";
        task.failureReason = "credential_unavailable";
        task.warnings.push(RUNTIME_CREDENTIAL_UNAVAILABLE);
        task.endedAt = this.now().toISOString();
        return;
      }

      const result = batch.results[0] ?? null;
      task.requestsUsed = Number(batch.batchSummary.totalHeliusRequests ?? result?.heliusRequestCount ?? 0);
      if (task.requestsUsed > task.requestBudget) {
        task.warnings.push("request_budget_exhausted");
      }

      if (!result) {
        task.status = "failed";
        task.failureReason = "empty_result";
        task.warnings.push(...batch.warnings);
        task.endedAt = this.now().toISOString();
        return;
      }

      task.result = result;
      task.resultStatus = result.status;
      task.paginationComplete = result.paginationComplete;
      task.accountingEligible = result.cleaning.accountingEligible;
      task.exclusionCoverage = result.cleaning.exclusionCoverage;
      task.concentrationEligible = result.cleaning.concentrationEligible;
      task.warnings = [...new Set([...result.warnings, ...batch.warnings, ...result.cleaning.issues.map((i) => i.code)])].slice(0, 32);
      task.scrubbedOutputSha = createHash("sha256")
        .update(JSON.stringify({
          mint: result.ca,
          status: result.status,
          accountingEligible: result.cleaning.accountingEligible,
          exclusionCoverage: result.cleaning.exclusionCoverage,
          concentrationEligible: result.cleaning.concentrationEligible,
          residual: result.cleaning.accounting.accountingResidualRaw,
        }))
        .digest("hex");

      if (result.status === "OK") task.status = "completed";
      else if (result.status === "PARTIAL") task.status = "partial";
      else {
        task.status = "failed";
        task.failureReason = result.warnings[0] ?? "rejected";
      }
      task.endedAt = this.now().toISOString();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "unknown_error";
      task.status = "failed";
      task.failureReason = msg.includes("credential") ? "credential_unavailable" : "provider_error";
      task.warnings.push(task.failureReason);
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
    judgmentEligibleDeprecated: task.accountingEligible,
  };
}

export function toPublicResultSummary(task: CaHolderTaskRecord): Record<string, unknown> | null {
  if (!task.result) return null;
  const c = task.result.cleaning;
  return {
    taskId: task.taskId,
    mint: task.mint,
    status: task.result.status,
    accountingEligible: c.accountingEligible,
    exclusionCoverage: c.exclusionCoverage,
    concentrationEligible: c.concentrationEligible,
    judgmentEligibleDeprecated: c.judgmentEligible,
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
        ratio: c.concentrationEligible ? m.ratio : null,
        verificationStatus: c.concentrationEligible ? "confirmed" : "unverified",
      })),
    issues: c.issues.slice(0, 32).map((i) => ({
      code: i.code,
      severity: i.severity,
      whetherManualReviewRequired: i.whetherManualReviewRequired,
    })),
    heliusRequestCount: task.result.heliusRequestCount,
    paginationComplete: task.result.paginationComplete,
    sourceWatermark: task.result.sourceWatermark,
    caScanPresent: task.result.caScanResponse !== null,
    scrubbedOutputSha: task.scrubbedOutputSha,
  };
}
