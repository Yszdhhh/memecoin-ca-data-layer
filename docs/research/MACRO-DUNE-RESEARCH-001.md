# MACRO-DUNE-RESEARCH-001 — Dune schema and query provenance for daily macro briefs

## Header

| Field | Value |
| --- | --- |
| `task_id` | `MACRO-DUNE-RESEARCH-001` |
| `tier` | `T1` |
| `role` | `researcher` |
| `agent` / `model` | Grok 4.5 (xAI) |
| `report_utc` | `2026-07-20T15:24:25Z` |
| `write_set` | `docs/research/MACRO-DUNE-RESEARCH-001.md` only |
| `verdict` | **GREEN_WITH_ADVISORY** — Spellbook table/field provenance is verified for core DEX capital metrics; most referenced dashboards and community Query IDs lack open SQL/result timestamps under no-credential/no-paid-query constraints and remain **UNVERIFIED** or **PARK** |

## Task spec preflight

| Check | Result |
| --- | --- |
| Spec path | `harness/tasks/MACRO-DUNE-RESEARCH-001.json` present, `status=READY`, `role=researcher`, `tier=T1` |
| Stage lock | `harness/config/project.json`: `active_chains=["solana"]`, `blocked_chains=["bsc","robinhood"]` — research-only; no CA adapter, collector, or schedule activation |
| Inputs read | Constitution, playbook, limitations, owner decisions, design `DAILY-MARKET-MACRO-DESIGN-001.md`, local SQL: `solana_dex_volume.sql`, `robinhood_dex_volume.sql`, `memecoin_revenue.sql` |
| Forbidden actions | No API key use/print/store; no paid Dune execute; no dashboard/repo/SQL/task/DB mutation; no BSC/Robinhood CA authorization |
| Deliverable | This file only |

### Local SQL provenance (repository, not Dune execution)

| File | SHA-256 |
| --- | --- |
| `solana_dex_volume.sql` | `2B308C63007A34E5E36671C6106643250D83995502E331A1EDA3E42368FF105A` |
| `robinhood_dex_volume.sql` | `7BE1385FD0F44864BA47C41941C410369C56E0E1DD7E759ECEF02EEB6B7B0A28` |
| `memecoin_revenue.sql` | `9EBC87295C345A6926B5CAC4797BDC3146C1F28325F7B467EECE78A72ABB7796` |

### Access boundary for this research run

| Channel | Outcome |
| --- | --- |
| `https://dune.com/...` dashboards / `queries/<id>` | Mostly **HTTP 403** from this environment (no cookie/session). `rsuthar94/godstats` returned SPA shell only (title “Pump Fun Cheat Code”); **no Query ID or SQL in HTML** |
| Dune CLI / API | **Not used**. Environment may contain `DUNE_API_KEY`; value was never read, printed, or written. Paid/free query execution intentionally skipped |
| Public Spellbook (GitHub `duneanalytics/spellbook` `main`) | **Used** as primary schema/SQL evidence |
| Web extract (AnySearch, anonymous) | Partial dashboard chart labels only; **not accepted as field/SQL evidence** |

**Rule applied:** no query-level SQL body + result timestamp → label **UNVERIFIED**. Dashboard screenshots/chart titles alone → **UNVERIFIED**. Spellbook SQL/schema on public GitHub → **VERIFIED** for table/field structure (not for live row freshness).

---

## 1. Complete source list

### 1.1 Required dashboards (query-level status)

| Dashboard URL | Public fetch | Query IDs / SQL | Status |
| --- | --- | --- | --- |
| https://dune.com/adam_tehc/the-robinhood-trenches | 403 | none obtained | **UNVERIFIED** |
| https://dune.com/rsuthar94/godstats | 200 SPA, no `__NEXT_DATA__` query IDs | none obtained | **UNVERIFIED** (title/chart labels only) |
| https://dune.com/adam_tehc/memecoin-wars | 403 | none | **UNVERIFIED** |
| https://dune.com/dune/dex-metrics | 403 | none | **UNVERIFIED** |
| https://dune.com/adam_tehc/pumpfun | 403 | none | **UNVERIFIED** |
| https://dune.com/adam_tehc/gmgn | 403 | none | **UNVERIFIED** |
| https://dune.com/adam_tehc/trading-bots-on-solana | 403 | none | **UNVERIFIED** |
| https://dune.com/queries/7986129 | 403 | body unknown | **UNVERIFIED** (ID referenced only by repo SQL) |
| https://dune.com/queries/7342972, 7342977, 7342980, 7342988 | 403 | body unknown | **UNVERIFIED** (IDs in `memecoin_revenue.sql` only) |

