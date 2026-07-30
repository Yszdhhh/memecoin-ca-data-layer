import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import {
  evaluateWalletDataQuality,
  calculateBorrowedCandidateScores,
  WALLET_DATA_QUALITY_RULE_VERSION,
  GmgnPeriodStatsInput,
} from "../../../src/domain/rules/wallet-data-quality.js";
import {
  buildWalletIntelligenceMasterTable,
  computeSha256,
  computeFingerprint,
} from "../../../src/application/wallet-intelligence/master-table-builder.js";

const WALLET_MASTER_OUTPUT_FIELD_ALLOWLIST = [
  "walletAddress",
  "walletFingerprint",
  "chain",
  "sourceOrder",
  "addressValidationStatus",
  "existingLabels",
  "existingNote",
  "existingLabelSource",
  "sourceInputFingerprint",
  "sourceAddressesSha256",
  "sourceLabelsSha256",
  "gmgn7dStatus",
  "gmgn7dCompleteness",
  "gmgn7dRealizedProfit",
  "gmgn7dRealizedProfitPnl",
  "gmgn7dWinRate",
  "gmgn7dBuyCount",
  "gmgn7dSellCount",
  "gmgn7dBoughtCost",
  "gmgn7dSoldIncome",
  "gmgn7dTokenNum",
  "gmgn7dLastActiveTimestamp",
  "gmgn7dWarningCodes",
  "gmgn7dFetchedAt",
  "gmgn30dStatus",
  "gmgn30dCompleteness",
  "gmgn30dRealizedProfit",
  "gmgn30dRealizedProfitPnl",
  "gmgn30dWinRate",
  "gmgn30dBuyCount",
  "gmgn30dSellCount",
  "gmgn30dBoughtCost",
  "gmgn30dSoldIncome",
  "gmgn30dTokenNum",
  "gmgn30dLastActiveTimestamp",
  "gmgn30dWarningCodes",
  "gmgn30dFetchedAt",
  "activityCount7d",
  "activityCount30d",
  "avgTradesPerActiveDay7d",
  "avgTradesPerActiveDay30d",
  "buySellImbalance7d",
  "buySellImbalance30d",
  "capitalTurnover7d",
  "capitalTurnover30d",
  "profitPerTrade7d",
  "profitPerTrade30d",
  "profitPerToken7d",
  "profitPerToken30d",
  "incomeMinusCost7d",
  "incomeMinusCost30d",
  "profitAccountingResidual7d",
  "profitAccountingResidual30d",
  "profitGrowth7dTo30d",
  "winRateStability7dVs30d",
  "activityStability7dVs30d",
  "profitablePeriodCount",
  "dataAgeHours",
  "fieldCoverage7d",
  "fieldCoverage30d",
  "pairCoverage",
  "dataQualityScore",
  "dataQualityTier",
  "internalConsistencyScore",
  "outlierPercentile30d",
  "anomalyFlags",
  "exclusionCandidateFlags",
  "manualReviewRequired",
  "manualReviewReasons",
  "borrowedProfitabilityLeadScore",
  "borrowedActivityLeadScore",
  "borrowedConsistencyLeadScore",
  "borrowedDataQualityScore",
  "borrowedCompositeLeadScore",
  "borrowedLeadRank",
  "alphaCandidateRank",
  "reviewPriorityRank",
  "borrowedLeadTier",
  "firstHandVerificationStatus",
  "firstHandProvider",
  "firstHandCoverage",
  "verifiedSwapCount",
  "verifiedTransferCount",
  "verifiedRealizedPnlUsd30d",
  "verifiedWinRate30d",
  "verifiedActiveDays30d",
  "verifiedTokenCount30d",
  "pnlReconciliationStatus",
  "directFunder",
  "fundingSourceType",
  "fundingSourceConfidence",
  "relatedWalletClusterId",
  "botAssessment",
  "routerAssessment",
  "exchangeAssessment",
  "sybilAssessment",
  "alphaScore",
  "alphaScoreTier",
  "alphaScoreStatus",
  "finalWalletScore",
  "finalWalletGrade",
  "normalizedExistingLabels",
  "candidateTags",
  "confirmedTags",
  "riskTags",
  "analystNote",
  "reviewStatus",
] as const;

function makeSyntheticFixtureDir(): { inputDir: string; gmgnOutputDir: string; outputDir: string; cleanup: () => void } {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "sol-master-test-"));
  const inputDir = path.join(tmpBase, "input");
  const gmgnOutputDir = path.join(tmpBase, "gmgn");
  const outputDir = path.join(tmpBase, "output");

  fs.mkdirSync(inputDir, { recursive: true });
  fs.mkdirSync(gmgnOutputDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const cleanup = () => {
    try {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    } catch {}
  };

  return { inputDir, gmgnOutputDir, outputDir, cleanup };
}

