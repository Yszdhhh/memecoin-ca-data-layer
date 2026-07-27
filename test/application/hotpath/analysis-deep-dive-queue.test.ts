import assert from "node:assert/strict";
import test from "node:test";
import type { AnalysisResult } from "../../../src/domain/types.js";
import { AnalysisServiceDeepDiveQueue } from "../../../src/application/hotpath/analysis-deep-dive-queue.js";

const ca = "Mint111111111111111111111111111111111111111";

test("hotpath queue deduplicates and defers AnalysisService deep analysis until drain", async () => {
  const calls: Array<{ ca: string; chainHint: string | undefined }> = [];
  const queue = new AnalysisServiceDeepDiveQueue({
    async getDeepAnalysis(tokenCa, options) {
      calls.push({ ca: tokenCa, chainHint: options?.chainHint });
      return {} as AnalysisResult;
    },
  });
  await queue.enqueue(ca);
  await queue.enqueue(ca);
  assert.equal(queue.size(), 1);
  assert.equal(calls.length, 0);

  const report = await queue.drainAll();
  assert.deepEqual(report.processed, [ca]);
  assert.deepEqual(report.failed, []);
  assert.deepEqual(calls, [{ ca, chainHint: "solana" }]);
  assert.equal(queue.size(), 0);
});

test("hotpath queue isolates deep-analysis failures", async () => {
  const queue = new AnalysisServiceDeepDiveQueue({
    async getDeepAnalysis() {
      throw new Error("fixture deep analysis failed");
    },
  });
  await queue.enqueue(ca);
  const report = await queue.drainAll();
  assert.deepEqual(report.processed, []);
  assert.equal(report.failed[0]?.tokenCa, ca);
  assert.match(report.failed[0]?.reason ?? "", /fixture deep analysis failed/);
});
