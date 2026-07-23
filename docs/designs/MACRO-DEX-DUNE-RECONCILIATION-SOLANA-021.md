# MACRO-DEX-DUNE-RECONCILIATION-SOLANA-021

## Goal

Make the daily brief usable as a market-environment view without blending a live provider snapshot into the Dune historical series. Scope is **Solana only** and all values in this task are deterministic test vectors.

## Two separate observation layers

| Layer | Window | Fields | Allowed use | Forbidden use |
| --- | --- | --- | --- | --- |
| DexScreener external snapshot | rolling 24 hours ending exactly at capture time | trading volume, provider transaction count, latest block | current activity and chain-liveness observation | UTC-day historical comparison, liquidity claim, demand claim |
| Dune calibration candidate | the exact same rolling 24-hour interval | leg-sum volume, unique swap transactions, trade legs, data watermark | provider-coverage and count-semantics calibration | treating any count as provider-equivalent or current when its watermark is behind |

`24H Volume` is trading volume, **not liquidity**. `Latest Block` is liveness metadata, **not demand**. DexScreener transaction count remains provider-labelled and is not assumed to equal either Dune unique swaps or Dune trade legs.

## Exact-window and UTC contract

1. Both observations must use a duration of exactly 86,400,000 ms.
2. DexScreener `capturedAt` must equal its rolling-window end.
3. A Dune observation is usable only when start and end timestamps exactly equal the DexScreener window, Dune declares registry coverage, completeness is `1`, and the Dune `dataWatermark` is at or after that window end.
4. Otherwise the reconciliation is `PARK`, with a concrete warning: unavailable Dune interval, window mismatch, behind watermark, or incomplete Dune coverage.
5. Even when all gates pass, status is `aligned_pending_calibration`, not equivalence. Difference percentages are diagnostics only and keep `not_directly_comparable` permanently explicit for a single sample.

## Report behavior

The brief and local Feishu-card rendering display:

- the labelled DexScreener rolling-24H snapshot;
- an explicit warning that it is not a UTC day, that volume is not liquidity, and that latest block is liveness only;
- `PARK` until an exact, complete and sufficiently fresh Dune window exists;
- matched-window Dune values only as calibration candidates, never as a historical day-over-day comparison.

No HTTP client, browser automation, dashboard scraping, Dune execution, database persistence, scheduler, or delivery path is added.

## Future activation gate

Only after several retained, exact-window real samples may an independently reviewed follow-up decide whether DexScreener transaction count is consistently closer to Dune unique swaps, trade legs, or neither. Until then the report keeps both labels and does not normalize one into the other.

## Verification

Run the task validator, TypeScript typecheck, tests, build and `git diff --check`. Test vectors cover missing Dune data, time-window mismatch, Dune lag, incomplete coverage, exact-window candidate output, zero denominators, service integration, and report wording.
