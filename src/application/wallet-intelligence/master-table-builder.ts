import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { normalizeSolanaAddress } from "../../domain/solana-address.js";
import {
  evaluateWalletDataQuality,
  calculateBorrowedCandidateScores,
  WALLET_DATA_QUALITY_RULE_VERSION,
  DataQualityTier,
  GmgnPeriodStatsInput,
  BorrowedCandidateScores,
  WalletDataQualityAssessment,
} from "../../domain/rules/wallet-data-quality.js";

export const MASTER_CLEAN_RANK_TASK_ID = "SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-001";
export const EXPECTED_SOL_ADDRESSES_HASH = "64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C";
export const EXPECTED_SOL_LABELS_HASH = "B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3";

export interface MasterTableBuilderOptions {
  inputDir: string;
  gmgnOutputDir: string;
  outputDir: string;
  evalTimeMs?: number;
  expectedHashes?: {
    solAddressesTxtHash?: string;
    solAddressLabelsJsonHash?: string;
  };
}

export interface WalletMasterRecord {
  // A. Identity & Source
  walletAddress: string;
  walletFingerprint: string;
  chain: "solana";
  sourceOrder: number;
  addressValidationStatus: "VALID";
  existingLabels: string[];
  existingNote: string;
  existingLabelSource: "chainfm_import";
  sourceInputFingerprint: string;
  sourceAddressesSha256: string;
  sourceLabelsSha256: string;

  // B. GMGN 7d Borrowed Data
  gmgn7dStatus: "MAPPED" | "PARTIAL" | "UNAVAILABLE" | "ABSENT";
  gmgn7dCompleteness: number | null;
  gmgn7dRealizedProfit: number | null;
  gmgn7dRealizedProfitPnl: number | null;
  gmgn7dWinRate: number | null;
  gmgn7dBuyCount: number | null;
  gmgn7dSellCount: number | null;
  gmgn7dBoughtCost: number | null;
  gmgn7dSoldIncome: number | null;
  gmgn7dTokenNum: number | null;
  gmgn7dLastActiveTimestamp: number | null;
  gmgn7dWarningCodes: string[];
  gmgn7dFetchedAt: string | null;

  // C. GMGN 30d Borrowed Data
  gmgn30dStatus: "MAPPED" | "PARTIAL" | "UNAVAILABLE" | "ABSENT";
  gmgn30dCompleteness: number | null;
  gmgn30dRealizedProfit: number | null;
  gmgn30dRealizedProfitPnl: number | null;
  gmgn30dWinRate: number | null;
  gmgn30dBuyCount: number | null;
  gmgn30dSellCount: number | null;
  gmgn30dBoughtCost: number | null;
  gmgn30dSoldIncome: number | null;
  gmgn30dTokenNum: number | null;
  gmgn30dLastActiveTimestamp: number | null;
  gmgn30dWarningCodes: string[];
  gmgn30dFetchedAt: string | null;

  // D. Derived Fields
  activityCount7d: number | null;
  activityCount30d: number | null;
  avgTradesPerActiveDay7d: number | null;
  avgTradesPerActiveDay30d: number | null;
  buySellImbalance7d: number | null;
  buySellImbalance30d: number | null;
  capitalTurnover7d: number | null;
  capitalTurnover30d: number | null;
  profitPerTrade7d: number | null;
  profitPerTrade30d: number | null;
  profitPerToken7d: number | null;
  profitPerToken30d: number | null;
  incomeMinusCost7d: number | null;
  incomeMinusCost30d: number | null;
  profitAccountingResidual7d: number | null;
  profitAccountingResidual30d: number | null;
  profitGrowth7dTo30d: number | null;
  winRateStability7dVs30d: number | null;
  activityStability7dVs30d: number | null;
  profitablePeriodCount: number | null;
  dataAgeHours: number | null;

  // E. Quality & Anomalies
  fieldCoverage7d: number;
  fieldCoverage30d: number;
  pairCoverage: number;
  dataQualityScore: number;
  dataQualityTier: DataQualityTier;
  internalConsistencyScore: number;
  outlierPercentile30d: number;
  anomalyFlags: string[];
  exclusionCandidateFlags: string[];
  manualReviewRequired: boolean;
  manualReviewReasons: string[];

  // F. Borrowed Candidate Scores
  borrowedProfitabilityLeadScore: number | null;
  borrowedActivityLeadScore: number | null;
  borrowedConsistencyLeadScore: number | null;
  borrowedDataQualityScore: number;
  borrowedCompositeLeadScore: number | null;
  borrowedLeadRank: number | null;
  alphaCandidateRank: number | null;
  reviewPriorityRank: number | null;
  borrowedLeadTier: BorrowedCandidateScores["borrowedLeadTier"];

  // G. First-Hand Verification Placeholders (ALL NULL)
  firstHandVerificationStatus: null;
  firstHandProvider: null;
  firstHandCoverage: null;
  verifiedSwapCount: null;
  verifiedTransferCount: null;
  verifiedRealizedPnlUsd30d: null;
  verifiedWinRate30d: null;
  verifiedActiveDays30d: null;
  verifiedTokenCount30d: null;
  pnlReconciliationStatus: null;
  directFunder: null;
  fundingSourceType: null;
  fundingSourceConfidence: null;
  relatedWalletClusterId: null;
  botAssessment: null;
  routerAssessment: null;
  exchangeAssessment: null;
  sybilAssessment: null;
  alphaScore: null;
  alphaScoreTier: null;
  alphaScoreStatus: null;
  finalWalletScore: null;
  finalWalletGrade: null;

  // H. Notes & Tags
  normalizedExistingLabels: string[];
  candidateTags: string[];
  confirmedTags: [];
  riskTags: string[];
  analystNote: string;
  reviewStatus: "UNVERIFIED_CANDIDATE";
}

