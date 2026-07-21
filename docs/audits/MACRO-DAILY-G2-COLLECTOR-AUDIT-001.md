# MACRO-DAILY-G2-COLLECTOR-AUDIT-001

| Field | Value |
| --- | --- |
| task_id | MACRO-DAILY-G2-COLLECTOR-001 |
| audit_id | MACRO-DAILY-G2-COLLECTOR-AUDIT-001 |
| tier / role | T3 / auditor |
| auditor_utc | 2026-07-21T05:48Z |
| write_set | `docs/audits/MACRO-DAILY-G2-COLLECTOR-AUDIT-001.md` only |
| verdict | **FAIL** — P0 saved-query re-creation on every run; P1 date-validation gap |

## 0. Execution boundary (mandatory)

1. This audit is **read-only**; no source code was modified.
2. No Dune CLI, Dune API, PostgreSQL, or Hermes command was invoked.
3. No credential was read, printed, or stored.
4. All five acceptance commands were executed; all exited 0.
5. Only this file was created; no other write-set file was touched.

## 1. Scope limitation — G2 BTC daily transaction count only

**Requirement:** Only G2 BTC daily transaction count. No BSC/Robinhood adapters, Four.meme, stablecoin, TVL, FDV, market-cap, cohort, or trading capability.

| Check | Evidence | Verdict |
| --- | --- | --- |
| `macro-daily-g2-run-service.ts` L5–6 | `G2_SQL` selects only `btc_transaction_count` from `metrics_bitcoin.transactions_daily`. `G2_BLUEPRINT_ID = "G2_btc_tx_count"`. | ✅ |
| No BSC/Robinhood/Four.meme/stablecoin/TVL/FDV/market-cap/cohort/trading tokens in write-set files | grep across all 6 write-set files: zero matches | ✅ |
| Domain types (`macro-daily.ts` L3–7) | Only pre-existing G2-compatible types referenced; no new metrics introduced | ✅ |

**Result: PASS**

## 2. Dune CLI — safe parameter array, no credential access

**Requirement:** Dune called only via safe parameter array through `execFile`. Never read, print, or store credentials.

| Check | File | Lines | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| Uses `execFile` (not `exec`/shell) | `macro-dune-cli.ts` | L1, L5 | `import { execFile }` + `promisify(execFile)` — no shell interpolation | ✅ |
| Arguments passed as array | `macro-dune-cli.ts` | L9, L15 | Both `ensurePrivateQuery` and `runQuery` pass `string[]` to `execFileAsync` | ✅ |
| No `process.env`, `.env`, credential read | all 6 write-set files | grep: 0 matches | ✅ |
| No `console.log`, `process.stdout.write`, or credential logging | `macro-dune-cli.ts` | grep: 0 matches | ✅ |

**Result: PASS**

## 3. Saved-query reuse — ensurePrivateQuery must not re-create

**Requirement:** Same blueprint + SQL hash must NOT create a new Dune query every run. Query ID, SQL hash, and `query_version` must be traceable.

| Check | File | Lines | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| `ensurePrivateQuery` implementation | `macro-dune-cli.ts` | L8–12 | **Always calls `dune query create --private`**. No lookup, no `query list`, no `ON CONFLICT`-style idempotency on the Dune side. Every invocation creates a **new** saved query. | ❌ **P0** |
| DB-side upsert for registry | `postgres-macro-daily-repository.ts` | L6 | `ON CONFLICT (blueprint_id) DO UPDATE` correctly updates `query_id` / `sql_sha256` / `query_version` — but this only mitigates DB-side duplication, not Dune-side duplication | Partial |
| `query_version` format | `postgres-macro-daily-repository.ts` | L6 | `saved:G2_btc_tx_count@${input.sqlSha256}` — traceable | ✅ |
| SQL hash computed consistently | `macro-daily-g2-run-service.ts` | L25, L40 | `sha256(G2_SQL)` uses deterministic `createHash("sha256")` | ✅ |

