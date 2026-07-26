# SOL-WALLET-CLEANING-AUDIT-003 - Independent audit of Solana wallet cleaning evidence

## Verdict

**GREEN_WITH_ADVISORY**

The wallet-cleaning implementation delivered under `SOL-WALLET-CLEANING-003`
(commit `1253b2c`, with integration rewiring in `060e6fa`) is structurally
sound on every blocking dimension: service-funder suppression is gated on tag
confidence >= 0.8 with full label provenance retained; no exclusion threshold
was lowered anywhere in either diff (cluster exclusion remains >= 0.85, tag
exclusion remains >= 0.8 over the unchanged infrastructure role set); the
cluster confidence formula is byte-identical to the pre-change version;
wallet-quality labels are provably outside the holder-exclusion data flow
(`HolderExclusionReason` gained no members, `EXCLUDED_ROLES` is unchanged,
and `classifyWallet` output only ever attaches to large orders); excluded
cluster members retain reversible reason/confidence/evidence/rule-version
records; and after `060e6fa` the `walletCleaningEvidence` block is built from
the FINAL (pass-2, snapshot-scope) cluster detection, not the stale generic
pass-1 detection. All four acceptance commands pass on the audited tree.

Two P2 findings (a funder-tag coverage gap that can make suppression silently
inert against non-holder exchange hot wallets, masked by an over-returning
test mock; and unrestricted tag-source authority for suppression) plus four
P3/advisory items were identified. None lowers a threshold, discards
evidence, bypasses a fail-closed gate, or lets wallet-quality labels reach
holder exclusion, so under the fail-closed rules the verdict is
GREEN_WITH_ADVISORY rather than FAIL. The P2s bound the feature's
effectiveness, not the integrity of the data it reports.

## Header

| Field | Value |
| --- | --- |
| Audit task | `SOL-WALLET-CLEANING-AUDIT-003` (T2, auditor, solana) |
| Auditor agent | `claude-auditor-wallet-cleaning` (independent of implementer, Grok) |
| Date | 2026-07-26 |
| Harness run | `harness/runs/20260726_SOL_WALLET_CLEANING_AUDIT_003` |
| Audited commits | `1253b2c` ("feat: advance wallet cleaning, harness lifecycle, and E2E gap research"), `060e6fa` ("feat(solana): close FIND-4 exclusion inputs and offline market liquidity" — moved `walletCleaningEvidence` construction and rewired cluster inputs) |
| Tree state audited / acceptance HEAD | `bc97bfc` (current tree; the audited files are unmodified since `060e6fa`) |
| Implementer harness run | **None exists** for `SOL-WALLET-CLEANING-003` (see ADV-1) |

## Scope and methodology

- Clean-tree check (`git status --short` empty) before `start`; harness run
  started with this auditor's agent id.
- Read `PROJECT_CONSTITUTION.md`, both task specs
  (`harness/tasks/SOL-WALLET-CLEANING-AUDIT-003.json`,
  `harness/tasks/SOL-WALLET-CLEANING-003.json`), and the full diffs
  `git show 1253b2c` and `git show 060e6fa` for the audited files.
- Read current `src/domain/rules/funding-clusters.ts`,
  `src/domain/rules/wallet-quality.ts`, `src/domain/rules/real-holders.ts`,
  `src/domain/types.ts`, `src/application/analysis-service.ts`, the tag/edge
  retrieval path in
  `src/infrastructure/solana/helius/helius-solana-adapter.ts`, the exclusion
  constants and cleaning-evidence builder in
  `src/infrastructure/solana/holders/solana-holder-snapshot-service.ts`, and
  all three test files named in the spec.
- Cross-checked `git log` per-file history to confirm `real-holders.ts` and
  the holder snapshot service were untouched by both commits.
- Ran all four acceptance commands before writing this report (baseline:
  typecheck clean, 118/118 tests pass, build clean, `git diff --check`
  clean).
- Wrote only this report; no source, test, fixture, spec, or ledger file was
  modified, and no network access was used.

## Findings

