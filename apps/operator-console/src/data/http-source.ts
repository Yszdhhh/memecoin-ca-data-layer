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

const SESSION_TASKS_KEY = "operator-console-live-tasks-v1";
const SESSION_MINT_TASK_KEY = "operator-console-live-mint-task-v1";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

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
    const res = await fetch(this.url(path), {
      ...init,
      headers: {
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = typeof body.error === "string" ? body.error : `http_${res.status}`;
      throw new Error(err);
    }
    return body as T;
  }

  private rememberTaskId(taskId: string, mint?: string): void {
    const ids = loadJson<string[]>(SESSION_TASKS_KEY, []);
    if (!ids.includes(taskId)) {
      ids.unshift(taskId);
      saveJson(SESSION_TASKS_KEY, ids.slice(0, 50));
    }
    if (mint) {
      const map = loadJson<Record<string, string>>(SESSION_MINT_TASK_KEY, {});
      map[mint] = taskId;
      saveJson(SESSION_MINT_TASK_KEY, map);
    }
  }

  async listCaScans(): Promise<CaScanListItem[]> {
    // Live path has no historical list endpoint — surface session results only.
    return [...this.resultCache.values()].map(toCaScanListItem);
  }

  async getCaScan(mint: string): Promise<CaScanViewModel | null> {
    const cached = this.resultCache.get(mint);
    if (cached) return cached;

    const map = loadJson<Record<string, string>>(SESSION_MINT_TASK_KEY, {});
    const taskId = map[mint];
    if (!taskId) return null;

    try {
      const result = await this.api<PublicResultSummary>(
        `/api/v1/ca-holder-results/${encodeURIComponent(taskId)}`,
      );
      const scan = mapPublicResultToCaScan(result);
      this.resultCache.set(mint, scan);
      return scan;
    } catch {
      return null;
    }
  }

  async listWallets(): Promise<{ summary: WalletPoolSummary; items: WalletListItem[] }> {
    // G1 non-goal: wallets remain fixture / Tier-B unverified
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
    const ids = loadJson<string[]>(SESSION_TASKS_KEY, []);
    const out: TaskViewModel[] = [];
    for (const id of ids) {
      const t = await this.getTask(id);
      if (t) out.push(t);
    }
    return out;
  }

  async getTask(taskId: string): Promise<TaskViewModel | null> {
    try {
      const summary = await this.api<PublicTaskSummary>(
        `/api/v1/ca-holder-tasks/${encodeURIComponent(taskId)}`,
      );
      this.rememberTaskId(summary.taskId, summary.mint);
      // Refresh CA cache when terminal with result
      if (["completed", "partial"].includes(String(summary.status))) {
        try {
          const result = await this.api<PublicResultSummary>(
            `/api/v1/ca-holder-results/${encodeURIComponent(taskId)}`,
          );
          this.resultCache.set(summary.mint, mapPublicResultToCaScan(result, {
            observedAt: summary.endedAt ?? undefined,
          }));
        } catch {
          /* result_not_ready */
        }
      }
      return mapPublicTaskToViewModel(summary);
    } catch {
      return null;
    }
  }

  /**
   * G1: create real CA-holder task via loopback Operator API.
   * Body is mint-only — never api keys / rpc / provider.
   */
  async createLocalDemoTask(mint: string): Promise<TaskViewModel> {
    const cleaned = mint.trim();
    if (!cleaned) throw new Error("invalid_mint");

    const summary = await this.api<PublicTaskSummary>("/api/v1/ca-holder-tasks", {
      method: "POST",
      body: JSON.stringify({ mint: cleaned }),
    });
    this.rememberTaskId(summary.taskId, summary.mint);
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
      if (!["queued", "running"].includes(t.status)) return t;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return this.getTask(taskId);
  }
}
