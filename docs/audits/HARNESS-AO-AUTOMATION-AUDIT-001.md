# HARNESS-AO-AUTOMATION-AUDIT-001 - Independent audit of the deterministic offline harness lifecycle

## Verdict

**FAIL**

The lifecycle implementation delivered by `HARNESS-AO-AUTOMATION-001` (commit
`1253b2c`) does not meet its own declared objective to "fail closed on missing
independent-audit evidence" and does not satisfy this audit's acceptance
criterion that lifecycle state be derived "only from verified manifests and
declared dependencies" without bypassing the independent-auditor gate. Four
blocking (P1) defects were confirmed by direct execution against the shipped
production code paths, not by inspection alone:

1. `audit_evidence_gaps` is computed but **enforces nothing** - both
   `lifecycle plan` and `lifecycle verify` return status `GREEN` and exit code
   `0` on the real repository while three T2 implementer milestones sit `DONE`
   with no completed audit.
2. The lifecycle path **never reads `agent_id`**, so an implementer agent
   auditing its own T2 milestone satisfies the evidence check - a direct
   violation of `PROJECT_CONSTITUTION.md:32` and of the implementer spec's own
   forbidden action "bypass auditor-agent identity separation".
3. Audit evidence is harvested from `harness/runs/*/manifest.json`, a
   **git-ignored, schema-unvalidated** location; a hand-forged three-field JSON
   object is accepted as proof that an independent audit occurred.
4. A **`FAIL` auditor verdict counts as satisfying** the audit-evidence
   requirement, so a failed audit silently closes the gap it should widen.

Nothing in the current repository state has been corrupted: no readiness flip is
currently proposed, `PARK`/`BLOCKED_STAGE` tasks are correctly never runnable,
dependency semantics are correctly conservative on unknown/cyclic/self/PARK
dependencies, `to: "DONE"` is genuinely rejected in production code, and
`sync_errors` genuinely block all writes. The defects are in the gate's
strength, not in present-state damage. But under the project's fail-closed
doctrine, a gate that reports `GREEN` while its own evidence requirement is
unmet, and that has no notion of auditor independence at all, cannot be accepted
as the automation control point it was commissioned to be. Verdict is `FAIL`
rather than `GREEN_WITH_ADVISORY`.

## Header

| Field | Value |
| --- | --- |
| Audit task | `HARNESS-AO-AUTOMATION-AUDIT-001` (T2, auditor, chain `null`) |
| Auditor agent | `claude-auditor-harness-lifecycle` (independent of implementer; commit `1253b2c` is co-authored `Grok (xAI)`) |
| Date | 2026-07-26 |
| Harness run | `harness/runs/20260726_HARNESS_AO_AUTOMATION_AUDIT_001` |
| Audited implementation commit | `1253b2c` ("feat: advance wallet cleaning, harness lifecycle, and E2E gap research") |
| Audited task spec | `harness/tasks/HARNESS-AO-AUTOMATION-001.json` (status `DONE`) |
| Tree state audited / acceptance HEAD | `dc7da4e` (clean tree at run start) |
| Implementer harness run | **NONE EXISTS** - see ADV-1; this audit run supplies the missing verification |

## Scope and methodology

- Clean-tree check (`git status --short` empty) before `run start`; the harness
  run was started with this auditor's own `HARNESS_AGENT_ID`.
