# Current wave

## Objective

Complete the Solana/Pump.fun CA-analysis path offline before opening any live
provider or multichain gate. Borrowed data may accelerate the first screen, but
it must remain unverified until first-hand evidence confirms it.

## Status as of 2026-07-28

| Workstream | Status | Notes |
| --- | --- | --- |
| Wave A: observation schema, four harness suites, Alpha Score, detectors | DONE | Offline deterministic acceptance complete. |
| Wave B: Helius/Pump fixture adapters and address-library sedimentation | DONE, AUDITED GREEN_WITH_ADVISORY | Offline trust boundaries and fixture behavior passed independent re-audit. No live HTTP. |
| Wave C: free borrowed layer and CA first-screen hotpath | DONE, AUDITED GREEN_WITH_ADVISORY | Deep-dive is queued into `AnalysisService`; borrowed fields remain unverified. |
| Wave D: token-profit leaderboard and daily/weekly address-mining loop | DONE, AUDITED GREEN_WITH_ADVISORY | Fixture-only pipeline, explicit first-hand quota, verified-only promotion. |
| Harness audit-evidence enforcement repair | DONE, AUDITED GREEN | Auditor completion requires valid independent passing run evidence. |
| Harness historical-run verification repair | DONE, AUDITED GREEN | Completed run verification is read-only and checks recorded outputs/logs fail-closed. |
| Durable PostgreSQL address-library adapter | DONE, AUDITED GREEN | Offline-only adapter and database trust constraints independently accepted; no database has been connected or deployed. |
| Durable PostgreSQL growth-loop report storage | DONE, AUDITED GREEN | Offline-only run summaries independently accepted; no database, Redis, scheduler, or live provider has been connected. |
| Manual/offline daily and weekly mining runner | DONE, AUDITED GREEN | Base scheduler and the robustness follow-up are independently accepted. No cron, timer, background worker, or live trigger is active. |
| Limited read-only Helius source + public-CA smoke | DONE, GREEN | Owner-authorized, Solana-only, Helius-only, runtime-key-only smoke passed. Raw payloads and credential-bearing URLs were not retained. |
| Manual CA-first single lookup | DONE, AUDITED GREEN | Bounded mint, metadata and token-account summary only. No AnalysisService, persistence, queue, cache or discovery path. |
| Manual 1–10 CA batch | DONE, AUDITED GREEN | Operator-supplied distinct CAs only; manual trigger, sequential bounded sources, no discovery or storage. |
| Full Pump/creator/Dev/address-library live E2E (`SOL-E2E-001`) | PARK | The bounded Helius smoke is not the constitution-level full Solana E2E gate. |
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
- The current live runtime uses Helius only; no provider or fallback may be
  added without a new Owner decision.
- Daily attention is limited to 5–10 manually selected CAs. Selection and
  execution remain manual; no automatic discovery or schedule is active.
- BSC stays inactive.

## Next execution gate

The limited live Helius gate is open only for explicit, manually dispatched
Solana CA-first work. The next permitted work is boundary hardening and
published-evidence repair under exact task specs. A manual 5–10 CA test may run
only after those repairs are independently GREEN and a runtime credential is
available. Keep automation, persistence, additional providers, BSC and other
chains blocked.

## Current blockers

No ordinary technical decision is blocking the limited CA-first repairs.
Full Pump/creator/Dev live analysis, automatic daily discovery, production
persistence, additional providers and future-chain activation remain outside
the current gate.
