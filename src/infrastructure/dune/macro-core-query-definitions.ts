import type { MacroChain, MacroChainMetricName, MacroGlobalMetricName } from "../../domain/macro-daily.js";

const SPELLBOOK_SHA = "b553234af744bef843a51e7f1cfd319d5cced24d";
const REPORT_DAY_SQL = "CURRENT_DATE - INTERVAL '2' DAY";

export type CoreBlueprintId =
  | "G1_global_evm_dex_day"
  | "G3_btc_fee_usd"
  | "S1_solana_capital_day"
  | "S2_solana_pump_launch_day"
  | "S3_solana_pumpswap_pool_day"
  | "B1_bsc_capital_day"
  | "B2_pancake_pool_created_day"
  | "R1_robinhood_uni_capital_day"
  | "S4_solana_trade_activity_day"
  | "B3_bsc_trade_activity_day"
  | "R2_robinhood_uni_trade_activity_day";

interface BaseMetricDefinition {
  readonly column: string;
  readonly unit: "usd" | "count";
  readonly warningCodes: readonly string[];
}

export interface GlobalMetricDefinition extends BaseMetricDefinition {
  readonly scope: "global";
  readonly metricName: MacroGlobalMetricName;
  readonly subject: string;
}

export interface ChainMetricDefinition extends BaseMetricDefinition {
  readonly scope: "chain";
  readonly chain: MacroChain;
  readonly section: "capital" | "supply" | "activity";
  readonly metricName: MacroChainMetricName;
  readonly registryVersion: string;
  readonly coverageStatus: "declared_registry" | "partial_coverage";
}

export interface CoreQueryDefinition {
  readonly blueprintId: CoreBlueprintId;
  readonly sql: string;
  readonly metrics: readonly (GlobalMetricDefinition | ChainMetricDefinition)[];
}

const globalDexMetrics: readonly GlobalMetricDefinition[] = [
  { scope: "global", column: "dex_volume_usd", metricName: "dex_volume_usd", subject: "global_evm", unit: "usd", warningCodes: ["volume_is_leg_sum"] },
  { scope: "global", column: "active_trader_count", metricName: "active_trader_count", subject: "global_evm", unit: "count", warningCodes: [] },
];

const solanaCapitalMetrics: readonly ChainMetricDefinition[] = [
  { scope: "chain", column: "dex_volume_usd", chain: "solana", section: "capital", metricName: "dex_volume_usd", unit: "usd", registryVersion: `spellbook:dex_solana:base_trades_union@${SPELLBOOK_SHA}`, coverageStatus: "declared_registry", warningCodes: ["volume_is_leg_sum"] },
  { scope: "chain", column: "active_trader_count", chain: "solana", section: "capital", metricName: "active_trader_count", unit: "count", registryVersion: `spellbook:dex_solana:base_trades_union@${SPELLBOOK_SHA}`, coverageStatus: "declared_registry", warningCodes: [] },
];

const bscCapitalMetrics: readonly ChainMetricDefinition[] = [
  { scope: "chain", column: "dex_volume_usd", chain: "bsc", section: "capital", metricName: "dex_volume_usd", unit: "usd", registryVersion: `spellbook:dex_trades:blockchain=bnb@${SPELLBOOK_SHA}`, coverageStatus: "declared_registry", warningCodes: ["volume_is_leg_sum"] },
  { scope: "chain", column: "active_trader_count", chain: "bsc", section: "capital", metricName: "active_trader_count", unit: "count", registryVersion: `spellbook:dex_trades:blockchain=bnb@${SPELLBOOK_SHA}`, coverageStatus: "declared_registry", warningCodes: [] },
];

const robinhoodCapitalMetrics: readonly ChainMetricDefinition[] = [
  { scope: "chain", column: "dex_volume_usd", chain: "robinhood", section: "capital", metricName: "dex_volume_usd", unit: "usd", registryVersion: `spellbook:dex_robinhood:uniswap_v2_v3_v4@${SPELLBOOK_SHA}`, coverageStatus: "partial_coverage", warningCodes: ["volume_is_leg_sum", "uniswap_only"] },
  { scope: "chain", column: "active_trader_count", chain: "robinhood", section: "capital", metricName: "active_trader_count", unit: "count", registryVersion: `spellbook:dex_robinhood:uniswap_v2_v3_v4@${SPELLBOOK_SHA}`, coverageStatus: "partial_coverage", warningCodes: ["uniswap_only"] },
];

