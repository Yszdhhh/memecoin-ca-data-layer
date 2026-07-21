import { createHash } from "node:crypto";
import { MacroDailyBriefService } from "./macro-daily-brief-service.js";
import { renderMacroDailyBrief } from "./macro-daily-brief-renderer.js";

export const G2_SQL = "SELECT block_date AS report_day, tx_count AS btc_transaction_count FROM metrics_bitcoin.transactions_daily WHERE block_date = CURRENT_DATE - INTERVAL '2' DAY";
export const G2_BLUEPRINT_ID = "G2_btc_tx_count";

export interface SavedG2QueryGateway {
  createPrivateQuery(input: { blueprintId: string; sql: string; sqlSha256: string }): Promise<{ queryId: number }>;
  runQuery(queryId: number): Promise<{ reportDay: string; transactionCount: number; sourceAsOf: Date; resultSha256: string }>;
}

export interface MacroG2Store {
  findQuery(blueprintId: string, sqlSha256: string): Promise<{ queryId: number } | null>;
  save(input: { queryId: number; sqlSha256: string; reportDay: string; transactionCount: number; sourceAsOf: Date; resultSha256: string; briefSha256: string; deliveryMode: "dry_run" | "hermes_sent" }): Promise<void>;
}

export interface MacroBriefPublisher {
  publish(markdown: string, dryRun: boolean): Promise<"dry_run" | "hermes_sent">;
}

export class MacroDailyG2RunService {
  constructor(private readonly dune: SavedG2QueryGateway, private readonly store: MacroG2Store, private readonly publisher: MacroBriefPublisher) {}

  async run(options: { dryRun?: boolean } = {}): Promise<{ markdown: string; reportDay: string; queryId: number; deliveryMode: "dry_run" | "hermes_sent" }> {
    const sqlSha256 = sha256(G2_SQL);
    const query = (await this.store.findQuery(G2_BLUEPRINT_ID, sqlSha256)) ?? await this.dune.createPrivateQuery({ blueprintId: G2_BLUEPRINT_ID, sql: G2_SQL, sqlSha256 });
    const result = await this.dune.runQuery(query.queryId);
    const brief = new MacroDailyBriefService().normalize({
      reportDay: result.reportDay,
      globalMetrics: [{ reportDay: result.reportDay, metricName: "btc_transaction_count", subject: "bitcoin", value: result.transactionCount, unit: "count", source: "dune", queryRef: `dune:query:${query.queryId}`, queryVersion: `saved:${G2_BLUEPRINT_ID}@${sqlSha256}`, sourceAsOf: result.sourceAsOf, computedAt: new Date(), completeness: 1, warnings: [] }],
      chainMetrics: [], hourlyProfiles: [],
    });
    const markdown = renderMacroDailyBrief(brief);
    const deliveryMode = await this.publisher.publish(markdown, options.dryRun !== false);
    await this.store.save({ queryId: query.queryId, sqlSha256, reportDay: result.reportDay, transactionCount: result.transactionCount, sourceAsOf: result.sourceAsOf, resultSha256: result.resultSha256, briefSha256: sha256(markdown), deliveryMode });
    return { markdown, reportDay: result.reportDay, queryId: query.queryId, deliveryMode };
  }
}

export function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
