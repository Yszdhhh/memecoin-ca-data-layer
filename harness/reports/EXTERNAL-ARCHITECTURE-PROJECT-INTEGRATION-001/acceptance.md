# Acceptance preflight — EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001

## Scope

This is a governance-only task. It authorizes external research synthesis and decision reports; it does not authorize product code, PR #15, PR #16, existing product Task Specs, dependencies, network collection, live observation, real transactions, or POC implementation.

## Prerequisite evidence

- PR #16 head: `eb1d4979e87fd448355fe103c016ce011e1843a3`
- PR #16 merge commit: `96d2368f8b236b8a9a8ef3db75deea286ece1451`
- Main must be synchronized to the merge commit before Luna dispatch.
- `EXTERNAL_RESEARCH_ROOT` must resolve in both Process and User environment scopes.

## Declared files

| Category | Paths |
|---|---|
| Task | `harness/tasks/EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001.json` |
| Dispatch | `harness/dispatches/EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001.md` |
| Acceptance | `harness/reports/EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001/acceptance.md` |
| Ledger | `harness/ledger/tasks.json` |
| External outputs | `%EXTERNAL_RESEARCH_ROOT%\synthesis\` six named Markdown reports; not committed here |

## Governance checks

- Task JSON standard parse: PENDING until final commit verification.
- Task schema and `npm run harness:task -- validate ...`: PENDING.
- Ledger/task status consistency and dependency existence: PENDING.
- No dependency cycle, active write-set collision, or out-of-scope repository write: PENDING.
- `npm run harness:doctor`: PENDING; only the already-known wallet fixture baseline may remain.
- `npm run typecheck`, `npm test`, `npm run build`, `npm run security:scan`, `git diff --check`: PENDING.
- No product source, existing Task Spec, dependency, PR #15, or PR #16 modification: PENDING.
- No forbidden external path or private data read: PENDING.

## Luna execution contract

The executing Luna Worker must write exactly these external files and must not implement any POC:

1. `project-capability-overlap.md`
2. `verified-architecture-decisions.md`
3. `poc-decision-matrix.md`
4. `existing-task-impact.md`
5. `implementation-sequence.md`
6. `open-questions.md`

Each POC entry must include the 13 required scope fields from the Dispatch. Missing data must be `unknown` or `unfillable` rather than inferred.

## Completion update

The coordinator fills this section only after verifying the final committed HEAD and running the declared commands. Do not alter hashed governance files after evidence is generated.

- Final committed HEAD: PENDING
- JSON parse: PENDING
- Task validate: PENDING
- Ledger/DAG/write-set/containment: PENDING
- Harness doctor: PENDING
- Typecheck/test/build/security/diff: PENDING
- External root: PENDING
- Six synthesis outputs: PENDING
- Verdict: PENDING
