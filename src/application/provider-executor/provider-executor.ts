/**
 * Task-level provider request budget.
 * Every real HTTP attempt (page + retry) must call consumeHttpAttempt once.
 * Logical operations (getMint/enumerate/...) are tracked separately.
 * Logs never include full URL, API key, query string, or raw payload.
 */

export class ProviderBudgetExhaustedError extends Error {
  readonly code = "request_budget_exhausted" as const;
  constructor() {
    super("request_budget_exhausted");
    this.name = "ProviderBudgetExhaustedError";
  }
}

export interface ProviderExecutorOptions {
  taskId: string;
  budget: number;
  /** Optional sink for scrubbed structured lines (tests may capture). */
  log?: (line: string) => void;
}

export interface ProviderExecutorMetrics {
  providerRequestCount: number;
  providerOperationCount: number;
  pageCount: number;
  retryCount: number;
  timeoutCount: number;
  budgetUsed: number;
  requestBudget: number;
  providerBudgetExhausted: boolean;
}

export class ProviderExecutor {
  private requestCount = 0;
  private operationCount = 0;
  private pageCount = 0;
  private retryCount = 0;
  private timeoutCount = 0;
  private exhausted = false;
  private readonly log: (line: string) => void;

  constructor(private readonly options: ProviderExecutorOptions) {
    if (!Number.isInteger(options.budget) || options.budget < 1) {
      throw new Error("invalid_request_budget");
    }
    this.log = options.log ?? (() => undefined);
  }

  get metrics(): ProviderExecutorMetrics {
    return {
      providerRequestCount: this.requestCount,
      providerOperationCount: this.operationCount,
      pageCount: this.pageCount,
      retryCount: this.retryCount,
      timeoutCount: this.timeoutCount,
      budgetUsed: this.requestCount,
      requestBudget: this.options.budget,
      providerBudgetExhausted: this.exhausted || this.requestCount >= this.options.budget,
    };
  }

  get requestsUsed(): number {
    return this.requestCount;
  }

  get budget(): number {
    return this.options.budget;
  }

  get budgetExhausted(): boolean {
    return this.exhausted || this.requestCount >= this.options.budget;
  }

  /**
   * Consume one unit for a real HTTP attempt.
   * Throws ProviderBudgetExhaustedError without incrementing past budget.
   */
  consumeHttpAttempt(meta: { operation: string; isRetry?: boolean; isTimeout?: boolean } = { operation: "http" }): void {
    if (this.requestCount >= this.options.budget) {
      this.exhausted = true;
      this.emit("budget_exhausted", meta.operation, { isRetry: Boolean(meta.isRetry) });
      throw new ProviderBudgetExhaustedError();
    }
    this.requestCount += 1;
    if (meta.isRetry) this.retryCount += 1;
    if (meta.isTimeout) this.timeoutCount += 1;
    this.emit("http_attempt", meta.operation, {
      isRetry: Boolean(meta.isRetry),
      requestsUsed: this.requestCount,
    });
  }

  /** Logical operation (getMint / getTokenMetadata / enumerateTokenAccounts). */
  recordOperation(operation: string): void {
    this.operationCount += 1;
    this.emit("operation", operation, { operationCount: this.operationCount });
  }

  recordPage(): void {
    this.pageCount += 1;
  }

  recordTimeout(): void {
    this.timeoutCount += 1;
  }

  markExhausted(): void {
    this.exhausted = true;
  }

  /**
   * Run a logical provider operation under operation accounting.
   * Does not itself count HTTP attempts — the transport must call consumeHttpAttempt.
   */
  async executeOperation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    this.recordOperation(operation);
    return fn();
  }

  private emit(event: string, operation: string, extra: Record<string, unknown>): void {
    // Scrub: never log URLs, keys, query strings, or payloads.
    const line = JSON.stringify({
      event,
      taskId: this.options.taskId,
      operation: scrubToken(operation),
      budget: this.options.budget,
      requestsUsed: this.requestCount,
      ...extra,
    });
    this.log(line);
  }
}

function scrubToken(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/api[_-]?key[=:]\S+/gi, "api_key=[redacted]")
    .slice(0, 120);
}
