# Dispatch: BSC-WALLET-SOURCE-INVENTORY-001

## Scope
Inventory only authorized local BSC sources after `BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001-AUDIT-001` is GREEN and the separately scoped activation implementation is Owner-merged with a merge commit. This task has no Solana E2E dependency. It is limited to offline-local research: establish source schemas, period credibility, EOA/contract uncertainty, replay feasibility, accounting risks, and minimum acquisition gaps without network collection. BSC Live capability, providers, resident listening, GMGN automation, real trading, and production writes remain prohibited.
## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/BSC-WALLET-SOURCE-INVENTORY-001.json`.

## Current status
`BLOCKED_STAGE`. The task-spec dependency is only `BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001-AUDIT-001`; it is not gated by Solana E2E. Current repository configuration still keeps BSC offline research inactive, so do not start until the audited activation is Owner-merged and its stage configuration is actually applied.
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
