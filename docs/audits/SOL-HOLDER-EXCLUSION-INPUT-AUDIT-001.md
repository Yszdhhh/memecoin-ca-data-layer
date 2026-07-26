# SOL-HOLDER-EXCLUSION-INPUT-AUDIT-001 - Independent audit of snapshot-aligned holder exclusion inputs

- Task ID: `SOL-HOLDER-EXCLUSION-INPUT-AUDIT-001` (T2, auditor, Solana)
- Auditor ID: `claude-auditor-holder-exclusion-input`
- Date: 2026-07-26
- Run ID: `20260726_SOL_HOLDER_EXCLUSION_INPUT_AUDIT_001`
- Audited commit: `060e6fa` ("feat(solana): close FIND-4 exclusion inputs and offline market liquidity")
- Audited implementer task: `SOL-HOLDER-EXCLUSION-INPUT-001` (status DONE)
- Closes: FIND-4 of `docs/audits/SOL-CA-ORCHESTRATION-AUDIT-001.md`

## Verdict

**GREEN_WITH_ADVISORY**

FIND-4 is substantively closed. On a complete audited snapshot the orchestrator
now derives address tags and funding-cluster exclusion inputs from the *full*
snapshot owner set (not the generic top-100 list) and from history-window
first-buys (not the 30-minute window), re-runs cluster detection, rebuilds the
audited snapshot with those inputs, and sets
`exclusionInputsAlignedToSnapshot: true` only on that path
(`src/application/analysis-service.ts:182-210`). A non-complete snapshot fails
closed onto the generic path with both explicit `..._BOUNDED_TO_..._`
warnings, null concentration, and `holderCompleteness` reflecting the true
`partial`/`unavailable` state (`src/application/analysis-service.ts:211-226`).
The complete-plus-null-concentration invariant survives
(`src/application/analysis-service.ts:221-223`) and no threshold was lowered.

The residual defects found are advisory, not gate bypasses: (a) the fix uses a
two-independent-enumeration (TOCTOU) pattern, so the exclusion-input owner set
(Pass-1) and the concentration owner set (Pass-2) can drift on a live source,
re-opening a strictly narrower version of the original FIND-4 evasion; (b) the
partial-path fail-closed warnings and the `false` alignment flag are not pinned
by any test; (c) redundant duplicate provider fetches. None is reproducible with
in-repo components, and no live source exists (`KNOWN_LIMITATIONS.md`), so the
fail-closed posture holds today.

## Scope and method

Audited implementation: commit `060e6fa`. The FIND-4 closure lives entirely in
`src/application/analysis-service.ts` (the commit also lands an unrelated
offline market-observation feature under `SOL-MARKET-OBSERVATION-001`, reviewed
only where it touches the audited file — the large-order liquidity floor).

Declared read-only inputs reviewed in full:

- `PROJECT_CONSTITUTION.md`
- `harness/tasks/SOL-HOLDER-EXCLUSION-INPUT-AUDIT-001.json` (this spec; forbidden
  actions obeyed: no source/test/fixture/ledger/task-spec modified, no network,
  no credentials)
- `harness/tasks/SOL-HOLDER-EXCLUSION-INPUT-001.json` (implementer spec)
- `docs/audits/SOL-CA-ORCHESTRATION-AUDIT-001.md` (FIND-4)
- `src/application/analysis-service.ts`
- `test/application/solana/ca-analysis-orchestration.test.ts`

Additional files read to adjudicate the two-pass concern:
`src/domain/types.ts` (evidence field), and
`src/infrastructure/solana/helius/helius-solana-adapter.ts:303-309`
(`getAuditedHolderSnapshot` delegates directly to
`source.getHolderSnapshot(token, addressTags, clusterMembers)` — each call is an
independent enumeration).

Method: line-by-line review of the diff (`git show 060e6fa -- ...`) against the
current worktree; adversarial tracing of the complete and partial paths;
correlation of claimed behavior with the pinned tests; re-run of all four
acceptance commands. This report is the sole repository write of this audit; no
commit is made.

## FIND-4 closure verdict

FIND-4 (`docs/audits/SOL-CA-ORCHESTRATION-AUDIT-001.md:196-231`) reported that
tags/clusters passed into the audited snapshot came from
`uniqueOwners(rawHolders).slice(0, 100)` and the 30-minute recent-trade window,
so an infrastructure owner present in a complete snapshot but absent from the
generic top-100 was counted as a real holder under `holderCompleteness:
"complete"` with zero warnings.

The audited change replaces that single call with a two-pass flow:

- Pass-1 enumerates the complete owner set with **no** exclusion inputs:
  `solanaAdapter.getAuditedHolderSnapshot(token, [], [])`
  (`src/application/analysis-service.ts:184`).
- When `enumerationSnapshot?.completeness === "complete"`
  (`:189`), the owner set is taken as
  `[...enumerationSnapshot.ownerBalances.keys()]` — the **full** map keys, never
  re-sliced to 100 (`:190`) — and tags/funding are fetched over that set
  (`:192-193`), cluster detection re-runs on history-window first-buys
  (`:194,198-202`), and Pass-2 rebuilds the snapshot with those inputs
  (`:205-209`).