### 1.2 Spellbook / public schema sources (VERIFIED structure)

| Artifact | Path / URL (GitHub raw or repo) | Use |
| --- | --- | --- |
| `dex.trades` model + columns | `dbt_subprojects/dex/models/trades/dex_trades.sql`, `_schema.yml` | Global/BSC/Robinhood EVM DEX trades |
| EVM chain registry for `dex.trades` | `dbt_subprojects/dex/macros/dex_evm_chains.sql` | Includes `bnb`, `robinhood`, `ethereum`, … |
| Robinhood DEX trades | `dbt_subprojects/dex/models/trades/robinhood/*` | Uniswap v2/v3/v4 only |
| Robinhood decoded sources | `sources/_sector/dex/trades/robinhood/_sources.yml` | Swap + pool create events |
| Robinhood base docs | `sources/_base_sources/evm/robinhood_docs_block.md` | `robinhood.blocks/transactions/logs/traces` |
| `dex_solana.trades` | `dbt_subprojects/solana/models/_sector/dex/dex_solana_trades.sql`, `dex_solana_base_trades.sql` | Solana DEX union |
| Pump.fun trades / create | `.../pumpdotfun/solana/*` | Create + SwapEvent decode |
| PumpSwap trades / pools | `.../pumpswap/*` | AMM trades + pool creation |
| Raydium | `.../raydium/*` | Solana external venue |
| PancakeSwap BNB pools/LP | `.../pancakeswap/bnb/*` | Pool create + liquidity events |
| BNB DEX platforms list | `dbt_subprojects/dex/models/trades/bnb/platforms/*` | Registry completeness |
| Solana bot trades | `.../bot_trades/solana/dex_solana_bot_trades.sql` | Bot filter universe (hidden spell) |
| Bridge flows | `daily_spellbook/models/bridge/bridge_flows.sql` | **prod_exclude**, narrow |
| Metrics tx daily | `metrics_*_transactions_daily`, `metrics_transactions_evm` macro | Attention proxy |
| Bitcoin metrics | `metrics_bitcoin_*` | BTC activity proxy |
| Stablecoin labels | `labels_stablecoins.sql` | Address labels only, not supply |
| Stablecoin Solana list | `tokens_solana_stablecoins.sql` | Mint registry path |

### 1.3 Repository SQL (local, reproducible text)

| File | Role |
| --- | --- |
| `solana_dex_volume.sql` | Hourly Solana volume sample for pumpdotfun + raydium |
| `robinhood_dex_volume.sql` | Robinhood volume union + bot heuristic |
| `memecoin_revenue.sql` | Opaque query composition of community queries |

### 1.4 Design / governance

- `docs/designs/DAILY-MARKET-MACRO-DESIGN-001.md`
- `PROJECT_CONSTITUTION.md`, `PROJECT_OPERATING_PLAYBOOK.md`, `KNOWN_LIMITATIONS.md`, `OWNER_DECISIONS_NEEDED.md`, `AGENTS.md`

---

## 2. Global macro (design layer 1)

### 2.1 Metric mapping

