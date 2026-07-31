import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpOperatorConsoleDataSource } from "./http-source";
import { isOperatorApiError } from "./api-error";

const BASE = "http://127.0.0.1:8787";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("HttpOperatorConsoleDataSource.getTask fail-closed", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("refuses missing observedAt on Live result (schema_error; no task-time injection)", async () => {
    const taskBody = {
      taskId: "task-missing-observed",
      mint: "Mint111111111111111111111111111111111111111",
      status: "completed",
      requestBudget: 10,
      requestsUsed: 2,
      providerRequestCount: 2,
      startedAt: "2026-07-31T00:00:00.000Z",
      endedAt: "2026-07-31T00:01:00.000Z",
      warnings: [],
      failureReason: null,
    };
    // API returns result WITHOUT observedAt — client must not fill from endedAt
    const resultBody = {
      taskId: "task-missing-observed",
      mint: "Mint111111111111111111111111111111111111111",
      status: "OK",
      accountingEligible: true,
      exclusionCoverage: "partial",
      concentrationEligible: false,
      accounting: {
        mintSupplyRaw: "1",
        enumeratedTokenAccountBalanceRaw: "1",
        includedOwnerBalanceRaw: "1",
        excludedBalanceRaw: "0",
        unresolvedBalanceRaw: "0",
        accountingResidualRaw: "0",
        accountingResidualRatio: 0,
        completeness: "complete",
        paginationComplete: true,
        residualReasons: [],
        identity: "pilot",
      },
      ownerCounts: { total: 1, included: 1, excluded: 0, unresolved: 0 },
      concentration: [],
      issues: [],
      providerRequestCount: 2,
      paginationComplete: true,
      sourceWatermark: "helius:live:test",
      universeDefinition: "cleaned_holder_universe",
      // observedAt intentionally omitted
    };

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/ca-holder-tasks/")) {
        return jsonResponse(200, taskBody);
      }
      if (url.includes("/api/v1/ca-holder-results/")) {
        return jsonResponse(200, resultBody);
      }
      return jsonResponse(404, { error: "not_found" });
    }) as typeof fetch;

    const ds = new HttpOperatorConsoleDataSource(BASE);
    await expect(ds.getTask("task-missing-observed")).rejects.toSatisfy((e: unknown) => {
      return isOperatorApiError(e) && e.code === "schema_error";
    });

    // No synthesized cache: subsequent getCaScan also refuses (schema_error), not a faked scan
    await expect(ds.getCaScan(taskBody.mint)).rejects.toSatisfy((e: unknown) => {
      return isOperatorApiError(e) && e.code === "schema_error";
    });
  });

  it("maps result when observedAt is present from API", async () => {
    const taskBody = {
      taskId: "task-ok",
      mint: "Mint222222222222222222222222222222222222222",
      status: "completed",
      requestBudget: 10,
      requestsUsed: 1,
      providerRequestCount: 1,
      startedAt: "2026-07-31T00:00:00.000Z",
      endedAt: "2026-07-31T00:01:00.000Z",
      warnings: [],
      failureReason: null,
    };
    const resultBody = {
      taskId: "task-ok",
      mint: taskBody.mint,
      status: "OK",
      accountingEligible: true,
      exclusionCoverage: "partial",
      concentrationEligible: false,
      accounting: {
        mintSupplyRaw: "1",
        enumeratedTokenAccountBalanceRaw: "1",
        includedOwnerBalanceRaw: "1",
        excludedBalanceRaw: "0",
        unresolvedBalanceRaw: "0",
        accountingResidualRaw: "0",
        accountingResidualRatio: 0,
        completeness: "complete",
        paginationComplete: true,
        residualReasons: [],
        identity: "pilot",
      },
      ownerCounts: { total: 1, included: 1, excluded: 0, unresolved: 0 },
      concentration: [],
      issues: [],
      providerRequestCount: 1,
      paginationComplete: true,
      sourceWatermark: "helius:live:ok",
      observedAt: "2026-07-31T00:01:00.000Z",
      universeDefinition: "cleaned_holder_universe",
    };

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/ca-holder-tasks/")) return jsonResponse(200, taskBody);
      if (url.includes("/api/v1/ca-holder-results/")) return jsonResponse(200, resultBody);
      return jsonResponse(404, { error: "not_found" });
    }) as typeof fetch;

    const ds = new HttpOperatorConsoleDataSource(BASE);
    const task = await ds.getTask("task-ok");
    expect(task?.taskId).toBe("task-ok");
    const scan = await ds.getCaScan(taskBody.mint);
    expect(scan?.observedAt).toBe("2026-07-31T00:01:00.000Z");
  });
});