export interface CandidateShortlistEntry {
  shortlistType: "ALPHA_CANDIDATE" | "REVIEW_PRIORITY";
  candidateGroup: string;
  groupRank: number;
  walletAddress: string;
  walletFingerprint: string;
  existingLabels: string[];
  existingNote: string;
  candidateTags: string[];
  gmgn7dRealizedProfit: number | null;
  gmgn30dRealizedProfit: number | null;
  gmgn7dWinRate: number | null;
  gmgn30dWinRate: number | null;
  activityCount7d: number | null;
  activityCount30d: number | null;
  gmgn7dTokenNum: number | null;
  gmgn30dTokenNum: number | null;
  pairCoverage: number;
  dataQualityScore: number;
  dataQualityTier: DataQualityTier;
  internalConsistencyScore: number;
  borrowedCompositeLeadScore: number | null;
  anomalyFlags: string[];
  candidateReasonCodes: string[];
  firstHandVerificationStatus: null;
  analystNote: string;
}

export interface MasterTableBuilderResult {
  status: "SUCCESS" | "FAIL_CLOSED";
  inputHashes: {
    solAddressesTxt: string;
    solAddressLabelsJson: string;
    gmgnNormalizedProfiles: string;
    gmgnSummary: string;
  };
  metrics: {
    totalInputAddresses: number;
    validUniqueWallets: number;
    matched7dCount: number;
    matched30dCount: number;
    dataQualityTierDistribution: Record<DataQualityTier, number>;
    positiveProfitCount30d: number;
    zeroProfitCount30d: number;
    negativeProfitCount30d: number;
    unavailableProfitCount30d: number;
    candidateUnionCount: number;
    reviewPriorityUnionCount: number;
  };
  outputFiles: Record<string, string>;
  outputHashes: Record<string, string>;
}

export function computeSha256(content: Buffer | string): string {
  return crypto.createHash("sha256").update(content).digest("hex").toUpperCase();
}

export function computeFingerprint(addr: string): string {
  return crypto.createHash("sha256").update(addr).digest("hex");
}

