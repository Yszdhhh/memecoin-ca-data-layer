# Dispatch: BSC-WALLET-MASTER-CLEAN-RANK-V0-1-001

## Scope
Build a deterministic, auditable BSC wallet master from approved BSC inventory inputs. Normalize chain 56 addresses, retain address-type uncertainty, separate swaps from transfers, preserve unknowns, and record source lineage, rejection reasons, cost-basis completeness, accounting risk, bot/cluster risk, and data quality.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/BSC-WALLET-MASTER-CLEAN-RANK-V0-1-001.json`.

## Current status
`BLOCKED_STAGE`. BLOCKED_STAGE. Do not start until the offline-stage activation audit is GREEN, its implementation PR is Owner-merged with a merge commit, and the ledger lifecycle is authorized to READY.

## Dependencies
- `BSC-WALLET-SOURCE-INVENTORY-001-AUDIT-001`

## Write boundary
- `src/application/wallet-intelligence/bsc-master-clean-rank-v0-1.ts`
- `src/cli/run-bsc-wallet-master-clean-rank-v0-1.ts`
- `test/application/wallet-intelligence/bsc-master-clean-rank-v0-1.test.ts`
- `docs/bsc_wallet_master_cleaning_v0_1.md`
- `harness/reports/BSC-WALLET-MASTER-CLEAN-RANK-V0-1-001/`
- `artifacts/bsc_wallet_master_v0_1/`

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
