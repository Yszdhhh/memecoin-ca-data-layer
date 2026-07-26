# Current wave

## Goal

Reach reproducible Solana/Pump.fun end-to-end CA analysis before any BSC or
Robinhood implementation. The final CA result must compose audited creator,
holder and Dev facts rather than bypassing their completeness gates.

## Completed in this wave

- `HARNESS-CA-WAVE-002`: recorded the 2026-07-21 external CA review as bounded
  implementation, audit and security-containment tasks. It introduced no
  business-code or external-provider change.

## Next CA sequence

1. `SOL-CA-ORCHESTRATION-001` — DONE (run `20260726_SOL_CA_ORCHESTRATION_001` GREEN).
2. `SOL-CA-ORCHESTRATION-AUDIT-001` — DONE with **FAIL** (run
   `20260726_SOL_CA_ORCH_AUDIT_001`); report at
   `docs/audits/SOL-CA-ORCHESTRATION-AUDIT-001.md`.
3. `SOL-CA-ORCHESTRATION-REPAIR-001` — DONE (run `20260726_SOL_CA_ORCH_REPAIR_001` GREEN).
4. `SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001` — **evening audit queue**.
5. `SOL-WALLET-CLEANING-003` — implementer wave (service-funder suppression +
   `walletCleaningEvidence` on CA result). Independent audit deferred to evening.
6. `SOL-WALLET-CLEANING-AUDIT-003` — **evening audit queue**.
7. `SOL-E2E-GAP-RESEARCH-002` — research refreshed for post-orchestration reality.
8. `SOL-E2E-001`: fixture plus Owner-authorized live CA acceptance only after
   the above audits and credential containment are complete.

## Harness automation sequence

1. `HARNESS-AO-AUTOMATION-001` — offline lifecycle planner/verifier
   (`lifecycle plan|verify|apply-readiness`); implementer wave.
2. `HARNESS-AO-AUTOMATION-AUDIT-001` — **evening audit queue**.
3. Agent Orchestrator may consume the verified planner output to dispatch
   isolated workers, but network, credentials, and all live provider choices
   remain outside the Harness and behind their existing Owner gates.

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
