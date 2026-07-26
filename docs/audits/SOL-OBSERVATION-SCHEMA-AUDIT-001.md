# Audit: SOL-OBSERVATION-SCHEMA-001 (ObservationRecord, six snapshots, migration 008)

**Verdict: GREEN_WITH_ADVISORY**

Auditor: `claude-auditor-observation-schema` (independent from implementer, per
constitution "Collaboration rules": *the implementer cannot be the sole final
auditor of a Solana milestone*). Run: `20260727_SOL_OBSERVATION_SCHEMA_AUDIT_001`.
HEAD at audit start: `74314da150be78158f77c75abae0a33ae1c6b2db` (clean tree,
confirmed via `git status --porcelain` before and after review — see §6).

No FAIL-grade defect found: struct shapes match the methods doc, raw-integer
discipline holds end-to-end with no float/JS-number path for chain amounts,
there is no code path that constructs a borrowed+verified record directly, tri-
state security booleans are honored, migration 008 is additive-only and its
enums/FKs line up with the TS types. Two non-blocking advisories below (DB-level
defense-in-depth gaps, not violations of any binding rule).

---

## 1. Structs vs. `docs/METHODS_ALPHA_SCORE_AND_DETECTORS.md` Part 3

Compared field-by-field against §3.2 ("Unified observation record & six
snapshots").

- **`ObservationRecordBase`** (`src/domain/observation/observation-record.ts:206-233`)
  contains every field the doc lists (`observation_id, chain, subject{kind,ref},
  source, origin, verification_status, raw_text_or_json, raw_ref, raw_hash,
  parser_version, parser_input_kind, confidence, completeness, captured_at,
  source_observed_at, warnings[], trust_class`) plus `snapshotKind`/`snapshot`
  on the narrowed type (`ObservationRecordFor<K>`, line 242-245). Two additive
  fields beyond the doc's list: `confirmation` (implements the "first-hand
  confirmation path flips verification_status" mechanism the doc's own §3.1
  axioms require) and `observationFingerprint` (implements the doc's own PD-3
  fingerprint / migration's `UNIQUE (source, observation_fingerprint)`). Both
  are required implementations of doc-mandated behavior, not invented scope —
  **benign, not a deviation**.
- **`market_snapshot`** (lines 83-107): field-parity check against
  `market_observations` (migration `007_market_observations.sql:20-40`) —
  every column there (`price_usd, fdv_usd, liquidity_usd, market_cap_usd,
  volume_{5m,1h,6h,24h}_usd, buys/sells_{5m,1h}, price_change_*_pct,
  base/quote_reserve_raw, base/quote_decimals, pair_created_at`) has a 1:1
  camelCase counterpart in `MarketSnapshot`, plus `pairAddress` and
  `pairAgeSeconds` (doc's "Age" in "USD/FDV/Liq/Vol/Age"). No missing, no
  invented field.
- **`security_snapshot`** (lines 113-124): doc says "honeypot/tax(bps
  int)/mint-freeze-renounce/lock/burn/open-source/provider_risk_flags" →
  `isHoneypot, buyTaxBps, sellTaxBps, mintAuthorityRenounced,
  freezeAuthorityRenounced, liquidityLocked, liquidityLockedPct,
  liquidityBurned, isOpenSource, providerRiskFlags`. Exact coverage.
- **`holder_concentration_snapshot`** (lines 132-142): doc's
  "holder_count/top10/top20/dev/bundler pct" + "#3 guard: borrowed numbers set
  `owner_aggregated=false` + `is_borrowed_concentration=true`" →
  `holderCount, top10Pct, top20Pct, devHoldingPct, bundlerHoldingPct,
  ownerAggregated, isBorrowedConcentration`. Exact match, guard fields present
  and non-nullable (`boolean`, not `boolean|null` — correctly always asserted
  by the parser, never left ambiguous).
- **`wallet_signal_snapshot`** (lines 148-170): doc's "fresh/bundler/sniper/dev
  + per-wallet `LabeledWallet{address, labels[], label_source}`... precedence
  self_computed>birdeye>vybe>gmgn>manual" → matches exactly, including
  `LABEL_SOURCE_PRECEDENCE` (lines 150-156) which is byte-for-byte the doc's
  order.
- **`promotion_and_social_snapshot`** (lines 175-181) and **`call_source_snapshot`**
  (lines 188-195): match the doc's field lists (`dex_paid/first_call/
  group_size/urls/boosts`; capture-path vocabulary
  `forwarded_text/tdlib_client/ocr/manual` plus `platform_json` — the extra
  enum member is the general `ParserInputKind` used by non-call-source
  snapshots too, doc §3.1 PD-1 implies parser inputs beyond Telegram forwards,
  not a deviation of the call_source vocabulary itself since the test fixture
  for call_source uses `forwarded_text`).

**Finding: no missing or invented field that changes semantics.** All
additions are either direct implementations of doc-mandated mechanisms or
reasonable naming translations (snake_case doc → camelCase TS).

## 2. Raw-integer discipline (constitution #1)

- `RawIntegerString` branded type + `RAW_INTEGER_PATTERN = /^\d+$/`
  (`observation-record.ts:23-29`) — rejects sign, decimal point, exponent;
  `toRawIntegerString` throws on `"1.5"`, `"-100"`, `"1e10"`, non-numeric text,
  accepts `bigint` (lines 36-42, exercised by
  `test/observation/observation-schema.test.ts:84-92`).
- Chain-amount fields (`baseReserveRaw`, `quoteReserveRaw` in `MarketSnapshot`)
  are typed `RawIntegerString | null`, never `number`. Migration 008 stores
  the equivalent chain-amount columns (`gross_bought_raw`, `gross_sold_raw`,
  `current_balance_raw` in `wallet_token_edges`) as `numeric(78, 0)`
  (`008_address_library_and_observations.sql:35-37`), matching
  `market_observations`' and `001_initial.sql`'s existing raw-amount columns.
  No `float`/`real`/`double precision` type anywhere in migration 008.
- **Precision proof past `Number.MAX_SAFE_INTEGER`**: test
  `"raw chain amounts survive as decimal strings through JSON round-trip with
  no precision loss"` (`observation-schema.test.ts:49-82`) uses
  `quoteReserveRaw = "9007199254740993"` (= `Number.MAX_SAFE_INTEGER + 2`) and
  a 30-digit `baseReserveRaw`, round-trips through `JSON.parse(JSON.stringify(...))`
  (simulating jsonb/wire transport), and asserts the string survives exactly
  plus `BigInt(...).toString()` reproduces it — this is a genuine
  precision-loss guard, not a tautology (a float path would silently round
  `9007199254740993` to `9007199254740992`).
- **Date/ISO string cannot masquerade as a raw amount**: same test explicitly
  asserts `baseReserveRaw instanceof Date === false` and
  `assert.doesNotMatch(..., /^\d{4}-\d{2}-\d{2}T/)` (lines 78-80) — this
  actively guards against an ISO-date-shaped string being accepted, since
  `RAW_INTEGER_PATTERN` (`^\d+$`) would in fact reject an ISO string anyway
  (it contains `-`, `:`, `T`), so the guard is real, not decorative.
- Confirmed no float/JS-number path exists for chain quantities: grepped
  `MarketSnapshot`/`wallet_token_edges` — only USD/enrichment fields are
  `number | null` (consistent with doc's "all USD as nullable enrichment," not
  a chain quantity under constitution #1).

## 3. Borrowed stays unverified until first-hand (trust tiers / #7)

- `buildObservationRecord` (lines 321-365) **unconditionally** sets
  `verificationStatus: "unverified"` in the returned base object (line 337) —
  the `BuildObservationRecordInput` type has no `verificationStatus` field at
  all, so **there is no public constructor input that can produce a
  borrowed+verified record directly**. I attempted to find a bypass: the only
  other place `verificationStatus` is assigned is inside `confirmFirstHand`
  (line 384), which is gated by `if (record.origin !== "borrowed") throw`
  (lines 379-381) — so a first-hand-origin record can never reach
  `"verified"` either (see advisory 7.1 below), and a borrowed record can only
  become verified through this one explicit, auditable function.
  `confirmFirstHand` never mutates `origin` (spread preserves it; test
  `"first-hand confirmation flips verification_status to verified but never
  changes origin"` at line 174 asserts `origin` unchanged and that the
  *original* record object is untouched — pure function, no mutation).
- Migration defaults: `wallet_token_edges.verification_status` and
  `observations.verification_status` both
  `NOT NULL DEFAULT 'unverified'` (`008_address_library_and_observations.sql:44,74`).
- Tests directly exercising this: `"borrowed observation stays
  origin=borrowed + verification_status=unverified at capture"` (line 128),
  `"first-hand confirmation flips verification_status to verified but never
  changes origin"` (line 151), `"confirmFirstHand refuses to 'confirm' an
  already first-hand observation"` (line 183, asserts `throws`).
- Caveat (structural, not a code bypass): the migration has no DB-level CHECK
  tying `verification_status='verified'` to the confirmation columns being
  populated — see advisory 7.2.

## 4. Partial → completeness, never fabricated precision (#8)

- `computeSnapshotCompleteness` (lines 255-265) is a pure reflection over
  `Object.keys(snapshot)`; a field counts as filled only if non-null,
  non-undefined, and (for arrays) non-empty — it never substitutes a default.
  Because every one of the six snapshot interfaces declares all fields as
  required-but-nullable (no `?:` optional markers), TypeScript forces every
  caller to supply every key explicitly (with `null` where unknown), so the
  denominator (`keys.length`) can't silently shrink from missing keys.
- Verified end-to-end: test `"buildObservationRecord derives completeness
  from the snapshot and reflects partial data end to end"` (line 230) builds
  a partial vs. a full `HolderConcentrationSnapshot` and asserts
  `partialRecord.completeness < fullRecord.completeness` and
  `fullRecord.completeness === 1`.
- **Tri-state security booleans**: `SecuritySnapshot.isHoneypot`,
  `mintAuthorityRenounced`, etc. are all `boolean | null` (lines 114-122,
  never plain `boolean`). Test `"all six snapshot kinds construct..."`
  (line 308-336) builds a record with `isHoneypot: null` and asserts
  `securityRecord.snapshot.isHoneypot === null` (not coerced to `false`),
  while `mintAuthorityRenounced: true` passes through unchanged — proves
  absence and `false` are distinguishable, not collapsed.
- `HolderConcentrationSnapshot` test (line 216) explicitly asserts
  `partial.devHoldingPct === null` and
  `assert.notEqual(partial.devHoldingPct, 0)` — guards against the specific
  "unknown coerced to 0" failure mode named in the doc.

## 5. Migration 008 additive-only + schema alignment

- `grep -in "ALTER\|DROP"` over the file matches only the header comment
  ("No ALTER/DROP against existing tables") — the file contains exactly two
  `CREATE TABLE` statements (`wallets`, `wallet_token_edges`... plus
  `observations`, three total) and four `CREATE INDEX` statements, no
  `ALTER`/`DROP` DDL against `tokens`, `token_markets`, `address_labels`,
  `funding_edges`, `address_clusters`, `address_cluster_members`,
  `normalized_trades`, `market_observations`, or any other existing table.
- Enum consistency, verified against `src/domain/types.ts` and
  `observation-record.ts`:
  - `chain` CHECK `('solana','bsc','robinhood')` in both new tables matches
    `export type Chain = "solana" | "bsc" | "robinhood"` (`types.ts:1`).
  - `observations.trust_class` CHECK `('A','B','C','D','E')` matches
    `export type MarketTrustClass = "A"|"B"|"C"|"D"|"E"` (`types.ts:258`).
  - `observations.snapshot_kind` CHECK lists exactly the six kinds
    (`market, security, holder_concentration, wallet_signal,
    promotion_and_social, call_source`), matching `SnapshotKind`
    (`observation-record.ts:50-56`) verbatim, same order.
  - `origin`/`verification_status` CHECKs match `ObservationOrigin`/
    `VerificationStatus` exactly, in both `wallet_token_edges` and
    `observations`.
  - `parser_input_kind` CHECK matches `ParserInputKind` exactly (5 values,
    including `platform_json`).
  - `wallet_token_edges.pnl_source` CHECK
    (`birdeye,moralis,solanatracker,bitquery,gmgn,self_computed`) matches the
    methods doc §1.4's provenance list verbatim.
  - `wallets.alpha_score_tier` / `alpha_score_status` CHECKs match doc §1.2/
    §1.3 tier and status vocabularies (`UR/SSR/SR/R/N`;
    `scored/provisional/insufficient` — correctly omits `N` from the status
    set, since the doc explicitly treats `insufficient` and tier `N` as
    distinct, non-collapsible states).
- FK validity: `wallet_token_edges.token_id REFERENCES tokens(id)` — valid,
  `tokens.id uuid PRIMARY KEY` in `001_initial.sql:4`.
  `wallet_token_edges (chain, wallet_address) REFERENCES wallets (chain,
  address)` — valid, matches `wallets` `PRIMARY KEY (chain, address)`
  (line 25).
- `observations` has no FK to `tokens`/`wallets` (only `subject_kind`/
  `subject_ref` text columns) — correct by design: a Telegram-forwarded or
  OCR observation may reference a token/wallet address not yet present in
  `tokens`/`wallets`, so a hard FK would block exactly the "hint layer,
  ingest first, reconcile later" behavior architecture §8 requires.

## 6. Acceptance commands — run independently, verbatim tails

Tree was clean (`git status --porcelain` empty) both immediately before
`harness run start` and again after writing this report (see final section).

**`npm run typecheck`**
```
> memecoin-ca-data-layer@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
```
(no errors, exit 0)

**`npm test`** — tail:
```
✔ raw chain amounts survive as decimal strings through JSON round-trip with no precision loss (2.6315ms)
✔ toRawIntegerString rejects floats, signs, and non-numeric text; accepts bigint (0.4266ms)
✔ observationFingerprint is stable for identical inputs (replay determinism, PD-3) (0.1638ms)
✔ borrowed observation stays origin=borrowed + verification_status=unverified at capture (0.1722ms)
✔ first-hand confirmation flips verification_status to verified but never changes origin (0.184ms)
✔ confirmFirstHand refuses to 'confirm' an already first-hand observation (0.1502ms)
✔ partial snapshot has lower completeness than full snapshot, with nulls (not fabricated values) (0.0969ms)
✔ buildObservationRecord derives completeness from the snapshot and reflects partial data end to end (0.1951ms)
✔ all six snapshot kinds construct with nullable fields and never require fabricated data (0.3864ms)
...
ℹ tests 135
ℹ suites 0
ℹ pass 135
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1392.6025
```

**`npm run build`**
```
> memecoin-ca-data-layer@0.1.0 build
> tsc -p tsconfig.json
```
(no errors, exit 0)

**`git diff --check`**: empty output, exit 0 (no whitespace errors).

## 7. Advisories (non-blocking)

1. **P3 — `verificationStatus` is unreachable for `origin="first_hand"`
   records.** `buildObservationRecord` always sets `"unverified"` regardless
   of `origin`, and `confirmFirstHand` throws for any non-`"borrowed"`
   origin, so a first-hand-origin observation's `verificationStatus` is
   permanently `"unverified"` — there is no path to ever set it to
   `"verified"`. This appears to be an intentional design choice (the
   docstring at lines 372-373 states "a first-hand-origin record is already
   trusted at capture and cannot be 'confirmed' again"), and no defect
   scenario currently reads `verificationStatus` downstream (grepped `src/`
   — only this file references it), so this is **not a constitution
   violation**. Flagging because the field name alone invites a future
   caller to assume `"unverified"` means "distrust this," when for
   first-hand rows it structurally means "N/A — origin already implies
   trust." A short doc comment on `VerificationStatus` itself (not just on
   `confirmFirstHand`) would prevent future misreading.
2. **P3 — Migration 008 lacks a DB-level CHECK tying `verification_status`
   to the confirmation columns.** Neither `wallet_token_edges` nor
   `observations` has a constraint such as
   `CHECK (verification_status = 'unverified' OR confirmed_at IS NOT NULL)`
   analogous constraint. The TS layer (`buildObservationRecord` /
   `confirmFirstHand`) correctly enforces the borrowed→verified lifecycle in
   application code, and no code path in this task's write set bypasses it,
   but a future direct-SQL backfill or admin script could insert
   `verification_status='verified'` with no confirmation evidence, since the
   DB alone doesn't defend the invariant. Recommend defense-in-depth in a
   later migration, not blocking this one (migration 008 is scoped to
   additive schema only, and the task's forbidden_actions bar ALTER/DROP —
   this would need a follow-up task, not a change to 008 itself).
3. **P4 — `confidence`/`completeness` overrides are not range-clamped in
   `buildObservationRecord`.** The DB CHECK constraints enforce `BETWEEN 0
   AND 1` on insert, but the pure TS constructor accepts any `number` for
   `confidence` and for the optional `completeness` override without a
   runtime bounds check, so an in-memory (pre-persistence) record could
   transiently hold an out-of-range value before hitting the DB layer.
   Low impact (caught at insert time), noted for completeness.

None of the above rise to a constitution or architecture violation; none
block GREEN.

## 8. Auditor's own write-scope compliance

Only file written by this audit: `docs/audits/SOL-OBSERVATION-SCHEMA-AUDIT-001.md`.
`git status --porcelain` before starting the harness run was empty; the only
change introduced by this audit is the untracked report file itself (left
uncommitted for the coordinator, per instructions).
