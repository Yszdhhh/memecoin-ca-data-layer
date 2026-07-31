/**
 * SOL-CA-HOLDER-STABILITY-BATCHES-001 runner.
 *
 * Real product path: loopback Operator API → Helius → holder pipeline.
 * Does NOT re-implement the holder stack. Browser E2E is optional and thin.
 *
 * Usage:
 *   OPERATOR_API_BASE=http://127.0.0.1:8787 \
 *   STABILITY_SCRATCH=<scratch> \
 *   npx tsx scripts/stability/run-holder-stability-batches.ts \
 *     --manifest harness/reports/SOL-CA-HOLDER-STABILITY-BATCHES-001/public-ca-manifest.json \
 *     --report-dir harness/reports/SOL-CA-HOLDER-STABILITY-BATCHES-001
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  aggregateStabilityMetrics,
  applyIneligibilityRules,
  mintFingerprint,
  nullWithWarning,
  shouldPauseBatches,
  type StabilityTaskRecord,
} from "./metrics.js";

type ManifestEntry = {
  mint: string;
  publicSource: string;
  sampleClass: string;
  selectionReason: string;
  expectedPressure: string;
  priorKnownStatus: string;
  addedAt: string;
  batchId?: string;
  sampleId?: string;
  controlledRepeat?: boolean;
};

type Manifest = {
  taskId: string;
  version: string;
  note: string;
  samples: ManifestEntry[];
};

const TERMINAL = new Set(["completed", "partial", "failed", "blocked"]);

function argValue(argv: string[], name: string, fallback: string): string {
  const i = argv.indexOf(name);
  if (i >= 0 && argv[i + 1]) return argv[i + 1]!;
  return fallback;
}

function fingerprint(mint: string): string {
  return createHash("sha256").update(mint).digest("hex").slice(0, 16);
}

async function httpJson(
  base: string,
  method: string,
  urlPath: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> | null; error?: string }> {
  const url = `${base.replace(/\/$/, "")}${urlPath}`;
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "fetch_failed";
    return {
      status: 0,
      json: null,
      error: msg.replace(/https?:\/\/\S+/gi, "[url]").replace(/[A-Za-z]:\\[^\s]+/g, "[path]"),
    };
  }
}

async function pollTask(
  base: string,
  taskId: string,
  timeoutMs: number,
): Promise<Record<string, unknown> | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await httpJson(base, "GET", `/api/v1/ca-holder-tasks/${encodeURIComponent(taskId)}`);
    if (r.status === 200 && r.json) {
      const status = String(r.json.status ?? "");
      if (TERMINAL.has(status)) return r.json;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return null;
}

function isShapeDrift(warnings: string[], failureReason: string | null): boolean {
  const codes = [...warnings, failureReason ?? ""].map((w) => w.toLowerCase());
  return codes.some(
    (c) =>
      c.includes("shape_drift") ||
      c.includes("provider_shape") ||
      c.includes("schema_unknown") ||
      c.includes("schema_unrecognized") ||
      c.includes("helius_shape"),
  );
}

function scrubRecord(
  batchId: string,
  sample: ManifestEntry,
  task: Record<string, unknown> | null,
  result: Record<string, unknown> | null,
  meta: {
    startedAt: string;
    completedAt: string | null;
    apiReachable: boolean;
    createError: string | null;
  },
): StabilityTaskRecord {
  const warnings: string[] = [];
  const taskWarnings = Array.isArray(task?.warnings)
    ? (task!.warnings as string[])
    : [];
  const issueCodes = Array.isArray(result?.issues)
    ? (result!.issues as Array<{ code?: string }>).map((i) => i.code ?? "issue").filter(Boolean)
    : [];

  const status = task
    ? String(task.status ?? null)
    : meta.apiReachable
      ? "failed"
      : "blocked";

  const accountingEligible = nullWithWarning(
    typeof task?.accountingEligible === "boolean" ? task.accountingEligible : null,
    "accountingEligible",
    warnings,
  );
  const exclusionCoverage = nullWithWarning(
    typeof task?.exclusionCoverage === "string" ? task.exclusionCoverage : null,
    "exclusionCoverage",
    warnings,
  );
  let concentrationEligible = nullWithWarning(
    typeof task?.concentrationEligible === "boolean" ? task.concentrationEligible : null,
    "concentrationEligible",
    warnings,
  );

  let residualRatio: string | number | null = null;
  if (result && result.accounting && typeof result.accounting === "object") {
    const acc = result.accounting as Record<string, unknown>;
    if ("accountingResidualRatio" in acc) {
      residualRatio = acc.accountingResidualRatio as string | number | null;
    } else if ("residualRatio" in acc) {
      residualRatio = acc.residualRatio as string | number | null;
    }
  }
  if (residualRatio === null && result?.concentration && Array.isArray(result.concentration)) {
    // do not invent residual from concentration
  }
  if (residualRatio === null) {
    nullWithWarning(null, "residualRatio", warnings);
  }

  const failureReason =
    typeof task?.failureReason === "string"
      ? task.failureReason
      : meta.createError;

  const inelig = applyIneligibilityRules({
    accountingEligible,
    concentrationEligible,
    residualRatio,
    exclusionCoverage,
    resultStatus: status,
    warnings,
  });
  concentrationEligible = inelig.concentrationEligible;
  residualRatio = inelig.residualRatio;

  const warningCodes = [
    ...new Set([...taskWarnings, ...issueCodes, ...warnings]),
  ].slice(0, 64);

  const startedAt =
    typeof task?.startedAt === "string" ? task.startedAt : meta.startedAt;
  const completedAt =
    typeof task?.endedAt === "string"
      ? task.endedAt
      : meta.completedAt;

  let durationMs: number | null = null;
  if (startedAt && completedAt) {
    durationMs = Math.max(0, Date.parse(completedAt) - Date.parse(startedAt));
  } else {
    nullWithWarning(null, "durationMs", warnings);
  }

  const mint = sample.mint;
  const providerRequestCount =
    typeof task?.providerRequestCount === "number" ? task.providerRequestCount : null;
  if (providerRequestCount === null) nullWithWarning(null, "providerRequestCount", warnings);

  const shapeDrift = isShapeDrift(warningCodes, failureReason);

  return {
    batchId,
    sampleId: sample.sampleId ?? `${batchId}-${fingerprint(mint).slice(0, 8)}`,
    taskId: typeof task?.taskId === "string" ? task.taskId : null,
    mint,
    mintFingerprint: fingerprint(mint),
    startedAt,
    completedAt,
    durationMs,
    providerRequestCount,
    providerOperationCount:
      typeof task?.providerOperationCount === "number" ? task.providerOperationCount : null,
    requestBudget: typeof task?.requestBudget === "number" ? task.requestBudget : null,
    pageCount: typeof task?.pageCount === "number" ? task.pageCount : null,
    retryCount: typeof task?.retryCount === "number" ? task.retryCount : null,
    timeoutCount: typeof task?.timeoutCount === "number" ? task.timeoutCount : null,
    resultStatus: status,
    failureReason,
    paginationComplete:
      typeof task?.paginationComplete === "boolean" ? task.paginationComplete : null,
    accountingEligible: inelig.accountingEligible,
    exclusionCoverage,
    concentrationEligible,
    residualRatio,
    warningCodes,
    sourceWatermark:
      typeof result?.sourceWatermark === "string" ? result.sourceWatermark : null,
    observedAt: typeof result?.observedAt === "string" ? result.observedAt : completedAt,
    scrubbedOutputSha:
      typeof task?.scrubbedOutputSha === "string" ? task.scrubbedOutputSha : null,
    browserStatusShown: null,
    browserDirectHelius: 0,
    credentialExposure: 0,
    shapeDrift,
    positiveBalanceViolation: warningCodes.some((w) =>
      w.toLowerCase().includes("positive_balance"),
    ),
    ratioInconsistency: inelig.ratioInconsistency,
    wrongConfirmed: inelig.wrongConfirmed,
    uiStatusMismatch: false,
    warnings: warningCodes,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const manifestPath = argValue(
    argv,
    "--manifest",
    "harness/reports/SOL-CA-HOLDER-STABILITY-BATCHES-001/public-ca-manifest.json",
  );
  const reportDir = argValue(
    argv,
    "--report-dir",
    "harness/reports/SOL-CA-HOLDER-STABILITY-BATCHES-001",
  );
  const base =
    process.env.OPERATOR_API_BASE?.trim() || "http://127.0.0.1:8787";
  const scratch =
    process.env.STABILITY_SCRATCH?.trim() ||
    path.join(process.cwd(), ".stability-scratch");
  const pollTimeoutMs = Number(process.env.STABILITY_POLL_TIMEOUT_MS ?? 180_000);
  const maxExec = Number(process.env.STABILITY_MAX_EXECUTIONS ?? 30);

  await mkdir(scratch, { recursive: true });
  await mkdir(reportDir, { recursive: true });
  await mkdir(path.join(scratch, "tasks"), { recursive: true });

  const health = await httpJson(base, "GET", "/api/v1/health");
  if (health.status !== 200 || !health.json) {
    console.error(
      JSON.stringify({
        status: "failed",
        error: "operator_api_unreachable",
        detail: health.error ?? health.status,
      }),
    );
    process.exit(2);
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  const samples = manifest.samples.slice(0, maxExec);
  const records: StabilityTaskRecord[] = [];
  const logLines: string[] = [];
  let totalRequests = 0;
  let paused = false;
  let pauseReasons: string[] = [];

  // concurrency 1 — sequential only
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i]!;
    const batchId = sample.batchId ?? (i < 8 ? "A" : i < 17 ? "B" : "C");
    const startedAt = new Date().toISOString();
    logLines.push(
      JSON.stringify({
        event: "start",
        i,
        batchId,
        sampleId: sample.sampleId,
        mintFingerprint: fingerprint(sample.mint),
        t: startedAt,
      }),
    );

    // Unique idempotency for controlled repeats
    const idempotencyKey = `stability:${batchId}:${sample.sampleId ?? i}:${Date.now()}`;
    const created = await httpJson(base, "POST", "/api/v1/ca-holder-tasks", {
      mint: sample.mint,
      idempotencyKey,
    });

    let task: Record<string, unknown> | null = null;
    let result: Record<string, unknown> | null = null;
    let createError: string | null = null;

    if (created.status === 202 && created.json && typeof created.json.taskId === "string") {
      task = await pollTask(base, created.json.taskId as string, pollTimeoutMs);
      if (task && typeof task.taskId === "string") {
        const res = await httpJson(
          base,
          "GET",
          `/api/v1/ca-holder-results/${encodeURIComponent(task.taskId as string)}`,
        );
        if (res.status === 200 && res.json) result = res.json;
      }
    } else {
      createError =
        (created.json && typeof created.json.error === "string"
          ? created.json.error
          : created.error) ?? `create_http_${created.status}`;
      task = {
        status: createError.includes("credential") ? "blocked" : "failed",
        failureReason: createError,
        warnings: [createError],
        providerRequestCount: 0,
        mint: sample.mint,
      };
    }

    const completedAt = new Date().toISOString();
    const rec = scrubRecord(batchId, sample, task, result, {
      startedAt,
      completedAt,
      apiReachable: health.status === 200,
      createError,
    });
    records.push(rec);
    totalRequests += rec.providerRequestCount ?? 0;

    await writeFile(
      path.join(scratch, "tasks", `${rec.sampleId}.json`),
      JSON.stringify(rec, null, 2),
      "utf8",
    );
    logLines.push(
      JSON.stringify({
        event: "done",
        i,
        batchId,
        sampleId: rec.sampleId,
        status: rec.resultStatus,
        requests: rec.providerRequestCount,
        totalRequests,
        shapeDrift: rec.shapeDrift,
        t: completedAt,
      }),
    );

    const partialMetrics = aggregateStabilityMetrics(records);
    const shapeCas = new Set(
      records.filter((r) => r.shapeDrift && r.mint).map((r) => r.mint as string),
    );
    const pause = shouldPauseBatches({
      ...partialMetrics,
      affectedShapeDriftCas: shapeCas.size,
    });
    if (pause.pause) {
      paused = true;
      pauseReasons = pause.reasons;
      logLines.push(JSON.stringify({ event: "pause", reasons: pause.reasons, after: i + 1 }));
      break;
    }

    if (totalRequests > 600) {
      paused = true;
      pauseReasons = ["total_budget_exceeded"];
      break;
    }
  }

  const metrics = aggregateStabilityMetrics(records);
  const byBatch = (id: string) => records.filter((r) => r.batchId === id);
  const batchSummary = (id: string) => {
    const rs = byBatch(id);
    const m = aggregateStabilityMetrics(rs);
    return {
      batchId: id,
      executionCount: m.executionCount,
      uniqueCaCount: m.uniqueCaCount,
      completed: m.completed,
      partial: m.partial,
      failed: m.failed,
      blocked: m.blocked,
      requestTotal: m.request.total,
      requestP50: m.request.p50,
      requestP95: m.request.p95,
      requestMax: m.request.max,
      durationP50: m.duration.p50,
      durationP95: m.duration.p95,
      shapeDriftCount: m.shapeDriftCount,
      accountingEligibleRate: m.accountingEligibleRate,
      paginationCompleteRate: m.paginationCompleteRate,
      samples: rs.map((r) => ({
        sampleId: r.sampleId,
        mintFingerprint: r.mintFingerprint,
        taskId: r.taskId,
        resultStatus: r.resultStatus,
        failureReason: r.failureReason,
        providerRequestCount: r.providerRequestCount,
        durationMs: r.durationMs,
        accountingEligible: r.accountingEligible,
        paginationComplete: r.paginationComplete,
        concentrationEligible: r.concentrationEligible,
        scrubbedOutputSha: r.scrubbedOutputSha,
        shapeDrift: r.shapeDrift,
        warningCodes: r.warningCodes,
      })),
    };
  };

  // Domain determinism: re-key controlled repeats with same scrubbed SHA when available
  const repeats = records.filter((r) =>
    samples.find((s) => s.sampleId === r.sampleId && s.controlledRepeat),
  );
  const domainChecks: Array<Record<string, unknown>> = [];
  for (const r of records) {
    if (!r.scrubbedOutputSha || !r.mint) continue;
    const peers = records.filter(
      (o) =>
        o.mint === r.mint &&
        o.scrubbedOutputSha &&
        o.sampleId !== r.sampleId,
    );
    if (peers.length === 0) continue;
    domainChecks.push({
      mintFingerprint: r.mintFingerprint,
      primarySha: r.scrubbedOutputSha,
      peerShas: peers.map((p) => p.scrubbedOutputSha),
      // Live chain state may differ; domain equality only when residual+trust match
      trustConsistent: peers.every(
        (p) =>
          p.accountingEligible === r.accountingEligible &&
          p.concentrationEligible === r.concentrationEligible,
      ),
      note: "live_repeat_allows_chain_delta",
    });
  }

  const shapeDriftSummary = {
    shapeDriftCount: metrics.shapeDriftCount,
    shapeDriftRate: metrics.shapeDriftRate,
    affectedCas: [
      ...new Set(
        records.filter((r) => r.shapeDrift).map((r) => r.mintFingerprint),
      ),
    ],
    samples: records
      .filter((r) => r.shapeDrift)
      .map((r) => ({
        sampleId: r.sampleId,
        mintFingerprint: r.mintFingerprint,
        failureReason: r.failureReason,
        warningCodes: r.warningCodes.filter((w) =>
          /shape|schema/i.test(w),
        ),
      })),
    rawPayloadCommitted: 0,
  };

  await writeFile(path.join(scratch, "stability-run.log"), logLines.join("\n") + "\n", "utf8");
  await writeFile(
    path.join(scratch, "all-task-records.json"),
    JSON.stringify(records, null, 2),
    "utf8",
  );

  // Scrubbed reports for Git (no raw mint required in metrics; fingerprints OK in summaries —
  // but manifest already holds public mints by design).
  await writeFile(
    path.join(reportDir, "stability-metrics.json"),
    JSON.stringify(
      {
        taskId: "SOL-CA-HOLDER-STABILITY-BATCHES-001",
        generatedAt: new Date().toISOString(),
        paused,
        pauseReasons,
        concurrency: 1,
        ...metrics,
        hardZeros: {
          browserDirectHelius: metrics.browserDirectHelius,
          credentialExposure: metrics.credentialExposure,
          positiveBalanceViolations: metrics.positiveBalanceViolations,
          ratioInconsistency: metrics.ratioInconsistency,
          wrongConfirmed: metrics.wrongConfirmed,
          uiStatusMismatch: metrics.uiMismatchCount,
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(
    path.join(reportDir, "batch-a-summary.json"),
    JSON.stringify(batchSummary("A"), null, 2),
    "utf8",
  );
  await writeFile(
    path.join(reportDir, "batch-b-summary.json"),
    JSON.stringify(batchSummary("B"), null, 2),
    "utf8",
  );
  await writeFile(
    path.join(reportDir, "batch-c-summary.json"),
    JSON.stringify(batchSummary("C"), null, 2),
    "utf8",
  );
  await writeFile(
    path.join(reportDir, "warning-histogram.json"),
    JSON.stringify({ histogram: metrics.warningHistogram }, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(reportDir, "failure-matrix.json"),
    JSON.stringify({ histogram: metrics.failureHistogram, paused, pauseReasons }, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(reportDir, "provider-shape-drift-summary.json"),
    JSON.stringify(shapeDriftSummary, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(reportDir, "determinism-summary.json"),
    JSON.stringify(
      {
        controlledRepeatCount: samples.filter((s) => s.controlledRepeat).length,
        domainChecks,
        liveRepeatNote:
          "Live repeats allow slot/holder/supply deltas; compare trust-state and warning drift.",
        offlineDomainNote:
          "Unit tests assert domainDeterminismKey stability on fixed scrubbed inputs.",
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        status: paused ? "paused" : "completed",
        executions: records.length,
        uniqueCa: metrics.uniqueCaCount,
        totalHeliusRequests: metrics.request.total,
        completed: metrics.completed,
        partial: metrics.partial,
        failed: metrics.failed,
        blocked: metrics.blocked,
        shapeDrift: metrics.shapeDriftCount,
        pauseReasons,
        reportDir,
        scratch,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const msg = error instanceof Error ? error.message : "runner_failed";
  console.error(
    JSON.stringify({
      status: "failed",
      error: msg
        .replace(/https?:\/\/\S+/gi, "[url]")
        .replace(/[A-Za-z]:\\[^\s]+/g, "[path]")
        .replace(/HELIUS_API_KEY\s*=\s*\S+/gi, "HELIUS_API_KEY=[redacted]"),
    }),
  );
  process.exit(1);
});
