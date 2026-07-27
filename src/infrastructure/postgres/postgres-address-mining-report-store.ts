import type { Pool } from "pg";
import type {
  DailyMiningReport,
  DailyMiningReportStore,
} from "../../application/growth-loop/daily-toptoken-mining.js";

/**
 * Offline persistence adapter. The caller supplies a Pool; this module never
 * creates a connection or reaches a database on its own.
 */
export class PostgresAddressMiningReportStore implements DailyMiningReportStore {
  constructor(private readonly pool: Pool) {}

  async save(report: DailyMiningReport): Promise<void> {
    assertReport(report);
    await this.pool.query(
      `INSERT INTO address_mining_runs (
         window, run_at, rule_version, status,
         tokens_scanned, wallets_mined, confirmations_attempted,
         wallets_confirmed, wallets_promoted, new_labels, quota, warnings,
         token_reports
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7,
         $8, $9, $10::jsonb, $11::jsonb, $12::jsonb,
         $13::jsonb
       )
       ON CONFLICT (window, run_at, rule_version) DO UPDATE SET
         status = EXCLUDED.status,
         tokens_scanned = EXCLUDED.tokens_scanned,
         wallets_mined = EXCLUDED.wallets_mined,
         confirmations_attempted = EXCLUDED.confirmations_attempted,
         wallets_confirmed = EXCLUDED.wallets_confirmed,
         wallets_promoted = EXCLUDED.wallets_promoted,
         new_labels = EXCLUDED.new_labels,
         quota = EXCLUDED.quota,
         warnings = EXCLUDED.warnings,
         token_reports = EXCLUDED.token_reports,
         recorded_at = now()`,
      [
        report.window,
        report.runAt,
        report.ruleVersion,
        report.status,
        report.tokensScanned,
        report.walletsMined,
        report.confirmationsAttempted,
        report.walletsConfirmed,
        report.walletsPromoted,
        JSON.stringify(report.newLabels),
        JSON.stringify(report.quota),
        JSON.stringify(report.warnings),
        JSON.stringify(report.tokenReports),
      ],
    );
  }
}

function assertReport(report: DailyMiningReport): void {
  if (report.window !== "daily" && report.window !== "weekly") {
    throw new Error("mining report window must be daily or weekly");
  }
  if (!(report.runAt instanceof Date) || Number.isNaN(report.runAt.getTime())) {
    throw new Error("mining report runAt must be a valid date");
  }
  for (const [name, value] of Object.entries({
    tokensScanned: report.tokensScanned,
    walletsMined: report.walletsMined,
    confirmationsAttempted: report.confirmationsAttempted,
    walletsConfirmed: report.walletsConfirmed,
    walletsPromoted: report.walletsPromoted,
    firstHandWalletBudget: report.quota.firstHandWalletBudget,
    consumed: report.quota.consumed,
  })) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`mining report ${name} must be a non-negative integer`);
    }
  }
}