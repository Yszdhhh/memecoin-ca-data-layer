import { describe, expect, it } from "vitest";
import {
  describeResultPresence,
  describeTaskTerminalState,
  mapPublicResultToCaScan,
  mapPublicTaskToViewModel,
  type PublicResultSummary,
  type PublicTaskSummary,
} from "./live-api-map";
import { formatRatio } from "../lib/format";

function baseTask(over: Partial<PublicTaskSummary> = {}): PublicTaskSummary {
  return {
    taskId: "t1",
    mint: "Mint111111111111111111111111111111111111111",
    status: "completed",
    requestBudget: 20,
    requestsUsed: 6,
    providerRequestCount: 6,
    providerBudgetExhausted: false,
    startedAt: "2026-07-31T00:00:00.000Z",
    endedAt: "2026-07-31T00:01:00.000Z",
    warnings: [],
    failureReason: null,
    ...over,
  };
}

function baseResult(over: Partial<PublicResultSummary> = {}): PublicResultSummary {
  return {
    taskId: "t1",
    mint: "Mint111111111111111111111111111111111111111",
    status: "OK",
    accountingEligible: true,
    exclusionCoverage: "partial",
    concentrationEligible: false,
    accounting: {
      mintSupplyRaw: "1000",
      enumeratedTokenAccountBalanceRaw: "1000",
      includedOwnerBalanceRaw: "900",
      excludedBalanceRaw: "100",
      unresolvedBalanceRaw: "0",
      accountingResidualRaw: "0",
      accountingResidualRatio: 0,
      completeness: "complete",
      paginationComplete: true,
      residualReasons: [],
      identity: "pilot",
    },
    ownerCounts: { total: 10, included: 8, excluded: 2, unresolved: 0, tokenAccounts: 10 },
    concentration: [
      {
        name: "top10",
        numerator: "100",
        denominator: "900",
        ratio: 0.111,
        verificationStatus: "unverified",
      },
    ],
    issues: [],
    providerRequestCount: 6,
    heliusRequestCount: 6,
    paginationComplete: true,
    sourceWatermark: "helius:live:abc",
    ...over,
  };
}

describe("describeTaskTerminalState", () => {
  it("maps completed", () => {
    const s = describeTaskTerminalState(baseTask({ status: "completed" }));
    expect(s.kind).toBe("completed");
    expect(s.severity).toBe("ok");
  });

  it("maps budget_exhausted to partial (not failed)", () => {
    const s = describeTaskTerminalState(
      baseTask({
        status: "partial",
        providerBudgetExhausted: true,
        warnings: ["request_budget_exhausted"],
        failureReason: "request_budget_exhausted",
      }),
    );
    expect(s.kind).toBe("budget_exhausted");
    expect(s.mapsToTaskStatus).toBe("partial");
    expect(s.severity).toBe("warn");
    expect(s.label.toLowerCase()).toContain("budget");
  });

  it("maps blocked credential", () => {
    const s = describeTaskTerminalState(
      baseTask({
        status: "blocked",
        failureReason: "credential_unavailable",
        warnings: ["credential_unavailable"],
        providerRequestCount: 0,
        requestsUsed: 0,
      }),
    );
    expect(s.kind).toBe("blocked_credential");
    expect(s.mapsToTaskStatus).toBe("blocked");
  });

  it("maps timeout", () => {
    const s = describeTaskTerminalState(
      baseTask({ status: "failed", failureReason: "timeout", warnings: ["timeout"] }),
    );
    expect(s.kind).toBe("timeout");
  });

  it("maps schema error", () => {
    const s = describeTaskTerminalState(
      baseTask({ status: "failed", warnings: ["schema_error"], failureReason: "schema_error" }),
    );
    expect(s.kind).toBe("schema_error");
  });

  it("maps queued and running", () => {
    expect(describeTaskTerminalState(baseTask({ status: "queued" })).kind).toBe("queued");
    expect(describeTaskTerminalState(baseTask({ status: "running" })).kind).toBe("running");
  });
});

describe("mapPublicResultToCaScan", () => {
  it("keeps concentration ratio null when not eligible (never 0)", () => {
    const scan = mapPublicResultToCaScan(baseResult({ concentrationEligible: false }));
    expect(scan.concentrationEligible).toBe(false);
    expect(scan.concentration.top10?.ratio).toBeNull();
    expect(scan.concentration.top10?.verificationStatus).toBe("unverified");
    expect(formatRatio(scan.concentration.top10?.ratio)).toBe("暂不可确认");
    expect(formatRatio(scan.concentration.top10?.ratio)).not.toBe("0.00%");
  });

  it("preserves confirmed ratio only when concentrationEligible", () => {
    const scan = mapPublicResultToCaScan(
      baseResult({
        concentrationEligible: true,
        concentration: [
          {
            name: "top10",
            numerator: "100",
            denominator: "900",
            ratio: 0.1111,
            verificationStatus: "confirmed",
          },
        ],
      }),
    );
    expect(scan.concentration.top10?.ratio).toBeCloseTo(0.1111);
    expect(scan.concentration.top10?.verificationStatus).toBe("confirmed");
  });

  it("tags Live watermark and operator-api dataSource", () => {
    const scan = mapPublicResultToCaScan(baseResult({ sourceWatermark: "helius:live:xyz" }));
    expect(scan.dataSource).toBe("operator-api-live");
    expect(scan.sourceWatermark).toBe("helius:live:xyz");
    expect(scan.provider).toBe("helius");
  });

  it("splits accounting vs exclusion vs concentration", () => {
    const scan = mapPublicResultToCaScan(
      baseResult({
        accountingEligible: true,
        exclusionCoverage: "partial",
        concentrationEligible: false,
      }),
    );
    expect(scan.accountingEligible).toBe(true);
    expect(scan.exclusionCoverage).toBe("partial");
    expect(scan.concentrationEligible).toBe(false);
  });
});

describe("mapPublicTaskToViewModel", () => {
  it("links output to /ca/:mint without embedding credentials", () => {
    const vm = mapPublicTaskToViewModel(baseTask({ mint: "AbcMint" }));
    expect(vm.outputLink).toBe("/ca/AbcMint");
    expect(JSON.stringify(vm)).not.toMatch(/helius_api_key|apiKey/i);
    expect(vm.provider).toBe("operator-api-helius");
  });
});

describe("describeResultPresence", () => {
  it("empty when no result", () => {
    expect(describeResultPresence(null, baseTask({ status: "completed" }))).toBe("empty");
  });

  it("ready when result present and fresh", () => {
    expect(describeResultPresence(baseResult(), baseTask())).toBe("ready");
  });

  it("stale when ended >24h ago", () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(describeResultPresence(baseResult(), baseTask({ endedAt: old }))).toBe("stale");
  });
});
