# Dispatch: CROSSCHAIN-WALLET-HUD-V0-3-001

## Scope
After all declared prerequisites are independently GREEN and there is a valid shadow-event batch, extend the local HUD to display chain-separated behavior scene, scene strength, evidence confidence, followability, current state, and risk overlays. Preserve SOL/BSC metric separation and unknown identity boundaries.

## Required reading
Read `PROJECT_REQUIRED_READING.md` in full before inspecting code. Follow the exact task spec: `harness/tasks/CROSSCHAIN-WALLET-HUD-V0-3-001.json`.

## Current status
`PARK`. Do not begin implementation unless the Harness lifecycle state is moved to `READY` by an authorized coordinator.

## Dependencies
- `SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-002-AUDIT-001`
- `BSC-WALLET-CHAIN-VERIFICATION-PILOT-001`
- `WALLET-SHADOW-REPLAY-ENGINE-V0-1-001`
- `WALLET-SHADOW-LIVE-OBSERVATION-PILOT-001`

## Write boundary
- `src/application/wallet-intelligence/crosschain-hud-v0-3.ts`
- `src/cli/run-crosschain-wallet-hud-v0-3.ts`
- `test/application/wallet-intelligence/crosschain-hud-v0-3.test.ts`
- `docs/crosschain_wallet_hud_v0_3.md`
- `harness/reports/CROSSCHAIN-WALLET-HUD-V0-3-001/`
- `artifacts/crosschain_wallet_hud_v0_3/`

## Required evidence
- Run the task acceptance commands.
- Run once against authorized private input and replay the same input deterministically where applicable.
- Produce `acceptance.md`, `desensitized_metrics.json`, `replay_manifest.json`, `source_hashes.json`, `deterministic_replay_result.json`, `test_evidence.md`, and `git_delivery_status.md` in the task report area.
- Keep all raw private data outside Git.