function generateSyntheticAddress(index: number): string {
  const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const buf = Buffer.alloc(32);
  buf.writeUInt32BE(index, 28);
  buf[0] = (index % 250) + 1; // ensure non-zero leading byte so length is 44 or 43

  let num = BigInt("0x" + buf.toString("hex"));
  let str = "";
  while (num > 0n) {
    const rem = Number(num % 58n);
    num = num / 58n;
    str = BASE58_ALPHABET[rem] + str;
  }
  return str;
}

test("1. Address fingerprint and record deterministic association", () => {
  const addr = "AUqA1tni7ZL5iV3eMn3MGqph5encRAaYg1bvocKDLKf3";
  const fp1 = computeFingerprint(addr);
  const fp2 = computeFingerprint(addr);
  assert.equal(fp1, fp2);
  assert.equal(fp1.length, 64);
  assert.equal(fp1, crypto.createHash("sha256").update(addr).digest("hex"));
});

test("2. 7d/30d pairing and completeness evaluation", () => {
  const s7d: GmgnPeriodStatsInput = {
    status: "MAPPED",
    completeness: 1.0,
    realizedProfit: 100,
    realizedProfitPnl: 0.1,
    winRate: 60,
    buyCount: 5,
    sellCount: 5,
    boughtCost: 1000,
    soldIncome: 1100,
    tokenNum: 3,
    lastActiveTimestamp: 1700000000,
    warningCodes: [],
  };
  const s30d: GmgnPeriodStatsInput = {
    status: "MAPPED",
    completeness: 1.0,
    realizedProfit: 500,
    realizedProfitPnl: 0.2,
    winRate: 65,
    buyCount: 20,
    sellCount: 20,
    boughtCost: 4000,
    soldIncome: 4500,
    tokenNum: 10,
    lastActiveTimestamp: 1700000000,
    warningCodes: [],
  };

  const dq = evaluateWalletDataQuality(s7d, s30d);
  assert.equal(dq.pairCoverage, 1.0);
  assert.equal(dq.dataQualityTier, "DQ-A");
  assert.equal(dq.internalConsistencyScore, 100);
});

test("3. Missing values stay null, explicit 0 preserved as 0, div zero returns null", () => {
  const s7d: GmgnPeriodStatsInput = {
    status: "UNAVAILABLE",
    completeness: 0,
    realizedProfit: null,
    realizedProfitPnl: null,
    winRate: null,
    buyCount: 0,
    sellCount: 0,
    boughtCost: 0,
    soldIncome: 0,
    tokenNum: 0,
    lastActiveTimestamp: null,
    warningCodes: [],
  };
  const s30d: GmgnPeriodStatsInput = {
    status: "UNAVAILABLE",
    completeness: 0,
    realizedProfit: null,
    realizedProfitPnl: null,
    winRate: null,
    buyCount: null,
    sellCount: null,
    boughtCost: null,
    soldIncome: null,
    tokenNum: null,
    lastActiveTimestamp: null,
    warningCodes: [],
  };

  const dq = evaluateWalletDataQuality(s7d, s30d);
  assert.equal(dq.dataQualityTier, "DQ-U");

  const cand = calculateBorrowedCandidateScores(s7d, s30d, dq, 0);
  assert.equal(cand.borrowedProfitabilityLeadScore, null);
  assert.equal(cand.borrowedCompositeLeadScore, null);
  assert.equal(cand.borrowedLeadTier, "UNQUALIFIED");
});

test("4. Accounting residual is observational and partial data cannot be DQ-A", () => {
  const s7d: GmgnPeriodStatsInput = {
    status: "PARTIAL",
    completeness: 0.8,
    realizedProfit: 10000, // profit claims 10k
    realizedProfitPnl: 1.0,
    winRate: 80,
    buyCount: 10,
    sellCount: 10,
    boughtCost: 1000,
    soldIncome: 2000, // sold - bought = 1000! Residual = 9000 mismatch!
    tokenNum: 5,
    lastActiveTimestamp: 1700000000,
    warningCodes: [],
  };
  const s30d: GmgnPeriodStatsInput = {
    status: "PARTIAL",
    completeness: 0.8,
    realizedProfit: 10000,
    realizedProfitPnl: 1.0,
    winRate: 80,
    buyCount: 10,
    sellCount: 10,
    boughtCost: 1000,
    soldIncome: 2000,
    tokenNum: 5,
    lastActiveTimestamp: 1700000000,
    warningCodes: [],
  };

  const dq = evaluateWalletDataQuality(s7d, s30d);
  assert.ok(dq.anomalyFlags.some((a) => a.code.includes("ACCOUNTING_RESIDUAL_OBSERVED")));
  assert.equal(dq.internalConsistencyScore, 100);
  assert.notEqual(dq.dataQualityTier, "DQ-A");
});

