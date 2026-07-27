import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryAddressLibrary } from "../../../src/application/sedimentation/address-library.js";
import {
  FixtureTopTokenProvider,
  runDailyTopTokenMining,
  type FirstHandConfirmationProvider,
  type TopTradedToken,
  type WalletJudgmentEngine,
} from "../../../src/application/growth-loop/daily-toptoken-mining.js";
import {
  FixtureBorrowedLeaderboardProvider,
  type BorrowedProfitLead,
  type FirstHandSwap,
} from "../../../src/application/leaderboard/token-profit-leaderboard.js";

const at = new Date("2026-07-27T00:00:00.000Z");
const tokenA = "MintAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const tokenB = "MintBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

function top(tokenId: string, tokenCa: string, rank: number): TopTradedToken {
  return {
    tokenId,
    tokenCa,
    rank,
    source: "fixture",
    origin: "borrowed",
    verificationStatus: "unverified",
    observedAt: at,
  };
}

const judgment: WalletJudgmentEngine = {
  async evaluate(_token, lead) {
    return {
      walletAddress: lead.walletAddress,
      promotionEligible: true,
      confidence: 0.9,
      labels: lead.walletAddress.endsWith("1")
        ? ["independent_smart_money", "alpha_SSR"]
        : ["cluster_suspected"],
      alphaScore: 82,
      alphaStatus: "provisional",
      ruleVersions: {
        alpha: "alpha-score-v1",
        cluster: "cluster-fusion-v1",
        sniper: "bot-sniper-v1",
        independentSmartMoney: "independent-smart-money-v1",
      },
      evidence: { fixture: lead.walletAddress },
      warnings: [],
    };
  },
};

function walletSwaps(tokenCa: string, walletAddress: string): FirstHandSwap[] {
  return [
    {
      tokenCa,
      walletAddress,
      side: "buy",
      tokenAmountRaw: 100n,
      quoteAmountMicroUsd: 100_000_000n,
      signature: `${tokenCa}:${walletAddress}:buy`,
      eventIndex: 0,
      blockTime: at,
    },
    {
      tokenCa,
      walletAddress,
      side: "sell",
      tokenAmountRaw: 100n,
      quoteAmountMicroUsd: 250_000_000n,
      signature: `${tokenCa}:${walletAddress}:sell`,
      eventIndex: 0,
      blockTime: new Date(at.getTime() + 60_000),
    },
  ];
}

const firstHand: FirstHandConfirmationProvider = {
  async getWalletSwaps(tokenCa, walletAddresses) {
    return walletAddresses.flatMap((wallet) => walletSwaps(tokenCa, wallet));
  },
};

function deps(library: InMemoryAddressLibrary) {
  return {
    topTokens: new FixtureTopTokenProvider({
      daily: [top("token-a", tokenA, 1), top("token-b", tokenB, 2)],
      weekly: [top("token-b", tokenB, 1)],
    }),
    borrowedLeaderboard: new FixtureBorrowedLeaderboardProvider("gmgn", {
      [tokenA]: [
        { walletAddress: "wallet-1", realizedPnlUsd: 500, roiPct: 100, rank: 1 },
        { walletAddress: "wallet-2", realizedPnlUsd: 300, roiPct: 80, rank: 2 },
      ],
      [tokenB]: [
        { walletAddress: "wallet-3", realizedPnlUsd: 200, roiPct: 60, rank: 1 },
      ],
    }, at),
    judgment,
    firstHand,
    library,
  };
}

const config = {
  window: "daily" as const,
  topTokenLimit: 10,
  maxBorrowedLeadsPerToken: 10,
  firstHandWalletBudget: 2,
  minimumJudgmentConfidence: 0.8,
  minimumRealizedPnlMicroUsd: 100_000_000n,
  runAt: at,
};

test("daily mining is deterministic, promotes only confirmed wallets, and reports quota skips", async () => {
  const library = new InMemoryAddressLibrary();
  const first = await runDailyTopTokenMining(deps(library), config);
  assert.equal(first.tokensScanned, 2);
  assert.equal(first.walletsMined, 3);
  assert.equal(first.confirmationsAttempted, 2);
  assert.equal(first.walletsPromoted, 2);
  assert.equal(first.quota.consumed, 2);
  assert.deepEqual(first.quota.skippedWallets, ["wallet-3"]);
  assert.ok(first.warnings.some((warning) => warning.includes("first_hand_quota_exhausted")));
  assert.equal((await library.getWallet("solana", "wallet-1"))?.verificationStatus, "verified");
  assert.equal(await library.getWallet("solana", "wallet-3"), null);

  const second = await runDailyTopTokenMining(deps(new InMemoryAddressLibrary()), config);
  assert.deepEqual(second, first);
});

