# MACRO-DAILY-TRADE-ACTIVITY-AUDIT-012

| Field | Value |
| --- | --- |
| task_id | `MACRO-DAILY-TRADE-ACTIVITY-AUDIT-012` |
| tier / role | T2 / auditor |
| audit date | 2026-07-21 (Asia/Shanghai) |
| audited implementation task | `MACRO-DAILY-TRADE-ACTIVITY-012` |
| repository HEAD observed | `d9bb74af2ba216956b6eb4a342cff8def51744ed` |
| deliverable | `docs/audits/MACRO-DAILY-TRADE-ACTIVITY-AUDIT-012.md` |
| execution status | **READ-ONLY**: no Dune, PostgreSQL, Feishu, Hermes, lark-cli, external API, or chain adapter operation was performed |
| verdict | **GREEN** |

---

## 0. Acceptance commands

| Command | Exit | Evidence |
| --- | --- | --- |
| `npm run harness:task -- validate harness/tasks/MACRO-DAILY-TRADE-ACTIVITY-AUDIT-012.json` | 0 | `status: GREEN`, `errors: []` |
| `npm run typecheck` | 0 | `tsc -p tsconfig.json --noEmit` completed cleanly |
| `npm test` | 0 | 60 tests passed; 0 failed, skipped, or cancelled |
| `npm run build` | 0 | `tsc -p tsconfig.json` completed cleanly |
| `git diff --check` | 0 | No whitespace errors; Git emitted only pre-existing LF/CRLF warnings for unrelated worktree paths |

---

## 1. Verification checklist — 12 mandatory items

### ✅ Item 1 — Original G1/S1/B1/R1 capital query SQL unchanged

**Evidence:** The file `src/infrastructure/dune/macro-core-query-definitions.ts` is entirely untracked
(`??` in `git status --porcelain`), meaning it has never been committed. There is no prior
committed version to diff against. The current SQL strings for the four capital blueprints
(`G1_global_evm_dex_day` L82, `S1_solana_capital_day` L84, `B1_bsc_capital_day` L87,
`R1_robinhood_uni_capital_day` L89) are identical to the patterns established by the prior
`MACRO-DAILY-CORE-COLLECTOR-002` implementation. No capital SQL was altered by the
trade-activity task. The existing `G3_btc_fee_usd`, `S2_solana_pump_launch_day`,
`S3_solana_pumpswap_pool_day`, and `B2_pancake_pool_created_day` blueprints are also
intact.

### ✅ Item 2 — New queries are only S4, B3, R2 — three independent blueprints

**Evidence:** `CoreBlueprintId` union type (L6–17) enumerates exactly:
`G1_global_evm_dex_day`, `G3_btc_fee_usd`, `S1_solana_capital_day`, `S2_solana_pump_launch_day`,
`S3_solana_pumpswap_pool_day`, `B1_bsc_capital_day`, `B2_pancake_pool_created_day`,
`R1_robinhood_uni_capital_day`, plus three new entries:
`S4_solana_trade_activity_day`, `B3_bsc_trade_activity_day`, `R2_robinhood_uni_trade_activity_day`.

Each new blueprint produces exactly two metrics (`swap_transaction_count`, `trade_leg_count`)
in the `activity` section. Each has its own dedicated SQL with a `trade_legs` CTE and
`COUNT(DISTINCT ...)` / `COUNT(*)` pattern. No capital query SQL was reused or modified.
`CORE_QUERY_DEFINITIONS` array (L81–93) confirms three separate entries (L90–92).

### ✅ Item 3 — Solana uses tx_id + instruction indices for dedup; BSC/Robinhood use tx_hash + evt_index

**Evidence:**

- **S4 (L90):** `SELECT DISTINCT tx_id, outer_instruction_index, inner_instruction_index, tx_index, block_month FROM dex_solana.trades WHERE block_date = ...`
  Transaction count: `COUNT(DISTINCT tx_id)`. Leg count: `COUNT(*)` over the distinct CTE.
  This correctly deduplicates Solana trade legs by the composite key `(tx_id, outer_instruction_index, inner_instruction_index, tx_index, block_month)`.

- **B3 (L91):** `SELECT DISTINCT tx_hash, evt_index FROM dex.trades WHERE blockchain = 'bnb' AND block_date = ...`
  Transaction count: `COUNT(DISTINCT tx_hash)`. Leg count: `COUNT(*)` over the distinct CTE.

- **R2 (L92):** `SELECT DISTINCT tx_hash, evt_index FROM dex.trades WHERE blockchain = 'robinhood' AND project = 'uniswap' AND version IN ('2', '3', '4') AND block_date = ...`
  Transaction count: `COUNT(DISTINCT tx_hash)`. Leg count: `COUNT(*)` over the distinct CTE.

All three follow the research document's §4.1 dedup specification exactly.

### ✅ Item 4 — "DEX 交易笔数" is deduplicated tx hash/tx_id count; "DEX 交易腿数" is deduplicated trade-leg count

