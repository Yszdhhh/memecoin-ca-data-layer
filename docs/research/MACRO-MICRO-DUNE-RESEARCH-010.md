# MACRO-MICRO-DUNE-RESEARCH-010

| Field | Value |
| --- | --- |
| task_id | `MACRO-MICRO-DUNE-RESEARCH-010` |
| tier / role | T1 / researcher |
| research date | 2026-07-21 (Asia/Shanghai) |
| repository HEAD observed | `d9bb74af2ba216956b6eb4a342cff8def51744ed` |
| deliverable | `docs/research/MACRO-MICRO-DUNE-RESEARCH-010.md` |
| execution status | **UNEXECUTED**: no Dune query, API, CLI, dashboard, credential, database, or Feishu operation was used |
| verdict | **GREEN_WITH_ADVISORY**: research contract complete; all proposed Dune queries remain **UNEXECUTED/UNVERIFIED**, and active-pool query remains **PARK** pending pool-key provenance |

## 0. Status vocabulary and execution boundary

- **VERIFIED** means only that a local contract, table/field shape, or immutable
  Spellbook source path is supported by the pinned inputs. It does **not** mean
  that a Dune result, live row, freshness, amount coverage, or metric value was
  executed or verified.
- **UNVERIFIED** means a proposed derivation/query/source contract still needs a
  separately authorized execution with query ID, SQL hash, execution ID,
  parameters, `source_as_of`, result checksum, row/sample counts, and cost.
- **PARK** means the source or stage prerequisite is missing or forbidden. It
  must not be replaced by a proxy with a stronger name.

All Dune designs in this report are specifications only. No Dune query/API/CLI,
paid query, cookie, credential, PostgreSQL read/write, CardKit send, or Feishu
operation was performed. No live correctness, completeness, freshness, or
production readiness is claimed.

## 1. Complete source pin

### 1.1 Authorized local inputs

| Input | SHA-256 |
| --- | --- |
| `harness/tasks/MACRO-MICRO-DUNE-RESEARCH-010.json` | `d6c7eb5b9b97c47d932dbf10a0b2d5780ddb12ece2768b6bc9da97a157a94bc3` |
| `docs/research/MACRO-DUNE-QUERY-PROVENANCE-001.md` | `283e55f683d65b820be820953d991558ba70f518e03762d40f71973da9b0fec9` |
| `docs/designs/DAILY-MARKET-MACRO-DESIGN-001.md` | `bf18aa43df46028ab75c19e8cc55abf1dc4a77e12a9846aa36d473f3129b4f43` |
| `src/infrastructure/dune/macro-core-query-definitions.ts` | `9e0b33468d109b1fbb29a2d0ebb43ab9791f2e9c554e384191cd54649242e37c` |
| `db/migrations/002_macro_daily_metrics.sql` | `ca72a1021072d4ae554e189d83d861c3483de5805155a365d02fc7ade8d6b7d7` |

### 1.2 External schema provenance inherited from the pinned research

| Item | Immutable pin |
| --- | --- |
| Spellbook commit | `b553234af744bef843a51e7f1cfd319d5cced24d` |
| Commit URL | https://github.com/duneanalytics/spellbook/commit/b553234af744bef843a51e7f1cfd319d5cced24d |
| Raw URL base | `https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/<path>` |
| Solana trades | `dbt_subprojects/solana/models/_sector/dex/dex_solana_trades.sql` and `dex_solana_base_trades.sql` |
| Global/BSC/Robinhood EVM trades | `dbt_subprojects/dex/models/trades/dex_trades.sql`; Robinhood additionally `trades/robinhood/dex_robinhood_base_trades.sql` and its pinned `_schema.yml` |
| Solana Pump / PumpSwap | `dbt_subprojects/solana/models/_sector/dex/pumpdotfun/solana/pumpdotfun_solana_base_trades.sql`; `.../pumpswap/pumpswap_solana_pools.sql` |
| BSC Pancake pools / LP events | `dbt_subprojects/dex/models/_projects/pancakeswap/bnb/pancakeswap_bnb_pools.sql`; `.../pancakeswap_bnb_base_liquidity_events.sql` |

