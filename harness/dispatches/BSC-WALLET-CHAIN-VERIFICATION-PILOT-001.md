# Dispatch: BSC-WALLET-CHAIN-VERIFICATION-PILOT-001

## Scope
Select a representative 5–10 address BSC candidate pilot and validate only sampled chain evidence. Report swaps/transfers, cost basis, fees/taxes, concentration, repeatability, timing, exit-copy feasibility, address-type and cluster risks with sample-level scopes.

## Required reading
Read `PROJECT_REQUIRED_READING.md` in full before inspecting code. Follow the exact task spec: `harness/tasks/BSC-WALLET-CHAIN-VERIFICATION-PILOT-001.json`.

## Current status
`BLOCKED_STAGE`. Do not begin implementation unless the Harness lifecycle state is moved to `READY` by an authorized coordinator.

## Dependencies
- `BSC-STAGE-001`
- `BSC-WALLET-CANDIDATE-SCREENING-V0-1-001`

## Write boundary
- `src/application/wallet-intelligence/bsc-chain-verification-pilot.ts`
- `src/cli/run-bsc-wallet-chain-verification-pilot.ts`
- `test/application/wallet-intelligence/bsc-chain-verification-pilot.test.ts`
- `docs/bsc_chain_verification_pilot.md`
- `harness/reports/BSC-WALLET-CHAIN-VERIFICATION-PILOT-001/`
- `artifacts/bsc_wallet_chain_verification_pilot/`

## Required evidence
- Run the task acceptance commands.
- Run once against authorized private input and replay the same input deterministically where applicable.
- Produce `acceptance.md`, `desensitized_metrics.json`, `replay_manifest.json`, `source_hashes.json`, `deterministic_replay_result.json`, `test_evidence.md`, and `git_delivery_status.md` in the task report area.
- Keep all raw private data outside Git.