| Metric family | Candidate dataset | Key fields | Fact class | Chain / time | Refresh / lag | Completeness boundary | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BTC on-chain activity | `metrics_bitcoin.transactions_daily` | `blockchain`, `block_date`, `tx_count` | **Dune derived** (`approx_distinct` over transfers with USD>1) | Bitcoin / **daily** | Spellbook incremental; live lag **UNVERIFIED** without execution | Not “active entities”; transfer-filter heuristic | **VERIFIED** schema; values need execution watermark |
| BTC fee attention | `metrics_bitcoin.gas_fees_daily` | `block_date`, `gas_fees_usd` | Derived: `bitcoin.blocks.total_fees` × `prices.usd_daily` BTC | Daily; **excludes current day** in SQL | Same | Price join can drop days | **VERIFIED** schema |
| ETH / major L1 activity | `metrics_ethereum.transactions_daily` (and peers via `metrics_transactions_evm`) | `blockchain`, `block_date`, `tx_count` | Derived from `tokens.transfers` where `amount_usd >= 1`, `approx_distinct(tx_hash)` | Per-chain daily | Lag **UNVERIFIED** live | Not equal to unique addresses; USD≥1 filter | **VERIFIED** schema for ethereum/bnb pattern |
| BTC/ETH **price / market cap / FDV** | Not established as on-chain fact in Spellbook for brief | — | Off-chain / price oracle | — | — | Design forbids silent off-chain substitute | **PARK** for on-chain market-cap; price tables exist but not query-pinned |
| Stablecoin **supply** | No Spellbook model named global stablecoin supply found in tree search | — | — | — | — | `labels.stablecoins` is **address labels only** | **PARK** |
| Stablecoin **issuer coverage** | `labels_stablecoins` | `blockchain`, `address`, `name` | Static label list (hide_spells) | Multi-EVM; Solana rows commented in snippet | Static | Missing issuer ≠ zero supply | **VERIFIED** as label registry only |
| Bridge net flow | `bridge.flows` | `block_date`, `blockchain`, `transfer_type`, `token_amount_usd`, source/dest chain | Derived; model tagged **`prod_exclude`**, non-dunesql migration note, only Hop + Optimism native in model list | ethereum/optimism-centric | **Do not treat as production global flow** | Solana/BSC/Robinhood not covered by this spell | **PARK** for global macro |
| Aggregate DEX volume | `dex.trades` + `dex_solana.trades` | `amount_usd`, `block_time`, `block_date`, `blockchain`/`project` | Derived from decoded swaps + USD enrichment; `amount_usd` **nullable** | EVM list via `dex_evm_chains()` incl. `bnb`,`robinhood`; Solana separate | Incremental merge | Do not UNION aggregator+venue without dedupe policy | **VERIFIED** schema |
| Active traders | same trades tables | `taker` / `tx_from` (EVM); `trader_id` (Solana base) | Derived distinct count | Hour or day from `block_time` | Same | Router/contract as taker; bot inflation | **VERIFIED** fields exist; definition is policy |
| Active pools / pool liquidity | `dex.pools` (hide_spells, limited projects); `dex.pools_metrics_daily` (balancer/beethoven/jelly only); Pancake BNB pool/LP models | pool, TVL fields vary | Mixed | **Not universal across all DEX** | — | Global “total pool liquidity” **not** one table | **UNVERIFIED** as global TVL; **VERIFIED** partial project paths |
| Risk breadth | share of volume outside BTC/ETH/stable pairs | requires token classification + trades | Derived | Depends on label quality | — | Needs stablecoin+major asset mint registry version | **PARK** until registry pinned |

### 2.2 On-chain fact vs Dune aggregation

| Claim | Classification |
| --- | --- |
| Swap/pool-create event tables and decoded rows feeding Spellbook | Closest to **chain facts** (still decoder-dependent) |
| `dex.trades` / `dex_solana.trades` rows | **Dune derived** (decode + price join + sector union) |
| `metrics_*.transactions_daily` | **Dune derived** aggregation with heuristics |
| `amount_usd` | **Derived**; null when price missing |
| Community dashboards (godstats, adam_tehc, …) | **Third-party derived**; SQL not verified this run |

### 2.3 Global conclusion

Daily **global attention** can be **partially** supported from Spellbook-level DEX volume and chain activity metrics **after** implementation queries pin `query_ref` + execution timestamp. **Stablecoin supply, global bridge net flow, and full pool TVL** are **not** ready as VERIFIED daily inputs. Do not invent a synthetic global index from incomparable sources (design constraint).

---

## 3. Solana battle report

### 3.1 Capital

| Metric | Path | Fields / filters | Dedup | Verdict |
| --- | --- | --- | --- | --- |
| DEX volume | `dex_solana.trades` | `amount_usd`, `block_time`, `project`, `version` | Unique key: `tx_id`, `outer_instruction_index`, `inner_instruction_index`, `tx_index`, `block_month` | **VERIFIED** schema |
| Active traders | `trader_id` on base trades (enriched in sector models) | Distinct over window | Multi-leg same trader OK; bots inflate | **VERIFIED** field path |
| Project universe (base_trades union) | `dex_solana_base_trades.sql` | Includes `pumpdotfun`, `pumpswap`, `raydium` v4/v5/clmm, `raydium_launchlab`, orca, meteora, …; **sanctum_router intentionally excluded** | Sector partial by design | **VERIFIED** registry list in SQL |
| Bot-labelled volume | `dex_solana.bot_trades` (view, **hide_spells**) | `bot`, `user`, `amount_usd`, `tx_id`, … | Known bot platforms only | **VERIFIED** structure; coverage incomplete by construction |

