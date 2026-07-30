import type {
  AddressLabelViewModel,
  AlertView,
  CaScanListItem,
  CaScanViewModel,
  JobViewModel,
  LiquidityViewModel,
  LocalDemoLabelInput,
  OperatorConsoleDataSource,
  ScheduleView,
  TaskViewModel,
  WalletListItem,
  WalletPoolSummary,
  WalletViewModel,
  WatchlistItemView,
} from "./types";

/**
 * Browser → local Operator API only. Never holds provider keys.
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
      note: `Local Operator API at ${this.baseUrl}. Offline product surfaces + optional Live hotpath.`,
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
    if (!res.ok) throw new Error(payload.error ?? `http_${res.status}`);
    return payload;
  }

  async listCaScans(): Promise<CaScanListItem[]> {
    const offline = await this.getJson<{ items: CaScanListItem[] }>("/api/v1/tokens/latest");
    if (offline.items?.length) return offline.items;
    // Fallback: completed hotpath tasks
    const { tasks } = await this.getJson<{ tasks: Array<Record<string, unknown>> }>(
      "/api/v1/ca-holder-tasks",
    );
    return tasks
      .filter((t) => t.resultStatus === "OK" || t.resultStatus === "PARTIAL")
      .map((t) => ({
        mint: String(t.mint),
        status: String(t.resultStatus),
        symbol: null,
        name: null,
        accountingEligible: Boolean(t.accountingEligible),
        exclusionCoverage: (t.exclusionCoverage as CaScanListItem["exclusionCoverage"]) ?? "unavailable",
        concentrationEligible: Boolean(t.concentrationEligible),
        observedAt: String(t.endedAt ?? t.startedAt ?? ""),
        dataSource: "operator-api",
      }));
  }

  async getCaScan(mint: string): Promise<CaScanViewModel | null> {
    try {
      return await this.getJson<CaScanViewModel>(`/api/v1/tokens/${encodeURIComponent(mint)}/latest`);
    } catch {
      try {
        const { tasks } = await this.getJson<{ tasks: Array<Record<string, unknown>> }>(
          "/api/v1/ca-holder-tasks",
        );
        const match = tasks.find((t) => t.mint === mint && t.taskId);
        if (!match?.taskId) return null;
        const r = await this.getJson<Record<string, unknown>>(
          `/api/v1/ca-holder-results/${encodeURIComponent(String(match.taskId))}`,
        );
        return mapHotpathResult(r);
      } catch {
        return null;
      }
    }
  }

  async listWallets(): Promise<{ summary: WalletPoolSummary; items: WalletListItem[] }> {
    return this.getJson("/api/v1/wallets");
  }

  async getWallet(walletId: string): Promise<WalletViewModel | null> {
    try {
      return await this.getJson(`/api/v1/wallets/${encodeURIComponent(walletId)}`);
    } catch {
      return null;
    }
  }

  async listAddressLabels(): Promise<AddressLabelViewModel[]> {
    const { items } = await this.getJson<{ items: AddressLabelViewModel[] }>("/api/v1/addresses");
    return items;
  }

  async saveLocalDemoLabel(input: LocalDemoLabelInput): Promise<void> {
    await this.postJson(`/api/v1/addresses/${encodeURIComponent(input.addressId)}/labels`, {
      label: input.label,
      note: input.note,
      confidence: input.confidence,
    });
  }

  async listTasks(): Promise<TaskViewModel[]> {
    const { tasks } = await this.getJson<{ tasks: Array<Record<string, unknown>> }>(
      "/api/v1/ca-holder-tasks",
    );
    const hotpath = tasks.map(mapTask);
    const { jobs } = await this.getJson<{ jobs: Array<Record<string, unknown>> }>("/api/v1/jobs");
    const jobTasks: TaskViewModel[] = jobs.map((j) => ({
      taskId: String(j.jobId),
      input: (j.input as { mint?: string }) ?? {},
      provider: "offline_job",
      status: mapJobState(String(j.state)),
      requestBudget: Number(j.budget ?? 0),
      requestsUsed: Number(j.requestsUsed ?? 0),
      startedAt: j.createdAt ? String(j.createdAt) : null,
      endedAt: j.updatedAt ? String(j.updatedAt) : null,
      warnings: [],
      outputLink: j.outputRef ? String(j.outputRef) : null,
      failureReason: j.error ? String(j.error) : null,
    }));
    return [...jobTasks, ...hotpath];
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
    // Prefer offline job (always works); Live hotpath remains optional.
    const job = await this.postJson<Record<string, unknown>>("/api/v1/jobs", {
      type: "ca_analysis_offline",
      input: { mint },
      budget: 5,
    });
    const jobId = String(job.jobId);
    await this.postJson(`/api/v1/jobs/${encodeURIComponent(jobId)}/run`, {});
    return {
      taskId: jobId,
      input: { mint },
      provider: "offline_job",
      status: "completed",
      requestBudget: Number(job.budget ?? 5),
      requestsUsed: 0,
      startedAt: String(job.createdAt ?? ""),
      endedAt: new Date().toISOString(),
      warnings: [],
      outputLink: `/ca/${mint}`,
      failureReason: null,
    };
  }

  async getLiquidityLatest(): Promise<LiquidityViewModel> {
    const body = await this.getJson<{
      snapshot: {
        observedAt: string;
        freshness: string;
        source: string;
        ruleVersion: string;
        metrics: Record<string, number | null>;
        percentiles: Record<string, number | null>;
        warnings: string[];
      };
      briefMarkdown: string;
    }>("/api/v1/liquidity/latest");
    return {
      observedAt: body.snapshot.observedAt,
      freshness: body.snapshot.freshness,
      source: body.snapshot.source,
      ruleVersion: body.snapshot.ruleVersion,
      metrics: body.snapshot.metrics,
      percentiles: body.snapshot.percentiles,
      warnings: body.snapshot.warnings,
      briefMarkdown: body.briefMarkdown,
    };
  }

  async listJobs(): Promise<JobViewModel[]> {
    const { jobs } = await this.getJson<{ jobs: Array<Record<string, unknown>> }>("/api/v1/jobs");
    return jobs.map((j) => ({
      jobId: String(j.jobId),
      type: String(j.type),
      state: String(j.state),
      attempt: Number(j.attempt ?? 0),
      budget: Number(j.budget ?? 0),
      requestsUsed: Number(j.requestsUsed ?? 0),
      outputRef: j.outputRef ? String(j.outputRef) : null,
      error: j.error ? String(j.error) : null,
      createdAt: String(j.createdAt ?? ""),
    }));
  }

  async getReplayCalibration(): Promise<Record<string, unknown>> {
    return this.getJson("/api/v1/replay/calibration");
  }

  async listWatchlist(): Promise<WatchlistItemView[]> {
    const { items } = await this.getJson<{ items: WatchlistItemView[] }>("/api/v1/watchlist");
    return items;
  }

  async addWatch(input: { kind: "ca" | "address"; subject: string; label?: string }): Promise<WatchlistItemView> {
    return this.postJson("/api/v1/watchlist", input);
  }

  async listAlerts(unreadOnly = false): Promise<{ items: AlertView[]; unreadCount: number }> {
    return this.getJson(`/api/v1/alerts${unreadOnly ? "?unread=1" : ""}`);
  }

  async markAlertRead(alertId: string): Promise<void> {
    await this.postJson(`/api/v1/alerts/${encodeURIComponent(alertId)}/read`, {});
  }

  async markAllAlertsRead(): Promise<void> {
    await this.postJson("/api/v1/alerts/read-all", {});
  }

  async listSchedules(): Promise<ScheduleView[]> {
    const { schedules } = await this.getJson<{ schedules: ScheduleView[] }>("/api/v1/schedules");
    return schedules;
  }

  async createSchedule(input: {
    type: string;
    subjects: string[];
    intervalHours: number;
    budgetPerRun: number;
    enabled?: boolean;
  }): Promise<ScheduleView> {
    return this.postJson("/api/v1/schedules", input);
  }

  async setScheduleEnabled(scheduleId: string, enabled: boolean): Promise<ScheduleView | null> {
    try {
      return await this.postJson(`/api/v1/schedules/${encodeURIComponent(scheduleId)}/enabled`, { enabled });
    } catch {
      return null;
    }
  }
}

function mapJobState(s: string): TaskViewModel["status"] {
  if (s === "completed") return "completed";
  if (s === "partial") return "partial";
  if (s === "failed" || s === "cancelled") return "failed";
  if (s === "running" || s === "leased") return "running";
  return "queued";
}

function mapTask(t: Record<string, unknown>): TaskViewModel {
  return {
    taskId: String(t.taskId),
    input: { mint: t.mint ? String(t.mint) : undefined },
    provider: "helius",
    status: String(t.status ?? "failed") as TaskViewModel["status"],
    requestBudget: Number(t.requestBudget ?? 0),
    requestsUsed: Number(t.requestsUsed ?? 0),
    startedAt: t.startedAt ? String(t.startedAt) : null,
    endedAt: t.endedAt ? String(t.endedAt) : null,
    warnings: Array.isArray(t.warnings) ? t.warnings.map(String) : [],
    outputLink: t.mint ? `/ca/${String(t.mint)}` : null,
    failureReason: t.failureReason ? String(t.failureReason) : null,
  };
}

function mapHotpathResult(r: Record<string, unknown>): CaScanViewModel {
  const accounting = (r.accounting ?? {}) as Record<string, unknown>;
  const ownerCounts = (r.ownerCounts ?? {}) as Record<string, number>;
  const concentration: CaScanViewModel["concentration"] = {};
  for (const row of (Array.isArray(r.concentration) ? r.concentration : []) as Array<Record<string, unknown>>) {
    concentration[String(row.name)] = {
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
    dataSource: "operator-api-hotpath",
    decimals: null,
    mintSupplyRaw: accounting.mintSupplyRaw ? String(accounting.mintSupplyRaw) : null,
    sourceWatermark: String(r.sourceWatermark ?? ""),
    provider: "helius",
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
    issues: [],
    universeDefinition: "cleaned_holder_universe",
  };
}
