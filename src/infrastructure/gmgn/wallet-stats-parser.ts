export const GMGN_WALLET_STATS_PARSER_VERSION = "gmgn-wallet-stats-v1";

export type GmgnWalletStatsStatus = "MAPPED" | "PARTIAL" | "UNAVAILABLE";
export type GmgnWalletStatsMapping = "direct_identity" | "wallet_keyed" | null;

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
  aggregates: GmgnWalletStatsAggregate;
  warningCodes: string[];
}

type JsonRecord = Record<string, unknown>;
type Candidate = {
  wallet: string;
  record: JsonRecord;
  depth: number;
  mapping: Exclude<GmgnWalletStatsMapping, null>;
};

const MAX_DEPTH = 12;
const MAX_NODES = 10_000;

const PNL_KEYS = new Set([
  "pnl",
  "total_pnl",
  "pnl_usd",
  "realized_pnl",
  "realized_profit",
  "profit",
  "profit_usd",
  "total_profit",
  "total_profit_usd",
]);
const REALIZED_PROFIT_KEYS = new Set(["realized_profit"]);
const REALIZED_PROFIT_PNL_KEYS = new Set(["realized_profit_pnl"]);
const WIN_RATE_KEYS = new Set(["winrate", "win_rate", "winning_rate", "win_rate_percent"]);
const TRADE_COUNT_KEYS = new Set(["trade_count", "trade_num", "total_trades", "trades", "tx_count"]);
const BUY_COUNT_KEYS = new Set(["buy", "buy_count", "bought_count", "buy_num"]);
const SELL_COUNT_KEYS = new Set(["sell", "sell_count", "sold_count", "sell_num"]);
const BOUGHT_COST_KEYS = new Set(["bought_cost", "total_cost"]);
const SOLD_INCOME_KEYS = new Set(["sold_income"]);
const LAST_ACTIVE_TIMESTAMP_KEYS = new Set(["last_timestamp", "last_active_timestamp", "last_trade_time", "last_active_time"]);
const TOKEN_NUM_KEYS = new Set(["token_num", "token_count"]);

/**
 * Extracts only allowlisted numeric aggregates from a GMGN JSON value already
 * held in memory. Unknown keys and values never leave this parser.
 */
export function parseGmgnWalletStats(payload: unknown, wallets: readonly string[]): GmgnWalletStatsResult[] {
  const candidates = new Map<string, Candidate[]>();
  for (const wallet of wallets) candidates.set(wallet, []);
  collectCandidates(payload, new Set(wallets), candidates, 0, { value: 0 });

  return wallets.map((wallet) => resultForWallet(wallet, candidates.get(wallet) ?? []));
}

function resultForWallet(wallet: string, candidates: Candidate[]): GmgnWalletStatsResult {
  const best = candidates
    .map((candidate) => ({ candidate, aggregates: aggregatesFrom(candidate.record) }))
    .sort((left, right) => candidateScore(right) - candidateScore(left))[0];

  if (!best) {
    return unavailable(wallet, null, "gmgn_wallet_metric_unavailable");
  }

  if (Object.keys(best.aggregates).length === 0) {
    return unavailable(wallet, best.candidate.mapping, "gmgn_expected_metrics_unavailable");
  }

  return {
    wallet,
    parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
    status: "MAPPED",
    mapping: best.candidate.mapping,
    aggregates: best.aggregates,
    warningCodes: [],
  };
}

function unavailable(
  wallet: string,
  mapping: GmgnWalletStatsMapping,
  warningCode: string,
): GmgnWalletStatsResult {
  return {
    wallet,
    parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
    status: mapping === null ? "UNAVAILABLE" : "PARTIAL",
    mapping,
    aggregates: {},
    warningCodes: [warningCode],
  };
}

function candidateScore(value: { candidate: Candidate; aggregates: GmgnWalletStatsAggregate }): number {
  return Object.keys(value.aggregates).length * 100 + value.candidate.depth * 2
    + (value.candidate.mapping === "direct_identity" ? 1 : 0);
}

