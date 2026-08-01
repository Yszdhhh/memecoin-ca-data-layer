# Dispatch: SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-001-REPAIR-002

## Scope
Repair the existing PR #15 implementation without rebuilding it: prevent activity-strength collapse, enforce defensible reproduction thresholds, maintain last-emitted GMGN baseline and cumulative-delta debounce, retain append-only history, persist source snapshot hashes, and synchronize acceptance evidence.

## Required reading
Read `PROJECT_REQUIRED_READING.md` in full before inspecting code. Follow the exact task spec: `harness/tasks/SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-001-REPAIR-002.json`.

## Current status
`BLOCKED_DEPENDENCY`. This task is blocked until the governance task is accepted and the Owner merges the governance PR using a merge commit. The unregistered historical PR #15 task remains an explicit input/precondition, not a ledger dependency.

## Dependencies
- `CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1-001`

## Write boundary
- `src/application/wallet-intelligence/hud-v0-2.ts`
- `src/cli/run-sol-wallet-hud-v0-2.ts`
- `test/application/wallet-intelligence/hud-v0-2.test.ts`
- `docs/hud_v0_2_methodology.md`
- `artifacts/wallet_hud_v0_2/`
- `harness/reports/SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-001-REPAIR-002/`

## Required evidence
- Run the task acceptance commands.
- Run once against authorized private input and replay the same input deterministically where applicable.
- Produce acceptance, desensitized metrics, replay manifest, source-hash evidence, security result, and Git delivery status.
- Keep all raw private data outside Git.
