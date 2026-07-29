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
 * mandatory expectedPeriod verification, coverage-based completeness without tradeCount derivation,
 * and fail-closed type/unit validation.
 */
export function parseGmgnWalletStats(
  payload: unknown,
  wallets: readonly string[],
  expectedPeriod: "7d" | "30d",
): GmgnWalletStatsResult[] {
  if (expectedPeriod !== "7d" && expectedPeriod !== "30d") {
    throw new Error("expectedPeriod must be explicitly '7d' or '30d'");
  }

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
  const periodStatus = extractPayloadPeriodStatus(payload, record, expectedPeriod);
  if (periodStatus === "mismatch") {
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
  const periodVerified = periodStatus === "verified";

  // Container isolation: extract metrics from candidate metric containers
  const containerResult = selectUniqueMetricContainer(record, expectedPeriod);
  if (!containerResult.success) {
    return {
      wallet,
      parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
      status: "UNAVAILABLE",
      mapping,
      completeness: 0,
      aggregates: {},
      warningCodes: [containerResult.warningCode],
    };
  }

  const { aggregates, validCount, warnings } = containerResult;

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
  const isComplete = validCount === TOTAL_SCHEMA_FIELDS;
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

function extractPayloadPeriodStatus(
  payload: unknown,
  record: JsonRecord,
  expectedPeriod: "7d" | "30d",
): "verified" | "unverified" | "mismatch" {
  const root = asRecord(payload);
  const sources = [record, root, root?.data as JsonRecord, root?.result as JsonRecord];
  const keys = ["period", "window", "time_frame", "timeframe", "bucket"];

  for (const src of sources) {
    if (!src) continue;
    for (const key of keys) {
      if (!(key in src)) continue;
      const val = src[key];
      let periodVal: "7d" | "30d" | "unsupported" | null = null;
      if (val === "7d" || val === "7_days" || val === "7" || val === 7) periodVal = "7d";
      else if (val === "30d" || val === "30_days" || val === "30" || val === 30) periodVal = "30d";
      else periodVal = "unsupported";

      if (periodVal === "unsupported" || periodVal !== expectedPeriod) {
        return "mismatch";
      }
      return "verified";
    }
  }
  return "unverified";
}

type ContainerSelectionResult =
  | { success: true; aggregates: GmgnWalletStatsAggregate; validCount: number; warnings: string[] }
  | { success: false; warningCode: string };

function selectUniqueMetricContainer(
  record: JsonRecord,
  expectedPeriod: "7d" | "30d",
): ContainerSelectionResult {
  // Construct candidate metric containers from record:
  // 1. Direct scalar/primitive properties of record (excluding nested object containers like pnl_stat, stats, etc.)
  const rootScalars: JsonRecord = {};
  for (const [key, val] of Object.entries(record)) {
    if (val === null || typeof val !== "object") {
      rootScalars[key] = val;
    }
  }

  const candidates: Array<{ name: string; container: JsonRecord }> = [];
  candidates.push({ name: "root", container: rootScalars });

  const pnlStatRec = asRecord(record.pnl_stat);
  if (pnlStatRec) {
    candidates.push({ name: "pnl_stat", container: pnlStatRec });
  }

  const statsRec = asRecord(record.stats);
  if (statsRec) {
    candidates.push({ name: "stats", container: statsRec });
  }

  const metricRuns = candidates.map((cand) => ({
    name: cand.name,
    ...extractMetricsFromSingleContainer(cand.container, expectedPeriod),
  })).filter((run) => run.validCount > 0 || run.warnings.length > 0);

  const runsWithValidMetrics = metricRuns.filter((run) => run.validCount > 0);

  if (runsWithValidMetrics.length === 0) {
    return { success: false, warningCode: "gmgn_expected_metrics_unavailable" };
  }

  if (runsWithValidMetrics.length > 1) {
    // Cross-node composition or multiple containers with metrics -> Fail-closed!
    return { success: false, warningCode: "gmgn_wallet_stats_schema_unrecognized" };
  }

  const selected = runsWithValidMetrics[0]!;
  return {
    success: true,
    aggregates: selected.aggregates,
    validCount: selected.validCount,
    warnings: selected.warnings,
  };
}

function extractMetricsFromSingleContainer(
  container: JsonRecord,
  expectedPeriod: "7d" | "30d",
): { aggregates: GmgnWalletStatsAggregate; validCount: number; warnings: string[] } {
  const aggregates: GmgnWalletStatsAggregate = {};
  const warnings: string[] = [];
  let validCount = 0;

  const pnlKeys = expectedPeriod === "30d"
    ? new Set(["pnl_30d", "realized_pnl_30d", "pnl", "total_pnl", "pnl_usd", "realized_pnl"])
    : new Set(["pnl_7d", "realized_pnl_7d", "pnl", "total_pnl", "pnl_usd", "realized_pnl"]);

  const realizedProfitKeys = expectedPeriod === "30d"
    ? new Set(["realized_profit_30d", "realized_profit", "realized_profit_usd", "total_profit", "total_profit_usd"])
    : new Set(["realized_profit_7d", "realized_profit", "realized_profit_usd", "total_profit", "total_profit_usd"]);

  const realizedProfitPnlKeys = expectedPeriod === "30d"
    ? new Set(["realized_profit_pnl_30d", "realized_profit_pnl"])
    : new Set(["realized_profit_pnl_7d", "realized_profit_pnl"]);

  const winRatePercentKeys = expectedPeriod === "30d"
    ? new Set(["winrate_30d", "win_rate_30d", "winrate", "win_rate", "winning_rate", "win_rate_percent"])
    : new Set(["winrate_7d", "win_rate_7d", "winrate", "win_rate", "winning_rate", "win_rate_percent"]);

  const winRateRatioKeys = new Set(["win_rate_ratio", "winrate_ratio"]);

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

  for (const [key, rawVal] of Object.entries(container)) {
    if (forbiddenPeriodKeys.has(key)) continue;

    if (aggregates.periodPnl === undefined && pnlKeys.has(key)) {
      const num = parseStrictNumber(rawVal);
      if (num !== undefined) { aggregates.periodPnl = num; validCount++; }
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.realizedProfit === undefined && realizedProfitKeys.has(key)) {
      const num = parseStrictNumber(rawVal);
      if (num !== undefined) { aggregates.realizedProfit = num; validCount++; }
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.realizedProfitPnl === undefined && realizedProfitPnlKeys.has(key)) {
      const num = parseStrictNumber(rawVal);
      if (num !== undefined) { aggregates.realizedProfitPnl = num; validCount++; }
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.winRate === undefined) {
      if (winRatePercentKeys.has(key)) {
        const num = parseStrictNumber(rawVal);
        if (num !== undefined) {
          if (num > 0 && num < 1) {
            // Ambiguous (e.g. 0.4 could be 0.4% or ratio 0.40) -> fail-closed with warning
            warnings.push("gmgn_wallet_stats_win_rate_unit_ambiguous");
          } else if (num >= 0 && num <= 100) {
            aggregates.winRate = num;
            validCount++;
          } else {
            // Out of percentage range (> 100 or < 0)
            warnings.push("gmgn_wallet_stats_win_rate_unit_ambiguous");
          }
        } else if (rawVal !== undefined && rawVal !== null) {
          warnings.push("gmgn_wallet_stats_win_rate_unit_ambiguous");
        }
      } else if (winRateRatioKeys.has(key)) {
        const num = parseStrictNumber(rawVal);
        if (num !== undefined && num >= 0 && num <= 1) {
          aggregates.winRate = Math.round(num * 100 * 100) / 100;
          validCount++;
        } else if (rawVal !== undefined && rawVal !== null) {
          warnings.push("gmgn_wallet_stats_win_rate_unit_ambiguous");
        }
      }
    }

    if (aggregates.tradeCount === undefined && tradeCountKeys.has(key)) {
      const num = parseStrictInteger(rawVal);
      if (num !== undefined && num >= 0) { aggregates.tradeCount = num; validCount++; }
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.buyCount === undefined && buyCountKeys.has(key)) {
      const num = parseStrictInteger(rawVal);
      if (num !== undefined && num >= 0) { aggregates.buyCount = num; validCount++; }
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.sellCount === undefined && sellCountKeys.has(key)) {
      const num = parseStrictInteger(rawVal);
      if (num !== undefined && num >= 0) { aggregates.sellCount = num; validCount++; }
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.boughtCost === undefined && boughtCostKeys.has(key)) {
      const num = parseNonNegativeNumber(rawVal);
      if (num !== undefined) { aggregates.boughtCost = num; validCount++; }
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.soldIncome === undefined && soldIncomeKeys.has(key)) {
      const num = parseNonNegativeNumber(rawVal);
      if (num !== undefined) { aggregates.soldIncome = num; validCount++; }
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.lastActiveTimestamp === undefined && lastActiveTimestampKeys.has(key)) {
      const num = parsePositiveNumber(rawVal);
      if (num !== undefined) { aggregates.lastActiveTimestamp = num; validCount++; }
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }

    if (aggregates.tokenNum === undefined && tokenNumKeys.has(key)) {
      const num = parseStrictInteger(rawVal);
      if (num !== undefined && num >= 0) { aggregates.tokenNum = num; validCount++; }
      else if (rawVal !== undefined && rawVal !== null) warnings.push("gmgn_wallet_stats_invalid_field_type");
    }
  }

  // NOTE: tradeCount is NOT derived from buyCount + sellCount.
  // Completeness only counts fields explicitly present and strictly valid in provider payload.

  return { aggregates, validCount, warnings };
}

function parseStrictNumber(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      return Number.isFinite(num) ? num : undefined;
    }
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