The complete immutable URLs are formed by appending each listed path to the raw
URL base. The inherited registry pins are:

- Solana: `spellbook:dex_solana:base_trades_union@b553234af744bef843a51e7f1cfd319d5cced24d`.
- BSC: `spellbook:dex_trades:blockchain=bnb@b553234af744bef843a51e7f1cfd319d5cced24d`.
- Robinhood: `spellbook:dex_robinhood:uniswap_v2_v3_v4@b553234af744bef843a51e7f1cfd319d5cced24d`.

## 2. Scope boundaries: Global and four named chain subjects

| Subject | Exact permitted meaning | Required warning / exclusion | Status |
| --- | --- | --- | --- |
| Global EVM | `dex.trades` rows for its declared EVM registry, not a sum of the chain cards | Sector/registry partial; leg-sum volume; may overlap BSC and Robinhood chain views; excludes Solana | **VERIFIED structure**, values **UNVERIFIED** |
| Bitcoin | `metrics_bitcoin.transactions_daily.tx_count` and `metrics_bitcoin.gas_fees_daily.gas_fees_usd` only | Transaction metric is the pinned model's `amount_transfer_usd > 1` heuristic, not raw Bitcoin transaction count; fee model excludes current UTC day | **VERIFIED structure**, values **UNVERIFIED** |
| Solana | `dex_solana.trades`; Pump create; valid PumpSwap pools for the declared registry | `sanctum_router` exclusion is inherited; PumpSwap pool is not a migration/graduation | **VERIFIED structure**, values **UNVERIFIED** |
| BSC | `dex.trades WHERE blockchain='bnb'`; Pancake pool universe where named | BSC stage remains inactive; Four.meme launches/coverage are **PARK**; Pancake pool count is not all-BSC pool count | **VERIFIED structure**, values **UNVERIFIED** |
| Robinhood | `dex.trades` limited to `project='uniswap'` and versions 2/3/4 | Always `partial_coverage`, `uniswap_only`; never “full Robinhood” or all-DEX | **VERIFIED partial structure**, values **UNVERIFIED** |

The project constitution still activates only Solana/Pump.fun E2E. These macro
research definitions do not activate BSC or Robinhood adapters.

## 3. A: Safe derivations from existing daily tables

### 3.1 Eligible base series

The existing migration stores daily values and provenance in
`macro_daily_global_metrics` and `macro_daily_chain_metrics`. The only eligible
micro-dynamics bases are existing metric rows with non-null `source_as_of`, a
real executed `query_ref/query_version`, and no `unexecuted_blueprint` warning.

| Family | Existing base metrics | Safe derived description | Status |
| --- | --- | --- | --- |
| Global EVM | `dex_volume_usd`, `active_trader_count` | Day-over-day, 7D relative level, observed-address leg-USD intensity | **VERIFIED derivability** after executed rows exist |
| Bitcoin | `btc_transaction_count`, `btc_fee_usd` | Day-over-day and 7D relative level only | **VERIFIED derivability** after executed rows exist |
| Solana | `dex_volume_usd`, `active_trader_count`, `pump_launch_count`, `external_pool_count` | Same-series day-over-day/7D; intensity only from the first two | **VERIFIED derivability** after executed rows exist |
| BSC | `dex_volume_usd`, `active_trader_count`, `pancakeswap_pool_created_count` | Same-series day-over-day/7D; intensity only from the first two | **VERIFIED derivability** after executed rows exist; stage-blocked for production |
| Robinhood | `dex_volume_usd`, `active_trader_count`, optionally `uniswap_pool_created_count` when sourced | Same-series day-over-day/7D; intensity only from the first two | **VERIFIED derivability** only within identical partial registry |

`pancakeswap_lp_net_change_usd` is excluded: the inherited source pin verifies
raw LP event structure but not the USD conversion. It remains **UNVERIFIED**.

### 3.2 Canonical formulas and names

Let `x_D` be one daily metric on UTC report day `D`, and let comparability mean
the exact identity rules in section 3.4 are satisfied.