**Local sample SQL** (`solana_dex_volume.sql`) — repo evidence only:

```sql
-- Source: repository solana_dex_volume.sql
FROM dex_solana.trades
WHERE project IN ('raydium', 'pumpdotfun')
  AND block_time >= (NOW() - INTERVAL '7' DAY)
-- hour: MOD(EXTRACT(HOUR FROM block_time) + 17, 24) AS hour_mst  -- display offset, not UTC store
```

| Item | Value |
| --- | --- |
| Dashboard URL | none in file |
| Query ID | none (ad-hoc SQL file) |
| Time window | rolling 7 days |
| Filter | `project IN ('raydium','pumpdotfun')` — **excludes pumpswap and other DEXes** |
| Dedup / bot | none |
| Execution timestamp | **not run** this research |
| Verdict | **VERIFIED** as local SQL text; **UNVERIFIED** as production metric coverage |

### 3.2 Supply: launch, migrate/graduate, first external pool

| Event | Reproducible path | Evidence | Verdict |
| --- | --- | --- | --- |
| Pump **launch** | Decode Create on program `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` via `solana.instruction_calls`; discriminator `0x181ec828051c0777` in `pumpdotfun_solana_base_trades.sql` bonding_curves CTE | Spellbook SQL | **VERIFIED** data path for create-time cohort |
| Pump **trades** (bonding curve) | SwapEvent `0xe445a52e51cb9a1dbddb7fd34ee661ee` same program; project start `2024-01-14` | Spellbook | **VERIFIED** |
| PumpSwap **pool create** (post-migrate venue proxy) | `pumpswap_solana.pools`: program `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`, event prefix, fields `pool`, `created_at`, `baseMint`, `quoteMint`, `is_valid_pool`; start `2025-03-14` | Spellbook | **VERIFIED** pool creation path |
| Official **migrate** instruction as first-class Spellbook table | Not found as dedicated `migrate` fact table in searched paths; project docs elsewhere pin migrate semantics | — | **UNVERIFIED** on Dune for migrate event table; **do not** equate first PumpSwap trade with migrate without program evidence |
| First external listing | First `dex_solana.trades` row for mint where `project` ∉ bonding-curve venue, or first Raydium/PumpSwap pool | Definable in SQL from verified tables | **VERIFIED** as constructible; exact project inclusion list must be versioned |
| 24H launches / external listings / rate | Aggregations over create + first external trade | — | **VERIFIED** constructible; needs pinned SQL + execution |
| 1H/6H/24H survival | Requires first trade/pool time + activity or liquidity at horizon | Interval history available via `block_time` | **VERIFIED** constructible if survival definition fixed |
| Historical active hours | `EXTRACT(HOUR FROM block_time)` on trades/creates — store **UTC** | Local SQL used MST display offset — **must not** store MST as canonical | **VERIFIED** UTC hour capability |

### 3.3 Survival valuation: drawdown, 24H avg/peak/residual

| Metric | Feasible from Dune history? | Basis | Market cap vs FDV | Verdict |
| --- | --- | --- | --- | --- |
| Price path from trades | Partial: trade amounts + reserves fields on pumpdotfun (`sol_reserves`, `token_reserves`) enable curve-implied price; `amount_usd` when priced | Derived | — | **UNVERIFIED** end-to-end cohort SQL |
| Time to −50% / −90% | Requires ordered valuation series from listing baseline | Derived cohort | — | **PARK** until valuation series SQL pinned and executed |
| 24H avg / peak / residual valuation | Same | Derived | — | **PARK** until pinned |
| **Market cap vs FDV** | Spellbook trade/pool models do **not** expose verified **circulating supply** | — | **Cannot distinguish** from trades alone | **`market_cap` = UNVERIFIED**; if total supply × price used, label **`valuation_basis=fdv`** (design rule). Never rename FDV to market cap |

### 3.4 Solana section summary

Capital (volume/traders) and launch/pool-create **paths** are **VERIFIED** at Spellbook level. Graduation/migrate as a named Dune fact, survival valuation cohorts, and Market Cap are **not** query-verified. Community Pump dashboards remain **UNVERIFIED**.

---

## 4. BSC battle report

### 4.1 Capital and pools

