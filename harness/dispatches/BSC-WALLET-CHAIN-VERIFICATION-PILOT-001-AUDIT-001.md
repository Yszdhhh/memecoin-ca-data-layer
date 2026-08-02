# Dispatch: BSC-WALLET-CHAIN-VERIFICATION-PILOT-001-AUDIT-001

## Scope
Independently audit BSC-WALLET-CHAIN-VERIFICATION-PILOT-001. Evaluate Harness adherence, code simplicity, architecture, data credibility, product closure, tests and observability, security and privacy, and Git/task governance. State principal strengths, principal issues, over-implementation assessment, P0/P1/P2 findings, and exactly one verdict: GREEN, YELLOW, or RED. This report-only task must not modify implementation outputs. A non-GREEN verdict blocks all downstream tasks that depend on this audit.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/BSC-WALLET-CHAIN-VERIFICATION-PILOT-001-AUDIT-001.json`.

## Current status
`BLOCKED_STAGE`. BLOCKED_STAGE. Do not start until the offline-stage activation audit is GREEN, its implementation PR is Owner-merged with a merge commit, and the ledger lifecycle is authorized to READY.

## Dependencies
- `BSC-WALLET-CHAIN-VERIFICATION-PILOT-001`

## Write boundary
- `harness/reports/BSC-WALLET-CHAIN-VERIFICATION-PILOT-001-AUDIT-001/`

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
