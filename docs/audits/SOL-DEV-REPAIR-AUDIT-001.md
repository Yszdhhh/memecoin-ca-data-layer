# SOL-DEV-REPAIR-AUDIT-001 — Independent audit of Solana Dev provenance remediation

## Agent / model / time / task path

| Field | Value |
| --- | --- |
| Agent / role | Independent auditor (`role=auditor`) |
| Model | Grok 4.5 (xAI) |
| UTC time | `2026-07-20T14:12:37Z` |
| Task ID | `SOL-DEV-REPAIR-AUDIT-001` |
| Tier | `T2` |
| Chain | `solana` |
| Exact task spec path | `G:\链上战壕\harness\tasks\SOL-DEV-REPAIR-AUDIT-001.json` |
| Write set (this audit) | `docs/audits/SOL-DEV-REPAIR-AUDIT-001.md` only |
| HEAD (short) | `d9bb74a` |
| HEAD (full) | `d9bb74af2ba216956b6eb4a342cff8def51744ed` |

## Verdict

**GREEN**

`SOL-DEV-REPAIR-001` closes all three findings from `SOL-DEV-AUDIT-001` without
weakening creator provenance retention, coverage completeness gating, or
direct / related / transfer separation. Creator evidence is fail-closed against
the pinned Pump program ID, IDL commit, IDL SHA-256, and `creationSlot`; incomplete
or non-finalized history retains validated creator evidence, returns `dev: null`,
and never claims `completeFromCreation`; `relatedCurrentBalances` are filtered to
`relatedAddresses` before `relatedHoldingPct` is computed; transfers remain
non-sales. Acceptance commands pass. No out-of-boundary write or network use was
performed by this auditor.

## Preflight

| Check | Result | Evidence |
| --- | --- | --- |
| Required reading | PASS | Read `PROJECT_REQUIRED_READING.md`, then `AGENTS.md`, `PROJECT_CONSTITUTION.md`, `PROJECT_OPERATING_PLAYBOOK.md`, `KNOWN_LIMITATIONS.md`, `OWNER_DECISIONS_NEEDED.md`, `harness/config/project.json`, and the named task spec only after governance. |
| Task spec exists | PASS | `harness/tasks/SOL-DEV-REPAIR-AUDIT-001.json` present and readable. |
| Harness validate | PASS | `npm run harness:task -- validate harness/tasks/SOL-DEV-REPAIR-AUDIT-001.json` → `{"task_id":"SOL-DEV-REPAIR-AUDIT-001","status":"GREEN","errors":[]}` |
| `task_id` | PASS | `SOL-DEV-REPAIR-AUDIT-001` |
| `role` | PASS | `auditor` |
| `tier` | PASS | `T2` |
| `chain` | PASS | `solana` (active per `harness/config/project.json` `active_chains`) |
| `write_set` | PASS | sole path `docs/audits/SOL-DEV-REPAIR-AUDIT-001.md` |
| Deliverable | PASS | same path as `write_set` / `deliverables` |
| Stage lock | PASS | Solana-only task; BSC/Robinhood not activated |
| Inputs readable | PASS | All 10 `inputs` paths open without substitution |
| `git status --short` | PASS (ran) | See Git state section; working tree has parallel-wave dirty/untracked files unrelated to this auditor write. |
| `git ls-files --others --exclude-standard` | PASS (ran) | Explicit untracked listing used; **not** replaced by `git diff HEAD`. |

Preflight mismatch threshold: **not triggered** → proceed to verification (not `PARK`).

## Scope and method

Audited remediations claimed by dependency `SOL-DEV-REPAIR-001` against findings
in `docs/audits/SOL-DEV-AUDIT-001.md`.

Inputs reviewed (task-listed only):

1. `PROJECT_CONSTITUTION.md`
2. `docs/audits/SOL-DEV-AUDIT-001.md`
3. `harness/tasks/SOL-DEV-REPAIR-001.json`
4. `src/infrastructure/solana/dev/solana-dev-history-service.ts`
5. `test/solana/dev/solana-dev-history-service.test.ts`
6. `test/fixtures/solana/dev/complete-history.json`
7. `test/fixtures/solana/dev/partial-history.json`
8. `src/infrastructure/solana/pump/pump-instruction-decoder.ts`
9. `src/domain/rules/dev-behavior.ts`

Method: static line-level review + fixture arithmetic + acceptance command
reproduction. No source/test/fixture/task/ledger edits. No RPC, network APIs,
credentials, or provider calls.

## Finding closure matrix (vs SOL-DEV-AUDIT-001)

| Prior finding | Severity | Remediation status | Verdict |
| --- | --- | --- | --- |
| Creator provenance discarded when history incomplete | P1 | Closed | PASS |
| Pump creator evidence not bound to program / IDL pin / creation slot | P1 | Closed | PASS |
| Unrelated balances can inflate `relatedHoldingPct` | P2 | Closed | PASS |

