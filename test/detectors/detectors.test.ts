import assert from "node:assert/strict";
import test from "node:test";
import {
  HOLDER_EXCLUSION_CLUSTER_THRESHOLD,
  scoreClusterFusion,
} from "../../src/domain/rules/cluster-fusion.js";
import { scoreBotSniper, slotEarliness } from "../../src/domain/rules/bot-sniper.js";
import { scoreIndependentSmartMoney } from "../../src/domain/rules/independent-smart-money.js";
import { evaluateWalletForensics } from "../../src/domain/rules/forensic-signals.js";
import { detectFundingClusters } from "../../src/domain/rules/funding-clusters.js";

test("cluster-fusion never lowers the 0.85 exclusion gate constant", () => {
  assert.equal(HOLDER_EXCLUSION_CLUSTER_THRESHOLD, 0.85);
  const seed = {
    address: "a",
    clusterId: "c1",
    confidence: 0.9,
    evidence: { funder: "f" },
  };
  const strong = scoreClusterFusion(seed, {
    fBlock: 1,
    fCosell: 1,
    fXtoken: 1,
    fDevlink: 0.2,
  });
  assert.equal(strong.eligibleForHolderExclusion, true);
  assert.ok(strong.C >= 0.85);

  // High C but weak seed cannot authorize exclusion
  const weakSeed = scoreClusterFusion(
    { ...seed, confidence: 0.7 },
    { fFund: 0.95, fBlock: 1, fCosell: 1, fXtoken: 1, fDevlink: 0.5 },
  );
  assert.equal(weakSeed.eligibleForHolderExclusion, false);
});

test("cluster-fusion does not fire on Tier-B-only external labels", () => {
  const seed = {
    address: "a",
    clusterId: "c1",
    confidence: 0.2,
    evidence: {},
  };
  const onlyExt = scoreClusterFusion(seed, {
    fFund: 0.1,
    fBlock: 0,
    fCosell: 0,
    fXtoken: 0,
    fDevlink: 0,
    fExt: 1,
  });
  assert.ok(onlyExt.C < 0.7);
  assert.equal(onlyExt.riskTier, "none");
});

test("funding-clusters service-funder suppression still works (untouched gate)", () => {
  const base = new Date("2026-01-01T00:00:00Z");
  const result = detectFundingClusters(
    ["a", "b"].map((recipient, index) => ({
      chain: "solana" as const,
      funder: "cex",
      recipient,
      amountNativeRaw: 1n,
      fundedAt: new Date(base.getTime() + index * 1000),
      recipientFirstSeenAt: base,
    })),
    ["a", "b"].map((buyer, index) => ({
      buyer,
      boughtAt: new Date(base.getTime() + 30_000 + index * 1000),
      amountRaw: 10n,
      txHash: `tx-${index}`,
    })),
    {
      funderTags: [{
        chain: "solana",
        address: "cex",
        role: "exchange",
        source: "system",
        confidence: 0.95,
      }],
    },
  );
  assert.equal(result.members.length, 0);
  assert.equal(result.suppressedFunders.length, 1);
});

test("bot-sniper requires multi-address or dual high core features", () => {
  const loneEarly = scoreBotSniper({
    fSlot: 1,
    fFreq: 0.2,
    fHold: 0.2,
    fDist: 0,
  });
  assert.equal(loneEarly.isSniper, false);
  assert.equal(loneEarly.isBotPattern, false);

  const distributed = scoreBotSniper({
    fSlot: 0.9,
    fFreq: 0.9,
    fHold: 0.9,
    fDist: 0.8,
  });
  assert.equal(distributed.isSniper, true);
  assert.ok(distributed.S >= 0.75);

  assert.equal(slotEarliness(0), 1);
  assert.equal(slotEarliness(150), 0);
});

test("independent smart money hard-vetoes cluster and sniper", () => {
  const cleanCluster = scoreClusterFusion(null, {
    fFund: 0.2,
    fBlock: 0.1,
    fCosell: 0.1,
    fXtoken: 0.1,
    fDevlink: 0,
  });
  const noSniper = scoreBotSniper({ fSlot: 0.1, fFreq: 0.1, fHold: 0.1, fDist: 0 });
  const good = scoreIndependentSmartMoney(
    {
      fProfit: 0.95,
      fSellIndep: 0.9,
      fMultitoken: 1,
      profitableTokenCount: 5,
      pnlTierA: true,
    },
    cleanCluster,
    noSniper,
  );
  assert.equal(good.certified, true);

  const clustered = scoreClusterFusion(
    { address: "x", clusterId: "c", confidence: 0.9, evidence: {} },
    { fFund: 0.9, fBlock: 0.9, fCosell: 0.9, fXtoken: 0.9, fDevlink: 0.5 },
  );
  assert.ok(clustered.C >= 0.85);
  const vetoed = scoreIndependentSmartMoney(
    {
      fProfit: 0.99,
      fSellIndep: 0.99,
      fMultitoken: 1,
      profitableTokenCount: 10,
      pnlTierA: true,
    },
    clustered,
    noSniper,
  );
  assert.equal(vetoed.I, 0);
  assert.equal(vetoed.certified, false);
  assert.equal(vetoed.vetoReason, "cluster_veto");
});

test("forensic compose attaches all three signals", () => {
  const signals = evaluateWalletForensics({
    seed: null,
    clusterFeatures: { fFund: 0.2, fBlock: 0.1, fCosell: 0, fXtoken: 0, fDevlink: 0 },
    sniperFeatures: { fSlot: 0.1, fFreq: 0.1, fHold: 0.1, fDist: 0 },
    independenceFeatures: {
      fProfit: 0.5,
      fSellIndep: 0.5,
      fMultitoken: 0.5,
      profitableTokenCount: 4,
      pnlTierA: false,
    },
  });
  assert.ok(signals.clusterSignal.ruleVersion.includes("cluster-fusion"));
  assert.ok(signals.sniperSignal.ruleVersion.includes("bot-sniper"));
  assert.ok(signals.independenceSignal.ruleVersion.includes("independent-smart-money"));
  assert.equal(signals.independenceSignal.certified, false);
});
