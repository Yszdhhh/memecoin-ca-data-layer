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
  assert.equal(result.status, "GREEN");
  assert.equal(result.triggeredAt.getTime(), triggeredAt.getTime());
  assert.notStrictEqual(result.triggeredAt, triggeredAt);
  assert.deepEqual(calls, ["daily", "weekly"]);
  assert.deepEqual(result.reports.map((report) => [report.window, report.runAt.toISOString(), report.status]), [
    ["daily", "2026-07-27T00:00:00.000Z", "GREEN"],
    ["weekly", "2026-07-27T00:00:00.000Z", "GREEN"],
  ]);
  assert.ok(result.jobs[0]);
  assert.ok(result.reports[0]);
  result.triggeredAt.setTime(0);
  result.jobs[0].runAt.setTime(0);
  assert.equal(triggeredAt.toISOString(), "2026-07-27T20:13:00.000Z");
  assert.equal(result.reports[0].runAt.toISOString(), "2026-07-27T00:00:00.000Z");
});

test("offline schedule degrades an isolated daily failure and still runs the Monday weekly job", async () => {
  const calls: string[] = [];
  const library = new InMemoryAddressLibrary();
  library.upsertWallet = async () => {
    throw new Error("fixture write failed");
  };
  const result = await runOfflineMiningSchedule({
    topTokens: {
      async getTopTokens(window) {
        calls.push(window);
        return window === "daily" ? [{
          tokenId: "token-a",
          tokenCa: "MintAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          rank: 1,
          source: "fixture" as const,
          origin: "borrowed" as const,
          verificationStatus: "unverified" as const,
          observedAt: new Date("2026-07-27T00:00:00.000Z"),
        }] : [];
      },
    },
    borrowedLeaderboard: {
      name: "gmgn",
      async getTokenLeaderboard(tokenCa) {
        return [{
          tokenCa,
          walletAddress: "wallet-1",
          realizedPnlUsd: 500,
          roiPct: 100,
          rank: 1,
          source: "gmgn" as const,
          origin: "borrowed" as const,
          verificationStatus: "unverified" as const,
          observedAt: new Date("2026-07-27T00:00:00.000Z"),
          warnings: [],
        }];
      },
    },
    judgment: {
      async evaluate(_token, lead) {
        return {
          walletAddress: lead.walletAddress,
          promotionEligible: true,
          confidence: 1,
          labels: [],
          alphaScore: null,
          alphaStatus: "insufficient" as const,
          ruleVersions: { alpha: "fixture", cluster: "fixture", sniper: "fixture", independentSmartMoney: "fixture" },
          evidence: {},
          warnings: [],
        };
      },
    },
    firstHand: {
      async getWalletSwaps(tokenCa, wallets) {
        return wallets.flatMap((wallet) => [
          { tokenCa, walletAddress: wallet, side: "buy" as const, tokenAmountRaw: 100n, quoteAmountMicroUsd: 100_000_000n, signature: "buy", eventIndex: 0, blockTime: new Date("2026-07-27T00:00:00.000Z") },
          { tokenCa, walletAddress: wallet, side: "sell" as const, tokenAmountRaw: 100n, quoteAmountMicroUsd: 250_000_000n, signature: "sell", eventIndex: 0, blockTime: new Date("2026-07-27T00:01:00.000Z") },
        ]);
      },
    },
    library,
  }, { ...baseConfig, triggeredAt: new Date("2026-07-27T20:13:00.000Z") });

  assert.deepEqual(calls, ["daily", "weekly"]);
  assert.equal(result.status, "DEGRADED");
  assert.deepEqual(result.failedJobs.map((job) => job.window), ["daily"]);
  assert.deepEqual(result.warnings, ["daily_mining_failed"]);
  assert.deepEqual(result.reports.map((report) => report.window), ["weekly"]);
});

test("offline schedule rejects invalid manual trigger times", () => {
  assert.throws(() => planOfflineMiningJobs(new Date("invalid")), /triggeredAt/);
});