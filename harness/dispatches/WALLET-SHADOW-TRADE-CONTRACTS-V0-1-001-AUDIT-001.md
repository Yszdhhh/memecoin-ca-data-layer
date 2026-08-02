# Dispatch: WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001-AUDIT-001

## Scope
Independently audit WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001. Evaluate Harness adherence, code simplicity, architecture, data credibility, product closure, tests and observability, security and privacy, and Git/task governance. State principal strengths, principal issues, over-implementation assessment, P0/P1/P2 findings, and exactly one verdict: GREEN, YELLOW, or RED. This report-only task must not modify implementation outputs. A non-GREEN verdict blocks all downstream tasks that depend on this audit.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001-AUDIT-001.json`.

## Current status
`BLOCKED_DEPENDENCY`. BLOCKED_DEPENDENCY. Do not start until every named dependency has an independent GREEN verdict where an audit task is named.

## Dependencies
- `WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001`

## Write boundary
- `harness/reports/WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001-AUDIT-001/`

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
