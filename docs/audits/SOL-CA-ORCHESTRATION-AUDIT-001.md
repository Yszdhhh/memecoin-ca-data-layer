# SOL-CA-ORCHESTRATION-AUDIT-001 - Independent final CA orchestration audit

## Verdict

**FAIL**

The live orchestration gates delivered by `SOL-CA-ORCHESTRATION-001` (commit
`b96f1f5`) are correctly fail-closed: holder concentration is only adopted from
a complete audited snapshot, Dev totals require pinned creator evidence plus
complete-from-creation coverage, and there is no silent fallback to generic
math on Solana. However, the change introduces a runtime
`ReadonlyMap` (`solanaEvidence.holderSnapshot.ownerBalances`) into the
persisted `AnalysisResult`, and both in-repo persistence implementations of the
service's own ports destroy it on serialization. I reproduced offline that
every Redis cache hit and every Postgres `findLatest` serves the constitution
rule-3 owner-aggregation evidence as an empty plain object while
`holderCompleteness` still reads `complete` and no warning is added, and that
the durable Postgres audit payload permanently stores `"ownerBalances": {}` on
every save. This is silent corruption of holder-snapshot evidence in the
stored and served artifact, which the fail-closed verdict rules treat as
blocking (P1). Three P2 completeness-matrix/wiring defects and seven
advisories were also confirmed; none of the other candidate findings was a
gate bypass.

## Scope and method

