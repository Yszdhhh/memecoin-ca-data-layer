# Audit: SOL-HARNESS-SUITES-001 (four offline acceptance suites)

**Verdict: GREEN_WITH_ADVISORY**

Auditor: `grok-auditor-harness-suites` (identity distinct from implementer
`grok-implementer-harness-suites`, per constitution: implementer cannot be the
sole final auditor of a Solana milestone).  
Run: `20260727_SOL_HARNESS_SUITES_AUDIT_001`.  
Audited commit (implementer finish): `5529ea7` / ledger flip `7767163`.  
Tree at audit start: clean `main` at post-implementer HEAD (ahead of origin).

No Owner decision is required for this audit. Tolerance **relaxation** would be
T3-flavored; none is proposed.

---

## Scope

Independently verify that the four suites required by
`PROJECT_ARCHITECTURE.md` §6 and `docs/METHODS_ALPHA_SCORE_AND_DETECTORS.md`
§3.4:

1. Exist under `src/harness-suites/**` with offline runner CLIs.
2. Are deterministic and offline (no network; latency uses a virtual clock).
3. Fail closed (`exitFor`: PASS→0, FAIL→1).
4. Gate against **versioned** budget/tolerance files.
5. Enforce the documented guarantees for each dimension.

Write set for this audit is **only** this report. No source, fixture, or ledger
mutation was made during the review body of work (ledger/status flips after
finish are coordinator hygiene, recorded separately).

---

## Method

| Step | Evidence |
| --- | --- |
| Line review | `latency.ts`, `replay.ts`, `source-degradation.ts`, `label-decision.ts`, `shared.ts` |
| Fixture review | `test/fixtures/harness/latency-budget@1.json`, `latency-cases.json`, `replay/case-old-token/*`, `source-degradation-matrix.json`, `label-tolerance@1.json`, `label-cases.json` |
| CLI reproduction | `npx tsx src/harness-suites/{latency,replay,source-degradation,label-decision}.ts` |
| Acceptance | `npm run typecheck`, `npm test` (140 pass), `npm run build`, `git diff --check` |
| Fail-closed API | `exitFor('PASS')===0`, `exitFor('FAIL')===1` |

CLI results at audit time:

| Suite | Status | Key metrics |
| --- | --- | --- |
| latency | PASS | p50=600ms, p95=1800ms (budget 900 / 2000) |
| replay | PASS | 1 case `case-old-token` |
| source-degradation | PASS | 20 cells (4 sources × 5 modes) |
| label-decision | PASS | all detectors FP/FN within `label-tolerance@1` |

---

## Findings by suite

### 1. Latency — PASS (with advisory)

**Confirmed controls**

- Virtual clock in `shared.ts` / used by `runHotPathParallel` /
  `runHotPathSerial` (`latency.ts:28-45`): no wall-timer measurement for
  budgets.
- Parallel elapsed = max(source latencies); serial control = sum
  (`latency.ts:78-89`). Serialization (elapsed≈sum for multi-source) fails the
  case.
- Budgets loaded from versioned `latency-budget@1.json` (`p50_ms_max: 900`,
  `p95_ms_max: 2000`).
- Suite status FAIL when budgets exceeded (`latency.ts:96-97`).
- CLI exits non-zero on FAIL via `exitFor`.

**Advisory L1 (non-blocking)** — The suite measures a **declared parallel
hot-path model**, not the live `AnalysisService` call graph. It correctly
gates the *budget contract* and the *anti-serialization rule* for fixture
latencies. When Wave B adapters land, a follow-up must wire the same suite to
fixture-declared latencies on real adapter stubs so a serial `await` chain in
production code would fail here. Not a FAIL of SOL-HARNESS-SUITES-001's stated
T1 scope (scaffold + offline deterministic budgets).

**Advisory L2 (non-blocking)** — Percentile helper with n=4 uses a simple
ceil-index (`latency.ts:47-50`). Adequate for the fixture set; document if
production p95 uses a different estimator.

### 2. Replay — PASS (with advisory)

**Confirmed controls**

- Pure `deriveReplayOutput` — no `Date.now`, no network (`replay.ts:24-58`).
- Double-run determinism check (`replay.ts:89-92`).
- Field-by-field golden: `real_top_n`, `excluded_owners` (reason +
  `rule_version`), `smart_money`, `clusters` (membership + `shared_funder`),
  `security` tri-state vector (`replay.ts:95-109`).
