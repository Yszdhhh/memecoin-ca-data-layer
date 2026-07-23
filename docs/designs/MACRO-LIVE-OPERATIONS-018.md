# MACRO-LIVE-OPERATIONS-018

| field | value |
| --- | --- |
| task_id | `MACRO-LIVE-OPERATIONS-018` |
| tier / role | `T1 / researcher` |
| report_utc | `2026-07-22` |
| operational scope | Solana macro daily brief only |
| verdict | **PARK pending Owner execution authorization** |

## 1. Purpose and hard boundary

This document is an **unexecuted preflight** for moving the approved macro daily brief from deterministic offline contracts into a live operating path. It is not an execution runbook: it must not be used to run Dune, create or update a saved query, access a credential, write a database, create a schedule, or deliver a report.

The brief remains a market-environment observation, not a token-buy signal. It must not alter CA facts, holder cleaning, creator provenance, Dev behavior, wallet-cluster rules, or transaction-wallet quality. It reports declared aggregate-chain observations only; it does not establish real users, buyers, demand, smart money, net flows, graduation, token-level external-pool conversion, liquidity retention, drawdown, lifecycle survival, or sentiment verification unless a later approved source contract specifically supports that result.

Solana is the only active chain. BSC/Four.meme remains `PARK`. Robinhood remains reporting-only and explicitly `partial_coverage` for Uniswap v2/v3/v4; this document does not activate either adapter.

## 2. Preconditions and authorization matrix

No live step starts unless every applicable row below is explicitly Owner-approved in a later execution task. A missing value is `PARK`, not a default.

| gate | required Owner-approved evidence | current state | fail-closed behavior |
| --- | --- | --- | --- |
| Dune identity | approved service identity, credential storage method, and least-privilege access | `PARK` | do not invoke Dune API/CLI or inspect credentials |
| saved-query allowlist | immutable query ID, blueprint ID, SQL SHA-256, query version, and expected aggregate schema for each production metric | `PARK` | reject query IDs not present in the allowlist; no dynamic SQL |
| database target | concrete non-production/prod target, TLS/auth method, and named data owner | `PARK` | do not open a pool or write data |
| retention exception | any deviation from the default aggregate-only/400-day policy | `PARK` | retain no raw payloads by default |
| delivery test destination | exact test chat/destination and accountable owner | `PARK` | render locally only; do not send |
| alert destination | exact alert target and accountable responder | `PARK` | do not enable a scheduler; record the unresolved dependency |
| production expansion | proof of seven consecutive GREEN test-destination runs plus Owner approval | `PARK` | remain test-destination-only |

The later execution task must include the exact task ID, bounded write set, source/query versions, destination identifiers, and acceptance evidence. It must not infer approval from this design.

## 3. Dune query control plane

1. **Saved-query allowlist only.** Every live metric comes from a preapproved Dune saved-query ID mapped to a known offline `blueprintId`, SQL digest, metric list, registry version, and expected report-day column. Runtime-provided SQL, query text interpolation, and ad-hoc query IDs are prohibited.
2. **Aggregate-only result schema.** Permit only the declared daily/hourly aggregate fields needed by the brief plus source watermarks and completeness fields. Reject address lists, transaction IDs, token/pool identifiers, raw event rows, free-form text, and columns outside the saved-query schema.
3. **Version equality.** Before parsing an execution result, compare the saved-query ID, blueprint ID, SQL digest, Spellbook/registry version, and parser version to the allowlist. Any mismatch is `version_drift` and suppresses the affected metric/report.
4. **Complete UTC days only.** A report for UTC day `D` may only read `[D 00:00:00Z, D+1 00:00:00Z)`. The current or unfinished day is never substituted. Hourly profiles also require their declared 60- or 90-day set of complete UTC days.
5. **Coverage is a gate, not cosmetic.** Missing or partial source coverage must propagate as `completeness < 1` and its machine-readable warning. Derived hourly peak/time-concentration claims are suppressed unless the full profile contract is complete. Metrics not backed by an approved source remain `PARK`.

## 4. Storage, retention, and deletion policy

The default storage policy is deliberately narrow:

| data class | permitted? | retention | notes |
| --- | --- | --- | --- |
| parsed aggregate metric rows | only after database-target authorization | 400 days | include report day, metric identity, provenance, coverage, warnings, source watermark, parser/query versions |
| rendered report and manifest | only after database-target authorization | 400 days | manifest records hashes and run verdict; it contains no credentials or raw provider payload |
| raw Dune/provider payload | no by default | 0 days | parse in memory and discard after validation; any exception needs a separate Owner decision |
| credentials, cookies, browser state, keys | never in repository/run artifacts | 0 days | use an approved secret manager only after authorization |
| sentiment content or social handles | not authorized | 0 days | a future source-labelled observation layer requires its own permissions, coverage, and retention decision |

