# Acceptance evidence â€?HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001

## Scope and provenance

- Branch: `chore/harness-doctor-forbidden-path-rule-repair`
- Required base: `fce42eeb560c85e4924399bdf08419f9ea7ba642` (`origin/main` resolves to this commit after `git fetch origin main`)
- Provenance anchor / final code HEAD used for acceptance: `d5230971b98539989e0c8cad427b92ddddbc6661`
- Final HEAD: `d5230971b98539989e0c8cad427b92ddddbc6661` (evidence files bind to this code commit; the final evidence-only commit follows it).
- Task spec is present at `origin/main:harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001.json`; `task validate` is GREEN.
- Repair is limited to `harness/cli.ts`, `test/harness.test.ts`, and this report directory.
- `harness/config/project.json` is byte-for-byte unchanged; its governed fields are asserted by tests. No product runtime file, dependency, package script, `chainfm_out`, or private data was changed.

## Rule behavior

The existing `wallet*.json` rule remains active. The matcher exempts only these exact, documented scrubbed public artifacts:

1. `apps/operator-console/src/data/fixtures/wallets.json`
2. `artifacts/wallet_intelligence_v0_1/wallet_data_quality_report_v0_1.json`
3. `artifacts/wallet_intelligence_v0_1/wallet_replay_manifest_v0_1.json`

Synthetic `private/exports/wallets.json` and `artifacts/wallet_intelligence_v0_1/wallet_master.json` remain rejected. No arbitrary directory or filename wildcard was allowlisted.

## Required commands

| Command | Result | Evidence |
|---|---|---|
| `npm run harness:task -- validate harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001.json` | **GREEN** | `status=GREEN`, `errors=[]` |
| `npm run harness:doctor` | **PASS** | `status=GREEN`, `errors=[]`, `warnings=[]` |
| `npm run typecheck` | **PASS** | exit 0 |
| `npm test` | **PASS** | 463 tests discovered; 462 passed, 1 skipped, 0 failed |
| `npm run build` | **PASS** | exit 0 |
| `npm run security:scan` | **PASS** | `classifiedLeaks=0`, `matchedLines=317` |
| `git diff --check` | **PASS** | exit 0 |

## Test assertions

- Exact-path exemption accepts only the three documented scrubbed artifacts.
- Synthetic raw/private wallet-like paths remain forbidden.
- `schema_version`, `project`, `active_stage`, `active_chains`, `blocked_chains`, `verdicts`, `rule_versions`, `quality_commands`, and `future_stage_gate` remain at the governed baseline values.
- No doctor-gate bypass or content-secret scan weakening was introduced.

## Audit and delivery status

- Independent audit: **PENDING**. A different Agent must audit before GREEN is declared for merge eligibility.
- Push: complete to `origin/chore/harness-doctor-forbidden-path-rule-repair`.
- Draft/Open PR: #19, OPEN and DRAFT.
- Merge/rebase/squash: not performed.
