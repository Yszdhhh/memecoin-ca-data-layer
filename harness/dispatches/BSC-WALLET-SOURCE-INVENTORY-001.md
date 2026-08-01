# Dispatch: BSC-WALLET-SOURCE-INVENTORY-001

## Scope
When the Solana gate and Owner activation permit BSC, inventory only authorized local BSC sources and establish their schemas, period credibility, EOA/contract uncertainty, replay feasibility, accounting risks, and minimum acquisition gaps without network collection.

## Required reading
Read `PROJECT_REQUIRED_READING.md` in full before inspecting code. Follow the exact task spec: `harness/tasks/BSC-WALLET-SOURCE-INVENTORY-001.json`.

## Current status
`BLOCKED_STAGE`. Do not begin implementation unless the Harness lifecycle state is moved to `READY` by an authorized coordinator.

## Dependencies
- `BSC-STAGE-001`

## Write boundary
- `harness/inputs/BSC-WALLET-SOURCE-INVENTORY-001/`
- `harness/reports/BSC-WALLET-SOURCE-INVENTORY-001/`
- `docs/bsc_source_inventory.md`
- `docs/bsc_acquisition_plan.md`

## Required evidence
- Run the task acceptance commands.
- Run once against authorized private input and replay the same input deterministically where applicable.
- Produce `acceptance.md`, `desensitized_metrics.json`, `replay_manifest.json`, `source_hashes.json`, `deterministic_replay_result.json`, `test_evidence.md`, and `git_delivery_status.md` in the task report area.
- Keep all raw private data outside Git.
