# MACRO-DAILY-G2-QUERY-SQL-REPAIR-001

| Field | Value |
| --- | --- |
| Query ID | `8048804` |
| Verdict | **GREEN** |

## Repair

The saved query body was updated from a fixed-date smoke SQL to the collector's
audited rolling-day G2 SQL:

```sql
SELECT block_date AS report_day, tx_count AS btc_transaction_count
FROM metrics_bitcoin.transactions_daily
WHERE block_date = CURRENT_DATE - INTERVAL '2' DAY
```

| Field | Value |
| --- | --- |
| Before SQL SHA-256 | `046EBB67CF8FDBFDA59BD327E385E9F2261784A770B622B18604FA802F978D49` |
| After SQL SHA-256 | `1B63CB84FF80E6F52044C55B3F3C85B9D19D2876093C9FEC8919318396861E52` |
| Query creation | None; existing private query updated in place |
| PostgreSQL writes | None |
| Hermes sends | None |

## Dry-Run Verification

| Field | Value |
| --- | --- |
| State | `QUERY_STATE_COMPLETED` |
| Report day | `2026-07-19` |
| `btc_transaction_count` | `769494` |
| Source observation | `2026-07-21T06:56:59.141601Z` |

The saved query text now matches the SQL hash in the collector registry. The
next live collector run may safely reuse query `8048804` without creating or
updating another saved query.