| ID | Severity | Finding |
| --- | --- | --- |
| FIND-1 | P2 | Service-funder suppression depends on tag coverage the service never requests: `getAddressTags` is only ever called with holder/owner addresses (`src/application/analysis-service.ts:133-135` for the generic top-100, `:191-195` for snapshot owners), while suppression looks tags up by `edge.funder` (`src/domain/rules/funding-clusters.ts:50,55`). A CEX hot wallet that funds buyers but holds no tokens is not in either query list, so under a source that honors the request contract (`HeliusSolanaAdapter.getAddressTags` at `src/infrastructure/solana/helius/helius-solana-adapter.ts:205-215` passes the list through and returns whatever the source sends), its `exchange` tag is never fetched and suppression silently never fires — the exchange fan-out is then clustered at confidence >= 0.85 and its recipients wrongly excluded from real concentration as `same_source_cluster`. **Failure scenario:** 10 independent wallets each withdraw from the same exchange hot wallet and ape within 2 minutes; the hot wallet holds zero tokens; all 10 legitimate holders are excluded and `top10Pct`/`excludedPct` misstate real concentration. The E2E pin (`test/application/solana/wallet-cleaning-evidence.test.ts:148-153`) masks this: its mock returns the `cex-hot` tag regardless of the requested address list, which no contract requires of a real source. Exclusion evidence for the wrongly-clustered members is still fully retained and reversible, so this is an effectiveness gap, not evidence corruption. Recommendation: additionally query tags for the distinct funder set of `fundingEdges` before detection. |
| FIND-2 | P3 | Suppression grants equal authority to all tag sources: `indexServiceFunders` (`src/domain/rules/funding-clusters.ts:123-135`) filters only on role and `confidence >= 0.8`; `AddressTag.source` may be `"heuristic"` or `"provider"` (`src/domain/types.ts:40`). A third-party/heuristic `exchange` tag at exactly 0.8 fully suppresses same-source inference — the dangerous false-negative direction: a sybil funder whose address acquires such a tag escapes cluster detection entirely. Mitigations observed: tags currently come only from system-controlled offline/fixture sources (no live provider is wired), the confidence gate is real and pinned (`test/funding-clusters.test.ts:65-94`), and the suppression record retains `source` and `confidence` so a downstream consumer can distrust provider-sourced suppressions. The constitution ranks third-party labels lowest for creator identity (rule 5); the same posture should eventually apply here (e.g., restrict suppression to `system`/`manual`, or raise the bar for `provider`/`heuristic`). |
| FIND-3 | P3 | The exclusion warning at `src/application/analysis-service.ts:292` still reports raw `clusterMembers.length` as "已从真实集中度中排除 N 个高置信同源地址" (the previously-noted concern). The confidence-mismatch half of that concern is now vacuous — the detector's formula `min(0.99, 0.75 + members*0.05)` with `minimumMembers: 2` (`src/domain/rules/funding-clusters.ts:103,17`) yields a floor of exactly 0.85, which passes the inclusive `>= 0.85` filter (`src/domain/rules/real-holders.ts:37,45`; `solana-holder-snapshot-service.ts:6,187`) — but two residual mismatches remain: (a) members that are not current snapshot holders are counted although nothing was excluded for them; (b) the warning also fires on paths where concentration was never computed (partial snapshot / audited services unavailable, `analysis-service.ts:177-180,224`), claiming exclusion from a concentration that is INDETERMINATE. Misleading warning text only; the actual exclusion math and evidence are correct. |
| FIND-4 | P3 | `ServiceFunderSuppression` retains `source`/`confidence`/`role`/`ruleVersion`/`suppressedEdgeCount` (`src/domain/rules/funding-clusters.ts:62-72`) but not the affected recipient addresses. The spec goal "retained evidence" is met at funder granularity and the record satisfies provenance; full reversal (re-running detection without suppression) requires re-deriving the funding edges, which are not persisted in the result. Enumerate suppressed recipients (or edges) in a future revision. |
| FIND-5 | P3 | Test gaps: (a) no differential test where pass-1 (generic top-100 / 30-min window) and pass-2 (snapshot owners / history window) detections differ and the test asserts `walletCleaningEvidence.clusterMembers` carries the pass-2 result — the current pins (`wallet-cleaning-evidence.test.ts:172-177`, `ca-analysis-orchestration.test.ts:178`) assert `exclusionInputsAlignedToSnapshot === true`, which does pin construction ordering, but not divergent content; (b) no boundary test at confidence exactly 0.8 vs 0.79 for suppression (the low-confidence test uses 0.5, `funding-clusters.test.ts:88`); (c) the `router` role in `SERVICE_FUNDER_ROLES` (`funding-clusters.ts:22`) has no pinning test. |
| ADV-1 | Advisory (process) | Implementer task `SOL-WALLET-CLEANING-003` is `DONE` in `harness/ledger/tasks.json:211-214` but `harness/runs/` contains no run manifest for it (verified by directory listing). Code and acceptance are verifiable from git history and the current tree, and this audit run (`20260726_SOL_WALLET_CLEANING_AUDIT_003`) supplies the missing independent scope/acceptance verification. Recorded as process advisory per the audit brief; not treated as blocking. |

