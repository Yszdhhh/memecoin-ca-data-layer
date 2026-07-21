# MACRO-DAILY-DUNE-SAVED-QUERY-SMOKE-001

## Header

| Field | Value |
| --- | --- |
| `task_id` | `MACRO-DAILY-DUNE-SAVED-QUERY-SMOKE-001` |
| `tier` / `role` | `T3` / `coordinator` |
| `write_set` | `docs/runs/MACRO-DAILY-DUNE-SAVED-QUERY-SMOKE-001.md` only |
| `verdict` | **GREEN_WITH_ADVISORY** |

## Owner-Authorized Boundary

One private saved Dune query was created and executed. No dashboard,
visualization, PostgreSQL write, Hermes/Feishu delivery, schedule, adapter,
webhook, backfill, trading, signing, or execution capability was enabled.
Credential values were never read, printed, copied, or stored.

## Saved Query

| Field | Value |
| --- | --- |
| Blueprint | `G2_btc_tx_count` |
| Dune saved query ID | `8048804` |
| Privacy | private |
| SQL SHA-256 | `046EBB67CF8FDBFDA59BD327E385E9F2261784A770B622B18604FA802F978D49` |
| Query SQL scope | Completed-day BTC transaction count for `2026-07-19` only |

## Execution Result

| Field | Value |
| --- | --- |
| State | `QUERY_STATE_COMPLETED` |
| Submitted at | `2026-07-21T04:47:08.251124Z` |
| Started at | `2026-07-21T04:47:08.253269Z` |
| Ended at / source observation | `2026-07-21T04:47:08.516987Z` |
| Result row count | `1` |
| Report day | `2026-07-19` |
| `btc_transaction_count` | `769494` |
| Result checksum SHA-256 | `961F7C1825D9D2C37BB3619F9310F96B14BA0640ABEE6892621FA265EA27ABD4` |

## Advisory

The CLI's synchronous response contains the durable saved query ID and timing
metadata, but no separate execution ID field. A later collector may use the
CLI's asynchronous mode and execution-results API when a separately stored
execution ID is required. The recorded saved query ID, SQL hash, result checksum,
and execution timestamps are sufficient for this declared smoke scope.

## Commands

| Command | Result |
| --- | --- |
| task-spec validation | PASS |
| `dune query create --private` | PASS, query `8048804` |
| `dune query run 8048804 --output json` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 38/38 |

## Verdict

**GREEN_WITH_ADVISORY**. The project now has verified saved-query provenance
for the G2 BTC metric. No broader collector or delivery is implied by this
single-query smoke.
