# MACRO-DAILY-G2-COLLECTOR-REPAIR-AUDIT-001

| Field | Value |
| --- | --- |
| task_id | MACRO-DAILY-G2-COLLECTOR-001 |
| audit_id | MACRO-DAILY-G2-COLLECTOR-REPAIR-AUDIT-001 |
| prior_audit | MACRO-DAILY-G2-COLLECTOR-AUDIT-001 (FAIL) |
| tier / role | T3 / auditor |
| auditor_utc | 2026-07-21T06:02Z |
| write_set | `docs/audits/MACRO-DAILY-G2-COLLECTOR-REPAIR-AUDIT-001.md` only |
| verdict | **GREEN** — both F-001 and F-002 closed; all boundaries intact |

## 0. Execution boundary (mandatory)

1. This audit is **read-only**; no source code was modified.
2. No Dune CLI, Dune API, PostgreSQL, or Hermes command was invoked.
3. No credential was read, printed, or stored.
4. All five acceptance commands were executed; all exited 0.
5. Only this file was created; no other write-set file was touched.

---

## 1. F-001 closure — saved-query registry reuse

**Prior finding:** `ensurePrivateQuery` (old `macro-dune-cli.ts` L8–12) unconditionally called `dune query create --private` on every run, producing orphaned Dune queries.

**Required fix:** The runner must first query the registry for a matching `blueprint_id` + `sql_sha256`; only create a new Dune query when the registry returns null or the SQL hash has changed.

### Evidence

| Check | File | Lines | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| `ensurePrivateQuery` removed from codebase | All `*.ts` files | grep: 0 matches | Method and interface name completely eliminated | ✅ |
| `SavedG2QueryGateway` now exposes `createPrivateQuery` only | `macro-daily-g2-run-service.ts` | L9 | `createPrivateQuery(input: { blueprintId: string; sql: string; sqlSha256: string }): Promise<{ queryId: number }>` — no implicit "ensure" semantics; caller decides when to invoke | ✅ |
| `MacroG2Store` declares `findQuery` | `macro-daily-g2-run-service.ts` | L14 | `findQuery(blueprintId: string, sqlSha256: string): Promise<{ queryId: number } | null>` | ✅ |
| `PostgresMacroDailyRepository.findQuery` implementation | `postgres-macro-daily-repository.ts` | L5 | `SELECT query_id FROM macro_query_registry WHERE blueprint_id=$1 AND sql_sha256=$2` — matches on both `blueprint_id` AND `sql_sha256`; returns `null` if no row | ✅ |
| `MacroDailyG2RunService.run` queries registry first | `macro-daily-g2-run-service.ts` | L27 | `const query = (await this.store.findQuery(G2_BLUEPRINT_ID, sqlSha256)) ?? await this.dune.createPrivateQuery(...)` — nullish coalescing (`??`) means `createPrivateQuery` is only called when `findQuery` returns `null` | ✅ |
| When registry matches, `createPrivateQuery` is never called | `macro-daily-g2-run-service.ts` | L27 | The `??` operator short-circuits: if `findQuery` returns a non-null `{ queryId }`, the right-hand side is never evaluated | ✅ |
| SQL hash change forces new query | `macro-daily-g2-run-service.ts` | L26–27 | `sha256(G2_SQL)` is passed to `findQuery`; if `G2_SQL` text changes, the hash changes, `findQuery` returns `null`, and `createPrivateQuery` fires | ✅ |
| Registry upsert updates `query_id` on conflict | `postgres-macro-daily-repository.ts` | L7 | `ON CONFLICT (blueprint_id) DO UPDATE SET query_id=EXCLUDED.query_id, sql_sha256=EXCLUDED.sql_sha256, query_version=EXCLUDED.query_version, last_verified_at=now()` — new Dune query ID overwrites old registry row | ✅ |

### Regression test evidence

| Test | File | Line | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| `"reuses a matching registry query without creating another Dune query"` | `macro-daily-g2-run-service.test.ts` | L5 | `store.findQuery` returns `{queryId:8048804}` (hit); `let created=0` counter on `dune.createPrivateQuery` → **`assert.equal(created, 0)`** — proves create is never called when registry matches; `assert.equal(result.queryId, 8048804)` — proves registry ID is used | ✅ |
| `"persists aggregate-only G2 output and defaults Hermes to dry run"` | `macro-daily-g2-run-service.test.ts` | L4 | `store.findQuery` returns `null` (miss) → `createPrivateQuery` is called, returns `{queryId:8048804}` — proves create path works for first-time queries | ✅ |

> [!NOTE]
> The `created === 0` assertion on L5 of the test file is the definitive proof that a matching registry entry prevents any Dune `create` call. The test explicitly counts invocations and asserts the count is zero.

**F-001 Verdict: CLOSED ✅**

---

## 2. F-002 closure — ISO date boundary validation at CLI layer

