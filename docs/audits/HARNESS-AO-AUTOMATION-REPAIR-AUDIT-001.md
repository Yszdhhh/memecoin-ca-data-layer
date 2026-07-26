# HARNESS-AO-AUTOMATION-REPAIR-AUDIT-001 - Independent re-audit of the harness lifecycle repair

## Verdict

**GREEN_WITH_ADVISORY**

The repair delivered by `HARNESS-AO-AUTOMATION-REPAIR-001` (commit `7a9b94e`)
genuinely closes all five blocking findings of `HARNESS-AO-AUTOMATION-AUDIT-001`.
Each closure was verified against the production code paths, not by trusting the
commit message: `lifecycle verify` now fails closed and exits non-zero on an
outstanding audit-evidence gap (FIND-1); the planner requires the accepting
auditor run's `agent_id` to differ from every finished implementer run's
`agent_id` for the audited dependency (FIND-2); a hand-forged three-field
manifest, a `FAILED`-acceptance manifest, and a `null`/`false`-integrity
manifest are all rejected as evidence (FIND-3); `ACCEPTING_AUDIT_VERDICTS` is now
exactly `{GREEN, GREEN_WITH_ADVISORY}` (FIND-4); and `applyReadinessUpdates`
constrains both `from` and `to` to `{READY, BLOCKED_DEPENDENCY}` (FIND-5). No
previously-strong gate was weakened, no `src/` or `db/` business code was
touched, and all five acceptance commands pass. The live `lifecycle verify` on
the current ledger returns `FAIL` / exit 1 with the correct single gap, which is
the desired fail-closed behaviour, not a defect.

The verdict is `GREEN_WITH_ADVISORY` rather than `GREEN` because two
architectural residuals from the original findings survive the repair at
advisory strength - independence cannot be verified for a milestone that has no
implementer run manifest (ADV-1), and the evidence store remains git-ignored and
is validated only by a hand-rolled shape check rather than being re-executed or
schema-verified against a git-tracked baseline (ADV-2) - plus the same
governance-file drift the original audit flagged as FIND-8 recurs in this commit
(ADV-3). None of these reopens a blocking finding or weakens a gate, so none
forecloses acceptance under the fail-closed rule; they are recorded so they are
not mistaken for closed.

## Header

| Field | Value |
| --- | --- |
| Audit task | `HARNESS-AO-AUTOMATION-REPAIR-AUDIT-001` (T2, auditor, chain `null`) |
| Auditor agent | `claude-auditor-harness-repair` (independent of implementer `claude-fable-implementer`) |
| Date | 2026-07-27 |
| Harness run | `harness/runs/20260727_HARNESS_AO_AUTOMATION_REPAIR_AUDIT_001` |
| Audited repair commit | `7a9b94e` ("fix(harness): repair 4 P1 audit-evidence gaps (HARNESS-AO-AUTOMATION-REPAIR-001)") |
| Repair task spec | `harness/tasks/HARNESS-AO-AUTOMATION-REPAIR-001.json` (status `DONE`) |
| Original audit (FAIL) | `docs/audits/HARNESS-AO-AUTOMATION-AUDIT-001.md` (audited commit `1253b2c`) |
| Tree state at run start | clean (`git status --short` empty) |
| Implementer run for milestone | `harness/runs/20260727_HARNESS_AO_AUTOMATION_REPAIR_001` (`claude-fable-implementer`, GREEN) |

## Scope and methodology

- Clean-tree check (`git status --short` empty) before `run start`; the run was
  started under this auditor's own `HARNESS_AGENT_ID=claude-auditor-harness-repair`.
- Read in full: this audit's spec `harness/tasks/HARNESS-AO-AUTOMATION-REPAIR-AUDIT-001.json`
  (and obeyed its `forbidden_actions`), `harness/tasks/HARNESS-AO-AUTOMATION-REPAIR-001.json`,
  the original audit report, `harness/lib/validation.ts`, `harness/lib/contracts.ts`,
  `harness/cli.ts`, and `test/harness.test.ts`.
- Reviewed the repair diff via `git show 7a9b94e` per file and `git show --stat 7a9b94e`.
- Read-only CLI exercise: `npx tsx harness/cli.ts lifecycle verify` against the
  live ledger; exit code captured. `apply-readiness` (a writer) was not run.
- Enumerated `harness/runs/*/manifest.json` read-only to establish the real
  role / status / agent_id evidence set the planner consumes.
- Forbidden actions observed: no agents, model gateways, network APIs,
  credentials or live data sources were called. Only
  `docs/audits/HARNESS-AO-AUTOMATION-REPAIR-AUDIT-001.md` was written. No commit.

### Live CLI output (read-only, current ledger)

