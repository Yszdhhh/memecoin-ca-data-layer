import type { Pool, PoolClient } from "pg";
import type { MacroChainMetricObservation, MacroGlobalMetricObservation, MacroWarning } from "../../domain/macro-daily.js";
import type { MacroCoreStore, CoreQueryExecution, MacroHistoricalObservation } from "../../application/macro-daily-core-run-service.js";
import type { CoreBlueprintId } from "../dune/macro-core-query-definitions.js";

export class PostgresMacroCoreRepository implements MacroCoreStore {
  constructor(private readonly pool: Pool) {}

  async findQuery(blueprintId: CoreBlueprintId, sqlSha256: string): Promise<{ queryId: number } | null> {
    const result = await this.pool.query<{ query_id: string }>("SELECT query_id FROM macro_query_registry WHERE blueprint_id=$1 AND sql_sha256=$2 AND query_id IS NOT NULL", [blueprintId, sqlSha256]);
    const row = result.rows[0];
    return row ? { queryId: Number(row.query_id) } : null;
  }

  async findLatestQuery(blueprintId: CoreBlueprintId): Promise<{ queryId: number } | null> {
    const result = await this.pool.query<{ query_id: string }>("SELECT query_id FROM macro_query_registry WHERE blueprint_id=$1 AND query_id IS NOT NULL", [blueprintId]);
    const row = result.rows[0];
    return row ? { queryId: Number(row.query_id) } : null;
  }

  async reserveQueryCreation(blueprintId: CoreBlueprintId, sqlSha256: string): Promise<boolean> {
    const result = await this.pool.query("INSERT INTO macro_query_registry (blueprint_id,query_id,sql_sha256,query_version) VALUES ($1,NULL,$2,$3) ON CONFLICT (blueprint_id) DO NOTHING RETURNING blueprint_id", [blueprintId, sqlSha256, `pending:${blueprintId}@${sqlSha256}`]);
    return result.rowCount === 1;
  }

  async loadComparableHistory(input: { reportDay: string; globalMetrics: readonly MacroGlobalMetricObservation[]; chainMetrics: readonly MacroChainMetricObservation[] }): Promise<{ global: Record<string, MacroHistoricalObservation[]>; chain: Record<string, MacroHistoricalObservation[]> }> {
    const global = Object.fromEntries(await Promise.all(input.globalMetrics.map(async (metric) => [globalKey(metric), (await this.pool.query<HistoryRow>("SELECT report_day::text,value::text FROM macro_daily_global_metrics WHERE report_day >= $1::date - 7 AND report_day < $1::date AND metric_name=$2 AND subject=$3 AND unit=$4 AND source=$5 AND query_ref=$6 AND query_version=$7 AND completeness=1 ORDER BY report_day", [input.reportDay, metric.metricName, metric.subject, metric.unit, metric.source, metric.queryRef, metric.queryVersion])).rows.map(mapHistory)] as const)));
    const chain = Object.fromEntries(await Promise.all(input.chainMetrics.map(async (metric) => [chainKey(metric), (await this.pool.query<HistoryRow>("SELECT report_day::text,value::text FROM macro_daily_chain_metrics WHERE report_day >= $1::date - 7 AND report_day < $1::date AND chain=$2 AND metric_name=$3 AND unit=$4 AND registry_version=$5 AND coverage_status=$6 AND source=$7 AND query_ref=$8 AND query_version=$9 AND completeness=1 ORDER BY report_day", [input.reportDay, metric.chain, metric.metricName, metric.unit, metric.registryVersion, metric.coverageStatus, metric.source, metric.queryRef, metric.queryVersion])).rows.map(mapHistory)] as const)));
    return { global, chain };
  }

  async registerQuery(input: { blueprintId: CoreBlueprintId; queryId: number; sqlSha256: string }): Promise<void> {
    await this.pool.query("INSERT INTO macro_query_registry (blueprint_id,query_id,sql_sha256,query_version) VALUES ($1,$2,$3,$4) ON CONFLICT (blueprint_id) DO UPDATE SET query_id=EXCLUDED.query_id,sql_sha256=EXCLUDED.sql_sha256,query_version=EXCLUDED.query_version,last_verified_at=now()", [input.blueprintId, input.queryId, input.sqlSha256, `saved:${input.blueprintId}@${input.sqlSha256}`]);
  }

  async load(reportDay: string): Promise<{ globalMetrics: MacroGlobalMetricObservation[]; chainMetrics: MacroChainMetricObservation[] }> {
    const [globals, chains] = await Promise.all([
      this.pool.query<GlobalRow>("SELECT report_day::text, metric_name, subject, value::text, unit, source, query_ref, query_version, source_as_of, computed_at, completeness::text, warnings FROM macro_daily_global_metrics WHERE report_day=$1", [reportDay]),
      this.pool.query<ChainRow>("SELECT report_day::text, chain, section, metric_name, value::text, unit, registry_version, coverage_status, source, query_ref, query_version, source_as_of, computed_at, completeness::text, warnings FROM macro_daily_chain_metrics WHERE report_day=$1", [reportDay]),
    ]);
    return { globalMetrics: globals.rows.map(mapGlobal), chainMetrics: chains.rows.map(mapChain) };
  }