| Display metric | Formula | Semantic boundary | Status |
| --- | --- | --- | --- |
| Daily change | `(x_D / x_(D-1)) - 1` | Call “day-over-day change” for that native metric, never momentum or capital inflow. If prior value is zero, percent change is undefined; show absolute change only. | Formula **VERIFIED**; live output **UNVERIFIED** |
| 7D relative level | `x_D / median(x_(D-7)..x_(D-1))`, displayed as `100 * ratio` | `100` means equal to the prior-seven-day median. This is a trailing relative level, not percentile, forecast, support level, or cross-chain score. Current day is excluded from its own baseline. | Proposed contract **UNVERIFIED** until versioned |
| Observed-address leg-USD intensity | `dex_volume_usd_D / active_trader_count_D` | Name exactly “observed-address leg-USD intensity”. It is average leg-summed USD per distinct observed `taker`/`trader_id`, not swaps/address, transactions/address, real users, buyers, wallet PnL, or conviction. | Derivable **VERIFIED**; interpretation/live value **UNVERIFIED** |

The local TypeScript blueprint currently uses exact `COUNT(DISTINCT ...)`, while
the provenance research SQL blueprint shows `approx_distinct(...)`. These are
different query semantics and query versions. They must not be compared or
silently combined.

### 3.3 Sample and publication gates

These are conservative proposed gates, labelled **UNVERIFIED** until adopted in
a versioned metric contract:

| Metric | Hard semantic gate | Publication sample gate |
| --- | --- | --- |
| Daily change | Both `D` and exact UTC `D-1` exist; same unit/identity; both `completeness=1`; no execution/freshness warning | Missing prior day means **PARK**, not “0%”; prior zero permits absolute change only |
| 7D relative level | Current day complete; positive/non-negative metric as defined; no mixed versions | 7/7 comparable prior days: normal display; 5-6/7: display only with `partial_7d_baseline`; fewer than 5: **PARK**. Persist `baseline_day_count` and median. |
| Address intensity | Same-day volume and address count came from the same query execution/version and universe; count > 0; both complete | At least 100 observed addresses: normal display; 30-99: `small_address_sample`; fewer than 30: **PARK**. This threshold is a recommendation, not a verified fact. |

No ratio should impute a missing day as zero. `amount_usd IS NULL` legs are absent
from volume but may still affect an independently counted address unless the SQL
uses an identical filtered CTE; therefore intensity must be computed from one
shared filtered population or carry `usd_coverage_mismatch`.

### 3.4 Version-comparison rules

Two daily rows are comparable only if all semantic identity fields match:

```text
scope + subject/chain + metric_name + unit + source + query_ref + query_version
+ registry_version (chain) + coverage_status (chain) + UTC day rule
+ exact-vs-approx distinct policy + leg/transaction aggregation policy
+ material inclusion/exclusion warnings
```

Rules:

1. A query, Spellbook commit, DEX registry, project/version filter, pool universe,
   USD pricing method, or dedup policy change starts a new series. Do not bridge
   it with day-over-day or 7D math unless the new version is backfilled and a
   version-overlap reconciliation is recorded.
2. Robinhood is comparable only to the same Uniswap v2/v3/v4 partial registry.
   It is never comparable to a future full-chain series without an explicit
   restatement.
3. Global EVM is not added to Solana/BSC/Robinhood cards and is not a denominator
   for chain share: registry overlap would double count.
4. Count and USD units never share normalization. Each native metric is compared
   only to its own history; no unversioned composite score is allowed.
5. Warnings that change the observed universe (`uniswap_only`, `pump_only`,
   `volume_is_leg_sum`, USD coverage) are semantic, not cosmetic.

## 4. B: New Dune queries that could be verified

Every item below is **UNVERIFIED and UNEXECUTED**. A future authorized task must
first confirm the catalog schema at the pinned Spellbook commit, save SQL/query
identity and result evidence, and enforce UTC partition filters.

### 4.1 Required source mapping