```
$ npx tsx harness/cli.ts lifecycle verify
{ "status": "FAIL", "ledger_errors": [], "sync_errors": [],
  "audit_evidence_gaps": [
    "HARNESS-AO-AUTOMATION-REPAIR-001: implementer DONE, auditor task
     HARNESS-AO-AUTOMATION-REPAIR-AUDIT-001 is READY without a finished, valid,
     passing auditor run" ],
  "readiness_updates": [], "runnable_count": 2 }
exit code: 1      <-- FAIL and exit 1 with one outstanding gap (this audit's own,
                      still RUNNING). FIND-1 is live-enforcing.
```

The single reported gap is this very audit: the REPAIR-001 implementer milestone
is `DONE` and its auditor task is `READY` with no *finished* valid auditor run
yet (mine is `RUNNING`). This is the fail-closed gate behaving exactly as
intended. It will clear only once this run is finished GREEN/GREEN_WITH_ADVISORY
by a valid manifest whose `agent_id` (`claude-auditor-harness-repair`) differs
from the implementer's (`claude-fable-implementer`).

## Per-finding closure

| Finding | Status | Evidence (file:line) |
| --- | --- | --- |
| FIND-1 | **CLOSED** | `harness/cli.ts:363-367` gates `status` on `ledgerErrors.length === 0 && plan.sync_errors.length === 0 && plan.audit_evidence_gaps.length === 0`; else `FAIL`. `harness/cli.ts:376` returns exit `1` unless GREEN. Confirmed live: exit 1 with one gap. No path yields GREEN while a gap exists - the three conjuncts are the only inputs to `status`. |
| FIND-2 | **CLOSED** (residual ADV-1) | `harness/lib/validation.ts:158-172`. `implementerAgents` is sourced from finished runs of the *dependency* task (`run.task_id === dep && run.role === "implementer" && run.agent_id`), correctly scoped. `acceptedAuditRuns` requires `evidence_valid` and an accepting verdict; `independentAuditRun` requires `run.agent_id && !implementerAgents.has(run.agent_id)`. An empty/missing auditor `agent_id` is falsy, so it can never be selected as independent. A shared identity is caught (test `:161`). Verified live: implementer id `claude-fable-implementer` vs auditor id `claude-auditor-harness-repair` are distinct. |
| FIND-3 | **CLOSED** (residual ADV-2) | `harness/cli.ts:301-314` `manifestIsValidEvidence`: `schema_version === "run-v1"`, non-empty `task_id`, non-empty `agent_id`, string `role`, non-empty `acceptance` array, every acceptance `status === "PASSED"`, and all four integrity flags `=== true` (strict, so `null`/`false`/truthy-non-true all fail). `harness/cli.ts:337` feeds `evidence_valid` into the planner; `harness/lib/validation.ts:167` requires `run.evidence_valid`. A bare `{task_id, role, status}` manifest fails at the `schema_version` check. |
| FIND-4 | **CLOSED** | `harness/lib/validation.ts:18` `ACCEPTING_AUDIT_VERDICTS = new Set<Verdict>(["GREEN", "GREEN_WITH_ADVISORY"])`. `FAIL`, `PARK`, `QUARANTINED` excluded. Typed `Set<Verdict>`, consumed at `:168` `ACCEPTING_AUDIT_VERDICTS.has(run.status)` where `run.status: Verdict`, so the comparison is type-sound (the prior `as Verdict` cast is gone). |
| FIND-5 | **CLOSED** | `harness/lib/validation.ts:22` `READINESS_FLIP_STATES = {READY, BLOCKED_DEPENDENCY}`. `applyReadinessUpdates` rejects on `!READINESS_FLIP_STATES.has(update.to)` (`:271`) **and** `!READINESS_FLIP_STATES.has(update.from)` (`:275`). Forged `from=DONE,to=BLOCKED_DEPENDENCY` and `from=PARK,to=READY` are both rejected at the `from` guard before any status compare. |

## Bypass-attempt matrix

