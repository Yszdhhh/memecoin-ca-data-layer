# Dispatch: BSC-WALLET-MASTER-CLEAN-RANK-V0-1-001

## Scope
Build a deterministic, auditable BSC wallet master from approved BSC inventory inputs. Normalize chain 56 addresses, retain address-type uncertainty, separate swaps from transfers, preserve unknowns, and record source lineage, rejection reasons, cost-basis completeness, accounting risk, bot/cluster risk, and data quality.

## Required reading
Read `PROJECT_REQUIRED_READING.md` in full before inspecting code. Follow the exact task spec: `harness/tasks/BSC-WALLET-MASTER-CLEAN-RANK-V0-1-001.json`.

## Current status
`BLOCKED_STAGE`. Do not begin implementation unless the Harness lifecycle state is moved to `READY` by an authorized coordinator.

## Dependencies
- `BSC-STAGE-001`
- `BSC-WALLET-SOURCE-INVENTORY-001`

## Write boundary
- `src/application/wallet-intelligence/bsc-master-clean-rank-v0-1.ts`
- `src/cli/run-bsc-wallet-master-clean-rank-v0-1.ts`
- `test/application/wallet-intelligence/bsc-master-clean-rank-v0-1.test.ts`
- `docs/bsc_wallet_master_cleaning_v0_1.md`
- `harness/reports/BSC-WALLET-MASTER-CLEAN-RANK-V0-1-001/`
- `artifacts/bsc_wallet_master_v0_1/`

## Required evidence
- Run the task acceptance commands.
- Run once against authorized private input and replay the same input deterministically where applicable.
- Produce `acceptance.md`, `desensitized_metrics.json`, `replay_manifest.json`, `source_hashes.json`, `deterministic_replay_result.json`, `test_evidence.md`, and `git_delivery_status.md` in the task report area.
- Keep all raw private data outside Git.