test("provider degradation yields a partial report and never fabricates promotions", async () => {
  const library = new InMemoryAddressLibrary();
  const report = await runDailyTopTokenMining({
    ...deps(library),
    borrowedLeaderboard: {
      name: "gmgn" as const,
      async getTokenLeaderboard() {
        throw new Error("down");
      },
    },
  }, { ...config, topTokenLimit: 1 });
  assert.equal(report.status, "DEGRADED");
  assert.equal(report.walletsMined, 0);
  assert.equal(report.walletsPromoted, 0);
  assert.equal(report.quota.consumed, 0);
});

test("a failed first-hand provider keeps borrowed candidates out of the verified library", async () => {
  const library = new InMemoryAddressLibrary();
  const report = await runDailyTopTokenMining({
    ...deps(library),
    firstHand: {
      async getWalletSwaps() {
        throw new Error("helius fixture unavailable");
      },
    },
  }, { ...config, topTokenLimit: 1, firstHandWalletBudget: 1 });
  assert.equal(report.walletsPromoted, 0);
  assert.equal(await library.getWallet("solana", "wallet-1"), null);
  assert.ok(report.warnings.some((warning) => warning.includes("first_hand_confirmation_unavailable")));
});

test("invalid borrowed provider contracts are discarded and reported", async () => {
  const invalidTopToken = {
    ...top("token-a", tokenA, 1),
    verificationStatus: "verified",
  } as unknown as TopTradedToken;
  const topLibrary = new InMemoryAddressLibrary();
  const topReport = await runDailyTopTokenMining({
    ...deps(topLibrary),
    topTokens: {
      async getTopTokens() {
        return [invalidTopToken];
      },
    },
  }, config);
  assert.equal(topReport.tokensScanned, 0);
  assert.equal(topReport.walletsPromoted, 0);
  assert.ok(topReport.warnings.includes(`invalid_top_token_contract:${tokenA}`));

  const invalidLead = {
    tokenCa: tokenA,
    walletAddress: "wallet-invalid",
    realizedPnlUsd: 1_000,
    roiPct: 200,
    rank: 1,
    source: "gmgn",
    origin: "borrowed",
    verificationStatus: "verified",
    observedAt: at,
    warnings: [],
  } as unknown as BorrowedProfitLead;
  const leadLibrary = new InMemoryAddressLibrary();
  const leadReport = await runDailyTopTokenMining({
    ...deps(leadLibrary),
    topTokens: new FixtureTopTokenProvider({ daily: [top("token-a", tokenA, 1)], weekly: [] }),
    borrowedLeaderboard: {
      name: "gmgn",
      async getTokenLeaderboard() {
        return [invalidLead];
      },
    },
  }, { ...config, topTokenLimit: 1 });
  assert.equal(leadReport.walletsMined, 0);
  assert.equal(leadReport.walletsPromoted, 0);
  assert.ok(leadReport.warnings.includes(`${tokenA}:invalid_borrowed_leaderboard_contract:1`));
});

test("configured report store receives the completed structured report", async () => {
  const library = new InMemoryAddressLibrary();
  const saved: Array<{ window: string; tokenReports: number; warnings: string[] }> = [];
  const report = await runDailyTopTokenMining({
    ...deps(library),
    reportStore: {
      async save(candidate) {
        saved.push({
          window: candidate.window,
          tokenReports: candidate.tokenReports.length,
          warnings: [...candidate.warnings],
        });
      },
    },
  }, config);

  assert.deepEqual(saved, [{
    window: "daily",
    tokenReports: 2,
    warnings: report.warnings,
  }]);
});

test("report persistence failure degrades the run without discarding computed evidence", async () => {
  const library = new InMemoryAddressLibrary();
  const report = await runDailyTopTokenMining({
    ...deps(library),
    reportStore: {
      async save() {
        throw new Error("offline store unavailable");
      },
    },
  }, { ...config, topTokenLimit: 1, firstHandWalletBudget: 1 });

  assert.equal(report.status, "DEGRADED");
  assert.ok(report.warnings.includes("mining_report_persistence_failed"));
  assert.equal(report.walletsPromoted, 1);
  assert.equal((await library.getWallet("solana", "wallet-1"))?.verificationStatus, "verified");
});