| # | Attempted forge | Outcome | Evidence |
| --- | --- | --- | --- |
| B1 | 3-field `{task_id, role:"auditor", status:"GREEN"}` manifest as evidence | **BLOCKED**: `schema_version !== "run-v1"` -> `evidence_valid=false` -> planner ignores it | `harness/cli.ts:302`, `:337`, `harness/lib/validation.ts:167` |
| B2 | Full-shape manifest but one acceptance record `status:"FAILED"` | **BLOCKED**: `acceptance.every(status==="PASSED")` fails | `harness/cli.ts:307` |
| B3 | Full-shape manifest with `integrity.write_scope_valid=null` (the freshly-`start`ed default) or `=false` | **BLOCKED**: strict `=== true` on all four flags | `harness/cli.ts:310-313` |
| B4 | `integrity.*` set to truthy non-boolean (`1`) | **BLOCKED**: `=== true` is identity, not truthiness | `harness/cli.ts:310-313` |
| B5 | Auditor run with verdict `FAIL` | **BLOCKED**: not in `ACCEPTING_AUDIT_VERDICTS` | `harness/lib/validation.ts:18`, `:168` |
| B6 | Auditor run whose `agent_id` equals the implementer run's `agent_id` | **BLOCKED**: `agent_id in implementerAgents` -> not independent; gap text "shares the implementer's agent identity" | `harness/lib/validation.ts:158-172` |
| B7 | Auditor run with empty `agent_id` | **BLOCKED**: `run.agent_id &&` is falsy at both the evidence shape check and the independence `find` | `harness/cli.ts:304`, `harness/lib/validation.ts:171` |
| B8 | `apply-readiness` forged plan `from=PARK,to=READY` | **BLOCKED**: `from` not in `READINESS_FLIP_STATES` | `harness/lib/validation.ts:275` |
| B9 | `apply-readiness` forged plan `from=DONE,to=BLOCKED_DEPENDENCY` | **BLOCKED**: same `from` guard | `harness/lib/validation.ts:275` |
| B10 | `apply-readiness` forged plan `to=DONE` | **BLOCKED**: `to` guard "non-readiness target DONE" | `harness/lib/validation.ts:271` |
| B11 | Get `lifecycle verify` GREEN while a gap exists | **NOT POSSIBLE**: `status` is a single conjunction of the three error lists; the gap list is a hard input | `harness/cli.ts:363-367` |
| B12 | Implementer milestone `DONE` with **no** implementer run manifest, self-audited under one identity | **PARTIAL BYPASS (latent)**: `implementerAgents` is empty, so any valid passing auditor run with a non-empty `agent_id` closes the gap regardless of who ran it. Not live on the current ledger (every DONE implementer milestone here has a distinct-identity auditor run), so latent, not active. See ADV-1 | `harness/lib/validation.ts:158-162` |

## Test-adequacy assessment

Five regression tests were added (`test/harness.test.ts:149-204`); all pin a
distinct closure and none passes vacuously if the corresponding fix is reverted:

1. `:149` valid independent passing run -> `gaps.length === 0` (positive path).
2. `:155` `FAIL` verdict -> gap present. Reverting FIND-4 (re-adding `FAIL`)
   fails this test. Non-vacuous.
3. `:161` auditor shares implementer `agent_id` -> gap includes `"agent identity"`.
   Asserts the specific reason string; reverting FIND-2 fails it. Strong.
4. `:170` `evidence_valid:false` -> gap present. Reverting the `run.evidence_valid`
   filter in the planner fails it. Non-vacuous.
5. `:176` forged `from=PARK,to=READY` -> `applied.length === 0` **and** rejection
   string `"non-readiness source"`. Because the current status is `READY`,
   removing the `from` guard would still yield `applied=0` but with a *different*
   rejection string (`"status changed since plan"`), so the assertion on the
   specific string genuinely pins FIND-5. Strong.

Test gaps (advisory, do not block):

- The core of FIND-3 - `manifestIsValidEvidence` in `harness/cli.ts` - has **no
  unit test**. Test `:170` supplies `evidence_valid` as a precomputed boolean, so
  it exercises the planner's *consumption* of the flag, not the shape/acceptance/
  integrity logic that computes it. B1-B4 above were verified by reading the code,
  not by a shipped test. `harness/cli.ts` remains without test coverage.
- The pre-existing weak assertion at `test/harness.test.ts:234`
  (`rejected.length > 0 || applied.length === 0`) that the original audit flagged
  persists; it would still pass on a silent no-op. The `to=DONE` guard is real
  (B10) but is not strongly asserted anywhere.

## New findings