## Verification checklist

### 1. Service-funder suppression is evidence-backed — PASS (with FIND-1/FIND-2 caveats)

- The enumerated constant is `SERVICE_FUNDER_ROLES = {"exchange", "router"}`
  (`src/domain/rules/funding-clusters.ts:22`) — narrower than the
  "exchange/router/bridge/batch_service" wording in the audit brief;
  `AddressRole` (`src/domain/types.ts:5-14`) has no bridge/batch_service
  members, so the constant covers every service-like role the type system
  offers. Narrower suppression is the conservative direction (fewer escapes).
- Confidence gate: `tag.confidence < minConfidence` skips the tag
  (`funding-clusters.ts:130`), default `serviceFunderMinConfidence: 0.8`
  (`:18`); low-confidence tags do NOT suppress — pinned by
  `test/funding-clusters.test.ts:65-94` (0.5-confidence tag: 2 members
  detected, 0 suppressed).
- Provenance retained per suppression record: `funder`, `role`,
  `confidence`, `source`, `ruleVersion: "service-funder-v1"`,
  `suppressedEdgeCount` (`funding-clusters.ts:62-72`), deep-copied into
  `walletCleaningEvidence.suppressedServiceFunders`
  (`analysis-service.ts:281`). Recipient enumeration missing (FIND-4).
- False-negative direction: confidence < 0.8 cannot suppress; but source is
  unrestricted (FIND-2) and, conversely, real exchange funders may never have
  their tags fetched at all (FIND-1).

### 2. Threshold integrity — PASS

- `src/domain/rules/real-holders.ts` untouched by both commits (git log for
  the file shows only the bootstrap commit `cf5227c`): cluster exclusion
  `minimumClusterConfidence ?? 0.85` (`real-holders.ts:37`, filter at `:45`),
  tag exclusion `confidence >= 0.8` over unchanged
  `EXCLUDED_ROLES = {bonding_curve, official_proxy, liquidity_pool, burn}`
  (`:10-15,40`).
- The audited Solana path uses the same constants:
  `MINIMUM_TAG_CONFIDENCE = 0.8`, `MINIMUM_CLUSTER_CONFIDENCE = 0.85`,
  `INFRASTRUCTURE_ROLES` identical
  (`src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:4-6`);
  the snapshot service was not in either commit's changed-file set
  (implementer forbidden action "do not modify the holder snapshot service"
  respected).
- Confidence formula unchanged: `Math.min(0.99, 0.75 + members.length * 0.05)`
  is identical in `1253b2c^` (old line 56) and current
  `funding-clusters.ts:103`. The only new threshold, 0.8 for suppression, is
  an addition, not a lowering of any exclusion gate.

### 3. Wallet quality stays out of holder exclusion — PASS

- `HolderExclusionReason` (`src/domain/types.ts:68-73`) still has exactly
  `bonding_curve | official_proxy | liquidity_pool | burn |
  same_source_cluster`; neither diff touched the union; no quality-label
  member exists.
- Data flow: `classifyWallet` output attaches only to `largeOrders`
  (`analysis-service.ts:151-162`) and to
  `walletCleaningEvidence.largeOrderWalletQuality` (`:282-285`). The audited
  snapshot receives only `snapshotTags`/`clusterMembers`
  (`:205-209`); `WalletFacts`/`WalletQuality` never reach
  `getAuditedHolderSnapshot` or `calculateRealHolderConcentration`.
- `blacklist`/`whitelist` roles present in `addressTags` cannot exclude:
  filtered out by `EXCLUDED_ROLES`/`INFRASTRUCTURE_ROLES` — pinned by
  `test/wallet-quality.test.ts:21-40` (0.99-confidence blacklist tag:
  `eligibleHolderCount === 2`, no row excluded).
- `holderExclusionUsesWalletQuality: false` is a compile-time literal
  (`types.ts:304` area: `holderExclusionUsesWalletQuality: false;`;
  `analysis-service.ts:286` `false as const`) and, per the trace above,
  structurally true, not merely asserted.

### 4. No evidence discarded — PASS (with FIND-3/FIND-4 caveats)

