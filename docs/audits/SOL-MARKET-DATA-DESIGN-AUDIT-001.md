# SOL-MARKET-DATA-DESIGN-AUDIT-001 - Independent market-data design audit

## Verdict

**GREEN_WITH_ADVISORY**

`SOL-MARKET-DATA-DESIGN-001` is a complete Solana-only T2 design handoff. It
preserves chain-fact priority, records market observations append-only with
source provenance, keeps conflicts traceable, and fails with explicit
completeness/warning state rather than invented measurements. The advisory
below should be resolved in the implementation task's schema contract.

## Scope and verification

Audited task: `SOL-MARKET-DATA-DESIGN-AUDIT-001` (T2, auditor, Solana).

Only the declared task inputs were reviewed. No network API, credentials,
provider payload, source, migration, test, fixture, task, or ledger mutation
was made by this audit.

## Confirmed design controls

- The A--E trust classification confines C-class market aggregates to
  enrichment and D/E inputs to clues/discovery; they cannot replace normalized
  trades, transfers, holders, creator evidence or launchpad events
  ([`SOL-MARKET-DATA-DESIGN-001.md`](../designs/SOL-MARKET-DATA-DESIGN-001.md):20).
  This meets the Constitution's chain-fact priority rule.
- `market_observations` is specified as the additive source of truth with
  source/retrieval/ingestion/recorded timestamps, source request reference,
  fingerprint, field-level null semantics, completeness and structured warnings
  ([`SOL-MARKET-DATA-DESIGN-001.md`](../designs/SOL-MARKET-DATA-DESIGN-001.md):45).
  Corrections append through `supersedes_observation_id`; duplicate retries are
  idempotent on `(source, observation_fingerprint)` and may not overwrite
  history ([`SOL-MARKET-DATA-DESIGN-001.md`](../designs/SOL-MARKET-DATA-DESIGN-001.md):82).
- The existing `token_markets` table is correctly retained as a pair registry,
  rather than a provider-selected main-pair cache. Per-pair observations remain
  the source for token read models, avoiding cross-pair or cross-provider value
  mixing ([`SOL-MARKET-DATA-DESIGN-001.md`](../designs/SOL-MARKET-DATA-DESIGN-001.md):99;
  [`001_initial.sql`](../../db/migrations/001_initial.sql):19).
- Read selection retains the selected observation, candidate set, rule version,
  warnings and completeness. It does not average provider volume, FDV or market
  cap; it explicitly labels stale fallback and source timestamps
  ([`SOL-MARKET-DATA-DESIGN-001.md`](../designs/SOL-MARKET-DATA-DESIGN-001.md):110).
- Missing metrics, stale data, unconfirmed pair identity, source conflicts,
  request failure and budget failure all require machine-readable warnings.
  A provider failure leaves chain analysis available and lowers completeness
  ([`SOL-MARKET-DATA-DESIGN-001.md`](../designs/SOL-MARKET-DATA-DESIGN-001.md):149;
  [`SOL-MARKET-DATA-DESIGN-001.md`](../designs/SOL-MARKET-DATA-DESIGN-001.md):174).
- Potential provider APIs, capabilities, rate limits, licensing and chain
  coverage are explicitly **UNVERIFIED**. The document neither authorizes a
  provider implementation nor claims a provider's behavior as fact
  ([`SOL-MARKET-DATA-DESIGN-001.md`](../designs/SOL-MARKET-DATA-DESIGN-001.md):35).
- Retaining scrubbed payloads, credentials/plans/endpoints, deployment/backfill
  and an authorized live CA remain explicit Owner gates. BSC and Robinhood are
  not activated ([`SOL-MARKET-DATA-DESIGN-001.md`](../designs/SOL-MARKET-DATA-DESIGN-001.md):203).

## Advisory

The proposed `market_candidate_events` relation is called append-only but
includes `exited_at` on the same record ([`SOL-MARKET-DATA-DESIGN-001.md`](../designs/SOL-MARKET-DATA-DESIGN-001.md):136).
The implementation task should make lifecycle entries unambiguous: use an
immutable event type such as `entered`, `tier_changed`, `exited`, or a separate
append-only exit record that references the entry event. It must not update an
existing candidate row to fill `exited_at`, because that would violate the
declared append-only provenance policy. This does not block the market
observation or selection contract.

## Acceptance reproduction

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 25 tests passed / 0 failed |

## Unresolved items

- Resolve the candidate lifecycle event shape when the follow-up Solana-only
  implementation task specifies its additive migration.
- Provider contract research, credentials, payload retention, production
  polling, PostgreSQL deployment/backfill and authorized live-CA use remain
  outside this design scope and require the stated evidence and Owner gates.
