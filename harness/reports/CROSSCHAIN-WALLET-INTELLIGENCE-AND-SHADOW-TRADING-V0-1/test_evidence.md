# Test Evidence — CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1

- Verified commit: `69fee761bf182cd952817d7bd429813add3bb920`
- Program Task Spec scope: **27** task specs from the Program DAG.

## Governance validation

| Check | Result |
| --- | --- |
| JSON.parse across Program Task Specs | 27/27 PASS |
| `npm run harness:task -- validate harness/tasks/<TASK_ID>.json` | 27/27 PASS |
| Task Spec / ledger / DAG status consistency | 27/27 PASS |
| Unknown dependency check | PASS — 0 |
| Dependency cycle check | PASS — 0 |
| Parallel write-set collision check | PASS — 0 |
| Serialized write-set overlap | 1 expected overlap on `harness/config/project.json` |
| Deliverable/write-set containment | PASS — 0 out of scope |
| `acceptance_commands` MUST-prefix entries | PASS — 0 |
| Future offline CLI entries with prose / shell chaining | PASS — 0 |

## Repository commands

| Command | Result |
| --- | --- |
| `npm run harness:doctor` | Expected baseline FAIL: exactly 3 existing tracked `wallet*.json` paths; no new match |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 460 passed, 0 failed, 1 skipped |
| `npm run build` | PASS |
| `npm run security:scan` | PASS — 312 matched policy lines, 0 classified leaks |
| `git diff --check` | PASS |

No real private input was read for this governance repair, and no `chainfm_out`, raw wallet address, transaction identifier, GMGN raw export, credential, or product-source change is present in the verified commit.