## Verification items

### 1. Creator evidence fail-closed binding (pinned program, IDL commit, IDL SHA-256, creationSlot)

**Result: PASS**

`SolanaDevHistoryService` imports the pinned constants from the Pump decoder
module and validates every claimed Pump creator evidence against them and against
the supplied `creationSlot`:

```103:118:src/infrastructure/solana/dev/solana-dev-history-service.ts
function hasTrustedCreatorEvidence(
  evidence: PumpCreatorEvidence | null,
  creationSlot: bigint,
): evidence is PumpCreatorEvidence {
  return evidence !== null
    && evidence.source === CREATOR_SOURCE
    && evidence.creatorAddress.length > 0
    && evidence.signature.length > 0
    && evidence.slot >= 0n
    && evidence.blockTime instanceof Date
    && !Number.isNaN(evidence.blockTime.getTime())
    && evidence.programId === PUMP_PROGRAM_ID
    && evidence.sourceCommit === PUMP_IDL_COMMIT
    && evidence.idlSha256 === PUMP_IDL_SHA256
    && evidence.slot === creationSlot;
}
```

Pinned constants (decoder source of truth):

| Pin | File:line | Value |
| --- | --- | --- |
| Program ID | `pump-instruction-decoder.ts:3` | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` |
| IDL commit | `pump-instruction-decoder.ts:4` | `9c82f61cb711b044a17f770ab8ce9f9bdf78f333` |
| IDL SHA-256 | `pump-instruction-decoder.ts:5` | `b90bc471327f671449271d5d1d42354d1fae6f5a06502f5834459a3108138e49` |

Happy-path fixture binds the same pins and `slot === creation_slot === "500"`:

- `complete-history.json:4-14` (`program_id`, `source_commit`, `idl_sha256`, `slot`)
- `complete-history.json:14` (`creation_slot`)

On any mismatch, the service sets `creatorEvidence = null`, pushes
`CREATOR_EVIDENCE_MISSING_OR_UNTRUSTED`, and returns `dev: null` without calling
`calculateDevBehavior`:

- Gate: `solana-dev-history-service.ts:63-76`
- Non-Pump source rejection test: `solana-dev-history-service.test.ts:182-191`
- Pin / slot fail-closed matrix (`programId`, `sourceCommit`, `idlSha256`, `slot`):
  `solana-dev-history-service.test.ts:193-210`

**Fail-closed rule satisfied:** mismatch ⇒ no `DevBehavior` output.

### 2. Incomplete / gapped / non-finalized history: retain creator, `dev=null`, completeness warning, no complete-from-creation claim

**Result: PASS**

Coverage assessment requires oldest observed ≤ creation, newest ≥ creation,
finalized ≥ newest, no gaps, and valid cursor/timestamp:

```120:141:src/infrastructure/solana/dev/solana-dev-history-service.ts
function assessCoverage(creationSlot: bigint, watermark: DevHistoryWatermark): DevHistoryCoverage {
  const completeFromCreation = creationSlot >= 0n
    && watermark.oldestObservedSlot >= 0n
    && watermark.newestObservedSlot >= watermark.oldestObservedSlot
    && watermark.cursor.trim().length > 0
    && watermark.observedAt instanceof Date
    && !Number.isNaN(watermark.observedAt.getTime())
    && watermark.oldestObservedSlot <= creationSlot
    && watermark.newestObservedSlot >= creationSlot
    && watermark.finalizedSlot >= watermark.newestObservedSlot
    && !watermark.hasGaps;
  // ... returns completeFromCreation among coverage fields
}
```

Creator validation is independent of coverage. Early return preserves the
validated (or null) creator while forcing `dev: null`:

```63:76:src/infrastructure/solana/dev/solana-dev-history-service.ts
    const creatorEvidence = hasTrustedCreatorEvidence(input.creatorEvidence, input.creationSlot)
      ? input.creatorEvidence
      : null;
    // warnings for missing creator and incomplete history (independent)
    if (creatorEvidence === null || !coverage.completeFromCreation) {
      return { creatorEvidence, coverage, dev: null, warnings };
    }