| Metric | Path | Fields | Verdict |
| --- | --- | --- | --- |
| DEX volume / traders | `dex.trades` where `blockchain = 'bnb'` | Standard dex.trades columns; `block_time` UTC | **VERIFIED** schema |
| Project registry (partial list from platforms dir) | airswap, apeswap, babyswap, biswap v2/v3, dodo, ellipsis, eulerswap, fraxswap, hashflow, hyperjump, izumi, kyberswap, lista, maverick, mdex, native, nomiswap, onepunch, **pancakeswap** (infinity/v2/v3), sushiswap, swaap, tessera, thena, trader_joe, uniswap v2/v3/v4, wombat, woofi, xchange, zeroex, … | File names under `trades/bnb/platforms` | **VERIFIED** as Spellbook inclusion set snapshot of `main` at research time; not a frozen registry version for production |
| Pancake pool create | `pancakeswap_bnb.pools` / `pancakeswap_v2_bnb.pools` etc. | `blockchain`, `project`, `version`, `id`/`pair`, `token0`, `token1`, `creation_block_time`, `creation_block_number`, `contract_address`, `tx_hash` | **VERIFIED** |
| PairCreated source | `pancakeswap_v2_bnb.PancakeFactory_evt_PairCreated` | Factory event | **VERIFIED** source name |
| LP add/remove | `pancakeswap_*_bnb.base_liquidity_events` | unique_key `tx_hash`, `evt_index`, `event_type`; uses `erc20_bnb.evt_Transfer` + pools ref | **VERIFIED** path for Pancake family |
| First trade after pool | `dex.trades` min(`block_time`) per `project_contract_address` / pair | Derived | **VERIFIED** constructible |

### 4.2 Four.meme / launchpads

| Item | Finding | Verdict |
| --- | --- | --- |
| Spellbook model named four.meme / fourmeme / four_meme | **No path** in recursive tree search of `spellbook` `main` | **PARK** for official spell |
| Launchpad sector | No `launchpad` sector matches | **PARK** |
| Practical fallback | Decode Four.meme factory/proxy logs from `bnb.logs` / project-specific decoded tables **if** tables exist on Dune (not confirmed without catalog query) | **UNVERIFIED** |

### 4.3 Contract risk / tax / honeypot

| Item | In Dune Spellbook scope? | Action |
| --- | --- | --- |
| Honeypot / tax / sell restriction simulation | **No** — not chain-fact tables in researched spells | **Exclude** from Dune macro collector; use separate security provider with provider, observation time, coverage, confidence (design) |
| “Unknown” security | Correct default when no provider result | Do not encode as safe |

### 4.4 BSC summary

DEX capital + Pancake pool/LP are **VERIFIED** schema paths. Four.meme supply metrics are **PARK**. Security labels are **out of scope** for Dune. Stage remains **blocked** for BSC CA adapters (`project.json`).

---

## 5. Robinhood battle report

### 5.1 Verified registry universe (Spellbook)

| Layer | Content | Verdict |
| --- | --- | --- |
| Chain id in `dex.trades` | `robinhood` ∈ `dex_evm_chains()` | **VERIFIED** |
| DEX projects in sector model | **Uniswap only**: v2, v3, v4 (`dex_robinhood_base_trades.sql`) | **VERIFIED** |
| Decoded sources | v2: `UniswapV2Pair_evt_Swap`, `UniswapV2Factory_evt_PairCreated`; v3: `UniswapV3Pool_evt_Swap`, `UniswapV3Factory_evt_PoolCreated`; v4: `PoolManager_evt_Swap`, `PoolManager_evt_Initialize`, `PoolManager_call_Swap` | **VERIFIED** |
| Trade uniqueness | `(blockchain, project, version, tx_hash, evt_index)` | **VERIFIED** |
| Base chain tables | `robinhood.blocks`, `transactions`, `logs`, `traces`, `creation_traces` (docs) | **VERIFIED** docs |
| Prices / transfers | `prices_robinhood_tokens`, `tokens_robinhood_*` | paths exist; field audit partial |
| Full-chain all-DEX claim | **False** under current Spellbook | **`partial_coverage` required** |

**Coverage status for reports:** always emit  
`coverage_status=partial_coverage`,  
`registry_version=spellbook:dex_robinhood:uniswap_v2_v3_v4@<git_sha_pin>`,  
and missing-source warnings for any non-Uniswap venue.

### 5.2 Audit of `robinhood_dex_volume.sql` (query_7986129 + union + bot filter)