**Prior finding:** `MacroDuneCli.runQuery` accepted `report_day` from Dune without validating ISO date format; relied solely on downstream `MacroDailyBriefService.normalize`.

**Required fix:** Add `/^\d{4}-\d{2}-\d{2}$/` validation at the external response boundary in `MacroDuneCli.runQuery`.

### Evidence

| Check | File | Lines | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| Regex guard added at CLI boundary | `macro-dune-cli.ts` | L18 | `!/^\d{4}-\d{2}-\d{2}$/.test(row.report_day)` — validates strict `YYYY-MM-DD` format at the point of Dune response parsing; throws `"Dune G2 response is incomplete"` on mismatch | ✅ |
| Guard is in compound condition | `macro-dune-cli.ts` | L18 | Part of `if (parsed.state !== "QUERY_STATE_COMPLETED" \|\| !row?.report_day \|\| !/^\d{4}-\d{2}-\d{2}$/.test(row.report_day) \|\| !Number.isFinite(row.btc_transaction_count) \|\| !parsed.execution_ended_at)` — all checks evaluated before any data is returned | ✅ |
| Downstream defense-in-depth retained | `macro-daily-brief-service.ts` | L47, L171–176 | `REPORT_DAY = /^\d{4}-\d{2}-\d{2}$/` + `assertReportDay` with Date roundtrip (`parsed.toISOString().slice(0,10) !== value`) still active at normalize boundary | ✅ |
| Regex rejects non-date strings | `macro-dune-cli.ts` | L18 | `"2026-07-19T00:00:00"` → fails regex (contains `T00:00:00`); `"20260719"` → fails (no hyphens); `"2026-7-19"` → fails (single digits); `"2026-07-19"` → passes. Anchored `^...$` prevents prefix/suffix injection | ✅ |
| Cannot be bypassed by caller | `macro-dune-cli.ts` | L18 | Validation occurs inside `runQuery` before the return statement; callers receive only validated data or an exception | ✅ |

> [!NOTE]
> The regex `/^\d{4}-\d{2}-\d{2}$/` at L18 validates format at the external boundary (Dune CLI response parsing). The downstream `assertReportDay` in `MacroDailyBriefService` provides a second layer with semantic validation (Date roundtrip). Both layers are now active, satisfying defense-in-depth.

**F-002 Verdict: CLOSED ✅**

---

## 3. Boundary checks — no regression

### 3.1. Scope limitation — G2 BTC only

| Check | Evidence | Verdict |
| --- | --- | --- |
| `G2_SQL` selects only `btc_transaction_count` from `metrics_bitcoin.transactions_daily` | `macro-daily-g2-run-service.ts` L5 | ✅ |
| `G2_BLUEPRINT_ID = "G2_btc_tx_count"` | `macro-daily-g2-run-service.ts` L6 | ✅ |
| No BSC/Robinhood/Four.meme/stablecoin/TVL/FDV/market-cap/cohort/trading tokens in write-set files | grep across all 6 files: 0 matches | ✅ |

### 3.2. No credential access

| Check | Evidence | Verdict |
| --- | --- | --- |
| No `process.env` in `macro-dune-cli.ts` | grep: 0 matches | ✅ |
| No `process.env` in `macro-daily-g2-run-service.ts` | grep: 0 matches | ✅ |
| No `console.log` in `macro-dune-cli.ts` | grep: 0 matches | ✅ |
| No credential columns in migration 003 | `003_macro_query_registry.sql` L1–21: no `api_key`, `password`, `secret`, `token`, `database_url` columns | ✅ |

### 3.3. No raw Dune payload stored

| Check | Evidence | Verdict |
| --- | --- | --- |
| `stdout` not referenced in repository | grep in `postgres-macro-daily-repository.ts`: 0 matches | ✅ |
| `MacroG2Store.save` accepts only aggregate values + hashes + timestamps | `macro-daily-g2-run-service.ts` L15: `queryId, sqlSha256, reportDay, transactionCount, sourceAsOf, resultSha256, briefSha256, deliveryMode` — no raw payload parameter | ✅ |
| PostgreSQL INSERTs store only aggregate/provenance fields | `postgres-macro-daily-repository.ts` L7: three parameterized INSERTs with only extracted aggregate fields | ✅ |

### 3.4. PostgreSQL transaction integrity

| Check | Evidence | Verdict |
| --- | --- | --- |
| `BEGIN` / `COMMIT` / `ROLLBACK` pattern | `postgres-macro-daily-repository.ts` L7: `client.query("BEGIN")` → 3 INSERTs → `client.query("COMMIT")` in try; `client.query("ROLLBACK")` in catch; `client.release()` in finally | ✅ |
| Uses dedicated client (not pool.query) | `const client = await this.pool.connect()` — session-scoped transaction | ✅ |
| Error propagation | `throw error` after ROLLBACK | ✅ |

