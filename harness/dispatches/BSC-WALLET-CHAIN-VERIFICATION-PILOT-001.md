# Dispatch: BSC-WALLET-CHAIN-VERIFICATION-PILOT-001

## Scope
Select a representative 5–10 address BSC candidate pilot and validate only sampled chain evidence. Report swaps/transfers, cost basis, fees/taxes, concentration, repeatability, timing, exit-copy feasibility, address-type and cluster risks with sample-level scopes.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/BSC-WALLET-CHAIN-VERIFICATION-PILOT-001.json`.

## Current status
`BLOCKED_STAGE`. BLOCKED_STAGE. Do not start until the offline-stage activation audit is GREEN, its implementation PR is Owner-merged with a merge commit, and the ledger lifecycle is authorized to READY.

## Dependencies
- `BSC-WALLET-CANDIDATE-SCREENING-V0-1-001-AUDIT-001`

## Write boundary
- `src/application/wallet-intelligence/bsc-chain-verification-pilot.ts`
- `src/cli/run-bsc-wallet-chain-verification-pilot.ts`
- `test/application/wallet-intelligence/bsc-chain-verification-pilot.test.ts`
- `docs/bsc_chain_verification_pilot.md`
- `harness/reports/BSC-WALLET-CHAIN-VERIFICATION-PILOT-001/`
- `artifacts/bsc_wallet_chain_verification_pilot/`

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
## Acceptance commands
- `npm run harness:task -- validate harness/tasks/BSC-WALLET-CHAIN-VERIFICATION-PILOT-001.json`
- `npm run harness:doctor`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run security:scan`
- `git diff --check`
- `MUST IMPLEMENT AND EXECUTE before DONE: tsx src/cli/run-bsc-wallet-chain-verification-pilot.ts --private-root "$CHAINFM_OUT_DIR" --input-manifest "$CHAINFM_OUT_DIR/bsc/bsc_candidate_replay_manifest.json" --output-private "$CHAINFM_OUT_DIR/bsc/bsc_wallet_chain_verification_pilot/"; use authorized real private input, run twice with identical input, verify input/output record counts and identical output SHA-256, write replay_manifest.json and source_hashes.json, and verify chainfm_out is not tracked by Git.`
## Private offline replay requirement
The task-specific offline CLI above is a future implementation obligation. Before a DONE claim, run it against authorized real private input twice with the identical input; verify input and output record counts and equal output SHA-256; retain a private replay manifest and source hashes; and prove that `chainfm_out` is not tracked by Git.
