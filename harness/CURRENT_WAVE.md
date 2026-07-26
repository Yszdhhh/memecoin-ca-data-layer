# Current wave

## Goal

Reach reproducible Solana/Pump.fun end-to-end CA analysis before any BSC or
Robinhood implementation. The final CA result must compose audited creator,
holder and Dev facts rather than bypassing their completeness gates.

## Completed in this wave

- `HARNESS-CA-WAVE-002`: recorded the 2026-07-21 external CA review as bounded
  implementation, audit and security-containment tasks. It introduced no
  business-code or external-provider change.

## CA sequence — all offline implementation + independent audits COMPLETE

1. `SOL-CA-ORCHESTRATION-001` — DONE (run `20260726_SOL_CA_ORCHESTRATION_001` GREEN).
2. `SOL-CA-ORCHESTRATION-AUDIT-001` — DONE with **FAIL**; report at
   `docs/audits/SOL-CA-ORCHESTRATION-AUDIT-001.md`.
3. `SOL-CA-ORCHESTRATION-REPAIR-001` — DONE (run `20260726_SOL_CA_ORCH_REPAIR_001` GREEN).
4. `SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001` — DONE **GREEN_WITH_ADVISORY** (run
   `20260726_SOL_CA_ORCH_REPAIR_AUDIT_001`); FIND-1/2/3 closed, no gate weakened.
5. `SOL-WALLET-CLEANING-003` — DONE (service-funder suppression + evidence).
6. `SOL-WALLET-CLEANING-AUDIT-003` — DONE **GREEN_WITH_ADVISORY**; FIND-1 (funder
   tags not fetched for non-holder funders) → repair `SOL-WALLET-CLEANING-FUNDER-TAGS-001` READY.
7. `SOL-HOLDER-EXCLUSION-INPUT-001` (CA FIND-4 two-pass alignment) — DONE;
   `SOL-HOLDER-EXCLUSION-INPUT-AUDIT-001` DONE **GREEN_WITH_ADVISORY**.
8. `SOL-MARKET-OBSERVATION-001` (offline `market-select-v1`, migration
   `007_market_observations.sql`) — DONE; `SOL-MARKET-OBSERVATION-AUDIT-001`
   DONE **GREEN_WITH_ADVISORY**.
9. `SOL-E2E-001`: fixture + Owner-authorized live CA acceptance — still PARK,
   awaiting credential containment and Owner gates.

## Harness automation sequence

1. `HARNESS-AO-AUTOMATION-001` — offline lifecycle planner/verifier — DONE.
2. `HARNESS-AO-AUTOMATION-AUDIT-001` — DONE with **FAIL**: the audit-evidence
   gate enforces nothing, no agent-id independence check, evidence from
   git-ignored unvalidated manifests, FAIL verdict counts as satisfied.
   Governance held via **manual** harness discipline (apply-readiness was never
   used to auto-flip state). Report at `docs/audits/HARNESS-AO-AUTOMATION-AUDIT-001.md`.
3. `HARNESS-AO-AUTOMATION-REPAIR-001` — READY (fix the four P1 gaps);
   `HARNESS-AO-AUTOMATION-REPAIR-AUDIT-001` — BLOCKED_DEPENDENCY.

## Next wave — Owner-confirmed direction; see harness/DISPATCH_PLAN.md

The project direction (hybrid borrowed + first-hand data, instant CA analysis)
is confirmed and the all-free data stack is decided (`OWNER_DECISIONS_NEEDED.md`
items 8–12). **`harness/DISPATCH_PLAN.md` is now the single source of truth** for
the task breakdown (Waves A–E), per-task implementation approach, acceptance
criteria (incl. the four harness dimensions), collaboration mechanism, and the
handoff procedure. Binding architecture is in `PROJECT_ARCHITECTURE.md`; method
detail in `docs/METHODS_ALPHA_SCORE_AND_DETECTORS.md`.