**Local SQL structure (verified from repository file):**

```text
baseline_trades  <- query_7986129  (dex='baseline')
uniswap_trades   <- dex.trades WHERE blockchain='robinhood'
all_trades       <- UNION ALL
flagged bots     <- legs_per_tx > 5 OR (avg_hours_per_day > 18 AND days_active >= 3)
exclude address  0x1925f52cea3bb3e1b4958dad50346b3c34a98b44
GROUP BY day, dex  LIMIT 10
```

| Risk | Detail | Severity |
| --- | --- | --- |
| **Double count** | `UNION ALL` of `query_7986129` and `dex.trades` without anti-join on `(tx_hash, evt_index)` | **High** if baseline overlaps Uniswap legs |
| **Unknown baseline universe** | `query_7986129` body **HTTP 403** / not retrieved; cannot verify DEX list or filters | **High** — baseline is **UNVERIFIED** |
| **Asymmetric date filters** | baseline: `block_date >= DATE '2026-06-30'`; uniswap: also `block_date < CURRENT_DATE` | **Medium** — incomplete day / timezone edge |
| **LIMIT 10** | Truncates daily DEX rows; not full-chain volume | **High** for macro use |
| **Bot filter heuristic** | legs/tx and hours/day are not ground-truth bots; false positives/negatives | **Medium** — document as heuristic |
| **Wallet identity** | Uses `tx_from` for bot stats and filter; taker may differ | **Medium** |
| **Hardcoded address exclude** | Single address; provenance of list **UNVERIFIED** | **Medium** |
| **No multi-leg volume netting** | Sums `amount_usd` per leg | **Medium** — standard for dex.trades but inflates vs “user notional” |
| **Execution watermark** | Not executed this run | Required before trust class B |

**Verdict on file as production macro input:** **UNVERIFIED / not safe to promote** without (1) open SQL of `7986129`, (2) explicit anti-join or single source, (3) remove LIMIT for aggregates, (4) versioned bot policy.

### 5.3 Robinhood summary

| Capability | Status |
| --- | --- |
| Uniswap-scoped volume / pools / traders | **VERIFIED** via `dex.trades` + factory events |
| All-chain Robinhood claim | **Forbidden** without expanded registry → `partial_coverage` |
| Community trenches dashboard | **UNVERIFIED** |
| CA adapter / production schedule | **Not authorized** |

---

## 6. Historical active time (per chain)

Canonical store: **UTC hour** of `block_time` / `block_date`. Asia/Shanghai is display-only (design).

| Chain | DEX volume by hour | Active traders by hour | New pools | Launches | External listings | LP add |
| --- | --- | --- | --- | --- | --- | --- |
| **Solana** | **VERIFIED** constructible: `EXTRACT(HOUR FROM block_time)` on `dex_solana.trades` | same + `trader_id` | PumpSwap `created_at`; Raydium pool models partial | Pump Create instruction path | first non-launchpad trade | Solana LP table **not** fully verified this run → **UNVERIFIED** |
| **BSC** | **VERIFIED** on `dex.trades` `bnb` | `taker`/`tx_from` | Pancake `creation_block_time` | Four.meme **PARK** | first trade after pool | Pancake `base_liquidity_events` **VERIFIED** path |
| **Robinhood** | **VERIFIED** on Uniswap-scoped `dex.trades` | same | Uniswap factory PairCreated/PoolCreated/Initialize | N/A launchpad | first trade | Uniswap LP events **not** audited this run → **UNVERIFIED** |

### Recommendations

| Parameter | Recommendation | Rationale |
| --- | --- | --- |
| Lookback | **90D** preferred; **60D** minimum for first production brief | Design allows 60/90; 7D local chart is **insufficient** for recurring active-hour claims |
| Timezone | Store UTC; render Shanghai as view | Matches design |
| Sample day count | Require ≥ 45 complete UTC days for 60D profile, ≥ 70 for 90D | Incomplete days reduce `completeness` |
| Incomplete current day | Exclude `CURRENT_DATE` for closed daily profiles (mirror bitcoin fees SQL practice) | Avoid partial-day bias |
| Volume vs launch hours | Compute **separately** per metric family | Do not average shares across incomparable metrics |

---

## 7. Query-level evidence cards

### Card A — `dex.trades` (EVM sector)

