# MACRO-DAILY-POSTGRES-BOOTSTRAP-001

## Header

| Field | Value |
| --- | --- |
| `task_id` | `MACRO-DAILY-POSTGRES-BOOTSTRAP-001` |
| `tier` / `role` | `T3` / `coordinator` |
| `write_set` | `docs/runs/MACRO-DAILY-POSTGRES-BOOTSTRAP-001.md` only |
| `verdict` | **GREEN** |

## Owner-Authorized Scope

The Owner authorized creation of a local PostgreSQL target after the current
process had no `DATABASE_URL`. This task created a dedicated project database;
it did not inspect, alter, connect to, or reuse the existing `quantdinger-db`
container on port 5432.

No Dune query was created or executed. No Hermes/Feishu message was sent. No
CA adapter, collector, webhook, backfill, trading, signing, or execution
capability was enabled.

## Isolated Runtime

| Item | Result |
| --- | --- |
| Container | `onchain-trench-postgres` |
| Image | `postgres:16-alpine` |
| Network binding | `127.0.0.1:5433` only |
| Database | `onchain_trench` |
| Volume | `onchain-trench-postgres-data` |
| Restart policy | `unless-stopped` |
| Credential handling | Random password generated at runtime; value not printed, stored in the repository, or recorded here |
| Connection configuration | `DATABASE_URL` persisted to the current Windows user's environment; value intentionally omitted |

## Migration Evidence

| Migration | Result |
| --- | --- |
| `db/migrations/001_initial.sql` | Applied successfully |
| `db/migrations/002_macro_daily_metrics.sql` | Applied successfully |
| `macro_daily_global_metrics` | Present |
| `macro_daily_chain_metrics` | Present |
| `macro_hourly_chain_profile` | Present |

The database passed `pg_isready`. A read-only `information_schema.tables`
query through the user-scoped `DATABASE_URL` confirmed all three macro tables.

## Commands

| Command | Result |
| --- | --- |
| `npm run harness:task -- validate harness/tasks/MACRO-DAILY-POSTGRES-BOOTSTRAP-001.json` | PASS |
| `docker exec onchain-trench-postgres pg_isready -U onchain_trench -d onchain_trench` | PASS |
| apply migration `001_initial.sql` | PASS |
| apply migration `002_macro_daily_metrics.sql` | PASS |
| read-only schema verification | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 38/38 |

## Recovery Note

An initial container launch failed before readiness because the local PowerShell
runtime lacked a newer random-byte API. That newly-created failed container and
its dedicated empty volume were verified and removed before the successful
bootstrap. No migration had run against the failed instance, and no unrelated
container or volume was touched.

## Verdict

**GREEN**. The project now has an isolated local PostgreSQL target with the
approved additive schema. A future session must inherit the user-scoped
`DATABASE_URL` or explicitly load it from the user environment without printing
the value.
