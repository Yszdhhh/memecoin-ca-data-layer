# Current wave

## Objective

Offline G0–G8 product surfaces are wired through Operator API + Console.
Remaining work is **Owner-gated Live / infra / release only**.

## Status as of 2026-07-31

| Workstream | Status | Notes |
| --- | --- | --- |
| M0 | DONE / MERGED | Do not re-run |
| OPERATOR-CONSOLE-SHELL-001 | DONE / MERGED | fixtures |
| SOL-CA-HOLDER-HOTPATH offline | GREEN | Live smoke blocked (no HELIUS) |
| Offline product backend | DONE | addresses, wallets, CA compose, liquidity pure, jobs, cross-CA, replay |
| Console HTTP wiring | DONE | VITE_OPERATOR_API_BASE |
| Security scan | GREEN | scripts/security-retention-scan.mjs |

## ACTIVE (Owner only)

```text
Provide HELIUS_API_KEY for Live smoke / stability / wallet history
Optional: PostgreSQL production store, Dune credentials, v1.0 tag/merge
```

## PARKED / FORBIDDEN

* Full 1433 re-scrape
* Full cumulative PnL before shortlist Live proof
* Trading / signing / new chains / full-market scan

## Authority

| Doc | Path |
| --- | --- |
| Blueprint | `docs/blueprints/GOAL_EXECUTION_BLUEPRINT_V1.md` |
| Local release | `docs/runbooks/LOCAL_RELEASE_V1.md` |
| Owner package | implementer scratch `owner-adjudication.md` |
