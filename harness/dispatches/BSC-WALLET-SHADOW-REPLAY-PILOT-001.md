# Dispatch: BSC-WALLET-SHADOW-REPLAY-PILOT-001

## Scope
Build the BSC-only offline replay adapter after BSC activation and verification. Cover fee-on-transfer, sell-blocked/honeypot evidence, router and multi-hop logs, BNB/WBNB, pool migration, decimals anomalies, tax uncertainty, and deterministic no-lookahead replay.

## Required reading
Read `PROJECT_REQUIRED_READING.md` in full before inspecting code. Follow the exact task spec: `harness/tasks/BSC-WALLET-SHADOW-REPLAY-PILOT-001.json`.

## Current status
`BLOCKED_STAGE`. Do not begin implementation unless the Harness lifecycle state is moved to `READY` by an authorized coordinator.

## Dependencies
- `BSC-STAGE-001`
- `WALLET-SHADOW-REPLAY-ENGINE-V0-1-001`
- `BSC-WALLET-CHAIN-VERIFICATION-PILOT-001`

## Write boundary
- `src/application/shadow-trading/bsc-adapter-v0-1.ts`
- `src/cli/run-bsc-wallet-shadow-replay-pilot.ts`
- `test/application/shadow-trading/bsc-adapter-v0-1.test.ts`
- `docs/bsc_shadow_replay_pilot_v0_1.md`
- `harness/reports/BSC-WALLET-SHADOW-REPLAY-PILOT-001/`
- `artifacts/bsc_shadow_replay_pilot_v0_1/`

## Required evidence
- Run the task acceptance commands.
- Run once against authorized private input and replay the same input deterministically where applicable.
- Produce `acceptance.md`, `desensitized_metrics.json`, `replay_manifest.json`, `source_hashes.json`, `deterministic_replay_result.json`, `test_evidence.md`, and `git_delivery_status.md` in the task report area.
- Keep all raw private data outside Git.
