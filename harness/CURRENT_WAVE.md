# Current wave

## Objective

Execute GOAL_EXECUTION_BLUEPRINT_V1 offline slices through G0–G8 pure/access
layers. Live Helius smoke and paid provider budgets remain Owner-gated.

## Status as of 2026-07-31 (goal execution)

| Workstream | Status | Notes |
| --- | --- | --- |
| M0 CA cleaning pilot | DONE / MERGED | Do **not** re-run |
| OPERATOR-CONSOLE-SHELL-001 | DONE / GREEN / MERGED | `5cc414c` |
| SOL-CA-HOLDER-HOTPATH-INTEGRATION-001 | OFFLINE GREEN / LIVE BLOCKED | Feature branch; no `HELIUS_API_KEY` |
| GOAL-ENTRY-GATE-001 | DONE | M0 not re-run |
| ARCH-CONSOLE-CLARIFICATION-001 | DONE | Access-layer clarification landed |
| G1 HTTP wiring + observability + budget executor | DONE (offline) | Console can target local API |
| G2 composer / market / authority / pool | DONE (pure + fixtures) | Live market optional public DexScreener |
| G3 local address store + import CLI | DONE (local file store) | PG optional; no bulk Git |
| G4 job queue + schedules + provider budget | DONE (process-local MVP) | Full-market schedule forbidden |
| G5 wallet ledger + PnL fail-closed | DONE (pure) | Live history Owner-gated |
| G6 cluster / judgment / early buyers | DONE (pure) | Live graph history Owner-gated |
| G7 liquidity metrics + brief | DONE (pure) | Live Dune Owner-gated |
| G8 security scan + local runbook + as-of replay | PARTIAL offline | Full CI deploy / alert channels Owner |

## ACTIVE

```text
Owner adjudication package for remaining Live/credential/PG-production items
```

## PARKED / OWNER-GATED

* Live Helius CA stability batches (≤30 CA) — needs `HELIUS_API_KEY` + budget
* Live wallet history 3–5 shortlist — needs Helius history budget
* Production PostgreSQL deploy + durable SKIP LOCKED worker fleet
* Dune live liquidity pipeline credentials
* Watchlist push notifications (external channels)
* Full 1433 re-scrape / cumulative PnL (still forbidden)
* Trading / signing / new chains

## Authority docs

| Doc | Path |
| --- | --- |
| Blueprint | `docs/blueprints/GOAL_EXECUTION_BLUEPRINT_V1.md` |
| Console access layer | `docs/architecture/OPERATOR_CONSOLE_ACCESS_LAYER_CLARIFICATION.md` |
| Local release | `docs/runbooks/LOCAL_RELEASE_V1.md` |
| CA Holder API | `docs/contracts/OPERATOR_CA_HOLDER_API_V1.md` |
| System status | `docs/handoffs/STATUS_SYSTEM_20260730.md` |