Audited task: `SOL-CA-ORCHESTRATION-AUDIT-001` (T2, auditor, Solana).
Audited implementation: commit `b96f1f5` ("feat(solana): wire audited facts
into final CA orchestration"), which touches exactly
`src/application/analysis-service.ts`, `src/application/ports.ts`,
`src/domain/types.ts`,
`src/infrastructure/solana/helius/helius-solana-adapter.ts`, and
`test/application/solana/ca-analysis-orchestration.test.ts` (`git show
b96f1f5 --stat`).

Declared read-only inputs reviewed in full:

- `PROJECT_CONSTITUTION.md`
- `harness/tasks/SOL-CA-ORCHESTRATION-001.json`
- `src/application/analysis-service.ts`
- `src/application/ports.ts`
- `src/domain/types.ts`
- `src/infrastructure/solana/helius/helius-solana-adapter.ts`
- `src/infrastructure/solana/pump/pump-instruction-decoder.ts`
- `src/infrastructure/solana/holders/solana-holder-snapshot-service.ts`
- `src/infrastructure/solana/dev/solana-dev-history-service.ts`
- `test/application/solana/ca-analysis-orchestration.test.ts`

Because the audited change adds a new field to the persisted `AnalysisResult`,
the in-repo implementations of the persistence ports were also read to
adjudicate the evidence-integrity candidates:
`src/infrastructure/cache/redis-analysis-cache.ts` and
`src/infrastructure/postgres/postgres-analysis-repository.ts` (defects are
attributed to the declared-input files that introduced the non-serializable
evidence type, not to these unchanged files).

Method: independent line-by-line review of every declared input; adjudication
of nine candidate findings from three adversarial review lenses (each
independently confirmed or refuted below); and an offline reproduction script
(kept outside the repository, no network, no credentials) that drives the real
`AnalysisService` + `HeliusSolanaAdapter` with the same inline fixture shape as
the deliverable test, wired to the real `RedisAnalysisCache` over an in-memory
string store and the real `PostgresAnalysisRepository` over a stub pool that
captures the JSONB payload. Acceptance commands were re-run (see Acceptance
reproduction).

No source, test, fixture, task spec, ledger, configuration, credential,
network, or provider state was read from a mutable source or modified. This
report is the sole repository write of this audit.

## Findings

### FIND-1 [P1] - Holder-snapshot evidence is silently corrupted by both persistence layers (confirms EIC-P1-001)

The audited change declares
`HolderSnapshotEvidence.ownerBalances: ReadonlyMap<string, bigint>`
(`src/domain/types.ts:128`), populates it with a runtime `Map`
(`src/application/analysis-service.ts:292`), and attaches it to the persisted
result via `AnalysisResult.solanaEvidence` (`src/domain/types.ts:254`). Every
analysis is written through the `AnalysisRepository` and `AnalysisCache` ports
(`src/application/analysis-service.ts:63-66`) and served back from them on the
next call inside `quickCacheTtlSeconds` = 30s
(`src/application/analysis-service.ts:30,56-59`).

Both in-repo implementations of those ports destroy a `Map`:

- `RedisAnalysisCache.set` uses `JSON.stringify` with a bigint-only replacer
  (`src/infrastructure/cache/redis-analysis-cache.ts:21-23`); a `Map` has no
  enumerable own properties, so it serializes to `{}` and `get()` revives it
  as a plain empty object
  (`src/infrastructure/cache/redis-analysis-cache.ts:13-17`).
- `PostgresAnalysisRepository`'s `encode` walks objects with
  `Object.entries`, which returns `[]` for a `Map`
  (`src/infrastructure/postgres/postgres-analysis-repository.ts:81-83`); the
  durable `analysis_materializations` payload therefore permanently stores
  `"ownerBalances": {}`
  (`src/infrastructure/postgres/postgres-analysis-repository.ts:61-65`), and
  `findLatest` serves it back
  (`src/infrastructure/postgres/postgres-analysis-repository.ts:10-24`).

Reproduced offline with the real classes (fixture data identical in shape to
`test/application/solana/ca-analysis-orchestration.test.ts`):

```text
[redis]    fresh ownerBalances is Map: true | get('creator') = 400n
[redis]    cached holderCompleteness: complete | ownerBalances constructor: Object | JSON: {}
[redis]    cached warnings mention corruption: false
[redis]    .get('creator') on cached evidence THREW: TypeError cachedBalances.get is not a function
[postgres] durable payload ownerBalances field: {}
[postgres] findLatest holderCompleteness: complete | ownerBalances JSON: {}
```

Failure scenario: two `getQuickAnalysis` calls for the same CA within 30
seconds with either in-repo persistence implementation wired. The second call
serves an artifact whose owner-aggregation evidence (constitution rule 3) is a
false empty object under `holderCompleteness: "complete"` with zero warnings,
and any consumer using the documented `ReadonlyMap` API — exactly the pattern
the deliverable test itself pins
(`test/application/solana/ca-analysis-orchestration.test.ts:171`) — throws a
`TypeError`. Independently of any cache hit, the durable audit record is
corrupted at write time on every save.

The orchestration test cannot catch this because its repository and cache are
no-ops (`test/application/solana/ca-analysis-orchestration.test.ts:150-159`),
and no test in the repository imports either persistence implementation
(verified by search: the only references to `RedisAnalysisCache` /
`PostgresAnalysisRepository` are their own definitions).

Scope-limiting facts, verified: the rule-4 exclusion evidence
(`cleaningEvidence`, including `exclusionReason`, `confidence`,
`ruleVersion`, and the reversible `rawTokenAccounts` snapshots) and the
top-level `rawTokenAccounts` array survive the round-trip intact (reproduced:
3 accounts present in the durable payload), so `ownerBalances` is
re-derivable offline by re-aggregation; the conclusion fields
(`holders.top10Pct`, `dev`, completeness fields) also survive intact. This is
therefore evidence corruption, not a numeric-conclusion corruption — but it is
silent, it affects both the served artifact and the durable audit record, and
it was fixable inside the implementer's own write set
(`src/domain/types.ts` / `holderSnapshotEvidence()` at
`src/application/analysis-service.ts:284-297` could store a
serialization-safe structure). Under the fail-closed verdict rules, confirmed
corruption of the audited evidence chain is blocking.

### FIND-2 [P2] - `devCompleteness` can read `complete` while `dev` is null and the Dev service rejected the creator evidence (confirms EIC-P2-001)

`devCompleteness` is derived from `coverage.completeFromCreation` alone when a
`devHistory` result exists (`src/application/analysis-service.ts:192-194`),
while the totals gate additionally requires `dev !== null`
(`src/application/analysis-service.ts:195`). The audited Dev history service
can legitimately return `{ dev: null, coverage.completeFromCreation: true }`:
it re-validates creator evidence with the stricter check
`evidence.slot === creationSlot`
(`src/infrastructure/solana/dev/solana-dev-history-service.ts:117`), nulls
`dev` on failure
(`src/infrastructure/solana/dev/solana-dev-history-service.ts:67-75`), and
`assessCoverage` is independent of creator evidence
(`src/infrastructure/solana/dev/solana-dev-history-service.ts:120-131`). The
adapter's `isPinnedPumpCreatorEvidence` cannot perform the slot cross-check
because it has no `creationSlot` in scope
(`src/infrastructure/solana/helius/helius-solana-adapter.ts:392-403`).

Reproduced offline through the public API with a source returning that
contract-legal state:

```text
[matrix] devCompleteness: complete | dev: null | token.creatorAddress: creator
         | warnings: ["DEV_TOTALS_INDETERMINATE","CREATOR_EVIDENCE_MISSING_OR_UNTRUSTED",...]
```

The result simultaneously presents `resultToken.creatorAddress`
(`src/application/analysis-service.ts:187`) and `solanaEvidence.creator`
(`src/application/analysis-service.ts:202`) as fact while carrying the
warning that the Dev service found the same evidence untrusted. The gate
itself holds (no fake totals; both structured warnings propagate via
`src/application/analysis-service.ts:198-199`), so this cannot alone produce
a wrong published total — but `devCompleteness: "complete"` with `dev: null`
misstates reality for any consumer that treats the completeness field as the
trust signal (`FactCompleteness` semantics, `src/domain/types.ts:91-92`).

### FIND-3 [P2] - `devCompleteness` reports `partial` when zero dev facts exist (confirms EIC-P2-002)

`creatorEvidence === null` hard-codes `devCompleteness = "partial"`
(`src/application/analysis-service.ts:177-178`) regardless of snapshot state
(including `holderSnapshot === null`, where `holderCompleteness` is
`unavailable`). Reproduced: `creator=null => devCompleteness: partial | dev:
null`. This is internally inconsistent with the same matrix: missing audited
services yield `unavailable` (`src/application/analysis-service.ts:155,
160-163`), and creator present + complete snapshot + null `devHistory` yields
`unavailable` (`src/application/analysis-service.ts:193`) — so the branch with
strictly less information claims more completeness. The behavior is pinned as
intended by `test/application/solana/ca-analysis-orchestration.test.ts:197`,
`dev` stays null, and `CREATOR_EVIDENCE_MISSING_OR_UNTRUSTED` +
`DEV_TOTALS_INDETERMINATE` are emitted, so no gate is bypassed; the honest
value is `unavailable`.

### FIND-4 [P2] - Audited snapshot exclusion inputs come from unaudited enumerations (confirms EIC-P2-003; latent)

The tags and clusters passed into the audited snapshot at
`src/application/analysis-service.ts:166` are derived from:

- the generic holder list: `uniqueOwners(rawHolders).slice(0, 100)`
  (`src/application/analysis-service.ts:126-129`), where `rawHolders` comes
  from `adapter.getHolders`
  (`src/application/analysis-service.ts:121`), which returns data regardless
  of its source watermark's completeness
  (`src/infrastructure/solana/helius/helius-solana-adapter.ts:193-203`;
  `record()` stores but never inspects the watermark at
  `src/infrastructure/solana/helius/helius-solana-adapter.ts:336-340`, and the
  contract anticipates `partial` at
  `src/infrastructure/solana/helius/helius-solana-adapter.ts:32`); and
- clusters detected only from first buys inside
  `recentTradeWindowMinutes` = 30
  (`src/application/analysis-service.ts:31,116,132-133`).

The snapshot service can only exclude owners whose tags/clusters were
supplied (`src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:89-100,180-189`).
Failure scenario: a live `getTokenAccounts` truncates while
`getHolderSnapshot` enumerates completely — an infrastructure owner (for
example a `liquidity_pool`) present in the complete snapshot but absent from
the generic top-100 list never has its tag fetched, so its balance is counted
as a real holder in a snapshot the result labels `complete`, with zero
warnings; similarly, a same-source cluster whose first buys are older than 30
minutes is never excluded. The letter of the forbidden action ("no
concentration for a partial snapshot") is respected — the snapshot is
complete — but the concentration can silently include balances that
constitution rule 8's no-fake-precision intent requires excluding. This is
not demonstrable with in-repo components today (no live source exists;
`KNOWN_LIMITATIONS.md:3`), and with consistent fixture data the residual
effect is limited to infra owners outside the generic top 100. It is a wiring
defect of the audited change that must be fixed before any live source is
wired.

### Refuted or downgraded candidate claims

- No candidate claimed a bypass of the snapshot-completeness, creator
  provenance, or Dev-history completeness gates, and my independent review
  found none (see Confirmed controls).
- EIC-ADV-001 through EIC-ADV-005 are confirmed as non-blocking advisories
  (see Advisories); in each case I verified the mitigating control or the
  unreachability claim rather than accepting the reviewer's word.

## Confirmed controls

1. Fail-closed holder gate: concentration adopted only when
   `completeness === "complete"` and `concentration !== null`
   (`src/application/analysis-service.ts:170-175`); partial snapshot yields
   `holders: null`, `HOLDER_CONCENTRATION_INDETERMINATE`, and upstream
   warnings (`test/application/solana/ca-analysis-orchestration.test.ts:178-189`).
2. Dev history is never requested for a non-complete snapshot: orchestrator
   guard (`src/application/analysis-service.ts:189-191`), adapter guard
   (`src/infrastructure/solana/helius/helius-solana-adapter.ts:326-327`),
   asserted zero requests
   (`test/application/solana/ca-analysis-orchestration.test.ts:188`).
3. Creator provenance (constitution rule 5): `getToken` intentionally omits
   creator (`src/infrastructure/solana/helius/helius-solana-adapter.ts:186`);
   `creatorAddress` enters the result only from pinned evidence
   (`src/application/analysis-service.ts:187`); evidence not matching
   `PUMP_PROGRAM_ID` / `PUMP_IDL_COMMIT` / `PUMP_IDL_SHA256`
   (`src/infrastructure/solana/pump/pump-instruction-decoder.ts:3-5`) is
   rejected (`src/infrastructure/solana/helius/helius-solana-adapter.ts:392-403`;
   `test/application/solana/ca-analysis-orchestration.test.ts:191-202,217-224`).
4. No silent fallback to generic holder/Dev math on Solana:
   `SOLANA_AUDITED_FACT_SERVICES_UNAVAILABLE` plus both INDETERMINATE codes,
   null conclusions, `unavailable` completeness
   (`src/application/analysis-service.ts:158-163`;
   `test/application/solana/ca-analysis-orchestration.test.ts:226-237`).
5. Constitution rule 4 evidence preserved through the copy: exclusion reason,
   confidence, rule version, reversible raw token-account snapshots, and
   label/cluster evidence survive `copyCleaningEvidence`
   (`src/application/analysis-service.ts:299-316`, mirroring
   `src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:191-206`)
   — and, per FIND-1 reproduction, this portion also survives the persistence
   round-trip.
6. Constitution rule 6: related-wallet activity stays separate from direct
   Dev activity — distinct `DevBehavior` fields (`src/domain/types.ts:180-193`),
   `relatedAddresses` passed as its own set
   (`src/application/analysis-service.ts:188,322-324`;
   `src/infrastructure/solana/helius/helius-solana-adapter.ts:331`) and
   filtered in the audited service
   (`src/infrastructure/solana/dev/solana-dev-history-service.ts:78-92`);
   distinct direct/related/transfer metrics asserted
   (`test/application/solana/ca-analysis-orchestration.test.ts:172-174`).
7. Constitution rule 2: no token transfer is counted as a sale — transfers
   are consumed only by the non-Solana branch
   (`src/application/analysis-service.ts:217`); the adapter keeps only
   `kind === "transfer"` entries
   (`src/infrastructure/solana/helius/helius-solana-adapter.ts:230`) and
   derives trades solely from swap events
   (`src/infrastructure/solana/helius/helius-solana-adapter.ts:343-371`).
8. Dev totals gate requires both `dev !== null` and
   `coverage.completeFromCreation`
   (`src/application/analysis-service.ts:195`), so a rogue history carrying
   `dev` with `completeFromCreation: false` is still refused with
   `DEV_TOTALS_INDETERMINATE`
   (`test/application/solana/ca-analysis-orchestration.test.ts:204-215`).
9. Write-set and forbidden-file compliance: `git show b96f1f5 --stat` lists
   exactly five files, all inside the implementer write set
   (`harness/tasks/SOL-CA-ORCHESTRATION-001.json:31-39`); the Pump decoder,
   holder snapshot service, Dev history service, and their fixtures are
   unmodified.
10. Offline deliverable: the test uses a fully inline fixture
    `SolanaHeliusDataSource`
    (`test/application/solana/ca-analysis-orchestration.test.ts:111-147`);
    no network import or live provider call appears in any declared input.
11. Evidence immutability where copies are made: creator evidence is returned
    as a fresh copy with a re-instantiated `blockTime`
    (`src/infrastructure/solana/helius/helius-solana-adapter.ts:315,405-407`),
    inputs are re-copied before forwarding to the source
    (`src/infrastructure/solana/helius/helius-solana-adapter.ts:328-333`),
    watermarks are recorded and returned as copies
    (`src/infrastructure/solana/helius/helius-solana-adapter.ts:162-164,336-340`),
    and `holderSnapshotEvidence` re-instantiates arrays, Maps, and Dates
    (`src/application/analysis-service.ts:284-297`).

## Advisories

1. (EIC-ADV-001, confirmed) Copy discipline is inconsistent: `result.holders`
   aliases `holderSnapshot.concentration`
   (`src/application/analysis-service.ts:171`) and `result.dev` aliases
   `devHistory.dev` (`src/application/analysis-service.ts:196`) while all
   evidence fields are deep-copied
   (`src/application/analysis-service.ts:284-320`). No corruption is
   constructible with in-repo components (persistence serializes before
   return; the only `ClusterMember.evidence` producer emits primitives,
   `src/domain/rules/funding-clusters.ts:63-68`), but a future memoizing
   source would share one mutable object across analyses.
2. (EIC-ADV-002, confirmed) Market-failure signaling is inconsistent: a
   thrown `getMarket` yields both `MARKET_ENRICHMENT_UNAVAILABLE`
   (`src/application/analysis-service.ts:241-247,150`) and the Chinese
   human-readable warning (`src/application/analysis-service.ts:223`), while
   a graceful `null` yields only the latter (reproduced). `market` is
   enrichment-only (constitution rule 7), so no on-chain fact is affected.
3. (EIC-ADV-003, confirmed) Upstream warnings are dropped on success
   branches: `snapshot.warnings` reach `result.warnings` only in the failure
   branch (`src/application/analysis-service.ts:172-175`, evidence copy at
   295), and `devHistory.warnings` are lost entirely when totals are adopted
   (`src/application/analysis-service.ts:197-200`; the evidence carries
   coverage only, `src/application/analysis-service.ts:318-320`,
   `src/domain/types.ts:134-149`). Not reachable with the pinned in-repo
   services, which only emit warnings in branches that already fail closed
   (`src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:143-157`;
   `src/infrastructure/solana/dev/solana-dev-history-service.ts:62-75`).
4. (EIC-ADV-004, confirmed) `PumpCreatorEvidence` carries no mint/CA binding
   (`src/infrastructure/solana/dev/solana-dev-history-service.ts:5-14`;
   `src/domain/types.ts:104-113`), and the orchestrator does not cross-check
   `evidence.signature` against `token.creationTx`
   (`src/application/analysis-service.ts:187`; `src/domain/types.ts:27`), so a
   faulty source could substitute another token's otherwise-valid create
   evidence. Schema hardening for a follow-up task; the evidence type was
   outside this task's write set.
5. (EIC-ADV-005, confirmed) The non-Solana branch hard-codes
   `holderCompleteness = "complete"` (and `devCompleteness = "complete"` with
   a creator) with no completeness assessment
   (`src/application/analysis-service.ts:208-219`). Unreachable today (only
   the Solana adapter exists; BSC/Robinhood are stage-blocked,
   `PROJECT_CONSTITUTION.md:11-13`, `KNOWN_LIMITATIONS.md:12`); the future
   BSC activation task must inherit this.
6. (Auditor addition) A source that violates the snapshot contract by
   returning `completeness: "complete"` with `concentration: null` would
   yield `holderCompleteness: "complete"` while `holders` is null
   (`src/application/analysis-service.ts:169-175`): the conclusion fails
   closed with a warning, but the completeness field misstates. The in-repo
   snapshot service cannot produce this state
   (`src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:89-113`);
   worth a defensive downgrade to `unavailable` alongside the FIND-2/FIND-3
   matrix repair.
7. (Auditor addition, pre-existing, out of the audited commit) Cache keys and
   the Postgres lookup lowercase the CA
   (`src/application/analysis-service.ts:54,72,88-89`;
   `src/infrastructure/postgres/postgres-analysis-repository.ts:15-16`).
   Base58 Solana addresses are case-sensitive, so two distinct mints
   differing only in letter case would collide and serve each other's
   analyses. Constructing such a colliding valid mint is cryptographically
   impractical, and this logic predates `b96f1f5`; flagged for the
   persistence hardening task.

## Acceptance reproduction

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 103 tests passed / 0 failed |
| `npm run build` | PASS |
| `git diff --check` | PASS |

## Required follow-up

A repair task is required before `SOL-CA-ORCHESTRATION-001` can be accepted as
the final CA orchestration contract:

1. FIND-1: make `HolderSnapshotEvidence.ownerBalances` serialization-safe
   (for example an array of `[owner, balanceRaw]` entries or a plain record
   built in `holderSnapshotEvidence()`), or teach both persistence layers
   explicit Map encoding; add a persistence round-trip test that asserts
   evidence equality for a full Solana result through `RedisAnalysisCache`
   and the `PostgresAnalysisRepository` encode/decode path.
2. FIND-2/FIND-3: align the `devCompleteness` matrix so `dev === null` never
   reports `complete`, and absent creator evidence reports `unavailable`
   (or document the intended semantics in `FactCompleteness`), updating the
   pinned orchestration tests accordingly.
3. FIND-4: before wiring any live source, derive the tag/cluster exclusion
   inputs for the audited snapshot from the snapshot's own enumeration
   rather than the unaudited generic top-100 list and the 30-minute trade
   window, or emit an explicit warning when exclusion inputs are known to be
   narrower than the snapshot.

This audit does not constitute Solana end-to-end acceptance.
