# SOL-MARKET-DATA-DESIGN-001: Solana market-data provenance and conflict contract

## Status and scope

- Task: `SOL-MARKET-DATA-DESIGN-001` (T2, researcher).
- Status: design only. It does not authorize a migration, source implementation,
  credential, network call, backfill, webhook, or BSC/Robinhood work.
- Chain: `solana` only.
- Dependencies: `SOL-PUMP-001` must be accepted before an implementation task
  relies on Pump.fun discovery or graduation events.

This contract adds an auditable market-enrichment layer. It preserves the
constitution's boundary: price, FDV, liquidity, and aggregator transaction
metrics are enrichment observations; they never replace a normalized on-chain
trade, transfer, holder balance, creator fact, or launchpad event.

The current `MarketSnapshot` is a single, lossy read value with price, FDV,
liquidity, optional pair, `observedAt`, and `source`. The current schema has a
`token_markets` registry but no time-series market observation or conflict
record. This document specifies the additive contract required before either
can be implemented.

## Evidence and trust classes

Every stored value must state its source and trust class. The class describes
what the value is, not whether the product should display it.

| Class | Meaning | Examples in this design | Permitted use |
| --- | --- | --- | --- |
| A | Chain-objective fact | Solana transaction, decoded Pump event, account balance, pool address confirmed from an on-chain event | Facts and confirmation |
| B | Reproducible derived aggregation | A versioned local aggregation or saved-query result with query/version/execution evidence | History and macro context |
| C | Third-party market aggregation | A market-provider price, liquidity, volume, or pair claim | Market enrichment only |
| D | Proprietary label or model output | A provider's smart-money, KOL, sniper, or Dev label | Lead/risk clue only; must be rechecked from A facts for a decision |
| E | Narrative/discovery signal | Profile, promotion, social, or community signal | Candidate discovery only |

`Dune`, `DexScreener`, `GeckoTerminal`, `Birdeye`, `GMGN`, and `GoPlus` are
names of possible future providers, not implemented dependencies. Their API
fields, freshness, rate limits, supported chains, licensing, labels, and
availability are **UNVERIFIED** in this repository. A later provider task must
cite its independently collected evidence and cannot upgrade a C, D, or E
observation to a chain fact.

## Append-only market observations

The proposed source-of-truth relation is `market_observations`. This is a
schema contract, not a migration. An implementation must create an additive
table and write only inside its approved task write set.

| Field | Required | Contract |
| --- | --- | --- |
| `id` | yes | Immutable observation identifier. |
| `token_id` | yes | References a token whose chain is `solana`; the application must reject every other chain. |
| `pair_address` | no | Provider-claimed or chain-confirmed pool/pair identifier. Missing is explicit, not inferred. |
| `venue` | no | Provider-supplied venue name or an on-chain decoded venue. `venue_source_class` records which. |
| `source` | yes | Stable provider/source identifier, for example a future `dexscreener`. |
| `trust_class` | yes | One of `A` through `E`; ordinary market measurements are `C`. |
| `source_observed_at` | no | Timestamp asserted by the source. Its absence lowers completeness. |
| `retrieved_at` | yes | Time the collector received the response or event. |
| `ingested_at` | yes | Time the local append was committed. It is never substituted for source time. |
| `source_request_ref` | yes | Non-secret request identity: provider route family, normalized token/pair query scope, and collector/config version. No credentials or signed URLs. |
| `source_observation_id` | no | Source-native identifier if supplied. Do not invent one. |
| `observation_fingerprint` | yes | Deterministic hash of the normalized source identity, query scope, source timestamp, and retained fields. Used only for idempotency. |
| `payload_ref` / `payload_hash` | no | Reference and integrity hash for a separately approved, scrubbed payload store. The database must not contain a raw provider payload by default. |
| `price_usd`, `liquidity_usd`, `fdv_usd`, `market_cap_usd` | no | Decimal market values exactly as observed. A null is unknown, not zero. Market cap and FDV remain source-specific. |
| `volume_5m_usd`, `volume_1h_usd`, `volume_6h_usd`, `volume_24h_usd` | no | Windowed source aggregates. The window definition is part of source provenance. |
| `buys_5m`, `sells_5m`, `buys_1h`, `sells_1h` | no | Source-reported counts; not unique buyers/sellers unless that is explicitly evidenced by a future provider contract. |
| `price_change_5m_pct`, `price_change_1h_pct`, `price_change_6h_pct`, `price_change_24h_pct` | no | Source-reported percentage changes, not locally recomputed unless a B-class derivation is separately recorded. |
| `base_reserve_raw`, `quote_reserve_raw`, `base_decimals`, `quote_decimals` | no | Optional values. Raw quantities remain integers; decimals are metadata. |
| `pair_created_at` | no | Source claim until confirmed by an A-class chain event. |
| `completeness` | yes | `[0,1]` measurement coverage for this record, accompanied by missing-field reasons. It is not confidence in price correctness. |
| `freshness_status` | yes | `fresh`, `stale`, `partial`, `rejected`, or `unknown`, derived against a versioned local policy. |
| `warnings` | yes | Structured missing/ambiguity/staleness warnings. |
| `supersedes_observation_id` | no | Links a correction record to an earlier record. Corrections append; old records are never mutated or deleted. |
| `recorded_at` | yes | Local append time for audit ordering. |

