# Dispatch: BSC-WALLET-CANDIDATE-SCREENING-V0-1-001

## Scope
Profile the BSC master first, then create evidence-scoped BSC scene eligibility and candidate research packs. Keep behavior signals, risk overlays, evidence confidence, and unknowns separate; do not copy Solana thresholds or issue smart-money/follow/heavy-position labels.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/BSC-WALLET-CANDIDATE-SCREENING-V0-1-001.json`.

## Current status
`BLOCKED_STAGE`. BLOCKED_STAGE. Do not start until the offline-stage activation audit is GREEN, its implementation PR is Owner-merged with a merge commit, and the ledger lifecycle is authorized to READY.

## Dependencies
- `BSC-WALLET-MASTER-CLEAN-RANK-V0-1-001-AUDIT-001`

## Write boundary
- `src/application/wallet-intelligence/bsc-candidate-screening-v0-1.ts`
- `src/cli/run-bsc-wallet-candidate-screening-v0-1.ts`
- `test/application/wallet-intelligence/bsc-candidate-screening-v0-1.test.ts`
- `docs/bsc_candidate_screening_v0_1.md`
- `harness/reports/BSC-WALLET-CANDIDATE-SCREENING-V0-1-001/`
- `artifacts/bsc_wallet_candidates_v0_1/`

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
