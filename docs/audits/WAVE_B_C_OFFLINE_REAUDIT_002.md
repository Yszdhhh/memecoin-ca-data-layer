# WAVE-B-C-OFFLINE-REAUDIT-002 — Independent re-audit of Wave B/C trust repairs

**Verdict: GREEN_WITH_ADVISORY**

| Field | Value |
| --- | --- |
| Auditor identity | `grok-auditor-wave-bc-reaudit-002` |
| Role | auditor (T2) |
| Run id | `20260727_WAVE_B_C_OFFLINE_REAUDIT_002` |
| Base commit | `2aa9731` (`feat(wave-d): add offline mining loop and close acceptance gaps`) |
| Write set | `docs/audits/WAVE_B_C_OFFLINE_REAUDIT_002.md` only |
| Live network | not used |

Implementer dependencies under re-audit:  
`SOL-ADDRESS-LIBRARY-TRUST-REPAIR-001`, `SOL-HOTPATH-ENQUEUE-CONTRACT-REPAIR-001`,
`SOL-HOTPATH-ANALYSIS-QUEUE-001` (all DONE at ledger).

---

## Scope (from task objective)

Independently verify after repair:

1. Address-library **trust guards** (borrowed cannot be verified; verified not clobbered).
2. **Explicit deep-dive enqueue** with fail-closed card status.
3. **Provider contract rejection** for invalid borrow/security/holder shapes.
4. **Parallel latency accounting** (max, not sum) for hot path.

Out of scope: feature expansion, live Helius, unparking E2E, BSC.

---

## Method

| Step | Evidence |
| --- | --- |
| Line review | `src/application/sedimentation/address-library.ts`, `src/application/hotpath/ca-first-screen.ts`, `src/application/hotpath/analysis-deep-dive-queue.ts`, free-provider ports |
| Tests | `test/application/sedimentation/address-library.test.ts`, `test/application/hotpath/*.test.ts`, `test/providers/free-providers.test.ts` |
| Acceptance | `npm run harness:doctor`, `typecheck`, `test` (184 pass), `build`, `git diff --check` |

---

## Findings

### 1. Address-library trust guards — PASS

- `upsertWallet`: rejects `origin=borrowed && verificationStatus=verified`
  (`address-library.ts:105-107`).
- Prevents verified→unverified clobber (`:110-112`).
- `upsertWalletTokenEdge`: same borrowed+verified ban (`:122-124`).
- `appendObservation`: rejects borrowed+verified (`:134-136`).
- Sedimentation still documents that confirmation is a separate first-hand path
  (`:174` region / comment on sedimentAnalysis).

Tests pin rejection of borrowed+verified edges and observation fingerprint
idempotency.

### 2. Explicit deep-dive enqueue — PASS

- `HotpathDeps.deepDiveQueue: DeepDiveQueue` is required (`ca-first-screen.ts:64`).
- Enqueue runs inside the parallel fan-out (`:156-158`, `Promise.all` `:160-167`).
- Failure yields `deep_dive_enqueue_failed` and forces `DEGRADED` when
  `!enqueueResult.enqueued` (`:192-194`).
- Card surfaces `deepDiveEnqueued: enqueueResult.enqueued` (`:232`).
- `AnalysisServiceDeepDiveQueue` (`analysis-deep-dive-queue.ts`) is a real offline
  queue adapter: enqueue without running deep analysis on the hot path; `drainAll`
  processes later.

### 3. Provider contract rejection — PASS

- Security: rejects non-`borrowed`/`unverified` (`ca-first-screen.ts:90-93`).
- Holders: requires `isBorrowedConcentration === true` and `ownerAggregated === false`
  plus borrowed/unverified (`:114-121`).
- Market path via `collectBorrowedMarket` continues to enforce borrow contract
  (covered by free-provider tests).
- Invalid contracts produce warnings, not silent acceptance.

### 4. Parallel latency accounting — PASS

- `parallelHotpathElapsedMs` is max-of-latencies (`:240-243`).
- Hot path advances virtual clock by that max after `Promise.all` (`:169-176`).
- Budget exceed surfaces `hotpath_latency_budget_exceeded` when
  `elapsed >= HOTPATH_P95_BUDGET_MS` (2000) (`:183`).

### Advisories (non-blocking)

**ADV-1.** Virtual latencies still come from caller-declared `sourceLatencyMs`, not
from instrumented provider stubs. Sufficient for offline budget contract; Wave live
flip should attach real stub latencies.

**ADV-2.** Library hit availability is `true` even when zero wallets match
(`lookup` success with empty list counts toward completeness). Completeness then
reflects “library reachable”, not “hits found”. Documented behavior; not a trust
violation.

**ADV-3.** First-screen still does not call `AnalysisService` on the hot path by
design; deep dive is queued. Callers must drain the queue offline/async.

---

## Acceptance reproduction

| Command | Result |
| --- | --- |
| `npm run harness:doctor` | GREEN |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 184 tests |
| `npm run build` | PASS |
| `git diff --check` | PASS (audit write set only after report) |

---

## Verdict

**GREEN_WITH_ADVISORY** — Trust repairs under re-audit hold: library cannot
launder borrowed→verified, hot path requires explicit enqueue with fail-closed
status, invalid provider contracts are rejected, and parallel latency is max-based.

Does not unpark live Helius or `SOL-E2E-001`. No Owner decision required.