| Universe | Table and filters | Pinned fields available for designs | Leg grain / transaction key | Coverage |
| --- | --- | --- | --- | --- |
| Global EVM | `dex.trades`; `block_date=D` | `blockchain, project, version, block_date, block_time, amount_usd, taker, tx_hash, evt_index` | leg: `(blockchain, project, version, tx_hash, evt_index[, block_month])`; tx: `(blockchain, tx_hash)` | Declared EVM sector only; not all-chain |
| Solana | `dex_solana.trades`; `block_date=D` | `block_date, block_time, amount_usd, trader_id, tx_id, outer_instruction_index, inner_instruction_index, tx_index, block_month` | leg: `(tx_id, outer_instruction_index, inner_instruction_index, tx_index, block_month)`; tx: `tx_id` | Declared Solana DEX union; inherited exclusions |
| BSC | `dex.trades`; `blockchain='bnb' AND block_date=D` | EVM fields above | EVM grain above | Declared BNB registry; not Four.meme/all BSC |
| Robinhood | `dex.trades`; `blockchain='robinhood' AND project='uniswap' AND version IN ('2','3','4') AND block_date=D` | EVM fields above | EVM grain above | Mandatory `partial_coverage`, `uniswap_only` |

### 4.2 Query contracts

| ID / metric | Table + required fields | Output grain | Dedup and null policy | Chain coverage | Cost / verification risk | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Q1 swap transaction/leg counts and `legs_per_tx` | Mapping above; EVM `tx_hash, evt_index`; Solana instruction indices and `tx_id`; date and registry fields | `(report_day, universe)` with `leg_count`, `swap_tx_count`, `legs_per_tx` | Dedup exact leg grain first; transaction count is distinct tx key; retain multi-project legs in one tx; never call leg count “swaps”. Null tx keys are excluded and counted in a warning. | Global EVM, Solana, BSC, Robinhood partial | One-day partition scan; Solana multi-index distinct and EVM cross-project routes need fixture checks; Global tx key must include blockchain. | **UNVERIFIED** |
| Q2 active pools | Candidate trade tables above, but a canonical pool/pair identifier is **not pinned by the current field whitelist**; required fields are `pool_address` (or verified equivalent), project/version, date, tx/leg key | `(report_day, universe)` distinct pools with >=1 deduped trade | Distinct canonical `(chain, project, version, pool_address)` after leg dedup; factory/pool-creation rows alone are not “active”; token pair text is not a safe pool key. | Potentially all four universes; Robinhood remains partial | **Schema blocker**: verify whether a trade table field is the actual pool, router, or project contract. High cardinality distinct; partition to one day. | **PARK** pending pool-key provenance |
| Q3 transaction-size quantiles | Mapping above; `amount_usd` plus transaction/leg keys | `(report_day, universe)` with `p50/p75/p90/p99_tx_leg_sum_usd`, sample tx count, USD-covered leg share | Dedup legs, sum non-null `amount_usd` by tx, then calculate quantiles across transactions. Do not percentile raw legs. Exclude zero/negative or null according to a pinned rule and report exclusions. | Global EVM, Solana, BSC, Robinhood partial | Distributed percentile is expensive and approximate unless exact function is pinned; routes inflate leg-summed USD; require minimum 100 USD-covered tx for publication. | **UNVERIFIED** |
| Q4 observed-address concentration | Mapping above; EVM `taker`; Solana `trader_id`; `amount_usd`, tx/leg keys | `(report_day, universe)` with address count, top-1/top-10 share, HHI and USD coverage | Dedup legs; aggregate leg-summed USD per non-null observed address; divide by same filtered day's total. Null address/amount rows are separately counted. Router attribution is preserved, not resolved by assumption. | Global EVM, Solana, BSC, Robinhood partial | High-cardinality group/sort; top-N tie policy and HHI precision must be pinned. Publish only at >=100 addresses; does not identify entities or buyers. | **UNVERIFIED** |

For Q1/Q3/Q4, `SUM(amount_usd)` remains a leg sum. An authorized verification
must measure `usd_covered_leg_count / all_deduped_leg_count` and test known
single-leg and routed transactions before any label is promoted. Q2 cannot be
written responsibly from the current whitelist and is deliberately **PARK**.

## 5. C: Metrics requiring an additional authoritative source

None of the following can be recovered from the existing daily aggregate rows.
They remain **PARK** until their source contracts are pinned and separately
authorized.