| Field | Content |
| --- | --- |
| Dashboard URL | Official dex-metrics dashboard **UNVERIFIED** this run |
| Query ID | none (table spell) |
| SQL / fragment | Union of `dex_<chain>_trades` for chains in `dex_evm_chains()` |
| Tables / fields | `blockchain`, `project`, `version`, `block_month`, `block_date`, `block_time`, `amount_usd`, `taker`, `maker`, `tx_hash`, `tx_from`, `tx_to`, `evt_index`, token addresses/symbols, `project_contract_address` |
| Filters | e.g. `blockchain IN ('bnb','robinhood','ethereum',…)` |
| Time | `block_date` / `block_time` **UTC** |
| Dedup | unique_key includes `tx_hash`,`evt_index` — **per leg**, not per user intent |
| Bot filter | none by default |
| Execution timestamp | **not executed** |
| Coverage | Only decoded projects per chain; `amount_usd` nullable |
| Conclusion | **VERIFIED** schema for capital metrics |

### Card B — `dex_solana.trades`

| Field | Content |
| --- | --- |
| Query ID | none (table spell) |
| SQL / fragment | Enrichment over `dex_solana_base_trades` + prices |
| Fields | `project`, `version`, `block_time`, `amount_usd`, `trade_source`, mints, vaults, fee fields, instruction indices |
| Filters | `project` list from base_trades union |
| Time | UTC |
| Dedup | instruction-level unique key |
| Bot | optional join to `dex_solana.bot_trades` (hidden, incomplete list) |
| Execution | not run |
| Conclusion | **VERIFIED** schema |

### Card C — Pump.fun create + swaps

| Field | Content |
| --- | --- |
| Program | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` |
| Create disc. | `0x181ec828051c0777` |
| Swap event | `0xe445a52e51cb9a1dbddb7fd34ee661ee` |
| Source table | `solana.instruction_calls` |
| Start | `2024-01-14` |
| Conclusion | **VERIFIED** path for launches + bonding-curve trades |

### Card D — PumpSwap pools

| Field | Content |
| --- | --- |
| Table | `pumpswap_solana.pools` |
| Fields | `pool`, `created_at`, `baseMint`, `quoteMint`, `is_valid_pool`, … |
| Program | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` |
| Start | `2025-03-14` |
| Conclusion | **VERIFIED** external pool creation path (not full migrate semantics) |

### Card E — Pancake BNB pools / LP

| Field | Content |
| --- | --- |
| Pools | `pancakeswap_bnb.pools` (+ version models) |
| LP events | `pancakeswap_*_bnb.base_liquidity_events` |
| Factory | `PancakeFactory_evt_PairCreated` (v2) |
| Conclusion | **VERIFIED** for BSC capital/supply-of-pools |

### Card F — repository `query_7986129` / memecoin revenue queries

| Field | Content |
| --- | --- |
| Query IDs | `7986129`, `7342972`, `7342977`, `7342980`, `7342988` |
| SQL body | **Not retrieved** (403 / not executed) |
| Conclusion | **UNVERIFIED** |

### Card G — community dashboards (adam_tehc / godstats / dune dex-metrics)

| Field | Content |
| --- | --- |
| Query IDs / SQL / result timestamps | **None obtained** under constraints |
| Conclusion | **UNVERIFIED** — do not implement collectors from chart titles |

---

## 8. Coverage limits (hard boundaries)

1. **No full Robinhood chain volume** without expanding beyond Uniswap v2/v3/v4.
2. **No Four.meme Spellbook** → BSC launch supply incomplete.
3. **No verified global stablecoin supply** or production-ready **bridge net flow**.
4. **No market_cap** without circulating supply provenance; default **FDV or trade-implied valuation** with explicit `valuation_basis`.
5. **No honeypot/tax** from Dune.
6. **Community Query IDs** in repo are references only until SQL hash + execution watermark stored.
7. **Spellbook `main` drifts**; production must pin git SHA of every spell used.
8. **BSC/Robinhood CA adapters and production schedules remain unauthorized**.
9. **Paid Dune execution and credential use were not performed**; live freshness/lag numbers are **UNVERIFIED**.

---

## 9. Open items (for follow-on Owner/implementer tasks)

