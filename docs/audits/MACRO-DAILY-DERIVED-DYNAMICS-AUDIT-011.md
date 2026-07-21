# MACRO-DAILY-DERIVED-DYNAMICS-AUDIT-011

| Field | Value |
| --- | --- |
| task_id | `MACRO-DAILY-DERIVED-DYNAMICS-AUDIT-011` |
| audit_of | `MACRO-DAILY-DERIVED-DYNAMICS-011` |
| tier / role | T2 / auditor |
| audit date | 2026-07-21 (Asia/Shanghai) |
| deliverable | `docs/audits/MACRO-DAILY-DERIVED-DYNAMICS-AUDIT-011.md` |
| verdict | **GREEN_WITH_ADVISORY** |

## 0. Acceptance command results

| Command | Exit | Evidence |
| --- | --- | --- |
| `npm run harness:task -- validate harness/tasks/MACRO-DAILY-DERIVED-DYNAMICS-AUDIT-011.json` | 0 | `status: GREEN`, `errors: []` |
| `npm run typecheck` | 0 | `tsc -p tsconfig.json --noEmit` completed cleanly |
| `npm test` | 0 | 57 tests passed; 0 failed, skipped, or cancelled |
| `npm run build` | 0 | `tsc -p tsconfig.json` completed cleanly |
| `git diff --check` | 0 | No whitespace errors; only pre-existing LF/CRLF warnings on unrelated tracked files |

## 1. Findings summary

No P0 or P1 findings. Two P2 advisories identified.

### P2-001: Research doc recommends 5–6/7 partial 7D baseline display; implementation requires exactly 7/7

- **File**: `src/application/macro-daily-core-run-service.ts` L121
- **File**: `docs/research/MACRO-MICRO-DUNE-RESEARCH-010.md` L118
- **Severity**: P2 (advisory, conservative direction)
- **Detail**: The research document (section 3.3) proposes a partial baseline at 5–6/7 days with a `partial_7d_baseline` warning. The implementation requires `baseline.length === 7` before computing `sevenDayRelativePct`. This is *more conservative* than the research recommendation and does not violate the task spec, which says "less than 7 days must not display 7D numbers". The code correctly shows "历史积累中 N/7" for partial baselines. No fix required; future task may relax to 5/7 if desired.

### P2-002: `dayOffset` returns previous UTC day via `Date.setUTCDate` without explicit timezone guard

- **File**: `src/application/macro-daily-core-run-service.ts` L130–134
- **Severity**: P2 (advisory, currently safe)
- **Detail**: The `dayOffset()` function constructs a Date from `${reportDay}T00:00:00.000Z` and uses `setUTCDate`/`toISOString`, which is timezone-safe when the input is already a validated `YYYY-MM-DD` string (asserted at L157). The function is correct for all valid inputs. Advisory: a future caller passing a non-validated string could cause unexpected behavior, but current call sites are gated by `assertReportDay`.

## 2. Verification point evidence

### VP-1: Historical data comparability guard

**Verdict**: ✅ PASS

**Global metrics** — `loadComparableHistory` in `postgres-macro-core-repository.ts` L27 uses the query:
```sql
WHERE report_day >= $1::date - 7 AND report_day < $1::date
  AND metric_name=$2 AND subject=$3 AND unit=$4
  AND source=$5 AND query_ref=$6 AND query_version=$7
  AND completeness=1
```
All of `metric_name`, `subject`, `unit`, `source`, `query_ref`, `query_version`, and `completeness=1` are matched. This prevents comparisons across different query versions or incomplete data.

**Chain metrics** — L28 uses:
```sql
WHERE report_day >= $1::date - 7 AND report_day < $1::date
  AND chain=$2 AND metric_name=$3 AND unit=$4
  AND registry_version=$5 AND coverage_status=$6
  AND source=$7 AND query_ref=$8 AND query_version=$9
  AND completeness=1
```
All of `chain`, `metric_name`, `unit`, `registry_version`, `coverage_status`, `source`, `query_ref`, `query_version`, and `completeness=1` are matched. This satisfies the requirement that historical data is only comparable when metric, subject/chain, unit, source, query_ref, query_version, registry_version, coverage_status, and completeness all agree.

