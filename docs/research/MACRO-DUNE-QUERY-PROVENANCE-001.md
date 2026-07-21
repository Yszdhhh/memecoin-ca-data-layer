# MACRO-DUNE-QUERY-PROVENANCE-001

| Field | Value |
| --- | --- |
| task_id | MACRO-DUNE-QUERY-PROVENANCE-001 |
| tier / role | T1 / researcher |
| report_utc | 2026-07-21 (local research day) |
| dependencies | MACRO-DUNE-RESEARCH-001, MACRO-DAILY-OFFLINE-AUDIT-001 |
| write_set | `docs/research/MACRO-DUNE-QUERY-PROVENANCE-001.md` only |
| verdict | **GREEN_WITH_ADVISORY** — Spellbook structure/fields/registry pinned at full SHA; all SQL blueprints are **UNEXECUTED**; live row freshness, amount_usd coverage, and Dune lag remain **UNVERIFIED** |

## 0. Execution boundary (mandatory)

1. **No Dune API, CLI, dashboard, cookie, credential, or paid query was used.**
2. **Every SQL block below is a blueprint only.** It has **not** been executed. Do **not** claim live correctness, row counts, production readiness, or real-time coverage.
3. A metric may become execution-verified only after a **separate Owner-authorized run** that stores: Dune query ID, SQL body hash, execution ID, `source_as_of`, and result checksum. Until then completeness must reflect schema-only research.
4. Out of scope / **not claimed verified**: full-chain Robinhood, Four.meme launches, stablecoin supply, bridge net flow, global TVL, market-cap/FDV, survival/drawdown/valuation cohorts.

## 1. Spellbook pin

