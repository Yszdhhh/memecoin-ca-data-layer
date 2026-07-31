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

/**
 * OPERATOR-CONSOLE-LIVE-WIRING-001
 * Browser only talks to local Operator API. Never holds provider keys.
 */
export class HttpOperatorConsoleDataSource implements OperatorConsoleDataSource {
  constructor(
    private readonly baseUrl: string,
    private readonly opts: { liveLabel?: boolean } = {},
  ) {}

  getDataSourceMeta() {
    return {
      mode: "http" as const,
      live: this.opts.liveLabel === true,
      note: `Local Operator API at ${this.baseUrl}. Credentials stay server-side.`,
    };
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `http_${res.status}`);
    }
    return (await res.json()) as T;
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      throw new Error(payload.error ?? `http_${res.status}`);
    }
    return payload;
  }

  async listCaScans(): Promise<CaScanListItem[]> {
    // Results are task-backed; surface completed/partial results as list rows.
    const { tasks } = await this.getJson<{ tasks: Array<Record<string, unknown>> }>(
      "/api/v1/ca-holder-tasks",
    );
    const items: CaScanListItem[] = [];
    for (const t of tasks) {
      if (t.resultStatus !== "OK" && t.resultStatus !== "PARTIAL") continue;
      items.push({
        mint: String(t.mint),
        status: String(t.resultStatus),
        symbol: null,
        name: null,
        accountingEligible: Boolean(t.accountingEligible),
        exclusionCoverage: (t.exclusionCoverage as CaScanListItem["exclusionCoverage"]) ?? "unavailable",
        concentrationEligible: Boolean(t.concentrationEligible),
        observedAt: String(t.endedAt ?? t.startedAt ?? ""),
        dataSource: "operator-api",
      });
    }
    return items;
  }

  async getCaScan(mint: string): Promise<CaScanViewModel | null> {
    const { tasks } = await this.getJson<{ tasks: Array<Record<string, unknown>> }>(
      "/api/v1/ca-holder-tasks",
    );
    const match = tasks.find((t) => t.mint === mint && t.taskId);
    if (!match?.taskId) return null;
    try {
      const r = await this.getJson<Record<string, unknown>>(
        `/api/v1/ca-holder-results/${encodeURIComponent(String(match.taskId))}`,
      );
      return mapResultToCaScan(r);
    } catch {
      return null;
    }
  }

  async listWallets(): Promise<{ summary: WalletPoolSummary; items: WalletListItem[] }> {
    return {
      summary: {
        alpha: 0,
        tierBUsablePool: 0,
        tierBShortlist: 0,
        manualReview: 0,
        unavailablePeriodWallets: 0,
        mapped: 0,
        partialApproxPct: 0,
        source: "operator-api",
        verificationStatus: "unverified",
        disclaimer: "Wallet pool not served via holder hotpath API; use Address Library import.",
        observedAt: new Date().toISOString(),
        wallets: [],
      },
      items: [],
    };
  }

  async getWallet(_walletId: string): Promise<WalletViewModel | null> {
    return null;
  }

  async listAddressLabels(): Promise<AddressLabelViewModel[]> {
    return [];
  }

  async saveLocalDemoLabel(_input: LocalDemoLabelInput): Promise<void> {
    throw new Error("use_fixture_mode_for_local_demo_labels");
  }

  async listTasks(): Promise<TaskViewModel[]> {
    const { tasks } = await this.getJson<{ tasks: Array<Record<string, unknown>> }>(
      "/api/v1/ca-holder-tasks",
    );
    return tasks.map(mapTask);
  }

  async getTask(taskId: string): Promise<TaskViewModel | null> {
    try {
      const t = await this.getJson<Record<string, unknown>>(
        `/api/v1/ca-holder-tasks/${encodeURIComponent(taskId)}`,
      );
      return mapTask(t);
    } catch {
      return null;
    }
  }

  async createLocalDemoTask(mint: string): Promise<TaskViewModel> {
    // Real task create against local API (server enforces live gate + credentials).
    const t = await this.postJson<Record<string, unknown>>("/api/v1/ca-holder-tasks", { mint });
    return mapTask(t);
  }
}

