# Dispatch: GMGN-PORTFOLIO-CUMULATIVE-ADAPTER-AND-DIAGNOSTICS-REPAIR-001

## Exact task

Execute **only** `harness/tasks/GMGN-PORTFOLIO-CUMULATIVE-ADAPTER-AND-DIAGNOSTICS-REPAIR-001.json`.

## Role and identity

- Role: implementer
- Required `HARNESS_AGENT_ID`: `implementer-gmgn-portfolio-cumulative-adapter-repair-001`
- This is an **offline-only** repair. It is not authorization to issue any GMGN request.

## Purpose

The 100-wallet run normalized 0 / 200 mapped records and the 1,433-wallet run normalized 5 / 2,866 mapped records; both retained only the generic safe code `gmgn_request_unavailable`. A prior one-invocation signed holdings pilot also PARKed with that safe code. Repair the reusable, testable command and normalization boundary before any new live request.

## Mandatory implementation decisions

1. Keep portfolio stats restricted to `7d` / `30d` and API-key-only.
2. Model cumulative data as a separate signed portfolio holdings snapshot, never as an all-time stats period.
3. The pinned `gmgn-cli@1.5.4` supports `--hide-closed false`; do not emit `--sell-out`.
4. Parent credentials must never be logged or serialized. Stats mode must not receive a private key. Signed mode may be represented in pure code but must not be exercised against a real credential in this task.
5. Child subprocess isolation must prevent ambient `.env` / global gmgn-cli configuration from silently changing the selected credential mode. Tests must prove the environment and cwd plan without using real filesystem credential files.
6. Convert failures to a finite allowlist from in-memory generic indicators only. Do not retain stdout, stderr, provider text, URLs, signatures, payloads or full exceptions in result objects, reports, fixtures, or test failures.
7. Holdings pagination must be explicit: a next-page cursor means partial; only a terminal page may be complete. Missing numeric fields are `null`, never zero.
8. Generated evidence must contain only aggregate counts, fingerprints, safe codes and field coverage; never addresses or labels.

## Required proof

- Pure synthetic tests for command construction, environment isolation, safe failure codes, holdings normalization, pagination completeness and report privacy.
- Standard offline checks in the task spec.
- Create no live output and do not alter historical output.

## Handoff

When implementation evidence is ready, leave `GMGN-PORTFOLIO-CUMULATIVE-ADAPTER-AND-DIAGNOSTICS-REPAIR-AUDIT-001` READY for a distinct auditor. Do not change it to DONE and do not dispatch a live re-test.