- Pinned case under `test/fixtures/harness/replay/case-old-token/`.

**Advisory R1 (non-blocking)** — Derivation currently **projects** holder /
wallet / security observations already present in the timeline; it does not yet
re-run production rules (`real-holders`, `funding-clusters`, alpha detectors)
from raw chain events. That is acceptable as the first pinned contract for the
suite harness itself; Wave B / detector tasks must expand golden timelines so
replay fails when production rules drift with versions unchanged (methods doc
PD-3).

### 3. Source-degradation — PASS (with advisory)

**Confirmed controls**

- Matrix 4×5 from versioned fixture (`source-degradation-matrix.json`).
- No-crash path; completeness decreases on failure (`source-degradation.ts:36-39`).
- Warnings always carry source/degradation signal (`:114-116`).
- **First-hand guard**: `helius_holders` → `holderConcentration === null`,
  `holderCompleteness === "unavailable"`, and
  `usedBorrowedForAuthoritativeConcentration === false` (`:42-50`, `:117-126`).
- Fake-precision guards throw if concentration/market populated after source
  failure (`:67-73`).

**Advisory D1 (non-blocking)** — Parameter `mode` is accepted but all five
failure modes currently share one branch (`sourceFailed = true`). The matrix
still exercises 20 cells and the first-hand / fake-precision guards. A later
task should differentiate timeout vs malformed vs stale semantics when real
adapters are stubbed.

**Advisory D2 (non-blocking)** — Degradation model is a dedicated function, not
yet injected into `AnalysisService`. Same scope note as L1: the suite locks the
*policy* now; adapter wiring must keep these asserts true.

### 4. Label-decision — PASS (with advisory)

**Confirmed controls**

- Versioned `label-tolerance@1.json` with per-detector `max_fp` / `max_fn`.
- FP/FN measurement (`label-decision.ts:29-41`) and hard fail when over budget
  (`:76-77`).
- Report records `tolerance_version` and attestation id (`:87-89`).
- Fixture cases include known cluster, service-funder negative, bot, smart
  money, clean negative (`label-cases.json`).

**Advisory A1 (non-blocking)** — `predictLabels` is an explicit **stub** pending
`SOL-DETECTORS-001` (`label-decision.ts:17-18`). The suite correctly enforces
the *tolerance machinery* and golden harness. When real detectors land, they
must replace the stub **without** quietly editing `label-tolerance@1` (methods
doc: tolerance relaxation is T3-flavored / new version file).

---

## Cross-cutting checks

| Requirement | Result |
| --- | --- |
| Offline only | PASS — no network imports in suite modules |
| Fail closed | PASS — `exitFor`, suite status FAIL on any failure list entry |
| Versioned budgets/tolerances | PASS — `@1` files under `test/fixtures/harness/` |
| package.json untouched | PASS — invoke via `npx tsx` |
| Deliverables present | PASS — four suite files + `test/harness-suites/suites.test.ts` |
| Implementer write set compliance | PASS — audited implementer commit only touched suites write set + handoff |

---

## Acceptance reproduction

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 140 tests |
| `npm run build` | PASS (via harness verify) |
| `git diff --check` | PASS (clean audit write set) |
| Four suite CLIs | all PASS (metrics above) |

---

## Verdict rationale

**GREEN_WITH_ADVISORY**: All four dimensions exist, run offline and
deterministically, fail closed, and bind versioned budget/tolerance files. The
documented anti-serialization, excluded-owner reason/rule_version equality,
first-hand concentration guard, and FP/FN tolerance gates are actually
asserted in code and reproduce PASS.

Advisories L1/R1/D1/D2/A1 do not block accepting this **T1 harness scaffold**.
They define the follow-up contract when production adapters and detectors are
wired into the same suites.

**Owner decisions:** none for this audit. No threshold relaxation requested.

This audit does **not** accept live E2E, Alpha-Score, or detector production
behavior.

---

## Required follow-ups (non-blocking)

1. Wire latency + degradation suites to fixture-backed adapter stubs when Wave B
   lands.
2. Expand replay goldens to re-derive from raw events through production rules.
3. Differentiate failure modes in the degradation model.
4. Replace `predictLabels` stub with `SOL-DETECTORS-001` outputs without editing
   `label-tolerance@1` in place.
