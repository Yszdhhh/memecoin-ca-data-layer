# Acceptance Report: GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-SCHEMA-REPAIR-002

- **Task ID:** `GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-SCHEMA-REPAIR-002`
- **Baseline SHA:** `06f46955b1967c425180fb645f41166a06f4dc26`
- **Delivery SHA:** `06f46955b1967c425180fb645f41166a06f4dc26`
- **Role:** Internal Coordinator + Implementer (`implementer-gmgn-wallet-stats-documented-composite-schema-repair-002`)
- **Status:** `DONE`

---

## 1. Executive Summary & Root Cause

`GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-SCHEMA-REPAIR-001` introduced recognition for GMGN's official `root` + `pnl_stat` composite schema. However, it did not enforce explicit container field ownership between `root` and `pnl_stat`, leaving room for container ambiguity where mislocated metrics were accepted or misclassified. Furthermore, Repair-001 acceptance and external feedback contained Delivery SHA errors (erroneously reporting `06f4695e6381bc67852c003fc1cbb613589b2510`, which is not an actual Git commit).

Repair-002 completely replaces Repair-001 and its audit:
1. Enforces strict, non-negotiable container field ownership between `root` and `pnl_stat`.
2. Fails closed with `gmgn_wallet_stats_schema_unrecognized` whenever a metric is provided in the wrong container (e.g. `pnl_stat.realized_profit`, `pnl_stat.buy_count`, `root.token_num` in composite mode).
3. Preserves legal structures, ratio-to-percent mapping (`pnl_stat.winrate = 0.4` -> `40`), missing metric nulls, partial completeness, and standalone stats mode.
4. Appends explicit SHA corrections to Repair-001 acceptance and transitions `GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-SCHEMA-REPAIR-AUDIT-001` to `PARK`.

---

## 2. Documented Composite Schema Field Ownership Contract

### Explicit Field Ownership Matrix

In `root` + `pnl_stat` composite mode:

- **Root-owned metrics (and ONLY Root):**
  - `periodPnl`: `pnl_7d`, `pnl_30d`, `pnl`, `total_pnl`, `pnl_usd`, `realized_pnl`
  - `realizedProfit`: `realized_profit_7d`, `realized_profit_30d`, `realized_profit`, `realized_profit_usd`, `total_profit`, `total_profit_usd`
  - `realizedProfitPnl`: `realized_profit_pnl_7d`, `realized_profit_pnl_30d`, `realized_profit_pnl`
  - `tradeCount`: `trade_count_7d`, `trade_count_30d`, `trades_7d`, `trades_30d`, `tx_count_7d`, `tx_count_30d`, `trade_count`, `trade_num`, `total_trades`, `trades`, `tx_count` (explicit only; never synthesized)
  - `buyCount`: `buy_7d`, `buy_30d`, `buy_count_7d`, `buy_count_30d`, `buy`, `buy_count`, `bought_count`, `buy_num`
  - `sellCount`: `sell_7d`, `sell_30d`, `sell_count_7d`, `sell_count_30d`, `sell`, `sell_count`, `sold_count`, `sell_num`
  - `boughtCost`: `bought_cost_7d`, `bought_cost_30d`, `total_cost_7d`, `total_cost_30d`, `bought_cost`, `total_cost`, `buy_volume`
  - `soldIncome`: `sold_income_7d`, `sold_income_30d`, `total_income_7d`, `total_income_30d`, `sold_income`, `total_income`, `sell_volume`
  - `lastActiveTimestamp`: `last_timestamp`, `last_active_timestamp`, `last_trade_time`, `last_active_time`, `last_active`, `updated_at`

- **pnl_stat-owned metrics (and ONLY pnl_stat):**
  - `tokenNum`: `token_num`, `token_num_7d`, `token_num_30d`, `token_count`, `token_count_7d`, `token_count_30d`, `total_tokens`
  - `winRate`: `winrate`, `win_rate`, `win_rate_7d`, `win_rate_30d`, `win_rate_percent`, `win_rate_ratio`, `winrate_ratio`, `winning_rate`

### Mislocated Metric Fail-Closed Enforcement

When evaluating `root` + `pnl_stat`:
- If `pnl_stat` contains any Root-owned metric (e.g. `pnl_stat.realized_profit`, `pnl_stat.buy_count`), the response fails closed with `gmgn_wallet_stats_schema_unrecognized`.
- If `root` contains any `pnl_stat`-owned metric (e.g. `root.token_num`) while `pnl_stat` is present, the response fails closed with `gmgn_wallet_stats_schema_unrecognized`.
- If a mislocated metric shares the exact same numeric value as the correctly located metric, it STILL fails closed with `gmgn_wallet_stats_schema_unrecognized`.

