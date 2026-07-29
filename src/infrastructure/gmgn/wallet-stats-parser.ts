export const GMGN_WALLET_STATS_PARSER_VERSION = "gmgn-wallet-stats-v2";

export type GmgnWalletStatsStatus = "MAPPED" | "PARTIAL" | "UNAVAILABLE";
export type GmgnWalletStatsMapping = "direct_identity" | "wallet_keyed" | "record_list" | null;

export interface GmgnWalletStatsAggregate {
  periodPnl?: number;
  realizedProfit?: number;
  realizedProfitPnl?: number;
  winRate?: number;
  tradeCount?: number;
  buyCount?: number;
  sellCount?: number;
  boughtCost?: number;
  soldIncome?: number;
  lastActiveTimestamp?: number;
  tokenNum?: number;
}

export interface GmgnWalletStatsResult {
  wallet: string;
  parserVersion: typeof GMGN_WALLET_STATS_PARSER_VERSION;
  status: GmgnWalletStatsStatus;
  mapping: GmgnWalletStatsMapping;
  completeness: number;
  aggregates: GmgnWalletStatsAggregate;
  warningCodes: string[];
}

export interface GmgnWalletStatsParseOptions {
  expectedPeriod?: "7d" | "30d";
}

export const ALLOWLISTED_WALLET_STATS_WARNING_CODES = [
  "gmgn_wallet_metric_unavailable",
  "gmgn_expected_metrics_unavailable",
  "gmgn_wallet_stats_schema_unrecognized",
  "gmgn_wallet_stats_identity_mismatch",
  "gmgn_wallet_stats_period_mismatch",
  "gmgn_wallet_stats_period_unverified",
  "gmgn_wallet_stats_partial_fields",
  "gmgn_wallet_stats_invalid_field_type",
  "gmgn_wallet_stats_win_rate_unit_ambiguous",
] as const;

type JsonRecord = Record<string, unknown>;

interface ResolvedRecordCandidate {
  record: JsonRecord;
  mapping: Exclude<GmgnWalletStatsMapping, null>;
}

const TOTAL_SCHEMA_FIELDS = 11;

/**
 * Version 2 Parser for GMGN Wallet Stats.
 * Implements strict schema contracts, explicit envelope matching, zero arbitrary depth recursion,
 * expectedPeriod verification, coverage-based completeness, and fail-closed type validation.
 */
export function parseGmgnWalletStats(
  payload: unknown,
  wallets: readonly string[],
  options?: "7d" | "30d" | GmgnWalletStatsParseOptions,
): GmgnWalletStatsResult[] {
  const expectedPeriod: "7d" | "30d" =
    typeof options === "string"
      ? options
      : typeof options === "object" && options !== null && options.expectedPeriod
        ? options.expectedPeriod
        : "7d";

  return wallets.map((wallet) => parseWalletResult(payload, wallet, expectedPeriod));
}

function parseWalletResult(
  payload: unknown,
  wallet: string,
  expectedPeriod: "7d" | "30d",
): GmgnWalletStatsResult {
  const candidate = resolveRecordCandidate(payload, wallet);
  if (!candidate) {
    return {
      wallet,
      parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
      status: "UNAVAILABLE",
      mapping: null,
      completeness: 0,
      aggregates: {},
      warningCodes: ["gmgn_wallet_stats_schema_unrecognized"],
    };
  }

  const { record, mapping } = candidate;

  // Verify wallet identity explicitly matches requested wallet string
  const recordWallet = extractWalletIdentity(record);
  if (recordWallet !== null && recordWallet !== wallet) {
    return {
      wallet,
      parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
      status: "UNAVAILABLE",
      mapping: null,
      completeness: 0,
      aggregates: {},
      warningCodes: ["gmgn_wallet_stats_identity_mismatch"],
    };
  }

  // Check self-describing period contract if present in payload or record
  const payloadPeriod = extractPayloadPeriod(payload, record);
  let periodVerified = false;
  if (payloadPeriod !== null) {
    if (payloadPeriod !== expectedPeriod) {
      return {
        wallet,
        parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
        status: "UNAVAILABLE",
        mapping,
        completeness: 0,
        aggregates: {},
        warningCodes: ["gmgn_wallet_stats_period_mismatch"],
      };
    }
    periodVerified = true;
  }

  const { aggregates, warnings, validCount } = extractAggregates(record, expectedPeriod);

  // Must contain at least one core profit metric
  const hasCoreProfitMetric =
    aggregates.periodPnl !== undefined ||
    aggregates.realizedProfit !== undefined ||
    aggregates.realizedProfitPnl !== undefined;

  if (!hasCoreProfitMetric) {
    return {
      wallet,
      parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
      status: "UNAVAILABLE",
      mapping,
      completeness: 0,
      aggregates: {},
      warningCodes: ["gmgn_expected_metrics_unavailable"],
    };
  }

  const completeness = Math.round((validCount / TOTAL_SCHEMA_FIELDS) * 100) / 100;
  const isComplete = completeness === 1.0;
  const warningCodesSet = new Set<string>(warnings);

  if (!periodVerified) {
    warningCodesSet.add("gmgn_wallet_stats_period_unverified");
  }

  if (!isComplete) {
    warningCodesSet.add("gmgn_wallet_stats_partial_fields");
  }

  return {
    wallet,
    parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
    status: isComplete ? "MAPPED" : "PARTIAL",
    mapping,
    completeness,
    aggregates,
    warningCodes: Array.from(warningCodesSet).sort(),
  };
}