const solanaTradeActivityMetrics: readonly ChainMetricDefinition[] = [
  { scope: "chain", column: "swap_transaction_count", chain: "solana", section: "activity", metricName: "swap_transaction_count", unit: "count", registryVersion: `spellbook:dex_solana:base_trades_union@${SPELLBOOK_SHA}`, coverageStatus: "declared_registry", warningCodes: ["deduplicated_trade_legs"] },
  { scope: "chain", column: "trade_leg_count", chain: "solana", section: "activity", metricName: "trade_leg_count", unit: "count", registryVersion: `spellbook:dex_solana:base_trades_union@${SPELLBOOK_SHA}`, coverageStatus: "declared_registry", warningCodes: ["deduplicated_trade_legs"] },
];

const bscTradeActivityMetrics: readonly ChainMetricDefinition[] = [
  { scope: "chain", column: "swap_transaction_count", chain: "bsc", section: "activity", metricName: "swap_transaction_count", unit: "count", registryVersion: `spellbook:dex_trades:blockchain=bnb@${SPELLBOOK_SHA}`, coverageStatus: "declared_registry", warningCodes: ["deduplicated_trade_legs"] },
  { scope: "chain", column: "trade_leg_count", chain: "bsc", section: "activity", metricName: "trade_leg_count", unit: "count", registryVersion: `spellbook:dex_trades:blockchain=bnb@${SPELLBOOK_SHA}`, coverageStatus: "declared_registry", warningCodes: ["deduplicated_trade_legs"] },
];

const robinhoodTradeActivityMetrics: readonly ChainMetricDefinition[] = [
  { scope: "chain", column: "swap_transaction_count", chain: "robinhood", section: "activity", metricName: "swap_transaction_count", unit: "count", registryVersion: `spellbook:dex_robinhood:uniswap_v2_v3_v4@${SPELLBOOK_SHA}`, coverageStatus: "partial_coverage", warningCodes: ["deduplicated_trade_legs", "uniswap_only"] },
  { scope: "chain", column: "trade_leg_count", chain: "robinhood", section: "activity", metricName: "trade_leg_count", unit: "count", registryVersion: `spellbook:dex_robinhood:uniswap_v2_v3_v4@${SPELLBOOK_SHA}`, coverageStatus: "partial_coverage", warningCodes: ["deduplicated_trade_legs", "uniswap_only"] },
];

