# Dispatch: WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001

## Scope
Define offline, chain-neutral shadow-trade contracts and validation rules for normalized signals, order intents, fills, lots, exits, results, metrics, run manifests, and data-quality events. Enforce source_trade_at versus observed_at versus simulated_order_at semantics; do not implement chain parsing or execution.

## Required reading
Read `PROJECT_REQUIRED_READING.md` in full before inspecting code. Follow the exact task spec: `harness/tasks/WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001.json`.

## Current status
`BLOCKED_DEPENDENCY`. Do not begin implementation unless the Harness lifecycle state is moved to `READY` by an authorized coordinator.

## Dependencies
- `BSC-STAGE-001`

## Write boundary
- `src/domain/shadow-trading/contracts-v0-1.ts`
- `src/domain/shadow-trading/validation-v0-1.ts`
- `test/domain/shadow-trading/contracts-v0-1.test.ts`
- `docs/shadow_trade_contracts_v0_1.md`
- `harness/reports/WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001/`

## Required evidence
- Run the task acceptance commands.
- Run once against authorized private input and replay the same input deterministically where applicable.
- Produce `acceptance.md`, `desensitized_metrics.json`, `replay_manifest.json`, `source_hashes.json`, `deterministic_replay_result.json`, `test_evidence.md`, and `git_delivery_status.md` in the task report area.
- Keep all raw private data outside Git.