function resolveRecordCandidate(payload: unknown, wallet: string): ResolvedRecordCandidate | null {
  const root = asRecord(payload);
  if (root) {
    // 1. Direct identity envelope at root or root.data / root.result
    if (extractWalletIdentity(root) === wallet) {
      return { record: root, mapping: "direct_identity" };
    }
    const dataRec = asRecord(root.data);
    if (dataRec && extractWalletIdentity(dataRec) === wallet) {
      return { record: dataRec, mapping: "direct_identity" };
    }
    const resRec = asRecord(root.result);
    if (resRec && extractWalletIdentity(resRec) === wallet) {
      return { record: resRec, mapping: "direct_identity" };
    }

    // 2. Wallet-keyed dictionary envelope at root, root.data, or root.result
    if (asRecord(root[wallet])) {
      return { record: root[wallet] as JsonRecord, mapping: "wallet_keyed" };
    }
    if (dataRec && asRecord(dataRec[wallet])) {
      return { record: dataRec[wallet] as JsonRecord, mapping: "wallet_keyed" };
    }
    if (resRec && asRecord(resRec[wallet])) {
      return { record: resRec[wallet] as JsonRecord, mapping: "wallet_keyed" };
    }

    // 3. Record-list envelope under root containers or sub-containers (e.g. root.data.rows)
    const rawContainers = [
      root.data, root.result, root.rows, root.list, root.wallets, root.records, root.results,
      dataRec?.rows, dataRec?.list, dataRec?.wallets, dataRec?.records, dataRec?.results, dataRec?.data,
      resRec?.rows, resRec?.list, resRec?.wallets, resRec?.records, resRec?.results, resRec?.data,
    ];
    for (const container of rawContainers) {
      if (Array.isArray(container)) {
        const found = findRecordInList(container, wallet);
        if (found) return { record: found, mapping: "record_list" };
      }
    }
  }

  // 4. Top-level array of records
  if (Array.isArray(payload)) {
    const found = findRecordInList(payload, wallet);
    if (found) return { record: found, mapping: "record_list" };
  }

  return null;
}

function findRecordInList(list: unknown[], wallet: string): JsonRecord | null {
  for (const item of list) {
    const rec = asRecord(item);
    if (rec && extractWalletIdentity(rec) === wallet) {
      return rec;
    }
  }
  return null;
}

function extractWalletIdentity(record: JsonRecord): string | null {
  for (const key of ["wallet", "address", "wallet_address", "user_address"]) {
    const val = record[key];
    if (typeof val === "string" && val.trim()) {
      return val.trim();
    }
  }
  return null;
}

function extractPayloadPeriod(payload: unknown, record: JsonRecord): "7d" | "30d" | null {
  const root = asRecord(payload);
  const sources = [record, root, root?.data as JsonRecord, root?.result as JsonRecord];
  const keys = ["period", "window", "time_frame", "timeframe", "bucket"];

  for (const src of sources) {
    if (!src) continue;
    for (const key of keys) {
      const val = src[key];
      if (val === "7d" || val === "7_days" || val === "7" || val === 7) return "7d";
      if (val === "30d" || val === "30_days" || val === "30" || val === 30) return "30d";
    }
  }
  return null;
}