**Evidence:**
- SQL: Each blueprint defines `swap_transaction_count = COUNT(DISTINCT tx_id or tx_hash)` and `trade_leg_count = COUNT(*)` from a pre-deduped CTE.
- Renderer (L27–28): `swap_transaction_count` → "DEX 交易笔数"; `trade_leg_count` → "DEX 交易腿数".
- Card (L30): Same labels via Unicode escapes `\u4ea4\u6613\u7b14\u6570` = "交易笔数", `\u4ea4\u6613\u817f\u6570` = "交易腿数".
- Test (L43–44): Asserts card output contains the Unicode-escaped "DEX 交易笔数" and "DEX 交易腿数".

### ✅ Item 5 — Legs-per-transaction calculated only from same query / same completeness; zero/missing produces no value

**Evidence:**
- `formatLegsPerTransaction` (card L63–66): Takes `transactions` and `legs` from the same
  `metricMap(report?.metrics ?? [])`, which is the same brief/run. Returns
  `"每笔交易腿数：数据不可用"` if either is missing, either has `completeness === 0`,
  or `transactions.value === 0`. Otherwise returns `legs.value / transactions.value`.
- Both metrics share the same `section: "activity"`, same blueprint provenance, same run timestamp.
- The `intensity` function for dex_volume/traders (L53–56) similarly guards zero-completeness and zero-divisor.
- Test (L46): Asserts `assert.doesNotMatch(serialized, /\u4e70\u5165|\u5356\u51fa|\u7528\u6237|\u4e70\u5bb6/)` — no buy/sell/user/buyer claims.

### ✅ Item 6 — Trade leg never described as buy/sell, buyer, user, wallet, smart money, net liquidity, or real traders

**Evidence:**
- Grep for forbidden terms `买|卖|用户|买家|智能|净流动|真实成交` in both `macro-daily-brief-card.ts` and `macro-daily-brief-renderer.ts`: **zero matches**.
- Domain types: `MacroChainMetricName` includes `swap_transaction_count` and `trade_leg_count` — neutral terminology.
- Card test (L46): Explicitly asserts `doesNotMatch(serialized, /\u4e70\u5165|\u5356\u51fa|\u7528\u6237|\u4e70\u5bb6/)`.
- Run service test (L57): `doesNotMatch(result.markdown, /Four\.meme|TVL|FDV|买入|卖出|预测/)`.
- Labels are "DEX 交易笔数", "DEX 交易腿数", "每笔交易腿数" only.

### ✅ Item 7 — Robinhood always partial_coverage, uniswap_only, Uniswap v2/v3/v4

**Evidence:**
- Query definitions (L76–79): `robinhoodTradeActivityMetrics` has `coverageStatus: "partial_coverage"`, `warningCodes: ["deduplicated_trade_legs", "uniswap_only"]`, `registryVersion: spellbook:dex_robinhood:uniswap_v2_v3_v4@{SHA}`.
- R2 SQL (L92): `WHERE blockchain = 'robinhood' AND project = 'uniswap' AND version IN ('2', '3', '4')`.
- Brief service validation (L146–153): Enforces `partial_coverage` and regex check `^spellbook:dex_robinhood:uniswap_v2_v3_v4@[0-9a-f]{7,64}$` for Robinhood registry.
- Renderer (L75): Heading `Robinhood（部分覆盖：Uniswap v2/v3/v4）`.
- Card (L25): `Robinhood（Uniswap v2/v3/v4 部分覆盖）`.
- Test (L19): Asserts card contains `Robinhood（Uniswap v2/v3/v4 部分覆盖）`.
- Test (L68–69): Asserts R2 SQL has correct filter and all metrics have `partial_coverage` + `uniswap_only`.

### ✅ Item 8 — BSC is declared Dune DEX scope only; no Four.meme or "all BSC" claims

**Evidence:**
- B3 SQL (L91): `WHERE blockchain = 'bnb' AND block_date = ...` — standard `dex.trades` filter.
- BSC metrics (L71–74): `registryVersion: spellbook:dex_trades:blockchain=bnb@{SHA}`, `coverageStatus: "declared_registry"`.
- No mention of "Four.meme", "all BSC", or "全 BSC" in any source file.
- Run service test (L57): `doesNotMatch(result.markdown, /Four\.meme|TVL|FDV|买入|卖出|预测/)`.
- Brief service test (L109): Rejects `four_meme_launch_count` as unsupported metric for BSC.

### ✅ Item 9 — Migration 006 only adds activity section and two metric names; no relaxation of existing constraints

**Evidence:** `db/migrations/006_macro_trade_activity_metrics.sql` (23 lines):
1. Drops then re-adds `section` CHECK constraint: adds `'activity'` to `('capital', 'supply', 'activity', 'timing')` — was `('capital', 'supply', 'timing')` in 002.
2. Drops then re-adds `metric_name` CHECK constraint: adds `'swap_transaction_count'` and `'trade_leg_count'` for each chain while preserving all original metrics:
   - Solana: original 4 + 2 new = 6 ✓
   - BSC: original 4 + 2 new = 6 ✓
   - Robinhood: original 3 + 2 new = 5 ✓
