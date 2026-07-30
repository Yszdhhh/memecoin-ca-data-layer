import { describe, expect, it, vi, afterEach } from "vitest";
import { HttpOperatorConsoleDataSource } from "./http-source";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HttpOperatorConsoleDataSource", () => {
  it("maps task list from local API without requiring keys", async function () {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(String(url)).toContain("http://127.0.0.1:8787/api/v1/ca-holder-tasks");
        return {
          ok: true,
          json: async () => ({
            tasks: [
              {
                taskId: "t1",
                mint: "Mint1111111111111111111111111111111111111",
                status: "partial",
                requestBudget: 20,
                requestsUsed: 3,
                startedAt: "2026-07-30T00:00:00.000Z",
                endedAt: "2026-07-30T00:00:01.000Z",
                warnings: ["pagination_incomplete"],
                failureReason: null,
                resultStatus: "PARTIAL",
                accountingEligible: true,
                exclusionCoverage: "partial",
                concentrationEligible: false,
              },
            ],
          }),
        };
      }),
    );

    const ds = new HttpOperatorConsoleDataSource("http://127.0.0.1:8787");
    const tasks = await ds.listTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.taskId).toBe("t1");
    expect(tasks[0]!.provider).toBe("helius");
    expect(ds.getDataSourceMeta().mode).toBe("http");
    expect(ds.getDataSourceMeta().note).toMatch(/Credentials stay server-side/);
  });

  it("surfaces live_gate_disabled from API on create", async function () {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: "live_gate_disabled" }),
      })),
    );
    const ds = new HttpOperatorConsoleDataSource("http://127.0.0.1:8787");
    await expect(ds.createLocalDemoTask("Mint1111111111111111111111111111111111111")).rejects.toThrow(
      /live_gate_disabled/,
    );
  });
});
