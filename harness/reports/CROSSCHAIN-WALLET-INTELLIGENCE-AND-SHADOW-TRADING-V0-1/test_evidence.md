# Test Evidence — CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1

- Verification commit reference: `SELF`.
- Binding rule: SELF resolves to the exact Git commit containing this evidence file; this avoids an impossible self-referential literal commit SHA.
- Program Task Spec scope: **27** Task Specs from the Program DAG.
- Exact JSON method: for every path, read `git show SELF:<task-file>` bytes and call standard Node.js `JSON.parse`.

## Per-task committed-content validation

| Task Spec | JSON.parse | task validate |
| --- | ---: | ---: |
| `harness/tasks/BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001-AUDIT-001.json` | PASS | PASS |
| `harness/tasks/BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001.json` | PASS | PASS |
| `harness/tasks/BSC-WALLET-CANDIDATE-SCREENING-V0-1-001-AUDIT-001.json` | PASS | PASS |
| `harness/tasks/BSC-WALLET-CANDIDATE-SCREENING-V0-1-001.json` | PASS | PASS |
| `harness/tasks/BSC-WALLET-CHAIN-VERIFICATION-PILOT-001-AUDIT-001.json` | PASS | PASS |
| `harness/tasks/BSC-WALLET-CHAIN-VERIFICATION-PILOT-001.json` | PASS | PASS |
| `harness/tasks/BSC-WALLET-MASTER-CLEAN-RANK-V0-1-001-AUDIT-001.json` | PASS | PASS |
| `harness/tasks/BSC-WALLET-MASTER-CLEAN-RANK-V0-1-001.json` | PASS | PASS |
| `harness/tasks/BSC-WALLET-SHADOW-REPLAY-PILOT-001-AUDIT-001.json` | PASS | PASS |
| `harness/tasks/BSC-WALLET-SHADOW-REPLAY-PILOT-001.json` | PASS | PASS |
| `harness/tasks/BSC-WALLET-SOURCE-INVENTORY-001-AUDIT-001.json` | PASS | PASS |
| `harness/tasks/BSC-WALLET-SOURCE-INVENTORY-001.json` | PASS | PASS |
| `harness/tasks/CROSSCHAIN-WALLET-HUD-V0-3-001-AUDIT-001.json` | PASS | PASS |
| `harness/tasks/CROSSCHAIN-WALLET-HUD-V0-3-001.json` | PASS | PASS |
| `harness/tasks/CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1-001.json` | PASS | PASS |
| `harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001-AUDIT-001.json` | PASS | PASS |
| `harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001.json` | PASS | PASS |
| `harness/tasks/SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-001-REPAIR-002.json` | PASS | PASS |
| `harness/tasks/SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-002-AUDIT-001.json` | PASS | PASS |
| `harness/tasks/SOL-WALLET-SHADOW-REPLAY-PILOT-001-AUDIT-001.json` | PASS | PASS |
| `harness/tasks/SOL-WALLET-SHADOW-REPLAY-PILOT-001.json` | PASS | PASS |
| `harness/tasks/WALLET-SHADOW-LIVE-OBSERVATION-PILOT-001-AUDIT-001.json` | PASS | PASS |
| `harness/tasks/WALLET-SHADOW-LIVE-OBSERVATION-PILOT-001.json` | PASS | PASS |
| `harness/tasks/WALLET-SHADOW-REPLAY-ENGINE-V0-1-001-AUDIT-001.json` | PASS | PASS |
| `harness/tasks/WALLET-SHADOW-REPLAY-ENGINE-V0-1-001.json` | PASS | PASS |
| `harness/tasks/WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001-AUDIT-001.json` | PASS | PASS |
| `harness/tasks/WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001.json` | PASS | PASS |

## Governance validation

| Check | Result |
| --- | --- |
| Committed-HEAD JSON.parse across Program Task Specs | 27/27 PASS |
| `npm run harness:task -- validate harness/tasks/<TASK_ID>.json` | 27/27 PASS |
| Decoded `objective` CR/LF/U+2028/U+2029 scan | PASS — 0 files |
| Physical bare-newline files in JSON string content | none |
| Explicit BSC Source Inventory objective check | PASS — valid single-line string |
| Explicit Cross-chain HUD v0.3 objective check | PASS — valid single-line string |
| Source-hash basis | PASS — Git blob bytes, not working-tree bytes |
| Task Spec / ledger / DAG status consistency | 27/27 PASS |
| Unknown dependency check | PASS — 0 |
| Dependency cycle check | PASS — 0 |
| Parallel write-set collision check | PASS — 0 |
| Serialized write-set overlap | 1 expected overlap on `harness/config/project.json` |
| Deliverable/write-set containment | PASS — 0 out of scope |
| `acceptance_commands` prose/MUST-prefix entries | PASS — 0 |

## Repository commands

| Command | Result |
| --- | --- |
| `npm run harness:doctor` | Expected baseline FAIL: exactly 3 existing tracked `wallet*.json` paths; no new match |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 460 passed, 0 failed, 1 skipped (461 total) |
| `npm run build` | PASS |
| `npm run security:scan` | PASS — 312 matched policy lines, 0 classified leaks |
| `git diff --check` | PASS |

No real private input was read. No `chainfm_out`, raw wallet address, transaction identifier, GMGN private export, credential, product-source change, or production-configuration change is present.