- Excluded members carry `exclusionReason`, `confidence`, `ruleVersion`,
  `rawTokenAccounts`, and label/cluster evidence in
  `HolderCleaningEvidence` (`solana-holder-snapshot-service.ts:191-206`),
  deep-copied into the result via `copyCleaningEvidence`
  (`analysis-service.ts:379-396`) — constitution rule 4 satisfied.
- Suppressed funders retained in
  `walletCleaningEvidence.suppressedServiceFunders` with provenance
  (see checklist 1); recipients not enumerated (FIND-4).
- The exclusion-count warning still uses raw `clusterMembers.length`
  (`analysis-service.ts:292`) — see FIND-3 for the residual (non-corrupting)
  inaccuracies.

### 5. Integration correctness after 060e6fa — PASS

- Complete-snapshot path: pass 1 enumerates owners with empty exclusion
  inputs (`analysis-service.ts:182-186`); when
  `completeness === "complete"`, tags/funding are re-fetched for ALL snapshot
  owners and detection re-runs over history-window first buys
  (`:189-202`), then `clusterDetection`/`clusterMembers`/`addressTags`/
  `fundingEdges` are reassigned (`:196-203`) and pass 2 re-audits the
  snapshot with the aligned inputs (`:205-210`).
- `walletCleaningEvidence` is constructed at `:276-288`, strictly AFTER the
  Solana block, from the reassigned `clusterMembers` and
  `clusterDetection.suppressedFunders` — it reflects the FINAL detection.
  The stale-pass-1 concern from the pre-`060e6fa` layout is closed.
- `enumerationSnapshot.ownerBalances` is a `Map` on the
  `SolanaHolderSnapshot` service type, so `.keys()` at `:190` yields owner
  address strings, not array indices (the JSON-safe array form exists only on
  the persisted `HolderSnapshotEvidence`, built at `:372`).
- Incomplete path keeps the bounded-inputs warnings
  (`HOLDER_EXCLUSION_TAGS_BOUNDED_TO_GENERIC_TOP100`,
  `HOLDER_EXCLUSION_CLUSTERS_BOUNDED_TO_RECENT_TRADE_WINDOW`, `:212-213`)
  and `exclusionInputsAlignedToSnapshot` stays `false` — honest downgrade,
  no fake precision.

### 6. Tests pin the behavior — PASS with gaps (FIND-5)

- `test/funding-clusters.test.ts`: pins detection (2 members, shared
  clusterId, confidence >= 0.85, empty suppression list), suppression with
  full record shape including `ruleVersion` and `suppressedEdgeCount: 2`, and
  the low-confidence non-suppression case.
- `test/wallet-quality.test.ts`: pins bot classification without exclusion
  authority and blacklist-never-excludes at the concentration rule level.
- `test/application/solana/wallet-cleaning-evidence.test.ts`: end-to-end pin
  of `walletCleaningEvidence` presence,
  `holderExclusionUsesWalletQuality === false`,
  `exclusionInputsAlignedToSnapshot === true`, zero cluster members under
  suppression, and the `cex-hot`/`exchange` suppression record — but its
  mock over-returns tags irrespective of the query (FIND-1 mask).
- Unpinned behaviors: pass-1 vs pass-2 divergence content, 0.8/0.79
  suppression boundary, `router` role (FIND-5).

## Acceptance results

Run on the audited tree (`bc97bfc`, clean) before this report was written:

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS (118/118) |
| `npm run build` | PASS |
| `git diff --check` | PASS (no output) |

## Verdict justification

No P1 was found. Every blocking property the audit spec names — evidence-backed
suppression with a real confidence gate, intact 0.85/0.8 exclusion thresholds
and unchanged confidence formula, structural separation of wallet quality from
holder exclusion, retained reversible evidence, and final-detection wiring of
`walletCleaningEvidence` after `060e6fa` — verifies with file:line evidence,
and all acceptance commands pass. The two P2 findings limit how often the new
suppression feature will fire in production and widen its trust surface, but
in both failure directions the system still produces retained, reversible,
provenance-carrying evidence rather than silent corruption, and neither
violates a forbidden action of the implementer spec or the constitution.
Fail-closed evaluation therefore yields **GREEN_WITH_ADVISORY**: FIND-1 and
FIND-2 should be scheduled as follow-up work (funder-set tag querying;
tag-source policy for suppression), FIND-3/4/5 as hygiene, and ADV-1 recorded
as process debt now discharged by this audit run.
