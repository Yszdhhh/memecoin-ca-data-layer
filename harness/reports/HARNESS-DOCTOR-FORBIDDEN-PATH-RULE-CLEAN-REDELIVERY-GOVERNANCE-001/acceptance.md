# Acceptance Report: HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-GOVERNANCE-001

## 1. Metadata

| Field | Value |
| --- | --- |
| Task ID | `HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-GOVERNANCE-001` |
| HARNESS_AGENT_ID | `coordinator-harness-doctor-clean-redelivery-governance-001` |
| Role | `coordinator` |
| Branch | `chore/harness-doctor-clean-redelivery-governance` |
| Required starting HEAD | `cba39174701a2b3a5a137922c549f6e12869d672` |
| Parent/base SHA | `fce42eeb560c85e4924399bdf08419f9ea7ba642` |
| Legacy PR | `#19` (`OPEN / Draft / unmerged`) |
| Legacy PR HEAD | `0159af6a89968f01c1d220a3890acb4c169e1f69` |
| Blocking finding | `P1-PRIVATE-ABSOLUTE-PATH-IN-COMMITTED-EVIDENCE` |

## 2. Governance outcome

- PR #19 remains `RED` and permanently prohibited from entering `main`.
- PR #19 remains Draft/Open/unmerged and was not made Ready, merged, squashed, rebased, force-pushed, or history-rewritten.
- The legacy PR remains a read-only behavioral reference; its code and evidence are not copied or cherry-picked.
- `HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-001` remains authorized as a later task, but is not created, started, or implemented by this governance task.
- The next-stage Delivery must begin from post-governance `main`, freshly implement code/tests/evidence, receive a different independent audit, and integrate only through a two-parent merge commit.

## 3. Harness Doctor baseline diagnostic contract

`npm run harness:doctor` is a required baseline diagnostic for this governance task, but it is not a pass/fail acceptance gate. This is intentional because this governance task exists to authorize repair of the pre-existing forbidden-path issue that causes the doctor to fail on the current `main`. The governance write set forbids modifying the Harness Doctor runtime, `harness/config/project.json`, and the three existing forbidden tracked wallet artifacts.

The diagnostic was run independently at the exact base SHA `fce42eeb560c85e4924399bdf08419f9ea7ba642` and at the PR #20 final delivery state. Both clean states emitted only this same error set and no warnings:

1. `apps/operator-console/src/data/fixtures/wallets.json`
2. `artifacts/wallet_intelligence_v0_1/wallet_data_quality_report_v0_1.json`
3. `artifacts/wallet_intelligence_v0_1/wallet_replay_manifest_v0_1.json`

Normalized diagnostic facts:

```text
harness_doctor_role=required_non_gate_baseline_diagnostic
baseline_doctor_exit=1
delivery_doctor_exit=1
baseline_error_set_equals_delivery_error_set=true
baseline_warning_set_equals_delivery_warning_set=true
new_doctor_errors=0
forbidden_path_rule_set_unchanged=true
doctor_runtime_unchanged=true
project_config_unchanged=true
wallet_artifacts_unchanged=true
```

The exit code, error set, and warning set are equal. PR #20 added no doctor errors and did not reduce or expand the forbidden-path rule set. The Harness Doctor runtime and `harness/config/project.json` are unchanged.

## 4. Formal acceptance commands

`npm run harness:doctor` is intentionally excluded from both Task Specs' formal `acceptance_commands`; it is reported above as an independent required non-gate baseline diagnostic. Every formal acceptance command below exited `0`:

### Governance implementation Task

| Command | Exit code | Result |
| --- | ---: | --- |
| `npm run harness:task -- validate harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-GOVERNANCE-001.json` | 0 | PASS |
| `npm run harness:task -- validate harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-GOVERNANCE-AUDIT-001.json` | 0 | PASS |
| `npm run typecheck` | 0 | PASS |
| `npm test` | 0 | PASS (460 passed, 1 skipped, 0 failed) |
| `npm run build` | 0 | PASS |
| `npm run security:scan` | 0 | PASS (`classifiedLeaks=0`) |
| `git diff --check` | 0 | PASS |

### Governance Audit Task

| Command | Exit code | Result |
| --- | ---: | --- |
| `npm run harness:task -- validate harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-GOVERNANCE-AUDIT-001.json` | 0 | PASS |
| `npm run typecheck` | 0 | PASS |
| `npm test` | 0 | PASS (460 passed, 1 skipped, 0 failed) |
| `npm run build` | 0 | PASS |
| `npm run security:scan` | 0 | PASS (`classifiedLeaks=0`) |
| `git diff --check` | 0 | PASS |

Dependency bootstrap used `npm ci --ignore-scripts --offline` with exit code `0`; it is setup, not a Task Spec acceptance command.

## 5. Scope, privacy, and non-regression verification

- Changed paths are limited to the six governance paths declared in the implementation Task Spec.
- No product source, application code, tests, Harness runtime, package metadata, project configuration, or PR #19 branch files changed.
- `private_absolute_path_matches=0`.
- No secrets, credentials, raw provider payloads, or plaintext addresses were added.
- The forbidden-path rule configuration, Harness Doctor runtime, project configuration, and all three pre-existing wallet artifacts are unchanged.
- The Audit Task write set remains report-only to avoid the active ledger overlap detected by the current Harness Doctor; the coordinator records its `READY` ledger state while the independent auditor remains prohibited from changing governance implementation artifacts.

## 6. Verdict and handoff

- Governance implementation status: `DONE`.
- Governance implementation verdict: `GREEN_WITH_ADVISORY`; all formal acceptance commands pass, while the required non-gate baseline diagnostic preserves the pre-existing three-file doctor failure.
- Governance Audit status: `READY`.
- Governance Audit verdict: pending independent auditor.
- P0: `0`.
- P1: `0` for this acceptance-contract closure; the pre-existing forbidden-path finding remains the authorized reason for the non-gate diagnostic.
- P2: `0`.
- No Ready action or merge was performed on PR #20. PR #19 was not modified. No squash, rebase, force-push, or history rewrite was performed.