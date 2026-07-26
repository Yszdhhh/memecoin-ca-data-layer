# SOL-WALLET-CLEANING-FUNDER-TAGS-AUDIT-001 - Independent audit of funder-tag coverage repair

## Verdict

**GREEN**

The repair delivered under `SOL-WALLET-CLEANING-FUNDER-TAGS-001` (commit
`6dd65fe`, "fix(solana): fetch funder tags so service-funder suppression
fires") fully closes `SOL-WALLET-CLEANING-AUDIT-003` FIND-1. Funder-address
tags are now fetched in **both** the generic top-100 pass and the
snapshot-aligned pass, merged into a dedicated `funderTags` list, and passed to
`detectFundingClusters`; a non-holder exchange hot wallet that funds buyers is
now tagged and suppressed instead of being clustered. The holder-exclusion path
is provably unchanged: `getAuditedHolderSnapshot` still receives the owner-only
`addressTags`, never `funderTags`, so a tagged funder that is not a holder
cannot over-exclude legitimate holders. No threshold was lowered — the 0.85
cluster-exclusion gate (`real-holders.ts:37,45`) and the 0.8 service-funder tag
gate (`funding-clusters.ts:18`) are byte-identical to pre-change. The exclusion
warning now counts only members at confidence >= 0.85, mirroring the real
exclusion gate. The three new regression tests are genuinely differential: the
non-holder-funder test uses an address-**respecting** tag mock that would fail
under the old holder-only code, unlike the pre-existing masked test. All four
acceptance commands pass on the audited tree (typecheck, 126 tests, build,
`git diff --check`).

No new blocking findings. One informational observation (the pre-existing
over-returning test mock remains in the file but is now superseded by a
correct differential test) is recorded below and does not change the verdict.

## Header

| Field | Value |
| --- | --- |
| Audit task | `SOL-WALLET-CLEANING-FUNDER-TAGS-AUDIT-001` (T2, auditor, solana) |
| Auditor agent | `claude-auditor-funder-tags` (independent of implementer `claude-fable-implementer`) |
| Date | 2026-07-27 |
| Harness run | `harness/runs/20260727_SOL_WALLET_CLEANING_FUNDER_TAGS_AUDIT_001` |
| Audited commit | `6dd65fe` ("fix(solana): fetch funder tags so service-funder suppression fires (SOL-WALLET-CLEANING-FUNDER-TAGS-001)") |
| Closes | `SOL-WALLET-CLEANING-AUDIT-003` FIND-1 (P2) |
| Tree state audited | `6dd65fe` (HEAD; clean working tree at `start`) |

## Scope and methodology

- Clean-tree check (`git status --short` empty) before `start`; harness run
  started with this auditor's agent id.
- Read `PROJECT_CONSTITUTION.md`, the audit task spec, the repair task spec
  (`harness/tasks/SOL-WALLET-CLEANING-FUNDER-TAGS-001.json`), and
  `docs/audits/SOL-WALLET-CLEANING-AUDIT-003.md` FIND-1.
- Read the full repair diff (`git show 6dd65fe`) plus current
  `src/application/analysis-service.ts`, `src/domain/rules/funding-clusters.ts`,
  `src/domain/rules/real-holders.ts`, `src/domain/types.ts`, and
  `test/application/solana/wallet-cleaning-evidence.test.ts`.
- Ran all four acceptance commands on the audited tree for baseline.

## FIND-1 closure verdict

**CLOSED.** The AUDIT-003 FIND-1 defect was that `getAddressTags` was only ever
called with holder/owner addresses, so a non-holder exchange hot-wallet funder
was never tagged and service-funder suppression (`funding-clusters.ts:50,55`,
lookup by `edge.funder`) could never fire, wrongly clustering exchange
fan-outs. The repair queries tags for the distinct funder set in both detection
passes and feeds them to `detectFundingClusters`. Verified across every code
path (generic-only, snapshot-complete, and snapshot-incomplete fallback), the
cluster detection whose members drive exclusion now sees funder tags.

## Verification of audit points

### Point 1 — Funder tags fetched in BOTH passes, separated from holder exclusion — PASS

- Generic pass: `analysis-service.ts:133-149`. `genericFunders =
  uniqueFunders(genericFunding)` (`:137`); tags fetched via
  `adapter.getAddressTags(token, genericFunders)` guarded on non-empty
  (`:140`); `funderTags = mergeTags(genericOwnerTags, genericFunderTags)`
  (`:143`) passed as `{ funderTags }` to `detectFundingClusters` (`:145-149`).
- Snapshot-aligned pass: `analysis-service.ts:204-215`. `snapshotFunders =
  uniqueFunders(snapshotFunding)` (`:204`); `snapshotFunderTags` fetched
  guarded (`:205-207`); `funderTags = mergeTags(snapshotOwnerTags,
  snapshotFunderTags)` (`:209`) passed to `detectFundingClusters` (`:211-215`).
- **Holder-exclusion separation (key correctness point) — confirmed.**
  `getAuditedHolderSnapshot` receives `addressTags` only: pass-1 enumeration
  with `[]` (`:190`), snapshot pass-2 with `addressTags` = `snapshotOwnerTags`
  (`:208`, `:218-222`), fallback with `addressTags` (`:227`). `funderTags` is
  never passed to the holder snapshot service, so a tagged non-holder funder
  cannot enter the holder-exclusion tag set and cannot over-exclude legitimate
  holders. The wallet-quality-out-of-exclusion invariant from AUDIT-003 is
  preserved.

### Point 2 — Exclusion warning counts only members >= 0.85 — PASS

`analysis-service.ts:305-308`: `excludedClusterCount =
clusterMembers.filter((member) => member.confidence >=
CLUSTER_EXCLUSION_MIN_CONFIDENCE).length`, with
`CLUSTER_EXCLUSION_MIN_CONFIDENCE = 0.85` (`:350`) and the warning gated on
`excludedClusterCount > 0`. It no longer uses raw `clusterMembers.length`. The
constant is an exact mirror of the real exclusion gate in
`real-holders.ts:37,45` (`member.confidence >= minClusterConfidence`,
default `0.85`, `>=`), so the warning count now equals the number of members
actually excluded.

### Point 3 — No threshold lowered; mergeTags does not alter suppression — PASS

- Cluster-exclusion gate unchanged: `real-holders.ts:37` (`?? 0.85`), `:45`
  (`>= minClusterConfidence`).
- Service-funder tag gate unchanged: `funding-clusters.ts:18`
  (`serviceFunderMinConfidence: 0.8`), `:130` (`if (tag.confidence <
  minConfidence) continue`).
- `mergeTags` (`analysis-service.ts:356-370`) de-duplicates by `chain:address`,
  first occurrence wins, and copies tag objects by reference — confidences are
  never mutated. `chain` is a required field on `AddressTag`
  (`types.ts:36-43`), so the key is well-formed. Owner-tag queries only ever
  return tags for owner addresses and funder-tag queries only for funder
  addresses; a contract-respecting source returns the same tag for the same
  address regardless of batch, so first-occurrence dedup cannot swap a
  higher-confidence funder tag for a lower one. As defense in depth,
  `indexServiceFunders` (`funding-clusters.ts:123-135`) itself keeps the
  highest-confidence tag per address. Suppression behavior is therefore
  unchanged by the merge.

### Point 4 — Tests genuinely pin the fix — PASS

- **Non-holder exchange funder test** ("suppresses a non-holder exchange
  funder", `wallet-cleaning-evidence.test.ts`): the `funderScenarioSource`
  mock is address-**respecting** — `getAddressTags: async (addresses) => ...
  addresses.includes("cex-hot") ? [exchange tag] : []`. `cex-hot` is a funder,
  not a holder, so under the old holder-only code (which queried only
  `creator/a/b`) it would never be tagged, suppression would not fire, and a
  2-member cluster would form — the test would FAIL. Under the repair the
  funder set is queried, `cex-hot` is tagged, and the test asserts
  `clusterMembers.length === 0` and one suppressed funder `cex-hot`. This is a
  genuine differential, in contrast to the pre-existing masked test
  (`:148-153`) whose mock returns the `cex-hot` tag unconditionally.
- **0.8/0.79 boundary test** ("respects the 0.8 confidence boundary"): asserts
  suppression + zero cluster at confidence `0.8`, and zero suppression + a
  `>= 2`-member cluster at `0.79`. Matches the `< minConfidence` (0.8) gate.
- **Control test** ("without any funder tag, the same-source cluster forms"):
  with `funderTagConfidence = null` the mock returns no tag; asserts a
  `>= 2`-member cluster forms and zero suppressed funders. Confirms the cluster
  machinery is live and the suppression is what removes the members in the
  positive case (not an unrelated no-cluster artifact).

## New findings

None blocking.

| ID | Severity | Finding |
| --- | --- | --- |
| INFO-1 | Informational | The pre-existing test at `wallet-cleaning-evidence.test.ts:148-153` still uses an over-returning tag mock (returns `cex-hot` regardless of the queried address list) — the same mask noted in AUDIT-003 FIND-1. It is now harmless: it exercises the suppression happy-path and still passes, and the new address-respecting test provides the true differential pin. No failure scenario; retained only as an observation. Optional cleanup: retire or convert the masked mock to keep a single source of truth for the funder-suppression pin. |

## Acceptance results

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS (tsc `--noEmit`, no errors) |
| `npm test` | PASS (tests 126, pass 126, fail 0) |
| `npm run build` | PASS (tsc emit, no errors) |
| `git diff --check` | PASS (exit 0, no whitespace/conflict markers) |

## Final verdict

**GREEN.** FIND-1 is fully and correctly closed. Funder tags are fetched in
both passes and routed only to cluster detection, never to holder exclusion; no
threshold was lowered; the exclusion warning now counts only members at the
real >= 0.85 exclusion confidence; and the new tests are genuinely differential
against the old holder-only code. All four acceptance commands pass. The single
informational item does not lower a threshold, discard evidence, bypass a
fail-closed gate, or let funder tags reach holder exclusion, so under the
fail-closed rules the verdict is GREEN.
