import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { sha256, type SavedG2QueryGateway } from "../../application/macro-daily-g2-run-service.js";
import type { CoreDuneQueryGateway } from "../../application/macro-daily-core-run-service.js";
import type { CoreBlueprintId } from "./macro-core-query-definitions.js";

const execFileAsync = promisify(execFile);
export type DuneCommandExecutor = (command: string, arguments_: readonly string[]) => Promise<{ stdout: string }>;

const defaultDuneExecutor: DuneCommandExecutor = async (command, arguments_) => {
  const result = await execFileAsync(command, [...arguments_]);
  return { stdout: String(result.stdout) };
};

export class MacroDuneCli implements SavedG2QueryGateway {
  constructor(private readonly command = "dune", private readonly execute: DuneCommandExecutor = defaultDuneExecutor) {}
  async createPrivateQuery(input: { blueprintId: string; sql: string; sqlSha256: string }): Promise<{ queryId: number }> {
    return createPrivateQuery(this.command, this.execute, input);
  }
  async runQuery(queryId: number): Promise<{ reportDay: string; transactionCount: number; sourceAsOf: Date; resultSha256: string }> {
    const { stdout } = await this.execute(this.command, ["query", "run", String(queryId), "--output", "json"]);
    const parsed = JSON.parse(stdout) as { state?: string; execution_ended_at?: string; result?: { rows?: Array<{ report_day?: string; btc_transaction_count?: number }> } };
    const row = parsed.result?.rows?.[0];
    if (parsed.state !== "QUERY_STATE_COMPLETED" || !row?.report_day || !/^\d{4}-\d{2}-\d{2}$/.test(row.report_day) || !Number.isFinite(row.btc_transaction_count) || !parsed.execution_ended_at) throw new Error("Dune G2 response is incomplete");
    return { reportDay: row.report_day, transactionCount: row.btc_transaction_count!, sourceAsOf: new Date(parsed.execution_ended_at), resultSha256: sha256(JSON.stringify({ btc_transaction_count: row.btc_transaction_count, report_day: row.report_day })) };
  }
}

export class MacroCoreDuneCli implements CoreDuneQueryGateway {
  constructor(private readonly command = "dune", private readonly execute: DuneCommandExecutor = defaultDuneExecutor) {}

  async createPrivateQuery(input: { blueprintId: CoreBlueprintId; sql: string; sqlSha256: string }): Promise<{ queryId: number }> {
    return createPrivateQuery(this.command, this.execute, input);
  }

  async updatePrivateQuery(input: { queryId: number; blueprintId: CoreBlueprintId; sql: string; sqlSha256: string }): Promise<void> {
    if (!Number.isSafeInteger(input.queryId) || input.queryId <= 0) throw new Error("Dune core query ID must be a positive integer");
    await this.execute(this.command, ["query", "update", String(input.queryId), "--name", `Onchain Trench Macro ${input.blueprintId}`, "--description", `sha256:${input.sqlSha256}`, "--private", "--sql", input.sql, "--output", "json"]);
  }

  async runQuery(queryId: number, columns: readonly string[]): Promise<{ reportDay: string; values: Record<string, number>; sourceAsOf: Date; resultSha256: string }> {
    if (!Number.isSafeInteger(queryId) || queryId <= 0) throw new Error("Dune core query ID must be a positive integer");
    if (columns.length === 0 || new Set(columns).size !== columns.length) throw new Error("Dune core query requires unique result columns");
    const { stdout } = await this.execute(this.command, ["query", "run", String(queryId), "--output", "json"]);
    const parsed = JSON.parse(stdout) as { state?: string; execution_ended_at?: string; result?: { rows?: unknown[] } };
    const row = parsed.result?.rows?.[0];
    if (parsed.state !== "QUERY_STATE_COMPLETED" || parsed.result?.rows?.length !== 1 || !isRow(row) || !isIsoDay(row.report_day) || !parsed.execution_ended_at) {
      throw new Error("Dune core response is incomplete");
    }
    const sourceAsOf = new Date(parsed.execution_ended_at);
    if (Number.isNaN(sourceAsOf.getTime())) throw new Error("Dune core response has an invalid execution timestamp");
    const values: Record<string, number> = {};
    for (const column of columns) {
      const value = row[column];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Dune core response has an invalid ${column} value`);
      values[column] = value;
    }
    const canonicalResult = { report_day: row.report_day, ...Object.fromEntries(columns.slice().sort().map((column) => [column, values[column]!])) };
    return { reportDay: row.report_day, values, sourceAsOf, resultSha256: sha256(JSON.stringify(canonicalResult)) };
  }
}

async function createPrivateQuery(command: string, execute: DuneCommandExecutor, input: { blueprintId: string; sql: string; sqlSha256: string }): Promise<{ queryId: number }> {
  const { stdout } = await execute(command, ["query", "create", "--private", "--name", `Onchain Trench Macro ${input.blueprintId}`, "--description", `sha256:${input.sqlSha256}`, "--sql", input.sql, "--output", "json"]);
  const parsed = JSON.parse(stdout) as { query_id?: number };
  const queryId = parsed.query_id;
  if (queryId === undefined || !Number.isSafeInteger(queryId) || queryId <= 0) throw new Error("Dune did not return a valid saved query ID");
  return { queryId };
}

function isRow(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