| ID | Severity | Finding |
| --- | --- | --- |
| ADV-1 | P2 (advisory) | **Independence is unverifiable without an implementer run manifest.** `implementerAgents` (`harness/lib/validation.ts:158-162`) is built only from existing implementer run manifests. If a milestone is marked `DONE` with no implementer manifest (the project's own historical pattern, per original ADV-1/FIND-8), the set is empty and any single agent can both implement (leaving no manifest) and produce a valid passing self-audit; independence is not enforced. Latent on the current ledger (every DONE implementer milestone has a distinct-identity auditor run). Robust fix: treat an absent implementer identity as a conservative blocker, or require an implementer manifest to exist. |
| ADV-2 | P2 (advisory) | **Evidence store is still git-ignored and shape-checked, not re-executed or schema-validated.** `manifestIsValidEvidence` is a hand-rolled field check; it does not validate against `harness/schemas/run-manifest.schema.json`, does not re-run the acceptance commands, and does not cross-check `task_spec_path`/`role`/`acceptance[].command` against the task spec. A determined forger with write access to the git-ignored `harness/runs/` can still craft a full run-v1 manifest with all-true integrity and PASSED acceptance. The repair raised the forgery bar substantially (the specific 3-field exploit is closed) but did not adopt the original recommendation (c) to track finished manifests in git. |
| ADV-3 | P2 (advisory) | **Governance-file drift recurs (repeat of original FIND-8).** `git show --stat 7a9b94e` shows the commit also modified `harness/ledger/tasks.json`, `harness/tasks/HARNESS-AO-AUTOMATION-REPAIR-001.json` (its **own** spec, `status: READY -> DONE`) and `harness/tasks/HARNESS-AO-AUTOMATION-REPAIR-AUDIT-001.json`. REPAIR-001's declared `write_set` is only the four code/test files, and its `forbidden_actions[3]` explicitly says "Do not modify task specs, the task ledger, run manifests". The self-promotion to `DONE` and the ledger edit are outside the write set and against that forbidden action. Bounded impact (the code gates are unaffected), but it is the same hand-editing-around-the-code pattern the original audit called out. |
| ADV-4 | P3 (advisory) | **`lifecycle plan` does not enforce the gap.** `lifecyclePlanCommand` (`harness/cli.ts:351`) still exits `0` when only `sync_errors` is empty, ignoring `audit_evidence_gaps`. Only `verify` fails closed. The original recommendation (a) asked for both. `plan` is informational, so this is minor, but a consumer gating on `plan`'s exit code would not see the gap. |

## No gate weakened

- `validateTask` / `validateLedger` are byte-unchanged by the commit (the
  `validation.ts` diff touches only the two new constants, the
  `deriveLifecyclePlan` evidence logic, and the `applyReadinessUpdates` `from`
  guard). The active write-set overlap check (`harness/lib/validation.ts:82-97`)
  is untouched.
- `verifyRun` and `finishRun` fail-closed logic (`harness/cli.ts:230-232`,
  `:253-259`) is untouched; GREEN still requires acceptance + integrity +
  deliverables.
- `git show --stat 7a9b94e` confirms the code/test write set stayed within
  `{harness/cli.ts, harness/lib/validation.ts, harness/lib/contracts.ts,
  test/harness.test.ts}`; no `src/` or `db/` business code changed. (The
  additional ledger/spec edits are the subject of ADV-3, not a code-gate change.)
- Every change tightens a gate (FIND-1..5) or is additive typing
  (`FinishedRunEvidence` in `contracts.ts`). No relaxation was found.

## Acceptance results

All five acceptance commands from the spec were executed at baseline before this
report was written, and are re-executed by `run verify`:

| # | Command | Baseline result |
| --- | --- | --- |
| 1 | `npm run harness:doctor` | PASSED (exit 0) |
| 2 | `npm run typecheck` | PASSED (exit 0) |
| 3 | `npm test` | PASSED (exit 0) |
| 4 | `npm run build` | PASSED (exit 0) |
| 5 | `git diff --check` | PASSED (exit 0) |

## Final verdict and justification

**GREEN_WITH_ADVISORY.**

The repair does what it claims. Judged against its charter - close the five
blocking findings of `HARNESS-AO-AUTOMATION-AUDIT-001` without weakening a gate -
it succeeds on every count: the audit-evidence gate now fails closed and was
observed doing so live (FIND-1); auditor/implementer identity separation is
enforced through a correctly-scoped `agent_id` comparison (FIND-2); forged,
half-finished, failed-acceptance and null-integrity manifests are all rejected
as evidence (FIND-3); a failed or parked audit no longer certifies a milestone
(FIND-4); and a forged readiness `from` is rejected (FIND-5). The regression
suite pins each closure with non-vacuous assertions, and no previously-strong
gate was loosened.

It is not `GREEN` outright because two residuals of the original findings survive
at reduced strength - independence cannot be checked for a milestone with no
implementer manifest (ADV-1), and evidence still lives in a git-ignored store
validated only by a shape check rather than re-execution or schema validation
against a tracked baseline (ADV-2) - and because the commit repeats the
governance-file / self-DONE drift the original audit recorded as FIND-8 (ADV-3).
None of these reopens a blocking finding, weakens a gate, or is live-exploitable
on the current ledger, so under the fail-closed doctrine they are advisories, not
grounds for `FAIL`. Recommended follow-ups, in priority order: (a) block or
conservatively fail closed when a DONE implementer milestone has no implementer
manifest (ADV-1); (b) validate manifests against `run-manifest.schema.json` and/or
track finished manifests in git (ADV-2); (c) route status/ledger transitions
through a mechanism that does not require an implementer to hand-edit its own spec
and the ledger outside its write set (ADV-3); (d) unit-test `manifestIsValidEvidence`
and strengthen the `:234` assertion (test gaps).