**Test evidence**: `macro-daily-core-run-service.test.ts` L79 asserts that `loadComparableHistory` receives the correct `queryVersion` prefix `saved:S1_solana_capital_day@...` for the Solana chain metric, verifying that the version is threaded through.

### VP-2: Day change uses exact prior UTC day; no fabrication

**Verdict**: ✅ PASS

`deriveMetricDynamics` at L115–126:
- L117: `const priorDay = values.get(dayOffset(reportDay, 1))` — fetches exactly UTC D-1.
- L120: `if (priorDay !== undefined && priorDay > 0)` — day change percent is only computed when the prior day exists AND is positive.
- If `priorDay` is `undefined` (missing) or `0`, `dayChangePct` remains `undefined` and is not set.
- The card renderer (`macro-daily-brief-card.ts` L74–81) handles `undefined` dynamics by showing "历史积累中".

**Test evidence**: Test L48 asserts `{ baselineDayCount: 0 }` (no dayChangePct, no sevenDayRelativePct) when history returns empty. Test L101 asserts `dayChangePct: 50` with correct computation: `(300/200 - 1) * 100 = 50`.

### VP-3: 7D water level uses 7 complete prior UTC days, excludes current day, uses median

**Verdict**: ✅ PASS

`deriveMetricDynamics` at L118–124:
- L118: `Array.from({ length: 7 }, (_, index) => values.get(dayOffset(reportDay, index + 1)))` — indexes 1 through 7, i.e., D-1 through D-7. Current day (D) is excluded.
- `.filter(...)` retains only defined values; `baseline.length` counts actual days.
- L121: `if (baseline.length === 7)` — requires exactly 7 days. Fewer than 7 → no 7D display.
- L122: `baseline.slice().sort((a, b) => a - b)[3]` — for 7 sorted values, index 3 is the median (4th of 7).
- L123: `if (median > 0)` — zero median → no 7D display.

**Card renderer** (`macro-daily-brief-card.ts`):
- L79: `if (parts.length === 0) parts.push("历史积累中 ${dynamics.baselineDayCount}/7")` — when no day change and no 7D, shows "历史积累中".
- L80: `else if (dynamics.sevenDayRelativePct === undefined) parts.push("7D 积累 ${dynamics.baselineDayCount}/7")` — when day change exists but 7D doesn't, shows accumulation count.

**Test evidence**: `macro-daily-brief-card.test.ts` L32–38 verifies that `baselineDayCount: 3` renders "历史积累中 3/7" and does NOT render "7D 水位 0%". L23–30 verifies that a complete baseline (dayCount=7) renders "日变动 +12.5%" and "7D 水位 115%" without "历史积累中".

### VP-4: Robinhood partial coverage is preserved

**Verdict**: ✅ PASS

- `macro-core-query-definitions.ts` L59–60: Robinhood metrics have `coverageStatus: "partial_coverage"` and `warningCodes: ["volume_is_leg_sum", "uniswap_only"]`.
- `macro-daily-brief-card.ts` L25: Robinhood heading is `"Robinhood（Uniswap v2/v3/v4 部分覆盖）"` — explicitly labels partial coverage.
- `db/migrations/002_macro_daily_metrics.sql` L52: `CHECK (chain <> 'robinhood' OR coverage_status = 'partial_coverage')` — database constraint enforces partial coverage for Robinhood.
- `macro-daily-brief-card.test.ts` L19: Asserts card contains `"Robinhood（Uniswap v2/v3/v4 部分覆盖）"`.
- `macro-daily-core-run-service.test.ts` L51: Asserts markdown contains `"Robinhood（部分覆盖：Uniswap v2/v3/v4）"` (the renderer format).

The partial coverage is never weakened or renamed to "full".

### VP-5: Card does not display query ID, version, watermark tracing fields

**Verdict**: ✅ PASS