| ID | Item | Gate |
| --- | --- | --- |
| O1 | Obtain public or Owner-authorized export of Query SQL for `7986129` and memecoin revenue queries; store query version hash | Owner / T1 research refresh |
| O2 | Pin Spellbook git SHA and freeze Robinhood registry `uniswap_v2|v3|v4` | Implementation task |
| O3 | Design anti-join / single-source Robinhood volume SQL; remove LIMIT | Implementation (write_set later) |
| O4 | Four.meme decoded table discovery or custom decode research | New T1 research |
| O5 | Stablecoin supply source selection (may be non-Dune) | Owner + research |
| O6 | Bridge source replacement for Solana/BSC/Robinhood | Research |
| O7 | Valuation cohort SQL: listing baseline, 50%/90% drawdown, right-censoring | Implementation after O2 |
| O8 | Optional: free/paid Dune execution budget to attach `source_as_of` watermarks | Owner T3 if paid |

---

## 10. Metric → readiness matrix (design contract)

| Design metric | Solana | BSC | Robinhood | Global |
| --- | --- | --- | --- | --- |
| DEX volume | VERIFIED path | VERIFIED path | VERIFIED partial (Uniswap) | VERIFIED path (multi-chain union policy TBD) |
| Active traders | VERIFIED path | VERIFIED path | VERIFIED partial | VERIFIED path |
| Active pools / liquidity | partial / UNVERIFIED TVL | Pancake VERIFIED path | partial UNVERIFIED LP | PARK global TVL |
| Launches | VERIFIED create path | PARK Four.meme | N/A | N/A |
| Migrations / external listing | constructible; migrate table UNVERIFIED | constructible via pool+trade | first Uniswap pool/trade | N/A |
| 1H/6H/24H survival | constructible UNVERIFIED SQL | constructible | constructible partial | N/A |
| Drawdown / residual valuation | PARK | PARK | PARK | N/A |
| market_cap vs FDV | FDV only unless supply verified | same | same | same |
| Hourly 60D/90D profile | VERIFIED UTC hour | VERIFIED | VERIFIED partial | per-chain only |
| Security context | out of Dune | out of Dune | out of Dune | N/A |

---

## 11. SELF_CHECK

| # | Check | Result |
| --- | --- | --- |
| 1 | Only write_set path written | Yes: `docs/research/MACRO-DUNE-RESEARCH-001.md` |
| 2 | No secrets, cookies, API keys, browser state in this file | Yes; key presence noted without value |
| 3 | No paid query execution; no Dune CLI mutate | Yes |
| 4 | No repo SQL/task/dashboard/DB modification | Yes |
| 5 | No claim of full Robinhood coverage | Yes; `partial_coverage` required |
| 6 | No BSC/Robinhood CA or production schedule authorization | Yes |
| 7 | Dashboard chart inference avoided for fields | Yes; UNVERIFIED without SQL |
| 8 | Query-level cards include filters, time, dedup, coverage | Yes where evidence exists |
| 9 | Market cap / FDV separation honored | Yes |
| 10 | Facts vs derived vs third-party separated | Yes |
| 11 | Stage lock respected | Yes |
| 12 | Acceptance commands (`npm run typecheck`, `npm test`) | **Not run** — no code change; coordinator may run for harness bookkeeping |

---

## 12. No-network-credential write confirmation

This research:

- Did **not** call Dune API/CLI with credentials.
- Did **not** print, copy, or store any API key, cookie, or browser session into the repository.
- Used only: local governance/SQL files, public GitHub Spellbook raw content, unauthenticated HTTP to Dune (mostly 403), and anonymous web search extract.
- Observed that `DUNE_API_KEY` may exist in the shell environment; its value was **never** accessed for this task and is **not** present in this document.

---

## 13. Overall recommendation for MACRO implementers

1. Implement daily capital metrics first from **pinned Spellbook tables** (`dex.trades`, `dex_solana.trades`), not from adam_tehc/godstats until Query SQL is hashed.
2. Solana supply: start with **Pump Create + first external project trade/pool**; label migrate separately until migrate event is verified.
3. BSC: ship Pancake-scoped capital/pools; keep Four.meme **PARK**.
4. Robinhood: ship **Uniswap-only** registry with `partial_coverage`; rewrite `robinhood_dex_volume.sql` before any automated brief.
5. Survival valuation and market_cap remain **blocked** until supply/price series provenance exists.
6. Attach every production metric row with `query_ref`, spell git SHA, execution id/timestamp, and `completeness`.

**Research verdict: `GREEN_WITH_ADVISORY`.** Schema paths for multi-chain daily capital and Solana/BSC pool activity are strong enough to design implementation tasks; community dashboards and several design survival/stablecoin/bridge fields remain **UNVERIFIED/PARK**.
