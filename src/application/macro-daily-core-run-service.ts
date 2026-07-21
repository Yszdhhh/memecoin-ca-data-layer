import { createHash } from "node:crypto";
import type { MacroChainMetricObservation, MacroDailyBrief, MacroGlobalMetricObservation } from "../domain/macro-daily.js";
import { CORE_QUERY_DEFINITIONS, type CoreBlueprintId, type CoreQueryDefinition } from "../infrastructure/dune/macro-core-query-definitions.js";
import { MacroDailyBriefService } from "./macro-daily-brief-service.js";
import { renderMacroDailyBrief } from "./macro-daily-brief-renderer.js";

export interface CoreDuneQueryGateway {
  createPrivateQuery(input: { blueprintId: CoreBlueprintId; sql: string; sqlSha256: string }): Promise<{ queryId: number }>;
  updatePrivateQuery(input: { queryId: number; blueprintId: CoreBlueprintId; sql: string; sqlSha256: string }): Promise<void>;
  runQuery(queryId: number, columns: readonly string[]): Promise<{ reportDay: string; values: Record<string, number>; sourceAsOf: Date; resultSha256: string }>;
}

export interface CoreQueryExecution {
  blueprintId: CoreBlueprintId;
  queryId: number;
  sqlSha256: string;
  resultSha256: string;
  sourceAsOf: Date;
}

export interface MacroHistoricalObservation {
  reportDay: string;
  value: number;
}

export interface MacroMetricDynamics {
  dayChangePct?: number;
  sevenDayRelativePct?: number;
  baselineDayCount: number;
}

export interface MacroDailyDynamics {
  global: Record<string, MacroMetricDynamics>;
  chain: Record<string, MacroMetricDynamics>;
}

export interface MacroCoreStore {
  findQuery(blueprintId: CoreBlueprintId, sqlSha256: string): Promise<{ queryId: number } | null>;
  findLatestQuery(blueprintId: CoreBlueprintId): Promise<{ queryId: number } | null>;
  reserveQueryCreation(blueprintId: CoreBlueprintId, sqlSha256: string): Promise<boolean>;
  loadComparableHistory(input: { reportDay: string; globalMetrics: readonly MacroGlobalMetricObservation[]; chainMetrics: readonly MacroChainMetricObservation[] }): Promise<{ global: Record<string, MacroHistoricalObservation[]>; chain: Record<string, MacroHistoricalObservation[]> }>;
  registerQuery(input: { blueprintId: CoreBlueprintId; queryId: number; sqlSha256: string }): Promise<void>;
  load(reportDay: string): Promise<{ globalMetrics: MacroGlobalMetricObservation[]; chainMetrics: MacroChainMetricObservation[] }>;
  save(input: { reportDay: string; queries: readonly CoreQueryExecution[]; globalMetrics: readonly MacroGlobalMetricObservation[]; chainMetrics: readonly MacroChainMetricObservation[]; briefSha256: string; deliveryMode: "dry_run" | "lark_card_sent" }): Promise<void>;
}

export interface MacroCoreBriefPublisher {
  publish(input: { brief: MacroDailyBrief; dynamics: MacroDailyDynamics }, dryRun: boolean): Promise<{ deliveryMode: "dry_run" | "lark_card_sent"; payloadSha256: string }>;
}

export class MacroDailyCoreRunService {
  constructor(private readonly dune: CoreDuneQueryGateway, private readonly store: MacroCoreStore, private readonly publisher: MacroCoreBriefPublisher) {}

  async run(options: { dryRun?: boolean } = {}): Promise<{ markdown: string; reportDay: string; queryIds: Readonly<Record<CoreBlueprintId, number>>; deliveryMode: "dry_run" | "lark_card_sent" }> {
    const executions: CoreQueryExecution[] = [];
    const globalMetrics: MacroGlobalMetricObservation[] = [];
    const chainMetrics: MacroChainMetricObservation[] = [];
    let reportDay: string | undefined;

    for (const definition of CORE_QUERY_DEFINITIONS) {
      const sqlSha256 = sha256(definition.sql);
      let query = await this.store.findQuery(definition.blueprintId, sqlSha256);
      if (query === null) {
        const priorQuery = await this.store.findLatestQuery(definition.blueprintId);
        if (priorQuery === null) {
          if (!await this.store.reserveQueryCreation(definition.blueprintId, sqlSha256)) throw new Error(`Dune query creation is pending reconciliation for ${definition.blueprintId}`);
          query = await this.dune.createPrivateQuery({ blueprintId: definition.blueprintId, sql: definition.sql, sqlSha256 });
        }
        else {
          assertQueryId(priorQuery.queryId);
          await this.dune.updatePrivateQuery({ queryId: priorQuery.queryId, blueprintId: definition.blueprintId, sql: definition.sql, sqlSha256 });
          query = priorQuery;
        }
        assertQueryId(query.queryId);
        await this.store.registerQuery({ blueprintId: definition.blueprintId, queryId: query.queryId, sqlSha256 });
      }
      assertQueryId(query.queryId);
      const result = await this.dune.runQuery(query.queryId, definition.metrics.map((metric) => metric.column));
      assertReportDay(result.reportDay);
      assertResultProvenance(result.sourceAsOf, result.resultSha256);
      if (reportDay !== undefined && reportDay !== result.reportDay) throw new Error("Dune core queries returned different report days");
      reportDay = result.reportDay;
      const queryVersion = `saved:${definition.blueprintId}@${sqlSha256}`;
      const observations = observationsFor(definition, result, query.queryId, queryVersion);
      globalMetrics.push(...observations.globalMetrics);
      chainMetrics.push(...observations.chainMetrics);
      executions.push({ blueprintId: definition.blueprintId, queryId: query.queryId, sqlSha256, resultSha256: result.resultSha256, sourceAsOf: result.sourceAsOf });
    }

    if (reportDay === undefined) throw new Error("No core Dune query definitions were configured");
    const existing = await this.store.load(reportDay);
    const brief = new MacroDailyBriefService().normalize({
      reportDay,
      globalMetrics: mergeMetrics(existing.globalMetrics, globalMetrics, (metric) => `${metric.metricName}:${metric.subject}`),
      chainMetrics: mergeMetrics(existing.chainMetrics, chainMetrics, (metric) => `${metric.chain}:${metric.metricName}`),
      hourlyProfiles: [],
    });
    const markdown = renderMacroDailyBrief(brief);
    const history = await this.store.loadComparableHistory({ reportDay, globalMetrics: brief.globalMetrics, chainMetrics: brief.chainReports.flatMap((report) => report.metrics) });
    const dynamics = deriveDynamics(brief, history);
    const delivery = await this.publisher.publish({ brief, dynamics }, options.dryRun !== false);
    assertPayloadSha256(delivery.payloadSha256);
    await this.store.save({ reportDay, queries: executions, globalMetrics, chainMetrics, briefSha256: delivery.payloadSha256, deliveryMode: delivery.deliveryMode });
    return { markdown, reportDay, queryIds: Object.fromEntries(executions.map((execution) => [execution.blueprintId, execution.queryId])) as Readonly<Record<CoreBlueprintId, number>>, deliveryMode: delivery.deliveryMode };
  }
}

