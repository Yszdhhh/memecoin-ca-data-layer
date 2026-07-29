# Dispatch: HARNESS-GMGN-WALLET-STATS-PARSER-REPAIR-003-AUDIT-DEPENDENCY-UNLOCK-001

- **Agent & Role**: Internal Harness Coordinator (`coordinator-harness-gmgn-wallet-stats-parser-repair-003-audit-dependency-unlock-001`)
- **Task ID**: `HARNESS-GMGN-WALLET-STATS-PARSER-REPAIR-003-AUDIT-DEPENDENCY-UNLOCK-001` (Tier T2)
- **Objective**: Pure Harness State Unlock task to transition `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-003-AUDIT-001` from `BLOCKED_DEPENDENCY` to `READY` in both task spec and ledger after verifying that all prerequisites (`GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-003`, `HARNESS-GMGN-WALLET-STATS-PARSER-REPAIR-003-WRITE-SET-AND-SHA-EVIDENCE-REPAIR-001`, and `HARNESS-GMGN-WALLET-STATS-PARSER-REPAIR-003-WRITE-SET-AND-SHA-EVIDENCE-REPAIR-AUDIT-001`) are `DONE`, Evidence Repair Audit verdict is `GREEN`, and Audit Delivery SHA matches `a93ae1956f39dba6f94777f55eaaed73b8d0672c`.
- **Write Set**:
  - `harness/tasks/HARNESS-GMGN-WALLET-STATS-PARSER-REPAIR-003-AUDIT-DEPENDENCY-UNLOCK-001.json`
  - `harness/dispatches/HARNESS-GMGN-WALLET-STATS-PARSER-REPAIR-003-AUDIT-DEPENDENCY-UNLOCK-001.md`
  - `harness/inputs/HARNESS-GMGN-WALLET-STATS-PARSER-REPAIR-003-AUDIT-DEPENDENCY-UNLOCK-001/manifest.json`
  - `harness/reports/HARNESS-GMGN-WALLET-STATS-PARSER-REPAIR-003-AUDIT-DEPENDENCY-UNLOCK-001/acceptance.md`
  - `harness/tasks/GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-003-AUDIT-001.json`
  - `harness/ledger/tasks.json`
- **Forbidden Actions**:
  - Do not modify application code (`src/**`) or test code (`test/**`).
  - Do not issue network or provider requests.
  - Do not read credentials, private keys, or plaintext address files.
  - Do not execute GMGN CLI or live smoke tasks.
  - Do not modify existing acceptance text or live outputs.
