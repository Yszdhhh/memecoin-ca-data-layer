# Daily Market Macro Contract

## Scope

This contract produces one daily, evidence-labelled market brief. It has two
separate layers:

1. A global crypto attention layer covering Bitcoin, major assets, stablecoin
   liquidity and aggregate on-chain activity.
2. Three independent battle reports for Solana, BSC and Robinhood. They share
   provenance rules but do not need identical indicators or thresholds.

The brief is descriptive. It ranks observation priority for a human scan; it
does not authorize trading, execution, or a hard allow/deny gate. Dune-derived
metrics are trust class B only when the query identity, query version or hash,
execution identity, result timestamp and completeness are retained.

This design activates cross-chain macro definitions only. It does not activate
BSC or Robinhood CA adapters, production collectors, credentials, webhooks,
backfills, or the chain-specific E2E stage.

## Daily Run Boundary

- `report_day`: UTC calendar day covered by the report.
- `as_of`: latest finalized or source-declared cutoff used for each metric.
- `computed_at`: local time the report was calculated.
- `source_watermark`: per-query or per-source execution and coverage evidence.
- `completeness`: fraction of required inputs present for the declared section.

The daily process may query historical hourly data, but runs once per day. A
once-daily collection cadence must not collapse a time-to-event metric into a
daily close; cohort calculations use the finest verified historical interval
available and state that interval.

## Global Attention Layer

The global section answers whether capital and attention are expanding in the
broader crypto market before comparing meme-chain battlefields. It must report
values separately by asset or chain rather than making a synthetic index from
incomparable sources.

| Metric family | Daily fields | Interpretation boundary |
| --- | --- | --- |
| Major asset attention | BTC and major-asset on-chain active entities, transfer activity, DEX activity where available | Do not equate transfer volume with buying pressure. Entity heuristics and coverage are explicit. |
| Stablecoin liquidity | supply/flow proxy, bridge net flow, stablecoin DEX share | Report chain and issuer coverage. A missing issuer is not zero flow. |
| Aggregate DEX liquidity | DEX volume, active traders, active pools, total pool liquidity where verified | Do not sum duplicate aggregator results or mix different pool universes. |
| Risk appetite breadth | share of volume/active traders outside BTC/ETH/stable pairs, new-pool share, long-tail participation | A descriptive breadth signal, not a directional asset call. |
| Market regime history | 7D/30D/60D percentile or relative-to-maximum for each native metric | Each metric is normalized against its own history. Do not average percentiles into an unversioned score. |

Global asset price, market-cap, derivatives and stablecoin datasets are
**UNVERIFIED** until `MACRO-DUNE-RESEARCH-001` establishes exact Dune source
coverage. The initial brief may omit an unavailable family and show a coverage
warning rather than substituting an off-chain number.

## Per-Chain Battle Reports

Every chain report has four sections: capital, supply, survival and timing.
The fields below are a contract; a field may be absent only with a warning and
completeness reduction.

### Solana

| Section | Metrics |
| --- | --- |
| Capital | DEX volume, active traders, active pools, liquidity net change, volume/liquidity ratio |
| Supply | Pump-style launches, migrations/graduations, first external pool/listing count, launch-to-listing rate |
| Survival | 1H/6H/24H pool survival, liquidity retention, 24H residual valuation, time to 50% and 90% drawdown |
| Timing | 60D/90D hourly profile for volume, active traders, launches, listings and liquidity additions |

### BSC

| Section | Metrics |
| --- | --- |
| Capital | DEX volume, active traders, active pools, Pancake-style pool liquidity and net LP change |
| Supply | Four.meme-style launches **(PARK until an authoritative event source is verified)**, first external DEX pool/listing count, launch-to-listing rate |
| Survival | 1H/6H/24H pool survival, liquidity retention, 24H residual valuation and drawdown cohorts |
| Quality context | count of tokens with verified security coverage, and separately count of unavailable/unsafe/unknown results |
| Timing | 60D/90D hourly profile for volume, pool creation, listings and liquidity additions |

Contract-security labels are not chain facts and must preserve their provider,
observation time, coverage and confidence. A lack of a security result is
`unknown`, not safe.

### Robinhood

| Section | Metrics |
| --- | --- |
| Capital | DEX volume, active pools, active traders, liquidity change for the verified registry universe |
| Supply | new verified pools and first observable external listings only |
| Survival | pool 1H/6H/24H activity and liquidity retention where the underlying data is available |
| Timing | hourly volume and pool-creation profile for the declared registry universe |
| Coverage | registry version, DEX/project inclusion list, missing-source warnings and coverage status |

Robinhood metrics must never claim all-chain coverage unless the exact DEX and
registry universe has been verified. `partial_coverage` is a normal report
state, not an error to hide.

## Launch and External Listing Cohorts

These definitions are chain-specific event mappings with common semantics.

