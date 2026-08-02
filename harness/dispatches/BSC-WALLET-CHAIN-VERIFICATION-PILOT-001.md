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
