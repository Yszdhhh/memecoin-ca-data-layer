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
import caScansFixture from "./fixtures/ca-scans.json";
import walletsFixture from "./fixtures/wallets.json";
import addressesFixture from "./fixtures/addresses.json";
import tasksFixture from "./fixtures/tasks.json";

const DEMO_LABELS_KEY = "operator-console-demo-labels-v1";
const DEMO_TASKS_KEY = "operator-console-demo-tasks-v1";

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

export class FixtureOperatorConsoleDataSource implements OperatorConsoleDataSource {
  getDataSourceMeta() {
    return {
      mode: "fixture" as const,
      live: false,
      note: "Fixture / scrubbed pilot data only. Zero Live Provider calls.",
    };
  }

  async listCaScans(): Promise<CaScanListItem[]> {
    return (caScansFixture.items as CaScanViewModel[]).map((s) => ({
      mint: s.mint,
      status: s.status,
      symbol: s.symbol,
      name: s.name,
      accountingEligible: s.accountingEligible,
      exclusionCoverage: s.exclusionCoverage,
      concentrationEligible: s.concentrationEligible,
      observedAt: s.observedAt,
      dataSource: s.dataSource,
    }));
  }

  async getCaScan(mint: string): Promise<CaScanViewModel | null> {
    const hit = (caScansFixture.items as CaScanViewModel[]).find((s) => s.mint === mint);
    return hit ?? null;
  }

  async listWallets(): Promise<{ summary: WalletPoolSummary; items: WalletListItem[] }> {
    const summary = walletsFixture as WalletPoolSummary;
    return { summary, items: summary.wallets };
  }

  async getWallet(walletId: string): Promise<WalletViewModel | null> {
    const summary = walletsFixture as WalletPoolSummary;
    const w = summary.wallets.find((x) => x.id === walletId);
    if (!w) return null;
    const extras = loadJson<Record<string, { labels: WalletViewModel["labels"]; note: string }>>(
      DEMO_LABELS_KEY,
      {},
    );
    const extra = extras[walletId];
    return {
      ...w,
      disclaimer: summary.disclaimer,
      observedAt: summary.observedAt,
      caHitsPlaceholder: "Historical CA hits require hotpath + address sedimentation (not in Shell).",
      labels: extra?.labels ?? [{ label: "demo_watch", source: "local_demo", confidence: 0.4, verificationStatus: "unverified" }],
      note: extra?.note ?? "",
    };
  }

  async listAddressLabels(): Promise<AddressLabelViewModel[]> {
    const base = addressesFixture.items as AddressLabelViewModel[];
    const extras = loadJson<Record<string, AddressLabelViewModel>>(DEMO_LABELS_KEY + ":addr", {});
    const byId = new Map(base.map((a) => [a.id, { ...a, labels: [...a.labels] }]));
    for (const [id, patch] of Object.entries(extras)) {
      const cur = byId.get(id);
      if (cur) {
        cur.labels = patch.labels?.length ? patch.labels : cur.labels;
        cur.note = patch.note ?? cur.note;
      } else {
        byId.set(id, patch);
      }
    }
    return [...byId.values()];
  }

  async saveLocalDemoLabel(input: LocalDemoLabelInput): Promise<void> {
    const list = await this.listAddressLabels();
    const target = list.find((a) => a.id === input.addressId);
    if (!target) {
      list.push({
        id: input.addressId,
        display: input.addressId,
        labels: [],
        note: input.note ?? "",
      });
    }
    const addr = list.find((a) => a.id === input.addressId)!;
    addr.labels = [
      ...addr.labels,
      {
        label: input.label,
        source: "local_demo",
        confidence: input.confidence ?? 0.5,
        verificationStatus: "unverified",
      },
    ];
    if (input.note !== undefined) addr.note = input.note;
    const map: Record<string, AddressLabelViewModel> = {};
    for (const a of list) map[a.id] = a;
    saveJson(DEMO_LABELS_KEY + ":addr", map);
  }

  async listTasks(): Promise<TaskViewModel[]> {
    const base = tasksFixture.items as TaskViewModel[];
    const demo = loadJson<TaskViewModel[]>(DEMO_TASKS_KEY, []);
    return [...demo, ...base];
  }

  async getTask(taskId: string): Promise<TaskViewModel | null> {
    const all = await this.listTasks();
    return all.find((t) => t.taskId === taskId) ?? null;
  }

  async createLocalDemoTask(mint: string): Promise<TaskViewModel> {
    // Local demo only — never triggers Helius/network.
    const task: TaskViewModel = {
      taskId: `TASK-DEMO-${Date.now()}`,
      input: { mint },
      provider: "fixture-local-demo",
      status: "completed",
      requestBudget: 0,
      requestsUsed: 0,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      warnings: ["local_demo_task_no_provider"],
      outputLink: mint ? `/ca/${mint}` : null,
      failureReason: null,
    };
    const demo = loadJson<TaskViewModel[]>(DEMO_TASKS_KEY, []);
    demo.unshift(task);
    saveJson(DEMO_TASKS_KEY, demo.slice(0, 20));
    return task;
  }
}