All numeric USD fields should use a fixed PostgreSQL `numeric` precision, not
binary floating point. Chain quantities use `numeric(78,0)` in storage and
`bigint` in TypeScript, consistent with the existing schema. `null` means
unavailable; zero means the source explicitly reported zero.

Idempotency must use a unique `(source, observation_fingerprint)` key. A
retry that creates the same fingerprint is ignored as a duplicate. A source
revision with changed retained values must append a new row and point to the
prior row when a relationship is known. No upsert may overwrite a historical
observation.

### Payload retention

This task neither collects nor retains provider payloads. Before `payload_ref`
can be populated, the Owner must decide whether scrubbed live responses may be
retained and for how long. Until then, the collector records only normalized
fields, non-secret request provenance, field-presence metadata, and a hash of
the normalized retained record. A hash is integrity evidence, not a substitute
for an approved retained payload.

## Pair registry and observation boundaries

`token_markets` remains the registry of infrastructure addresses. It must not
be overwritten by a provider choosing a different "main" pair. A future
implementation may append a provider-discovered candidate pair to the registry
only with `metadata` that records source, trust class, observed time, and
confirmation status. It becomes canonical only through a versioned local
selection rule and, where possible, A-class chain evidence.

Market observations are per token and per pair. Token-level totals are derived
read models, never a replacement for per-pair rows. This avoids mixing the
largest liquidity pool from one provider with volume from another.

## Conflict contract and read selection

Different providers can legitimately disagree because they select different
pairs, times, USD references, supply definitions, and filtering rules. The
system therefore stores disagreement rather than averaging it away.

1. Append every valid observation with its source and timestamps.
2. Reject only malformed records or records that violate local invariants; write
   a rejection/audit warning without fabricating a replacement value.
3. Build a read-only `market_snapshot_selection` projection from observations.
   It records `selected_observation_id`, `selection_rule_version`,
   `selected_at`, `candidate_observation_ids`, warnings, and completeness.
4. Select price only from the same pair represented by the selected observation.
   The initial policy should prefer an A-confirmed pair, then the freshest C
   observation from an allowed source, then the greatest non-null liquidity
   within that comparable candidate set. Ties must sort deterministically by
   `source_observed_at`, `retrieved_at`, then observation id.
5. Do not sum volume across providers. Token total liquidity may be derived only
   from distinct, evidence-linked pairs and must name its aggregation rule.
6. FDV and market cap remain source-labelled. Do not average them; show or
   expose a discrepancy warning when comparable fresh observations differ beyond
   a future, versioned threshold.
7. A stale or incomplete record may be selected only as an explicitly stale
   fallback. The projection must preserve its source timestamp and warning.

