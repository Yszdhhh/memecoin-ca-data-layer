import type { AddressLibrary } from "../sedimentation/address-library.js";
import {
  confirmBorrowedLeads,
  promoteConfirmedLeaderboardWallet,
  type BorrowedLeaderboardProvider,
  type BorrowedProfitLead,
  type FirstHandSwap,
} from "../leaderboard/token-profit-leaderboard.js";

export const DAILY_TOPTOKEN_MINING_RULE_VERSION = "daily-toptoken-mining-v1";
export type MiningWindow = "daily" | "weekly";

export interface TopTradedToken {
  tokenId: string;
  tokenCa: string;
  rank: number;
  source: "gmgn" | "birdeye" | "dexscreener" | "fixture";
  origin: "borrowed";
  verificationStatus: "unverified";
  observedAt: Date;
}

export interface TopTokenProvider {
  getTopTokens(window: MiningWindow, limit: number): Promise<TopTradedToken[]>;
}

export class FixtureTopTokenProvider implements TopTokenProvider {
  constructor(private readonly rows: Record<MiningWindow, TopTradedToken[]>) {}

  async getTopTokens(window: MiningWindow, limit: number): Promise<TopTradedToken[]> {
    return this.rows[window]
      .filter((row) => row.origin === "borrowed" && row.verificationStatus === "unverified")
      .sort((a, b) => a.rank - b.rank || a.tokenCa.localeCompare(b.tokenCa))
      .slice(0, limit)
      .map((row) => ({ ...row, observedAt: new Date(row.observedAt) }));
  }
}

export interface WalletMiningJudgment {
  walletAddress: string;
  promotionEligible: boolean;
  confidence: number;
  labels: string[];
  alphaScore: number | null;
  alphaStatus: "scored" | "provisional" | "insufficient";
  ruleVersions: {
    alpha: string;
    cluster: string;
    sniper: string;
    independentSmartMoney: string;
  };
  evidence: Record<string, unknown>;
  warnings: string[];
}

/** Adapter boundary around the existing Alpha Score + detector judgment layer. */
export interface WalletJudgmentEngine {
  evaluate(token: TopTradedToken, lead: BorrowedProfitLead): Promise<WalletMiningJudgment>;
}

export interface FirstHandConfirmationProvider {
  getWalletSwaps(tokenCa: string, walletAddresses: string[]): Promise<FirstHandSwap[]>;
}

export interface DailyMiningConfig {
  window: MiningWindow;
  topTokenLimit: number;
  maxBorrowedLeadsPerToken: number;
  firstHandWalletBudget: number;
  minimumJudgmentConfidence: number;
  minimumRealizedPnlMicroUsd: bigint;
  runAt: Date;
}

export interface DailyMiningReport {
  ruleVersion: string;
  window: MiningWindow;
  runAt: Date;
  status: "GREEN" | "DEGRADED";
  tokensScanned: number;
  walletsMined: number;
  confirmationsAttempted: number;
  walletsConfirmed: number;
  walletsPromoted: number;
  newLabels: {
    smartMoney: number;
    cluster: number;
    bot: number;
    other: number;
  };
  quota: {
    firstHandWalletBudget: number;
    consumed: number;
    skippedWallets: string[];
  };
  warnings: string[];
  tokenReports: Array<{
    tokenCa: string;
    borrowedLeads: number;
    judgedCandidates: number;
    confirmationsAttempted: number;
    promotedWallets: string[];
    warnings: string[];
  }>;
}

export interface DailyMiningDeps {
  topTokens: TopTokenProvider;
  borrowedLeaderboard: BorrowedLeaderboardProvider;
  judgment: WalletJudgmentEngine;
  firstHand: FirstHandConfirmationProvider;
  library: AddressLibrary;
}

function countLabel(label: string, counts: DailyMiningReport["newLabels"]): void {
  if (label.includes("smart_money") || label.startsWith("alpha_")) counts.smartMoney += 1;
  else if (label.includes("cluster") || label.includes("insider")) counts.cluster += 1;
  else if (label.includes("bot") || label.includes("sniper")) counts.bot += 1;
  else counts.other += 1;
}

function uniqueCandidates(
  rows: Array<{ lead: BorrowedProfitLead; judgment: WalletMiningJudgment }>,
): Array<{ lead: BorrowedProfitLead; judgment: WalletMiningJudgment }> {
  const seen = new Set<string>();
  return rows.filter(({ lead }) => {
    if (seen.has(lead.walletAddress)) return false;
    seen.add(lead.walletAddress);
    return true;
  });
}

/**
 * Offline/manual daily or weekly growth loop. Borrowed boards only nominate
 * candidates; a wallet is written to the confirmed library only after Tier-A
 * swap recomputation and within the explicit per-run quota.
 */
