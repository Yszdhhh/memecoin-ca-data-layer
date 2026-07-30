/**
 * PROVIDER-BUDGET-CIRCUIT-001 — bounded ProviderExecutor.
 * Hard budget cutoff, classified errors, no infinite retry.
 */

import { classifyProviderError, emitStructuredLog } from "../observability/structured-log.js";

export interface ProviderCallRecord {
  provider: string;
  operation: string;
  latencyMs: number;
  status: "ok" | "error" | "budget_exhausted";
  errorClass?: string;
  scrubbedError?: string;
}

export interface ProviderExecutorOptions {
  taskId: string;
  budget: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  now?: () => number;
  log?: (line: string) => void;
}

export class ProviderExecutor {
  private used = 0;
  private readonly calls: ProviderCallRecord[] = [];
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly now: () => number;
  private readonly log: (line: string) => void;
  private circuitOpen = false;

  constructor(private readonly options: ProviderExecutorOptions) {
    this.maxRetries = options.maxRetries ?? 2;
    this.baseBackoffMs = options.baseBackoffMs ?? 200;
    this.now = options.now ?? (() => Date.now());
    this.log = options.log ?? (() => undefined);
  }

  get requestsUsed(): number {
    return this.used;
  }

  get budget(): number {
    return this.options.budget;
  }

  get callLog(): readonly ProviderCallRecord[] {
    return this.calls;
  }

  get budgetExhausted(): boolean {
    return this.used >= this.options.budget || this.circuitOpen;
  }

  async execute<T>(
    provider: string,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false; errorClass: string; message: string }> {
    if (this.budgetExhausted) {
      this.calls.push({
        provider,
        operation,
        latencyMs: 0,
        status: "budget_exhausted",
        errorClass: "budget_exhausted",
      });
      return { ok: false, errorClass: "budget_exhausted", message: "request_budget_exhausted" };
    }

    let attempt = 0;
    while (true) {
      if (this.used >= this.options.budget) {
        this.circuitOpen = true;
        return { ok: false, errorClass: "budget_exhausted", message: "request_budget_exhausted" };
      }
      this.used += 1;
      const t0 = this.now();
      try {
        const value = await fn();
        const latencyMs = this.now() - t0;
        this.calls.push({ provider, operation, latencyMs, status: "ok" });
        emitStructuredLog(
          {
            level: "info",
            msg: "provider_call",
            taskId: this.options.taskId,
            provider,
            operation,
            latencyMs,
            status: "ok",
            requestsUsed: this.used,
            budget: this.options.budget,
          },
          this.log,
        );
        return { ok: true, value };
      } catch (err) {
        const latencyMs = this.now() - t0;
        const errorClass = classifyProviderError(err);
        const message = err instanceof Error ? err.message : "provider_error";
        this.calls.push({
          provider,
          operation,
          latencyMs,
          status: "error",
          errorClass,
          scrubbedError: message.slice(0, 200).replace(/https?:\/\/\S+/g, "[url]"),
        });
        emitStructuredLog(
          {
            level: "warn",
            msg: "provider_call_error",
            taskId: this.options.taskId,
            provider,
            operation,
            latencyMs,
            status: "error",
            errorClass,
          },
          this.log,
        );
        if (errorClass === "credential") {
          this.circuitOpen = true;
          return { ok: false, errorClass, message: "credential_unavailable" };
        }
        if (errorClass === "rate_limit" && attempt < this.maxRetries) {
          attempt += 1;
          await sleep(this.baseBackoffMs * 2 ** (attempt - 1));
          continue;
        }
        if (attempt < this.maxRetries && (errorClass === "timeout" || errorClass === "network")) {
          attempt += 1;
          await sleep(this.baseBackoffMs * attempt);
          continue;
        }
        return { ok: false, errorClass, message: message.slice(0, 200) };
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