| Item | Value |
| --- | --- |
| Repo | https://github.com/duneanalytics/spellbook |
| Branch tip at research | `main` |
| **Pinned full commit SHA** | `b553234af744bef843a51e7f1cfd319d5cced24d` |
| Commit message | Remove inline optimize_spell macro and post-hooks (#9893) |
| Commit author date (GitHub) | 2026-07-20T20:29:41Z |
| Immutable commit URL | https://github.com/duneanalytics/spellbook/commit/b553234af744bef843a51e7f1cfd319d5cced24d |

**registry_version (Robinhood):** `spellbook:dex_robinhood:uniswap_v2_v3_v4@b553234af744bef843a51e7f1cfd319d5cced24d`

**query_version pattern:** `blueprint:MACRO-DUNE-QUERY-PROVENANCE-001@b553234af744bef843a51e7f1cfd319d5cced24d#<blueprint_id>`

Raw base: `https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/<path>`

## 2. Source-lock matrix

### 2.1 Shared time / dedup

| Concern | Rule |
| --- | --- |
| Calendar day | `report_day` UTC; `block_date = DATE '{{report_day}}'` or `CAST(block_time AS date)` |
| Hour profile | `hour_utc = EXTRACT(HOUR FROM block_time)` in [0,23]; UTC only |
| Profile window | `profile_window_days` in {60,90}; end-inclusive on report_day (pin at exec) |
| EVM trade grain | `(blockchain, project, version, tx_hash, evt_index [, block_month])` |
| Solana trade grain | `(tx_id, outer_instruction_index, inner_instruction_index, tx_index, block_month)` |
| Volume | `SUM(amount_usd)` per leg — warn `volume_is_leg_sum` |
| Traders | EVM `approx_distinct(taker)`; Solana `approx_distinct(trader_id)` |

### 2.2 Global

| metric_name | unit | subject | table | model path | fields | limits | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dex_volume_usd | usd | global_evm | dex.trades | dbt_subprojects/dex/models/trades/dex_trades.sql | blockchain, project, version, block_date, block_time, amount_usd, taker, tx_hash, evt_index | sector partial | VERIFIED structure |
| active_trader_count | count | global_evm | dex.trades | same | taker, block_date | taker nulls | VERIFIED structure |
| btc_transaction_count | count | bitcoin | metrics_bitcoin.transactions_daily | dbt_subprojects/daily_spellbook/models/_metrics/transactions/chains/bitcoin/metrics_bitcoin_transactions_daily.sql | blockchain, block_date, tx_count | heuristic amount_transfer_usd>1, not raw tx | VERIFIED structure |
| btc_fee_usd | usd | bitcoin | metrics_bitcoin.gas_fees_daily | dbt_subprojects/daily_spellbook/models/_metrics/fees/chains/bitcoin/metrics_bitcoin_gas_fees_daily.sql | blockchain, block_date, gas_fees_usd | excludes current UTC day | VERIFIED structure |

URLs:

- https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/dex/models/trades/dex_trades.sql
- https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/dex/macros/dex_evm_chains.sql
- https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/daily_spellbook/models/_metrics/transactions/chains/bitcoin/metrics_bitcoin_transactions_daily.sql
- https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/daily_spellbook/models/_metrics/fees/chains/bitcoin/metrics_bitcoin_gas_fees_daily.sql

### 2.3 Solana

| metric_name | section | unit | table | model path | notes | status |
| --- | --- | --- | --- | --- | --- | --- |
| dex_volume_usd | capital | usd | dex_solana.trades | dbt_subprojects/solana/models/_sector/dex/dex_solana_trades.sql | sanctum_router excluded | VERIFIED |
| active_trader_count | capital | count | dex_solana.trades | same | trader_id | VERIFIED |
| pump_launch_count | supply | count | solana.instruction_calls via pump create | dbt_subprojects/solana/models/_sector/dex/pumpdotfun/solana/pumpdotfun_solana_base_trades.sql | program 6EF8… disc 0x181ec828051c0777 | VERIFIED path |
| external_pool_count | supply | count | pumpswap_solana.pools | dbt_subprojects/solana/models/_sector/dex/pumpswap/pumpswap_solana_pools.sql | not migrate; is_valid_pool | VERIFIED path |

URLs:

- https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/solana/models/_sector/dex/dex_solana_base_trades.sql
- https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/solana/models/_sector/dex/dex_solana_trades.sql
- https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/solana/models/_sector/dex/pumpdotfun/solana/pumpdotfun_solana_base_trades.sql
- https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/solana/models/_sector/dex/pumpswap/pumpswap_solana_pools.sql

registry_version capital: `spellbook:dex_solana:base_trades_union@b553234af744bef843a51e7f1cfd319d5cced24d`  
coverage_status: `declared_registry`

### 2.4 BSC Pancake

| metric_name | section | unit | table | model path | notes | status |
| --- | --- | --- | --- | --- | --- | --- |
| dex_volume_usd | capital | usd | dex.trades | blockchain=bnb | optional project=pancakeswap | VERIFIED |
| active_trader_count | capital | count | dex.trades | same | taker | VERIFIED |
| pancakeswap_pool_created_count | supply | count | pancakeswap_bnb.pools | dbt_subprojects/dex/models/_projects/pancakeswap/bnb/pancakeswap_bnb_pools.sql | v2/v3/stableswap/infinity | VERIFIED |
| pancakeswap_lp_net_change_usd | supply | usd | pancakeswap_bnb.base_liquidity_events | .../pancakeswap_bnb_base_liquidity_events.sql | raw only; USD unpinned | structure VERIFIED; USD UNVERIFIED |

URLs:

- https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/dex/models/_projects/pancakeswap/bnb/pancakeswap_bnb_pools.sql
- https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/dex/models/_projects/pancakeswap/bnb/pancakeswap_bnb_base_liquidity_events.sql

registry_version: `spellbook:dex_trades:blockchain=bnb@b553234af744bef843a51e7f1cfd319d5cced24d`  
Four.meme: **PARK**

### 2.5 Robinhood Uniswap v2/v3/v4 only

| metric_name | section | unit | table | notes | status |
| --- | --- | --- | --- | --- | --- |
| dex_volume_usd | capital | usd | dex.trades | blockchain=robinhood, project=uniswap, version in 2/3/4 | VERIFIED partial |
| active_trader_count | capital | count | dex.trades | same | VERIFIED partial |
| uniswap_pool_created_count | supply | count | factory PairCreated/PoolCreated/Initialize | confirm catalog at exec | path VERIFIED |

URLs:

- https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/dex/models/trades/robinhood/dex_robinhood_base_trades.sql
- https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/dex/models/trades/robinhood/_schema.yml
- https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/dex/models/trades/robinhood/platforms/uniswap_v2_robinhood_base_trades.sql

registry_version: `spellbook:dex_robinhood:uniswap_v2_v3_v4@b553234af744bef843a51e7f1cfd319d5cced24d`  
coverage_status: **partial_coverage** (required)  
Local robinhood_dex_volume.sql / query_7986129: **UNVERIFIED, do not promote**

### 2.6 UTC hourly profiles

solana/bsc/robinhood metrics listed in offline contract; hour_utc 0-23; window 60|90; robinhood always partial_coverage.

## 3. Unexecuted DuneSQL blueprints

All blocks: **UNEXECUTED**. Params: `{{report_day}}`, `{{profile_window_days}}`.

### G1

```sql
-- blueprint_id: G1_global_evm_dex_day
-- query_version: blueprint:MACRO-DUNE-QUERY-PROVENANCE-001@b553234af744bef843a51e7f1cfd319d5cced24d#G1
-- UNEXECUTED
SELECT DATE '{{report_day}}' AS report_day,
  SUM(amount_usd) AS dex_volume_usd,
  approx_distinct(taker) AS active_trader_count
FROM dex.trades
WHERE block_date = DATE '{{report_day}}' AND amount_usd IS NOT NULL;
```

### G2

```sql
-- blueprint_id: G2_btc_tx_count
-- query_version: blueprint:MACRO-DUNE-QUERY-PROVENANCE-001@b553234af744bef843a51e7f1cfd319d5cced24d#G2
-- UNEXECUTED
SELECT block_date AS report_day, tx_count AS btc_transaction_count
FROM metrics_bitcoin.transactions_daily
WHERE block_date = DATE '{{report_day}}';
```

### G3

```sql
-- blueprint_id: G3_btc_fee_usd
-- query_version: blueprint:MACRO-DUNE-QUERY-PROVENANCE-001@b553234af744bef843a51e7f1cfd319d5cced24d#G3
-- UNEXECUTED
SELECT block_date AS report_day, gas_fees_usd AS btc_fee_usd
FROM metrics_bitcoin.gas_fees_daily
WHERE block_date = DATE '{{report_day}}';
```

### S1

```sql
-- blueprint_id: S1_solana_capital_day
-- query_version: blueprint:MACRO-DUNE-QUERY-PROVENANCE-001@b553234af744bef843a51e7f1cfd319d5cced24d#S1
-- UNEXECUTED
SELECT DATE '{{report_day}}' AS report_day,
  SUM(amount_usd) AS dex_volume_usd,
  approx_distinct(trader_id) AS active_trader_count
FROM dex_solana.trades
WHERE block_date = DATE '{{report_day}}' AND amount_usd IS NOT NULL;
```

### S2

```sql
-- blueprint_id: S2_solana_pump_launch_day
-- query_version: blueprint:MACRO-DUNE-QUERY-PROVENANCE-001@b553234af744bef843a51e7f1cfd319d5cced24d#S2
-- UNEXECUTED
SELECT DATE '{{report_day}}' AS report_day, COUNT(*) AS pump_launch_count
FROM solana.instruction_calls
WHERE executing_account = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'
  AND bytearray_substring(data, 1, 8) = 0x181ec828051c0777
  AND tx_success = true
  AND CAST(block_time AS date) = DATE '{{report_day}}';
```

### S3

```sql
-- blueprint_id: S3_solana_pumpswap_pool_day
-- query_version: blueprint:MACRO-DUNE-QUERY-PROVENANCE-001@b553234af744bef843a51e7f1cfd319d5cced24d#S3
-- UNEXECUTED — NOT migrate
SELECT DATE '{{report_day}}' AS report_day, COUNT(*) AS external_pool_count
FROM pumpswap_solana.pools
WHERE CAST(created_at AS date) = DATE '{{report_day}}' AND is_valid_pool = true;
```

### B1

```sql
-- blueprint_id: B1_bsc_capital_day
-- query_version: blueprint:MACRO-DUNE-QUERY-PROVENANCE-001@b553234af744bef843a51e7f1cfd319d5cced24d#B1
-- UNEXECUTED
SELECT DATE '{{report_day}}' AS report_day,
  SUM(amount_usd) AS dex_volume_usd,
  approx_distinct(taker) AS active_trader_count
FROM dex.trades
WHERE blockchain = 'bnb' AND block_date = DATE '{{report_day}}' AND amount_usd IS NOT NULL;
```

### B2

```sql
-- blueprint_id: B2_pancake_pool_created_day
-- query_version: blueprint:MACRO-DUNE-QUERY-PROVENANCE-001@b553234af744bef843a51e7f1cfd319d5cced24d#B2
-- UNEXECUTED
SELECT DATE '{{report_day}}' AS report_day, COUNT(*) AS pancakeswap_pool_created_count
FROM pancakeswap_bnb.pools
WHERE CAST(creation_block_time AS date) = DATE '{{report_day}}';
```

### B3

```sql
-- blueprint_id: B3_pancake_lp_raw_day
-- query_version: blueprint:MACRO-DUNE-QUERY-PROVENANCE-001@b553234af744bef843a51e7f1cfd319d5cced24d#B3
-- UNEXECUTED — USD join NOT pinned
SELECT DATE '{{report_day}}' AS report_day, event_type,
  COUNT(*) AS event_count, SUM(amount0_raw) AS amount0_raw_sum, SUM(amount1_raw) AS amount1_raw_sum
FROM pancakeswap_bnb.base_liquidity_events
WHERE block_date = DATE '{{report_day}}'
GROUP BY 1, 2;
```

### R1

```sql
-- blueprint_id: R1_robinhood_uni_capital_day
-- query_version: blueprint:MACRO-DUNE-QUERY-PROVENANCE-001@b553234af744bef843a51e7f1cfd319d5cced24d#R1
-- UNEXECUTED — partial_coverage mandatory
SELECT DATE '{{report_day}}' AS report_day,
  SUM(amount_usd) AS dex_volume_usd,
  approx_distinct(taker) AS active_trader_count
FROM dex.trades
WHERE blockchain = 'robinhood' AND project = 'uniswap' AND version IN ('2','3','4')
  AND block_date = DATE '{{report_day}}' AND amount_usd IS NOT NULL;
```

### R2

```sql
-- blueprint_id: R2_robinhood_uni_pool_created_day
-- query_version: blueprint:MACRO-DUNE-QUERY-PROVENANCE-001@b553234af744bef843a51e7f1cfd319d5cced24d#R2
-- UNEXECUTED — confirm catalog names at execution
SELECT DATE '{{report_day}}' AS report_day, COUNT(*) AS uniswap_pool_created_count
FROM (
  SELECT evt_block_time AS t FROM uniswap_v2_robinhood.UniswapV2Factory_evt_PairCreated
  WHERE CAST(evt_block_time AS date) = DATE '{{report_day}}'
  UNION ALL
  SELECT evt_block_time FROM uniswap_v3_robinhood.UniswapV3Factory_evt_PoolCreated
  WHERE CAST(evt_block_time AS date) = DATE '{{report_day}}'
  UNION ALL
  SELECT evt_block_time FROM uniswap_v4_robinhood.PoolManager_evt_Initialize
  WHERE CAST(evt_block_time AS date) = DATE '{{report_day}}'
) u;
```

### H1 Solana hourly volume

```sql
-- blueprint_id: H1_solana_dex_volume_hourly
-- query_version: blueprint:MACRO-DUNE-QUERY-PROVENANCE-001@b553234af744bef843a51e7f1cfd319d5cced24d#H1
-- UNEXECUTED
WITH w AS (
  SELECT EXTRACT(HOUR FROM block_time) AS hour_utc, CAST(block_time AS date) AS d, SUM(amount_usd) AS v
  FROM dex_solana.trades
  WHERE CAST(block_time AS date) > DATE '{{report_day}}' - INTERVAL '{{profile_window_days}}' DAY
    AND CAST(block_time AS date) <= DATE '{{report_day}}' AND amount_usd IS NOT NULL
  GROUP BY 1, 2
),
h AS (SELECT hour_utc, SUM(v) AS metric_value, COUNT(DISTINCT d) AS sample_day_count FROM w GROUP BY 1),
tot AS (SELECT SUM(metric_value) AS t FROM h)
SELECT hour_utc, metric_value, sample_day_count,
  CASE WHEN tot.t > 0 THEN metric_value / tot.t ELSE 0 END AS metric_share
FROM h CROSS JOIN tot;
```

H2 BSC: same on `dex.trades` WHERE `blockchain='bnb'`.  
H3 Robinhood: same with uniswap filter; partial_coverage.

## 4. Offline model mapping

| Store | metric_name | unit | section | chain/subject | registry_version | coverage_status | query_ref | query_version | completeness | warnings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| global | dex_volume_usd | usd | — | global_evm | n/a | n/a | dune:blueprint:G1 | …#G1 | 0 | unexecuted_blueprint, volume_is_leg_sum |
| global | active_trader_count | count | — | global_evm | n/a | n/a | dune:blueprint:G1 | …#G1 | 0 | unexecuted_blueprint |
| global | btc_transaction_count | count | — | bitcoin | n/a | n/a | dune:blueprint:G2 | …#G2 | 0 | unexecuted_blueprint, heuristic_usd_gt_1 |
| global | btc_fee_usd | usd | — | bitcoin | n/a | n/a | dune:blueprint:G3 | …#G3 | 0 | unexecuted_blueprint, excludes_current_day |
| chain | dex_volume_usd | usd | capital | solana | spellbook:dex_solana:base_trades_union@b553234af744bef843a51e7f1cfd319d5cced24d | declared_registry | dune:blueprint:S1 | …#S1 | 0 | unexecuted_blueprint |
| chain | active_trader_count | count | capital | solana | same | declared_registry | dune:blueprint:S1 | …#S1 | 0 | unexecuted_blueprint |
| chain | pump_launch_count | count | supply | solana | spellbook:pumpdotfun:create@b553234af744bef843a51e7f1cfd319d5cced24d | declared_registry | dune:blueprint:S2 | …#S2 | 0 | unexecuted_blueprint, pump_only |
| chain | external_pool_count | count | supply | solana | spellbook:pumpswap:pools@b553234af744bef843a51e7f1cfd319d5cced24d | declared_registry | dune:blueprint:S3 | …#S3 | 0 | unexecuted_blueprint, not_migrate |
| chain | dex_volume_usd | usd | capital | bsc | spellbook:dex_trades:blockchain=bnb@b553234af744bef843a51e7f1cfd319d5cced24d | declared_registry | dune:blueprint:B1 | …#B1 | 0 | unexecuted_blueprint |
| chain | active_trader_count | count | capital | bsc | same | declared_registry | dune:blueprint:B1 | …#B1 | 0 | unexecuted_blueprint |
| chain | pancakeswap_pool_created_count | count | supply | bsc | spellbook:pancakeswap_bnb:pools@b553234af744bef843a51e7f1cfd319d5cced24d | declared_registry | dune:blueprint:B2 | …#B2 | 0 | unexecuted_blueprint |
| chain | pancakeswap_lp_net_change_usd | usd | supply | bsc | spellbook:pancakeswap_bnb:base_liquidity_events@b553234af744bef843a51e7f1cfd319d5cced24d | declared_registry | dune:blueprint:B3 | …#B3 | 0 | unexecuted_blueprint, usd_conversion_unpinned |
| chain | dex_volume_usd | usd | capital | robinhood | spellbook:dex_robinhood:uniswap_v2_v3_v4@b553234af744bef843a51e7f1cfd319d5cced24d | partial_coverage | dune:blueprint:R1 | …#R1 | 0 | unexecuted_blueprint, uniswap_only |
| chain | active_trader_count | count | capital | robinhood | same | partial_coverage | dune:blueprint:R1 | …#R1 | 0 | unexecuted_blueprint |
| chain | uniswap_pool_created_count | count | supply | robinhood | same | partial_coverage | dune:blueprint:R2 | …#R2 | 0 | unexecuted_blueprint |
| hourly | same names | usd/count | timing | solana/bsc/robinhood | per chain | per chain | dune:blueprint:H* | …#H* | 0 | unexecuted_blueprint, utc_only |

source=`dune` when injected; source_as_of only after real execution.

## 5. PARK / UNVERIFIED

| Item | Label |
| --- | --- |
| All blueprints | UNEXECUTED |
| Live freshness/lag | UNVERIFIED |
| Four.meme | PARK |
| Stablecoin/bridge/TVL/mcap/FDV/drawdown | PARK |
| Pump migrate fact table | UNVERIFIED |
| LP net change USD e2e | UNVERIFIED |
| query_7986129 / robinhood_dex_volume.sql | UNVERIFIED |
| Full-chain Robinhood | Forbidden |

## 6. Acceptance commands

```text
npm run harness:task -- validate harness/tasks/MACRO-DUNE-QUERY-PROVENANCE-001.json
npm run typecheck
npm test
git diff --check
```

## 7. Command results

| Command | Exit | Evidence |
| --- | --- | --- |
| `npm run harness:task -- validate harness/tasks/MACRO-DUNE-QUERY-PROVENANCE-001.json` | 0 | `{"task_id":"MACRO-DUNE-QUERY-PROVENANCE-001","status":"GREEN","errors":[]}` |
| `npm run typecheck` | 0 | `tsc -p tsconfig.json --noEmit` clean |
| `npm test` | 0 | 35 pass, 0 fail |
| `git diff --check` | 0 | no whitespace errors reported for this deliverable |

**Write-set check:** only this file was created by this task (`docs/research/MACRO-DUNE-QUERY-PROVENANCE-001.md`). No credentials, Dune execution, SQL/source/migration/test/task/ledger edits.

**git status note:** other dirty/untracked paths in the worktree pre-exist and are outside this task write_set; they are not part of this deliverable.

## 8. Verdict

**GREEN_WITH_ADVISORY**

- Full SHA pin `b553234af744bef843a51e7f1cfd319d5cced24d` + immutable URLs.
- Whitelist fields, UTC, dedup, registries, unexecuted SQL blueprints, offline mapping.
- Nothing execution-verified; do not ship collectors from this doc alone.