Deletion must be idempotent and run daily against the 400-day boundary using UTC report dates. A deletion error is monitored but must never cause a raw-payload backfill or expand retention. The execution task must define the concrete database target before any storage code is enabled.

## 5. Schedule, idempotency, and retry contract

- **First scheduled attempt:** `D+1 14:00 UTC` for complete report day `D`.
- **Retries:** after 5 minutes, 15 minutes, and 60 minutes from the failed attempt. There are at most four attempts per UTC-day idempotency key unless the Owner changes the policy in a later task.
- **Idempotency key:** `macro-daily:solana:<report_day>:<allowlist_version>:<renderer_version>`. Persist or atomically reserve it only after database authorization. Without an authorized persistence target, scheduling remains `PARK`.
- **Atomicity:** validate every expected metric, source watermark, coverage field, and report hash before marking the run GREEN or attempting delivery. A partial result is not silently mixed with a prior run under the same key.
- **Retry eligibility:** retry transient execution, network, or delivery failures. Do not retry authorization failures, schema/version drift, incomplete coverage, invalid UTC report-day boundaries, or missing configured targets; those require remediation and a new authorized attempt.
- **Late data:** do not mutate an already-delivered report automatically. A replacement requires a distinct revision number, explicit reason, preserved prior manifest, and later policy approval.

## 6. Delivery rollout

1. The only permitted first target is an Owner-specified **test** chat/destination.
2. Delivery remains disabled until a later execution task supplies that target. Local rendering or a dry run is not delivery.
3. Send only a report whose validation/run manifest is GREEN and whose idempotency key has not already been delivered.
4. After **seven consecutive GREEN runs** to the test destination, a separate Owner authorization may expand delivery. A failed, skipped, partial-coverage, or unverified run resets the consecutive-GREEN count.
5. Delivery content must retain coverage and `PARK` wording. Robinhood, if shown, remains `partial_coverage` / Uniswap v2/v3/v4 only. It must not turn a market observation into a trading recommendation.

## 7. Monitoring and incident handling

The later execution design must emit structured run state for these alerts:

| alert | trigger | automatic action |
| --- | --- | --- |
| `execution_failure` | Dune execution/parse/retry exhaustion fails | no delivery; retain failure manifest only |
| `coverage_insufficient` | expected full UTC coverage or source watermark is absent | suppress affected conclusions; no synthetic fill |
| `delivery_failure` | a GREEN-rendered report cannot reach the approved test target | retry only under the schedule contract; do not duplicate a delivered key |
| `version_drift` | query/schema/registry/parser/renderer version differs from allowlist | block parse/delivery; require owner-approved allowlist update |
| `idempotency_conflict` | same UTC key is already reserved/delivered with a different hash | block delivery; preserve both manifests for review |
| `retention_failure` | 400-day deletion job fails | alert; do not retain raw payloads or backfill automatically |

Each event must include UTC timestamp, report day, idempotency key, run attempt, component, version identifiers, and a non-secret error code. Never include credentials, raw provider payloads, private destination identifiers, or user-level chain/social data in an alert.

## 8. Readiness checklist for a future execution task

A coordinator may move this design out of `PARK` only when all checks are evidenced in that task's run artifact:

- [ ] Owner supplied Dune authorization and approved secret-management location.
- [ ] Every saved query is allowlisted by ID, SQL hash, expected schema, metric mapping, and version.
- [ ] The concrete aggregate-only database target and access policy are approved.
- [ ] The 400-day aggregate/manifest/rendered-report retention and zero-day raw-payload policy are accepted.
- [ ] An Owner specified a test-only delivery destination and an alert destination.
- [ ] The D+1 14:00 UTC schedule, 5m/15m/60m retry policy, and idempotency storage method are implemented and tested in an authorized environment.
- [ ] Monitoring covers execution failure, insufficient coverage, delivery failure, and version drift.
- [ ] No BSC/Robinhood adapter was activated; Robinhood remains explicitly Uniswap v2/v3/v4 `partial_coverage` if rendered.
- [ ] Seven consecutive GREEN test-destination runs have been independently verified before any production-delivery expansion.

Until then, this design is a complete **preflight specification**, not permission to execute.