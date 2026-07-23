import { Pool } from "pg";
import type { MacroChainMetricObservation } from "../domain/macro-daily.js";
import { LIVE_SOLANA_QUERY_DEFINITIONS, type CoreBlueprintId, type CoreQueryDefinition } from "../infrastructure/dune/macro-core-query-definitions.js";
import { MacroDuneRest, duneSha256, type DuneAggregateQueryResult, type DuneSavedQueryAllowlistEntry } from "../infrastructure/dune/macro-dune-rest.js";
import { PostgresMacroCoreRepository } from "../infrastructure/postgres/postgres-macro-core-repository.js";
import { MacroFeishuTestDelivery, hashMacroFeishuText } from "./macro-feishu-delivery.js";
import type { CoreQueryExecution, MacroCoreStore } from "./macro-daily-core-run-service.js";

export type SolanaLiveBlueprintId = "S1_solana_capital_day" | "S2_solana_pump_launch_day" | "S3_solana_pumpswap_pool_day" | "S4_solana_trade_activity_day";
export interface MacroLiveSolanaSavedQuery { readonly queryId: number; readonly queryVersion: number; }
export type MacroLiveSolanaSavedQueryAllowlist = Readonly<Record<SolanaLiveBlueprintId, MacroLiveSolanaSavedQuery>>;

export interface MacroLiveSolanaRunInput {
  readonly reportDay: string;
  readonly savedQueries: MacroLiveSolanaSavedQueryAllowlist;
  readonly sendTestDelivery?: boolean;
}

export interface MacroLiveSolanaRunManifest {
  readonly scope: "solana_only";
  readonly reportDay: string;
  readonly idempotencyKey: string;
  readonly allowlistSha256: string;
  readonly completedAt: string;
  readonly deliveryMode: "dry_run" | "lark_card_sent";
  readonly queries: readonly { blueprintId: SolanaLiveBlueprintId; queryId: number; queryVersion: number; sqlSha256: string; resultSha256: string; sourceAsOf: string }[];
  readonly warnings: readonly string[];
}

export interface MacroLiveSolanaTimeSeriesDependencies {
  readonly dune: Pick<MacroDuneRest, "runAggregateQuery">;
  readonly store: Pick<MacroCoreStore, "findQuery" | "save">;
  readonly delivery: Pick<MacroFeishuTestDelivery, "send">;
  readonly now?: () => Date;
}

const solanaDefinitions = LIVE_SOLANA_QUERY_DEFINITIONS.filter(isSolanaDefinition) as readonly CoreQueryDefinition[];
const solanaBlueprintIds: readonly SolanaLiveBlueprintId[] = ["S1_solana_capital_day", "S2_solana_pump_launch_day", "S3_solana_pumpswap_pool_day", "S4_solana_trade_activity_day"];

export class MacroLiveSolanaTimeSeriesService {
  constructor(private readonly dependencies: MacroLiveSolanaTimeSeriesDependencies) {}

  async run(input: MacroLiveSolanaRunInput): Promise<{ manifest: MacroLiveSolanaRunManifest; metrics: readonly MacroChainMetricObservation[]; report: string }> {
    assertReportDayEligible(input.reportDay, this.dependencies.now?.() ?? new Date());
    const allowlist = createSolanaDuneAllowlist(input.savedQueries, input.reportDay);
    const allowlistSha256 = duneSha256(JSON.stringify(allowlist.map((entry) => ({ blueprintId: entry.blueprintId, queryId: entry.queryId, queryVersion: entry.queryVersion, sqlSha256: entry.sqlSha256, queryParameters: entry.queryParameters }))));
    await Promise.all(allowlist.map(async (entry) => {
      const registered = await this.dependencies.store.findQuery(entry.blueprintId as CoreBlueprintId, entry.sqlSha256);
      if (registered?.queryId !== entry.queryId) throw new Error(`Dune query registry does not allow ${entry.blueprintId}`);
    }));
    const results = await Promise.all(allowlist.map((entry) => this.dependencies.dune.runAggregateQuery(entry)));
    if (results.some((result) => result.reportDay !== input.reportDay)) throw new Error("Dune aggregate results do not cover the requested complete UTC report day");

    const metrics = results.flatMap((result) => observationsFor(result, definitionFor(result.blueprintId)));
    const report = renderSolanaLiveReport(input.reportDay, metrics, allowlistSha256, input.sendTestDelivery === true);
    const delivery = input.sendTestDelivery === true
      ? await this.dependencies.delivery.send({ reportDay: input.reportDay, text: report, allowlistSha256 })
      : { deliveryMode: "dry_run" as const, payloadSha256: hashMacroFeishuText(report), idempotencyKey: `macro-live:solana:${input.reportDay}:${allowlistSha256.slice(0, 16)}` };
    const queries = results.map((result): CoreQueryExecution => ({ blueprintId: result.blueprintId as CoreBlueprintId, queryId: result.queryId, sqlSha256: definitionFor(result.blueprintId).sqlSha256, resultSha256: result.resultSha256, sourceAsOf: result.sourceAsOf }));
    await this.dependencies.store.save({ reportDay: input.reportDay, queries, globalMetrics: [], chainMetrics: metrics, briefSha256: delivery.payloadSha256, deliveryMode: delivery.deliveryMode });

    return {
      report,
      metrics,
      manifest: {
        scope: "solana_only",
        reportDay: input.reportDay,
        idempotencyKey: delivery.idempotencyKey,
        allowlistSha256,
        completedAt: (this.dependencies.now?.() ?? new Date()).toISOString(),
        deliveryMode: delivery.deliveryMode,
        queries: results.map((result) => ({ blueprintId: result.blueprintId as SolanaLiveBlueprintId, queryId: result.queryId, queryVersion: result.queryVersion, sqlSha256: definitionFor(result.blueprintId).sqlSha256, resultSha256: result.resultSha256, sourceAsOf: result.sourceAsOf.toISOString() })),
        warnings: ["solana_only", "aggregate_trade_legs_not_users_or_demand", "liquidity_retention_lifecycle_and_sentiment_park"],
      },
    };
  }
}

