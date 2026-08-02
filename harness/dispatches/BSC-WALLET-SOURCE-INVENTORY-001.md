# Dispatch: BSC-WALLET-SOURCE-INVENTORY-001

## Scope
When the Solana gate and Owner activation permit BSC, inventory only authorized local BSC sources and establish their schemas, period credibility, EOA/contract uncertainty, replay feasibility, accounting risks, and minimum acquisition gaps without network collection. It remains BLOCKED_STAGE until BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001-AUDIT-001 is GREEN and the Owner merge-commits that activation.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/BSC-WALLET-SOURCE-INVENTORY-001.json`.

## Current status
`BLOCKED_STAGE`. BLOCKED_STAGE. Do not start until the offline-stage activation audit is GREEN, its implementation PR is Owner-merged with a merge commit, and the ledger lifecycle is authorized to READY.

## Dependencies
- `BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001-AUDIT-001`

## Write boundary
- `harness/inputs/BSC-WALLET-SOURCE-INVENTORY-001/`
- `harness/reports/BSC-WALLET-SOURCE-INVENTORY-001/`
- `docs/bsc_source_inventory.md`
- `docs/bsc_acquisition_plan.md`

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
