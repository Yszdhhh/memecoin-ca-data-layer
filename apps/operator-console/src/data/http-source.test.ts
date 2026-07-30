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
        const u = String(url);
        if (u.includes("/api/v1/ca-holder-tasks") && !u.includes("/jobs")) {
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
        }
        if (u.includes("/api/v1/jobs")) {
          return {
            ok: true,
            json: async () => ({
              jobs: [
                {
                  jobId: "j1",
                  type: "ca_analysis_offline",
                  state: "completed",
                  attempt: 1,
                  budget: 5,
                  requestsUsed: 0,
                  createdAt: "2026-07-30T00:00:00.000Z",
                  updatedAt: "2026-07-30T00:00:01.000Z",
                  outputRef: "ca-card:x",
                  error: null,
                  input: { mint: "Mint1111111111111111111111111111111111111" },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({ error: "not_found" }) };
      }),
    );

    const ds = new HttpOperatorConsoleDataSource("http://127.0.0.1:8787");
    const tasks = await ds.listTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(tasks.some((t) => t.taskId === "t1")).toBe(true);
    expect(tasks.some((t) => t.provider === "offline_job")).toBe(true);
    expect(ds.getDataSourceMeta().mode).toBe("http");
    expect(ds.getDataSourceMeta().note).toMatch(/Local Operator API/);
  });

  it("creates offline job then runs it (not Live hotpath)", async function () {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/api/v1/jobs") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            jobId: "job-1",
            budget: 5,
            createdAt: "2026-07-30T00:00:00.000Z",
          }),
        };
      }
      if (u.includes("/api/v1/jobs/job-1/run")) {
        return { ok: true, json: async () => ({ jobId: "job-1", state: "completed" }) };
      }
      return { ok: false, status: 404, json: async () => ({ error: "not_found" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const ds = new HttpOperatorConsoleDataSource("http://127.0.0.1:8787");
    const t = await ds.createLocalDemoTask("Mint1111111111111111111111111111111111111");
    expect(t.provider).toBe("offline_job");
    expect(t.status).toBe("completed");
  });

  it("maps liquidity from shipped API shape", async function () {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          snapshot: {
            observedAt: "2026-07-30T00:00:00.000Z",
            freshness: "stale",
            source: "offline_fixture",
            ruleVersion: "liquidity-metrics-v1",
            metrics: { dexVolumeUsd: 1, protocolRevenueUsd: null, compositeLevel: null },
            percentiles: {},
            warnings: ["latest_stale_retained"],
          },
          briefMarkdown: "# Liquidity Daily Brief\n",
        }),
      })),
    );
    const ds = new HttpOperatorConsoleDataSource("http://127.0.0.1:8787");
    const liq = await ds.getLiquidityLatest();
    expect(liq.ruleVersion).toBe("liquidity-metrics-v1");
    expect(liq.metrics.protocolRevenueUsd).toBeNull();
    expect(liq.briefMarkdown).toMatch(/Liquidity Daily Brief/);
  });

  it("lists wallets and addresses from API", async function () {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/api/v1/wallets") && !u.match(/wallets\/.+/)) {
          return {
            ok: true,
            json: async () => ({
              summary: {
                alpha: 0,
                tierBUsablePool: 1,
                tierBShortlist: 0,
                manualReview: 0,
                unavailablePeriodWallets: 0,
                mapped: 0,
                partialApproxPct: 0,
                source: "local_address_store",
                verificationStatus: "unverified",
                disclaimer: "x",
                observedAt: "2026-07-30T00:00:00.000Z",
                wallets: [],
              },
              items: [
                {
                  id: "So11111111111111111111111111111111111111112",
                  fingerprint: "So11…1112",
                  tier: "tierb_usable",
                  status7d: "UNVERIFIED",
                  status30d: "UNVERIFIED",
                  completeness: 0.5,
                  warnings: [],
                  verificationStatus: "unverified",
                },
              ],
            }),
          };
        }
        if (u.includes("/api/v1/addresses")) {
          return {
            ok: true,
            json: async () => ({
              items: [
                {
                  id: "So11111111111111111111111111111111111111112",
                  display: "So11…1112",
                  labels: [{ label: "usable", source: "x", confidence: 0.5, verificationStatus: "unverified" }],
                  note: "",
                },
              ],
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({ error: "not_found" }) };
      }),
    );
    const ds = new HttpOperatorConsoleDataSource("http://127.0.0.1:8787");
    const w = await ds.listWallets();
    expect(w.summary.alpha).toBe(0);
    expect(w.items).toHaveLength(1);
    const a = await ds.listAddressLabels();
    expect(a).toHaveLength(1);
  });
});
