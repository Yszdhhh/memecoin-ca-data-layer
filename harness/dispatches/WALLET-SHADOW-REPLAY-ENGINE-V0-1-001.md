# Dispatch: WALLET-SHADOW-REPLAY-ENGINE-V0-1-001

## Scope
Implement a deterministic offline replay engine using the approved contracts. Support fixed USD nominal entries, mirror exits, 5m/30m/2h/24h windows, fee/slippage/liquidity/tax-aware fill outcomes, no-lookahead price selection, and evidence-bounded followability conclusions.

## Required reading
Read `PROJECT_REQUIRED_READING.md` in full before inspecting code. Follow the exact task spec: `harness/tasks/WALLET-SHADOW-REPLAY-ENGINE-V0-1-001.json`.

## Current status
`BLOCKED_DEPENDENCY`. Do not begin implementation unless the Harness lifecycle state is moved to `READY` by an authorized coordinator.

## Dependencies
- `WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001`

## Write boundary
- `src/application/shadow-trading/replay-engine-v0-1.ts`
- `src/application/shadow-trading/metrics-v0-1.ts`
- `test/application/shadow-trading/replay-engine-v0-1.test.ts`
- `docs/shadow_replay_engine_v0_1.md`
- `harness/reports/WALLET-SHADOW-REPLAY-ENGINE-V0-1-001/`

## Required evidence
- Run the task acceptance commands.
- Run once against authorized private input and replay the same input deterministically where applicable.
- Produce `acceptance.md`, `desensitized_metrics.json`, `replay_manifest.json`, `source_hashes.json`, `deterministic_replay_result.json`, `test_evidence.md`, and `git_delivery_status.md` in the task report area.
- Keep all raw private data outside Git.
