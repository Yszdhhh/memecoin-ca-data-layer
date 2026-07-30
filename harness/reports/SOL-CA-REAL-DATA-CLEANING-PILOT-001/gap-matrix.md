# Gap matrix — SOL-CA-REAL-DATA-CLEANING-PILOT-001

Pilot of 6 fixed public Solana CAs via read-only Helius (`gatekeeper_beta`).
Local operator root: see `docs/LOCAL_WORKSPACE_PATHS.md` (`G:\链上战壕`).

## 1. Provider data problems

| Observation | Evidence | Severity | Notes |
| --- | --- | --- | --- |
| Intermittent non-JSON / transport failures on `getTokenAccounts` | Multiple batch runs; first-page failures mapped to `provider_shape_drift` / `helius_transport_unavailable` / `provider_timeout` | High (ops) | Retry and mid-page partial return mitigate; not fixed by core architecture change |
| `mainnet.helius-rpc.com` resolves to `127.0.0.1` on this operator network | DNS A/AAAA → localhost; Node `ECONNREFUSED 127.0.0.1:443` | Blocking for mainnet mode | Pilot uses allowlisted `gatekeeper_beta` only |
| Supply residual with complete pagination | e.g. H1adb… residual `206512932970` (~0.02% of mint) with `paginationComplete=true` | Medium | Likely unindexed / closed / off-DAS accounts; must keep PARTIAL, never confirmed |
| Large residual when pagination incomplete | Ce2… / 9Ztb… residuals dominate mint when pages cut short | Expected | Correct fail-closed concentration (`ratio=null`) |
| Zero-balance accounts rarely present | Default `showZeroBalance=false` for parse reliability | Low | Offline fixtures cover zero-balance exclusion |

## 2. Parser problems

| Observation | Evidence | Severity | Notes |
| --- | --- | --- | --- |
| Token-account field shape variants | Nested `ownership` / `token_info` / flat `amount` all seen; unsafe JS numbers rejected | Medium | Parser extended; malformed rows skipped with `provider_shape_drift` count |
| Full-page fail previously wiped CA | Pre-fix enumeration threw on first malformed row | High (fixed in pilot) | Now skip row / return partial pages |

## 3. Cleaning-rule problems

| Observation | Evidence | Severity | Notes |
| --- | --- | --- | --- |
| Almost no infrastructure exclusions on live pump mints | excludedOwnerCount=0 on OK CAs | Expected | No first-hand pool evidence → no silent exclude |
| Liquidity/pool accounts stay included | No Helius tag path in this pilot | Gap | Needs Tier-A program/account evidence later; mark unresolved only with evidence |
| Multi-account owners exist but modest | e.g. EUx tokenAccountCount 654 vs ownerCount 653 | Covered | Owner aggregation path works |

## 4. Current contract gaps

| Observation | Affects ≥2 CAs? | Risk of false confirmed? | Proposal |
| --- | --- | --- | --- |
| CaScan cohort only exposes top10/top20 | No (by design) | No | Keep pilot `concentration-metrics.json` for top1/5/50/100; no contract change |
| No explicit `unresolvedUniverse` key in CaScan HolderUniverses | Yes (all) | No (mapped into warnings / not confirmed) | Defer; pilot artifact retains unresolved universe |
| Residual with complete pagination has no dedicated CaScan field | Yes (H1adb and potentially others) | Yes if ignored | Already blocked via `judgmentEligible=false` + null ratios |

**Contract change recommendation this round: none.** Residual and pagination gates already prevent confirmed holder judgments.

## 5. Already covered by current architecture

- Owner aggregation (no double-count by token account)
- Raw / cleaned / excluded / unresolved universe separation (pilot artifacts)
- Integer/BigInt amount accounting identity
- RatioMetric numerator/denominator/universe/completeness
- Strict CaScanResponseV1 validation (unknown fields / credential field names fail closed)
- Fail-closed on incomplete pagination and supply mismatch
- Helius-only runtime credential injection; no public RPC fallback

## 6. Explicitly out of scope (do not implement now)

- Pump.fun / PumpSwap trade decode
- Creator history / Dev sell
- Funding-source clustering
- Wallet historical PnL
- Auto CA discovery / hot-token ranking
- New providers (DexScreener, GMGN, Birdeye, Rugcheck)
- Production PostgreSQL / Redis writes
- BSC / Robinhood
- Full SOL-E2E

## Real-data vs future-direction

| Real data (this pilot) | Future only |
| --- | --- |
| Supply residual despite complete DAS enumeration | Pool/vault first-hand exclusion graph |
| Flaky Helius transport/JSON on some pages | Multi-provider holder corroboration |
| Multi-token-account same owner (small delta) | Creator/dev sell pipelines |
| Concentration only safe when residual=0 and pages complete | Frontend card / hot-path latency packaging |
