# MACRO-DAILY-TRADE-ACTIVITY-LIVE-013

| Field | Value |
| --- | --- |
| task_id | `MACRO-DAILY-TRADE-ACTIVITY-LIVE-013` |
| execution date | 2026-07-21 (Asia/Shanghai) |
| verdict | **PARK** |
| delivery | Not attempted |
| Dune execution | Not attempted |

## Result

The first live run stopped before Dune execution or CardKit delivery. Migration
`006_macro_trade_activity_metrics.sql` was run inside a PostgreSQL transaction
and failed because it referenced a metric-name CHECK constraint that does not
exist in the initialized local schema. The transaction was rolled back.

The observed schema names the existing metric-name CHECK
`macro_daily_chain_metrics_check`; migration 006 instead references
`macro_daily_chain_metrics_metric_name_check`. The existing section CHECK name
is valid. No database schema change persisted.

## Boundaries

- No Dune query, saved-query creation/update, or raw SQL execution occurred.
- No Feishu, Hermes, Lark, or CardKit operation occurred.
- No credential, connection URL, target ID, raw provider payload, or database
  row was retained in this report.

## Required remediation

Repair and independently re-audit migration 006 against the actual initialized
constraint name, then repeat this task from the migration step.
