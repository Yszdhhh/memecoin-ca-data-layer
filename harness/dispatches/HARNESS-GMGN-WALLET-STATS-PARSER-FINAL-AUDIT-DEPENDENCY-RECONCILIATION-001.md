# Dispatch: HARNESS-GMGN-WALLET-STATS-PARSER-FINAL-AUDIT-DEPENDENCY-RECONCILIATION-001

## Agent & Role

- **Agent**: Internal Coordinator + Harness Maintainer
- **HARNESS_AGENT_ID**: `coordinator-harness-gmgn-wallet-stats-parser-final-audit-dependency-reconciliation-001`
- **Role**: coordinator

## Task

- **Task ID**: `HARNESS-GMGN-WALLET-STATS-PARSER-FINAL-AUDIT-DEPENDENCY-RECONCILIATION-001`
- **Tier**: T1
- **Spec**: `harness/tasks/HARNESS-GMGN-WALLET-STATS-PARSER-FINAL-AUDIT-DEPENDENCY-RECONCILIATION-001.json`

## Objective

Deterministic state and dependency alignment:

1. PARK `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-002-AUDIT-001` — Repair-002 is a historical intermediate implementation; Repair-003 has fully corrected and superseded it with an independent GREEN audit; auditing an already-superseded intermediate is not warranted.
2. Remove `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-002-AUDIT-001` from the Final Audit's dependency list.
3. Set Final Audit (`GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-AUDIT-001`) status from `BLOCKED_DEPENDENCY` to `READY`.
4. Register this reconciliation task in the ledger and mark it DONE.

## Dependencies (all DONE)

- `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-002` (DONE)
- `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-003` (DONE)
- `HARNESS-GMGN-WALLET-STATS-PARSER-REPAIR-003-WRITE-SET-AND-SHA-EVIDENCE-REPAIR-001` (DONE)
- `HARNESS-GMGN-WALLET-STATS-PARSER-REPAIR-003-WRITE-SET-AND-SHA-EVIDENCE-REPAIR-AUDIT-001` (DONE)
- `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-003-AUDIT-001` (DONE, GREEN)

## Write Set

1. `harness/tasks/HARNESS-GMGN-WALLET-STATS-PARSER-FINAL-AUDIT-DEPENDENCY-RECONCILIATION-001.json`
2. `harness/dispatches/HARNESS-GMGN-WALLET-STATS-PARSER-FINAL-AUDIT-DEPENDENCY-RECONCILIATION-001.md`
3. `harness/inputs/HARNESS-GMGN-WALLET-STATS-PARSER-FINAL-AUDIT-DEPENDENCY-RECONCILIATION-001/manifest.json`
4. `harness/reports/HARNESS-GMGN-WALLET-STATS-PARSER-FINAL-AUDIT-DEPENDENCY-RECONCILIATION-001/acceptance.md`
5. `harness/tasks/GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-002-AUDIT-001.json`
6. `harness/tasks/GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-AUDIT-001.json`
7. `harness/ledger/tasks.json`

## Forbidden Actions

- Zero network / provider / CLI / credential / real-address operations.
- No src/ or test/ modifications.
- No fake DONE/GREEN for Repair-002 Audit.
- No modification of Final Audit role, objective, write_set, forbidden_actions, or acceptance_commands.

## Acceptance

- `npm run harness:task -- validate` on both this task and the Final Audit.
- `npm run harness:doctor`
- `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`
