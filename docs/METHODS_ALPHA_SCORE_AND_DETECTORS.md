# Methods — Alpha Score, Detectors, Parser Contract & Harness Dimensions

> Status: **design reference** for the judgment layer and ingestion contract.
> Companion to `PROJECT_ARCHITECTURE.md` (binding) and
> `docs/BLUEPRINT_REVISION_PROPOSAL_2026-07-26.md`. Produced 2026-07-26 from
> three independent design passes, each grounded in `PROJECT_CONSTITUTION.md`,
> the Owner's two source documents, the existing `src/domain/rules/*`, and the
> data-source research. These are method-execution specs an implementer builds
> from; the binding rules they must not violate live in the architecture doc and
> constitution.

This document has three parts:
- Part 1 — Alpha Score dynamic scoring engine (`alpha-score-v1`).
- Part 2 — The three forensic detectors (`cluster-fusion-v1`, `bot-sniper-v1`, `independent-smart-money-v1`).
- Part 3 — Parser contract, unified observation schema, and the four harness acceptance dimensions.

All three preserve, without exception: raw-integer discipline (constitution #1),
transfers≠sales (#2), owner-aggregation before ranking (#3), the exclusion
evidence payload with reason/confidence/evidence/rule_version/reversible snapshot
(#4), creator provenance (#5), market-enrichment-never-overrides-chain (#7),
partial→completeness-never-fake-precision (#8), and the **existing 0.85 holder-
exclusion gate + CEX/router service-funder suppression in `funding-clusters.ts`**
(detectors extend, never lower, that gate).

---

## Part 1 — Alpha Score dynamic scoring engine (`alpha-score-v1`)

**One-sentence definition.** Alpha Score is the live population-percentile of a
wallet's risk-adjusted, time-decayed *excess* return over the current regime-
matched market baseline. It is a **rank, not a return number**, so it re-floats
daily as the market and population move (blueprint 五/六). Two invariants:
beat-the-market (every performance feature is excess-over-baseline; the final map
is a live percentile, never a fixed ROI bar), and external-labels-as-features
(GMGN/Birdeye/Vybe labels are provisional priors + bounded inputs, never set the
tier).

### 1.1 Factor decomposition (the four groups → computable sub-features)
All monetary math on raw integer base units (#1); only ratios are floats. PnL is
derived from swap/venue events, never bare transfers (#2) — load-bearing for the
anti-wash defense.

- **Market environment → `MarketBaseline`** (the bar to beat), computed over the
  scored token universe `U`. Two windows for memecoin velocity: `W_regime` = 7d
  (bull/bear read), `W_base` = 30d (baseline ROI distribution + z population).
  Fields: `market_median_roi`, `market_win_rate`, `meme_win_rate` (fraction of
  `U` reaching ≥2×), `count_100x`, `regime ∈ {bull,neutral,bear}`. Regime buckets
  the population a wallet is z-scored against, so it competes only with same-market
  peers. Thin universe (`< MIN_UNIVERSE_TOKENS`, default 30) → completeness<1 +
  `market_baseline_thin` warning + confidence cap (#8).
- **Wallet performance → `AlphaRawVector`** over `W_eval` = 90d, EWM-weighted:
  `excess_return` (decayed capital-weighted mean of `roi_i − base_i` — the core
  超额收益), `win_rate_excess`, `log(profit_factor)`, `max_profit_contribution`
  and `profit_HHI` (feed risk, not reward), `multi_token_persistence` (distinct
  independent profitable tokens + active weeks — rewards repeatability, guards
  非单次暴击).
- **Risk adjustment → multiplicative penalties ∈ (0,1]**, each carrying the #4
  payload shape: `pen_luck` (few distinct profitable tokens), `pen_supertoken`
  (`profit_HHI`/one-super-token reliance), `pen_cluster` (cluster member → not
  independent alpha; cluster collapsed to one actor, default discount 0.6),
  `pen_bot` (bot-pattern → real but not human alpha, default 0.5).
- **Time decay → EWM half-life 14d**: `w_i = 0.5^(age_days_i / 14)` at position
  close. Rationale: memecoin edge is highly non-stationary; 14d makes the last
  ~month dominate while leaving a decaying tail, coherent with the 30d baseline.
  `HALF_LIFE` is a versioned parameter.

### 1.2 Score formula
1. **Regime-relative robust-z** within the wallet's regime population, using
   median/MAD (outlier-robust): `z(x) = (x − median)/(1.4826·MAD + ε)`.
2. **Weighted CoreAlpha** (named, versioned weights):
   `CoreAlpha = (w_excess·z(excess_return) + w_winrate·z(win_rate_excess) +
   w_pf·z(log profit_factor) + w_persist·z(persistence)) × pen_luck ×
   pen_supertoken × pen_cluster × pen_bot`.
   Group mapping: market (baseline subtraction + regime population), performance
   (z-sum), risk (penalty product), time (the `w_i` inside every aggregate).
3. **Percentile map**: `AlphaScore = 100 × percentileRank(CoreAlpha within
   eligible independent population)` — the score *is* the percentile.
4. **Tiers from live distribution**: UR ≥90 / SSR 80–90 / SR 65–80 / R 50–65 /
   N <50. Band cut-points fixed in *percentile* space; the CoreAlpha value needed
   for each band floats with the population (the auto-adjustment). Persist run
   `bandCutpoints` so a card can show "UR needs CoreAlpha ≥ X today". A
   `regimeBandOffset` hook (default 0) can raise required percentiles in a raging
   bull without code change.

`alpha-score-v1` defaults: weights (excess .40 / winrate .20 / pf .20 / persist
.20); decay HALF_LIFE 14d, W_eval 90d; market W_regime 7d, W_base 30d,
MIN_UNIVERSE_TOKENS 30; penalties LUCK_MIN_TOKENS 5 (floor .3), HHI_SOFT .35
(SUPER_FLOOR .4), CLUSTER_DISCOUNT .6, BOT_DISCOUNT .5.

### 1.3 Honest under partial data (#8)
Minimum-evidence bar for **any** tier: `distinct_tokens ≥ 5 AND closed_positions
≥ 3 AND history_span ≥ 7d`. Below → status **`insufficient`, never `N`** (`N` =
*proven* below-median; `insufficient` = *cannot judge yet* — collapsing the two
fakes precision). Stores reason/evidence/rule_version + reversible snapshot,
re-evaluates as data arrives. **Confidence** ∈[0,1] = product of evidence_factor,
span_factor, coverage_factor (fraction Tier-A verified), regime_factor.
**Completeness** ∈[0,1] reported alongside. **Borrowed-only PnL** → score marked
`provisional`, confidence hard-capped at 0.6 + `alpha_pnl_borrowed_unverified`.

### 1.4 Provenance & recompute
Inputs by tier: per-wallet per-token PnL — Tier-B (Birdeye/Moralis/SolanaTracker/
Bitquery/GMGN, provisional) → Tier-A (Helius Enhanced-Tx swaps, FIFO/weighted-cost
self-computed, promotes); entry timing similarly; **funding source always
first-hand** (Helius first-SOL funder — never borrowable). Stored-label precedence
`self_computed > birdeye > vybe > gmgn > manual`. Provisional→confirmed: hot path
scores with borrowed PnL (conf ≤0.6); when the growth loop marks a wallet watched,
an async job recomputes FIFO PnL + funding source with verified inputs, the
confirmed record supersedes the provisional (append-only), lifts the cap, flips
provisional→confirmed, attributes the change to `coverage`. Daily re-score
(blueprint 九): rebuild `U`, recompute baseline+regime, re-z, re-percentile,
re-band — a wallet can move SSR→SR with no new trades purely on market shift (§1.6
makes that explainable).

### 1.5 Explainable output
Card shows: alphaScore (percentile), tier, status (scored/provisional/
insufficient), confidence, completeness, coreAlpha, regime, per-factor signed
`contributions`, `penalties` (with #4 payload), `topEvidenceTokens` (best profit
contributors with pnlSource), `whyNotHigher` (the single binding constraint — the
largest negative delta among heaviest penalty / lowest z-feature / percentile gap
to next band / evidence-coverage cap; the most actionable line), and `provenance`
(scoreSource, alphaScoreRuleVersion, marketBaselineVersion, bandCutpoints,
inputsHash). Display precedence (blueprint 八): risk > behavior > **ability (this
score)** > social — Alpha Score never overrides a risk label.

### 1.6 Anti-gaming
- **Wash trading**: PnL only from swap events (#2); round-trip self-funded trades
  net ~0 under FIFO. Plus a **realizable-liquidity haircut**: a position's counted
  profit is capped by pair realizable liquidity at exit, so paper 1000× on a $50
  pool is discounted to what could actually be sold. Tier-A recompute required
  before wash-prone PnL lifts a tier.
- **Sybil splitting**: cluster keys on first-SOL funder (splitting can't hide it);
  the engine collapses each cluster to one effective actor — 20 split wallets →
  one discounted rank, not 20 URs.
- **Single 1000× luck**: three brakes (`pen_luck`, `pen_supertoken`, low
  z-persistence) + the liquidity haircut → one-hit wallet lands mid-pack.
- **Label spoofing**: labels are capped-weight features, never set the tier; only
  first-hand excess return reaches UR/SSR.

### 1.7 rule_version discipline
Two version axes + inputs hash: `alphaScoreRuleVersion` (weights/penalties/decay/
windows/bands), `marketBaselineVersion` (dated regime+distribution snapshot),
`inputsHash` (position set + coverage tier). Tier-move attribution, in priority:
(1) inputsHash changed → performance change (or coverage promotion); (2) else
ruleVersion changed → formula change; (3) else only baselineVersion changed →
market shift ("you didn't get worse, the market got hotter"). Every drop is
exactly one of {traded differently, ruler changed, market moved}, never conflated.

**Builder targets**: add `AlphaScore`/`MarketBaseline`/`AlphaRawVector` to
`src/domain/types.ts` beside `WalletQuality`; new `src/domain/rules/alpha-score.ts`
following the deterministic/versioned `selectMarketSnapshot` pattern; penalty
inputs from `wallet-quality.ts` + `funding-clusters.ts`.

---

## Part 2 — The three forensic detectors

Shared foundations: every feature is tagged **Tier-A** (first-hand, reproducible —
the only inputs allowed to cross an assertion threshold) or **Tier-B** (borrowed
platform labels — capped corroboration, never move a score across a boundary
alone). Co-sell/disposal features read `NormalizedTrade` swap evidence only (#2);
membership/co-occurrence on owner-aggregated addresses (#3); every exclusion-
feeding label carries the #4 payload; creator linkage uses `PumpCreatorEvidenceFact`
(#5); partial Tier-A anchors degrade to warnings (#8).

### 2.1 D2 — Conspiracy Cluster (`cluster-fusion-v1`) — the anchor
Extends `funding-clusters.ts` as an overlay; does **not** replace
`detectFundingClusters()`, **does not lower the 0.85 exclusion threshold**
(`real-holders.ts`), **does not bypass CEX/router service-funder suppression**.

Features: `f_fund` (A — existing `ClusterMember.confidence` seed = shared-funder
strength), `f_block` (A — fraction entering same/±1 slot as cohort leader),
`f_cosell` (A — fraction co-selling in a shared 300s window, swaps only),
`f_xtoken` (A — cross-token co-occurrence over prior tokens), `f_devlink` (A —
funding-path link to creator/dev/early-LP), `f_ext` (B, capped — Rugcheck insider
graph / GMGN bundler-rat-trader labels).

Windows: funder→buy 600s and sibling-buy 120s reused verbatim from
`funding-clusters.ts`; same-block ≤1 slot (weight 1.0), ≤4 slots (0.5); co-sell
300s rolling; cross-token edge `min(1.0, 0.34 × token_count)`.

Score/verdict: `C_A = 0.35·f_fund + 0.20·f_block + 0.15·f_cosell + 0.20·f_xtoken
+ 0.10·f_devlink` (Tier-A only); `C = clamp01(C_A + bonus_ext)` where `bonus_ext`
is gated (≥2 Tier-A features positive) and capped +0.10.
- **C ≥ 0.85 AND seed confidence ≥ 0.85** → assert **Cluster** (risk label);
  only this is eligible for `same_source_cluster` holder exclusion, and exclusion
  is still decided by the *existing unchanged* gate in `real-holders.ts` — the
  fused C adds evidence, never substitutes for or lowers the gate.
- 0.70 ≤ C < 0.85 → "Cluster suspected" warning only, no exclusion (#8).
- `f_devlink ≥ 0.6 AND f_fund ≥ 0.85` → escalate **Cluster → Insider** (higher
  display priority).

Guards: **G-2a** reuse/never-weaken service-funder suppression (exchange/router
funders at conf ≥0.8 removed before `f_fund`; a CEX fan-out cannot reach the
threshold because `f_fund` is the anchor weight); **G-2b** no Tier-B-only firing;
**G-2c** bonding-curve/LP/router role-excluded addresses aren't counted in
`f_block`. Evidence: extend `ClusterMember.evidence` with `ClusterEvidenceV1`
(features + seedConfidence + suppressedFunders + reversible snapshot of funding
edges/entry swaps/co-sell swaps/prior co-entries/creatorFact/ownerAggregationRef).
Exports `clusterSignal {isMember, clusterId, C, insiderEscalated, riskTier}` to
Alpha Score's cluster penalty (D2 exports the signal; Alpha Score owns magnitude).

### 2.2 D3 — Bot Sniper (`bot-sniper-v1`) — new `rules/bot-sniper.ts`
Features: `f_slot` (A — entry earliness, 1.0 at first 0–2 slots decaying to 0 by
~slot 150), `f_freq` (A — first-minute frequency, reuses `wallet-quality.ts`
bot signals), `f_hold` (A — median buy→sell < 60s), `f_dist` (A — ≥3 addresses
sharing funder + identical slot-offset fan-out pattern), `f_ext` (B, capped —
GMGN/Birdeye sniper/bot label, fast_tx_ratio).
Score: `S = 0.30·f_slot + 0.25·f_freq + 0.20·f_hold + 0.25·f_dist +
min(0.10, 0.10·f_ext)`. S ≥ 0.75 → **Sniper** (behavior label); 0.60–0.75 →
"Bot-like". Guard **G-3a**: fire only if `f_dist > 0` (multi-address pattern) OR
≥2 of {f_slot,f_freq,f_hold} ≥0.8 — a lone early fast address does NOT fire (may
be a fast human). Never drives holder exclusion (behavior only), consistent with
`holderExclusionUsesWalletQuality:false`. Exports `sniperSignal {S, isBotPattern,
distributed}` to Alpha Score's bot penalty.

### 2.3 D1 — Independent Smart Money (`independent-smart-money-v1`) — new module
A conservative **certification**. Features: `f_profit` (B→A — Tier-B board is the
*candidate*; certification requires Tier-A FIFO recompute), `f_indep_cluster`
(A = `1 − D2.C`), `f_notbot` (A = `1 − D3.S`), `f_sell_indep` (A — sell timing
uncorrelated with any cohort window), `f_multitoken` (A — distinct profitable
tokens / 3). Score `I = 0.30·f_profit + 0.20·f_indep_cluster + 0.15·f_notbot +
0.15·f_sell_indep + 0.20·f_multitoken`. **Hard vetoes force I=0**: cluster member
(D2.C ≥0.85) OR sniper (D3.S ≥0.75) OR `<3` profitable tokens. Certify only if
`I ≥ 0.80 AND f_profit is Tier-A recomputed`. The cluster veto guarantees D1 can
never certify a wallet D2 flagged (blueprint 八 risk-outranks-capability).
Exports `independenceSignal {eligible, I, multiTokenCount, pnlTierA}` as the
capability-tier eligibility gate; Alpha Score owns the final grade.

### 2.4 Cross-detector precedence & integration
Display precedence enforced by construction (D1 vetoes): risk (Insider>Cluster) >
behavior (Sniper/Bot) > capability (UR/SSR/SR, D1-gated) > social (KOL). Single
export object `WalletForensicSignals {clusterSignal, sniperSignal,
independenceSignal}` attaches to `WalletCleaningEvidence` beside existing
cluster/suppressed-funder evidence, preserving `holderExclusionUsesWalletQuality:
false`. New rule_version strings: `cluster-fusion-v1`, `bot-sniper-v1`,
`independent-smart-money-v1`.

**Design decision flagged to Owner**: D2's fused `C` is intentionally split from
the exclusion gate — the `funding-clusters` seed confidence remains the sole
authority for holder exclusion (≥0.85), while `C` is a richer risk overlay for
display + Alpha Score penalty. This extends the audited cluster logic without ever
weakening or contradicting the exclusion path.

---

## Part 3 — Parser contract, observation schema & four harness dimensions

### 3.1 Parser discipline (binding, see PROJECT_ARCHITECTURE.md §7)
- **PD-1**: every external text/JSON/OCR source is admitted only through a
  **versioned parser** emitting one `ObservationRecord` with one typed snapshot;
  downstream code consumes snapshot structs, never raw text.
- **PD-2**: on template change, bump `parser_version` and modify **only** the
  parser — never the judgment engine or snapshot semantics. A genuinely new field
  is an additive (nullable) snapshot extension = a T2 schema change (coordinator +
  independent review).
- **PD-3**: `parser_version` is part of the observation fingerprint. Re-running
  parser vN over the same raw reproduces a byte-identical snapshot (replay
  determinism); raw is retained via `raw_hash` + blob so any output change is
  attributable to a parser bump or a judgment change, never silent template drift.

Axioms: raw-integer strings for chain amounts into `numeric(78,0)` (#1); borrowed
fields carry `origin:"borrowed"` + `verification_status:"unverified"` until
first-hand confirms (#7 / trust tiers); partial → `null` + `warnings[]` + lowered
`completeness`, never invented precision (#8). No secrets ever enter
`raw_text_or_json`/`raw_ref`.

### 3.2 Unified observation record & six snapshots
`ObservationRecord` fields: observation_id, chain, subject{kind,ref}, source,
origin, verification_status, raw_text_or_json, raw_ref, raw_hash, parser_version,
parser_input_kind, confidence (parsed-template-correctly, orthogonal to truth),
completeness (fraction of target snapshot filled), captured_at, source_observed_at,
warnings[], trust_class (A–E, reused from `market_observations`), snapshot_kind,
snapshot. `confidence` and `completeness` are both required and orthogonal — this
is what stops "template changed, parser guessed, judgment trusted it."

Six snapshots (Owner's Telegram-bot field routing applied), all chain amounts as
raw-integer strings, all USD as nullable enrichment, all fields nullable:
1. `market_snapshot` — USD/FDV/Liq/Vol/Age, buys/sells, price changes, reserves;
   field-parity with `market_observations` (borrowed + first-hand converge on one
   shape, differ by origin/trust_class); never overwrites chain facts (#7).
2. `security_snapshot` — honeypot/tax(bps int)/mint-freeze-renounce/lock/burn/
   open-source/provider_risk_flags; booleans **tri-state** (absence = null, never
   false — #8).
3. `holder_concentration_snapshot` — holder_count/top10/top20/dev/bundler pct;
   **critical #3 guard**: borrowed numbers set `owner_aggregated=false` +
   `is_borrowed_concentration=true`; authoritative concentration only from the
   first-hand `holder_snapshots` pipeline — this snapshot displays/cross-checks,
   never feeds Real-Top-Holders.
4. `wallet_signal_snapshot` — fresh/bundler/sniper/dev + per-wallet
   `LabeledWallet{address, labels[], label_source}`; labels enter judgment as
   **features not verdicts**, precedence self_computed>birdeye>vybe>gmgn>manual.
5. `promotion_and_social_snapshot` — dex_paid/first_call/group_size/urls/boosts;
   **soft signals only**, never gate safety.
6. `call_source_snapshot` — who surfaced the CA; records capture path
   (forwarded_text/tdlib_client/ocr/manual) because the Telegram Bot API cannot
   read other bots' messages, so forwarded/OCR/user-client captures are unified
   and replay-deterministic.

### 3.3 Object schema (additive migration `008`, aligned to existing tables)
token → existing `tokens` (no change, creator provenance intact); pair → existing
`token_markets` + live values in `market_observations`; **wallet → new `wallets`**
master (address, first_seen, funding_source=Helius first-SOL cluster seed,
alpha_score, labels jsonb derived from `address_labels`, data_completeness);
**wallet_token_edge → new `wallet_token_edges`** (raw-integer amounts, realized/
unrealized PnL, pnl_source, origin first_hand/borrowed; first-hand from
`normalized_trades`, transfers never counted as sales — #2); cluster_edge →
existing `address_clusters` + `address_cluster_members` (funding_edges supply the
shared-funder seed); **observation → new `observations`** table (A.1 persisted,
unique on (source, observation_fingerprint), shared trust_class/completeness/
warnings vocabulary with `market_observations`). The three logical sets (smart
money / bot-sniper / cluster) all derive from `wallets.labels` + `address_clusters`
— no separate tables. Migration `008` + the observation/snapshot types are T2;
the four suites + fixtures are T1 with non-overlapping write sets.

### 3.4 Four harness acceptance dimensions (offline, deterministic, versioned)
Each is a `tsx --test` suite + small offline runner CLI added to a task's
`acceptance_commands` (no framework change); all fully offline (fixtures only —
current stage forbids live network); each exits non-zero on failure (GREEN
fail-closed) and writes `<runDir>/suite-*.json`.

1. **Latency** (`suite:latency`) — CA→first-screen p50/p95 measured on a **virtual
   clock** with fixture-declared per-source `latency_ms` stubs → bit-deterministic
   across machines. PASS iff `P95 ≤ 2000ms AND P50 ≤ 900ms AND` every case emits a
   card (possibly DEGRADED) — first screen never blocks on the slowest source.
   FAIL if calls serialize (simulated total ≈ sum not max — the "慢SQL+串行API"
   failure mode). Budgets in a versioned `latency-budget@1` file.
2. **Replay** (`suite:replay`) — replays hash-pinned old-token timelines
   (observations + raw chain events + pinned `expected.json`); PASS iff derived
   output equals golden field-by-field: real-top-N (exact numeric), excluded-owner
   set *with identical reason+rule_version* (#4), smart-money set, cluster
   membership+shared_funder, security tri-state vector. Same parser/rule version
   must reproduce byte-identical output (PD-3); differing while versions unchanged
   → FAIL (nondeterminism/hidden state/time dependence). This is the concrete
   mechanism behind the constitution's "reproducible analysis manifest".
3. **Source-degradation** (`suite:degrade`) — a (source × failure-mode) matrix
   (timeout / field_missing / field_renamed / malformed / stale). Each cell asserts
   `(no_crash, warnings_contains(code), completeness_decreased_and_reported)` and
   that **no field depending on the failed source is populated with a non-null
   value** (fake-precision guard). Special first-hand guard: if Helius (holder
   source) degrades, concentration must be marked `unavailable`, never silently
   substituted by a borrowed Top10 (#3/#7) — a cell that "recovers" that way FAILs.
4. **Label-decision** (`suite:labels`) — golden **auditor-attested** labeled cases
   (known clusters / independent smart money / bot snipers / clean negatives);
   measures per-detector FP/FN vs a versioned `label-tolerance@1` file. PASS iff
   every detector's FP and FN ≤ its tolerance. A tolerance **relaxation is a
   T3-flavored change** (explicit reviewed edit to `label-tolerance@vN+1`, not a
   quiet nudge); the report records which tolerance version ran. Ground truth is
   curated + auditor-signed (a detector author can't grade their own homework).

### 3.5 Why these make downstream drift hard
The four suites add orthogonal, adversarial acceptance axes on top of the existing
`npm run check` + write-scope/secrets integrity, so a task cannot trade one
guarantee for another and still reach GREEN: a hot-path speed-up that drops error
handling fails degradation; a detector that over-flags fails label-decision (and
can't be "fixed" by nudging a tolerance without a versioned T3 change); provider
template churn masquerading as a logic change fails replay unless parser/rule
version was bumped and the golden re-pinned; borrowed-data laundering fails the
degradation first-hand guard + replay's exact excluded-owner/reason check. Combined
with "implementer cannot be the sole auditor of a milestone", a downstream agent
cannot green-light a change that silently regresses the core direction.
