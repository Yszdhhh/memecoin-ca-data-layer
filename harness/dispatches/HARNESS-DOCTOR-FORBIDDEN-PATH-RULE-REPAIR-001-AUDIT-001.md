# Dispatch: HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001-AUDIT-001

## Scope
Independently audit the Harness doctor repair. Re-run doctor and negative retention tests; assess Harness compliance, code simplicity, architecture, data credibility, observability, security/privacy, Git governance, scope creep, P0/P1/P2, and GREEN/YELLOW/RED. Do not implement fixes.

## Required reading
Read `PROJECT_REQUIRED_READING.md` in full before inspecting code. Follow only `harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001-AUDIT-001.json`.

## Current status
`BLOCKED_DEPENDENCY`. The task must execute only after the governance PR containing this dispatch has been merged by the Owner using a merge commit.

## Dependencies
- `HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001`

## Write boundary
- `harness/reports/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001-AUDIT-001/`

## Required evidence
- Test both preserved rejection of a synthetic raw/private wallet artifact and acceptance only of explicitly scrubbed intended artifacts.
- Produce `acceptance.md`, `desensitized_metrics.json`, `replay_manifest.json`, `source_hashes.json`, `deterministic_replay_result.json`, `test_evidence.md`, and `git_delivery_status.md`.
- Keep private input out of Git.