export async function runMacroLiveSolanaTimeSeries(input: MacroLiveSolanaRunInput & { databaseUrl: string; feishuTestChatId: string }): Promise<{ manifest: MacroLiveSolanaRunManifest; metrics: readonly MacroChainMetricObservation[]; report: string }> {
  if (!input.databaseUrl.trim()) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: input.databaseUrl });
  try {
    return await new MacroLiveSolanaTimeSeriesService({ dune: new MacroDuneRest(), store: new PostgresMacroCoreRepository(pool), delivery: new MacroFeishuTestDelivery(input.feishuTestChatId ?? "") }).run(input);
  } finally {
    await pool.end();
  }
}

export function createSolanaDuneAllowlist(savedQueries: MacroLiveSolanaSavedQueryAllowlist, reportDay: string): readonly DuneSavedQueryAllowlistEntry[] {
  assertCompleteAllowlist(savedQueries);
  assertUtcReportDay(reportDay);
  return solanaBlueprintIds.map((blueprintId) => {
    const definition = definitionFor(blueprintId);
    const saved = savedQueries[blueprintId];
    return { blueprintId, queryId: saved.queryId, queryVersion: saved.queryVersion, sqlSha256: definition.sqlSha256, columns: ["report_day", ...definition.definition.metrics.map((metric) => metric.column)], queryParameters: { report_day: reportDay } };
  });
}

function definitionFor(blueprintId: string): { definition: CoreQueryDefinition; sqlSha256: string } {
  const definition = solanaDefinitions.find((candidate) => candidate.blueprintId === blueprintId);
  if (definition === undefined || !solanaBlueprintIds.includes(blueprintId as SolanaLiveBlueprintId)) throw new Error(`Solana live allowlist does not include ${blueprintId}`);
  return { definition, sqlSha256: duneSha256(definition.sql) };
}

function observationsFor(result: DuneAggregateQueryResult, definitionWithHash: { definition: CoreQueryDefinition; sqlSha256: string }): MacroChainMetricObservation[] {
  const computedAt = new Date();
  return definitionWithHash.definition.metrics.map((metric) => {
    if (metric.scope !== "chain" || metric.chain !== "solana") throw new Error(`Solana live definition ${result.blueprintId} contains a non-Solana metric`);
    const value = result.values[metric.column];
    if (value === undefined) throw new Error(`Dune aggregate result is missing ${metric.column}`);
    return { reportDay: result.reportDay, chain: "solana", section: metric.section, metricName: metric.metricName, value, unit: metric.unit, registryVersion: metric.registryVersion, coverageStatus: metric.coverageStatus, source: "dune", queryRef: `dune:${result.queryId}`, queryVersion: `dune:v${result.queryVersion}@${definitionWithHash.sqlSha256}`, sourceAsOf: result.sourceAsOf, computedAt, completeness: 1, warnings: metric.warningCodes.map((code) => ({ code })) };
  });
}

function renderSolanaLiveReport(reportDay: string, metrics: readonly MacroChainMetricObservation[], allowlistSha256: string, testDelivery: boolean): string {
  const lines = [testDelivery ? "[TEST] Solana daily market-environment observation" : "[MANUAL QUERY] Solana daily market-environment observation", `UTC report day: ${reportDay}`, "Scope: Solana declared-registry aggregates only; BSC and Robinhood are not executed.", "Interpretation: DEX trade-leg aggregates are not users, buyers, demand, or a trading signal."];
  for (const metric of metrics) lines.push(`${metric.metricName}: ${metric.value} ${metric.unit}`);
  lines.push(`Allowlist: ${allowlistSha256.slice(0, 16)}`, "PARK: liquidity retention, lifecycle decay, launch-to-external-pool conversion, and sentiment require separately validated live sources.");
  return lines.join("\n");
}

function isSolanaDefinition(definition: CoreQueryDefinition): boolean { return definition.metrics.length > 0 && definition.metrics.every((metric) => metric.scope === "chain" && metric.chain === "solana"); }
function assertCompleteAllowlist(savedQueries: MacroLiveSolanaSavedQueryAllowlist): void { if (solanaDefinitions.length !== solanaBlueprintIds.length || Object.keys(savedQueries).length !== solanaBlueprintIds.length) throw new Error("Solana saved-query allowlist must contain exactly S1 through S4"); for (const blueprintId of solanaBlueprintIds) { const query = savedQueries[blueprintId]; if (query === undefined || !Number.isSafeInteger(query.queryId) || query.queryId <= 0 || !Number.isSafeInteger(query.queryVersion) || query.queryVersion <= 0) throw new Error(`Solana saved-query allowlist entry ${blueprintId} is invalid`); } }
function assertReportDayEligible(reportDay: string, now: Date): void { assertUtcReportDay(reportDay); if (Number.isNaN(now.getTime())) throw new Error("UTC report day is invalid"); const reportStart = new Date(`${reportDay}T00:00:00.000Z`); const earliestRun = reportStart.getTime() + 38 * 60 * 60 * 1_000; if (now.getTime() < earliestRun) throw new Error("Solana live report may run only at D+1 14:00 UTC or later"); }
function assertUtcReportDay(reportDay: string): void { const reportStart = new Date(`${reportDay}T00:00:00.000Z`); if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDay) || Number.isNaN(reportStart.getTime()) || reportStart.toISOString().slice(0, 10) !== reportDay) throw new Error("UTC report day is invalid"); }