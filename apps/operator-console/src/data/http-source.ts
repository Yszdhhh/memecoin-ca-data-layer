import type {
  AddressLabelViewModel,
  CaScanListItem,
  CaScanViewModel,
  LocalDemoLabelInput,
  OperatorConsoleDataSource,
  TaskViewModel,
  WalletListItem,
  WalletPoolSummary,
  WalletViewModel,
} from "./types";
import { FixtureOperatorConsoleDataSource } from "./fixture-source";
import {
  mapPublicResultToCaScan,
  mapPublicTaskToViewModel,
  toCaScanListItem,
  type PublicResultSummary,
  type PublicTaskSummary,
} from "./live-api-map";
import {
  makeApiError,
  mapHttpStatusError,
  mapNetworkFailure,
  OperatorApiError,
  scrubErrorText,
} from "./api-error";
import {
  isTerminalTaskStatus,
  loadTaskRefs,
  mapPool,
  TASK_REFS_QUERY_CONCURRENCY,
  updateTaskRefStatus,
  upsertTaskRef,
} from "./task-refs";

/**
 * Live Wiring HTTP adapter — loopback Operator API only.
 * Never reads/sends Helius keys. Provider calls stay server-side.
 */
export class HttpOperatorConsoleDataSource implements OperatorConsoleDataSource {
  private readonly fixture = new FixtureOperatorConsoleDataSource();
  private readonly resultCache = new Map<string, CaScanViewModel>();

  constructor(private readonly baseUrl: string) {
    if (!baseUrl) throw new Error("http_base_url_required");
  }