function mapTask(t: Record<string, unknown>): TaskViewModel {
  const status = String(t.status ?? "failed") as TaskViewModel["status"];
  return {
    taskId: String(t.taskId),
    input: { mint: t.mint ? String(t.mint) : undefined },
    provider: "helius",
    status,
    requestBudget: Number(t.requestBudget ?? 0),
    requestsUsed: Number(t.requestsUsed ?? 0),
    startedAt: t.startedAt ? String(t.startedAt) : null,
    endedAt: t.endedAt ? String(t.endedAt) : null,
    warnings: Array.isArray(t.warnings) ? t.warnings.map(String) : [],
    outputLink: t.mint ? `/ca/${String(t.mint)}` : null,
    failureReason: t.failureReason ? String(t.failureReason) : null,
  };
}

function mapResultToCaScan(r: Record<string, unknown>): CaScanViewModel {
  const accounting = (r.accounting ?? {}) as Record<string, unknown>;
  const ownerCounts = (r.ownerCounts ?? {}) as Record<string, number>;
  const concentrationRows = Array.isArray(r.concentration) ? r.concentration : [];
  const concentration: CaScanViewModel["concentration"] = {};
  for (const row of concentrationRows as Array<Record<string, unknown>>) {
    const name = String(row.name);
    concentration[name] = {
      numerator: String(row.numerator ?? "0"),
      denominator: String(row.denominator ?? "0"),
      ratio: typeof row.ratio === "number" ? row.ratio : null,
      verificationStatus: row.verificationStatus === "confirmed" ? "confirmed" : "unverified",
    };
  }
  return {
    mint: String(r.mint),
    status: String(r.status ?? "PARTIAL"),
    symbol: null,
    name: null,
    accountingEligible: Boolean(r.accountingEligible),
    exclusionCoverage: (r.exclusionCoverage as CaScanViewModel["exclusionCoverage"]) ?? "unavailable",
    concentrationEligible: Boolean(r.concentrationEligible),
    observedAt: new Date().toISOString(),
    dataSource: "operator-api",
    decimals: null,
    mintSupplyRaw: accounting.mintSupplyRaw ? String(accounting.mintSupplyRaw) : null,
    sourceWatermark: String(r.sourceWatermark ?? ""),
    provider: "helius",
    heliusRequestCountHistorical: typeof r.heliusRequestCount === "number" ? r.heliusRequestCount : undefined,
    judgmentEligibleDeprecated: Boolean(r.judgmentEligibleDeprecated),
    accounting: {
      mintSupplyRaw: String(accounting.mintSupplyRaw ?? "0"),
      enumeratedTokenAccountBalanceRaw: String(accounting.enumeratedTokenAccountBalanceRaw ?? "0"),
      includedOwnerBalanceRaw: String(accounting.includedOwnerBalanceRaw ?? "0"),
      excludedBalanceRaw: String(accounting.excludedBalanceRaw ?? "0"),
      unresolvedBalanceRaw: String(accounting.unresolvedBalanceRaw ?? "0"),
      accountingResidualRaw: String(accounting.accountingResidualRaw ?? "0"),
      accountingResidualRatio:
        typeof accounting.accountingResidualRatio === "number" ? accounting.accountingResidualRatio : null,
      completeness: String(accounting.completeness ?? "unknown"),
      paginationComplete: Boolean(r.paginationComplete),
      residualReasons: [],
      identity: "operator-api",
    },
    ownerCounts: {
      total: Number(ownerCounts.total ?? 0),
      included: Number(ownerCounts.included ?? 0),
      excluded: Number(ownerCounts.excluded ?? 0),
      unresolved: Number(ownerCounts.unresolved ?? 0),
      tokenAccounts: Number(ownerCounts.total ?? 0),
    },
    paginationComplete: Boolean(r.paginationComplete),
    concentration,
    concentrationWarnings: Array.isArray(r.warnings) ? r.warnings.map(String) : [],
    issues: Array.isArray(r.issues)
      ? (r.issues as Array<Record<string, unknown>>).map((i) => ({
          code: String(i.code),
          severity: String(i.severity ?? "info"),
          whetherManualReviewRequired: Boolean(i.whetherManualReviewRequired),
        }))
      : [],
    universeDefinition: "cleaned_holder_universe",
  };
}
