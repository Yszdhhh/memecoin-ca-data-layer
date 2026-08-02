# Dispatch: BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001-AUDIT-001

## Scope
Independently audit BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001. Verify the activation is offline-local-research only; Solana remains the sole Live/production delivery chain; BSC network collection, Live providers, resident listeners, GMGN automation, real trades, and production database writes remain prohibited; Robinhood stays BLOCKED_STAGE; and BSC Source Inventory is not marked READY prematurely. Evaluate Harness adherence, simplicity, architecture, data credibility, product closure, tests/observability, security/privacy, Git/task governance, strengths, issues, over-implementation, P0/P1/P2, and issue exactly GREEN, YELLOW, or RED.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001-AUDIT-001.json`.

## Current status
`BLOCKED_DEPENDENCY`. BLOCKED_DEPENDENCY. Do not start until every named dependency has an independent GREEN verdict where an audit task is named.

## Dependencies
- `BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001`

## Write boundary
- `harness/reports/BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001-AUDIT-001/`

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