test("5. Small sample high win-rate demotion and candidate tiering", () => {
  const s7d: GmgnPeriodStatsInput = {
    status: "MAPPED",
    completeness: 1.0,
    realizedProfit: 100,
    realizedProfitPnl: 0.5,
    winRate: 100, // 100% win rate
    buyCount: 1,  // but only 1 trade!
    sellCount: 1,
    boughtCost: 100,
    soldIncome: 200,
    tokenNum: 1,
    lastActiveTimestamp: 1700000000,
    warningCodes: [],
  };
  const s30d: GmgnPeriodStatsInput = {
    status: "MAPPED",
    completeness: 1.0,
    realizedProfit: 100,
    realizedProfitPnl: 0.5,
    winRate: 100,
    buyCount: 1,
    sellCount: 1,
    boughtCost: 100,
    soldIncome: 200,
    tokenNum: 1,
    lastActiveTimestamp: 1700000000,
    warningCodes: [],
  };

  const dq = evaluateWalletDataQuality(s7d, s30d);
  const cand = calculateBorrowedCandidateScores(s7d, s30d, dq, 50);

  // Small sample (2 total trades in 30d) gets low activity lead score, reducing composite lead score
  assert.ok(cand.borrowedActivityLeadScore! < 30);
  assert.notEqual(cand.borrowedLeadTier, "TOP_LEAD");
});

test("6. Candidate tags vs confirmed tags isolation & Alpha Tier prohibition", () => {
  const s7d: GmgnPeriodStatsInput = {
    status: "MAPPED",
    completeness: 1.0,
    realizedProfit: 10000,
    realizedProfitPnl: 2.0,
    winRate: 85,
    buyCount: 20,
    sellCount: 20,
    boughtCost: 5000,
    soldIncome: 15000,
    tokenNum: 10,
    lastActiveTimestamp: 1700000000,
    warningCodes: [],
  };
  const s30d: GmgnPeriodStatsInput = s7d;

  const dq = evaluateWalletDataQuality(s7d, s30d);
  const cand = calculateBorrowedCandidateScores(s7d, s30d, dq, 95);

  // Ensure borrowed composite lead score does NOT produce UR/SSR/SR/R/N
  assert.ok(cand.borrowedLeadTier === "TOP_LEAD" || cand.borrowedLeadTier === "STRONG_LEAD");
  assert.equal((cand as any).alphaScore, undefined);
  assert.equal((cand as any).alphaScoreTier, undefined);
});