```

| Scenario | `completeFromCreation` | `creatorEvidence` | `dev` | Warning | Evidence |
| --- | --- | --- | --- | --- | --- |
| History starts after creation (`partial-history` oldest `525` > creation `500`) | `false` | retained (`creator-wallet`) | `null` | `DEV_HISTORY_INCOMPLETE_FROM_CREATION` | test `143-165`; fixture `partial-history.json:2-11` |
| `hasGaps: true` | `false` | (validated path) | `null` | same warning | test `167-180` |
| `finalizedSlot < newestObservedSlot` (`579 < 580`) | `false` | (validated path) | `null` | same warning | test `171-179` |
| Complete finalized path | `true` | retained | non-null | none | test `125-141` |

Prior audit P1 (creator wiped on incomplete history at old early-return) is
closed: incomplete paths no longer substitute `creatorEvidence: null` solely
because coverage failed.

### 3. `relatedCurrentBalances` only for `relatedAddresses`

**Result: PASS**

Before domain calculation, the service filters the balance map:

```78:81:src/infrastructure/solana/dev/solana-dev-history-service.ts
    const relatedAddresses = new Set(input.relatedAddresses);
    const relatedCurrentBalances = new Map(
      [...input.relatedCurrentBalances].filter(([address]) => relatedAddresses.has(address)),
    );
```

Domain rule still sums the map it is given (`dev-behavior.ts:42-48`); the repair
correctly ensures the service only supplies balances for declared related
addresses, so unlisted addresses cannot affect `relatedHoldingPct`.

Regression test injects `["unrelated-wallet", 900_000n]` and asserts
`relatedHoldingPct` remains `3` (only `related-wallet` / `30000` / supply
`1000000`):

- Fixture related set: `complete-history.json:24-25`
- Test: `solana-dev-history-service.test.ts:212-221`

### 4. Direct sell, related sell, and outbound transfer remain separated; transfer ≠ sell

**Result: PASS**

Domain rule (`dev-behavior.ts`):

| Metric | Logic | Lines |
| --- | --- | --- |
| Direct buy / sell | `trade.trader === creatorAddress`; sell increments `directSold` + `directSellCount` | `26-32` |
| Related sell | `related.has(trader) && side === "sell"` only | `33-35` |
| Outbound transfer | `from === creator` **and** `to` not in related; **not** added to sold | `38-41` (+ comment L38) |
| Related holding | sum of related balances (after service filter) | `42-48` |

Complete fixture arithmetic (supply `1_000_000`):

| Field | Expected | Fixture source | Asserted |
| --- | --- | --- | --- |
| `grossBoughtPct` | 20 | buy `200000` | test L134 |
| `grossSoldPct` | 5 | direct sell `50000` | test L135 |
| `relatedGrossSoldPct` | 4 | related sell `40000` | test L136 |
| `outboundTransferPct` | 2.5 | external transfer `25000` only (related transfer `10000` excluded) | test L137 |
| `directSellCount` | 1 | one creator sell | test L138 |
| `netDisposedPct` | 0 | sold ≤ bought | test L139 |
| `relatedHoldingPct` | 3 | balance `30000` | test L140 |

Other-token trades/transfers in the fixture are filtered by chain+tokenId at
service lines `88-89` before domain input construction.

**Confirmed:** no path reclassifies a transfer as a sell.

### 5. Repair did not introduce network, RPC, credentials, BSC, Robinhood, Holder rule changes, or external providers

**Result: PASS**

| Risk | Observation |
| --- | --- |
| Network / RPC / HTTP client | `solana-dev-history-service.ts` has no `fetch`, axios, RPC client, or endpoint config. Only pure analysis over caller-supplied inputs. |
| Credentials / env | No `process.env`, secrets, or provider keys in service or its unit tests. |
| BSC / Robinhood | Repair task `chain=solana`; no BSC/Robinhood adapter imports or stage activation. |
| Holder rules | Repair `write_set` was `src/infrastructure/solana/dev/**`, `test/solana/dev/**`, `test/fixtures/solana/dev/**` (`SOL-DEV-REPAIR-001.json:12`). Holder services/rules are outside that set and were not used as this auditor's write target. |
| External providers | No live provider calls in acceptance path; tests use offline fixtures only. |
| Import surface | Service imports: domain `calculateDevBehavior` + types, and Pump pin constants from `pump-instruction-decoder.js` (lines 1-3). |

This auditor performed only local filesystem reads and local npm/git commands.
**No network calls** were made for verification.

## Acceptance command results

Commands executed from `G:\链上战壕` at audit time.

### `npm run typecheck`

```text
> memecoin-ca-data-layer@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
```

**PASS** (exit 0, no diagnostics).

### `npm test`

```text
> memecoin-ca-data-layer@0.1.0 test
> tsx --test test/**/*.test.ts

