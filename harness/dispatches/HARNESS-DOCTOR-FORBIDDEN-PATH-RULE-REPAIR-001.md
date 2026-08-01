# Dispatch: HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001

## Scope
Repair the existing Harness doctor false positive with the narrowest auditable rule: preserve raw/private-data detection, distinguish only documented scrubbed public fixture/aggregate artifacts, and prove that synthetic raw wallet-like files remain rejected. Do not silently waive the doctor gate.

## Required reading
Read `PROJECT_REQUIRED_READING.md` in full before inspecting code. Follow only `harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001.json`.

## Current status
`READY`. The task must execute only after the governance PR containing this dispatch has been merged by the Owner using a merge commit.

## Dependencies
- Owner merge of the governance PR is an external dispatch prerequisite.

## Write boundary
- `harness/cli.ts`
- `test/harness.test.ts`
- `harness/config/project.json`
- `harness/reports/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001/`

## Required evidence
- Test both preserved rejection of a synthetic raw/private wallet artifact and acceptance only of explicitly scrubbed intended artifacts.
- Produce `acceptance.md`, `desensitized_metrics.json`, `replay_manifest.json`, `source_hashes.json`, `deterministic_replay_result.json`, `test_evidence.md`, and `git_delivery_status.md`.
- Keep private input out of Git.