| Requested concept | Minimum additional source evidence | Permitted label before verification | Forbidden misstatement | Status |
| --- | --- | --- | --- | --- |
| Buys / sells | Trade-leg token bought/sold addresses, subject token, base/quote or reference-asset policy, route collapse rule, initiator attribution, decimals and venue registry | “token-in/token-out legs under rule vN” only | Do not call transfers buys/sells; do not call `taker` buyers; do not infer buy pressure from aggregate volume | **PARK** |
| Net liquidity | Decoded add/remove/mint/burn events, canonical pool identity, raw integer amounts/decimals, same-timestamp USD pricing, fee/position handling and registry | “raw LP event net amounts” if only raw events exist | Raw token0 minus token1 is not USD net flow; Pancake B3 raw events are not `pancakeswap_lp_net_change_usd`; volume is not liquidity | **PARK** |
| Smart money | Named third-party/entity label provider, label version, methodology/provenance, chain/address coverage, observation time, confidence and revocation history | “provider-labelled addresses observed as of T” | High volume, profitability, early entry or concentration does not prove smart money; unknown is not false | **PARK** |
| Kline / OHLCV | Ordered trade-level price observations for a pinned pair/venue, base/quote convention, interval, timezone, route/dedup policy, gap and outlier rules | “pair/venue OHLCV under rule vN” | Daily volume, FDV snapshots, or unordered trade quantiles are not Kline; do not merge different pools silently | **PARK** |

Related exclusions:

- Pump create count and PumpSwap valid-pool count do not verify migrations,
  graduation rate, or first external listing. Those names remain **PARK**.
- Market cap and FDV require distinct supply bases. Without verified circulating
  supply, an FDV must never be renamed market cap.
- Survival, drawdown, liquidity retention and valuation cohorts require pinned
  interval observations and censoring rules; none is verified here.
- Four.meme remains **PARK**. No Pancake or generic BSC count may substitute for it.
- Robinhood remains Uniswap v2/v3/v4 `partial_coverage`; missing DEXs are not zero.

## 6. Next brief: at most six information slots

The next version should expose no more than these six information types. A slot
may repeat by eligible subject, but must keep its warning beside the value; a
missing/PARK slot is shown as unavailable rather than filled with a proxy.

| Slot | Information shown | Gate |
| --- | --- | --- |
| 1 | DEX leg-sum USD: value, day-over-day, 7D relative level | Existing executed comparable daily rows; keep `volume_is_leg_sum` |
| 2 | Observed active addresses and observed-address leg-USD intensity | Same filtered query/version; section 3.3 sample gate |
| 3 | Swap transaction count, leg count and legs/tx | Q1 verified execution |
| 4 | Transaction leg-sum USD p50/p90 | Q3 verified execution and >=100 covered transactions |
| 5 | Observed-address top-10 share and HHI | Q4 verified execution and >=100 addresses |
| 6 | Active pools | Q2 only after canonical pool-key provenance; otherwise **PARK** |

Buy/sell, net liquidity, smart-money, Kline, graduation, Four.meme, full
Robinhood, market-cap/FDV, survival, and drawdown are intentionally absent from
the six slots until separately verified.

## 7. Acceptance commands and results

```text
npm run harness:task -- validate harness/tasks/MACRO-MICRO-DUNE-RESEARCH-010.json
npm run typecheck
npm test
git diff --check
```

| Command | Exit | Evidence |
| --- | --- | --- |
| `npm run harness:task -- validate harness/tasks/MACRO-MICRO-DUNE-RESEARCH-010.json` | 0 | `status: GREEN`, `errors: []` |
| `npm run typecheck` | 0 | `tsc -p tsconfig.json --noEmit` completed cleanly |
| `npm test` | 0 | 55 tests passed; 0 failed, skipped, or cancelled |
| `git diff --check` | 0 | No whitespace errors; Git emitted only pre-existing LF/CRLF warnings for unrelated worktree paths |

## 8. Verdict

**GREEN_WITH_ADVISORY**

The T1 research objective and acceptance commands are complete. The advisory is
mandatory: all proposed Q1/Q3/Q4 designs remain **UNEXECUTED/UNVERIFIED**; Q2
active pools remains **PARK** until a canonical pool key is source-pinned;
buy/sell, net liquidity, smart money, Kline, Four.meme, and full Robinhood remain
**PARK**. No Dune result or external metric was promoted by this report.
