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
  "gmgn_wallet_stats_alias_conflict",
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
 * safe runtime envelope validation, global multi-location period collection, alias conflict fail-closed behavior,
 * candidate container ambiguity detection, strict per-field numeric validation, explicit field ownership,
 * fail-closed mislocated metric handling, and winRate unit contracts.
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

  const { aggregates, validCount, warnings, selectedContainer } = containerResult;

  // Collect and validate ALL explicit period declarations across record, root, data, result, and metric containers
  const periodStatus = extractPayloadPeriodStatus(payload, record, expectedPeriod, selectedContainer);
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

  // Check alias conflict warning
  if (warnings.includes("gmgn_wallet_stats_alias_conflict")) {
    return {
      wallet,
      parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
      status: "UNAVAILABLE",
      mapping,
      completeness: 0,
      aggregates: {},
      warningCodes: ["gmgn_wallet_stats_alias_conflict"],
    };
  }

  // Must contain at least one core profit metric
  const hasCoreProfitMetric =
    aggregates.periodPnl !== undefined ||
    aggregates.realizedProfit !== undefined ||
    aggregates.realizedProfitPnl !== undefined;

  if (!hasCoreProfitMetric) {
    const warningCodesSet = new Set<string>(warnings);
    warningCodesSet.add("gmgn_expected_metrics_unavailable");
    return {
      wallet,
      parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
      status: "UNAVAILABLE",
      mapping,
      completeness: 0,
      aggregates: {},
      warningCodes: Array.from(warningCodesSet).sort(),
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
    const rootWalletRec = asRecord(root[wallet]);
    if (rootWalletRec) {
      return { record: rootWalletRec, mapping: "wallet_keyed" };
    }
    if (dataRec) {
      const dataWalletRec = asRecord(dataRec[wallet]);
      if (dataWalletRec) return { record: dataWalletRec, mapping: "wallet_keyed" };
    }
    if (resRec) {
      const resWalletRec = asRecord(resRec[wallet]);
      if (resWalletRec) return { record: resWalletRec, mapping: "wallet_keyed" };
    }

    // 3. Record-list envelope under root containers or sub-containers (e.g. root.data.rows)
    const rawContainers = [
      root.data, root.result, root.rows, root.list, root.wallets, root.records, root.results,
      dataRec?.rows, dataRec?.list, dataRec?.wallets, dataRec?.records, dataRec?.results, dataRec?.data,
      resRec?.rows, resRec?.list, resRec?.wallets, resRec?.records, resRec?.results, resRec?.data,
    ];
    for (const container of rawContainers) {
      const arr = asArray(container);
      if (arr) {
        const found = findRecordInList(arr, wallet);
        if (found) return { record: found, mapping: "record_list" };
      }
    }
  }

  // 4. Top-level array of records
  const topArr = asArray(payload);
  if (topArr) {
    const found = findRecordInList(topArr, wallet);
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
  selectedContainer?: JsonRecord,
): "verified" | "unverified" | "mismatch" {
  const root = asRecord(payload);
  const dataRec = root ? asRecord(root.data) : undefined;
  const resRec = root ? asRecord(root.result) : undefined;

  const sources = [record, root, dataRec, resRec, selectedContainer];
  const keys = ["period", "window", "time_frame", "timeframe", "bucket"];

  const explicitPeriods: string[] = [];

  for (const src of sources) {
    if (!src) continue;
    for (const key of keys) {
      if (!(key in src)) continue;
      const val = src[key];
      if (val === undefined || val === null) continue;

      let periodVal: "7d" | "30d" | "unsupported" | null = null;
      if (val === "7d" || val === "7_days" || val === "7" || val === 7) periodVal = "7d";
      else if (val === "30d" || val === "30_days" || val === "30" || val === 30) periodVal = "30d";
      else periodVal = "unsupported";

      explicitPeriods.push(periodVal);
    }
  }

  if (explicitPeriods.length === 0) {
    return "unverified";
  }

  // Any explicit unsupported value or value mismatch or conflict between multiple locations -> mismatch!
  for (const p of explicitPeriods) {
    if (p === "unsupported" || p !== expectedPeriod) {
      return "mismatch";
    }
  }

  return "verified";
}

const ROOT_OWNED_METRIC_ALIASES_7D = new Set([
  "pnl_7d", "realized_pnl_7d", "pnl", "total_pnl", "pnl_usd", "realized_pnl",
  "realized_profit_7d", "realized_profit", "realized_profit_usd", "total_profit", "total_profit_usd",
  "realized_profit_pnl_7d", "realized_profit_pnl",
  "trade_count_7d", "trades_7d", "tx_count_7d", "trade_count", "trade_num", "total_trades", "trades", "tx_count",
  "buy_7d", "buy_count_7d", "buy", "buy_count", "bought_count", "buy_num",
  "sell_7d", "sell_count_7d", "sell", "sell_count", "sold_count", "sell_num",
  "bought_cost_7d", "total_cost_7d", "bought_cost", "total_cost", "buy_volume",
  "sold_income_7d", "total_income_7d", "sold_income", "total_income", "sell_volume",
  "last_timestamp", "last_active_timestamp", "last_trade_time", "last_active_time", "last_active", "updated_at",
]);

const ROOT_OWNED_METRIC_ALIASES_30D = new Set([
  "pnl_30d", "realized_pnl_30d", "pnl", "total_pnl", "pnl_usd", "realized_pnl",
  "realized_profit_30d", "realized_profit", "realized_profit_usd", "total_profit", "total_profit_usd",
  "realized_profit_pnl_30d", "realized_profit_pnl",
  "trade_count_30d", "trades_30d", "tx_count_30d", "trade_count", "trade_num", "total_trades", "trades", "tx_count",
  "buy_30d", "buy_count_30d", "buy", "buy_count", "bought_count", "buy_num",
  "sell_30d", "sell_count_30d", "sell", "sell_count", "sold_count", "sell_num",
  "bought_cost_30d", "total_cost_30d", "bought_cost", "total_cost", "buy_volume",
  "sold_income_30d", "total_income_30d", "sold_income", "total_income", "sell_volume",
  "last_timestamp", "last_active_timestamp", "last_trade_time", "last_active_time", "last_active", "updated_at",
]);

const PNL_STAT_OWNED_METRIC_ALIASES_7D = new Set([
  "token_num_7d", "token_count_7d", "token_num", "token_count", "total_tokens",
  "winrate_7d", "win_rate_7d", "winrate", "win_rate", "winning_rate", "win_rate_percent", "win_rate_ratio", "winrate_ratio",
]);

const PNL_STAT_OWNED_METRIC_ALIASES_30D = new Set([
  "token_num_30d", "token_count_30d", "token_num", "token_count", "total_tokens",
  "winrate_30d", "win_rate_30d", "winrate", "win_rate", "winning_rate", "win_rate_percent", "win_rate_ratio", "winrate_ratio",
]);

function getRootOwnedMetricAliases(expectedPeriod: "7d" | "30d"): Set<string> {
  return expectedPeriod === "30d" ? ROOT_OWNED_METRIC_ALIASES_30D : ROOT_OWNED_METRIC_ALIASES_7D;
}

function getPnlStatOwnedMetricAliases(expectedPeriod: "7d" | "30d"): Set<string> {
  return expectedPeriod === "30d" ? PNL_STAT_OWNED_METRIC_ALIASES_30D : PNL_STAT_OWNED_METRIC_ALIASES_7D;
}

function hasAnyKeyInSet(container: JsonRecord, keySet: Set<string>): boolean {
  for (const k of Object.keys(container)) {
    if (keySet.has(k)) return true;
  }
  return false;
}

type ContainerSelectionResult =
  | { success: true; aggregates: GmgnWalletStatsAggregate; validCount: number; warnings: string[]; selectedContainer: JsonRecord }
  | { success: false; warningCode: string };

function selectUniqueMetricContainer(
  record: JsonRecord,
  expectedPeriod: "7d" | "30d",
): ContainerSelectionResult {
  // Construct candidate metric containers from record:
  // 1. Direct properties of record (excluding sub-container keys pnl_stat and stats)
  const rootCandidate: JsonRecord = {};
  for (const [key, val] of Object.entries(record)) {
    if (key !== "pnl_stat" && key !== "stats") {
      rootCandidate[key] = val;
    }
  }

  const pnlStatRec = asRecord(record.pnl_stat);
  const statsRec = asRecord(record.stats);

  const rootOwnedAliases = getRootOwnedMetricAliases(expectedPeriod);
  const pnlStatOwnedAliases = getPnlStatOwnedMetricAliases(expectedPeriod);

  const rootHasRootIntent = hasAnyKeyInSet(rootCandidate, rootOwnedAliases);
  const rootHasPnlStatIntent = hasAnyKeyInSet(rootCandidate, pnlStatOwnedAliases);

  const pnlStatHasRootIntent = pnlStatRec ? hasAnyKeyInSet(pnlStatRec, rootOwnedAliases) : false;
  const pnlStatHasPnlStatIntent = pnlStatRec ? hasAnyKeyInSet(pnlStatRec, pnlStatOwnedAliases) : false;

  const statsHasIntent = statsRec
    ? hasAnyKeyInSet(statsRec, rootOwnedAliases) || hasAnyKeyInSet(statsRec, pnlStatOwnedAliases)
    : false;

  // Rule 1: Disallowed container combinations with stats
  if (statsHasIntent && (rootHasRootIntent || rootHasPnlStatIntent || pnlStatHasRootIntent || pnlStatHasPnlStatIntent)) {
    return { success: false, warningCode: "gmgn_wallet_stats_schema_unrecognized" };
  }

  // Rule 2: Standalone stats mode
  if (statsHasIntent && !rootHasRootIntent && !rootHasPnlStatIntent && !pnlStatHasRootIntent && !pnlStatHasPnlStatIntent) {
    const metricExtraction = extractMetricsFromSingleContainer(statsRec!, expectedPeriod, "standalone");
    if (metricExtraction.warnings.includes("gmgn_wallet_stats_alias_conflict")) {
      return { success: false, warningCode: "gmgn_wallet_stats_alias_conflict" };
    }
    return {
      success: true,
      aggregates: metricExtraction.aggregates,
      validCount: metricExtraction.validCount,
      warnings: metricExtraction.warnings,
      selectedContainer: statsRec!,
    };
  }

  // Rule 3: pnl_stat presence checks & strict field ownership enforcement
  if (pnlStatRec) {
    // pnl_stat contains root-owned metrics (e.g. realized_profit, buy_count) -> fail closed!
    if (pnlStatHasRootIntent) {
      return { success: false, warningCode: "gmgn_wallet_stats_schema_unrecognized" };
    }

    // root contains pnl_stat-owned metrics while pnl_stat is present -> fail closed!
    if (rootHasPnlStatIntent) {
      return { success: false, warningCode: "gmgn_wallet_stats_schema_unrecognized" };
    }

    // Official composite mode (root + pnl_stat)
    if (rootHasRootIntent && pnlStatHasPnlStatIntent) {
      const metricExtraction = extractMetricsFromCompositeContainers(rootCandidate, pnlStatRec, expectedPeriod);
      if (metricExtraction.warnings.includes("gmgn_wallet_stats_alias_conflict")) {
        return { success: false, warningCode: "gmgn_wallet_stats_alias_conflict" };
      }
      return {
        success: true,
        aggregates: metricExtraction.aggregates,
        validCount: metricExtraction.validCount,
        warnings: metricExtraction.warnings,
        selectedContainer: rootCandidate,
      };
    }

    // pnl_stat has pnl_stat metrics alone (without root metrics): lacks core profit metrics
    if (pnlStatHasPnlStatIntent && !rootHasRootIntent) {
      return { success: false, warningCode: "gmgn_expected_metrics_unavailable" };
    }
  }

  // Rule 4: Standalone root mode (no pnl_stat object present)
  if (!pnlStatRec && (rootHasRootIntent || rootHasPnlStatIntent)) {
    const metricExtraction = extractMetricsFromSingleContainer(rootCandidate, expectedPeriod, "standalone");
    if (metricExtraction.warnings.includes("gmgn_wallet_stats_alias_conflict")) {
      return { success: false, warningCode: "gmgn_wallet_stats_alias_conflict" };
    }
    return {
      success: true,
      aggregates: metricExtraction.aggregates,
      validCount: metricExtraction.validCount,
      warnings: metricExtraction.warnings,
      selectedContainer: rootCandidate,
    };
  }

  return { success: false, warningCode: "gmgn_expected_metrics_unavailable" };
}

interface AliasGroupDefinition {
  canonicalName: keyof GmgnWalletStatsAggregate;
  aliasKeys: string[];
  fallbackAliasKeys?: string[];
  kind: "number" | "non_negative_number" | "positive_timestamp" | "integer" | "win_rate_percent" | "win_rate_ratio";
}

const ROOT_ALIAS_GROUPS = (expectedPeriod: "7d" | "30d"): AliasGroupDefinition[] => [
  {
    canonicalName: "periodPnl",
    aliasKeys: expectedPeriod === "30d" ? ["pnl_30d", "realized_pnl_30d", "pnl", "total_pnl", "pnl_usd", "realized_pnl"] : ["pnl_7d", "realized_pnl_7d", "pnl", "total_pnl", "pnl_usd", "realized_pnl"],
    kind: "number",
  },
  {
    canonicalName: "realizedProfit",
    aliasKeys: expectedPeriod === "30d" ? ["realized_profit_30d", "realized_profit", "realized_profit_usd", "total_profit", "total_profit_usd"] : ["realized_profit_7d", "realized_profit", "realized_profit_usd", "total_profit", "total_profit_usd"],
    kind: "number",
  },
  {
    canonicalName: "realizedProfitPnl",
    aliasKeys: expectedPeriod === "30d" ? ["realized_profit_pnl_30d", "realized_profit_pnl"] : ["realized_profit_pnl_7d", "realized_profit_pnl"],
    kind: "number",
  },
  {
    canonicalName: "tradeCount",
    aliasKeys: expectedPeriod === "30d" ? ["trade_count_30d", "trades_30d", "tx_count_30d", "trade_count", "trade_num", "total_trades", "trades", "tx_count"] : ["trade_count_7d", "trades_7d", "tx_count_7d", "trade_count", "trade_num", "total_trades", "trades", "tx_count"],
    kind: "integer",
  },
  {
    canonicalName: "buyCount",
    aliasKeys: expectedPeriod === "30d" ? ["buy_30d", "buy_count_30d", "buy", "buy_count", "bought_count", "buy_num"] : ["buy_7d", "buy_count_7d", "buy", "buy_count", "bought_count", "buy_num"],
    kind: "integer",
  },
  {
    canonicalName: "sellCount",
    aliasKeys: expectedPeriod === "30d" ? ["sell_30d", "sell_count_30d", "sell", "sell_count", "sold_count", "sell_num"] : ["sell_7d", "sell_count_7d", "sell", "sell_count", "sold_count", "sell_num"],
    kind: "integer",
  },
  {
    canonicalName: "boughtCost",
    aliasKeys: expectedPeriod === "30d" ? ["bought_cost_30d", "bought_cost"] : ["bought_cost_7d", "bought_cost"],
    fallbackAliasKeys: expectedPeriod === "30d" ? ["total_cost_30d", "total_cost", "buy_volume"] : ["total_cost_7d", "total_cost", "buy_volume"],
    kind: "non_negative_number",
  },
  {
    canonicalName: "soldIncome",
    aliasKeys: expectedPeriod === "30d" ? ["sold_income_30d", "total_income_30d", "sold_income", "total_income", "sell_volume"] : ["sold_income_7d", "total_income_7d", "sold_income", "total_income", "sell_volume"],
    kind: "non_negative_number",
  },
  {
    canonicalName: "lastActiveTimestamp",
    aliasKeys: ["last_timestamp", "last_active_timestamp", "last_trade_time", "last_active_time", "last_active", "updated_at"],
    kind: "positive_timestamp",
  },
];

const PNL_STAT_ALIAS_GROUPS = (expectedPeriod: "7d" | "30d"): AliasGroupDefinition[] => [
  {
    canonicalName: "tokenNum",
    aliasKeys: expectedPeriod === "30d" ? ["token_num_30d", "token_count_30d", "token_num", "token_count", "total_tokens"] : ["token_num_7d", "token_count_7d", "token_num", "token_count", "total_tokens"],
    kind: "integer",
  },
];

function extractMetricsFromCompositeContainers(
  rootContainer: JsonRecord,
  pnlStatContainer: JsonRecord,
  expectedPeriod: "7d" | "30d",
): { aggregates: GmgnWalletStatsAggregate; validCount: number; warnings: string[] } {
  const rootExt = extractMetricsFromSingleContainer(rootContainer, expectedPeriod, "root_only");
  const pnlStatExt = extractMetricsFromSingleContainer(pnlStatContainer, expectedPeriod, "pnl_stat_only");

  const warnings = Array.from(new Set([...rootExt.warnings, ...pnlStatExt.warnings]));
  const aggregates: GmgnWalletStatsAggregate = {
    ...rootExt.aggregates,
    ...pnlStatExt.aggregates,
  };

  const validCount = Object.keys(aggregates).length;
  return { aggregates, validCount, warnings };
}

type ExtractionMode = "root_only" | "pnl_stat_only" | "standalone";

function extractMetricsFromSingleContainer(
  container: JsonRecord,
  expectedPeriod: "7d" | "30d",
  mode: ExtractionMode = "standalone",
): { aggregates: GmgnWalletStatsAggregate; validCount: number; warnings: string[] } {
  const aggregates: GmgnWalletStatsAggregate = {};
  const warnings: string[] = [];
  let validCount = 0;

  const forbiddenPeriodKeys = expectedPeriod === "30d"
    ? new Set(["pnl_7d", "realized_profit_7d", "realized_profit_pnl_7d", "winrate_7d", "win_rate_7d", "trade_count_7d", "trades_7d", "tx_count_7d", "buy_7d", "buy_count_7d", "sell_7d", "sell_count_7d", "bought_cost_7d", "total_cost_7d", "sold_income_7d", "total_income_7d", "token_num_7d", "token_count_7d"])
    : new Set(["pnl_30d", "realized_profit_30d", "realized_profit_pnl_30d", "winrate_30d", "win_rate_30d", "trade_count_30d", "trades_30d", "tx_count_30d", "buy_30d", "buy_count_30d", "sell_30d", "sell_count_30d", "bought_cost_30d", "total_cost_30d", "sold_income_30d", "total_income_30d", "token_num_30d", "token_count_30d"]);

  let aliasGroups: AliasGroupDefinition[] = [];
  if (mode === "root_only") {
    aliasGroups = ROOT_ALIAS_GROUPS(expectedPeriod);
  } else if (mode === "pnl_stat_only") {
    aliasGroups = PNL_STAT_ALIAS_GROUPS(expectedPeriod);
  } else {
    aliasGroups = [...ROOT_ALIAS_GROUPS(expectedPeriod), ...PNL_STAT_ALIAS_GROUPS(expectedPeriod)];
  }

  for (const group of aliasGroups) {
    const presentPrimaryKeys = group.aliasKeys.filter((k) => k in container && !forbiddenPeriodKeys.has(k));
    const presentKeys = presentPrimaryKeys.length > 0
      ? presentPrimaryKeys
      : (group.fallbackAliasKeys ?? []).filter((k) => k in container && !forbiddenPeriodKeys.has(k));
    if (presentKeys.length === 0) continue;

    const validValues: number[] = [];
    let hasInvalidFieldType = false;

    for (const key of presentKeys) {
      const rawVal = container[key];
      if (rawVal === undefined || rawVal === null) continue;

      let parsed: number | undefined;
      if (group.kind === "number") parsed = parseStrictNumber(rawVal);
      else if (group.kind === "non_negative_number") parsed = parseNonNegativeNumber(rawVal);
      else if (group.kind === "positive_timestamp") {
        const timestamp = parseStrictNumber(rawVal);
        if (timestamp === 0) continue;
        parsed = timestamp !== undefined && timestamp > 0 ? timestamp : undefined;
      }
      else if (group.kind === "integer") parsed = parseStrictInteger(rawVal);

      if (parsed !== undefined) {
        validValues.push(parsed);
      } else {
        hasInvalidFieldType = true;
      }
    }

    if (hasInvalidFieldType && validValues.length > 0) {
      warnings.push("gmgn_wallet_stats_alias_conflict");
      continue;
    }

    if (hasInvalidFieldType && validValues.length === 0) {
      warnings.push("gmgn_wallet_stats_invalid_field_type");
      continue;
    }

    const firstVal = validValues[0];
    if (validValues.length === 1 && firstVal !== undefined) {
      aggregates[group.canonicalName] = firstVal;
      validCount++;
    } else if (validValues.length > 1 && firstVal !== undefined) {
      const allEqual = validValues.every((v) => v === firstVal);
      if (allEqual) {
        aggregates[group.canonicalName] = firstVal;
        validCount++;
      } else {
        warnings.push("gmgn_wallet_stats_alias_conflict");
      }
    }
  }

  // Handle winRate for pnl_stat_only or standalone mode
  if (mode === "pnl_stat_only" || mode === "standalone") {
    const winRatePercentKeys = ["win_rate_percent"];
    const winRateRatioKeys = ["win_rate_ratio", "winrate_ratio"];
    const winRateGenericKeys = expectedPeriod === "30d"
      ? ["winrate_30d", "win_rate_30d", "winrate", "win_rate", "winning_rate"]
      : ["winrate_7d", "win_rate_7d", "winrate", "win_rate", "winning_rate"];

    const presentPercentKeys = winRatePercentKeys.filter((k) => k in container && !forbiddenPeriodKeys.has(k));
    const presentRatioKeys = winRateRatioKeys.filter((k) => k in container && !forbiddenPeriodKeys.has(k));
    const presentGenericKeys = winRateGenericKeys.filter((k) => k in container && !forbiddenPeriodKeys.has(k));

    const winRatePercentValues: number[] = [];
    const winRateRatioValues: number[] = [];
    const winRateGenericValues: number[] = [];
    let winRateAmbiguous = false;
    let winRateInvalidType = false;

    for (const key of presentPercentKeys) {
      const rawVal = container[key];
      if (rawVal === undefined || rawVal === null) continue;
      const num = parseStrictNumber(rawVal);
      if (num !== undefined) {
        if (num >= 0 && num <= 100) {
          winRatePercentValues.push(num);
        } else {
          winRateAmbiguous = true;
        }
      } else {
        winRateInvalidType = true;
      }
    }

    for (const key of presentRatioKeys) {
      const rawVal = container[key];
      if (rawVal === undefined || rawVal === null) continue;
      const num = parseStrictNumber(rawVal);
      if (num !== undefined) {
        if (num >= 0 && num <= 1) {
          winRateRatioValues.push(Math.round(num * 100 * 100) / 100);
        } else {
          winRateAmbiguous = true;
        }
      } else {
        winRateInvalidType = true;
      }
    }

    for (const key of presentGenericKeys) {
      const rawVal = container[key];
      if (rawVal === undefined || rawVal === null) continue;
      const num = parseStrictNumber(rawVal);
      if (num !== undefined) {
        if (mode === "pnl_stat_only") {
          // In pnl_stat, official GMGN pnl_stat.winrate is a ratio in [0, 1]
          if (num >= 0 && num <= 1) {
            winRateGenericValues.push(Math.round(num * 100 * 100) / 100);
          } else {
            winRateAmbiguous = true;
          }
        } else {
          // Generic alias on root/standalone without schema evidence -> unit-unverified
          winRateAmbiguous = true;
        }
      } else {
        winRateInvalidType = true;
      }
    }

    const explicitGroupCount = (presentPercentKeys.length > 0 ? 1 : 0) + (presentRatioKeys.length > 0 ? 1 : 0);
    const totalWinRateAliasesPresent = presentPercentKeys.length + presentRatioKeys.length + presentGenericKeys.length;

    if (explicitGroupCount > 1 || (mode === "standalone" && presentGenericKeys.length > 0 && (presentPercentKeys.length > 0 || presentRatioKeys.length > 0))) {
      warnings.push("gmgn_wallet_stats_alias_conflict");
    } else if (mode === "standalone" && presentGenericKeys.length > 0) {
      warnings.push("gmgn_wallet_stats_win_rate_unit_ambiguous");
    } else if (winRateAmbiguous) {
      warnings.push("gmgn_wallet_stats_win_rate_unit_ambiguous");
    } else if (winRateInvalidType && winRatePercentValues.length === 0 && winRateRatioValues.length === 0 && winRateGenericValues.length === 0) {
      warnings.push("gmgn_wallet_stats_invalid_field_type");
    } else if (totalWinRateAliasesPresent > 0) {
      const allParsedWinRates = [...winRatePercentValues, ...winRateRatioValues, ...winRateGenericValues];
      const firstWinRate = allParsedWinRates[0];
      if (allParsedWinRates.length === 1 && firstWinRate !== undefined) {
        aggregates.winRate = firstWinRate;
        validCount++;
      } else if (allParsedWinRates.length > 1 && firstWinRate !== undefined) {
        if (allParsedWinRates.every((v) => Math.abs(v - firstWinRate) < 1e-6)) {
          aggregates.winRate = firstWinRate;
          validCount++;
        } else {
          warnings.push("gmgn_wallet_stats_alias_conflict");
        }
      }
    }
  }

  return { aggregates, validCount, warnings };
}

const CANONICAL_JSON_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

function parseStrictNumber(val: unknown): number | undefined {
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : undefined;
  }
  if (typeof val !== "string" || !CANONICAL_JSON_NUMBER.test(val)) {
    return undefined;
  }
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseNonNegativeNumber(val: unknown): number | undefined {
  const num = parseStrictNumber(val);
  return num !== undefined && num >= 0 ? num : undefined;
}


function parseStrictInteger(val: unknown): number | undefined {
  const num = parseStrictNumber(val);
  return num !== undefined && Number.isSafeInteger(num) && num >= 0 ? num : undefined;
}

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonRecord) : undefined;
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}
