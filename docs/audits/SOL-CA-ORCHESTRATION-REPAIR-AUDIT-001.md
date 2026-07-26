# SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001 - Independent audit of the CA orchestration evidence-integrity repair

## Verdict

**GREEN_WITH_ADVISORY**

The repair delivered by `SOL-CA-ORCHESTRATION-REPAIR-001` (commit `bb288bd`)
genuinely closes the blocking P1 finding and both required P2
completeness-matrix findings of `docs/audits/SOL-CA-ORCHESTRATION-AUDIT-001.md`,
and its FIND-4 posture at repair scope (unconditional explicit warnings plus a
`KNOWN_LIMITATIONS.md` entry that blocks live wiring) was acceptable.
`HolderSnapshotEvidence.ownerBalances` is now a JSON-safe
`ReadonlyArray<OwnerBalanceEntry>`, and the new persistence round-trip tests
exercise the REAL `RedisAnalysisCache` and `PostgresAnalysisRepository`
serialize/deserialize code paths with strict bigint assertions — not stubs. No
fail-closed gate was weakened, no threshold lowered, and no exclusion reason
added. I found no remaining runtime-only type (Map/Set/bigint/Date) in the
persisted `AnalysisResult` that corrupts or throws on JSON round-trip while a
completeness field claims `complete`. Three new non-blocking advisories were
identified (process write-set drift in the repair commit, a latent
string-revival heuristic in the persistence codecs, and a round-trip test
coverage gap); none is a gate bypass or silent evidence corruption, so under
the fail-closed rules the verdict is GREEN_WITH_ADVISORY rather than FAIL.

## Header

| Field | Value |
| --- | --- |
| Audit task | `SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001` (T2, auditor, solana) |
| Auditor agent | `claude-auditor-orchestration-repair` (independent of implementer `grok-implementer-orchestration-repair`) |
| Date | 2026-07-26 |
| Harness run | `harness/runs/20260726_SOL_CA_ORCH_REPAIR_AUDIT_001` |
| Audited repair commit | `bb288bd` ("feat(solana): repair CA orchestration evidence integrity") |
| Tree state audited / acceptance HEAD | `060e6fa` (later commits `1253b2c`, `060e6fa` further modified `analysis-service.ts`; their own scope — notably `SOL-HOLDER-EXCLUSION-INPUT-001` FIND-4 root-cause closure — is NOT audited here) |
| Implementer harness run | `harness/runs/20260726_SOL_CA_ORCH_REPAIR_001` (status GREEN, agent `grok-implementer-orchestration-repair`, changed_paths exactly the four write-set deliverables) |

## Scope and methodology

- Clean-tree check (`git status --short` empty) before starting the run;
  harness `start` executed with this auditor's agent id.
