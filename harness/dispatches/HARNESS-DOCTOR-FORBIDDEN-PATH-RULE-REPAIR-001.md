# Dispatch: HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001

## Scope
Repair the existing Harness doctor false positive with the narrowest auditable forbidden-path rule. In harness/config/project.json, modify only forbidden_repository_patterns; active_stage, active_chains, blocked_chains, rule_versions, quality_commands, and future_stage_gate must remain byte-for-byte equivalent to the baseline. Add tests proving those fields do not change, preserve synthetic raw/private wallet-like rejection, and distinguish only documented scrubbed public fixture/aggregate artifacts. Do not silently waive the doctor gate.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001.json`.

## Current status
`READY`. READY only after this governance PR is Owner-merged with a merge commit. Do not self-merge.

## Dependencies
- None

## Write boundary
- `harness/cli.ts`
- `test/harness.test.ts`
- `harness/config/project.json`
- `harness/reports/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001/`

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
