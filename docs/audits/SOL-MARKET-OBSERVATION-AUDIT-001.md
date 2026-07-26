# SOL-MARKET-OBSERVATION-AUDIT-001 - Independent offline market-observation audit

## Header

- Task: `SOL-MARKET-OBSERVATION-AUDIT-001` (T2, auditor, Solana).
- Auditor: `claude-auditor-market-observation` (independent of the implementer, Grok).
- Date: 2026-07-26.
- Run id: `20260726_SOL_MARKET_OBSERVATION_AUDIT_001`.
- Audited commit: `060e6fa` (`feat(solana): close FIND-4 exclusion inputs and offline market liquidity`).
- Audited artifacts: `src/domain/rules/market-observation.ts`,
  `src/infrastructure/market/observation-market-data-provider.ts`,
  `db/migrations/007_market_observations.sql`, `test/market-observation.test.ts`,
  and the consumption site in `src/application/analysis-service.ts`.

## Verdict

**GREEN_WITH_ADVISORY**

The offline market-observation foundation upholds every non-negotiable it targets:
selection is a pure, offline, totally-ordered function; missing price/liquidity is
surfaced as `null` + explicit warnings and never defaulted or interpolated; the
append-only store dedupes by `(source, fingerprint)`; A-class chain-confirmed
observations strictly dominate any C-class aggregator regardless of freshness or
value; and the provider is enrichment-only — liquidity can only raise the
large-order floor via `max()` and market absence still yields full chain analysis
with a warning. All four acceptance commands pass. No P1. Advisories concern latent
fingerprint scope versus the SQL schema, under-pinned no-invention/stale/conflict
tests, and the missing implementer harness manifest (which this run supplies).

## Scope and methodology

Only the declared task inputs were reviewed against `PROJECT_CONSTITUTION.md` and
`docs/designs/SOL-MARKET-DATA-DESIGN-001.md` (already GREEN_WITH_ADVISORY at design
stage). Review was static plus adversarial reasoning about fingerprint collisions
and rank domination. Per `forbidden_actions`, no source/test/migration/ledger/spec
was modified, and no network, credential, or live market provider was used. The
only file written is this report.

## Verification checklist (file:line evidence)

### 1. Selection is deterministic and offline — CONFIRMED

`selectMarketSnapshot` (`src/domain/rules/market-observation.ts:22-71`) reads no
`Date.now()`, `Math.random()`, `process.env`, or network. Its only clock is the
`at` parameter (`:26`, `options.at ?? new Date()`); staleness is computed against
that injected clock (`:39-40`). `ObservationMarketDataProvider` injects the clock
via `options.now` (`observation-market-data-provider.ts:19`), so callers can make
it fully deterministic. Ordering is a pure comparator: `rankScore`
(`:209-216`) reads only `trustClass`, `freshnessStatus`, the source/retrieval time,
and `pairAddress`. Tie-break is total: rank desc → source-time desc → liquidity
desc → `left.id.localeCompare(right.id)` (`compareObservations:191-207`, final key
`:206`). With unique ids the final key breaks every tie, so equal-key ordering is
never left to unstable sort. Given identical `(observations, at, staleAfterMs)` the
selected observation is invariant.

Advisory: the default `at = new Date()` (`:26`) and the provider default
`now ?? new Date()` make results clock-dependent when no clock is injected. This is
correct for a staleness policy but callers seeking reproducibility must inject
`now`/`at` (the tests do).

### 2. Never invents missing liquidity/price — CONFIRMED

The snapshot copies metrics verbatim, including `null`: `priceUsd: selected.priceUsd`
(`:58`), `liquidityUsd: selected.liquidityUsd` (`:60`). No averaging/interpolation
exists (design's "never averages providers" — `:19-21` comment, and no cross-source
arithmetic anywhere). Missing metrics surface as machine-readable warnings:
`market_metric_missing:liquidity_usd` / `:price_usd` (`:45-46`), plus
`market_pair_unconfirmed` (`:44`) and `market_provider_behavior_unverified` for C
(`:47`); `completeness` is passed through (`:68`, computed in `coverageCompleteness`
`:174-189`). The `?? -1` and `?? 0` fallbacks (`:52-53`, `:203-205`) are used only as
sort sentinels, never written into the returned snapshot. Downstream, the
large-order floor treats null liquidity as `0` floor contribution and keeps the
fixed floor via `max()` (`analysis-service.ts:323-326`), so absent data never
fabricates precision.

### 3. Append-only idempotency — CONFIRMED (with latent scope advisory)