… (full suite) …
✔ uses Pump create.creator evidence and keeps direct, related and transfer metrics separate
✔ does not claim Dev completeness when history begins after creation
✔ does not claim Dev completeness when a watermark has gaps or is not finalized
✔ does not substitute non-Pump creator evidence
✔ fails closed when creator evidence is not bound to the pinned Pump creation contract
✔ filters balances outside the declared related-address set
…
ℹ tests 30
ℹ pass 30
ℹ fail 0
ℹ duration_ms 527.2995
```

**PASS** — 30 passed / 0 failed (includes all six Dev-history repair cases).

### `npm run build`

```text
> memecoin-ca-data-layer@0.1.0 build
> tsc -p tsconfig.json
```

**PASS** (exit 0).

### `git diff --check`

```text
warning: in the working copy of 'docs/research/SOL-PUMP-PROVENANCE-001.md', LF will be replaced by CRLF the next time Git touches it
… (CRLF normalization warnings on other already-tracked modified files) …
```

**PASS for audit purposes** — no conflict markers or trailing-whitespace errors
reported; only line-ending normalization warnings on pre-existing modified tracked
files outside this auditor's write set.

## Git state

### `git status --short` (abridged categories)

Tracked modifications (examples): `docs/research/SOL-PUMP-PROVENANCE-001.md`,
`harness/CURRENT_WAVE.md`, `harness/ledger/tasks.json`, several task JSON files.

Untracked paths present in the worktree include (non-exhaustive relative to
audit): prior audit reports under `docs/audits/`, multiple harness task specs
(including `SOL-DEV-REPAIR-001.json` / this audit task), Solana dev/pump/holders
source and fixtures, and unrelated SQL/markdown artifacts.

**This auditor wrote only** `docs/audits/SOL-DEV-REPAIR-AUDIT-001.md`.

### `git ls-files --others --exclude-standard`

Untracked list was obtained via **`git ls-files --others --exclude-standard`**
(not via `git diff HEAD`). Snapshot at preflight included, among others:

- `docs/audits/SOL-DEV-AUDIT-001.md` (prior FAIL audit under review)
- `harness/tasks/SOL-DEV-REPAIR-001.json`
- `harness/tasks/SOL-DEV-REPAIR-AUDIT-001.json`
- `src/infrastructure/solana/dev/solana-dev-history-service.ts`
- `test/solana/dev/solana-dev-history-service.test.ts`
- `test/fixtures/solana/dev/complete-history.json`
- `test/fixtures/solana/dev/partial-history.json`
- `src/infrastructure/solana/pump/pump-instruction-decoder.ts`
- additional parallel-wave untracked paths (holders, pump fixtures/tests, designs, SQL)

**Note:** Dev repair artifacts are still untracked in this worktree. That does
not block a correctness verdict on the code as present on disk; it is a
coordinator integration/commit hygiene observation, not a functional regression
in the repair logic.

## Constitution alignment

| Rule | Alignment |
| --- | --- |
| Creator provenance retained; Pump `create.creator` outranks other labels | Enforced via source literal + pin binding; non-Pump source rejected |
| Related-wallet activity separate from direct Dev | Domain metrics + service filters preserve separation |
| Transfers are not sales without swap evidence | Outbound transfer metric is independent of sold totals |
| Partial data → warnings/completeness, no fake precision | Incomplete history ⇒ `dev: null` + warning; no fabricated complete metrics |

## Open items / advisories (non-blocking)

1. **Worktree hygiene:** Dev service/tests/fixtures and this audit task remain
   untracked; coordinator should integrate/commit outside auditor scope.
2. **`KNOWN_LIMITATIONS.md` wording** still states Dev history “assumes
   normalized trades are complete from creation time.” The service now
   explicitly refuses completeness claims when coverage fails; the limitation
   doc is stale relative to this repair (documentation outside write set).
3. **Defense-in-depth:** `calculateDevBehavior` still trusts its
   `relatedCurrentBalances` map without re-checking `relatedAddresses`. The
   Solana history service correctly filters; other future callers of the domain
   helper must do the same.
4. This audit is **not** Solana end-to-end GREEN (fixture + authorized live CA
   still required per constitution).

## SELF_CHECK

| Item | Status |
| --- | --- |
| Required reading completed in order | YES |
| Task spec validated GREEN by Harness | YES |
| `task_id` / `role` / `tier` / `chain` / `write_set` / deliverable match | YES |
| Only task `inputs` accessed for code review | YES |
| All five mandatory verification items exercised with file:line evidence | YES |
| Acceptance commands run and recorded | YES |
| `git status --short` and `git ls-files --others --exclude-standard` run | YES |
| `git diff HEAD` not used as untracked substitute | YES |
| Single verdict selected | **GREEN** |
| No out-of-write-set modifications by this auditor | YES — only this report path |
| No network / RPC / credentials used by this auditor | YES |
| No source, tests, fixtures, ledger, or task specs modified | YES |
| Implementer of repair is not sole auditor (independent role) | YES |

## Boundary confirmations

- **No out-of-boundary writes:** sole write is `docs/audits/SOL-DEV-REPAIR-AUDIT-001.md`.
- **No network calls:** local npm scripts and git only; no RPC, Helius, Dexscreener,
  Pump HTTP, or other external provider access.
- **No credential handling.**
- **No BSC / Robinhood / holder-rule edits.**

---

**Final verdict: GREEN**