function collectCandidates(
  value: unknown,
  wallets: ReadonlySet<string>,
  candidates: Map<string, Candidate[]>,
  depth: number,
  visited: { value: number },
): void {
  if (depth > MAX_DEPTH || visited.value >= MAX_NODES) return;
  visited.value += 1;

  if (Array.isArray(value)) {
    for (const child of value) collectCandidates(child, wallets, candidates, depth + 1, visited);
    return;
  }

  const record = asRecord(value);
  if (!record) return;

  for (const [key, child] of Object.entries(record)) {
    if (wallets.has(key)) {
      const keyedRecord = asRecord(child);
      if (keyedRecord) addCandidate(candidates, { wallet: key, record: keyedRecord, depth, mapping: "wallet_keyed" });
    }
    if (typeof child === "string" && wallets.has(child)) {
      addCandidate(candidates, { wallet: child, record, depth, mapping: "direct_identity" });
    }
  }

  for (const child of Object.values(record)) collectCandidates(child, wallets, candidates, depth + 1, visited);
}

function addCandidate(candidates: Map<string, Candidate[]>, candidate: Candidate): void {
  const current = candidates.get(candidate.wallet);
  if (current) current.push(candidate);
}

function aggregatesFrom(record: JsonRecord): GmgnWalletStatsAggregate {
  const values: GmgnWalletStatsAggregate = {};
  collectAggregates(record, values, 0, { value: 0 });
  return values;
}

function collectAggregates(
  value: unknown,
  aggregates: GmgnWalletStatsAggregate,
  depth: number,
  visited: { value: number },
): void {
  if (depth > 4 || visited.value >= MAX_NODES) return;
  visited.value += 1;

  if (Array.isArray(value)) {
    for (const child of value) collectAggregates(child, aggregates, depth + 1, visited);
    return;
  }

  const record = asRecord(value);
  if (!record) return;

  for (const [key, child] of Object.entries(record)) {
    if (aggregates.periodPnl === undefined && PNL_KEYS.has(key)) {
      const metric = finiteNumber(child);
      if (metric !== undefined) aggregates.periodPnl = metric;
    }
    if (aggregates.realizedProfit === undefined && REALIZED_PROFIT_KEYS.has(key)) {
      const metric = finiteNumber(child);
      if (metric !== undefined) aggregates.realizedProfit = metric;
    }
    if (aggregates.realizedProfitPnl === undefined && REALIZED_PROFIT_PNL_KEYS.has(key)) {
      const metric = finiteNumber(child);
      if (metric !== undefined) aggregates.realizedProfitPnl = metric;
    }
    if (aggregates.winRate === undefined && WIN_RATE_KEYS.has(key)) {
      const metric = finiteNumber(child);
      if (metric !== undefined && metric >= 0 && metric <= 100) aggregates.winRate = metric;
    }
    if (aggregates.tradeCount === undefined && TRADE_COUNT_KEYS.has(key)) {
      const metric = finiteNumber(child);
      if (metric !== undefined && Number.isSafeInteger(metric) && metric >= 0) aggregates.tradeCount = metric;
    }
    if (aggregates.buyCount === undefined && BUY_COUNT_KEYS.has(key)) {
      const metric = finiteNumber(child);
      if (metric !== undefined && Number.isSafeInteger(metric) && metric >= 0) aggregates.buyCount = metric;
    }
    if (aggregates.sellCount === undefined && SELL_COUNT_KEYS.has(key)) {
      const metric = finiteNumber(child);
      if (metric !== undefined && Number.isSafeInteger(metric) && metric >= 0) aggregates.sellCount = metric;
    }
    if (aggregates.boughtCost === undefined && BOUGHT_COST_KEYS.has(key)) {
      const metric = finiteNumber(child);
      if (metric !== undefined && metric >= 0) aggregates.boughtCost = metric;
    }
    if (aggregates.soldIncome === undefined && SOLD_INCOME_KEYS.has(key)) {
      const metric = finiteNumber(child);
      if (metric !== undefined && metric >= 0) aggregates.soldIncome = metric;
    }
    if (aggregates.lastActiveTimestamp === undefined && LAST_ACTIVE_TIMESTAMP_KEYS.has(key)) {
      const metric = finiteNumber(child);
      if (metric !== undefined && metric > 0) aggregates.lastActiveTimestamp = metric;
    }
    if (aggregates.tokenNum === undefined && TOKEN_NUM_KEYS.has(key)) {
      const metric = finiteNumber(child);
      if (metric !== undefined && Number.isSafeInteger(metric) && metric >= 0) aggregates.tokenNum = metric;
    }
  }

  if (aggregates.tradeCount === undefined && aggregates.buyCount !== undefined && aggregates.sellCount !== undefined) {
    aggregates.tradeCount = aggregates.buyCount + aggregates.sellCount;
  }

  for (const child of Object.values(record)) collectAggregates(child, aggregates, depth + 1, visited);
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : undefined;
}
