export const GMGN_WALLET_HOLDINGS_PARSER_VERSION = "gmgn-wallet-holdings-v1";

export const ALLOWLISTED_GMGN_HOLDINGS_WARNING_CODES = [
  "gmgn_response_invalid",
  "gmgn_expected_metrics_unavailable",
  "gmgn_holdings_cursor_remaining",
] as const;

export type AllowlistedGmgnHoldingsWarningCode =
  (typeof ALLOWLISTED_GMGN_HOLDINGS_WARNING_CODES)[number];

export interface NormalizedCumulativeWalletMetrics {
  realizedProfit: number | null;
  boughtCost: number | null;
  soldIncome: number | null;
  lastActiveTimestamp: number | null;
  tokenNum: number | null;
}

export interface ParsedGmgnWalletHoldingsPage {
  parserVersion: typeof GMGN_WALLET_HOLDINGS_PARSER_VERSION;
  source: "gmgn";
  verificationStatus: "unverified";
  status: "MAPPED" | "PARTIAL" | "UNAVAILABLE";
  completeness: number;
  aggregates: NormalizedCumulativeWalletMetrics;
  warningCodes: AllowlistedGmgnHoldingsWarningCode[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstFinite(record: JsonRecord, keys: readonly string[]): number | null {
  for (const key of keys) {
    const parsed = finiteNumber(record[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function sumMetric(rows: JsonRecord[], keys: readonly string[]): number | null {
  let total = 0;
  let found = false;
  for (const row of rows) {
    const value = firstFinite(row, keys);
    if (value === null) continue;
    total += value;
    found = true;
  }
  return found ? total : null;
}

function maxMetric(rows: JsonRecord[], keys: readonly string[]): number | null {
  let maximum: number | null = null;
  for (const row of rows) {
    const value = firstFinite(row, keys);
    if (value === null) continue;
    maximum = maximum === null ? value : Math.max(maximum, value);
  }
  return maximum;
}

function findHoldingsArray(payload: unknown): JsonRecord[] | null {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return null;

  for (const candidate of [payload.holdings, payload.items, payload.rows, payload.list]) {
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }

  for (const envelopeKey of ["data", "result"]) {
    const envelope = payload[envelopeKey];
    if (Array.isArray(envelope)) return envelope.filter(isRecord);
    if (!isRecord(envelope)) continue;
    for (const candidate of [envelope.holdings, envelope.items, envelope.rows, envelope.list]) {
      if (Array.isArray(candidate)) return candidate.filter(isRecord);
    }
  }
  return null;
}

function findEnvelopeRecords(payload: unknown): JsonRecord[] {
  if (!isRecord(payload)) return [];

  const records = [payload];
  if (isRecord(payload.data)) records.push(payload.data);
  if (isRecord(payload.result)) records.push(payload.result);
  return records;
}

function hasContinuationCursor(payload: unknown): boolean {
  return findEnvelopeRecords(payload).some((record) => {
    for (const key of ["next_cursor", "nextCursor"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim() !== "") return true;
    }
    return false;
  });
}

function findEnvelopeMetric(payload: unknown, keys: readonly string[]): number | null {
  for (const record of findEnvelopeRecords(payload)) {
    const value = firstFinite(record, keys);
    if (value !== null) return value;
  }
  return null;
}

function emptyMetrics(): NormalizedCumulativeWalletMetrics {
  return {
    realizedProfit: null,
    boughtCost: null,
    soldIncome: null,
    lastActiveTimestamp: null,
    tokenNum: null,
  };
}

/**
 * Parses one sanitized provider page into aggregate cumulative metrics only.
 * It deliberately does not return wallet addresses, token identifiers, cursor
 * values, labels, provider text, or the raw payload. A non-terminal cursor is
 * explicit partial coverage rather than evidence of a complete all-time view.
 */
export function parseGmgnWalletHoldingsPage(payload: unknown): ParsedGmgnWalletHoldingsPage {
  const holdings = findHoldingsArray(payload);
  if (holdings === null) {
    return {
      parserVersion: GMGN_WALLET_HOLDINGS_PARSER_VERSION,
      source: "gmgn",
      verificationStatus: "unverified",
      status: "UNAVAILABLE",
      completeness: 0,
      aggregates: emptyMetrics(),
      warningCodes: ["gmgn_response_invalid"],
    };
  }

  const continuation = hasContinuationCursor(payload);
  const aggregates: NormalizedCumulativeWalletMetrics = {
    realizedProfit: sumMetric(holdings, ["realized_profit", "realizedProfit"]),
    boughtCost: sumMetric(holdings, ["history_bought_cost", "historyBoughtCost", "bought_cost"]),
    soldIncome: sumMetric(holdings, ["history_sold_income", "historySoldIncome", "sold_income"]),
    lastActiveTimestamp: maxMetric(holdings, ["last_active_timestamp", "lastActiveTimestamp"]),
    tokenNum: findEnvelopeMetric(payload, ["token_num", "tokenNum"]),
  };

  const metricsPresent = Object.values(aggregates).some((value) => value !== null);
  const warningCodes: AllowlistedGmgnHoldingsWarningCode[] = [];
  if (!metricsPresent) warningCodes.push("gmgn_expected_metrics_unavailable");
  if (continuation) warningCodes.push("gmgn_holdings_cursor_remaining");

  return {
    parserVersion: GMGN_WALLET_HOLDINGS_PARSER_VERSION,
    source: "gmgn",
    verificationStatus: "unverified",
    status: continuation ? "PARTIAL" : metricsPresent ? "MAPPED" : "PARTIAL",
    completeness: continuation ? 0.5 : metricsPresent ? 1 : 0,
    aggregates,
    warningCodes,
  };
}