- The generic top-100 path survives **only** for the partial fallback and for
  non-Solana / recent-large-trade wallet-quality
  (`:131-136`, `:211-214`).

The defect described by FIND-4 (top-100 truncation vs. a complete snapshot) is
therefore closed on the complete path. See the verification checklist for the
one residual, strictly narrower, concern.

## Verification checklist (audit points 1-5)

### Point 1 - Complete-snapshot path genuinely aligns: CONFIRMED

- Pass-1 empty exclusion inputs: `getAuditedHolderSnapshot(token, [], [])`
  (`src/application/analysis-service.ts:184`).
- Gate on completeness: `if (enumerationSnapshot?.completeness === "complete")`
  (`:189`).
- Full owner set, not re-sliced: `const snapshotOwners =
  [...enumerationSnapshot.ownerBalances.keys()]` (`:190`); passed verbatim to
  `getAddressTags`/`getFundingEdges` (`:192-193`). No `.slice(0, 100)` on this
  path.
- Cluster re-detection over history first-buys:
  `detectFundingClusters(snapshotFunding, firstBuyPerWallet(historyTrades), {
  funderTags: snapshotTags })` (`:198-202`).
- Snapshot rebuilt with aligned inputs: `holderSnapshot =
  await ...getAuditedHolderSnapshot(token, snapshotTags, clusterMembers)`
  (`:205-209`).
- `exclusionInputsAlignedToSnapshot = true` set only inside this branch
  (`:210`); it is initialized `false` (`:145`) and never set true elsewhere
  (verified by search: the token appears at `:145`, `:210`, `:287` only).

### Point 2 - Partial snapshot fails closed: CONFIRMED (with a test gap, see NEW-2)

When `completeness !== "complete"` the `else` branch pushes
`HOLDER_EXCLUSION_TAGS_BOUNDED_TO_GENERIC_TOP100` and
`HOLDER_EXCLUSION_CLUSTERS_BOUNDED_TO_RECENT_TRADE_WINDOW`
(`src/application/analysis-service.ts:212-213`), still builds the snapshot with
the generic inputs (`:214`), and leaves `exclusionInputsAlignedToSnapshot`
`false`. Downstream, `holderCompleteness = snapshotCompleteness(holderSnapshot)`
(`:217`) reflects the true `partial`/`unavailable` state, concentration is not
adopted (`:218-226`), and `HOLDER_CONCENTRATION_INDETERMINATE` plus the
snapshot's own warnings propagate (`:224-225`). No path sets the alignment flag
true on non-complete data. The partial test
(`test/application/solana/ca-analysis-orchestration.test.ts:184-195`) confirms
`holders===null`, `holderCompleteness==="partial"`, `dev===null`, zero dev
requests — but does **not** assert the two bounded warnings nor the `false`
alignment flag (NEW-2).

### Point 3 - No double-exclusion / no weaker gate: CONFIRMED

The Pass-2 `getAuditedHolderSnapshot` call passes the same
`snapshotTags`/`clusterMembers` shape as before; no threshold argument exists to
lower, and `detectFundingClusters` is called with the same default options
(`src/application/analysis-service.ts:198-202`) — the forbidden action "do not
lower the high-confidence cluster exclusion threshold" is respected. The
adoption gate is unchanged: concentration is taken only on `completeness ===
"complete" && concentration !== null` (`:218`). The FIND-2/original-audit
invariant "complete + null concentration -> `holderCompleteness` downgraded to
`unavailable`" survives verbatim (`:221-223`). No code path treats a complete
snapshot with null concentration as usable.

### Point 4 - History window correctness: CONFIRMED (observation on epoch fallback)

`historySince = token.createdAt ?? new Date(0)`
(`src/application/analysis-service.ts:122`). The aligned path feeds first-buys
from `getRecentTrades(token, historySince)` (`:194`) into
`firstBuyPerWallet(historyTrades)` (`:200`), i.e. from token creation, not the
30-minute `since` window used for the generic/large-order path (`:119,127`).
Observation: when `createdAt` is null, `historySince` is `new Date(0)` (epoch),
which is *correct for completeness* (full history, fails toward more exclusion,
not less) but is an unbounded lower bound that a live provider would translate
into an expensive/unbounded fetch. This mirrors the pre-existing
`getTransfers(token, historySince)` fallback (`:128`) and is safe for the
fail-closed contract; it is a live-cost consideration, not a correctness defect.

### Point 5 - Test pins: PARTIALLY PINNED (see NEW-2)

The complete-path behavior is pinned:
`result.walletCleaningEvidence?.exclusionInputsAlignedToSnapshot === true` and
both bounded warnings asserted **absent**
(`test/application/solana/ca-analysis-orchestration.test.ts:178-180`). The test
diff shows exactly this flip (previously the two warnings were asserted
*present*). Gaps: (a) the partial test does not assert the two bounded warnings
are *present* nor that the flag is `false`; (b) the fixture snapshot has only
three owners, so "full owner set, not sliced to 100" and "Pass-1 owner set ==
Pass-2 owner set" are not exercisable — the alignment is pinned as a behavioral
flag, not as an observable change in the excluded owner set. See NEW-2.