---

## 3. Preserved Legal Structures & Standalone Stats Mode

- **Standalone stats mode:** When `stats` is the sole metric container (no `root` or `pnl_stat` metrics present), `stats` operates as a standalone container able to supply all 11 metrics.
- **Standalone root mode:** When direct root payload contains no `pnl_stat` sub-object, root operates as a standalone container able to supply all 11 metrics.
- **WinRate Ratio Conversion:** `pnl_stat.winrate = 0.4` is deterministically converted to `40` (percentage).
- **Completeness & Status:**
  - Missing metrics remain `undefined` in aggregates.
  - Less than 11/11 fields yields `PARTIAL`.
  - Only 11/11 fields yields `MAPPED`.
  - Period contracts (`7d`/`30d`), strict numeric types (rejecting string numbers `"123"`), explicit `0` preservation, and unverified period handling are fully preserved.

---

## 4. Evidence SHA Corrections & Audit Transition

- **Repair-001 Baseline SHA:** `fc12f3fdc6e14adc1f68e21e2dcda1b11d35d5a7`
- **Repair-001 Delivery SHA:** `06f46955b1967c425180fb645f41166a06f4dc26`
- **External Feedback Clarification:** Value `06f4695e6381bc67852c003fc1cbb613589b2510` is an invalid string from external feedback and NOT a Git commit.
- **Audit Transition:** `GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-SCHEMA-REPAIR-AUDIT-001` has been updated to status `PARK` in both its task spec and `harness/ledger/tasks.json`.
- **Repair-002 Delivery SHA:** `06f46955b1967c425180fb645f41166a06f4dc26` (uncommitted clean baseline).

---

## 5. Synthetic Unit Test Coverage (20 Tests Passed)

Synthetic test suite in `test/gmgn-wallet-stats-parser.test.ts` covers:
1. Legal `root` + `pnl_stat` composite structure yielding `MAPPED` (11/11).
2. Valid `root` `realized_profit` + `pnl_stat` `token_num`/`winrate` yielding `PARTIAL`.
3. `pnl_stat.winrate = 0.4` mapping to `40`.
4. `pnl_stat.realized_profit` alone failing closed (`gmgn_wallet_stats_schema_unrecognized`).
5. `pnl_stat.buy_count` alone failing closed (`gmgn_wallet_stats_schema_unrecognized`).
6. `root.token_num` in composite mode failing closed (`gmgn_wallet_stats_schema_unrecognized`).
7. Mislocated field with identical value failing closed (`gmgn_wallet_stats_schema_unrecognized`).
8. Mislocated field with conflicting value failing closed (`gmgn_wallet_stats_schema_unrecognized`).
9. `root` + `pnl_stat` + `stats` multi-container ambiguity failing closed (`gmgn_wallet_stats_schema_unrecognized`).
10. `decoy`, `summary`, `market`, `token` sub-nodes ignored.
11. Standalone stats mode functionality.
12. Wrong or unsupported period failing closed (`gmgn_wallet_stats_period_mismatch`).
13. Numeric strings (`"123"`) triggering `gmgn_wallet_stats_invalid_field_type`.
14. Explicit `0` values preserved as `0`.
15. Incomplete fields yielding `PARTIAL`.
16. Complete 11/11 fields yielding `MAPPED`.

---

## 6. Resource & Boundary Audit

- **Network Requests:** `0`
- **Provider Requests:** `0`
- **GMGN CLI Invocations:** `0`
- **Credential Reads:** `0`
- **Real Address Processing:** `0`

---

## 7. Post-Commit Execution Evidence

- **Repair-002 baseline SHA:** `06f46955b1967c425180fb645f41166a06f4dc26`
- **Repair-002 implementation SHA:** `8992f321b4ac936e95581989cf9dc30f3f4c70f0`
- The earlier `Delivery SHA` value in this report was a pre-commit baseline placeholder and is not the implementation delivery identifier.
- Clean-tree validation on implementation commit `8992f321b4ac936e95581989cf9dc30f3f4c70f0`:
  - Repair task validation: GREEN
  - Repair audit task validation: GREEN
  - Harness Doctor: GREEN, 0 errors, 0 warnings
  - Typecheck: PASS
  - Tests: 315 total, 314 passed, 1 skipped, 0 failed
  - Build: PASS
  - `git diff --check`: PASS
- Resource counters remained zero: network requests, provider requests, GMGN CLI invocations, credential reads, and real-address processing.