> [!CAUTION]
> **P0 — Saved-query duplication.** `MacroDuneCli.ensurePrivateQuery` (L8–12) unconditionally calls `dune query create --private` without first checking whether a saved query with the same blueprint ID and SQL hash already exists. This contradicts the "ensure" contract declared in `SavedG2QueryGateway` (L9) and the provenance requirement: each run would produce a **new** Dune query ID, orphaning previous ones. The PostgreSQL `ON CONFLICT` upsert (L6 of the repository) overwrites the old query ID locally, but each stale Dune-side query remains.
>
> **Required fix:** `ensurePrivateQuery` must first attempt to retrieve the existing saved query (e.g., via `dune query list` or `dune query get <id>`) and compare `sql_sha256`. Only when the query is absent or the SQL has changed should it call `create` (or `update`).

**Result: FAIL**

## 4. Dune response validation — completed state, date, value, sourceAsOf

**Requirement:** Strict validation of `QUERY_STATE_COMPLETED`, `report_day`, finite numeric `btc_transaction_count`, and `execution_ended_at`.

| Check | File | Lines | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| State check | `macro-dune-cli.ts` | L18 | `parsed.state !== "QUERY_STATE_COMPLETED"` — throws on anything else | ✅ |
| `report_day` presence | `macro-dune-cli.ts` | L18 | `!row?.report_day` guarded | ✅ |
| `btc_transaction_count` finite | `macro-dune-cli.ts` | L18 | `!Number.isFinite(row.btc_transaction_count)` — correct for `null`, `undefined`, `NaN`, `Infinity` | ✅ |
| `execution_ended_at` presence | `macro-dune-cli.ts` | L18 | `!parsed.execution_ended_at` — guarded | ✅ |
| `sourceAsOf` from Dune timing | `macro-dune-cli.ts` | L19 | `new Date(parsed.execution_ended_at)` — correct | ✅ |
| **Date format validation** | `macro-dune-cli.ts` | L18–19 | `report_day` is used as-is from Dune without ISO-date format check (`/^\d{4}-\d{2}-\d{2}$/`). The downstream `MacroDailyBriefService.normalize` does validate via `assertReportDay`, but if an attacker/error supplies `"2026-07-19T00:00:00"` from Dune, the `.normalize()` call would catch it. However, early validation at the CLI boundary is best practice. | ⚠️ **P1** |
| `resultSha256` deterministic | `macro-dune-cli.ts` | L19 | `sha256(JSON.stringify({btc_transaction_count: ..., report_day: ...}))` — deterministic canonical form with fixed key order | ✅ |

> [!WARNING]
> **P1 — Missing early date-format guard.** `MacroDuneCli.runQuery` does not validate that `report_day` matches ISO date format (`YYYY-MM-DD`) before returning. Although the downstream `MacroDailyBriefService.normalize` (`macro-daily-brief-service.ts` L58–59, L171–176) does catch malformed dates, defense-in-depth mandates validation at the external boundary.

**Result: PASS (with P1 advisory)**

## 5. PostgreSQL — aggregate-only, no raw Dune payload or credentials

**Requirement:** Only aggregated values, query ID, SQL/result/brief hashes, and timestamps stored. No raw Dune payload. No credentials.

| Check | File | Lines | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| INSERT into `macro_query_registry` | `postgres-macro-daily-repository.ts` | L6 | Stores `blueprint_id`, `query_id`, `sql_sha256`, `query_version` — all aggregate/provenance | ✅ |
| INSERT into `macro_daily_global_metrics` | `postgres-macro-daily-repository.ts` | L6 | Stores `report_day`, `metric_name='btc_transaction_count'`, `subject='bitcoin'`, `value` (aggregate count), `unit='count'`, provenance fields | ✅ |
| INSERT into `macro_daily_delivery_runs` | `postgres-macro-daily-repository.ts` | L6 | Stores `report_day`, `blueprint_id`, `result_sha256`, `source_as_of`, `brief_sha256`, `delivery_mode` | ✅ |
| No raw stdout/Dune JSON stored | `postgres-macro-daily-repository.ts` | Full file | `stdout` never referenced; only extracted fields passed through `MacroG2Store.save` interface | ✅ |
| No credential columns | `003_macro_query_registry.sql` | L1–21 | No `api_key`, `database_url`, `token`, `password`, `secret` columns | ✅ |
| `MacroG2Store.save` interface | `macro-daily-g2-run-service.ts` | L13–14 | Interface accepts only aggregate values + hashes + timestamps; no raw payload parameter | ✅ |

