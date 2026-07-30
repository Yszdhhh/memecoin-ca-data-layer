/**
 * Wraps PilotTokenAccountSource so every provider call goes through ProviderExecutor.
 * Live hotpath is budget/circuit ready when credentials exist.
 */

import type { PilotTokenAccountSource } from "../live/solana-ca-real-data-cleaning-pilot.js";
import { ProviderExecutor } from "./provider-executor.js";
import { emitStructuredLog } from "../observability/structured-log.js";

export function wrapPilotSourceWithExecutor(
  inner: PilotTokenAccountSource,
  executor: ProviderExecutor,
  logs: string[] = [],
): PilotTokenAccountSource {
  const log = (line: string) => {
    logs.push(line);
  };

  return {
    getRequestCount: () => executor.requestsUsed,
    async getMint(ca: string) {
      const r = await executor.execute("helius", "getMint", () => inner.getMint(ca));
      if (!r.ok) {
        emitStructuredLog({ level: "error", msg: "getMint_failed", errorClass: r.errorClass }, log);
        throw new Error(r.message);
      }
      return r.value;
    },
    async getTokenMetadata(ca: string) {
      const r = await executor.execute("helius", "getTokenMetadata", () => inner.getTokenMetadata(ca));
      if (!r.ok) {
        emitStructuredLog({ level: "error", msg: "getTokenMetadata_failed", errorClass: r.errorClass }, log);
        throw new Error(r.message);
      }
      return r.value;
    },
    async enumerateTokenAccounts(ca, options) {
      // Enumeration may itself paginate; count as one budgeted operation entry point.
      // Inner source still enforces its own page budget; executor enforces task budget.
      const r = await executor.execute("helius", "enumerateTokenAccounts", () =>
        inner.enumerateTokenAccounts(ca, options),
      );
      if (!r.ok) {
        emitStructuredLog(
          { level: "error", msg: "enumerateTokenAccounts_failed", errorClass: r.errorClass },
          log,
        );
        throw new Error(r.message);
      }
      return r.value;
    },
  };
}

export function createBudgetedSourceFactory(
  sourceFactory: () => PilotTokenAccountSource,
  opts: { taskId: string; budget: number; logs?: string[] },
): { source: PilotTokenAccountSource; executor: ProviderExecutor; logs: string[] } {
  const logs = opts.logs ?? [];
  const executor = new ProviderExecutor({
    taskId: opts.taskId,
    budget: opts.budget,
    maxRetries: 1,
    log: (line) => logs.push(line),
  });
  const source = wrapPilotSourceWithExecutor(sourceFactory(), executor, logs);
  return { source, executor, logs };
}