## New findings

### NEW-1 [Advisory / Low, latent] - Two independent enumerations create a TOCTOU gap that can re-open a narrower FIND-4

`getAuditedHolderSnapshot` delegates straight to
`source.getHolderSnapshot(token, addressTags, clusterMembers)`
(`src/infrastructure/solana/helius/helius-solana-adapter.ts:303-309`); it does
not accept a pre-enumerated owner set. The orchestrator therefore enumerates
twice: Pass-1 to derive `snapshotOwners`
(`src/application/analysis-service.ts:184,190`) and Pass-2 to compute the final
concentration (`:205-209`). Tags/clusters are fetched over the **Pass-1** owner
set, but the adopted concentration is computed over the **Pass-2** enumeration.

Failure scenario (live source only): if a new owner appears — or enumeration is
non-deterministic — between the two calls, Pass-2 can contain an owner whose tag
was never fetched (it was not in the Pass-1 set). That owner's balance is then
counted as a real holder in a snapshot labelled `complete` with
`exclusionInputsAlignedToSnapshot: true` and no warning — the exact FIND-4
evasion shape, now bounded to the (small) set of owners that drift into the
snapshot during the inter-call window rather than the whole tail beyond the top
100. The alignment flag consequently *over-claims*: it asserts input/snapshot
alignment that only holds when the two enumerations are identical.

Not reproducible in-repo: the fixture returns the same `completeSnapshot()` for
every `getHolderSnapshot` call
(`test/application/solana/ca-analysis-orchestration.test.ts:136`), so Pass-1 and
Pass-2 owner sets are identical, and no live source exists
(`KNOWN_LIMITATIONS.md`). Recommended remediation before any live source is
wired: have the snapshot port expose a single enumeration whose owner set both
seeds exclusion-input fetching and produces the concentration (e.g. an
`enumerate()` -> `applyExclusions(owners, tags, clusters)` split), or assert
Pass-2's owner set is a subset of the tagged Pass-1 set (and fail closed /
warn otherwise) so `exclusionInputsAlignedToSnapshot` cannot over-claim.

### NEW-2 [Advisory / Low] - Partial fail-closed warnings and the false alignment flag are unpinned

The partial-path warnings
`HOLDER_EXCLUSION_TAGS_BOUNDED_TO_GENERIC_TOP100` /
`HOLDER_EXCLUSION_CLUSTERS_BOUNDED_TO_RECENT_TRADE_WINDOW`
(`src/application/analysis-service.ts:212-213`) and
`exclusionInputsAlignedToSnapshot === false` are asserted by no test. The
partial test (`test/application/solana/ca-analysis-orchestration.test.ts:184-195`)
pins only null holders/`partial` completeness. A future refactor could drop the
bounded warnings or leave the flag stale on the partial path with the suite
still green. Point-2 behavior is therefore code-correct but not regression-locked.

### NEW-3 [Advisory / Informational] - Redundant duplicate provider fetches

On every Solana analysis the generic `getAddressTags` + `getFundingEdges`
(`src/application/analysis-service.ts:133-136`) and the initial
`detectFundingClusters` (`:139-143`) are always computed, then on the complete
path are entirely overwritten (`:196-203`) — and `getAuditedHolderSnapshot` is
called twice (Pass-1 enumeration + Pass-2 rebuild). This doubles snapshot/tag/
funding provider calls versus the pre-fix single-call flow. No correctness
impact (results are deterministic offline); a live-cost/latency consideration
worth folding into the NEW-1 remediation.

## Advisory to record (audit point 6)

Implementer task `SOL-HOLDER-EXCLUSION-INPUT-001` is marked `status: DONE`
without a finished implementer harness run manifest accompanying the audited
commit. This independent audit run
(`20260726_SOL_HOLDER_EXCLUSION_INPUT_AUDIT_001`) supplies the missing
verification of the acceptance commands against commit `060e6fa`.

## Acceptance results (audit point 7)

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS - 118 tests pass / 0 fail |
| `npm run build` | PASS |
| `git diff --check` | PASS (clean; no whitespace errors) |

Working tree was clean before the run and remained clean through review (build
output is gitignored).

## Final verdict and justification

**GREEN_WITH_ADVISORY.** The FIND-4 remediation is real and correctly
fail-closed: complete snapshots align exclusion inputs to the full owner set and
history-window first-buys and flag it; partial/unavailable snapshots fall back
to the generic path with explicit warnings and never adopt concentration or
claim alignment; the complete-plus-null invariant and the high-confidence
cluster threshold are untouched; all four acceptance commands pass. The verdict
is advisory rather than clean GREEN because of NEW-1 (a two-enumeration TOCTOU
that can re-open a strictly narrower FIND-4 on a live source and lets the
alignment flag over-claim) and NEW-2 (the partial-path fail-closed behavior is
unpinned), both of which must be resolved before any live Solana source is
wired, together with the informational NEW-3. None of these is a
present-day gate bypass with in-repo components, so the change does not fail
closed-open today.

This audit does not constitute Solana end-to-end acceptance.