**Result: PASS**

## 6. Transactional database writes

**Requirement:** Writes must be transactional. Failure must not leave partial records.

| Check | File | Lines | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| `BEGIN` / `COMMIT` / `ROLLBACK` | `postgres-macro-daily-repository.ts` | L6 | `client.query("BEGIN")` → three INSERTs → `client.query("COMMIT")` in try block; `client.query("ROLLBACK")` in catch block; `client.release()` in finally block | ✅ |
| Uses dedicated client (not pool.query) | `postgres-macro-daily-repository.ts` | L6 | `const client = await this.pool.connect()` — session-scoped transaction | ✅ |
| Error propagation | `postgres-macro-daily-repository.ts` | L6 | `throw error` after ROLLBACK — caller sees the failure | ✅ |

**Result: PASS**

## 7. Default dryRun=true, explicit dryRun:false for Hermes

**Requirement:** Default `dryRun=true`; only explicit `dryRun:false` triggers Hermes.

| Check | File | Lines | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| Default parameter | `macro-daily-g2-run-service.ts` | L24 | `options: { dryRun?: boolean } = {}` — `dryRun` defaults to `undefined` | ✅ |
| Publisher invocation | `macro-daily-g2-run-service.ts` | L34 | `this.publisher.publish(markdown, options.dryRun !== false)` — only `false` makes it `false`; `undefined`, `true`, and any other value all resolve to `true` (dry run) | ✅ |
| Hermes publisher guard | `hermes-feishu-publisher.ts` | L7 | `if (dryRun) return "dry_run"` — returns immediately without external call | ✅ |
| Test: default is dry run | `macro-daily-g2-run-service.test.ts` | L4 | `.run()` without arguments → `deliveryMode === "dry_run"` asserted | ✅ |
| Test: explicit false sends | `macro-daily-g2-run-service.test.ts` | L5 | `.run({dryRun:false})` → `dryRun===false` verified, `deliveryMode === "hermes_sent"` asserted | ✅ |

**Result: PASS**

## 8. Hermes target not hardcoded; no messages sent from tests/audit

**Requirement:** Hermes target must not be hardcoded into the repository or test output. No message sent during audit.

| Check | File | Lines | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| Target is constructor-injected | `hermes-feishu-publisher.ts` | L6 | `constructor(private readonly target: string, ...)` — not a literal; caller provides | ✅ |
| No hardcoded chat/group ID in source | All 6 write-set files | grep for `oc_`, `og_`, chat ID patterns: 0 matches | ✅ |
| Test uses injected fake publisher | `macro-daily-g2-run-service.test.ts` | L4–5 | Both tests create inline `MacroBriefPublisher` fakes that return string literals without any network call | ✅ |
| No `execFile`/`execFileAsync`/`hermes` in tests | `macro-daily-g2-run-service.test.ts` | Full file | No import of `child_process`, `execFile`, or `HermesFeishuPublisher` | ✅ |
| No Hermes call during this audit | This document | — | Audit did not invoke any `hermes` command | ✅ |

**Result: PASS**

## 9. Markdown provenance — no cross-chain scoring, predictions, or trade advice

**Requirement:** Rendered Markdown must retain provenance. No cross-chain scoring, predictions, trade recommendations, or buy/sell instructions.

| Check | File | Lines | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| Provenance rendered | `macro-daily-brief-renderer.ts` | L81–83 | `renderProvenance()` emits completeness, queryRef, queryVersion, sourceAsOf, warnings for every observation | ✅ |
| Data quality section | `macro-daily-brief-renderer.ts` | L47–48 | Static disclaimers: "不执行 Dune 查询或任何链上采集", "请以查询引用、版本、截至时间与告警代码复核来源" | ✅ |
| No prediction/recommendation/buy/sell/score/signal tokens | `macro-daily-brief-renderer.ts` | grep: 0 matches (only "交易者" = "traders" in metric label) | ✅ |
| `macro-daily-g2-run-service.ts` | grep: 0 matches | ✅ |