### 3.5. dryRun default = true

| Check | Evidence | Verdict |
| --- | --- | --- |
| Default parameter | `macro-daily-g2-run-service.ts` L25: `options: { dryRun?: boolean } = {}` — `dryRun` defaults to `undefined` | ✅ |
| Publisher guard | `macro-daily-g2-run-service.ts` L35: `this.publisher.publish(markdown, options.dryRun !== false)` — only explicit `false` makes it `false` | ✅ |
| Hermes short-circuit | `hermes-feishu-publisher.ts` L7: `if (dryRun) return "dry_run"` — returns immediately without external call | ✅ |
| Tests cover both paths | `macro-daily-g2-run-service.test.ts` L4: default → `dry_run`; L6 (`test("only sends when explicitly requested")`): `{dryRun:false}` → `hermes_sent` | ✅ |

### 3.6. Hermes target not hardcoded

| Check | Evidence | Verdict |
| --- | --- | --- |
| Target is constructor-injected | `hermes-feishu-publisher.ts` L6: `constructor(private readonly target: string, ...)` | ✅ |
| No `oc_`, `og_`, or chat ID patterns in source | grep across all `src/**/*.ts`: 0 matches | ✅ |
| Tests use injected fakes | `macro-daily-g2-run-service.test.ts` L4–6: inline `MacroBriefPublisher` fakes — no `HermesFeishuPublisher`, no `child_process`, no network calls | ✅ |

### 3.7. Safe parameter array for external commands

| Check | Evidence | Verdict |
| --- | --- | --- |
| `execFile` (not `exec`/shell) | `macro-dune-cli.ts` L1: `import { execFile }` + L5: `promisify(execFile)` | ✅ |
| Arguments passed as `string[]` | `macro-dune-cli.ts` L9, L15: both `createPrivateQuery` and `runQuery` pass arrays to `execFileAsync` | ✅ |
| Hermes also uses `execFile` with array | `hermes-feishu-publisher.ts` L1, L7: same `execFile` + `string[]` pattern | ✅ |

### 3.8. No BSC/Robinhood adapters, backfill, trading, or push

| Check | Evidence | Verdict |
| --- | --- | --- |
| No BSC/Robinhood tokens in write-set files | grep: 0 matches across `macro-dune-cli.ts`, `macro-daily-g2-run-service.ts`, `postgres-macro-daily-repository.ts`, `hermes-feishu-publisher.ts`, `macro-daily-g2-run-service.test.ts` | ✅ |
| No backfill/trading/signing imports or interfaces | grep: 0 matches | ✅ |
| No real Hermes message sent during this audit | Execution boundary §0 | ✅ |

---

## Acceptance command results

| Command | Exit code | Evidence |
| --- | --- | --- |
| `npm run harness:task -- validate harness/tasks/MACRO-DAILY-G2-COLLECTOR-REPAIR-AUDIT-001.json` | **0** | `{"task_id":"MACRO-DAILY-G2-COLLECTOR-REPAIR-AUDIT-001","status":"GREEN","errors":[]}` |
| `npm run typecheck` | **0** | `tsc -p tsconfig.json --noEmit` clean |
| `npm test` | **0** | 41 pass, 0 fail |
| `npm run build` | **0** | `tsc -p tsconfig.json` clean |
| `git diff --check` | **0** | No whitespace errors (only informational CRLF warnings on pre-existing unrelated files) |

## Real external call confirmation

| External system | Invoked during audit? | Evidence |
| --- | --- | --- |
| Dune CLI / API | **No** | No `dune` command was run |
| PostgreSQL | **No** | No `psql` or `pg` connection was made |
| Hermes / Feishu | **No** | No `hermes` command was run |
| Docker | **No** | No `docker` command was run |

---

## Findings summary

| ID | Prior severity | Title | Status | Evidence |
| --- | --- | --- | --- | --- |
| F-001 | **P0** | Saved-query re-creation on every run | **CLOSED** | `findQuery` on `MacroG2Store` (L14) queries registry by `blueprint_id` + `sql_sha256`; `MacroDailyG2RunService.run` (L27) uses `??` to call `createPrivateQuery` only when null; test on L5 asserts `created === 0` when registry matches |
| F-002 | **P1** | No early ISO-date format guard on Dune `report_day` | **CLOSED** | `/^\d{4}-\d{2}-\d{2}$/` regex on `macro-dune-cli.ts` L18 validates at external boundary; downstream `assertReportDay` retained for defense-in-depth |

No new findings.

## Verdict

**GREEN**

Both prior findings (F-001 P0, F-002 P1) are confirmed closed with line-level evidence and regression test coverage. All T3 boundaries (scope limitation, credential safety, aggregate-only persistence, transactional writes, dry-run default, Hermes isolation, no BSC/Robinhood adapters, no backfill/trading/push) remain intact with no degradation from the original audit PASS verdicts.
