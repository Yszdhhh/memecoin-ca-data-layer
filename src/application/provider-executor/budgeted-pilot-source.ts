/**
 * Wraps PilotTokenAccountSource so logical ops are recorded on the shared executor.
 * Real HTTP attempt accounting stays inside LiveHeliusDataSource (consumeHttpAttempt).
 */

import type { PilotTokenAccountSource } from "../live/solana-ca-real-data-cleaning-pilot.js";
import { ProviderBudgetExhaustedError, ProviderExecutor } from "./provider-executor.js";

export function wrapPilotSourceWithExecutor(
  inner: PilotTokenAccountSource,
  executor: ProviderExecutor,
): PilotTokenAccountSource {
  return {
    getRequestCount: () => executor.requestsUsed,
    async getMint(ca: string) {
      return executor.executeOperation("getMint", () => inner.getMint(ca));
    },
    async getTokenMetadata(ca: string) {
      return executor.executeOperation("getTokenMetadata", () => inner.getTokenMetadata(ca));
    },
    async enumerateTokenAccounts(ca, options) {
      return executor.executeOperation("enumerateTokenAccounts", () =>
        inner.enumerateTokenAccounts(ca, options),
      );
    },
  };
}

export function createBudgetedSourceFactory(
  sourceFactory: (executor: ProviderExecutor) => PilotTokenAccountSource,
  opts: { taskId: string; budget: number; logs?: string[] },
): { source: PilotTokenAccountSource; executor: ProviderExecutor; logs: string[] } {
  const logs = opts.logs ?? [];
  const executor = new ProviderExecutor({
    taskId: opts.taskId,
    budget: opts.budget,
    log: (line) => logs.push(line),
  });
  let inner: PilotTokenAccountSource;
  try {
    inner = sourceFactory(executor);
  } catch (error) {
    // Preserve credential fail-closed from LiveHelius constructor.
    throw error;
  }
  const source = wrapPilotSourceWithExecutor(inner, executor);
  return { source, executor, logs };
}

export function isBudgetExhaustedError(error: unknown): boolean {
  return (
    error instanceof ProviderBudgetExhaustedError
    || (error instanceof Error && (
      error.message === "request_budget_exhausted"
      || error.message === "helius_request_budget_exhausted"
    ))
  );
}