export async function runDailyTopTokenMining(
  deps: DailyMiningDeps,
  config: DailyMiningConfig,
): Promise<DailyMiningReport> {
  if (config.firstHandWalletBudget < 0 || !Number.isInteger(config.firstHandWalletBudget)) {
    throw new Error("firstHandWalletBudget must be a non-negative integer");
  }
  const warnings: string[] = [];
  let tokens: TopTradedToken[] = [];
  try {
    const received = await deps.topTokens.getTopTokens(config.window, config.topTokenLimit);
    tokens = received
      .filter((token) => {
        const valid = token.origin === "borrowed" && token.verificationStatus === "unverified";
        if (!valid) warnings.push(`invalid_top_token_contract:${token.tokenCa}`);
        return valid;
      })
      .sort((a, b) => a.rank - b.rank || a.tokenCa.localeCompare(b.tokenCa))
      .slice(0, config.topTokenLimit);
  } catch {
    warnings.push("top_token_provider_unavailable");
  }

  const report: DailyMiningReport = {
    ruleVersion: DAILY_TOPTOKEN_MINING_RULE_VERSION,
    window: config.window,
    runAt: new Date(config.runAt),
    status: "GREEN",
    tokensScanned: 0,
    walletsMined: 0,
    confirmationsAttempted: 0,
    walletsConfirmed: 0,
    walletsPromoted: 0,
    newLabels: { smartMoney: 0, cluster: 0, bot: 0, other: 0 },
    quota: {
      firstHandWalletBudget: config.firstHandWalletBudget,
      consumed: 0,
      skippedWallets: [],
    },
    warnings,
    tokenReports: [],
  };

  for (const token of tokens) {
    report.tokensScanned += 1;
    const tokenWarnings: string[] = [];
    let leads: BorrowedProfitLead[] = [];
    try {
      const received = await deps.borrowedLeaderboard.getTokenLeaderboard(token.tokenCa);
      const invalidCount = received.filter((lead) =>
        lead.origin !== "borrowed" || lead.verificationStatus !== "unverified").length;
      if (invalidCount > 0) tokenWarnings.push(`invalid_borrowed_leaderboard_contract:${invalidCount}`);
      leads = received
        .filter((lead) => lead.origin === "borrowed" && lead.verificationStatus === "unverified")
        .sort((a, b) => a.rank - b.rank || a.walletAddress.localeCompare(b.walletAddress))
        .slice(0, config.maxBorrowedLeadsPerToken);
    } catch {
      tokenWarnings.push("borrowed_leaderboard_unavailable");
    }
    report.walletsMined += leads.length;

    const judged: Array<{ lead: BorrowedProfitLead; judgment: WalletMiningJudgment }> = [];
    for (const lead of leads) {
      try {
        const judgment = await deps.judgment.evaluate(token, lead);
        if (judgment.walletAddress !== lead.walletAddress) {
          tokenWarnings.push(`judgment_wallet_mismatch:${lead.walletAddress}`);
          continue;
        }
        judged.push({ lead, judgment });
        tokenWarnings.push(...judgment.warnings.map((warning) => `${lead.walletAddress}:${warning}`));
      } catch {
        tokenWarnings.push(`judgment_failed:${lead.walletAddress}`);
      }
    }

    const eligible = uniqueCandidates(judged).filter(({ judgment }) =>
      judgment.promotionEligible
      && judgment.confidence >= config.minimumJudgmentConfidence,
    );
    const remaining = Math.max(0, config.firstHandWalletBudget - report.quota.consumed);
    const selected = eligible.slice(0, remaining);
    const skipped = eligible.slice(remaining).map(({ lead }) => lead.walletAddress);
    if (skipped.length > 0) {
      report.quota.skippedWallets.push(...skipped);
      tokenWarnings.push(`first_hand_quota_exhausted:${skipped.length}`);
    }

    const selectedWallets = selected.map(({ lead }) => lead.walletAddress);
    report.quota.consumed += selectedWallets.length;
    report.confirmationsAttempted += selectedWallets.length;
    let swaps: FirstHandSwap[] = [];
    if (selectedWallets.length > 0) {
      try {
        swaps = await deps.firstHand.getWalletSwaps(token.tokenCa, selectedWallets);
      } catch {
        tokenWarnings.push("first_hand_confirmation_unavailable");
      }
    }

    const selectedLeads = selected.map(({ lead }) => lead);
    const confirmed = confirmBorrowedLeads(token.tokenCa, selectedLeads, swaps, "fifo");
    const selectedByWallet = new Map(selected.map((row) => [row.lead.walletAddress, row]));
    const promotedWallets: string[] = [];
    for (const record of confirmed) {
      if (record.evidence.swapCount === 0) {
        tokenWarnings.push(`first_hand_no_swaps:${record.walletAddress}`);
        continue;
      }
      report.walletsConfirmed += 1;
      const selectedRow = selectedByWallet.get(record.walletAddress);
      if (!selectedRow) continue;
      const promotion = await promoteConfirmedLeaderboardWallet(deps.library, {
        tokenId: token.tokenId,
        tokenCa: token.tokenCa,
        record,
        labels: selectedRow.judgment.labels,
        confidence: selectedRow.judgment.confidence,
        promotedAt: config.runAt,
        minimumRealizedPnlMicroUsd: config.minimumRealizedPnlMicroUsd,
        evidence: {
          alphaScore: selectedRow.judgment.alphaScore,
          alphaStatus: selectedRow.judgment.alphaStatus,
          ruleVersions: { ...selectedRow.judgment.ruleVersions },
          borrowedLead: {
            source: selectedRow.lead.source,
            rank: selectedRow.lead.rank,
            realizedPnlUsd: selectedRow.lead.realizedPnlUsd,
            roiPct: selectedRow.lead.roiPct,
          },
          judgment: { ...selectedRow.judgment.evidence },
        },
      });
      if (!promotion.promoted) {
        tokenWarnings.push(`confirmation_below_promotion_bar:${record.walletAddress}`);
        continue;
      }
      promotedWallets.push(record.walletAddress);
      report.walletsPromoted += 1;
      for (const label of promotion.newLabels) countLabel(label, report.newLabels);
    }

    const tokenReport = {
      tokenCa: token.tokenCa,
      borrowedLeads: leads.length,
      judgedCandidates: judged.length,
      confirmationsAttempted: selectedWallets.length,
      promotedWallets: promotedWallets.sort(),
      warnings: tokenWarnings,
    };
    report.tokenReports.push(tokenReport);
    warnings.push(...tokenWarnings.map((warning) => `${token.tokenCa}:${warning}`));
  }

  report.status = warnings.length > 0 ? "DEGRADED" : "GREEN";
  return report;
}