export async function buildWalletIntelligenceMasterTable(
  options: MasterTableBuilderOptions
): Promise<MasterTableBuilderResult> {
  const { inputDir, gmgnOutputDir, outputDir, evalTimeMs: requestedEvalTimeMs, expectedHashes } = options;

  const txtPath = path.join(inputDir, "sol_addresses.txt");
  const jsonPath = path.join(inputDir, "sol_address_labels.json");
  const gmgnProfilesPath = path.join(gmgnOutputDir, "normalized_wallet_profiles.json");
  const gmgnSummaryPath = path.join(gmgnOutputDir, "summary.json");

  // Fail-closed check if any file missing
  if (
    !fs.existsSync(txtPath) ||
    !fs.existsSync(jsonPath) ||
    !fs.existsSync(gmgnProfilesPath) ||
    !fs.existsSync(gmgnSummaryPath)
  ) {
    throw new Error("Required input files are missing");
  }

  const solAddressesTxtHash = computeSha256(fs.readFileSync(txtPath));
  const solAddressLabelsJsonHash = computeSha256(fs.readFileSync(jsonPath));
  const gmgnNormalizedProfilesHash = computeSha256(fs.readFileSync(gmgnProfilesPath));
  const gmgnSummaryHash = computeSha256(fs.readFileSync(gmgnSummaryPath));

  const expectedTxt = expectedHashes?.solAddressesTxtHash ?? EXPECTED_SOL_ADDRESSES_HASH;
  const expectedJson = expectedHashes?.solAddressLabelsJsonHash ?? EXPECTED_SOL_LABELS_HASH;

  if (solAddressesTxtHash !== expectedTxt || solAddressLabelsJsonHash !== expectedJson) {
    throw new Error("Input manifest SHA-256 hash mismatch");
  }

  // Read sol_addresses.txt preserving exact valid unique address order
  const txtLines = fs.readFileSync(txtPath, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const validUniqueAddresses: string[] = [];
  const seenAddresses = new Set<string>();

  for (const line of txtLines) {
    const norm = normalizeSolanaAddress(line);
    if (!norm) {
      throw new Error(`Invalid Base58 Solana address at non-empty input line ${validUniqueAddresses.length + 1}; raw value redacted`);
    }
    if (!seenAddresses.has(norm)) {
      seenAddresses.add(norm);
      validUniqueAddresses.push(norm);
    }
  }

  if (validUniqueAddresses.length !== 1433) {
    throw new Error(`Expected exactly 1,433 valid unique addresses, got ${validUniqueAddresses.length}`);
  }

  // Read sol_address_labels.json
  const rawLabels = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const labelMap = new Map<string, { labels: string[]; note: string }>();

  if (Array.isArray(rawLabels)) {
    for (const item of rawLabels) {
      if (item && typeof item === "object") {
        const norm = normalizeSolanaAddress(item.address);
        if (norm) {
          const labelsArr: string[] = Array.isArray(item.labels)
            ? item.labels.map(String)
            : typeof item.labels_joined === "string"
            ? item.labels_joined.split("|").map((s: string) => s.trim())
            : [];
          const noteStr = typeof item.label_primary === "string" ? item.label_primary.trim() : "";
          const existing = labelMap.get(norm) ?? { labels: [], note: "" };
          const labels = Array.from(new Set([...existing.labels, ...labelsArr.filter(Boolean)]));
          const notes = Array.from(new Set([existing.note, noteStr].filter(Boolean)));
          labelMap.set(norm, { labels, note: notes.join(" | ") });
        }
      }
    }
  }

  // Read GMGN normalized profiles
  const rawProfiles = JSON.parse(fs.readFileSync(gmgnProfilesPath, "utf8"));
  if (!Array.isArray(rawProfiles)) {
    throw new Error("normalized_wallet_profiles.json must contain an array");
  }

  const deterministicInputTimeMs = rawProfiles.reduce((latest: number, record: any) => {
    const parsed = typeof record?.fetchedAt === "string" ? Date.parse(record.fetchedAt) : Number.NaN;
    return Number.isFinite(parsed) ? Math.max(latest, parsed) : latest;
  }, 0);
  const evalTimeMs = requestedEvalTimeMs ?? deterministicInputTimeMs;

  const profiles7d = new Map<string, any>();
  const profiles30d = new Map<string, any>();

  for (const record of rawProfiles) {
    const fp = record.sourceInputFingerprint;
    if (!fp) continue;
    if (record.period === "7d") {
      if (profiles7d.has(fp)) throw new Error(`Duplicate 7d record for fingerprint ${fp}`);
      profiles7d.set(fp, record);
    } else if (record.period === "30d") {
      if (profiles30d.has(fp)) throw new Error(`Duplicate 30d record for fingerprint ${fp}`);
      profiles30d.set(fp, record);
    }
  }

  // Calculate 30d profit percentiles for population
  const p30Values: number[] = [];
  for (const addr of validUniqueAddresses) {
    const fp = computeFingerprint(addr);
    const rec30 = profiles30d.get(fp);
    const profit = rec30?.aggregates?.realizedProfit;
    if (profit !== null && profit !== undefined && Number.isFinite(profit)) {
      p30Values.push(profit);
    }
  }
  p30Values.sort((a, b) => a - b);

  const getPercentile = (val: number | null): number => {
    if (val === null || p30Values.length === 0) return 0;
    let count = 0;
    for (const v of p30Values) {
      if (v <= val) count++;
    }
    return Math.round((count / p30Values.length) * 100 * 100) / 100;
  };

  const records: WalletMasterRecord[] = [];
  const warningCodeCounts: Record<string, number> = {};

  for (let i = 0; i < validUniqueAddresses.length; i++) {
    const walletAddress = validUniqueAddresses[i]!;
    const walletFingerprint = computeFingerprint(walletAddress);
    const sourceOrder = i + 1;
    const labelInfo = labelMap.get(walletAddress) ?? { labels: [], note: "" };

    const rec7d = profiles7d.get(walletFingerprint);
    const rec30d = profiles30d.get(walletFingerprint);

    const parseGmgnPeriod = (rec: any): GmgnPeriodStatsInput => {
      if (!rec) {
        return {
          status: "ABSENT",
          completeness: null,
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
      }
      const agg = rec.aggregates ?? {};
      const rawCompleteness = rec.completeness ?? null;
      if (rawCompleteness !== null && (!Number.isFinite(rawCompleteness) || rawCompleteness < 0 || rawCompleteness > 1)) {
        throw new Error("GMGN completeness must be a finite number in [0,1]");
      }
      const status: "MAPPED" | "PARTIAL" | "UNAVAILABLE" =
        rec.status === "MAPPED" || rec.status === "PARTIAL" || rec.status === "UNAVAILABLE"
          ? rec.status
          : rec.completeness === 1.0
          ? "MAPPED"
          : (rec.completeness ?? 0) > 0
          ? "PARTIAL"
          : "UNAVAILABLE";

      return {
        status,
        completeness: rawCompleteness,
        realizedProfit: agg.realizedProfit ?? null,
        realizedProfitPnl: agg.realizedProfitPnl ?? null,
        winRate: agg.winRate ?? null,
        buyCount: agg.buyCount ?? null,
        sellCount: agg.sellCount ?? null,
        boughtCost: agg.boughtCost ?? null,
        soldIncome: agg.soldIncome ?? null,
        tokenNum: agg.tokenNum ?? null,
        lastActiveTimestamp: agg.lastActiveTimestamp ?? null,
        warningCodes: Array.isArray(rec.warningCodes) ? rec.warningCodes : [],
      };
    };

    const s7d = parseGmgnPeriod(rec7d);
    const s30d = parseGmgnPeriod(rec30d);

    for (const code of [...s7d.warningCodes, ...s30d.warningCodes]) {
      warningCodeCounts[code] = (warningCodeCounts[code] || 0) + 1;
    }

    // Evaluate Quality & Candidates
    const dq = evaluateWalletDataQuality(s7d, s30d, evalTimeMs);
    const profitPct30d = getPercentile(s30d.realizedProfit);
    const candScores = calculateBorrowedCandidateScores(s7d, s30d, dq, profitPct30d);

    // Derived metrics (strictly checking zero denominators / missing)
    const act7 = s7d.buyCount !== null && s7d.sellCount !== null ? s7d.buyCount + s7d.sellCount : null;
    const act30 = s30d.buyCount !== null && s30d.sellCount !== null ? s30d.buyCount + s30d.sellCount : null;

    const safeDiv = (num: number | null, den: number | null): number | null => {
      if (num === null || den === null || den === 0 || !Number.isFinite(num) || !Number.isFinite(den)) {
        return null;
      }
      const res = num / den;
      return Number.isFinite(res) ? Math.round(res * 10000) / 10000 : null;
    };

    const safeSub = (a: number | null, b: number | null): number | null => {
      if (a === null || b === null) return null;
      return Math.round((a - b) * 100) / 100;
    };

    const buySellImbalance7d = act7 !== null && act7 > 0 ? safeDiv((s7d.buyCount ?? 0) - (s7d.sellCount ?? 0), act7) : null;
    const buySellImbalance30d = act30 !== null && act30 > 0 ? safeDiv((s30d.buyCount ?? 0) - (s30d.sellCount ?? 0), act30) : null;

    const capitalTurnover7d = safeDiv(s7d.soldIncome, s7d.boughtCost);
    const capitalTurnover30d = safeDiv(s30d.soldIncome, s30d.boughtCost);

    const profitPerTrade7d = safeDiv(s7d.realizedProfit, act7);
    const profitPerTrade30d = safeDiv(s30d.realizedProfit, act30);

    const profitPerToken7d = safeDiv(s7d.realizedProfit, s7d.tokenNum);
    const profitPerToken30d = safeDiv(s30d.realizedProfit, s30d.tokenNum);

    const incomeMinusCost7d = safeSub(s7d.soldIncome, s7d.boughtCost);
    const incomeMinusCost30d = safeSub(s30d.soldIncome, s30d.boughtCost);

    const profitAccountingResidual7d = safeSub(s7d.realizedProfit, incomeMinusCost7d);
    const profitAccountingResidual30d = safeSub(s30d.realizedProfit, incomeMinusCost30d);

    const profitGrowth7dTo30d = safeDiv(s7d.realizedProfit, s30d.realizedProfit);
    const winRateStability7dVs30d = safeSub(s7d.winRate, s30d.winRate);
    const activityStability7dVs30d = act7 !== null && act30 !== null && act30 > 0 ? safeDiv(act7 * (30 / 7), act30) : null;

    let profitablePeriodCount: number | null = null;
    if (s7d.realizedProfit !== null || s30d.realizedProfit !== null) {
      let cnt = 0;
      if (s7d.realizedProfit !== null && s7d.realizedProfit > 0) cnt++;
      if (s30d.realizedProfit !== null && s30d.realizedProfit > 0) cnt++;
      profitablePeriodCount = cnt;
    }

    const fetchedAtStr = rec30d?.fetchedAt ?? rec7d?.fetchedAt ?? null;
    const fetchedAtMs = typeof fetchedAtStr === "string" ? Date.parse(fetchedAtStr) : Number.NaN;
    const dataAgeHours = Number.isFinite(fetchedAtMs)
      ? Math.round(((evalTimeMs - fetchedAtMs) / 3_600_000) * 10) / 10
      : null;

    // Candidate Tags & Analyst Note
    const candidateTags: string[] = [];
    if (s30d.realizedProfit !== null && s30d.realizedProfit > 5000) candidateTags.push("high_profit_candidate");
    if (s30d.winRate !== null && s30d.winRate >= 70 && (act30 ?? 0) >= 20) candidateTags.push("high_win_rate_candidate");
    if ((act30 ?? 0) >= 20 && (act30 ?? 0) <= 300) candidateTags.push("bounded_activity_candidate");
    if ((profitablePeriodCount ?? 0) === 2) candidateTags.push("persistent_profit_candidate");
    if ((s30d.realizedProfit ?? 0) > 10000 && (act30 ?? 0) < 5) candidateTags.push("low_activity_high_profit_outlier");
    if ((act30 ?? 0) > 500) candidateTags.push("high_frequency_review");
    if (dq.anomalyFlags.some((a) => a.code.includes("ZERO_INCOME"))) {
      candidateTags.push("provider_semantics_review");
    }
    if (s7d.status === "PARTIAL" || s30d.status === "PARTIAL") candidateTags.push("provider_data_incomplete");
    candidateTags.push("first_hand_verification_required");

    const riskTags: string[] = dq.anomalyFlags.map((a) => a.code.toLowerCase() + "_risk");

    const gmgnObs7d = s7d.status === "MAPPED" || s7d.status === "PARTIAL" ? `7d Profit: $${s7d.realizedProfit ?? 'N/A'}, WinRate: ${s7d.winRate ?? 'N/A'}%, Trades: ${act7 ?? 'N/A'}` : "7d N/A";
    const gmgnObs30d = s30d.status === "MAPPED" || s30d.status === "PARTIAL" ? `30d Profit: $${s30d.realizedProfit ?? 'N/A'}, WinRate: ${s30d.winRate ?? 'N/A'}%, Trades: ${act30 ?? 'N/A'}` : "30d N/A";
    const anomalySummaryStr = dq.anomalyFlags.length > 0 ? dq.anomalyFlags.map((a) => a.code).join(", ") : "无严重异常";

    const analystNote = `来源备注：${labelInfo.note || "无"}；GMGN 观察：${gmgnObs7d} | ${gmgnObs30d}；数据质量：${dq.dataQualityTier} (${dq.dataQualityScore}分, ${anomalySummaryStr})；当前判断：仅为 borrowed/unverified 候选；下一步：需要 Helius 1手 Swap 链上数据校验。`;

    records.push({
      walletAddress,
      walletFingerprint,
      chain: "solana",
      sourceOrder,
      addressValidationStatus: "VALID",
      existingLabels: labelInfo.labels,
      existingNote: labelInfo.note,
      existingLabelSource: "chainfm_import",
      sourceInputFingerprint: walletFingerprint,
      sourceAddressesSha256: solAddressesTxtHash,
      sourceLabelsSha256: solAddressLabelsJsonHash,

      gmgn7dStatus: s7d.status,
      gmgn7dCompleteness: s7d.completeness,
      gmgn7dRealizedProfit: s7d.realizedProfit,
      gmgn7dRealizedProfitPnl: s7d.realizedProfitPnl,
      gmgn7dWinRate: s7d.winRate,
      gmgn7dBuyCount: s7d.buyCount,
      gmgn7dSellCount: s7d.sellCount,
      gmgn7dBoughtCost: s7d.boughtCost,
      gmgn7dSoldIncome: s7d.soldIncome,
      gmgn7dTokenNum: s7d.tokenNum,
      gmgn7dLastActiveTimestamp: s7d.lastActiveTimestamp,
      gmgn7dWarningCodes: s7d.warningCodes,
      gmgn7dFetchedAt: rec7d?.fetchedAt ?? null,

      gmgn30dStatus: s30d.status,
      gmgn30dCompleteness: s30d.completeness,
      gmgn30dRealizedProfit: s30d.realizedProfit,
      gmgn30dRealizedProfitPnl: s30d.realizedProfitPnl,
      gmgn30dWinRate: s30d.winRate,
      gmgn30dBuyCount: s30d.buyCount,
      gmgn30dSellCount: s30d.sellCount,
      gmgn30dBoughtCost: s30d.boughtCost,
      gmgn30dSoldIncome: s30d.soldIncome,
      gmgn30dTokenNum: s30d.tokenNum,
      gmgn30dLastActiveTimestamp: s30d.lastActiveTimestamp,
      gmgn30dWarningCodes: s30d.warningCodes,
      gmgn30dFetchedAt: rec30d?.fetchedAt ?? null,

      activityCount7d: act7,
      activityCount30d: act30,
      avgTradesPerActiveDay7d: safeDiv(act7, 7),
      avgTradesPerActiveDay30d: safeDiv(act30, 30),
      buySellImbalance7d,
      buySellImbalance30d,
      capitalTurnover7d,
      capitalTurnover30d,
      profitPerTrade7d,
      profitPerTrade30d,
      profitPerToken7d,
      profitPerToken30d,
      incomeMinusCost7d,
      incomeMinusCost30d,
      profitAccountingResidual7d,
      profitAccountingResidual30d,
      profitGrowth7dTo30d,
      winRateStability7dVs30d,
      activityStability7dVs30d,
      profitablePeriodCount,
      dataAgeHours,

      fieldCoverage7d: dq.fieldCoverage7d,
      fieldCoverage30d: dq.fieldCoverage30d,
      pairCoverage: dq.pairCoverage,
      dataQualityScore: dq.dataQualityScore,
      dataQualityTier: dq.dataQualityTier,
      internalConsistencyScore: dq.internalConsistencyScore,
      outlierPercentile30d: profitPct30d,
      anomalyFlags: dq.anomalyFlags.map((a) => a.code),
      exclusionCandidateFlags: dq.exclusionCandidateFlags,
      manualReviewRequired: dq.manualReviewRequired,
      manualReviewReasons: dq.manualReviewReasons,

      borrowedProfitabilityLeadScore: candScores.borrowedProfitabilityLeadScore,
      borrowedActivityLeadScore: candScores.borrowedActivityLeadScore,
      borrowedConsistencyLeadScore: candScores.borrowedConsistencyLeadScore,
      borrowedDataQualityScore: candScores.borrowedDataQualityScore,
      borrowedCompositeLeadScore: candScores.borrowedCompositeLeadScore,
      borrowedLeadRank: null, // compatibility alias of alphaCandidateRank
      alphaCandidateRank: null,
      reviewPriorityRank: null,
      borrowedLeadTier: candScores.borrowedLeadTier,

      firstHandVerificationStatus: null,
      firstHandProvider: null,
      firstHandCoverage: null,
      verifiedSwapCount: null,
      verifiedTransferCount: null,
      verifiedRealizedPnlUsd30d: null,
      verifiedWinRate30d: null,
      verifiedActiveDays30d: null,
      verifiedTokenCount30d: null,
      pnlReconciliationStatus: null,
      directFunder: null,
      fundingSourceType: null,
      fundingSourceConfidence: null,
      relatedWalletClusterId: null,
      botAssessment: null,
      routerAssessment: null,
      exchangeAssessment: null,
      sybilAssessment: null,
      alphaScore: null,
      alphaScoreTier: null,
      alphaScoreStatus: null,
      finalWalletScore: null,
      finalWalletGrade: null,

      normalizedExistingLabels: labelInfo.labels,
      candidateTags,
      confirmedTags: [],
      riskTags,
      analystNote,
      reviewStatus: "UNVERIFIED_CANDIDATE",
    });
  }

  const alphaEligible = (record: WalletMasterRecord): boolean =>
    !record.manualReviewRequired &&
    record.gmgn30dStatus === "MAPPED" &&
    record.gmgn30dRealizedProfit !== null &&
    record.borrowedCompositeLeadScore !== null &&
    (record.dataQualityTier === "DQ-A" || record.dataQualityTier === "DQ-B") &&
    record.gmgn30dCompleteness === 1 &&
    !record.gmgn30dWarningCodes.some((code) => code.includes("period_unverified") || code.includes("partial_fields"));

  const alphaRanked = records.filter(alphaEligible).sort((a, b) => {
    const scoreDelta = (b.borrowedCompositeLeadScore ?? -Infinity) - (a.borrowedCompositeLeadScore ?? -Infinity);
    if (scoreDelta !== 0) return scoreDelta;
    const profitDelta = (b.gmgn30dRealizedProfit ?? -Infinity) - (a.gmgn30dRealizedProfit ?? -Infinity);
    return profitDelta !== 0 ? profitDelta : a.walletFingerprint.localeCompare(b.walletFingerprint);
  });
  alphaRanked.forEach((record, index) => {
    record.alphaCandidateRank = index + 1;
    record.borrowedLeadRank = index + 1;
  });

  const reviewRanked = records.filter((record) => record.manualReviewRequired).sort((a, b) => {
    const severity = (record: WalletMasterRecord): number =>
      record.anomalyFlags.reduce((score, code) => score + (code.includes("UNAVAILABLE") || code.includes("ZERO_INCOME") ? 3 : 1), 0);
    const severityDelta = severity(b) - severity(a);
    if (severityDelta !== 0) return severityDelta;
    const qualityDelta = a.dataQualityScore - b.dataQualityScore;
    return qualityDelta !== 0 ? qualityDelta : a.walletFingerprint.localeCompare(b.walletFingerprint);
  });
  reviewRanked.forEach((record, index) => { record.reviewPriorityRank = index + 1; });

  // Preserve source order in the master export. Ranking semantics live only in the two explicit rank columns.
  records.sort((a, b) => a.sourceOrder - b.sourceOrder);

  const rawProfitTop5 = alphaRanked
    .slice()
    .sort((a, b) => (b.gmgn30dRealizedProfit ?? -Infinity) - (a.gmgn30dRealizedProfit ?? -Infinity))
    .slice(0, 5);
  const qualityAdjustedTop5 = alphaRanked.slice(0, 5);
  const activeConsistentTop5 = alphaRanked
    .filter((record) => (record.activityCount30d ?? 0) >= 20 && (record.activityCount30d ?? 0) <= 300)
    .sort((a, b) => b.internalConsistencyScore - a.internalConsistencyScore || (a.alphaCandidateRank ?? Infinity) - (b.alphaCandidateRank ?? Infinity))
    .slice(0, 5);
  const highWinRateTop5 = alphaRanked
    .filter((record) => (record.activityCount30d ?? 0) >= 20 && record.gmgn30dWinRate !== null)
    .sort((a, b) => (b.gmgn30dWinRate ?? 0) - (a.gmgn30dWinRate ?? 0) || (a.alphaCandidateRank ?? Infinity) - (b.alphaCandidateRank ?? Infinity))
    .slice(0, 5);
  const labelContextTop5 = alphaRanked
    .filter((record) => record.existingLabels.length > 0 || record.existingNote.length > 0)
    .slice(0, 5);
  const reviewPriorityTop5 = reviewRanked.slice(0, 5);

  const shortlistEntries: CandidateShortlistEntry[] = [];
  const addShortlistGroup = (
    shortlistType: CandidateShortlistEntry["shortlistType"],
    groupName: string,
    groupList: WalletMasterRecord[]
  ): void => {
    groupList.forEach((record, index) => {
      shortlistEntries.push({
        shortlistType,
        candidateGroup: groupName,
        groupRank: index + 1,
        walletAddress: record.walletAddress,
        walletFingerprint: record.walletFingerprint,
        existingLabels: record.existingLabels,
        existingNote: record.existingNote,
        candidateTags: record.candidateTags,
        gmgn7dRealizedProfit: record.gmgn7dRealizedProfit,
        gmgn30dRealizedProfit: record.gmgn30dRealizedProfit,
        gmgn7dWinRate: record.gmgn7dWinRate,
        gmgn30dWinRate: record.gmgn30dWinRate,
        activityCount7d: record.activityCount7d,
        activityCount30d: record.activityCount30d,
        gmgn7dTokenNum: record.gmgn7dTokenNum,
        gmgn30dTokenNum: record.gmgn30dTokenNum,
        pairCoverage: record.pairCoverage,
        dataQualityScore: record.dataQualityScore,
        dataQualityTier: record.dataQualityTier,
        internalConsistencyScore: record.internalConsistencyScore,
        borrowedCompositeLeadScore: record.borrowedCompositeLeadScore,
        anomalyFlags: record.anomalyFlags,
        candidateReasonCodes: [groupName, ...record.candidateTags],
        firstHandVerificationStatus: null,
        analystNote: record.analystNote,
      });
    });
  };

  addShortlistGroup("ALPHA_CANDIDATE", "raw_gmgn_profit_top5", rawProfitTop5);
  addShortlistGroup("ALPHA_CANDIDATE", "quality_adjusted_top5", qualityAdjustedTop5);
  addShortlistGroup("ALPHA_CANDIDATE", "active_consistent_top5", activeConsistentTop5);
  addShortlistGroup("ALPHA_CANDIDATE", "high_win_rate_top5", highWinRateTop5);
  addShortlistGroup("ALPHA_CANDIDATE", "label_context_top5", labelContextTop5);
  addShortlistGroup("REVIEW_PRIORITY", "review_priority_top5", reviewPriorityTop5);

  const buildUnion = (
    shortlistType: CandidateShortlistEntry["shortlistType"],
    unionName: string,
    maxSize: number
  ): CandidateShortlistEntry[] => {
    const union = new Map<string, CandidateShortlistEntry>();
    for (const entry of shortlistEntries.filter((item) => item.shortlistType === shortlistType)) {
      const existing = union.get(entry.walletAddress);
      if (existing) {
        if (!existing.candidateReasonCodes.includes(entry.candidateGroup)) existing.candidateReasonCodes.push(entry.candidateGroup);
        continue;
      }
      union.set(entry.walletAddress, { ...entry, candidateGroup: unionName, groupRank: union.size + 1, candidateReasonCodes: [entry.candidateGroup, ...entry.candidateTags] });
    }
    const values = Array.from(union.values()).sort((a, b) =>
      shortlistType === "ALPHA_CANDIDATE"
        ? (b.borrowedCompositeLeadScore ?? -Infinity) - (a.borrowedCompositeLeadScore ?? -Infinity)
        : a.groupRank - b.groupRank
    ).slice(0, maxSize);
    values.forEach((entry, index) => { entry.groupRank = index + 1; });
    return values;
  };

  const candidateUnionList = buildUnion("ALPHA_CANDIDATE", "candidate_union", 20);
  const reviewPriorityUnionList = buildUnion("REVIEW_PRIORITY", "review_priority_union", 20);

  // Write outputs to target outputDir
  fs.mkdirSync(outputDir, { recursive: true });

  const pMasterCsv = path.join(outputDir, "wallet_master_private.csv");
  const pMasterJsonl = path.join(outputDir, "wallet_master_private.jsonl");
  const pIdentityMap = path.join(outputDir, "wallet_identity_map.jsonl");
  const pShortlistCsv = path.join(outputDir, "candidate_shortlist.csv");
  const pShortlistJson = path.join(outputDir, "candidate_shortlist.json");
  const pDataQualitySummary = path.join(outputDir, "data_quality_summary.json");
  const pRankingSummary = path.join(outputDir, "ranking_summary.json");
  const pWarningCodeSummary = path.join(outputDir, "warning_code_summary.json");
  const pDataDictionary = path.join(outputDir, "data_dictionary.md");
  const pReplayManifest = path.join(outputDir, "replay_manifest.json");

  // Write wallet_master_private.jsonl
  fs.writeFileSync(
    pMasterJsonl,
    records.map((r) => JSON.stringify(r)).join("\n") + "\n",
    "utf8"
  );

  // Write wallet_master_private.csv
  const csvHeaders = Object.keys(records[0]!);
  const csvEscape = (val: any): string => {
    if (val === null || val === undefined) return "";
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    csvHeaders.join(","),
    ...records.map((r) => csvHeaders.map((h) => csvEscape((r as any)[h])).join(",")),
  ];
  fs.writeFileSync(pMasterCsv, csvLines.join("\n") + "\n", "utf8");

  // Write wallet_identity_map.jsonl
  const identityLines = records.map((r) =>
    JSON.stringify({
      walletAddress: r.walletAddress,
      walletFingerprint: r.walletFingerprint,
      sourceOrder: r.sourceOrder,
      chain: r.chain,
    })
  );
  fs.writeFileSync(pIdentityMap, identityLines.join("\n") + "\n", "utf8");

  // Write candidate_shortlist.json
  const shortlistOutputJson = {
    alpha_candidate_groups: {
      raw_gmgn_profit_top5: rawProfitTop5.map((r) => r.walletAddress),
      quality_adjusted_top5: qualityAdjustedTop5.map((r) => r.walletAddress),
      active_consistent_top5: activeConsistentTop5.map((r) => r.walletAddress),
      high_win_rate_top5: highWinRateTop5.map((r) => r.walletAddress),
      label_context_top5: labelContextTop5.map((r) => r.walletAddress),
    },
    review_priority_groups: {
      review_priority_top5: reviewPriorityTop5.map((r) => r.walletAddress),
    },
    candidate_union: candidateUnionList,
    review_priority_union: reviewPriorityUnionList,
  };
  fs.writeFileSync(pShortlistJson, JSON.stringify(shortlistOutputJson, null, 2), "utf8");

  // Write candidate_shortlist.csv
  const shortlistCsvHeaders = [
    "shortlistType", "candidateGroup", "groupRank", "walletAddress", "walletFingerprint", "existingLabels", "existingNote",
    "candidateTags", "gmgn7dRealizedProfit", "gmgn30dRealizedProfit", "gmgn7dWinRate", "gmgn30dWinRate",
    "activityCount7d", "activityCount30d", "gmgn7dTokenNum", "gmgn30dTokenNum", "pairCoverage",
    "dataQualityScore", "dataQualityTier", "internalConsistencyScore", "borrowedCompositeLeadScore",
    "anomalyFlags", "candidateReasonCodes", "firstHandVerificationStatus", "analystNote"
  ];
  const allShortlistRows = [...shortlistEntries, ...candidateUnionList, ...reviewPriorityUnionList];
  const shortlistCsvLines = [
    shortlistCsvHeaders.join(","),
    ...allShortlistRows.map((r) => shortlistCsvHeaders.map((h) => csvEscape((r as any)[h])).join(",")),
  ];
  fs.writeFileSync(pShortlistCsv, shortlistCsvLines.join("\n") + "\n", "utf8");

  // Write data_quality_summary.json
  const tierCounts: Record<DataQualityTier, number> = { "DQ-A": 0, "DQ-B": 0, "DQ-C": 0, "DQ-D": 0, "DQ-U": 0 };
  for (const r of records) {
    tierCounts[r.dataQualityTier] = (tierCounts[r.dataQualityTier] || 0) + 1;
  }
  const dqSummary = {
    ruleVersion: WALLET_DATA_QUALITY_RULE_VERSION,
    totalWallets: records.length,
    dataQualityTierDistribution: tierCounts,
    averageDataQualityScore: Math.round((records.reduce((sum, r) => sum + r.dataQualityScore, 0) / records.length) * 100) / 100,
    averageInternalConsistencyScore: Math.round((records.reduce((sum, r) => sum + r.internalConsistencyScore, 0) / records.length) * 100) / 100,
    walletsWithAnomaliesCount: records.filter((r) => r.anomalyFlags.length > 0).length,
    anomalyFlagsTotalCount: records.reduce((sum, r) => sum + r.anomalyFlags.length, 0),
    manualReviewRequiredCount: records.filter((r) => r.manualReviewRequired).length,
  };
  fs.writeFileSync(pDataQualitySummary, JSON.stringify(dqSummary, null, 2), "utf8");

  // Write ranking_summary.json
  const rankingSummary = {
    totalWalletsEvaluated: records.length,
    alphaCandidateGroupsCount: {
      raw_gmgn_profit_top5: rawProfitTop5.length,
      quality_adjusted_top5: qualityAdjustedTop5.length,
      active_consistent_top5: activeConsistentTop5.length,
      high_win_rate_top5: highWinRateTop5.length,
      label_context_top5: labelContextTop5.length,
    },
    reviewPriorityGroupsCount: { review_priority_top5: reviewPriorityTop5.length },
    alphaCandidateRankedCount: alphaRanked.length,
    reviewPriorityRankedCount: reviewRanked.length,
    candidateUnionCount: candidateUnionList.length,
    reviewPriorityUnionCount: reviewPriorityUnionList.length,
    topLeadTierCounts: {
      TOP_LEAD: records.filter((r) => r.borrowedLeadTier === "TOP_LEAD").length,
      STRONG_LEAD: records.filter((r) => r.borrowedLeadTier === "STRONG_LEAD").length,
      MODERATE_LEAD: records.filter((r) => r.borrowedLeadTier === "MODERATE_LEAD").length,
      LOW_LEAD: records.filter((r) => r.borrowedLeadTier === "LOW_LEAD").length,
      UNQUALIFIED: records.filter((r) => r.borrowedLeadTier === "UNQUALIFIED").length,
    },
  };
  fs.writeFileSync(pRankingSummary, JSON.stringify(rankingSummary, null, 2), "utf8");

  // Write warning_code_summary.json
  fs.writeFileSync(pWarningCodeSummary, JSON.stringify(warningCodeCounts, null, 2), "utf8");

  // Write data_dictionary.md
  const dataDictionaryContent = `# Wallet Intelligence Master Table Data Dictionary

## Rule Version
\`${WALLET_DATA_QUALITY_RULE_VERSION}\`

## Overview
This master table contains pure offline normalized GMGN 7d/30d stats, user address labels, data quality scoring, anomaly flags, and candidate ranking for 1,433 Solana addresses.
All GMGN fields are strictly tagged as **borrowed / unverified**. No formal Alpha Tiers (UR/SSR/SR/R/N) or verified chain PnL claims are produced in this offline table.

## Data Quality Dimensions & Weights
1. **Field Coverage (7d / 30d)** (30%): Fraction of valid fields returned by provider.
2. **Pair Coverage** (25%): 1.0 if both 7d & 30d profiles exist, 0.5 if only 1 exists, 0.0 if missing.
3. **Internal Consistency** (30%): Checks cross-window monotonicity. Accounting residuals are recorded as provider-semantic observations and do not directly reduce this score.
4. **Anomaly Penalties** (15%): Deductions for high/medium anomalies such as invalid completeness, zero sold income with high profit, and extreme trade frequency (> 2,000 trades).

## Data Quality Tiers
- **DQ-A**: Score 80.0 – 100.0 (High quality & complete)
- **DQ-B**: Score 65.0 – 79.999 (Good quality with minor gaps)
- **DQ-C**: Score 50.0 – 64.999 (Moderate quality / partial fields)
- **DQ-D**: Score 1.0 – 49.999 (Low quality / multiple anomalies)
- **DQ-U**: Score 0.0 or unavailable

## Primary Column Definitions
- \`walletAddress\`: Solana Base58 public key.
- \`walletFingerprint\`: SHA-256 irreversible fingerprint of the address.
- \`borrowedCompositeLeadScore\`: 0-100 composite candidate lead score (borrowed / unverified).
- \`dataQualityScore\`: 0-100 data quality score.
- \`dataQualityTier\`: Data quality tier (DQ-A..DQ-U).
- \`anomalyFlags\`: Array of identified data anomaly codes.
- \`analystNote\`: Structured summary note for offline review.
- \`firstHandVerificationStatus\`: Always \`null\` in this offline stage (pending Helius first-hand verification).
`;
  fs.writeFileSync(pDataDictionary, dataDictionaryContent, "utf8");

  // Output hashes for replay manifest
  const outputFilesMap: Record<string, string> = {
    wallet_master_private_csv: path.basename(pMasterCsv),
    wallet_master_private_jsonl: path.basename(pMasterJsonl),
    wallet_identity_map_jsonl: path.basename(pIdentityMap),
    candidate_shortlist_csv: path.basename(pShortlistCsv),
    candidate_shortlist_json: path.basename(pShortlistJson),
    data_quality_summary_json: path.basename(pDataQualitySummary),
    ranking_summary_json: path.basename(pRankingSummary),
    warning_code_summary_json: path.basename(pWarningCodeSummary),
    data_dictionary_md: path.basename(pDataDictionary),
    replay_manifest_json: path.basename(pReplayManifest),
  };

  const outputHashes: Record<string, string> = {
    wallet_master_private_csv: computeSha256(fs.readFileSync(pMasterCsv)),
    wallet_master_private_jsonl: computeSha256(fs.readFileSync(pMasterJsonl)),
    wallet_identity_map_jsonl: computeSha256(fs.readFileSync(pIdentityMap)),
    candidate_shortlist_csv: computeSha256(fs.readFileSync(pShortlistCsv)),
    candidate_shortlist_json: computeSha256(fs.readFileSync(pShortlistJson)),
    data_quality_summary_json: computeSha256(fs.readFileSync(pDataQualitySummary)),
    ranking_summary_json: computeSha256(fs.readFileSync(pRankingSummary)),
    warning_code_summary_json: computeSha256(fs.readFileSync(pWarningCodeSummary)),
    data_dictionary_md: computeSha256(fs.readFileSync(pDataDictionary)),
  };

  const replayManifest = {
    schema_version: "replay-manifest-v1",
    task_id: MASTER_CLEAN_RANK_TASK_ID,
    rule_version: WALLET_DATA_QUALITY_RULE_VERSION,
    evaluation_time: new Date(evalTimeMs).toISOString(),
    input_hashes: {
      sol_addresses_txt: solAddressesTxtHash,
      sol_address_labels_json: solAddressLabelsJsonHash,
      gmgn_normalized_profiles_json: gmgnNormalizedProfilesHash,
      gmgn_summary_json: gmgnSummaryHash,
    },
    metrics: {
      totalInputAddresses: validUniqueAddresses.length,
      matched7dCount: profiles7d.size,
      matched30dCount: profiles30d.size,
      dataQualityTierDistribution: tierCounts,
      candidateUnionCount: candidateUnionList.length,
      reviewPriorityUnionCount: reviewPriorityUnionList.length,
    },
    output_files: outputFilesMap,
    output_hashes: outputHashes,
  };

  fs.writeFileSync(pReplayManifest, JSON.stringify(replayManifest, null, 2), "utf8");

  const pos30 = records.filter((r) => r.gmgn30dRealizedProfit !== null && r.gmgn30dRealizedProfit > 0).length;
  const zero30 = records.filter((r) => r.gmgn30dRealizedProfit === 0).length;
  const neg30 = records.filter((r) => r.gmgn30dRealizedProfit !== null && r.gmgn30dRealizedProfit < 0).length;
  const unavailable30 = records.filter((r) => r.gmgn30dRealizedProfit === null).length;

  return {
    status: "SUCCESS",
    inputHashes: {
      solAddressesTxt: solAddressesTxtHash,
      solAddressLabelsJson: solAddressLabelsJsonHash,
      gmgnNormalizedProfiles: gmgnNormalizedProfilesHash,
      gmgnSummary: gmgnSummaryHash,
    },
    metrics: {
      totalInputAddresses: validUniqueAddresses.length,
      validUniqueWallets: validUniqueAddresses.length,
      matched7dCount: profiles7d.size,
      matched30dCount: profiles30d.size,
      dataQualityTierDistribution: tierCounts,
      positiveProfitCount30d: pos30,
      zeroProfitCount30d: zero30,
      negativeProfitCount30d: neg30,
      unavailableProfitCount30d: unavailable30,
      candidateUnionCount: candidateUnionList.length,
      reviewPriorityUnionCount: reviewPriorityUnionList.length,
    },
    outputFiles: outputFilesMap,
    outputHashes: {
      ...outputHashes,
      replay_manifest_json: computeSha256(fs.readFileSync(pReplayManifest)),
    },
  };
}
