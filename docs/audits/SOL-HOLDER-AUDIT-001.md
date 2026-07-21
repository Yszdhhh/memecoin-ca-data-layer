# SOL-HOLDER-AUDIT-001

- Role: independent auditor
- Tier: T2
- Chain: Solana
- Audited task: `SOL-HOLDER-001`
- Audit time: 2026-07-20 UTC
- Verdict: **FAIL**

## Scope and method

Read-only audit of only the inputs declared by
`harness/tasks/SOL-HOLDER-AUDIT-001.json`: the implemented holder snapshot
service, its test, its fixture, `real-holders.ts`, the implemented task
specification, and the project constitution. No network, credentials, source,
test, fixture, task, or migration was changed. This report is the sole audit
write.

The audit checked exhaustive cursor traversal, Solana owner aggregation,
confidence-gated exclusion, reversible exclusion evidence, and fail-closed
handling of incomplete or inconsistent enumeration.

## Finding

### FIND-1 [P1] Complete concentration is calculated from pages at different finalized slots

`SolanaHolderSnapshotService.build` considers an enumeration complete solely
when every page reports `watermark.completeness === "complete"`
([solana-holder-snapshot-service.ts](G:/链上战壕/src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:73)).
It then aggregates all pages and calculates concentration
([solana-holder-snapshot-service.ts](G:/链上战壕/src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:72),
[solana-holder-snapshot-service.ts](G:/链上战壕/src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:95)).
The implementation preserves, but never compares, per-page `finalizedSlot`
watermarks ([solana-holder-snapshot-service.ts](G:/链上战壕/src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:126)).

The accepted fixture demonstrates the unsafe state: page 1 is `complete` at
slot `434047820` ([holder-snapshot.json](G:/链上战壕/test/fixtures/solana/holders/holder-snapshot.json:15)),
while page 2 is `complete` at slot `434047821`
([holder-snapshot.json](G:/链上战壕/test/fixtures/solana/holders/holder-snapshot.json:29)).
The test nevertheless asserts a `complete` snapshot and Top20 concentration
([solana-holder-snapshot-service.test.ts](G:/链上战壕/test/solana/holders/solana-holder-snapshot-service.test.ts:73)).

Holder pages read from different finalized chain states are not a single
reproducible snapshot. A balance can change between requests, be returned in
both pages, or be omitted at the moving cursor boundary. Because the service
does not pin a common slot/cursor or reject different finalized slots, it can
label an incomplete concentration calculation as complete. This violates the
constitution requirement that partial data emit warnings/completeness rather
than false precision.

Required remediation before re-audit:

1. Require a source-provided snapshot boundary that is stable across every
   page, or treat differing/missing required finalized-slot evidence as
   `partial` with `concentration: null` and an explicit warning.
2. Define and enforce deduplication or rejection for a repeated
   `tokenAccountAddress` across pages at the same snapshot boundary; owner
   aggregation alone does not prevent double counting an overlapping page.
3. Replace the current differing-slot `complete` fixture with a same-boundary
   complete fixture, and add tests for mismatched slots, missing finality when
   required by the source contract, and overlapping token-account pages.

## Verified controls

These controls are present but do not offset FIND-1:

- Cursor iteration continues until `nextCursor` is `undefined`, and a repeated
  cursor throws rather than silently truncating
  ([solana-holder-snapshot-service.ts](G:/链上战壕/src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:117),
  [solana-holder-snapshot-service.ts](G:/链上战壕/src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:129));
  the repeated-cursor path is tested
  ([solana-holder-snapshot-service.test.ts](G:/链上战壕/test/solana/holders/solana-holder-snapshot-service.test.ts:112)).
- Token accounts are aggregated by `ownerAddress` using raw `bigint` amounts
  before the result enters the holder rule
  ([solana-holder-snapshot-service.ts](G:/链上战壕/src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:138));
  the fixture verifies Alice's two accounts aggregate to `150`
  ([solana-holder-snapshot-service.test.ts](G:/链上战壕/test/solana/holders/solana-holder-snapshot-service.test.ts:76)).
- Infrastructure labels require confidence `>= 0.8`; cluster exclusion requires
  `>= 0.85` ([solana-holder-snapshot-service.ts](G:/链上战壕/src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:5),
  [solana-holder-snapshot-service.ts](G:/链上战壕/src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:100));
  the domain rule applies the same threshold to cluster members
  ([real-holders.ts](G:/链上战壕/src/domain/rules/real-holders.ts:25)).
- Every excluded owner retains its raw contributing accounts, exclusion reason,
  confidence, rule version, and matching label/cluster evidence
  ([solana-holder-snapshot-service.ts](G:/链上战壕/src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:147),
  [solana-holder-snapshot-service.ts](G:/链上战壕/src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:181)).
- When a page explicitly says `partial`, the implementation returns no
  concentration and no cleaning evidence
  ([solana-holder-snapshot-service.ts](G:/链上战壕/src/infrastructure/solana/holders/solana-holder-snapshot-service.ts:76));
  this path is tested
  ([solana-holder-snapshot-service.test.ts](G:/链上战壕/test/solana/holders/solana-holder-snapshot-service.test.ts:93)).

## Acceptance evidence

Executed from `G:\链上战壕`:

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 25 tests / 25 passed |
| `npm run build` | PASS |
| `git diff --check` | No whitespace error; emitted existing CRLF conversion warnings for unrelated worktree files |

Passing compilation and tests do not change the verdict because the fixture and
test currently encode the inconsistent-finalized-slot case as complete.

## Residual limitations

The repository has no live holder provider wired and no provider payload drift
or live chain replay coverage. This audit makes no claim about a provider's
pagination, finality, or snapshot semantics. Those remain unverified until a
separately authorized adapter and pinned evidence exist.

## Auditor self-check

- One verdict is recorded: `FAIL`.
- No boundary-external writes occurred.
- No hidden provider behavior was assumed as verified.