Phase 0 repair debt is DONE (harness governance repair + funder-tag repair, both
GREEN, funder-tag audit in flight). Dispatchable now (offline, no live access):
`SOL-OBSERVATION-SCHEMA-001`, `SOL-HARNESS-SUITES-001` (READY), then
`SOL-ALPHA-SCORE-001` → `SOL-DETECTORS-001`, and Wave B adapters. The daily/weekly
top-token address-mining growth loop is authored as
`SOL-DAILY-TOPTOKEN-MINING-001` (offline pipeline; live trigger Owner-gated D-F).
All live flips (Wave E) stay PARK until Owner items 1–4 open.

## Ready for dispatch

- `SOL-HOLDER-001`: Solana holder snapshot integration.
- `SOL-HOLDER-SNAPSHOT-REPAIR-AUDIT-001`: Independent audit of Solana holder
  snapshot consistency remediation — verifies boundary and duplicate-account
  findings are closed without weakening owner aggregation or exclusion evidence.
- `SOL-DEV-001`: Solana creator and Dev history integration.
- `SOL-DEV-REPAIR-AUDIT-001`: Independent audit of Solana Dev provenance remediation.
- `SOL-MARKET-DATA-DESIGN-001`: Solana-only market-data provenance and conflict
  contract design; it does not implement or call external providers.

## Completed in this wave

- `MACRO-DUNE-QUERY-PROVENANCE-001`, `MACRO-DAILY-OFFLINE-001`, and
  `MACRO-DAILY-BRIEF-RENDERER-001` plus their independent audits are accepted.
  The project now has SHA-pinned but unexecuted query blueprints, an offline
  provenance-preserving data contract, and a Chinese Markdown daily-brief
  renderer. Real Dune execution, database deployment, scheduling, and Feishu
  delivery remain Owner-gated.

- `SOL-INGEST-001`: implementation and independent audit accepted. The audit is
  `GREEN_WITH_ADVISORY`: add a very-large-raw-integer fixture in a follow-up, and
  export collected source watermarks into later E2E manifests.
- `SOL-PUMP-PROVENANCE-001`: official IDL provenance plus finalized,
  hash-pinned `create_v2`, `buy`, `sell`, and `migrate` fixtures accepted.
- `SOL-PUMP-001`: decoder implementation, fixture replay, typecheck, tests, and
  build passed; it is accepted after the final independent retrieval audit.
- `SOL-PUMP-AUDIT-001`: completed with FAIL. The original report is retained at
  `docs/audits/SOL-PUMP-AUDIT-001.md`; its findings require a repaired decoder
  and a new independent audit before acceptance.
- `SOL-PUMP-REPAIR-001`: added typed RPC retrieval provenance and exact account
  count/program-position validation with boundary tests; its first re-audit
  identified the remaining runtime retrieval-validation gap.
- `SOL-PUMP-REPAIR-AUDIT-001`: completed with FAIL. Exact account-layout
  validation passed, but runtime validation still allowed invalid retrieval
  watermarks to produce decoded results.
- `SOL-PUMP-RETRIEVAL-REPAIR-001`: runtime retrieval validation now fails closed
  with null-safe raw provenance; final audit passed.
- `SOL-PUMP-RETRIEVAL-AUDIT-001`: completed GREEN. The Pump decoder contract is
  accepted for downstream Holder and Dev work after independent fixture-hash,
  provenance, exact-layout and runtime-boundary verification.

## Waiting

- `MACRO-DAILY-LIVE-PREFLIGHT-001`: Dune and Hermes capabilities are present,
  but the current process lacks `DATABASE_URL` and no Hermes Feishu destination
  has been approved. No Dune query, database write, or message was sent.

- `SOL-E2E-001`: waits for Holder and Dev slices plus Owner-approved live CA/provider.
- `BSC-STAGE-001`: blocked until Solana E2E GREEN and Owner activation.
- `ROBIN-STAGE-001`: blocked until the later BSC gate and Owner activation.
