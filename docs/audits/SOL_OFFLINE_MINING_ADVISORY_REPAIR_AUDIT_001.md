# Audit Report — SOL-OFFLINE-MINING-ADVISORY-REPAIR-AUDIT-001

**Auditor:** deepseek-auditor-offline-mining-advisory-repair-001 (HARNESS_AGENT_ID)
**Date:** 2026-07-27
**Scope:** Independent audit of the offline mining robustness repair — verifying that the previous audit's advisory items (A, B, C) have been addressed; confirming borrowed-leaderboard failure visibility, isolated daily job degradation with weekly continuation, and defensive Date copies throughout.

---

## 1. Pre-Audit Gate

| Check | Result |
|---|---|
| `git status --short` | ✅ Clean — working tree empty |
| `npm run harness:doctor` | ✅ GREEN, 0 errors, 0 warnings |
| `npm run typecheck` | ✅ Clean exit |
| `npm test` | ✅ **199 passed, 0 failed, 0 skipped** |
| `npm run build` | ✅ Clean exit |
| `git diff --check` | ✅ Clean — no whitespace/encoding issues |

---

## 2. Previous Audit Advisory Items — Resolution Check

### Advisory A: `borrowedLeaderboard` failure must be visible in report warnings

**Previous finding (SOL-OFFLINE-MINING-SCHEDULE-AUDIT-001):**
> `daily-toptoken-mining.ts:201` — `borrowedLeaderboard` failure is silently swallowed. The report marks DEGRADED, but the error reason is not captured.

**Current code (`daily-toptoken-mining.ts:200-201`):**
```ts
} catch {
  tokenWarnings.push("borrowed_leaderboard_failed", "borrowed_leaderboard_unavailable");
}
```

**Verdict:** ✅ **RESOLVED.** Two specific warning strings are pushed into `tokenWarnings` on catch:
- `"borrowed_leaderboard_failed"` — signals the operation threw
- `"borrowed_leaderboard_unavailable"` — signals the provider was unreachable

These propagate to `report.tokenReports[].warnings` (line 295) and to `report.warnings` (line 295: `warnings.push(...tokenWarnings.map(...))`). The test at `daily-toptoken-mining.test.ts:135-151` asserts exactly `"${tokenA}:borrowed_leaderboard_failed"` is present in `report.warnings`.

The report-level `status` is also set to `"DEGRADED"` (line 298) when `warnings.length > 0`, making the degradation visible in the final status field as well. **PASS.**

---

### Advisory B: Daily job failure must produce DEGRADED; weekly must still run on Monday

**Previous finding:**
> `offline-mining-schedule.ts:61-64` — `runDailyTopTokenMining` is called inside the loop; if it throws, the exception propagates uncaught. Add a per-job `try/catch` in `runOfflineMiningSchedule` to ensure the weekly job still runs when the daily job fails.

**Current code (`offline-mining-schedule.ts:59-69`):**
```ts
for (const job of jobs) {
    try {
      reports.push(await runDailyTopTokenMining(deps, {
        ...config,
        window: job.window,
        runAt: job.runAt,
      }));
    } catch {
      failedJobs.push({ ...job, runAt: new Date(job.runAt) });
      warnings.push(`${job.window}_mining_failed`);
    }
  }
```

**Verdict:** ✅ **RESOLVED.** Each job runs in its own `try/catch`. On failure:
- The failed job is recorded in `failedJobs` (line 67) with a defensive Date copy.
- A warning is pushed (line 68).
- The loop continues to the next job — on Monday, the weekly job still executes.

The schedule result status is `"DEGRADED"` when `failedJobs.length > 0` (line 74), and `failedJobs` + `warnings` are returned in the result (lines 77-78).

**Test confirmation** (`offline-mining-schedule.test.ts:84-153`):
- `calls` array confirms both `"daily"` and `"weekly"` were invoked (line 148).
- `result.status === "DEGRADED"` (line 149).
- `result.failedJobs` contains only `"daily"` (line 150).
- `result.warnings === ["daily_mining_failed"]` (line 151).
- `result.reports` contains only the `"weekly"` report (line 152). **PASS.**

---

### Advisory C: `triggeredAt` in the return object must be a defensive Date copy

**Previous finding:**
> `offline-mining-schedule.ts:61-64` — `config.triggeredAt` is returned directly as `triggeredAt` field. Add `new Date(config.triggeredAt)` for symmetry.

