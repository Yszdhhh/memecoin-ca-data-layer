# Acceptance Report: GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-SCHEMA-REPAIR-001

- **Task ID:** `GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-SCHEMA-REPAIR-001`
- **Baseline SHA:** `fc12f3fdc6e14adc1f68e21e2dcda1b11d35d5a7`
- **Delivery SHA:** `fc12f3fdc6e14adc1f68e21e2dcda1b11d35d5a7`
- **Role:** Internal Coordinator + Implementer (`implementer-gmgn-wallet-stats-documented-composite-schema-repair-001`)
- **Status:** `DONE`

---

## 1. Root Cause Analysis

In `SOL-GMGN-WALLET-STATS-PARSER-V2-7D-30D-LIVE-RESMOKE-001`, physical 7d and 30d requests returned `UNAVAILABLE` with warning code `gmgn_wallet_stats_schema_unrecognized`.
Investigation revealed that GMGN's official API returns a fixed composite response structure where core financial metrics (e.g., `realized_profit`, `pnl_7d`, `buy_7d`, `sell_7d`, `bought_cost`, `sold_income`, `last_active_timestamp`) reside at the `root` record level, while trading statistics (e.g., `token_num`, `winrate` / `win_rate_7d`) reside in a sub-object named `pnl_stat`.

Parser V2 previously evaluated metric intent independently across `root` and sub-objects (`pnl_stat`, `stats`). When both `root` and `pnl_stat` contained metrics, it misjudged the response as ambiguous multi-container duplication (`intentCandidates.length > 1`) and fail-closed with `gmgn_wallet_stats_schema_unrecognized`.

---

## 2. Documented Composite Schema & Field Ownership Table

This repair explicitly recognizes the documented GMGN official composite schema (`root` + `pnl_stat`) while preserving container isolation for invalid or ambiguous combinations (`root` + `stats`, `pnl_stat` + `stats`, `root` + `stats` + `pnl_stat`, or unrecognized nodes like `summary`, `market`, `token`, `decoy`).

### Field Ownership

- **Root-owned metrics:**
  - `periodPnl`: `pnl_7d`, `pnl_30d`, `pnl`, `total_pnl`, `pnl_usd`, `realized_pnl`
  - `realizedProfit`: `realized_profit_7d`, `realized_profit_30d`, `realized_profit`, `realized_profit_usd`, `total_profit`, `total_profit_usd`
  - `realizedProfitPnl`: `realized_profit_pnl_7d`, `realized_profit_pnl_30d`, `realized_profit_pnl`
  - `tradeCount`: `trade_count_7d`, `trade_count_30d`, `trades_7d`, `trades_30d`, `tx_count_7d`, `tx_count_30d`, `trade_count`, `trade_num`, `total_trades`, `trades`, `tx_count` (only when explicitly provided; never synthesized from `buyCount + sellCount`)
  - `buyCount`: `buy_7d`, `buy_30d`, `buy_count_7d`, `buy_count_30d`, `buy`, `buy_count`, `bought_count`, `buy_num`
  - `sellCount`: `sell_7d`, `sell_30d`, `sell_count_7d`, `sell_count_30d`, `sell`, `sell_count`, `sold_count`, `sell_num`
  - `boughtCost`: `bought_cost_7d`, `bought_cost_30d`, `total_cost_7d`, `total_cost_30d`, `bought_cost`, `total_cost`, `buy_volume`
  - `soldIncome`: `sold_income_7d`, `sold_income_30d`, `total_income_7d`, `total_income_30d`, `sold_income`, `total_income`, `sell_volume`
  - `lastActiveTimestamp`: `last_timestamp`, `last_active_timestamp`, `last_trade_time`, `last_active_time`, `last_active`, `updated_at`

- **pnl_stat-owned metrics:**
  - `tokenNum`: `token_num`, `token_num_7d`, `token_num_30d`, `token_count`, `token_count_7d`, `token_count_30d`, `total_tokens`
  - `winRate`:
    - `win_rate_percent` [0, 100]
    - `win_rate_ratio`, `winrate_ratio` [0, 1] (multiplied by 100)
    - Inside `pnl_stat`: official GMGN `pnl_stat.winrate` / `win_rate` / `win_rate_7d` / `win_rate_30d` [0, 1] ratio (multiplied by 100)
    - Directly on `root`: generic `winrate` / `win_rate` without explicit unit suffix remains unit-unverified (`gmgn_wallet_stats_win_rate_unit_ambiguous`)

### Multi-location Conflict Resolution
If the same canonical metric appears in multiple valid locations (e.g. `root` and `pnl_stat`), and the extracted values conflict (different numbers), the parser fail-closed with `gmgn_wallet_stats_alias_conflict`.

---

## 3. Synthetic Verification Test Coverage

Synthetic unit test suite in `test/gmgn-wallet-stats-parser.test.ts` covers:
1. Official `root + pnl_stat` composite fixture parsing.
2. `root` `realized_profit` + `pnl_stat` `winrate`/`token_num` valid combination.
3. `pnl_stat.winrate = 0.4` correctly mapped to 40.
4. Multi-location conflict on canonical metric causing fail-closed `gmgn_wallet_stats_alias_conflict`.
5. Primitive/array `pnl_stat` safely returning `UNAVAILABLE` without throwing exceptions.
6. `root + stats + pnl_stat` multi-container ambiguity triggering `gmgn_wallet_stats_schema_unrecognized`.
7. `decoy`, `summary`, `market`, `token` sub-nodes ignored and unable to contribute metrics.
8. Wrong period (`30d` for `7d` request) triggering `gmgn_wallet_stats_period_mismatch`.
9. Unsupported period (`90d`, `all`) triggering `gmgn_wallet_stats_period_mismatch`.
10. Missing metrics retained as `undefined` in aggregates with accurate completeness.
11. Explicit `0` values preserved as `0`.
12. Numeric strings (`"123"`) rejected with `gmgn_wallet_stats_invalid_field_type`.
13. Incomplete composite response (< 11/11 metrics) yielding `PARTIAL` status.
14. Complete 11/11 metrics required for `MAPPED` status.
15. Consumers correctly propagating `PARTIAL` and `UNAVAILABLE` statuses.

---

## 4. Resource & Boundary Audit

- **Network Requests:** `0`
- **Provider Requests:** `0`
- **GMGN CLI Invocations:** `0`
- **Credential Reads:** `0`
- **Real Address Processing:** `0`

---

## 5. Audit Transition Notice

The failed Live Re-smoke Audit `SOL-GMGN-WALLET-STATS-PARSER-V2-7D-30D-LIVE-RESMOKE-AUDIT-001` has been transitioned from `READY` to `PARK` because the physical live smoke executed and identified the Parser schema blocker, superseding that audit by this repair (`GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-SCHEMA-REPAIR-001`) and its audit (`GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-SCHEMA-REPAIR-AUDIT-001`). Historical live evidence has been preserved intact without deletion or rewriting.
