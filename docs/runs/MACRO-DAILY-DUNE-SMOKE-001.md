# MACRO-DAILY-DUNE-SMOKE-001

## Header

| Field | Value |
| --- | --- |
| `task_id` | `MACRO-DAILY-DUNE-SMOKE-001` |
| `tier` / `role` | `T3` / `coordinator` |
| `write_set` | `docs/runs/MACRO-DAILY-DUNE-SMOKE-001.md` only |
| `verdict` | **GREEN_WITH_ADVISORY** |

## Owner-Authorized Boundary

This task used the existing Dune CLI credential without reading, printing,
copying, or persisting its value. It used only `dune query run-sql`; no saved
Dune query/dashboard was created, updated, archived, or shared.

No PostgreSQL write, Hermes/Feishu message, schedule, payload retention, CA
adapter, collector, webhook, backfill, trading, signing, or execution
capability was enabled.

## Executions

### Smoke

| Field | Value |
| --- | --- |
| SQL | `SELECT 1 AS smoke_ok` |
| SQL SHA-256 | `C88DA72B9E5C8B64EF9ECE0DB8951B3FFC7B812C62B771025A70850FF4AFC453` |
| State | `QUERY_STATE_COMPLETED` |
| Submitted at | `2026-07-21T04:39:52.854421Z` |
| Ended at / source observation | `2026-07-21T04:39:53.128355Z` |
| Returned query ID | `0` (inline SQL, not a saved query) |
| Row count | `1` |
| Result checksum SHA-256 | `62429608DF5D0D2FCB8F62FA1BF20C826B2F241B5EC09DD6932927E3FA605960` |

### G2 BTC Transaction Count

| Field | Value |
| --- | --- |
| Blueprint | `G2_btc_tx_count` |
| SQL SHA-256 | `046EBB67CF8FDBFDA59BD327E385E9F2261784A770B622B18604FA802F978D49` |
| State | `QUERY_STATE_COMPLETED` |
| Submitted at | `2026-07-21T04:40:54.114135Z` |
| Ended at / source observation | `2026-07-21T04:40:54.499149Z` |
| Returned query ID | `0` (inline SQL, not a saved query) |
| Result row count | `1` |
| Report day | `2026-07-19` |
| `btc_transaction_count` | `769494` |
| Result checksum SHA-256 | `961F7C1825D9D2C37BB3619F9310F96B14BA0640ABEE6892621FA265EA27ABD4` |
| Warnings | `inline_query_no_saved_query_id`, `single_metric_smoke_only` |

## Command Evidence

| Command | Result |
| --- | --- |
| `npm run harness:task -- validate harness/tasks/MACRO-DAILY-DUNE-SMOKE-001.json` | PASS |
| `dune query run-sql --sql "SELECT 1 AS smoke_ok" --output json` | PASS |
| completed-day G2 BTC blueprint via `dune query run-sql` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 38/38 |

## Advisory and Next Gate

The inline Dune API response uses `query_id=0`; it does not expose a durable
saved-query identity. This is sufficient to verify authentication, execution
state, result metadata, and the completed-day BTC metric path, but it is not
sufficient for the production provenance contract.

The next T3 implementation must create private saved queries for only the
approved blueprints, store the real query ID plus SQL hash and execution
metadata, write daily aggregates to the isolated PostgreSQL database, render
the brief, and require a separate audit before the first Hermes delivery.

## Verdict

**GREEN_WITH_ADVISORY**. Dune execution and the BTC daily metric are verified
for the declared smoke scope. Production collection remains blocked on saved
query identities and the collector implementation.
