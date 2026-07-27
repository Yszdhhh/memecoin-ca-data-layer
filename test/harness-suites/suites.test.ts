import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { runHotPathParallel, runHotPathSerial, runLatencySuite } from "../../src/harness-suites/latency.js";
import { deriveReplayOutput, runReplaySuite } from "../../src/harness-suites/replay.js";
import { analyzeWithDegradation, runSourceDegradationSuite } from "../../src/harness-suites/source-degradation.js";
import { measureFpFn, predictLabels, runLabelDecisionSuite } from "../../src/harness-suites/label-decision.js";
import { VirtualClock } from "../../src/harness-suites/shared.js";

test("virtual clock latency: parallel = max, serial = sum", () => {
  const sources = [
    { name: "a", latency_ms: 100 },
    { name: "b", latency_ms: 400 },
    { name: "c", latency_ms: 250 },
  ];
  assert.equal(runHotPathParallel(sources, new VirtualClock()).elapsed_ms, 400);
  assert.equal(runHotPathSerial(sources, new VirtualClock()).elapsed_ms, 750);
});

test("latency suite passes budget on fixture cases and writes report", async () => {
  const runDir = await mkdtemp(path.join(tmpdir(), "suite-latency-"));
  const report = await runLatencySuite({ runDir });
  assert.equal(report.status, "PASS", report.failures.join("; "));
  const raw = await readFile(path.join(runDir, "suite-latency.json"), "utf8");
  assert.ok(raw.includes("\"suite\": \"latency\""));
});

test("replay derives golden fields and is deterministic", async () => {
  const report = await runReplaySuite();
  assert.equal(report.status, "PASS", report.failures.join("; "));
  const timeline = {
    schema_version: "replay-timeline@1",
    token_ca: "x",
    parser_version: "obs-parser@1",
    rule_version: { real_holders: "v1" },
    observations: [
      {
        kind: "holder_concentration",
        owners: [
          { owner: "a", balance_raw: "1", excluded: false },
          { owner: "p", balance_raw: "9", excluded: true, reason: "liquidity_pool", rule_version: "v1" },
        ],
      },
      { kind: "wallet_signal", smart_money: ["a"], clusters: [] },
      { kind: "security", mint_authority: "revoked", freeze_authority: "revoked", lp_burned: "unknown" },
    ],
  };
  assert.deepEqual(deriveReplayOutput(timeline as never), deriveReplayOutput(timeline as never));
});

test("source degradation never fakes concentration from borrowed data", async () => {
  const degraded = analyzeWithDegradation("helius_holders", "timeout");
  assert.equal(degraded.crashed, false);
  assert.equal(degraded.holderConcentration, null);
  assert.equal(degraded.holderCompleteness, "unavailable");
  assert.equal(degraded.usedBorrowedForAuthoritativeConcentration, false);
  assert.ok(degraded.completeness < 1);

  const report = await runSourceDegradationSuite();
  assert.equal(report.status, "PASS", report.failures.join("; "));
});

test("label-decision FP/FN within versioned tolerance", async () => {
  const pred = predictLabels({ same_funder: true, sync_buy: true, service_funder: false });
  assert.equal(pred.cluster_fusion, true);
  const { fp, fn } = measureFpFn(
    [{ labels: { cluster_fusion: true, bot_sniper: false, independent_smart_money: false }, pred }],
    "cluster_fusion",
  );
  assert.equal(fp, 0);
  assert.equal(fn, 0);

  const report = await runLabelDecisionSuite();
  assert.equal(report.status, "PASS", report.failures.join("; "));
  assert.equal(report.metrics.tolerance_version, "label-tolerance@1");
});
