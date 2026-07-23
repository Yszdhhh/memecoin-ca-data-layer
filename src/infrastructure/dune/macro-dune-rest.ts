import { createHash } from "node:crypto";

export type DuneHttpTransport = (request: { url: string; method: "GET" | "POST"; headers: Readonly<Record<string, string>>; body?: string }) => Promise<{ status: number; body: unknown }>;
export interface DuneEnvironment { readonly DUNE_API_KEY?: string; }

export interface DuneSavedQueryAllowlistEntry {
  readonly blueprintId: string;
  readonly queryId: number;
  readonly queryVersion: number;
  readonly sqlSha256: string;
  readonly columns: readonly string[];
  readonly queryParameters?: Readonly<{ report_day: string }>;
}

export interface DuneAggregateQueryResult {
  readonly blueprintId: string;
  readonly queryId: number;
  readonly queryVersion: number;
  readonly reportDay: string;
  readonly values: Readonly<Record<string, number>>;
  readonly sourceAsOf: Date;
  readonly resultSha256: string;
}

const duneApiBaseUrl = "https://api.dune.com/api/v1";

const defaultTransport: DuneHttpTransport = async (request) => {
  const response = await fetch(request.url, { method: request.method, headers: request.headers, ...(request.body === undefined ? {} : { body: request.body }) });
  const body: unknown = await response.json().catch(() => null);
  return { status: response.status, body };
};

export class MacroDuneRest {
  constructor(
    private readonly environment: DuneEnvironment = process.env,
    private readonly transport: DuneHttpTransport = defaultTransport,
    private readonly wait: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    private readonly maxPolls = 20,
    private readonly pollIntervalMs = 3_000,
  ) {}

  async runAggregateQuery(entry: DuneSavedQueryAllowlistEntry): Promise<DuneAggregateQueryResult> {
    assertAllowlistEntry(entry);
    const headers = this.headers();
    const query = await this.request("GET", `/query/${entry.queryId}`, headers);
    assertQueryMetadata(query, entry);

    const execution = await this.request("POST", `/query/${entry.queryId}/execute`, headers, JSON.stringify(entry.queryParameters === undefined ? {} : { query_parameters: entry.queryParameters }));
    const executionId = readString(execution, "execution_id");
    if (executionId === null) throw new Error("Dune execution response is invalid");

    for (let attempt = 0; attempt < this.maxPolls; attempt += 1) {
      const result = await this.request("GET", `/execution/${encodeURIComponent(executionId)}/results`, headers);
      const finished = readBoolean(result, "is_execution_finished");
      if (finished === false) {
        await this.wait(this.pollIntervalMs);
        continue;
      }
      return parseAggregateResult(result, entry);
    }
    throw new Error("Dune execution polling timed out");
  }

  private headers(): Readonly<Record<string, string>> {
    const apiKey = this.environment.DUNE_API_KEY;
    if (typeof apiKey !== "string" || !apiKey.trim()) throw new Error("DUNE_API_KEY is required at runtime");
    return { "X-DUNE-API-KEY": apiKey, "Content-Type": "application/json" };
  }

  private async request(method: "GET" | "POST", path: string, headers: Readonly<Record<string, string>>, body?: string): Promise<unknown> {
    const response = await this.transport({ url: `${duneApiBaseUrl}${path}`, method, headers, ...(body === undefined ? {} : { body }) });
    if (response.status < 200 || response.status >= 300) throw new Error(`Dune API request failed with status ${response.status}`);
    return response.body;
  }
}

