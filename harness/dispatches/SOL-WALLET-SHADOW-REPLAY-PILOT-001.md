# Dispatch: SOL-WALLET-SHADOW-REPLAY-PILOT-001

## Scope
Build the Solana-only offline adapter and pilot on authorized historical local inputs: normalize/deduplicate events, price and liquidity as-of lookup, fee model, chain-specific unfillable rules, golden fixtures, negative cases, and deterministic replay evidence.

## Required reading
Read `PROJECT_REQUIRED_READING.md` in full before inspecting code. Follow the exact task spec: `harness/tasks/SOL-WALLET-SHADOW-REPLAY-PILOT-001.json`.

## Current status
`BLOCKED_DEPENDENCY`. Do not begin implementation unless the Harness lifecycle state is moved to `READY` by an authorized coordinator.

## Dependencies
- `WALLET-SHADOW-REPLAY-ENGINE-V0-1-001`
- `SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-002-AUDIT-001`

## Write boundary
- `src/application/shadow-trading/sol-adapter-v0-1.ts`
- `src/cli/run-sol-wallet-shadow-replay-pilot.ts`
- `test/application/shadow-trading/sol-adapter-v0-1.test.ts`
- `docs/sol_shadow_replay_pilot_v0_1.md`
- `harness/reports/SOL-WALLET-SHADOW-REPLAY-PILOT-001/`
- `artifacts/sol_shadow_replay_pilot_v0_1/`

## Required evidence
- Run the task acceptance commands.
- Run once against authorized private input and replay the same input deterministically where applicable.
- Produce `acceptance.md`, `desensitized_metrics.json`, `replay_manifest.json`, `source_hashes.json`, `deterministic_replay_result.json`, `test_evidence.md`, and `git_delivery_status.md` in the task report area.
- Keep all raw private data outside Git.