test("7. Full synthetic master table builder execution", async () => {
  const fix = makeSyntheticFixtureDir();
  try {
    const addrs: string[] = [];
    const labelsObj: any[] = [];
    const gmgnProfilesObj: any[] = [];

    // Generate 1433 synthetic addresses
    for (let i = 0; i < 1433; i++) {
      const addr = generateSyntheticAddress(i + 1);
      addrs.push(addr);
      labelsObj.push({
        address: addr,
        labels: [`tag-${i}`, `tag-${i}`],
        label_primary: `primary-${i}`,
      });

      const fp = computeFingerprint(addr);
      gmgnProfilesObj.push({
        period: "7d",
        status: "MAPPED",
        source: "gmgn",
        verificationStatus: "unverified",
        completeness: 1.0,
        aggregates: {
          periodPnl: 0.1,
          realizedProfit: i * 10,
          realizedProfitPnl: 0.1,
          winRate: 60,
          tradeCount: 10,
          buyCount: 5,
          sellCount: 5,
          boughtCost: 100,
          soldIncome: 110,
          lastActiveTimestamp: 1700000000,
          tokenNum: 2,
        },
        warningCodes: [],
        requestBudgetUsed: 1,
        sourceInputFingerprint: fp,
        fetchedAt: new Date().toISOString(),
      });
      gmgnProfilesObj.push({
        period: "30d",
        status: "MAPPED",
        source: "gmgn",
        verificationStatus: "unverified",
        completeness: i === 4 ? 0.5 : i === 6 ? 0.8 : 1.0,
        aggregates: {
          periodPnl: 0.2,
          realizedProfit: i === 0 ? null : i === 1 ? 0 : i === 2 ? -50 : i === 3 ? 1000 : i * 50,
          realizedProfitPnl: 0.2,
          winRate: 65,
          tradeCount: 40,
          buyCount: 20,
          sellCount: 20,
          boughtCost: 400,
          soldIncome: i === 3 ? 0 : 450,
          lastActiveTimestamp: 1700000000,
          tokenNum: 5,
        },
        warningCodes: i === 5 ? ["gmgn_wallet_stats_partial_fields"] : [],
        requestBudgetUsed: 1,
        sourceInputFingerprint: fp,
        fetchedAt: new Date().toISOString(),
      });
      if (i === 6) gmgnProfilesObj[gmgnProfilesObj.length - 1].status = "PARTIAL";
    }

    labelsObj.push({ address: addrs[0], labels: ["tag-0", "merged-label"], label_primary: "merged-note" });
    const txtContent = [...addrs, addrs[0], addrs[10]].join("\n") + "\n";
    const jsonContent = JSON.stringify(labelsObj, null, 2);

    fs.writeFileSync(path.join(fix.inputDir, "sol_addresses.txt"), txtContent, "utf8");
    fs.writeFileSync(path.join(fix.inputDir, "sol_address_labels.json"), jsonContent, "utf8");
    fs.writeFileSync(path.join(fix.gmgnOutputDir, "normalized_wallet_profiles.json"), JSON.stringify(gmgnProfilesObj, null, 2), "utf8");
    fs.writeFileSync(path.join(fix.gmgnOutputDir, "summary.json"), JSON.stringify({ status: "SUCCESS" }), "utf8");

    const expectedTxtHash = computeSha256(txtContent);
    const expectedJsonHash = computeSha256(jsonContent);

    const duplicateProfiles = [...gmgnProfilesObj, { ...gmgnProfilesObj[0] }];
    fs.writeFileSync(path.join(fix.gmgnOutputDir, "normalized_wallet_profiles.json"), JSON.stringify(duplicateProfiles, null, 2), "utf8");
    await assert.rejects(
      buildWalletIntelligenceMasterTable({
        inputDir: fix.inputDir,
        gmgnOutputDir: fix.gmgnOutputDir,
        outputDir: fix.outputDir,
        expectedHashes: { solAddressesTxtHash: expectedTxtHash, solAddressLabelsJsonHash: expectedJsonHash },
      }),
      /Duplicate 7d record/
    );
    fs.writeFileSync(path.join(fix.gmgnOutputDir, "normalized_wallet_profiles.json"), JSON.stringify(gmgnProfilesObj, null, 2), "utf8");

    const result = await buildWalletIntelligenceMasterTable({
      inputDir: fix.inputDir,
      gmgnOutputDir: fix.gmgnOutputDir,
      outputDir: fix.outputDir,
      expectedHashes: {
        solAddressesTxtHash: expectedTxtHash,
        solAddressLabelsJsonHash: expectedJsonHash,
      },
    });

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.metrics.validUniqueWallets, 1433);
    assert.equal(result.metrics.matched7dCount, 1433);
    assert.equal(result.metrics.matched30dCount, 1433);
    assert.ok(result.metrics.candidateUnionCount <= 20);
    assert.equal(result.metrics.positiveProfitCount30d, 1430);
    assert.equal(result.metrics.zeroProfitCount30d, 1);
    assert.equal(result.metrics.negativeProfitCount30d, 1);
    assert.equal(result.metrics.unavailableProfitCount30d, 1);
    assert.equal(
      result.metrics.positiveProfitCount30d + result.metrics.zeroProfitCount30d + result.metrics.negativeProfitCount30d + result.metrics.unavailableProfitCount30d,
      1433
    );

    // Verify output files exist
    assert.ok(fs.existsSync(path.join(fix.outputDir, "wallet_master_private.csv")));
    assert.ok(fs.existsSync(path.join(fix.outputDir, "wallet_master_private.jsonl")));
    assert.ok(fs.existsSync(path.join(fix.outputDir, "wallet_identity_map.jsonl")));
    assert.ok(fs.existsSync(path.join(fix.outputDir, "candidate_shortlist.csv")));
    assert.ok(fs.existsSync(path.join(fix.outputDir, "candidate_shortlist.json")));
    assert.ok(fs.existsSync(path.join(fix.outputDir, "data_quality_summary.json")));
    assert.ok(fs.existsSync(path.join(fix.outputDir, "ranking_summary.json")));
    assert.ok(fs.existsSync(path.join(fix.outputDir, "warning_code_summary.json")));
    assert.ok(fs.existsSync(path.join(fix.outputDir, "data_dictionary.md")));
    assert.ok(fs.existsSync(path.join(fix.outputDir, "replay_manifest.json")));

    // Replay check (rerun and compare hash)
    const result2 = await buildWalletIntelligenceMasterTable({
      inputDir: fix.inputDir,
      gmgnOutputDir: fix.gmgnOutputDir,
      outputDir: fix.outputDir,
      expectedHashes: {
        solAddressesTxtHash: expectedTxtHash,
        solAddressLabelsJsonHash: expectedJsonHash,
      },
    });

    assert.equal(result.outputHashes.wallet_master_private_csv, result2.outputHashes.wallet_master_private_csv);
    assert.equal(result.outputHashes.candidate_shortlist_csv, result2.outputHashes.candidate_shortlist_csv);
    assert.equal(result.outputHashes.replay_manifest_json, result2.outputHashes.replay_manifest_json);

    const masterRows = fs.readFileSync(path.join(fix.outputDir, "wallet_master_private.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(masterRows.length, 1433);
    assert.deepEqual(masterRows.map((row) => row.walletAddress), addrs);
    assert.deepEqual(masterRows[0].existingLabels, ["tag-0", "merged-label"]);
    assert.equal(masterRows[0].existingNote, "primary-0 | merged-note");
    const allowedFields = [...WALLET_MASTER_OUTPUT_FIELD_ALLOWLIST].sort();
    for (const row of masterRows) assert.deepEqual(Object.keys(row).sort(), allowedFields);

    const unavailable = masterRows.find((row) => row.gmgn30dRealizedProfit === null);
    assert.equal(unavailable.borrowedCompositeLeadScore, null);
    assert.equal(unavailable.alphaCandidateRank, null);
    const review = masterRows.find((row) => row.manualReviewRequired);
    assert.ok(review.reviewPriorityRank !== null);
    assert.equal(review.alphaCandidateRank, null);
    const incompleteMapped = masterRows.find((row) => row.walletAddress === addrs[4]);
    assert.notEqual(incompleteMapped.dataQualityTier, "DQ-A");
    assert.equal(incompleteMapped.alphaCandidateRank, null);
    assert.ok(incompleteMapped.anomalyFlags.includes("MAPPED_COMPLETENESS_INCONSISTENT_30D"));
    const partialFields = masterRows.find((row) => row.walletAddress === addrs[5]);
    assert.notEqual(partialFields.dataQualityTier, "DQ-A");
    assert.equal(partialFields.alphaCandidateRank, null);
    const partial = masterRows.find((row) => row.walletAddress === addrs[6]);
    assert.notEqual(partial.borrowedCompositeLeadScore, null);
    assert.equal(partial.alphaCandidateRank, null);

    const shortlist = JSON.parse(fs.readFileSync(path.join(fix.outputDir, "candidate_shortlist.json"), "utf8"));
    assert.ok(shortlist.candidate_union.every((row: any) => row.shortlistType === "ALPHA_CANDIDATE"));
    assert.ok(shortlist.review_priority_union.every((row: any) => row.shortlistType === "REVIEW_PRIORITY"));
    const alphaAddresses = new Set(shortlist.candidate_union.map((row: any) => row.walletAddress));
    assert.ok(shortlist.review_priority_union.every((row: any) => !alphaAddresses.has(row.walletAddress)));
  } finally {
    fix.cleanup();
  }
});


test("8. Invalid-address diagnostics redact the raw input", async () => {
  const fix = makeSyntheticFixtureDir();
  try {
    const secretInvalidValue = "not-a-solana-address-secret";
    const txtContent = `${secretInvalidValue}\n`;
    const jsonContent = "[]";
    fs.writeFileSync(path.join(fix.inputDir, "sol_addresses.txt"), txtContent, "utf8");
    fs.writeFileSync(path.join(fix.inputDir, "sol_address_labels.json"), jsonContent, "utf8");
    fs.writeFileSync(path.join(fix.gmgnOutputDir, "normalized_wallet_profiles.json"), "[]", "utf8");
    fs.writeFileSync(path.join(fix.gmgnOutputDir, "summary.json"), "{}", "utf8");

    await assert.rejects(
      buildWalletIntelligenceMasterTable({
        inputDir: fix.inputDir,
        gmgnOutputDir: fix.gmgnOutputDir,
        outputDir: fix.outputDir,
        expectedHashes: {
          solAddressesTxtHash: computeSha256(txtContent),
          solAddressLabelsJsonHash: computeSha256(jsonContent),
        },
      }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.match(message, /raw value redacted/);
        assert.equal(message.includes(secretInvalidValue), false);
        return true;
      }
    );
  } finally {
    fix.cleanup();
  }
});