`observationFingerprint` (`:73-94`) hashes
`source | sourceRequestRef | sourceObservedAt | pairAddress | priceUsd |
liquidityUsd | fdvUsd | marketCapUsd` via SHA-256. `String(null)` = `"null"` is
distinct from `String(0)` = `"0"`, so unknown vs zero do not collide. The store
dedupes on `(source, fingerprint)` (`InMemoryMarketObservationStore.append:155-165`)
matching the SQL `UNIQUE (source, observation_fingerprint)` (`007…sql:46`). Retry of
an identical record is rejected `duplicate_fingerprint`; a correction with changed
values + `supersedesObservationId` appends a new row (test `:52-84`). Volatile
fields (`id`, `retrievedAt`/`ingestedAt`, `recordedAt`, `sourceObservationId`) are
correctly excluded from the fingerprint, so retries are idempotent.

Adversarial false-dedup: the SQL table retains `volume_*`, `buys_*`, `sells_*`,
`price_change_*_pct`, `base_reserve_raw`, `quote_reserve_raw`, etc.
(`007…sql:24-39`), but the fingerprint omits all of them. Two genuinely distinct
observations from one source that share `source_request_ref`, `source_observed_at`,
pair, price, liquidity, FDV, and market cap but differ in volume/txn counts/reserves
produce the **same** fingerprint and the second would be rejected by the unique
constraint. This contradicts the design's fingerprint definition ("normalized source
identity, query scope, source timestamp, **and retained fields**" —
`SOL-MARKET-DATA-DESIGN-001.md:62`). Current impact is nil because the TypeScript
`MarketObservation` type (`domain/types.ts:262-284`) carries only price/liq/fdv/
marketCap — the extra columns have no writer yet — so this is a latent P2 for a
future collector, recorded below.

### 4. A-over-C preference — CONFIRMED

`rankScore` weights trust as A=300, B=200, C=100 (`:212`); the only other
contributions are freshness ≤50 (`:213`) and pair-present +10 (`:214`), a maximum
non-trust bonus of 60 < the 100-point gap between adjacent classes. Therefore a
stale, pairless A (300) still outranks a fresh, paired C (100+50+10=160), and even B
(≥200) dominates any C. Class rank dominates the value/freshness sort. The selector
also filters to A/B/C only (`:31`), excluding D/E labels from selection entirely.
Adversarial case pinned: older A-class chain-confirmed vs fresher higher-liquidity
C — A wins (`test:86-116`, asserts `selectedObservationId === "obs-a"`,
`trustClass === "A"`). This is the constitution's "market APIs never override chain
facts" (rule 7) enforced at rank level.

### 5. Cannot override on-chain CA facts — CONFIRMED

`ObservationMarketDataProvider` implements only `getMarket → MarketSnapshot | null`
(`:15-22`); it exposes no holder/creator/dev surface. In `AnalysisService` the market
result feeds exactly two things: `result.market` (a display projection) and
`largeOrderMinimumUsd` (`analysis-service.ts:147`). That floor is
`max(fixedUsd, liquidity*ratio)` and the liquidity term is `0` unless
`liquidityUsd > 0` (`:319-327`) — liquidity can only **raise** the threshold (fewer
trades qualify as "large"), never lower the 5,000 USD fixed floor and never
fabricate large orders. Holder/dev/creator facts come solely from the chain adapter
(`:175-…`), untouched by market data. Market failure is caught and downgraded to
`MARKET_ENRICHMENT_UNAVAILABLE` (`getMarketSafely:310-316`) with chain analysis
continuing and a warning `补充市场数据不可用；链上持仓与交易口径不受影响` (`:291`). Confirmed: enrichment
cannot influence exclusion or chain facts.

### 6. Migration sanity — CONFIRMED (untested-against-DB advisory)

`db/migrations/007_market_observations.sql` is additive only: two `CREATE TABLE`
(`:5`, `:53`) plus two `CREATE INDEX` (`:49`, `:67`); no `ALTER`/`DROP` against
existing tables. FK to `tokens(id) ON DELETE CASCADE` (`:7`). Constraints match the
domain: `trust_class IN (A..E)` (`:11`), `freshness_status` enum (`:42`),
`completeness BETWEEN 0 AND 1` (`:41`), USD as `numeric` and chain reserves as
`numeric(78,0)` (`:36-37`) per the raw-integer rule. The unique key
`(source, observation_fingerprint)` (`:46`) matches the store's idempotency key.
`market_candidate_events` is immutable/append-only (identity PK, `event_type` in
`entered|tier_changed|exited`, no in-place `exited_at` mutation — `:52-65`),
resolving the design's prior advisory. Owner gate 3 (no PostgreSQL deploy authorized
— `SOL-MARKET-DATA-DESIGN-001.md:229`) means this migration has never been executed
against a real database; recorded as advisory.