- Read in full: `harness/tasks/HARNESS-AO-AUTOMATION-AUDIT-001.json` (this
  audit's spec and forbidden actions), `harness/tasks/HARNESS-AO-AUTOMATION-001.json`,
  `PROJECT_CONSTITUTION.md`, `PROJECT_OPERATING_PLAYBOOK.md`,
  `harness/lib/validation.ts`, `harness/lib/contracts.ts`, `harness/lib/files.ts`,
  `harness/cli.ts`, `harness/ledger/tasks.json`, `test/harness.test.ts`,
  `.gitignore`.
- Reviewed the implementation diff via
  `git show 1253b2c -- harness/cli.ts harness/lib/validation.ts harness/lib/contracts.ts test/harness.test.ts`,
  plus the commit's full `--stat` for write-set compliance.
- **Adversarial execution**: eleven exploit attempts (E1-E10 below) were run
  against the **real exported production functions** `deriveLifecyclePlan` and
  `applyReadinessUpdates` imported from `harness/lib/validation.ts`, from a
  throwaway script outside the repository. No repository file was modified by
  these attempts; every write path was intercepted with in-memory callbacks.
  This distinguishes real production behaviour from what the shipped tests merely
  assert.
- **Read-only CLI exercise**: `npx tsx harness/cli.ts lifecycle plan` and
  `lifecycle verify` were executed against the live ledger and their exit codes
  captured. `lifecycle apply-readiness` was **not** executed (it writes).
- Forbidden actions observed: no agents, Agent Orchestrator, model gateways,
  network APIs, browsers, providers, credentials, package registries or live
  data sources were called. Only `docs/audits/HARNESS-AO-AUTOMATION-AUDIT-001.md`
  was written. No commit was made.

### Live CLI output (read-only, current ledger)

```
$ npx tsx harness/cli.ts lifecycle verify
{ "status": "GREEN", "ledger_errors": [], "sync_errors": [],
  "audit_evidence_gaps": [
    "HARNESS-AO-AUTOMATION-001: implementer DONE but auditor task HARNESS-AO-AUTOMATION-AUDIT-001 is READY without a finished auditor run",
    "SOL-HOLDER-EXCLUSION-INPUT-001: ... without a finished auditor run",
    "SOL-MARKET-OBSERVATION-001: ... without a finished auditor run" ],
  "readiness_updates": [], "runnable_count": 4 }
exit code: 0            <-- GREEN and exit 0 with three outstanding gaps
$ npx tsx harness/cli.ts lifecycle plan   -> exit code: 0
```

Sanity check against the ledger passed on the mechanical parts: the four
`runnable` entries are exactly the `READY` tasks whose declared dependencies are
all `DONE`; `BSC-STAGE-001` and `ROBIN-STAGE-001` remain `not_runnable` with
`status BLOCKED_STAGE`; `SOL-E2E-001`, `SEC-HARNESS-CONTENT-SCAN-001` and
`MACRO-DAILY-LIVE-PREFLIGHT-001` remain `not_runnable` with `status PARK`;
`sync_errors` is empty and matches the ledger/spec pairs. The failure is not in
the arithmetic - it is that the gap list is decorative.

## Bypass-attempt matrix

| # | Attempted exploit | Outcome | Evidence (file:line) |
| --- | --- | --- | --- |
| E1 | Present a hand-forged "manifest" with only `{task_id, role:"auditor", status:"GREEN"}` - wrong schema, no `schema_version`, no `agent_id`, no acceptance/integrity records - as audit evidence | **EXPLOIT CONFIRMED**: `audit_evidence_gaps` empties. Evidence tuple is `Pick<RunManifest,"task_id"\|"role"\|"status">` only; nothing else is ever inspected | `harness/lib/validation.ts:103`, `harness/lib/validation.ts:149-154`, `harness/cli.ts:294-316` |
| E2 | Supply an auditor run whose verdict is `FAIL` | **EXPLOIT CONFIRMED**: gap closes. `ACCEPTING_AUDIT_VERDICTS` includes `"FAIL"` | `harness/lib/validation.ts:16`, `harness/lib/validation.ts:152-153` |
| E2b | Supply an auditor run whose verdict is `PARK` | Safe - `PARK`/`QUARANTINED` are outside the accepting set (but see FIND-4: this makes the set incoherent, since `PARK` is also a *finished* run) | `harness/lib/validation.ts:16` |
| E3 | Hand-mark the auditor task `DONE` in spec+ledger with **zero** run manifests in existence | **EXPLOIT CONFIRMED**: the gap disappears. The loop `continue`s on `statusOf(taskId) === "DONE"` before any evidence is sought | `harness/lib/validation.ts:144` |
| E4 | Feed `applyReadinessUpdates` a forged plan flipping a `PARK` task to `READY` (Owner/T3 gate) | **EXPLOIT CONFIRMED at library boundary**: `applied=["SOL-PARKED-001:PARK->READY"]`. Only `update.to` is validated; `update.from` is trusted and merely compared against current status. Not reachable through the shipped CLI, which always passes a planner-derived plan | `harness/lib/validation.ts:250-263` vs. doc-comment claim at `harness/lib/validation.ts:229` and `harness/lib/contracts.ts:110` |
| E5 | Forged plan reopening a `DONE` task to `BLOCKED_DEPENDENCY` | **EXPLOIT CONFIRMED at library boundary**: `applied=["SOL-DONE-001:DONE->BLOCKED_DEPENDENCY"]` | `harness/lib/validation.ts:250-263` |
| E6 | Forged plan with `to: "DONE"` (the case `test/harness.test.ts:105-134` claims to cover) | Safe - production code rejects with `refusing non-readiness target DONE`. The guard is real, **not** an artifact of the test's object shape | `harness/lib/validation.ts:250-252` |
| E7 | Make the second `writeSpec` throw mid-apply (disk full / crash) | **DRIFT CONFIRMED**: with 2 proposed flips, spec #1 is already flushed to disk as `READY`, the ledger is never written, and the exception escapes uncaught. No temp+rename, no rollback - the design's atomicity requirement is unimplemented. Mitigating: ledger-last ordering *was* implemented, and the resulting drift is detected as `sync_errors` on the next run, which then blocks all further applies | `harness/lib/validation.ts:264-270`, `harness/lib/files.ts:28-33` (plain `writeFile`) |
| E8 | Apply a plan while `sync_errors` is non-empty | Safe - returns before constructing `nextLedger`; **no** write callback is invoked at all (verified by instrumenting both callbacks) | `harness/lib/validation.ts:239-241` |
| E9 | Offer an `implementer`-role manifest as audit evidence | Safe - `run.role === "auditor"` is required. But note the role is copied from the task spec at run start, so the *same agent* running the audit task produces `role:"auditor"` evidence (see FIND-2) | `harness/lib/validation.ts:151`, `harness/cli.ts:136-137` |
| E10 | Self-dependency; a 2-cycle (A->B->A); unknown dependency id; dependency on a `PARK` task | Safe - all four remain non-runnable and are correctly proposed for `READY -> BLOCKED_DEPENDENCY`. `statusOf` returns `null` for unknown ids and for any ledger/spec mismatch, which is treated as a blocker | `harness/lib/validation.ts:124-140` |

## Findings

| ID | Severity | Finding and concrete failure scenario |
| --- | --- | --- |
| FIND-1 | **P1** | **The audit-evidence gate is non-enforcing.** `lifecycle verify` computes `status` from `ledgerErrors` and `sync_errors` only; `audit_evidence_gaps` is printed and discarded (`harness/cli.ts:332`). `lifecycle plan` likewise exits `0` unless `sync_errors` is non-empty (`harness/cli.ts:323`). *Scenario*: today, on the real repository, `lifecycle verify` prints `"status": "GREEN"` and exits `0` while `HARNESS-AO-AUTOMATION-001`, `SOL-HOLDER-EXCLUSION-INPUT-001` and `SOL-MARKET-OBSERVATION-001` are all `DONE` with no completed audit. Any AO or operator gating on the exit code proceeds. Compounding this, a task depending directly on an unaudited-but-`DONE` implementer task is derived `runnable` (`harness/lib/validation.ts:132-140, 201-207`), because dependency satisfaction tests `status === "DONE"` and never consults `audit_evidence_gaps`. The implementer spec objective demanded exactly the opposite: "fail closed on missing independent-audit evidence". |
| FIND-2 | **P1** | **No auditor/implementer identity separation anywhere in the lifecycle path.** `agent_id` is written once at run start (`harness/cli.ts:137`) and never read by any consumer - it is not even carried into the evidence tuple (`harness/lib/validation.ts:103`, `harness/cli.ts:310`). *Scenario*: the agent that implemented `SOL-X-001` starts the `SOL-X-AUDIT-001` run under its own id, finishes it `GREEN`, and `deriveLifecyclePlan` records the milestone as audited. This violates `PROJECT_CONSTITUTION.md:32` ("The implementer cannot be the sole final auditor of a Solana milestone"), `PROJECT_OPERATING_PLAYBOOK.md:66` ("a milestone has an auditor other than its implementer"), and the implementer spec's own forbidden action "bypass auditor-agent identity separation". |
| FIND-3 | **P1** | **Audit evidence is read from an unverified, git-ignored, schema-unvalidated store.** `.gitignore:7` excludes `harness/runs/*` entirely (`git ls-files harness/runs` returns only `.gitkeep`), so no manifest is part of the git-verified baseline. `loadFinishedRuns` accepts any parseable JSON whose `status !== "RUNNING"`, with no `schema_version` check, no required-field check, no cross-check of `task_spec_path`/`role` against the task spec, and no inspection of `acceptance` or `integrity` (`harness/cli.ts:303-314`). The repo ships `harness/schemas/run-manifest.schema.json` but **no code loads it** (grep: referenced only as an `inputs` string in a task spec). *Scenario*: `mkdir harness/runs/x && echo '{"task_id":"SOL-X-AUDIT-001","role":"auditor","status":"GREEN"}' > harness/runs/x/manifest.json` produces a clean lifecycle report with no gap, leaves the git tree clean, and passes `harness:doctor`. The `finishRun` fail-closed GREEN gate (`harness/cli.ts:252-259`) is bypassed entirely because the file was never produced by `finishRun`. This defeats the audit's core criterion "state only from **verified** manifests". |
| FIND-4 | **P1** | **A `FAIL` auditor verdict satisfies the audit-evidence requirement.** `ACCEPTING_AUDIT_VERDICTS = {GREEN, GREEN_WITH_ADVISORY, FAIL}` (`harness/lib/validation.ts:16`). The set is also internally incoherent: if the criterion is "a run finished" then `PARK` and `QUARANTINED` also qualify and are wrongly excluded; if the criterion is "the audit passed" then `FAIL` must be excluded. *Scenario*: `harness/runs/20260726_SOL_CA_ORCH_AUDIT_001` really is a `FAIL` auditor manifest present in this repository right now - under this rule it counts as evidence that `SOL-CA-ORCHESTRATION-001` was satisfactorily audited. A milestone whose independent audit **failed** is indistinguishable from one that passed. |
| FIND-5 | P2 | **`applyReadinessUpdates` validates only the target status, never the legality of the source status.** The guard set is `{READY, BLOCKED_DEPENDENCY}` on `update.to` (`harness/lib/validation.ts:250-252`); `update.from` is attacker-supplied and only checked for agreement with the current on-disk status (`:260-263`). E4/E5 confirm `PARK -> READY` and `DONE -> BLOCKED_DEPENDENCY` are applied. Not reachable via the shipped CLI (which always supplies a planner-derived plan whose `from` is constrained to `{READY, BLOCKED_DEPENDENCY}` at `:186-190`), so this is latent rather than live. *Scenario*: the AO integration this task exists to enable passes an AO-authored or cached plan, and an Owner `PARK` gate is silently reopened. The function's own doc-comment ("Apply only READY <-> BLOCKED_DEPENDENCY flips") is false as written. |
| FIND-6 | P2 | **Apply is non-atomic with no rollback, contrary to the spec's "atomically keep task specs and the ledger in sync".** Specs are written one-by-one inside the loop and the ledger last (`harness/lib/validation.ts:264-270`); `writeJson` is a plain `writeFile` with no temp+rename (`harness/lib/files.ts:28-33`). E7 confirms a mid-loop failure leaves N spec files flipped on disk against a stale ledger, with the exception escaping uncaught. Partially mitigated: ledger-last ordering means the drift is loud, not silent - the next `lifecycle plan`/`verify` reports it as `sync_errors` and every subsequent apply is refused (E8). Manual repair is still required. |
| FIND-7 | P2 | **`apply-readiness` writes without validating specs or ledger.** `lifecycle plan` and `lifecycle apply-readiness` call `loadSpecs` (`harness/cli.ts:286-292`) with no `validateTask`, and only `lifecycle verify` runs `validateLedger` (`harness/cli.ts:330`). The write path therefore never checks task-spec schema validity, path-escape rules, stage-lock rules or active write-set overlap before mutating specs and the ledger. Impact is bounded by the `to`-guard, but the write command is the least-validated of the three. |
| FIND-8 | P2 | **Write-set drift in the implementer commit, including self-promotion to `DONE`.** `HARNESS-AO-AUTOMATION-001` declared `write_set = {harness/cli.ts, harness/lib/contracts.ts, harness/lib/validation.ts, harness/schemas/run-manifest.schema.json, harness/schemas/task-spec.schema.json, test/harness.test.ts}`. The four code/test files stayed **in bounds** (verified by `git show --stat 1253b2c`) and the two schemas were untouched (permitted). But the same commit also modified the harness-governance files `harness/ledger/tasks.json`, `harness/tasks/HARNESS-AO-AUTOMATION-001.json` (its **own** spec, `status: READY -> DONE`), `harness/tasks/HARNESS-AO-AUTOMATION-AUDIT-001.json`, `harness/CURRENT_WAVE.md` and `KNOWN_LIMITATIONS.md` - none in the write set. *Scenario*: this is precisely the "never auto-DONE" invariant the code enforces, performed by hand around the code. Because no implementer run manifest exists (ADV-1), `verifyRun`'s `OUT_OF_SCOPE` detection (`harness/cli.ts:180-182`) never executed for this task. |

### Advisories

| ID | Advisory |
| --- | --- |
| ADV-1 | **`HARNESS-AO-AUTOMATION-001` was marked `DONE` with no implementer harness run manifest.** `harness/runs/` contains no manifest for that task id. Consequently its write-scope, acceptance, secret-scan and deliverable gates were never executed by the harness itself. This audit run supplies the missing verification: all five acceptance commands were executed here and pass. Corroborates FIND-8. |
| ADV-2 | **Process: multiple tasks bundled in one commit.** `1253b2c` mixes `HARNESS-AO-AUTOMATION-001` with `SOL-WALLET-CLEANING-003` and `SOL-E2E-GAP-RESEARCH-002` across 20 files, which defeats per-task write-set attribution and makes a per-task revert impossible. |
| ADV-3 | **Nondeterminism in a task titled "deterministic".** `generated_at_utc` (`harness/lib/validation.ts:220`) and the ledger's `updated_at_utc` (`harness/lib/validation.ts:245`) each call `new Date().toISOString()` directly; there is no `--now` flag or injected clock. Plan output is therefore not byte-stable and cannot be fixture-diffed. No injection vector was found (the value is never parsed or used in a comparison), so this is a testability/reproducibility defect, not a security one. Related hand-editing artifact: `1253b2c` moved the ledger's `updated_at_utc` **backwards**, `11:50:00.000Z -> 11:49:06.000Z`. |
| ADV-4 | **No JSON schema for `lifecycle-plan-v1`.** `harness/schemas/` holds only `run-manifest.schema.json` and `task-spec.schema.json`. The new `LifecyclePlan` contract (`harness/lib/contracts.ts:93-116`) is versioned in TypeScript only, so any consumer of the emitted plan has nothing to validate against. |
| ADV-5 | `IN_PROGRESS` tasks whose dependencies regress are reported in `not_runnable` but never receive a `BLOCKED_DEPENDENCY` flip proposal (`harness/lib/validation.ts:186-190`). Conservative and safe; recorded only so it is not mistaken for an oversight later. |

## Test gaps

`test/harness.test.ts` gained three lifecycle tests (`:57`, `:105`, `:136`). They
cover the happy path, the mismatch path and the `to: "DONE"` rejection. Every
confirmed exploit above is untested:

1. **Weak assertion in the flagship negative test.** `test/harness.test.ts:133`
   asserts `result.rejected.length > 0 || result.applied.length === 0`. This
   passes whenever nothing is applied, *regardless of whether the DONE flip was
   rejected for the right reason* - it would still pass if the function silently
   no-opped. The production guard happens to be real (E6), but the test does not
   establish that. It should assert on the rejection string.
2. No test that a `FAIL` auditor verdict is (or is not) accepted as evidence
   (FIND-4).
3. No test that a malformed / minimal / forged manifest is rejected (FIND-3).
4. No test involving `agent_id` at all - auditor independence is untested
   because it is unimplemented (FIND-2).
5. No test asserting the **exit code / status** of `lifecycle plan` or
   `lifecycle verify` when `audit_evidence_gaps` is non-empty (FIND-1).
6. No test for forged `from` values: `PARK -> READY`, `DONE -> BLOCKED_DEPENDENCY`
   (FIND-5).
7. No partial-write / rollback / crash-midway test (FIND-6).
8. No test for dependency edge cases: unknown id, cycle, self-dependency,
   dependency on `PARK`. These behave correctly today (E10) but are unpinned and
   free to regress.
9. No test that `PARK` / `BLOCKED_STAGE` tasks never appear in `runnable` and
   never receive readiness flips - the bsc/robinhood stage-lock chain is
   verified only indirectly via `validateTask`.
10. **`harness/cli.ts` has no test coverage whatsoever.** `loadFinishedRuns`
    (`RUNNING` exclusion, corrupt-JSON skip, dot-directory skip), `loadSpecs`,
    and all three lifecycle command wrappers - including the exit-code logic that
    constitutes FIND-1 - are exercised by no test.

## Acceptance results

All five acceptance commands declared in
`harness/tasks/HARNESS-AO-AUTOMATION-AUDIT-001.json` were executed at baseline
before the report was written, and are re-executed by `run verify`:

| # | Command | Baseline result |
| --- | --- | --- |
| 1 | `npm run harness:doctor` | PASSED (exit 0, `"status": "GREEN"`) |
| 2 | `npm run typecheck` | PASSED (exit 0) |
| 3 | `npm test` | PASSED (exit 0) |
| 4 | `npm run build` | PASSED (exit 0) |
| 5 | `git diff --check` | PASSED (exit 0) |

Note that a green acceptance suite is *consistent with* this FAIL verdict: the
shipped tests do not encode any of the invariants that were breached, which is
itself the substance of the test-gap section.

## Final verdict and justification

**FAIL.**

The task under audit was commissioned to be the automation gate that keeps
milestone state honest without a human in the loop. Judged as an offline
planner, its mechanics are sound: dependency semantics are conservative,
`sync_errors` genuinely fail closed and block every write, `to: "DONE"` is
genuinely refused in production code, Owner `PARK` and stage-locked
`BSC`/`ROBIN` chains are never derived runnable, and the current repository
state is undamaged. Judged as a *gate*, it fails on its two defining
requirements. It does not fail closed on missing independent-audit evidence -
it prints `GREEN` and exits `0` with three such gaps outstanding today
(FIND-1). And it has no concept of auditor independence at any point in the
path (FIND-2), while sourcing its evidence from a git-ignored, unvalidated
directory in which a three-line hand-written file is indistinguishable from a
verified run (FIND-3) and a failed audit reads the same as a passed one
(FIND-4).

This audit's spec forbids accepting an implementation that "infers a completed
dependency, self-audits a T2 milestone, changes a T3 Owner gate, or silently
repairs a mismatched ledger/spec pair". The implementation does not silently
repair mismatches and does not change Owner gates through any CLI path - but it
does permit a self-audited T2 milestone to be recorded as audited. Under the
fail-closed rule, that alone forecloses `GREEN_WITH_ADVISORY`.

Recommended closure conditions for a repair task, in priority order: (a) make
`audit_evidence_gaps` non-empty force a non-zero exit and a `FAIL` status in
both `plan` and `verify`, and block dependent tasks from being derived runnable;
(b) carry `agent_id` into the evidence tuple and require the auditor run's
`agent_id` to differ from every implementer run's `agent_id` for the audited
task; (c) validate candidate manifests against `run-manifest.schema.json` and
require `integrity.*` true plus all `acceptance[].status === "PASSED"`, and
consider tracking finished manifests in git so evidence is part of the verified
baseline; (d) remove `FAIL` from `ACCEPTING_AUDIT_VERDICTS` and define the set
by intent; (e) constrain `update.from` in `applyReadinessUpdates`; (f)
temp+rename with rollback for the spec/ledger write set; (g) pin every case in
the test-gap list.