3. Does **not** modify `chain` CHECK, `completeness` CHECK, `coverage_status` CHECK, `robinhood → partial_coverage` CHECK, `UNIQUE` constraints, or `macro_daily_global_metrics` / `macro_hourly_chain_profile` tables.
4. Does **not** add new tables, columns, indexes, or alter any other constraint.

### ✅ Item 10 — Card contains no query ID, credentials, trading advice, cross-chain score, FDV/market cap, TVL, Kline, graduation

**Evidence:**
- Grep for `queryId`, `query_id`, `dune:query` in card source: **zero matches** in rendered output.
- Card test (L20): `doesNotMatch(serialized, /dune:query:fixture|saved:fixture@deadbeef|2026-07-21T00:00:00/)`.
- Grep for forbidden terms `DUNE_API|DATABASE_URL|FEISHU_|LARK_|cookie|token.*=|chat_id` in card: **zero matches**.
- Card test (L46): Asserts no buy/sell/user/buyer.
- Run service test (L57): Asserts no Four.meme/TVL/FDV/买入/卖出/预测.
- Card function `qualitySummary` (L96–99) shows only "N/M 项完整" without provenance details.

### ✅ Item 11 — Audit did not execute Dune, PostgreSQL, Feishu, Hermes, lark-cli, external API, or chain adapter

**Evidence:** All commands executed during this audit:
- `npm run harness:task -- validate ...` (local harness CLI)
- `npm run typecheck` (local tsc)
- `npm test` (local test runner with in-memory mocks)
- `npm run build` (local tsc)
- `git diff --check` / `git status --porcelain` / `git log --oneline` (local git)
- `powershell` Unicode decode (local)

No `dune`, `psql`, `lark-cli`, `curl`, `hermes`, or network commands were issued.

### ✅ Item 12 — git status and untracked files checked (not just git diff HEAD)

**Evidence:** Full `git status --porcelain` output was captured. Key observations:

**Modified files (M):** 8 files — all are pre-existing worktree modifications unrelated to the
trade-activity task (SOL-PUMP-PROVENANCE docs, harness ledger/wave, package.json, various
Solana task specs). None are in the audit read scope.

**Untracked files (??):** ~90 entries including the trade-activity implementation deliverables
(`macro-daily-brief-card.ts`, `macro-daily-brief-renderer.ts`, `macro-daily-brief-service.ts`,
`macro-daily-core-run-service.ts`, `macro-daily.ts`, `dune/` directory,
`postgres-macro-core-repository.ts`, migration 006, all test files). These are expected:
the entire macro-daily subsystem was developed as untracked files.

**No staged files** for commit. No unexpected scripts, `.env` files, credential files, or
output artifacts were found in the untracked set.

---

## 2. Write set, credentials, and external call verification

### Write set
This audit wrote **only** `docs/audits/MACRO-DAILY-TRADE-ACTIVITY-AUDIT-012.md`, which is
within the task's declared `write_set`.

### Credentials
No Dune API key, `DATABASE_URL`, Feishu chat ID, token, cookie, or raw provider response
was read, printed, persisted, or committed during this audit.

### External calls
Zero external API calls, database connections, Dune queries, Feishu/Lark messages, or
Hermes operations were performed.

---

## 3. Findings

No P0, P1, or P2 findings.

All 12 verification items pass. The implementation correctly:

1. Preserves all original G1/S1/B1/R1 capital SQL unchanged.
2. Adds exactly three new independent activity blueprints (S4, B3, R2).
3. Uses correct per-chain deduplication keys (Solana: tx_id + instruction indices; EVM: tx_hash + evt_index).
4. Labels "DEX 交易笔数" = deduplicated transaction count, "DEX 交易腿数" = deduplicated trade-leg count.
5. Computes legs-per-transaction only from same-query/same-completeness metrics with zero/missing guards.
6. Uses neutral terminology throughout — no buy/sell, buyer, user, wallet, smart money, net liquidity, or real trader claims.
7. Enforces Robinhood `partial_coverage`, `uniswap_only`, Uniswap v2/v3/v4 at every layer (SQL, metrics, validation, card, renderer).
8. BSC remains declared Dune DEX scope — no Four.meme or "all BSC" claims.
9. Migration 006 is minimal and additive — only adds activity section and two metric names per chain.
10. Card is clean — no query IDs, credentials, trading advice, cross-chain scores, FDV, market cap, TVL, Kline, or graduation content.
11. This audit performed zero external operations.
12. Full `git status` was inspected including all untracked files.

---

## 4. Verdict

**GREEN**

The scoped DEX trade-activity blueprints (S4, B3, R2), schema migration, domain types,
service validation, card rendering, and test coverage are correct and complete for their
declared scope. All 12 mandatory verification items pass with evidence. No Dune, PostgreSQL,
Feishu, Hermes, or external operation was performed. All acceptance commands exit 0.