- Read in full: `harness/tasks/SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001.json`
  (this audit's spec and forbidden actions),
  `harness/tasks/SOL-CA-ORCHESTRATION-REPAIR-001.json`,
  `PROJECT_CONSTITUTION.md`, `docs/audits/SOL-CA-ORCHESTRATION-AUDIT-001.md`,
  `src/domain/types.ts`, `src/application/analysis-service.ts`,
  `src/infrastructure/cache/redis-analysis-cache.ts`,
  `src/infrastructure/postgres/postgres-analysis-repository.ts`,
  `test/application/solana/ca-analysis-orchestration.test.ts`,
  `test/application/solana/analysis-persistence-roundtrip.test.ts`,
  `KNOWN_LIMITATIONS.md` (current and at `bb288bd`).
- Reviewed the full repair diff (`git show bb288bd`) file-by-file, including
  its test diff, and compared repair-scope behavior against current HEAD
  behavior where later commits intervened.
- Adversarial re-checks: attempted to reconstruct the FIND-1 attack path
  against the new types (searched `src/` for `ReadonlyMap|new Map|Map<|Set<`
  and traced every hit into/out of the persisted `AnalysisResult`); traced
  bigint and Date handling through both codecs; checked the round-trip tests
  for stubbed serialization; re-read the devCompleteness matrix for every
  branch combination including `devHistory === null`, `dev === null` with
  `completeFromCreation: true`, and partial snapshots; verified all four gate
  warnings still fire on their trigger conditions and no threshold changed.
- Ran all four acceptance commands against HEAD before writing this report.
- This report is the sole repository write of this audit. No source, test,
  fixture, spec, ledger, or prior audit report was modified; no network,
  credentials, or live providers were used.

## Closure of original findings

| Finding | Status | Evidence |
| --- | --- | --- |
| FIND-1 (P1) ownerBalances destroyed by Redis/Postgres round-trip | **Closed** | See FIND-1 analysis below. `src/domain/types.ts:126-134`; `src/application/analysis-service.ts:372`; `test/application/solana/analysis-persistence-roundtrip.test.ts:139-205` |
| FIND-2 (P2) devCompleteness `complete` while `dev` null | **Closed** | `src/application/analysis-service.ts:243-253` — `complete` requires `devHistory.dev !== null` AND `coverage.completeFromCreation`; pinned by `test/application/solana/ca-analysis-orchestration.test.ts:210-224` (asserts `dev` null + `completeFromCreation: true` yields `devCompleteness: "partial"`, `DEV_TOTALS_INDETERMINATE`, and the service's `CREATOR_EVIDENCE_MISSING_OR_UNTRUSTED` propagated) |
| FIND-3 (P2) missing creator reported `partial` | **Closed** | `src/application/analysis-service.ts:228-231` — `creatorEvidence === null` now yields `devCompleteness = "unavailable"` with both warnings; pinned by `test/application/solana/ca-analysis-orchestration.test.ts:197-208` (line 203 asserts `"unavailable"`) |
| FIND-4 (P2) exclusion inputs narrower than audited snapshot | **Mitigated at repair scope (acceptable); root cause closed out of scope** | At `bb288bd`, `HOLDER_EXCLUSION_TAGS_BOUNDED_TO_GENERIC_TOP100` and `HOLDER_EXCLUSION_CLUSTERS_BOUNDED_TO_RECENT_TRADE_WINDOW` were pushed unconditionally whenever audited services ran (`git show bb288bd:src/application/analysis-service.ts`, warning pushes immediately after the snapshot/creator `Promise.all`), pinned by the repair-scope test (`git show bb288bd`, orchestration test asserts both `includes()`), and `KNOWN_LIMITATIONS.md` at `bb288bd` (lines 4-7) documented the residual and required live wiring to narrow it. Root cause was later addressed by `SOL-HOLDER-EXCLUSION-INPUT-001` (two-pass snapshot alignment, `src/application/analysis-service.ts:182-215` at HEAD) — that change has its own audit and is not judged here; at HEAD the warnings correctly fire only on the fallback path (`analysis-service.ts:211-214`) and absence-when-aligned is pinned (`ca-analysis-orchestration.test.ts:178-181`) |

### FIND-1 analysis (the critical one)

Type change: `HolderSnapshotEvidence.ownerBalances` is now
`ReadonlyArray<OwnerBalanceEntry>` (`src/domain/types.ts:134`) with
`OwnerBalanceEntry = { owner: string; balanceRaw: bigint }`
(`src/domain/types.ts:126-129`). `holderSnapshotEvidence()` converts the
snapshot service's internal `ReadonlyMap` to array entries at
`src/application/analysis-service.ts:372`. The snapshot service's own
`SolanaHolderSnapshot.ownerBalances` remains a `ReadonlyMap`
(`src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:56`),
but that type never enters the persisted `AnalysisResult` — only the converted
evidence does.

bigint handling (JSON.stringify throws on naked bigint): both persistence
implementations encode bigint as a `"__bigint__:"`-prefixed string and revive
it —

- Redis: replacer at `src/infrastructure/cache/redis-analysis-cache.ts:21-23`,
  reviver at `:13-17` (also revives ISO-date-shaped strings to `Date`).
- Postgres: recursive `encode` at
  `src/infrastructure/postgres/postgres-analysis-repository.ts:77-85`
  (bigint → prefix string, `Date` → ISO string, arrays/objects walked), and
  the symmetric `decode`/`revive` at `:87-98` used by `findLatest` (`:10-24`).

Round-trip test authenticity (the spec's critical check): the tests do NOT
stub serialization.

- `test/application/solana/analysis-persistence-roundtrip.test.ts:139-158`
  instantiates the real `RedisAnalysisCache` over a string-store
  `MemoryRedis` (`:125-137`), drives the real `AnalysisService` +
  `HeliusSolanaAdapter` with an inline fixture (`:95-118`), then reads back
  via `cache.get(...)` — so the real `JSON.stringify` replacer and
  `JSON.parse` reviver both execute.
- `:160-205` instantiates the real `PostgresAnalysisRepository` over a stub
  pool that captures the actual `JSON.stringify(encode(analysis))` parameter
  (`:167-169`) — the real `encode` runs — asserts the durable payload holds a
  3-entry array with `balanceRaw` matching `/400/` and `notDeepEqual({})`
  (`:192-198`), then reloads through the real `findLatest`/`decode` path
  (`:200-204`).
- The file imports `node:assert/strict` (`:1`), so `assert.equal(..., 400n)`
  at `:146,153-155,203` is `strictEqual`: a `"400"` string surviving instead
  of bigint `400n` would fail the test. bigint revival is therefore genuinely
  pinned, not just shape.
- The only test-file references to the two persistence classes in the repo
  are in this test (verified by search), i.e. the previously-untested real
  classes are now exercised.

Residual runtime-only types: I searched `src/` for `ReadonlyMap|new Map|Map<|Set<`
and traced every hit. All remaining Maps/Sets are intermediate computation
state (snapshot service internals, adapter internals, cluster detection,
`AnalysisService.adapterByChain`) — none reaches the persisted
`AnalysisResult`. Every bigint (`token.totalSupplyRaw`, `HolderBalance`,
`SourceWatermarkEvidence.finalizedSlot`, `PumpCreatorEvidenceFact.slot`,
`DevHistoryCoverageEvidence` slots, `NormalizedTrade`/`TokenTransfer`
amounts, `OwnerBalanceEntry.balanceRaw`) and every `Date` in
`src/domain/types.ts:1-327` is covered by both codecs. I could not
reconstruct any state where a completeness field reads `complete` while its
evidence silently becomes `{}`/throws after round-trip. The old attack path
(two `getQuickAnalysis` calls within the 30 s TTL) now serves an intact array
with bigint balances from both the cache and the repository.

The audit spec's forbidden acceptance conditions are therefore not triggered:
ownerBalances does not come back empty while `holderCompleteness` is
`complete`, and the round-trip test asserts exactly that
(`analysis-persistence-roundtrip.test.ts:152-156, 202-204`).

## Gate integrity (repair did not weaken fail-closed behavior)

- `SOLANA_AUDITED_FACT_SERVICES_UNAVAILABLE` still fires when audited
  services are missing, with null conclusions and `unavailable` completeness
  (`src/application/analysis-service.ts:177-180`; pinned
  `ca-analysis-orchestration.test.ts:248-259`).
- `HOLDER_CONCENTRATION_INDETERMINATE` still fires whenever concentration is
  not adopted (`analysis-service.ts:224`); partial snapshot still yields
  `holders: null` + `DEV_TOTALS_INDETERMINATE` + zero dev-history requests
  (`ca-analysis-orchestration.test.ts:184-195`).
- `DEV_TOTALS_INDETERMINATE` fires on every non-adoption branch
  (`analysis-service.ts:231,248,251`) — the repair added it to the
  `devHistory === null` branch rather than removing any emission.
- `CREATOR_EVIDENCE_MISSING_OR_UNTRUSTED` still fires on missing/untrusted
  creator (`analysis-service.ts:230`; pinned `:205` and, via propagated
  service warnings, `:223` of the orchestration test). Unpinned-IDL evidence
  is still rejected with zero dev-history requests
  (`ca-analysis-orchestration.test.ts:239-246`).
- Dev totals adoption still requires `dev !== null` AND
  `coverage.completeFromCreation` (`analysis-service.ts:243-245`); the
  incomplete-from-creation refusal is pinned
  (`ca-analysis-orchestration.test.ts:226-237`).
- No threshold changed: `DEFAULT_CONFIG` untouched by `bb288bd`; no new
  exclusion reason was added (`HolderExclusionReason` unchanged,
  `src/domain/types.ts:68-73`); wallet quality still never drives exclusion
  (`src/domain/types.ts:303`, pinned by the wallet-cleaning tests).
- Bonus hardening beyond the required scope: the original audit's advisory 6
  defensive case (`complete` + null concentration, an invalid snapshot
  contract state) now downgrades `holderCompleteness` to `"unavailable"`
  (`analysis-service.ts:221-223`).

## Original advisories (7) status

| Advisory | Status | Evidence |
| --- | --- | --- |
| ADV-1 aliasing of `result.holders`/`result.dev` | Open (still non-blocking) | `analysis-service.ts:219,244` still alias; evidence fields still deep-copied (`:363-400`) |
| ADV-2 inconsistent market-failure signaling | Open | thrown `getMarket` → `MARKET_ENRICHMENT_UNAVAILABLE` (`analysis-service.ts:310-316`); graceful null → only the Chinese warning (`:291`) |
| ADV-3 upstream warnings dropped on success branches | Partially improved, open | rejected/partial dev history now propagates `devHistory.warnings` (`analysis-service.ts:252`); adopted-totals branch and complete-snapshot branch still drop service warnings (`:243-245,218-219`) |
| ADV-4 creator evidence lacks mint/CA binding | Open | `src/domain/types.ts:104-113` unchanged; no `signature`↔`creationTx` cross-check at `analysis-service.ts:238` |
| ADV-5 non-Solana branch hard-codes `complete` | Open (stage-blocked) | `analysis-service.ts:261-273`; BSC/Robinhood remain blocked (`PROJECT_CONSTITUTION.md:11-13`) |
| ADV-6 `complete` + null concentration misstates completeness | **Closed** | `analysis-service.ts:221-223` downgrades to `"unavailable"` |
| ADV-7 lowercased CA cache/lookup keys | Open (pre-existing) | `analysis-service.ts:57,75,91-92`; `postgres-analysis-repository.ts:16` |

None of these was a required closure for the repair task; leaving 1-5 and 7
open does not block this audit.

## New findings

### NEW-ADV-1 [advisory, process] Repair commit touched four files outside its declared write set

`git show bb288bd --name-only` lists
`docs/handoffs/FABLE_REVIEW_SOL_CA_ORCHESTRATION_REPAIR_001_20260726.md`,
`harness/ledger/tasks.json`, and status flips in
`harness/tasks/SOL-CA-ORCHESTRATION-REPAIR-001.json` /
`harness/tasks/SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001.json` — none of which is
in the declared write set (`src/application/analysis-service.ts`,
`src/domain/types.ts`, `test/application/solana/**`). Mitigations verified:
the ledger diff changes ONLY the repair task's own status (`READY` → `DONE`)
and its dependent audit task (`BLOCKED_DEPENDENCY` → `READY`), which the
forbidden action ("no ledger entries for unrelated tasks") permits; the
implementer harness manifest's `changed_paths` lists exactly the four
write-set deliverables; prior repo practice does put lifecycle bookkeeping in
separate `chore(harness)` commits (`e0c8ccd`, `e49c3cb`). No semantic or gate
impact — process drift only.

### NEW-ADV-2 [advisory, latent] Persistence codecs revive by string-shape heuristics

Both `redis-analysis-cache.ts:13-17` and
`postgres-analysis-repository.ts:87-98` revive ANY persisted string matching
`/^\d{4}-\d{2}-\d{2}T/` as a `Date` and any `"__bigint__:"`-prefixed string
as a `BigInt` (throwing on a malformed suffix). Fields typed `string` — e.g.
`SourceWatermarkEvidence.cursor` (`types.ts:99`),
`DevHistoryCoverageEvidence.cursor` (`types.ts:145`), warning strings, and
`Record<string, unknown>` evidence values — would be silently type-flipped if
a future live source emitted ISO-timestamp-shaped cursors or prefix-colliding
strings. Not demonstrable today (in-repo fixtures use `"holders-1"`,
`"dev-history-1"`, `"fixture-cursor"`; no live source exists), pre-existing
(both files date to the bootstrap commit `cf5227c` and were outside the
repair write set; the repair correctly fixed the evidence shape instead, per
the original audit's recommended option). Flag for the persistence-hardening
task alongside ADV-7.

### NEW-ADV-3 [advisory, test coverage] Round-trip tests assert key fields, not whole-result equality

`analysis-persistence-roundtrip.test.ts` pins `ownerBalances` (array shape,
length, strict bigint values), `rawTokenAccounts.length`, and
`holderCompleteness` through both real codecs, but does not deep-compare the
full `AnalysisResult` (e.g. watermark `observedAt`/`finalizedSlot`,
`cleaningEvidence`, `largeOrders`, `dataAsOf`) fresh-vs-revived. My manual
trace shows the codecs cover all remaining bigint/Date fields, so no
concrete corruption scenario exists today, but a whole-result
`assert.deepEqual` would pin the entire evidence chain against future type
additions (which is how FIND-1 originally slipped in). Non-blocking.

## Acceptance commands (run against HEAD `060e6fa`)

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 118 tests, 0 fail |
| `npm run build` | PASS |
| `git diff --check` | PASS |

## Verdict justification

Every blocking and required-P2 finding of the original FAIL audit is closed
with pinned tests that exercise the real code paths, the FIND-4 repair-scope
posture (unconditional explicit warnings + KNOWN_LIMITATIONS entry, root
cause deferred to a separately-audited task) was honest and blocks live use,
and no fail-closed gate, threshold, or exclusion rule was weakened. The three
new findings and six still-open original advisories are real but
non-blocking: none permits silent evidence corruption or a gate bypass with
in-repo components. Fail-closed rules therefore yield
**GREEN_WITH_ADVISORY**. This audit does not constitute acceptance of
`SOL-HOLDER-EXCLUSION-INPUT-001` (FIND-4 root cause) or Solana end-to-end
GREEN.