**Current code (`offline-mining-schedule.ts:75-76`):**
```ts
triggeredAt: new Date(config.triggeredAt),
jobs: jobs.map((job) => ({ ...job, runAt: new Date(job.runAt) })),
```

**Verdict:** ✅ **RESOLVED.** Line 75 wraps `config.triggeredAt` in `new Date(...)`. Line 76 wraps each job's `runAt` in `new Date(...)`. Both are defensive copies.

**Test confirmation** (`offline-mining-schedule.test.ts:69-81`):
- Line 70: `assert.notStrictEqual(result.triggeredAt, triggeredAt)` — confirms different object identity.
- Lines 78-81: Mutating the returned `triggeredAt` and `jobs[0].runAt` does not affect the original `triggeredAt` — confirms defensive copy. **PASS.**

---

## 3. Mandatory Audit Targets

| # | Target | Result |
|---|---|---|
| 1 | Borrowed leaderboard failure visible in final report warnings | ✅ PASS |
| 2 | Isolated daily failure → DEGRADED; weekly still runs on Monday | ✅ PASS |
| 3 | All returned `triggeredAt` / `job.runAt` are defensive Date copies | ✅ PASS |
| 4 | No cron, timer, background worker, live HTTP/RPC | ✅ PASS |
| 5 | No PostgreSQL or Redis calls in scope | ✅ PASS |
| 6 | No modification to source, migration, test, task spec, or ledger | ✅ PASS |

---

## 4. Detailed Code Evidence

### 4.1 Borrowed Leaderboard Failure Visibility

In `daily-toptoken-mining.ts:192-202`, the catch block pushes **two** warning strings:
```
borrowed_leaderboard_failed
borrowed_leaderboard_unavailable
```
These are included in `tokenWarnings`, which flows into:
- `report.tokenReports[].warnings` (per-token detail, line 293)
- `report.warnings` (top-level, line 295, prefixed with `tokenCa:`)

The test at `daily-toptoken-mining.test.ts:150` asserts:
```ts
assert.ok(report.warnings.includes(`${tokenA}:borrowed_leaderboard_failed`));
```
**This is now guaranteed by test, not just convention.**

Additionally, `report.status = "DEGRADED"` (line 298) fires whenever `warnings.length > 0`, so a borrowed-leaderboard failure cannot produce a silent GREEN report. **PASS.**

---

### 4.2 Isolated Daily Failure → DEGRADED + Weekly Continues

In `offline-mining-schedule.ts:59-69`, the `for...of` loop wraps each job invocation in an independent `try/catch`. The key structural properties:

1. **Loop does not break on failure** — a `catch` block records the failure and continues to the next iteration.
2. **`failedJobs` array** — records which window failed with its own defensive Date copy.
3. **`warnings` array** — records `${job.window}_mining_failed` strings.
4. **Schedule status** — `"DEGRADED"` when `failedJobs.length > 0`, else `"GREEN"`.
5. **`reports` array** — contains only successfully completed job reports; failed jobs produce no report entry.

On a Monday with a failing daily job, the test confirms:
- `calls = ["daily", "weekly"]` — both windows were invoked.
- `result.status = "DEGRADED"`.
- `result.failedJobs = [{window: "daily"}]`.
- `result.reports` contains only the weekly report. **PASS.**

---

### 4.3 Defensive Date Copies

All three return-path date fields are wrapped in `new Date(...)`:

| Location | Field | Copy? |
|---|---|---|
| `offline-mining-schedule.ts:75` | `result.triggeredAt` | ✅ `new Date(config.triggeredAt)` |
| `offline-mining-schedule.ts:76` | `result.jobs[].runAt` | ✅ `new Date(job.runAt)` |
| `offline-mining-schedule.ts:67` | `failedJobs[].runAt` | ✅ `new Date(job.runAt)` |
| `daily-toptoken-mining.ts:170` | `report.runAt` | ✅ `new Date(config.runAt)` |
| `daily-toptoken-mining.ts:35` | `observedAt` in FixtureTopTokenProvider | ✅ `new Date(row.observedAt)` |

The test at `offline-mining-schedule.test.ts:69-81` verifies object identity difference and post-return mutation isolation. **PASS.**

---

### 4.4 No Automatic Triggers

Search across both source files for: `cron`, `setInterval`, `setTimeout`, `setImmediate`, `queueMicrotask`, `while(true)`, `worker_threads`, `child_process`, `EventEmitter`, `on("`, `addEventListener`.

**Result:** Zero matches. Both modules are pure functions or `async` functions with explicit `for...of` loops. The `mode: "manual_offline"` field (line 73) is a structural attestation. **PASS.**