function assertAllowlistEntry(entry: DuneSavedQueryAllowlistEntry): void {
  if (!entry.blueprintId.trim()) throw new Error("Dune allowlist blueprint ID is required");
  if (!Number.isSafeInteger(entry.queryId) || entry.queryId <= 0) throw new Error("Dune allowlist query ID must be a positive integer");
  if (!Number.isSafeInteger(entry.queryVersion) || entry.queryVersion <= 0) throw new Error("Dune allowlist query version must be a positive integer");
  if (!/^[0-9a-f]{64}$/.test(entry.sqlSha256)) throw new Error("Dune allowlist SQL hash must be SHA-256 hex");
  if (entry.columns.length === 0 || new Set(entry.columns).size !== entry.columns.length || !entry.columns.includes("report_day")) throw new Error("Dune allowlist columns must be unique and include report_day");
  if (entry.queryParameters !== undefined) {
    const parameterKeys = Object.keys(entry.queryParameters);
    if (parameterKeys.length !== 1 || parameterKeys[0] !== "report_day" || !isIsoDay(entry.queryParameters.report_day)) throw new Error("Dune query parameters must contain only a UTC report_day");
  }
}

function assertQueryMetadata(value: unknown, entry: DuneSavedQueryAllowlistEntry): void {
  if (!isRecord(value) || value.query_id !== entry.queryId || value.version !== entry.queryVersion || typeof value.query_sql !== "string") throw new Error("Dune saved query metadata does not match the allowlist");
  if (sha256(value.query_sql) !== entry.sqlSha256) throw new Error("Dune saved query SQL hash drift detected");
  if (value.is_archived === true || value.is_temp === true || value.is_unsaved === true) throw new Error("Dune saved query is not executable");
}

function parseAggregateResult(value: unknown, entry: DuneSavedQueryAllowlistEntry): DuneAggregateQueryResult {
  if (!isRecord(value) || value.state !== "QUERY_STATE_COMPLETED" || value.query_id !== entry.queryId || value.is_execution_finished !== true) throw new Error("Dune execution did not complete successfully");
  const endedAt = readDate(value, "execution_ended_at");
  const result = isRecord(value.result) ? value.result : null;
  const metadata = result !== null && isRecord(result.metadata) ? result.metadata : null;
  const rows = result?.rows;
  if (metadata === null || !sameStringArray(metadata.column_names, entry.columns) || metadata.row_count !== 1 || metadata.total_row_count !== 1 || value.next_uri !== undefined || !Array.isArray(rows) || rows.length !== 1 || !isRecord(rows[0])) throw new Error("Dune aggregate result schema does not match the allowlist");
  const row = rows[0];
  const reportDay = readIsoDay(row.report_day);
  if (reportDay === null) throw new Error("Dune aggregate result report day is invalid");
  const values: Record<string, number> = {};
  for (const column of entry.columns) {
    if (column === "report_day") continue;
    const valueAtColumn = row[column];
    if (typeof valueAtColumn !== "number" || !Number.isFinite(valueAtColumn) || valueAtColumn < 0) throw new Error(`Dune aggregate result contains an invalid ${column} value`);
    values[column] = valueAtColumn;
  }
  return { blueprintId: entry.blueprintId, queryId: entry.queryId, queryVersion: entry.queryVersion, reportDay, values, sourceAsOf: endedAt, resultSha256: sha256(JSON.stringify({ report_day: reportDay, ...Object.fromEntries(Object.entries(values).sort(([left], [right]) => left.localeCompare(right))) })) };
}

function sameStringArray(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index]);
}

function readString(value: unknown, field: string): string | null { return isRecord(value) && typeof value[field] === "string" && value[field].trim() ? value[field] : null; }
function readBoolean(value: unknown, field: string): boolean | null { return isRecord(value) && typeof value[field] === "boolean" ? value[field] : null; }
function readDate(value: Record<string, unknown>, field: string): Date { const timestamp = readString(value, field); const parsed = timestamp === null ? Number.NaN : Date.parse(timestamp); if (Number.isNaN(parsed)) throw new Error("Dune execution timestamp is invalid"); return new Date(parsed); }
function readIsoDay(value: unknown): string | null { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; const parsed = new Date(`${value}T00:00:00.000Z`); return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value; }
function isIsoDay(value: string): boolean { return readIsoDay(value) !== null; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
export function duneSha256(value: string): string { return sha256(value); }
function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }