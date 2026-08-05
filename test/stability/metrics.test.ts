import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateStabilityMetrics,
  applyIneligibilityRules,
  domainDeterminismKey,
  nullWithWarning,
  shouldPauseBatches,
  type StabilityTaskRecord,
} from "../../scripts/stability/metrics.js";

function baseRec(over: Partial<StabilityTaskRecord> = {}): StabilityTaskRecord {
  return {
    batchId: "A",
    sampleId: "s1",
    taskId: "t1",
    mint: "MintA111111111111111111111111111111111",
    mintFingerprint: "abc",
    startedAt: "2026-08-01T00:00:00.000Z",
    completedAt: "2026-08-01T00:00:01.000Z",
    durationMs: 1000,
    providerRequestCount: 5,
    providerOperationCount: 3,
    requestBudget: 20,
    pageCount: 2,
    retryCount: 0,
    timeoutCount: 0,
    resultStatus: "completed",
    failureReason: null,
    paginationComplete: true,
    accountingEligible: true,
    exclusionCoverage: "partial",
    concentrationEligible: false,
    residualRatio: "0",
    warningCodes: ["pool_exclusion_coverage_incomplete"],
    sourceWatermark: "helius|1|complete|x",
    observedAt: "2026-08-01T00:00:01.000Z",
    scrubbedOutputSha: "deadbeef",
    browserStatusShown: null,
    browserDirectHelius: 0,
    credentialExposure: 0,
    shapeDrift: false,
    positiveBalanceViolation: false,
    ratioInconsistency: false,
    wrongConfirmed: false,
    uiStatusMismatch: false,
    warnings: ["pool_exclusion_coverage_incomplete"],
    ...over,
  };
}

describe("stability metrics — fail-closed null handling", () => {
  it("nullWithWarning records field_unavailable and returns null", () => {
    const warnings: string[] = [];
    const v = nullWithWarning(undefined, "residualRatio", warnings);
    assert.equal(v, null);
    assert.ok(warnings.includes("field_unavailable:residualRatio"));
  });

  it("does not invent zero for missing values", () => {
    const warnings: string[] = [];
    assert.equal(nullWithWarning(null, "durationMs", warnings), null);
    assert.notEqual(nullWithWarning(null, "durationMs", warnings), 0);
  });
});

describe("stability metrics — ineligibility rules", () => {
  it("accounting ineligible forces concentration ineligible", () => {
    const warnings: string[] = [];
    const out = applyIneligibilityRules({
      accountingEligible: false,
      concentrationEligible: true,
      residualRatio: 0.1,
      exclusionCoverage: "complete",
      resultStatus: "partial",
      warnings,
    });
    assert.equal(out.concentrationEligible, false);
    assert.equal(out.wrongConfirmed, true);
  });

  it("partial exclusion cannot yield confirmed concentration", () => {
    const warnings: string[] = [];
    const out = applyIneligibilityRules({
      accountingEligible: true,
      concentrationEligible: true,
      residualRatio: 0.05,
      exclusionCoverage: "partial",
      resultStatus: "completed",
      warnings,
    });
    assert.equal(out.concentrationEligible, false);
    assert.equal(out.wrongConfirmed, true);
  });

  it("concentration ratio is nulled (not 0%) when ineligible; residual 0 stays valid", () => {
    const warnings: string[] = [];
    const out = applyIneligibilityRules({
      accountingEligible: true,
      concentrationEligible: false,
      residualRatio: 0,
      concentrationRatio: 0,
      exclusionCoverage: "partial",
      resultStatus: "completed",
      warnings,
    });
    assert.equal(out.residualRatio, 0);
    assert.equal(out.concentrationRatio, null);
    assert.equal(out.ratioInconsistency, true);
  });

  it("real residual 0 with no concentration ratio is not inconsistency", () => {
    const warnings: string[] = [];
    const out = applyIneligibilityRules({
      accountingEligible: true,
      concentrationEligible: false,
      residualRatio: 0,
      concentrationRatio: null,
      exclusionCoverage: "partial",
      resultStatus: "completed",
      warnings,
    });
    assert.equal(out.residualRatio, 0);
    assert.equal(out.ratioInconsistency, false);
  });
});

describe("stability metrics — aggregation drives real helpers", () => {
  it("aggregates execution counts and request totals from records", () => {
    const records = [
      baseRec({ sampleId: "a", mint: "MintA", providerRequestCount: 4, resultStatus: "completed" }),
      baseRec({
        sampleId: "b",
        mint: "MintB",
        providerRequestCount: 6,
        resultStatus: "partial",
        durationMs: 2000,
      }),
      baseRec({
        sampleId: "c",
        mint: "MintA",
        providerRequestCount: 5,
        resultStatus: "completed",
        shapeDrift: true,
      }),
    ];
    const m = aggregateStabilityMetrics(records);
    assert.equal(m.executionCount, 3);
    assert.equal(m.uniqueCaCount, 2);
    assert.equal(m.completed, 2);
    assert.equal(m.partial, 1);
    assert.equal(m.request.total, 15);
    assert.equal(m.request.min, 4);
    assert.equal(m.request.max, 6);
    assert.equal(m.shapeDriftCount, 1);
    assert.equal(m.browserDirectHelius, 0);
    assert.equal(m.credentialExposure, 0);
  });

  it("hard zeros stay zero when all records clean", () => {
    const m = aggregateStabilityMetrics([baseRec(), baseRec({ sampleId: "x2", mint: "MintX" })]);
    assert.equal(m.browserDirectHelius, 0);
    assert.equal(m.credentialExposure, 0);
    assert.equal(m.positiveBalanceViolations, 0);
    assert.equal(m.wrongConfirmed, 0);
    assert.equal(m.uiMismatchCount, 0);
  });
});

describe("stability metrics — domain determinism key", () => {
  it("same scrubbed normalized input yields same key regardless of warning order", () => {
    const a = domainDeterminismKey({
      mint: "MintA",
      status: "completed",
      accountingEligible: true,
      exclusionCoverage: "partial",
      concentrationEligible: false,
      residual: "0",
      warningCodes: ["b_warn", "a_warn"],
    });
    const b = domainDeterminismKey({
      mint: "MintA",
      status: "completed",
      accountingEligible: true,
      exclusionCoverage: "partial",
      concentrationEligible: false,
      residual: "0",
      warningCodes: ["a_warn", "b_warn"],
    });
    assert.equal(a, b);
  });

  it("trust state change changes key", () => {
    const a = domainDeterminismKey({
      mint: "MintA",
      status: "completed",
      accountingEligible: true,
      exclusionCoverage: "partial",
      concentrationEligible: false,
      residual: "0",
      warningCodes: [],
    });
    const b = domainDeterminismKey({
      mint: "MintA",
      status: "partial",
      accountingEligible: false,
      exclusionCoverage: "partial",
      concentrationEligible: false,
      residual: null,
      warningCodes: [],
    });
    assert.notEqual(a, b);
  });
});

describe("stability metrics — pause rules", () => {
  it("pauses when hard shape drift rate exceeds 10%", () => {
    const pause = shouldPauseBatches({
      shapeDriftCount: 3,
      hardShapeDriftCount: 2,
      executionCount: 10,
      positiveBalanceViolations: 0,
      ratioInconsistency: 0,
      wrongConfirmed: 0,
      credentialExposure: 0,
      request: { total: 50, max: 8 },
      affectedHardShapeDriftCas: 2,
    });
    assert.equal(pause.pause, true);
    assert.ok(pause.reasons.includes("hard_shape_drift_rate_gt_10pct"));
  });

  it("does not pause on soft partial_skip-only shape drift measurement", () => {
    const pause = shouldPauseBatches({
      shapeDriftCount: 3,
      hardShapeDriftCount: 0,
      executionCount: 14,
      positiveBalanceViolations: 0,
      ratioInconsistency: 0,
      wrongConfirmed: 0,
      credentialExposure: 0,
      request: { total: 100, max: 10 },
      affectedHardShapeDriftCas: 0,
      affectedShapeDriftCas: 3,
    });
    assert.equal(pause.pause, false);
  });

  it("does not pause on clean run", () => {
    const pause = shouldPauseBatches({
      shapeDriftCount: 0,
      hardShapeDriftCount: 0,
      executionCount: 20,
      positiveBalanceViolations: 0,
      ratioInconsistency: 0,
      wrongConfirmed: 0,
      credentialExposure: 0,
      request: { total: 100, max: 10 },
      affectedShapeDriftCas: 0,
    });
    assert.equal(pause.pause, false);
  });
});