---

### 4.5 No Live Network or Database Calls

| Check | Finding |
|---|---|
| PostgreSQL (`pg`) | Not imported in either file. `DailyMiningReportStore` is an optional injected interface. |
| Redis (`ioredis`) | Not imported in either file. |
| Helius / RPC / HTTP | Not imported. All data flows through `DailyMiningDeps` DI boundary. |
| `fetch()`, `axios`, `http.get` | Not present in either file. |
| Live provider construction | None — all providers are injected. |

**PASS.**

---

### 4.6 Fixture/Offline/Manual-Only Constraints

- All data flows through `DailyMiningDeps` — no constructor-based provider creation.
- `FixtureTopTokenProvider` and `FixtureBorrowedLeaderboardProvider` used in tests — no live data.
- `runOfflineMiningSchedule` is explicitly described as "fixture/offline runner" (line 48-49).
- `OFFLINE_MINING_SCHEDULE_RULE_VERSION` and `DAILY_TOPTOKEN_MINING_RULE_VERSION` are versioned constants for deterministic replay.
- `SOL-E2E-001` remains PARK — no live Helius activation. **PASS.**

---

## 5. Harness Run Evidence

### 5.1 Run Manifest

Run directory: `harness/runs/20260727_SOL_OFFLINE_MINING_ADVISORY_REPAIR_AUDIT_001/`

```json
// manifest.json
{
  "status": "RUNNING",
  "run_id": "20260727_SOL_OFFLINE_MINING_ADVISORY_REPAIR_AUDIT_001"
}
```

### 5.2 Test Results

```
tests  199
suites  0
pass   199
fail     0
cancelled 0
skipped  0
duration_ms 2336.6391
```

All 199 tests pass, including:
- `daily mining is deterministic, promotes only confirmed wallets, and reports quota skips` ✅
- `provider degradation yields a partial report and never fabricates promotions` ✅
- `a failed first-hand provider keeps borrowed candidates out of the verified library` ✅
- `invalid borrowed provider contracts are discarded and reported` ✅
- `configured report store receives the completed structured report` ✅
- `report persistence failure degrades the run without discarding computed evidence` ✅
- `offline schedule uses canonical UTC daily slots and only adds weekly on Monday` ✅
- `offline schedule is manually invoked and runs daily then weekly without a background trigger` ✅
- `offline schedule degrades an isolated daily failure and still runs the Monday weekly job` ✅
- `offline schedule rejects invalid manual trigger times` ✅

---

## 6. Blockers

**None.** All 6 mandatory audit targets pass. All 5 acceptance commands pass. Both previous advisory items A and B have been resolved in code and are covered by passing tests. Advisory C is also resolved and covered by the defensive-copy identity test.

---

## 7. Advisory Items (Non-blocking)

| Item | Detail |
|---|---|
| A-1 | `daily-toptoken-mining.ts:200-201` — Two warning strings are now pushed on borrowed-leaderboard failure. Consider whether `"borrowed_leaderboard_failed"` and `"borrowed_leaderboard_unavailable"` carry distinct semantics worth separating at the report level, or whether a single `"borrowed_leaderboard_unavailable"` suffices. Currently both are pushed unconditionally in the same catch, making them redundant. |
| B-1 | `offline-mining-schedule.ts:66-68` — The `catch` block records the failure but discards the error object (`catch { ... }` without `catch (e)`). If post-mortem diagnostics are needed, consider `catch (e) { ... warnings.push(...); }` to capture the error message. Not a blocker — the warning string already signals the failure mode. |
| C-1 | `daily-toptoken-mining.ts:35` — `observedAt: new Date(row.observedAt)` in `FixtureTopTokenProvider` is a defensive copy, consistent with the schedule module's pattern. No issue found here; this is a positive note confirming consistent defensive-copy discipline across both modules. |

---

## 8. Verdict

> **GREEN** — All 6 mandatory audit targets pass. The previous audit's three advisory items are fully resolved: (A) borrowed-leaderboard failures produce two specific warning strings and are visible in both per-token and top-level report warnings; (B) `runOfflineMiningSchedule` wraps each job in an independent `try/catch`, so a daily failure produces DEGRADED and the weekly job still runs; (C) all returned `triggeredAt` and `job.runAt` values are defensive `new Date(...)` copies verified by object-identity tests. All 199 tests pass, `harness:doctor` is GREEN, typecheck and build are clean, and `git diff --check` shows no whitespace issues. No source, migration, test, task spec, or ledger was modified during this audit.
