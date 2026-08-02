# Test Evidence — CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1

Executed in the Program governance worktree on 2026-08-02.

| Check | Result | Evidence |
|---|---|---|
| All Program Task Spec validations | PASS | 27/27 task-v1 specs validated by `npm run harness:task -- validate` |
| Dependency unknown check | PASS | 0 unknown dependencies |
| Dependency cycle check | PASS | 0 cycles |
| Write-set collision check | PASS | 0 parallel collisions; 1 explicitly serialized `harness/config/project.json` overlap |
| Deliverable/write-set containment | PASS | 0 out-of-scope deliverables |
| `npm run harness:doctor` | Expected baseline FAIL | Exactly the pre-existing three forbidden tracked `wallet*.json` paths; 0 newly introduced matches |
| `npm run typecheck` | PASS | Exit code 0 |
| `npm test` | PASS | 461 tests: 460 passed, 0 failed, 1 skipped |
| `npm run build` | PASS | Exit code 0 |
| `npm run security:scan` | PASS | Exit code 0; no classified leak reported |
| `git diff --check` | PASS | Exit code 0 |

The Doctor baseline is deliberately not suppressed in this governance PR. The registered narrow repair task is the sole path for changing `forbidden_repository_patterns` after independent audit.
