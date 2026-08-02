# Test Evidence — CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1

Executed in the Program governance worktree on 2026-08-02.

| Check | Result | Evidence |
|---|---|---|
| All Program Task Spec validations | PASS | 27/27 task-v1 specs validated by `npm run harness:task -- validate` |
| Task Spec / ledger / DAG status consistency | PASS | 27/27 agree; 0 mismatches; Task Specs are the sole status source of truth |
| Dependency unknown check | PASS | 0 unknown dependencies |
| Dependency cycle check | PASS | 0 cycles |
| Write-set collision check | PASS | 0 parallel collisions; 1 explicitly serialized `harness/config/project.json` overlap |
| Deliverable/write-set containment | PASS | 0 out-of-scope deliverables |
| HUD v0.3 Live hard-input check | PASS | 5 required audit acceptance inputs present; 0 Live Observation inputs and 0 Live Observation dependencies |
| BSC Source Inventory gate check | PASS | Only `BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001-AUDIT-001` is declared; no Solana gate dependency |
| Private offline acceptance-rule check | PASS | 9 data-processing implementation Task Specs declare future task-specific double-run/hash/count/replay/source-hash/Git-boundary requirements |
| First acceptance self-validation check | PASS | 27/27 Task Specs begin with their exact `npm run harness:task -- validate harness/tasks/<TASK_ID>.json` command |
| `npm run harness:doctor` | Expected baseline FAIL | Exactly the pre-existing three forbidden tracked `wallet*.json` paths: `apps/operator-console/src/data/fixtures/wallets.json`, `artifacts/wallet_intelligence_v0_1/wallet_data_quality_report_v0_1.json`, and `artifacts/wallet_intelligence_v0_1/wallet_replay_manifest_v0_1.json`; 0 newly introduced matches. Dirty-worktree warning is expected during this governance repair. |
| `npm run typecheck` | PASS | Exit code 0 |
| `npm test` | PASS | 461 tests: 460 passed, 0 failed, 1 skipped |
| `npm run build` | PASS | Exit code 0 |
| `npm run security:scan` | PASS | Exit code 0; 319 policy matches, 0 classified leaks |
| `git diff --check` | PASS | Exit code 0 |
| `chainfm_out` Git-boundary check | PASS | No `chainfm_out` path in the governance diff; no private data staged or committed |

The Doctor baseline is deliberately not suppressed in this governance PR. The registered narrow repair task is the sole path for changing `forbidden_repository_patterns` after independent audit. No product source, package script, active-stage configuration, provider configuration, or private data was modified.
