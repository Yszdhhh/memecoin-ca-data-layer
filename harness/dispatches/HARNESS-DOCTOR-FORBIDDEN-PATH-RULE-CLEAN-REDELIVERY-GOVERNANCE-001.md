# Authoritative Dispatch: HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-GOVERNANCE-001

## Identity

- Task ID: `HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-GOVERNANCE-001`
- Role: `coordinator / governance`
- Implementer agent: `coordinator-harness-doctor-clean-redelivery-governance-001`
- Baseline: `fce42eeb560c85e4924399bdf08419f9ea7ba642`
- Legacy PR: `#19`
- Legacy PR HEAD: `0159af6a89968f01c1d220a3890acb4c169e1f69`
- Original audit manifest: `e6b7140d4d9fc73a02d14e64cf744d4f3eee85abd3bb4119d73725ac99ece749`
- Blocking finding: `P1-PRIVATE-ABSOLUTE-PATH-IN-COMMITTED-EVIDENCE`

## Authorized scope

Create and verify only the governance Task Specs, dispatch, input manifest, acceptance evidence, and ledger entries listed in the Task Spec write set. This task does not change product code or Harness runtime, does not copy or redeliver PR #19 code, does not close PR #19, and does not start the future clean-room Delivery.

## Binding governance decisions

1. PR #19 is independently classified `RED` because committed evidence contains a private absolute path. An ordinary append-only commit cannot remove that path from ancestor history.
2. PR #19 is permanently prohibited from `main` and must remain Draft/Open/unmerged. It must not be marked Ready, merged, squashed, rebased, force-pushed, or history-rewritten.
3. PR #19 may be used only as a read-only behavioral reference.
4. `HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-001` is authorized as a later task, but is not created, started, or implemented here.
5. The later Delivery must start from the post-governance `main` branch and must freshly implement code, tests, and evidence. It must not merge or cherry-pick PR #19, copy its evidence, or reuse its report text.
6. The later Delivery requires a different independent auditor. Only `GREEN` or `GREEN_WITH_ADVISORY` from that auditor may permit Ready, and the final integration must be a two-parent merge commit.
7. Only after the later clean-room PR exists may a superseded comment be posted on PR #19 and PR #19 be closed. The legacy branch is not deleted and its existing audit comment is not modified.

## Audit handoff

The independent audit Task `HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-GOVERNANCE-AUDIT-001` is created in `READY` state for `codex-independent-auditor-harness-doctor-002`. The auditor may write only its own report and an external PR comment; it may not alter this governance implementation or its ledger entry.

## Write set

- `harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-GOVERNANCE-001.json`
- `harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-GOVERNANCE-AUDIT-001.json`
- `harness/dispatches/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-GOVERNANCE-001.md`
- `harness/inputs/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-GOVERNANCE-001/manifest.json`
- `harness/reports/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-CLEAN-REDELIVERY-GOVERNANCE-001/acceptance.md`
- `harness/ledger/tasks.json`

## Required checks

Run the acceptance commands in the Task Spec. Record only repository-relative paths and the normalized privacy result `private_absolute_path_matches=0` in Git evidence.