export const CORE_QUERY_DEFINITIONS: readonly CoreQueryDefinition[] = [
  { blueprintId: "G1_global_evm_dex_day", sql: `SELECT ${REPORT_DAY_SQL} AS report_day, SUM(amount_usd) AS dex_volume_usd, COUNT(DISTINCT taker) AS active_trader_count FROM dex.trades WHERE block_date = ${REPORT_DAY_SQL} AND amount_usd IS NOT NULL`, metrics: globalDexMetrics },
  { blueprintId: "G3_btc_fee_usd", sql: `SELECT block_date AS report_day, gas_fees_usd AS btc_fee_usd FROM metrics_bitcoin.gas_fees_daily WHERE block_date = ${REPORT_DAY_SQL}`, metrics: [{ scope: "global", column: "btc_fee_usd", metricName: "btc_fee_usd", subject: "bitcoin", unit: "usd", warningCodes: ["excludes_current_day"] }] },
  { blueprintId: "S1_solana_capital_day", sql: `SELECT ${REPORT_DAY_SQL} AS report_day, SUM(amount_usd) AS dex_volume_usd, COUNT(DISTINCT trader_id) AS active_trader_count FROM dex_solana.trades WHERE block_date = ${REPORT_DAY_SQL} AND amount_usd IS NOT NULL`, metrics: solanaCapitalMetrics },
  { blueprintId: "S2_solana_pump_launch_day", sql: `SELECT ${REPORT_DAY_SQL} AS report_day, COUNT(*) AS pump_launch_count FROM solana.instruction_calls WHERE executing_account = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P' AND bytearray_substring(data, 1, 8) = 0x181ec828051c0777 AND tx_success = true AND CAST(block_time AS date) = ${REPORT_DAY_SQL}`, metrics: [{ scope: "chain", column: "pump_launch_count", chain: "solana", section: "supply", metricName: "pump_launch_count", unit: "count", registryVersion: `spellbook:pumpdotfun:create@${SPELLBOOK_SHA}`, coverageStatus: "declared_registry", warningCodes: ["pump_only"] }] },
  { blueprintId: "S3_solana_pumpswap_pool_day", sql: `SELECT ${REPORT_DAY_SQL} AS report_day, COUNT(*) AS external_pool_count FROM pumpswap_solana.pools WHERE CAST(created_at AS date) = ${REPORT_DAY_SQL} AND is_valid_pool = true`, metrics: [{ scope: "chain", column: "external_pool_count", chain: "solana", section: "supply", metricName: "external_pool_count", unit: "count", registryVersion: `spellbook:pumpswap:pools@${SPELLBOOK_SHA}`, coverageStatus: "declared_registry", warningCodes: ["not_migrate"] }] },
  { blueprintId: "B1_bsc_capital_day", sql: `SELECT ${REPORT_DAY_SQL} AS report_day, SUM(amount_usd) AS dex_volume_usd, COUNT(DISTINCT taker) AS active_trader_count FROM dex.trades WHERE blockchain = 'bnb' AND block_date = ${REPORT_DAY_SQL} AND amount_usd IS NOT NULL`, metrics: bscCapitalMetrics },
  { blueprintId: "B2_pancake_pool_created_day", sql: `SELECT ${REPORT_DAY_SQL} AS report_day, COUNT(*) AS pancakeswap_pool_created_count FROM pancakeswap_bnb.pools WHERE CAST(creation_block_time AS date) = ${REPORT_DAY_SQL}`, metrics: [{ scope: "chain", column: "pancakeswap_pool_created_count", chain: "bsc", section: "supply", metricName: "pancakeswap_pool_created_count", unit: "count", registryVersion: `spellbook:pancakeswap_bnb:pools@${SPELLBOOK_SHA}`, coverageStatus: "declared_registry", warningCodes: [] }] },
  { blueprintId: "R1_robinhood_uni_capital_day", sql: `SELECT ${REPORT_DAY_SQL} AS report_day, SUM(amount_usd) AS dex_volume_usd, COUNT(DISTINCT taker) AS active_trader_count FROM dex.trades WHERE blockchain = 'robinhood' AND project = 'uniswap' AND version IN ('2', '3', '4') AND block_date = ${REPORT_DAY_SQL} AND amount_usd IS NOT NULL`, metrics: robinhoodCapitalMetrics },
  { blueprintId: "S4_solana_trade_activity_day", sql: `WITH trade_legs AS (SELECT DISTINCT tx_id, outer_instruction_index, inner_instruction_index, tx_index, block_month FROM dex_solana.trades WHERE block_date = ${REPORT_DAY_SQL}) SELECT ${REPORT_DAY_SQL} AS report_day, COUNT(DISTINCT tx_id) AS swap_transaction_count, COUNT(*) AS trade_leg_count FROM trade_legs`, metrics: solanaTradeActivityMetrics },
  { blueprintId: "B3_bsc_trade_activity_day", sql: `WITH trade_legs AS (SELECT DISTINCT tx_hash, evt_index FROM dex.trades WHERE blockchain = 'bnb' AND block_date = ${REPORT_DAY_SQL}) SELECT ${REPORT_DAY_SQL} AS report_day, COUNT(DISTINCT tx_hash) AS swap_transaction_count, COUNT(*) AS trade_leg_count FROM trade_legs`, metrics: bscTradeActivityMetrics },
  { blueprintId: "R2_robinhood_uni_trade_activity_day", sql: `WITH trade_legs AS (SELECT DISTINCT tx_hash, evt_index FROM dex.trades WHERE blockchain = 'robinhood' AND project = 'uniswap' AND version IN ('2', '3', '4') AND block_date = ${REPORT_DAY_SQL}) SELECT ${REPORT_DAY_SQL} AS report_day, COUNT(DISTINCT tx_hash) AS swap_transaction_count, COUNT(*) AS trade_leg_count FROM trade_legs`, metrics: robinhoodTradeActivityMetrics },
];