  getDataSourceMeta() {
    return {
      mode: "http" as const,
      live: true,
      note: `Loopback Operator API @ ${this.baseUrl} · browser holds no provider keys · wallets/addresses still fixture`,
    };
  }

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, "")}${path}`;
  }

  private async api<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.url(path), {
        ...init,
        headers: {
          accept: "application/json",
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...(init?.headers ?? {}),
        },
      });
    } catch (e) {
      throw mapNetworkFailure(e);
    }

    const text = await res.text();
    let body: Record<string, unknown> = {};
    if (text) {
      try {
        const parsed = JSON.parse(text) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          body = parsed as Record<string, unknown>;
        } else if (!res.ok) {
          throw makeApiError("schema_error", {
            httpStatus: res.status,
            message: "invalid JSON error body",
          });
        } else {
          throw makeApiError("schema_error", {
            httpStatus: res.status,
            message: "invalid JSON response",
          });
        }
      } catch (e) {
        if (e instanceof OperatorApiError) throw e;
        throw makeApiError("schema_error", {
          httpStatus: res.status,
          message: "invalid JSON",
          cause: scrubErrorText(text.slice(0, 80)),
        });
      }
    }

    if (!res.ok) {
      const err = typeof body.error === "string" ? body.error : null;
      throw mapHttpStatusError(res.status, err, body);
    }
    return body as T;
  }

  private rememberTask(task: { taskId: string; mint?: string; status?: string }): void {
    upsertTaskRef({
      taskId: task.taskId,
      mint: task.mint ?? "",
      createdAt: new Date().toISOString(),
      lastKnownStatus: task.status ?? "queued",
    });
  }

  async listCaScans(): Promise<CaScanListItem[]> {
    return [...this.resultCache.values()].map(toCaScanListItem);
  }

  async getCaScan(mint: string): Promise<CaScanViewModel | null> {
    const cached = this.resultCache.get(mint);
    if (cached) return cached;

    const refs = loadTaskRefs().filter((r) => r.mint === mint);
    if (refs.length === 0) return null;

    // Prefer newest ref
    const taskId = refs[0]!.taskId;
    try {
      const result = await this.api<PublicResultSummary>(
        `/api/v1/ca-holder-results/${encodeURIComponent(taskId)}`,
      );
      const scan = mapPublicResultToCaScan(result);
      this.resultCache.set(mint, scan);
      return scan;
    } catch (e) {
      if (e instanceof OperatorApiError) {
        if (e.code === "not_found") return null;
        throw e;
      }
      throw mapNetworkFailure(e);
    }
  }

  async listWallets(): Promise<{ summary: WalletPoolSummary; items: WalletListItem[] }> {
    return this.fixture.listWallets();
  }

  async getWallet(walletId: string): Promise<WalletViewModel | null> {
    return this.fixture.getWallet(walletId);
  }

  async listAddressLabels(): Promise<AddressLabelViewModel[]> {
    return this.fixture.listAddressLabels();
  }

  async saveLocalDemoLabel(input: LocalDemoLabelInput): Promise<void> {
    return this.fixture.saveLocalDemoLabel(input);
  }

  async listTasks(): Promise<TaskViewModel[]> {
    const refs = loadTaskRefs();
    const results = await mapPool(refs, TASK_REFS_QUERY_CONCURRENCY, async (ref) => {
      try {
        const t = await this.getTask(ref.taskId);
        if (t) return t;
        // keep ref visible as local-only placeholder when 404
        return {
          taskId: ref.taskId,
          input: { mint: ref.mint },
          provider: "operator-api-helius",
          status: (ref.lastKnownStatus as TaskViewModel["status"]) || "failed",
          requestBudget: 0,
          requestsUsed: 0,
          startedAt: ref.createdAt,
          endedAt: null,
          warnings: ["task_ref_not_on_server"],
          outputLink: ref.mint ? `/ca/${encodeURIComponent(ref.mint)}` : null,
          failureReason: "not_found",
          localOnly: true,
        } satisfies TaskViewModel;
      } catch (e) {
        // API unavailable: keep refs and surface unavailable
        const code = e instanceof OperatorApiError ? e.code : "api_unreachable";
        return {
          taskId: ref.taskId,
          input: { mint: ref.mint },
          provider: "operator-api-helius",
          status: (ref.lastKnownStatus as TaskViewModel["status"]) || "failed",
          requestBudget: 0,
          requestsUsed: 0,
          startedAt: ref.createdAt,
          endedAt: null,
          warnings: [code, "api_unavailable_ref_kept"],
          outputLink: ref.mint ? `/ca/${encodeURIComponent(ref.mint)}` : null,
          failureReason: code,
          localOnly: true,
        } satisfies TaskViewModel;
      }
    });
    return results;
  }

  async getTask(taskId: string): Promise<TaskViewModel | null> {
    try {
      const summary = await this.api<PublicTaskSummary>(
        `/api/v1/ca-holder-tasks/${encodeURIComponent(taskId)}`,
      );
      this.rememberTask({
        taskId: summary.taskId,
        mint: summary.mint,
        status: String(summary.status),
      });
      updateTaskRefStatus(summary.taskId, String(summary.status));

      if (["completed", "partial"].includes(String(summary.status))) {
        try {
          const result = await this.api<PublicResultSummary>(
            `/api/v1/ca-holder-results/${encodeURIComponent(taskId)}`,
          );
          // Inject observedAt from task if API already has it; mapper requires field on result
          const withObserved: PublicResultSummary = {
            ...result,
            observedAt:
              typeof result.observedAt === "string" && result.observedAt
                ? result.observedAt
                : (summary.endedAt ?? summary.startedAt ?? ""),
          };
          this.resultCache.set(summary.mint, mapPublicResultToCaScan(withObserved));
        } catch (e) {
          if (e instanceof OperatorApiError && e.code === "not_found") {
            /* result_not_ready */
          } else if (e instanceof OperatorApiError && e.code === "schema_error") {
            throw e;
          }
          /* other result errors: leave task view intact */
        }
      }
      return mapPublicTaskToViewModel(summary);
    } catch (e) {
      if (e instanceof OperatorApiError) {
        if (e.code === "not_found") return null;
        throw e;
      }
      throw mapNetworkFailure(e);
    }
  }

  /**
   * Create real CA-holder task via loopback Operator API.
   * Body is mint-only — never api keys / rpc / provider.
   * Retry must call this again (new taskId); never mutates prior task.
   */
  async createCaHolderTask(
    mint: string,
    opts?: { idempotencyKey?: string },
  ): Promise<TaskViewModel> {
    const cleaned = mint.trim();
    if (!cleaned) throw makeApiError("schema_error", { message: "invalid_mint" });

    const body: { mint: string; idempotencyKey?: string } = { mint: cleaned };
    if (opts?.idempotencyKey?.trim()) {
      body.idempotencyKey = opts.idempotencyKey.trim().slice(0, 200);
    }

    const summary = await this.api<PublicTaskSummary>("/api/v1/ca-holder-tasks", {
      method: "POST",
      body: JSON.stringify(body),
    });
    this.rememberTask({
      taskId: summary.taskId,
      mint: summary.mint,
      status: String(summary.status),
    });
    return mapPublicTaskToViewModel(summary);
  }

  /** Poll until terminal or attempts exhausted. Pure client loop; no provider keys. */
  async pollTask(
    taskId: string,
    opts?: { intervalMs?: number; maxAttempts?: number },
  ): Promise<TaskViewModel | null> {
    const intervalMs = opts?.intervalMs ?? 800;
    const maxAttempts = opts?.maxAttempts ?? 60;
    for (let i = 0; i < maxAttempts; i += 1) {
      const t = await this.getTask(taskId);
      if (!t) return null;
      if (isTerminalTaskStatus(t.status)) return t;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return this.getTask(taskId);
  }
}