The future replacement for the current domain `MarketSnapshot` is a selected
projection, not a provider response. It must at minimum include its selected
observation id, pair address, source, trust class, source/retrieval timestamps,
freshness, completeness, selection-rule version, fields selected, and warnings.
Legacy scalar fields can remain for compatibility, but no consumer may treat
them as source-free truth.

## Candidate-pool polling contract

Candidate membership is an operational queue, not a claim that a token is
tradable or hot. The proposed append-only `market_candidate_events` relation
records `token_id`, optional pair, `entered_at`, `exited_at` when applicable,
`tier`, `trigger_type`, `trigger_source`, `trust_class`, evidence reference,
and `policy_version`.

Permitted trigger classes:

- A: a locally decoded Solana launchpad, migration, pool, swap, or watched-wallet
  event after its ingestion contract is accepted;
- C/D/E: a future provider discovery or label observation, retained only as a
  discovery reason and clearly marked non-factual;
- local B-class metrics derived from already stored observations.

Suggested initial policy, subject to provider-budget validation, is: `HOT` for
recent creation or material change, polled every 10--30 seconds; `WARM` for
recently active candidates, every 1--5 minutes; `COLD` for historical tokens,
daily or on demand. These are local scheduling targets, not claims about any
provider's latency, batching, API limit, discovery coverage, or OHLCV support.

The scheduler must enforce a configurable per-source request budget, batch only
when its provider contract later proves batching is supported, and record each
attempt's policy version. It must demote candidates on bounded inactivity,
backoff after errors, and mark observations stale rather than repeat a prior
value as current. A provider failure must leave chain analysis available and
emit a warning/completeness reduction.

The first implementation must not use market polling as whole-chain token
discovery. Whole-chain coverage requires an independently verified discovery
source and a separate acceptance scope.

## Proprietary labels and historical analytics

Future GMGN-like information belongs in a separate append-only
`external_label_observations` contract, not in `address_labels` as permanent
truth. Each row needs `chain='solana'`, subject address/token, label name,
label source, trust class `D`, observed/retrieved/ingested times, source
reference, confidence as supplied or locally assigned, expiration/recheck
policy, evidence reference, and warnings. For example, a smart-money claim is
an observation of a provider label, not `is_smart_money = true`.

Future Dune-like macro results are B-class only when they carry saved-query
identity, query/version hash, execution identity, result timestamp, window,
and completeness. They must be stored independently from C-class intraday
market observations. This design makes no claim that any external analytics
provider exposes a particular API, cadence, or Solana dataset.

## Completeness, warnings, and failure behavior

Every projection must distinguish these cases:

- no observation exists;
- observation exists but has no pair, source timestamp, or requested metric;
- observation is stale under the local policy;
- providers disagree on a comparable metric;
- pair identity is provider-claimed but lacks A-class confirmation;
- source request failed, was rate-budgeted, or was rejected locally.

Warnings must be machine-readable identifiers with evidence references, not
only presentation text. Examples: `market_source_unavailable`,
`market_observation_stale`, `market_pair_unconfirmed`,
`market_metric_missing`, `market_source_conflict`, and
`market_provider_behavior_unverified`. No warning may change an A-class chain
fact or turn missing data into a numerical default.

## Implementation handoff and acceptance

The subsequent implementation task must be Solana-only and separately specify
its migration, source, tests, fixtures, and write set. It must include offline
fixtures for: duplicate retry idempotency, multi-provider pair disagreement,
stale fallback, null/missing metric, correction append, and a D-class label
that cannot overwrite a chain fact. It must not use a real provider response,
credential, or live network call in tests.

Before a provider adapter can be accepted, its research evidence must state the
verified contract, authentication/permission status, rate/budget policy,
retention/license decision, error semantics, and supported Solana scope. Until
then all provider capability claims remain **UNVERIFIED** and the provider is
not production-ready.

Unresolved Owner gates:

1. Whether scrubbed live market-provider responses may be retained and for how
   long.
2. Which provider credentials, plan, endpoint, and commercial terms are
   authorized, if any.
3. Whether and when a PostgreSQL deployment/backfill is authorized.
4. Which explicitly authorized live Solana CA may enter a future E2E manifest.

