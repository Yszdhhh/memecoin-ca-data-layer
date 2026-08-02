# Dispatch: BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001

## Scope
Apply the Owner decision to activate BSC offline-local-research only. Update the constitutional, Owner-decision, Harness config, and ledger records to permit BSC source inventory, master cleaning, candidate screening, local chain verification, and historical replay. Solana remains the only Live/production delivery chain. BSC network collection, Live providers, resident listeners, GMGN automation, real trades, and production database writes remain prohibited. Robinhood remains BLOCKED_STAGE. This task may execute only after the governance PR that registers it is Owner-merged and HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001-AUDIT-001 is GREEN; BSC Source Inventory becomes READY only after this task receives an independent GREEN audit and its implementation PR is Owner-merged with a merge commit.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001.json`.

## Current status
`BLOCKED_DEPENDENCY`. Do not start until HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001-AUDIT-001 is GREEN and this governance PR is Owner-merged with a merge commit.

## Dependencies
- `HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001-AUDIT-001`

## Write boundary
- `PROJECT_CONSTITUTION.md`
- `OWNER_DECISIONS_NEEDED.md`
- `harness/config/project.json`
- `harness/ledger/tasks.json`
- `harness/reports/BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001/`

## Activation boundary
This is a governance-only offline-stage activation. It may enable only BSC source inventory, local cleaning, candidate screening, local chain verification, and historical replay. Solana remains the only Live/production chain. BSC network collection, live providers, resident listeners, GMGN automation, real trades, and production database writes remain prohibited. Robinhood remains BLOCKED_STAGE.

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