- `macro-daily-brief-card.ts` L35: Card footer says `"完整溯源已持久化，不在卡片展开。"` — explicitly states provenance is persisted, not displayed.
- The `buildMacroDailyBriefCard` function never reads `queryRef`, `queryVersion`, `sourceAsOf`, `computedAt`, or `completeness` from individual metrics for card content display.
- `macro-daily-brief-card.test.ts` L20: `assert.doesNotMatch(serialized, /dune:query:fixture|saved:fixture@deadbeef|2026-07-21T00:00:00/)` — explicitly confirms no inline provenance in card payload.
- `macro-daily-core-run-service.test.ts` L52: `assert.doesNotMatch(result.markdown, /volume_is_leg_sum/)` — warning codes not in rendered output.
- L53: `assert.match(result.markdown, /完整溯源、查询版本与告警已持久化/)` — renderer confirms provenance is persisted only.

### VP-6: No forbidden claims added

**Verdict**: ✅ PASS

Grep search across `macro-daily-brief-card.ts` and `macro-daily-core-run-service.ts` for `Four.meme|TVL|FDV|买入|卖出|预测|trading|recommendation|smart.money|K线|graduation` returns zero matches.

- `macro-daily-core-run-service.test.ts` L54: `assert.doesNotMatch(result.markdown, /Four\.meme|TVL|FDV|买入|卖出|预测/)` — actively guards against forbidden claims in test.
- No trading advice, cross-chain scoring, buy/sell language, FDV/market-cap, TVL, Four.meme, full Robinhood, smart money, or K-line claims exist in any audited file.

### VP-7: No external operations executed

**Verdict**: ✅ PASS

- No file in the audit set performs Dune query execution, database writes, migrations, CardKit sends, Hermes calls, lark-cli invocations, external API calls, backfills, or chain adapter calls during the audit.
- `lark-cardkit-publisher.ts`: The `publish` method uses injected `LarkCommandExecutor`; no real lark-cli is called in test (L18–23 in test: `invoked = false` asserted).
- `macro-daily-core-run-service.ts`: All external interactions go through injected interfaces (`CoreDuneQueryGateway`, `MacroCoreStore`, `MacroCoreBriefPublisher`), which are stubbed in tests.
- This audit performed only read operations and ran `npm test`, `npm run typecheck`, `npm run build`, and `git diff --check`.

### VP-8: Git status and untracked files check

**Verdict**: ✅ PASS

**Tracked modified files** (from `git diff HEAD --name-only`): 8 files modified, all unrelated to this task:
- `docs/research/SOL-PUMP-PROVENANCE-001.md`
- `harness/CURRENT_WAVE.md`, `harness/ledger/tasks.json`
- `harness/tasks/SOL-DEV-001.json`, `SOL-HOLDER-001.json`, `SOL-PUMP-001.json`, `SOL-PUMP-PROVENANCE-001.json`
- `package.json`

**Untracked files** (from `git ls-files --others --exclude-standard`): All audit target files are untracked (not yet committed). This is expected for in-progress work. Key observations:
- All audit target source files (`src/application/macro-daily-core-run-service.ts`, `src/application/macro-daily-brief-card.ts`, `src/infrastructure/postgres/postgres-macro-core-repository.ts`, `src/infrastructure/lark/lark-cardkit-publisher.ts`) are present as untracked files.
- All audit target test files are present as untracked files.
- Migration files (`002_macro_daily_metrics.sql` through `005_macro_query_create_reservation.sql`) are present as untracked files.
- No `.env`, `*.pem`, `*.key`, `wallet*.json`, or `*secret*` files are present.
- No files outside the task-011 write set have been modified by this audit.

## 3. Write set compliance

| File | In write_set | Action |
| --- | --- | --- |
| `docs/audits/MACRO-DAILY-DERIVED-DYNAMICS-AUDIT-011.md` | ✅ Yes | Created (this report) |

No production code, tests, migrations, query definitions, or task specs were modified.

## 4. Credential and secret exposure check

- No `.env` files found in repository.
- `process.env` references exist only in CLI entry point (`src/cli/run-macro-daily-core.ts`) for `DATABASE_URL`, which is read at runtime and never persisted or logged.
- No Dune API keys, Lark tokens, chat IDs, cookies, or raw provider payloads are present in any audited file.
- `harness/config/project.json` `forbidden_repository_patterns` correctly lists `.env`, `*.pem`, `*.key`, `wallet*.json`, `*secret*`.

## 5. External call inventory

The audited files contain no direct external calls. All external interactions are mediated through injected interfaces:

| Interface | Concrete implementation | Audit test behavior |
| --- | --- | --- |
| `CoreDuneQueryGateway` | Not instantiated in audited code | Stubbed; no real Dune calls |
| `MacroCoreStore` | `PostgresMacroCoreRepository` | Stubbed; no real DB calls |
| `MacroCoreBriefPublisher` | `LarkCardKitPublisher` | Stubbed; `invoked = false` asserted |

## 6. Detailed code review notes

### `macro-daily-core-run-service.ts`

- **Dynamics derivation** (L108–126): Correctly separates global and chain dynamics. Uses the same metric keys for lookup. `deriveMetricDynamics` is pure and deterministic.
- **Median calculation** (L122): `sort()[3]` for 7 elements correctly picks the median (4th value in 0-indexed sorted array).
- **`dayOffset`** (L130–134): Uses `setUTCDate` which correctly handles month boundaries (e.g., day 1 - 7 rolls to previous month). The `toISOString().slice(0, 10)` output is always `YYYY-MM-DD`.
- **`observationsFor`** (L136–148): Sets `completeness: 1` for all Dune results (appropriate for successful queries). Carries `queryVersion` as `saved:${blueprintId}@${sqlSha256}`, creating a unique version string per SQL revision.

### `macro-daily-brief-card.ts`

- **Dynamics display** (L32): Only Solana DEX volume dynamics are displayed on the card (`dynamics?.chain["solana:dex_volume_usd"]`). Other chains and metrics do not display dynamics. This is a conservative choice consistent with the task objective.
- **`formatDynamics`** (L74–81): All branches are covered: undefined dynamics → "历史积累中"; has dayChange + 7D → both shown; has dayChange, no 7D → shows "7D 积累 N/7"; has neither → "历史积累中 N/7".
- **Intensity** (L51–53): Computed only when both volume and trader count exist, are non-zero completeness, and trader count > 0. Safe against division by zero.

### `postgres-macro-core-repository.ts`

- **History query** (L27–28): Both queries use `report_day < $1::date` (strictly less than), excluding the current day. Both require `completeness=1`. The date range `>= $1::date - 7 AND < $1::date` yields exactly 7 possible prior days.
- **Global key matching**: `metric_name`, `subject`, `unit`, `source`, `query_ref`, `query_version` — all semantic identity fields for global metrics.
- **Chain key matching**: Adds `chain`, `registry_version`, `coverage_status` to the global fields — all semantic identity fields for chain metrics.

### `lark-cardkit-publisher.ts`

- **Dry run guard** (L45): Returns immediately without executing lark-cli when `dryRun` is true.
- **Chat ID validation** (L46): Throws on empty chat ID for non-dry-run sends.
- **Idempotency key** (L47): Includes `reportDay` and first 16 chars of payload hash, preventing duplicate sends.
- **Windows shim parsing** (L25–27): Validates exact `@larksuite/cli/scripts/run.js` path pattern; rejects arbitrary scripts.

### `db/migrations/002_macro_daily_metrics.sql`

- **Robinhood constraint** (L52): `CHECK (chain <> 'robinhood' OR coverage_status = 'partial_coverage')` — enforces at the database level that Robinhood always has partial coverage.
- **Global completeness** (L17): `CHECK (completeness BETWEEN 0 AND 1)` — prevents invalid completeness values.
- **Chain completeness** (L50): Same constraint on chain metrics table.

## 7. Verdict

**GREEN_WITH_ADVISORY**

The implementation correctly satisfies all 8 verification points. Day-over-day change uses exact prior UTC day with proper missing/zero guards. 7D water level requires exactly 7 complete comparable prior days, excludes the current day, and uses the median. Historical comparability is enforced at the SQL layer across all required identity fields. Robinhood partial coverage is preserved in query definitions, card rendering, and database constraints. The card omits all provenance tracing fields. No forbidden claims, external operations, credential exposures, or write-set violations were found.

Advisory notes:
1. **P2-001**: Implementation is more conservative than research recommendation on 7D partial baseline threshold (requires 7/7, research suggests 5–6/7 acceptable with warning). This is safe but may warrant a future relaxation task.
2. **P2-002**: `dayOffset` relies on upstream `assertReportDay` for input validation. Currently safe; a defensive guard within the function itself could improve robustness.
