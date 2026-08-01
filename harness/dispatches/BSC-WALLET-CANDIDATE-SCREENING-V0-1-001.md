# Dispatch: BSC-WALLET-CANDIDATE-SCREENING-V0-1-001

## Scope
Profile the BSC master first, then create evidence-scoped BSC scene eligibility and candidate research packs. Keep behavior signals, risk overlays, evidence confidence, and unknowns separate; do not copy Solana thresholds or issue smart-money/follow/heavy-position labels.

## Required reading
Read `PROJECT_REQUIRED_READING.md` in full before inspecting code. Follow the exact task spec: `harness/tasks/BSC-WALLET-CANDIDATE-SCREENING-V0-1-001.json`.

## Current status
`BLOCKED_STAGE`. Do not begin implementation unless the Harness lifecycle state is moved to `READY` by an authorized coordinator.

## Dependencies
- `BSC-STAGE-001`
- `BSC-WALLET-MASTER-CLEAN-RANK-V0-1-001`

## Write boundary
- `src/application/wallet-intelligence/bsc-candidate-screening-v0-1.ts`
- `src/cli/run-bsc-wallet-candidate-screening-v0-1.ts`
- `test/application/wallet-intelligence/bsc-candidate-screening-v0-1.test.ts`
- `docs/bsc_candidate_screening_v0_1.md`
- `harness/reports/BSC-WALLET-CANDIDATE-SCREENING-V0-1-001/`
- `artifacts/bsc_wallet_candidates_v0_1/`

## Required evidence
- Run the task acceptance commands.
- Run once against authorized private input and replay the same input deterministically where applicable.
- Produce `acceptance.md`, `desensitized_metrics.json`, `replay_manifest.json`, `source_hashes.json`, `deterministic_replay_result.json`, `test_evidence.md`, and `git_delivery_status.md` in the task report area.
- Keep all raw private data outside Git.