function deriveDynamics(brief: MacroDailyBrief, history: { global: Record<string, MacroHistoricalObservation[]>; chain: Record<string, MacroHistoricalObservation[]> }): MacroDailyDynamics {
  return {
    global: Object.fromEntries(brief.globalMetrics.map((metric) => [globalMetricKey(metric), deriveMetricDynamics(brief.reportDay, metric.value, history.global[globalMetricKey(metric)] ?? [])])),
    chain: Object.fromEntries(brief.chainReports.flatMap((report) => report.metrics).map((metric) => [chainMetricKey(metric), deriveMetricDynamics(brief.reportDay, metric.value, history.chain[chainMetricKey(metric)] ?? [])])),
  };
}

function deriveMetricDynamics(reportDay: string, currentValue: number, history: readonly MacroHistoricalObservation[]): MacroMetricDynamics {
  const values = new Map(history.map((observation) => [observation.reportDay, observation.value]));
  const priorDay = values.get(dayOffset(reportDay, 1));
  const baseline = Array.from({ length: 7 }, (_value, index) => values.get(dayOffset(reportDay, index + 1))).filter((value): value is number => value !== undefined);
  const result: MacroMetricDynamics = { baselineDayCount: baseline.length };
  if (priorDay !== undefined && priorDay > 0) result.dayChangePct = ((currentValue / priorDay) - 1) * 100;
  if (baseline.length === 7) {
    const median = baseline.slice().sort((a, b) => a - b)[3]!;
    if (median > 0) result.sevenDayRelativePct = (currentValue / median) * 100;
  }
  return result;
}

function globalMetricKey(metric: MacroGlobalMetricObservation): string { return `${metric.metricName}:${metric.subject}`; }
function chainMetricKey(metric: MacroChainMetricObservation): string { return `${metric.chain}:${metric.metricName}`; }
function dayOffset(reportDay: string, days: number): string {
  const date = new Date(`${reportDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function observationsFor(definition: CoreQueryDefinition, result: { reportDay: string; values: Record<string, number>; sourceAsOf: Date }, queryId: number, queryVersion: string): { globalMetrics: MacroGlobalMetricObservation[]; chainMetrics: MacroChainMetricObservation[] } {
  const base = { reportDay: result.reportDay, source: "dune" as const, queryRef: `dune:query:${queryId}`, queryVersion, sourceAsOf: result.sourceAsOf, computedAt: new Date(), completeness: 1 };
  const globalMetrics: MacroGlobalMetricObservation[] = [];
  const chainMetrics: MacroChainMetricObservation[] = [];
  for (const metric of definition.metrics) {
    const value = result.values[metric.column];
    if (value === undefined || !Number.isFinite(value) || value < 0) throw new Error(`Dune core response is missing a valid ${metric.column} value for ${definition.blueprintId}`);
    const warnings = metric.warningCodes.map((code) => ({ code }));
    if (metric.scope === "global") globalMetrics.push({ ...base, metricName: metric.metricName, subject: metric.subject, value, unit: metric.unit, warnings });
    else chainMetrics.push({ ...base, chain: metric.chain, section: metric.section, metricName: metric.metricName, value, unit: metric.unit, registryVersion: metric.registryVersion, coverageStatus: metric.coverageStatus, warnings });
  }
  return { globalMetrics, chainMetrics };
}

function mergeMetrics<T>(existing: readonly T[], incoming: readonly T[], key: (metric: T) => string): T[] {
  const values = new Map(existing.map((metric) => [key(metric), metric]));
  incoming.forEach((metric) => values.set(key(metric), metric));
  return [...values.values()];
}

function assertReportDay(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Dune core response report_day must be an ISO date");
}

function assertQueryId(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Dune core query ID must be a positive integer");
}

function assertResultProvenance(sourceAsOf: Date, resultSha256: string): void {
  if (!(sourceAsOf instanceof Date) || Number.isNaN(sourceAsOf.getTime())) throw new Error("Dune core response source_as_of must be a valid timestamp");
  if (!/^[0-9a-f]{64}$/.test(resultSha256)) throw new Error("Dune core response result hash must be a SHA-256 hex digest");
}

function assertPayloadSha256(value: string): void {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error("Delivery payload hash must be a SHA-256 hex digest");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