| Field | Contract |
| --- | --- |
| `launch_time` | verified launchpad creation/factory event; no metadata inference unless explicitly labelled fallback |
| `first_external_listing_time` | first verified DEX pool or trade outside the launchpad/bonding-curve venue |
| `listing_baseline` | price and verified supply at first external listing; valuation basis is stored with the metric |
| `time_to_50pct_drawdown` | first verified interval where valuation is at or below 50% of listing baseline |
| `time_to_90pct_drawdown` | first verified interval where valuation is at or below 10% of listing baseline (that is, a 90% drawdown) |
| `avg_valuation_24h` | token-level average over the first 24 hours after listing, with interval and basis recorded |
| `peak_valuation_24h` | maximum verified valuation over the first 24 hours after listing |
| `residual_valuation_24h` | latest verified valuation at the 24-hour boundary; never silently use a later value |
| `liquidity_retention_24h` | liquidity at 24-hour boundary divided by listing liquidity; denominator and pair identity are retained |

`market_cap` and `FDV` must remain separate. When circulating supply is not
verified, report `fdv` with `valuation_basis=fdv`; do not rename it market cap.
For every cohort metric store `pair_address`, `valuation_basis`, source class,
interval, source timestamp and completeness.

Tokens that have not reached a drawdown threshold by the observation cutoff are
right-censored. Daily reports show both the reach rate within a declared horizon
and the median time among reached tokens. They must not treat censored tokens as
having reached the threshold at the report cutoff.

## Historical Active-Time Profile

For each chain and metric family, build a rolling 60D or 90D UTC-hour profile:

- `volume_share_by_hour`
- `active_trader_share_by_hour`
- `launch_share_by_hour`
- `external_listing_share_by_hour`
- `liquidity_add_share_by_hour`

The report outputs the peak hour, a contiguous high-activity window, the sample
day count and the display timezone. UTC is the stored canonical timezone; an
Asia/Shanghai rendering is display-only. A single seven-day volume chart is not
sufficient evidence for a recurring active-hour claim.

## Proposed Daily Output Contracts

`macro_daily_global_metrics`

```text
report_day, metric_family, metric_name, subject, value, unit,
history_window_days, percentile, source, query_ref, query_version,
source_as_of, computed_at, completeness, warnings
```

`macro_daily_chain_metrics`

```text
report_day, chain, section, metric_name, value, unit, registry_version,
coverage_status, source, query_ref, query_version, source_as_of, computed_at,
completeness, warnings
```

`macro_listing_cohort_metrics`

```text
chain, token_address, launch_time, first_external_listing_time, pair_address,
valuation_basis, listing_valuation, avg_valuation_24h, peak_valuation_24h,
residual_valuation_24h, reached_50pct, time_to_50pct_drawdown,
reached_90pct, time_to_90pct_drawdown, liquidity_retention_24h,
interval_seconds, source, query_ref, query_version, source_as_of,
completeness, warnings
```

`macro_hourly_chain_profile`

```text
chain, profile_window_days, metric_name, hour_utc, sample_day_count,
metric_value, metric_share, computed_at, source, query_ref, query_version,
completeness
```

These are contracts only. No migration or collector is authorized by this
document.

## Brief Shape

```text
Global attention: broad liquidity / risk breadth / stablecoin flow coverage
Solana battle report: capital, launch supply, survival, active window
BSC battle report: capital, launch supply, survival, quality context, active window
Robinhood battle report: registry-scoped capital, pools, survival, coverage
Data quality: as_of, query execution references, partial sections and warnings
```

The brief may say a chain deserves more human scanning because its native
capital, supply and survival readings improved relative to its own history. It
must not say that a chain is objectively better using an unversioned cross-chain
score, or make a trading recommendation.

## Required Dune Research Before SQL Implementation

`MACRO-DUNE-RESEARCH-001` must verify each proposed metric against an exact
dataset/query before an implementation task is created. Required evidence:

1. Dune dashboard/query URL, query ID and SQL version or saved result reference.
2. Exact table name, field names, date semantics and supported chain values.
3. Whether values are raw events, decoded trades, a third-party query result or
   a derived aggregation.
4. DEX/project registry and inclusion/exclusion rules for every chain.
5. Duplicate-leg, router, bot and same-transaction filtering policy.
6. Coverage limits for BTC/major assets, stablecoins, BSC and Robinhood.
7. Query execution timestamp, reproducible parameters and expected cost/rate
   constraints.

Until this evidence exists, all Dune table and dashboard field assumptions are
`UNVERIFIED`.

## Owner and Audit Gates

- Provider credentials, paid plans, payload retention, database deployment,
  backfill, schedules and Feishu delivery are separate Owner-gated tasks.
- A future implementation needs an additive migration, offline fixtures and an
  independent T2 audit.
- BSC and Robinhood CA adapter activation remains blocked. This macro design
  does not change that state.
