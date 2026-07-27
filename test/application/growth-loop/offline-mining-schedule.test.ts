import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryAddressLibrary } from "../../../src/application/sedimentation/address-library.js";
import type { DailyMiningDeps } from "../../../src/application/growth-loop/daily-toptoken-mining.js";
import {
  OFFLINE_MINING_SCHEDULE_RULE_VERSION,
  planOfflineMiningJobs,
  runOfflineMiningSchedule,
} from "../../../src/application/growth-loop/offline-mining-schedule.js";

function deps(calls: string[]): DailyMiningDeps {
  return {
    topTokens: {
      async getTopTokens(window) {
        calls.push(window);
        return [];
      },
    },
    borrowedLeaderboard: {
      name: "gmgn",
      async getTokenLeaderboard() {
        throw new Error("leaderboard should not be requested without fixture tokens");
      },
    },
    judgment: {
      async evaluate() {
        throw new Error("judgment should not be requested without fixture tokens");
      },
    },
    firstHand: {
      async getWalletSwaps() {
        throw new Error("first-hand source should not be requested without fixture tokens");
      },
    },
    library: new InMemoryAddressLibrary(),
  };
}

const baseConfig = {
  topTokenLimit: 10,
  maxBorrowedLeadsPerToken: 10,
  firstHandWalletBudget: 2,
  minimumJudgmentConfidence: 0.8,
  minimumRealizedPnlMicroUsd: 100_000_000n,
};

test("offline schedule uses canonical UTC daily slots and only adds weekly on Monday", () => {
  const sunday = planOfflineMiningJobs(new Date("2026-07-26T20:13:00.000Z"));
  assert.deepEqual(sunday.map((job) => [job.window, job.runAt.toISOString()]), [
    ["daily", "2026-07-26T00:00:00.000Z"],
  ]);

  const monday = planOfflineMiningJobs(new Date("2026-07-27T20:13:00.000Z"));
  assert.deepEqual(monday.map((job) => [job.window, job.runAt.toISOString()]), [
    ["daily", "2026-07-27T00:00:00.000Z"],
    ["weekly", "2026-07-27T00:00:00.000Z"],
  ]);
  assert.deepEqual(planOfflineMiningJobs(new Date("2026-07-27T00:00:00.000Z")), monday);
});

test("offline schedule is manually invoked and runs daily then weekly without a background trigger", async () => {
  const calls: string[] = [];
  const triggeredAt = new Date("2026-07-27T20:13:00.000Z");
  const result = await runOfflineMiningSchedule(deps(calls), { ...baseConfig, triggeredAt });

  assert.equal(result.scheduleRuleVersion, OFFLINE_MINING_SCHEDULE_RULE_VERSION);
  assert.equal(result.mode, "manual_offline");
  assert.equal(result.triggeredAt.getTime(), triggeredAt.getTime());
  assert.deepEqual(calls, ["daily", "weekly"]);
  assert.deepEqual(result.reports.map((report) => [report.window, report.runAt.toISOString(), report.status]), [
    ["daily", "2026-07-27T00:00:00.000Z", "GREEN"],
    ["weekly", "2026-07-27T00:00:00.000Z", "GREEN"],
  ]);
});

test("offline schedule rejects invalid manual trigger times", () => {
  assert.throws(() => planOfflineMiningJobs(new Date("invalid")), /triggeredAt/);
});