### 7. Tests pin the claims — PARTIAL

Pinned: freshest-C selection + rule version + `market_provider_behavior_unverified`
(`test:20-50`); idempotent duplicate reject + correction append + row count
(`:52-84`); A-over-C domination (`:86-116`); liquidity-aware floor raises threshold
so an 8,000 USD trade is not "large" under 1,000,000 liquidity, with
`LARGE_ORDER_FLOOR_RAISED_BY_LIQUIDITY_RATIO` and no chain-fact contamination
(`:118-242`).

Not pinned (design handoff `SOL-MARKET-DATA-DESIGN-001.md:213-214` mandated offline
fixtures for these): (a) **no-invention for null metrics** — no test constructs a
null-liquidity/price observation and asserts the snapshot returns `null` +
`market_metric_missing:*` (obs with `priceUsd: null` exist in tests but the snapshot
field/warning is never asserted); (b) **stale fallback** — `market_observation_stale`
path (`:40-43`) untested; (c) **multi-provider source conflict** —
`market_source_conflict` (`:50-55`) untested; (d) **D-class cannot override** — D/E
filtering (`:31`) untested; (e) **tie-break determinism** — the id tie-break
(`:206`) not directly exercised. These are the audit's central objective #2/#3
guarantees left under-pinned.

## Findings

| ID | Severity | Finding and concrete failure scenario |
| --- | --- | --- |
| F1 | P2 (latent) | Fingerprint (`market-observation.ts:73-94`) omits the SQL-retained `volume_*`, `buys/sells_*`, `price_change_*`, `*_reserve_raw` columns (`007…sql:24-39`), narrower than design `:62`. Failure: a future collector appending two distinct rows that differ only in volume/txn/reserves but share price/liq/fdv/marketCap collides on `(source, fingerprint)` and the second is rejected as a false duplicate, silently dropping a real observation. Zero impact today (TS type lacks those fields); must be fixed before any writer populates them. |
| F2 | P2 | No-invention (objective #2) and idempotency edge (objective #3) are under-tested: null-metric surfacing, stale fallback, source-conflict, D-class exclusion, and tie-break determinism have no assertions (`test/market-observation.test.ts`). A regression that defaults a null metric to 0 or that flips a tie non-deterministically would not be caught. |
| A1 | Advisory | Implementer `SOL-MARKET-OBSERVATION-001` is marked `DONE` in `harness/ledger/tasks.json:256-259` without a finished implementer harness run manifest (no run dir exists besides this audit). This audit run supplies the missing verification. |
| A2 | Advisory | Migration `007_market_observations.sql` has never been exercised against a real PostgreSQL instance (Owner gate 3 pending, design `:229`). Constraint/index correctness is verified by inspection only. |
| A3 | Advisory | `selectMarketSnapshot` default `at = new Date()` (`:26`) and provider default `now` (`observation-market-data-provider.ts:19`) are clock-dependent unless injected; always inject a clock for reproducible projections. |

No P1 findings. No forbidden action was taken by the implementation (no live provider
call, no credential/payload retention, no chain-fact override, BSC/Robinhood inert).

## Acceptance results

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASSED (exit 0) |
| `npm test` | PASSED (exit 0; 118 tests, 0 fail) |
| `npm run build` | PASSED (exit 0) |
| `git diff --check` | PASSED (exit 0; no whitespace errors) |

## Final verdict and justification

**GREEN_WITH_ADVISORY.** Every shipped behavior the task set out to verify holds
under adversarial inspection: offline + deterministic + totally-ordered selection,
strict no-invention of missing price/liquidity with explicit warnings, append-only
fingerprint idempotency, unconditional A-over-C domination, an enrichment-only
provider that can only raise (never lower or fabricate) the large-order floor and
never touches holder/creator/dev facts, and an additive migration with a matching
unique constraint. All acceptance commands pass. The advisories — latent
fingerprint-scope divergence for not-yet-written columns (F1), under-pinned
no-invention/stale/conflict tests (F2), and the process gaps (A1-A3) — do not affect
the correctness of the currently shipped offline surface and are consistent with the
design stage's own GREEN_WITH_ADVISORY posture. Fail-closed review found no reason to
block; the advisories should be resolved before a live provider collector or a real
DB deployment is authorized.
