# Current wave

## Objective

Complete the Solana/Pump.fun CA-analysis path offline before opening any live
provider or multichain gate. Borrowed data may accelerate the first screen, but
it must remain unverified until first-hand evidence confirms it.

## Status as of 2026-07-27

| Workstream | Status | Notes |
| --- | --- | --- |
| Wave A: observation schema, four harness suites, Alpha Score, detectors | DONE | Offline deterministic acceptance complete. |
| Wave B: Helius/Pump fixture adapters and address-library sedimentation | DONE, AUDITED GREEN_WITH_ADVISORY | Offline trust boundaries and fixture behavior passed independent re-audit. No live HTTP. |
| Wave C: free borrowed layer and CA first-screen hotpath | DONE, AUDITED GREEN_WITH_ADVISORY | Deep-dive is queued into `AnalysisService`; borrowed fields remain unverified. |
| Wave D: token-profit leaderboard and daily/weekly address-mining loop | DONE, AUDITED GREEN_WITH_ADVISORY | Fixture-only pipeline, explicit first-hand quota, verified-only promotion. |
| Harness audit-evidence enforcement repair | DONE, AUDITED GREEN | Auditor completion requires valid independent passing run evidence. |
| Harness historical-run verification repair | DONE, AUDITED GREEN | Completed run verification is read-only and checks recorded outputs/logs fail-closed. |
| Durable PostgreSQL address-library adapter | DONE, AUDITED GREEN | Offline-only adapter and database trust constraints independently accepted; no database has been connected or deployed. |
| Durable PostgreSQL growth-loop report storage | DONE, AUDIT PENDING | Offline-only run summaries are ready for independent review; no database, Redis, scheduler, or live provider has been connected. |
| Live Helius / real-CA E2E (`SOL-E2E-001`) | PARK | Requires Owner live-gate approval and contained credentials. |
| BSC (`BSC-STAGE-001`) | BLOCKED_STAGE | Remains blocked until Solana E2E is GREEN and Owner activates it. |

## Independent audit queue

No current-wave independent audit is pending. Wave B/C, Wave D, the Harness
evidence repairs, and the durable PostgreSQL address-library adapter have valid
independent audit records.

## Owner decisions already applied

- Current Wave B/C/D work is fixture/offline only.
- Codex will select public Solana CA samples when the live E2E gate opens.
- Raw payload retention is 7 days.
- Structured observations, evidence indexes, and cleaned replay artifacts are
  retained long term.
- BSC stays inactive.

## Next execution order after independent audit

1. Close any findings from the three audits above.
2. Add durable Postgres/Redis-backed address-library and growth-loop storage.
3. Add an offline scheduler/runner around the daily and weekly mining jobs.
4. Only after explicit Owner approval, open a rate-limited read-only Helius
   smoke gate and prepare `SOL-E2E-001` public-CA acceptance.
5. Keep BSC and other chains blocked until Solana E2E is GREEN.

## Current blockers

There is no Owner blocker for continued offline work. Live credentials, live CA
execution, and BSC activation remain intentionally parked.