function extractAggregates(
  record: JsonRecord,
  expectedPeriod: "7d" | "30d",
): { aggregates: GmgnWalletStatsAggregate; warnings: string[]; validCount: number } {
  const aggregates: GmgnWalletStatsAggregate = {};
  const warnings: string[] = [];

  const pnlKeys = expectedPeriod === "30d"
    ? new Set(["pnl_30d", "realized_pnl_30d", "pnl", "total_pnl", "pnl_usd", "realized_pnl"])
    : new Set(["pnl_7d", "realized_pnl_7d", "pnl", "total_pnl", "pnl_usd", "realized_pnl"]);

  const realizedProfitKeys = expectedPeriod === "30d"
    ? new Set(["realized_profit_30d", "realized_profit", "realized_profit_usd", "total_profit", "total_profit_usd"])
    : new Set(["realized_profit_7d", "realized_profit", "realized_profit_usd", "total_profit", "total_profit_usd"]);

  const realizedProfitPnlKeys = expectedPeriod === "30d"
    ? new Set(["realized_profit_pnl_30d", "realized_profit_pnl"])
    : new Set(["realized_profit_pnl_7d", "realized_profit_pnl"]);

  const winRateKeys = expectedPeriod === "30d"
    ? new Set(["winrate_30d", "win_rate_30d", "winrate", "win_rate", "winning_rate", "win_rate_percent"])
    : new Set(["winrate_7d", "win_rate_7d", "winrate", "win_rate", "winning_rate", "win_rate_percent"]);

  const tradeCountKeys = expectedPeriod === "30d"
    ? new Set(["trade_count_30d", "trades_30d", "tx_count_30d", "trade_count", "trade_num", "total_trades", "trades", "tx_count"])
    : new Set(["trade_count_7d", "trades_7d", "tx_count_7d", "trade_count", "trade_num", "total_trades", "trades", "tx_count"]);

  const buyCountKeys = expectedPeriod === "30d"
    ? new Set(["buy_30d", "buy_count_30d", "buy", "buy_count", "bought_count", "buy_num"])
    : new Set(["buy_7d", "buy_count_7d", "buy", "buy_count", "bought_count", "buy_num"]);

  const sellCountKeys = expectedPeriod === "30d"
    ? new Set(["sell_30d", "sell_count_30d", "sell", "sell_count", "sold_count", "sell_num"])
    : new Set(["sell_7d", "sell_count_7d", "sell", "sell_count", "sold_count", "sell_num"]);

  const boughtCostKeys = expectedPeriod === "30d"
    ? new Set(["bought_cost_30d", "total_cost_30d", "bought_cost", "total_cost", "buy_volume"])
    : new Set(["bought_cost_7d", "total_cost_7d", "bought_cost", "total_cost", "buy_volume"]);

  const soldIncomeKeys = expectedPeriod === "30d"
    ? new Set(["sold_income_30d", "total_income_30d", "sold_income", "total_income", "sell_volume"])
    : new Set(["sold_income_7d", "total_income_7d", "sold_income", "total_income", "sell_volume"]);

  const lastActiveTimestampKeys = new Set([
    "last_timestamp", "last_active_timestamp", "last_trade_time", "last_active_time", "last_active", "updated_at",
  ]);

  const tokenNumKeys = expectedPeriod === "30d"
    ? new Set(["token_num_30d", "token_count_30d", "token_num", "token_count", "total_tokens"])
    : new Set(["token_num_7d", "token_count_7d", "token_num", "token_count", "total_tokens"]);

  const forbiddenPeriodKeys = expectedPeriod === "30d"
    ? new Set(["pnl_7d", "realized_profit_7d", "realized_profit_pnl_7d", "winrate_7d", "win_rate_7d", "trade_count_7d", "trades_7d", "tx_count_7d", "buy_7d", "buy_count_7d", "sell_7d", "sell_count_7d", "bought_cost_7d", "total_cost_7d", "sold_income_7d", "total_income_7d", "token_num_7d", "token_count_7d"])
    : new Set(["pnl_30d", "realized_profit_30d", "realized_profit_pnl_30d", "winrate_30d", "win_rate_30d", "trade_count_30d", "trades_30d", "tx_count_30d", "buy_30d", "buy_count_30d", "sell_30d", "sell_count_30d", "bought_cost_30d", "total_cost_30d", "sold_income_30d", "total_income_30d", "token_num_30d", "token_count_30d"]);

  const sourcesToInspect: JsonRecord[] = [record];
  const pnlStat = asRecord(record.pnl_stat);
  if (pnlStat) sourcesToInspect.push(pnlStat);
  const statsRec = asRecord(record.stats);
  if (statsRec) sourcesToInspect.push(statsRec);

  for (const src of sourcesToInspect) {
    for (const [key, rawVal] of Object.entries(src)) {
      if (forbiddenPeriodKeys.has(key)) continue;

    if (aggregates.periodPnl === undefined && pnlKeys.has(key)) {
      const num = parseStrictNumber(rawVal);
      if (num !== undefined) aggregates.periodPnl = num;
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.realizedProfit === undefined && realizedProfitKeys.has(key)) {
      const num = parseStrictNumber(rawVal);
      if (num !== undefined) aggregates.realizedProfit = num;
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.realizedProfitPnl === undefined && realizedProfitPnlKeys.has(key)) {
      const num = parseStrictNumber(rawVal);
      if (num !== undefined) aggregates.realizedProfitPnl = num;
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.winRate === undefined && winRateKeys.has(key)) {
      const num = parseStrictNumber(rawVal);
      if (num !== undefined && num >= 0 && num <= 100) {
        aggregates.winRate = num;
      } else if (rawVal !== undefined && rawVal !== null) {
        warnings.push("gmgn_wallet_stats_win_rate_unit_ambiguous");
      }
    }

    if (aggregates.tradeCount === undefined && tradeCountKeys.has(key)) {
      const num = parseStrictInteger(rawVal);
      if (num !== undefined && num >= 0) aggregates.tradeCount = num;
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.buyCount === undefined && buyCountKeys.has(key)) {
      const num = parseStrictInteger(rawVal);
      if (num !== undefined && num >= 0) aggregates.buyCount = num;
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.sellCount === undefined && sellCountKeys.has(key)) {
      const num = parseStrictInteger(rawVal);
      if (num !== undefined && num >= 0) aggregates.sellCount = num;
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.boughtCost === undefined && boughtCostKeys.has(key)) {
      const num = parseNonNegativeNumber(rawVal);
      if (num !== undefined) aggregates.boughtCost = num;
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.soldIncome === undefined && soldIncomeKeys.has(key)) {
      const num = parseNonNegativeNumber(rawVal);
      if (num !== undefined) aggregates.soldIncome = num;
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.lastActiveTimestamp === undefined && lastActiveTimestampKeys.has(key)) {
      const num = parsePositiveNumber(rawVal);
      if (num !== undefined) aggregates.lastActiveTimestamp = num;
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.tokenNum === undefined && tokenNumKeys.has(key)) {
      const num = parseStrictInteger(rawVal);
      if (num !== undefined && num >= 0) aggregates.tokenNum = num;
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }
  }
  }

  if (aggregates.tradeCount === undefined && aggregates.buyCount !== undefined && aggregates.sellCount !== undefined) {
    aggregates.tradeCount = aggregates.buyCount + aggregates.sellCount;
  }

  const validCount = Object.keys(aggregates).length;
  return { aggregates, warnings, validCount };
}

function parseStrictNumber(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(val.trim())) {
    const num = Number(val.trim());
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
}

function parseNonNegativeNumber(val: unknown): number | undefined {
  const num = parseStrictNumber(val);
  return num !== undefined && num >= 0 ? num : undefined;
}

function parsePositiveNumber(val: unknown): number | undefined {
  const num = parseStrictNumber(val);
  return num !== undefined && num > 0 ? num : undefined;
}

function parseStrictInteger(val: unknown): number | undefined {
  const num = parseStrictNumber(val);
  return num !== undefined && Number.isSafeInteger(num) ? num : undefined;
}

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonRecord) : undefined;
}