  async save(input: { reportDay: string; queries: readonly CoreQueryExecution[]; globalMetrics: readonly MacroGlobalMetricObservation[]; chainMetrics: readonly MacroChainMetricObservation[]; briefSha256: string; deliveryMode: "dry_run" | "lark_card_sent" }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const metric of input.globalMetrics) await saveGlobalMetric(client, metric);
      for (const metric of input.chainMetrics) await saveChainMetric(client, metric);
      for (const query of input.queries) await client.query("INSERT INTO macro_daily_delivery_runs (report_day,blueprint_id,result_sha256,source_as_of,brief_sha256,delivery_mode) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING", [input.reportDay, query.blueprintId, query.resultSha256, query.sourceAsOf, input.briefSha256, input.deliveryMode]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

interface GlobalRow { report_day: string; metric_name: MacroGlobalMetricObservation["metricName"]; subject: string; value: string; unit: "usd" | "count"; source: "dune"; query_ref: string; query_version: string; source_as_of: Date; computed_at: Date; completeness: string; warnings: MacroWarning[]; }
interface ChainRow { report_day: string; chain: MacroChainMetricObservation["chain"]; section: MacroChainMetricObservation["section"]; metric_name: MacroChainMetricObservation["metricName"]; value: string; unit: "usd" | "count"; registry_version: string; coverage_status: MacroChainMetricObservation["coverageStatus"]; source: "dune"; query_ref: string; query_version: string; source_as_of: Date; computed_at: Date; completeness: string; warnings: MacroWarning[]; }
interface HistoryRow { report_day: string; value: string; }

function mapGlobal(row: GlobalRow): MacroGlobalMetricObservation { return { reportDay: row.report_day, metricName: row.metric_name, subject: row.subject, value: Number(row.value), unit: row.unit, source: row.source, queryRef: row.query_ref, queryVersion: row.query_version, sourceAsOf: new Date(row.source_as_of), computedAt: new Date(row.computed_at), completeness: Number(row.completeness), warnings: row.warnings }; }
function mapChain(row: ChainRow): MacroChainMetricObservation { return { reportDay: row.report_day, chain: row.chain, section: row.section, metricName: row.metric_name, value: Number(row.value), unit: row.unit, registryVersion: row.registry_version, coverageStatus: row.coverage_status, source: row.source, queryRef: row.query_ref, queryVersion: row.query_version, sourceAsOf: new Date(row.source_as_of), computedAt: new Date(row.computed_at), completeness: Number(row.completeness), warnings: row.warnings }; }
function mapHistory(row: HistoryRow): MacroHistoricalObservation { return { reportDay: row.report_day, value: Number(row.value) }; }
function globalKey(metric: MacroGlobalMetricObservation): string { return `${metric.metricName}:${metric.subject}`; }
function chainKey(metric: MacroChainMetricObservation): string { return `${metric.chain}:${metric.metricName}`; }

async function saveGlobalMetric(client: PoolClient, metric: MacroGlobalMetricObservation): Promise<void> {
  await client.query("INSERT INTO macro_daily_global_metrics (report_day,metric_name,subject,value,unit,source,query_ref,query_version,source_as_of,computed_at,completeness,warnings) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) ON CONFLICT (report_day,metric_name,subject,source,query_ref,query_version) DO UPDATE SET value=EXCLUDED.value,source_as_of=EXCLUDED.source_as_of,computed_at=EXCLUDED.computed_at,completeness=EXCLUDED.completeness,warnings=EXCLUDED.warnings", [metric.reportDay, metric.metricName, metric.subject, metric.value, metric.unit, metric.source, metric.queryRef, metric.queryVersion, metric.sourceAsOf, metric.computedAt, metric.completeness, JSON.stringify(metric.warnings)]);
}

async function saveChainMetric(client: PoolClient, metric: MacroChainMetricObservation): Promise<void> {
  await client.query("INSERT INTO macro_daily_chain_metrics (report_day,chain,section,metric_name,value,unit,registry_version,coverage_status,source,query_ref,query_version,source_as_of,computed_at,completeness,warnings) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb) ON CONFLICT (report_day,chain,metric_name,source,query_ref,query_version) DO UPDATE SET value=EXCLUDED.value,source_as_of=EXCLUDED.source_as_of,computed_at=EXCLUDED.computed_at,completeness=EXCLUDED.completeness,warnings=EXCLUDED.warnings", [metric.reportDay, metric.chain, metric.section, metric.metricName, metric.value, metric.unit, metric.registryVersion, metric.coverageStatus, metric.source, metric.queryRef, metric.queryVersion, metric.sourceAsOf, metric.computedAt, metric.completeness, JSON.stringify(metric.warnings)]);
}