**Result: PASS**

## 10. Migration 003 not applied; first real ops gated on audit GREEN

**Requirement:** Migration `003_macro_query_registry.sql` is not yet applied. First real migration, Dune collection, and Hermes delivery must occur after audit GREEN.

| Check | Evidence | Verdict |
| --- | --- | --- |
| No `003` or `macro_query_registry` reference in `docs/runs/` | grep: 0 matches | ✅ |
| `docs/runs/MACRO-DAILY-POSTGRES-BOOTSTRAP-001.md` only lists 001+002 tables (`macro_daily_global_metrics` present, `macro_query_registry` absent) | Line 42 only lists 002-era tables | ✅ |
| Task spec gates delivery: "first real Hermes delivery remains gated on independent audit GREEN" | `MACRO-DAILY-G2-COLLECTOR-001.json` L11 | ✅ |
| This audit does not apply 003, run Dune, or send Hermes | Execution boundary §0 | ✅ |

**Result: PASS**

---

## Write-set check

| File in task write_set | Modified by task? | Present on disk? | Audited? |
| --- | --- | --- | --- |
| `db/migrations/003_macro_query_registry.sql` | ✅ Created | ✅ | ✅ |
| `src/application/macro-daily-g2-run-service.ts` | ✅ Created | ✅ | ✅ |
| `src/infrastructure/dune/macro-dune-cli.ts` | ✅ Created | ✅ | ✅ |
| `src/infrastructure/postgres/postgres-macro-daily-repository.ts` | ✅ Created | ✅ | ✅ |
| `src/infrastructure/hermes/hermes-feishu-publisher.ts` | ✅ Created | ✅ | ✅ |
| `test/macro-daily-g2-run-service.test.ts` | ✅ Created | ✅ | ✅ |

No files outside the task write_set were created or modified by this audit.

## Acceptance command results

| Command | Exit code | Evidence |
| --- | --- | --- |
| `npm run harness:task -- validate harness/tasks/MACRO-DAILY-G2-COLLECTOR-001.json` | **0** | `{"task_id":"MACRO-DAILY-G2-COLLECTOR-001","status":"GREEN","errors":[]}` |
| `npm run typecheck` | **0** | `tsc -p tsconfig.json --noEmit` clean |
| `npm test` | **0** | 40 pass, 0 fail |
| `npm run build` | **0** | `tsc -p tsconfig.json` clean |
| `git diff --check` | **0** | No whitespace errors (only informational CRLF warnings on pre-existing unrelated files) |

## Real external call confirmation

| External system | Invoked during audit? | Evidence |
| --- | --- | --- |
| Dune CLI / API | **No** | No `dune` command was run |
| PostgreSQL | **No** | No `psql` or `pg` connection was made |
| Hermes / Feishu | **No** | No `hermes` command was run |

## Findings summary

| ID | Severity | Title | File | Lines | Description |
| --- | --- | --- | --- | --- | --- |
| F-001 | **P0** | Saved-query re-creation on every run | `macro-dune-cli.ts` | L8–12 | `ensurePrivateQuery` always calls `dune query create --private` without checking if a matching saved query already exists. Violates provenance reuse contract. |
| F-002 | **P1** | No early ISO-date format guard on Dune `report_day` | `macro-dune-cli.ts` | L18–19 | `runQuery` does not validate `report_day` format at the CLI boundary. Caught downstream by `MacroDailyBriefService.normalize`, but defense-in-depth requires boundary validation. |

## Verdict

**FAIL**

F-001 (P0) is a blocking defect. `MacroDuneCli.ensurePrivateQuery` will create a new Dune saved query on every invocation, orphaning previous query IDs. The `SavedG2QueryGateway` interface declares "ensure" semantics, but the implementation does not look up or reuse existing queries. This must be fixed before the task can be GREEN.

F-002 (P1) is a non-blocking advisory. The date format check exists downstream but should be added at the external boundary for defense-in-depth.

All other audit checkpoints (scope limitation, credential safety, aggregate-only persistence, transactional writes, dry-run default, Hermes isolation, markdown provenance, migration gating) **PASS**.

The task may proceed to GREEN once F-001 is remediated and re-audited.
