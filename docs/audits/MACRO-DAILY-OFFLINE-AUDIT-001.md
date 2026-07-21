# MACRO-DAILY-OFFLINE-AUDIT-001 — Independent audit of offline daily macro metric contracts

## Header

| Field | Value |
| --- | --- |
| `task_id` | `MACRO-DAILY-OFFLINE-AUDIT-001` |
| `tier` | `T2` |
| `role` | `auditor` |
| `agent` / `model` | Claude Opus 4.6 (Thinking) via Antigravity |
| `report_utc` | `2026-07-20T16:38:00Z` |
| `write_set` | `docs/audits/MACRO-DAILY-OFFLINE-AUDIT-001.md` only |
| `verdict` | **GREEN** |

---

## Preflight

### Task spec validation

| Check | Result |
| --- | --- |
| Spec path | `harness/tasks/MACRO-DAILY-OFFLINE-AUDIT-001.json` — present (57 lines) |
| `task_id` | `MACRO-DAILY-OFFLINE-AUDIT-001` — matches dispatch |
| `tier` | `T2` — matches dispatch |
| `role` | `auditor` — matches dispatch |
| `status` | `READY` |
| `dependencies` | `["MACRO-DAILY-OFFLINE-001"]` — dependency task status `DONE` at `harness/tasks/MACRO-DAILY-OFFLINE-001.json:8` |
| `write_set` | `["docs/audits/MACRO-DAILY-OFFLINE-AUDIT-001.md"]` — matches only deliverable allowed by dispatch |
| Stage lock | `harness/config/project.json:4–6`: `active_stage=solana-pumpfun-e2e`, `active_chains=["solana"]`, `blocked_chains=["bsc","robinhood"]` |
| Forbidden actions | No source, migration, test, task spec, ledger, provider config, credential, schedule, Dune API, network, Feishu, BSC/Robinhood adapter or collector modification |

### Inputs read

| Input | Path | Status |
| --- | --- | --- |
| Constitution | `PROJECT_CONSTITUTION.md` | Read L1–45 |
| Playbook | `PROJECT_OPERATING_PLAYBOOK.md` | Read L1–88 |
| Known Limitations | `KNOWN_LIMITATIONS.md` | Read L1–13 |
| Owner Decisions | `OWNER_DECISIONS_NEEDED.md` | Read L1–14 |
| Project config | `harness/config/project.json` | Read L1–28 |
| Implementation task spec | `harness/tasks/MACRO-DAILY-OFFLINE-001.json` | Read L1–62; status=DONE |
| Design doc | `docs/designs/DAILY-MARKET-MACRO-DESIGN-001.md` | Read L1–220 |
| Design audit | `docs/audits/MACRO-DAILY-DESIGN-AUDIT-001.md` | Read L1–424; verdict=GREEN_WITH_ADVISORY |
| Dune research | `docs/research/MACRO-DUNE-RESEARCH-001.md` | Confirmed present |
| Migration 001 | `db/migrations/001_initial.sql` | Read L1–241; unmodified (clean `git status`) |
| Migration 002 | `db/migrations/002_macro_daily_metrics.sql` | Read L1–93 |
| Domain types | `src/domain/macro-daily.ts` | Read L1–86 |
| Brief service | `src/application/macro-daily-brief-service.ts` | Read L1–206 |
| Test suite | `test/macro-daily-brief-service.test.ts` | Read L1–142 |
| Fixture | `test/fixtures/macro/daily-metric-input.json` | Read L1–20 |

### Workspace state

| Check | Result |
| --- | --- |
| `git status` (implementation files) | All 5 implementation files (`002_macro_daily_metrics.sql`, `macro-daily.ts`, `macro-daily-brief-service.ts`, `macro-daily-brief-service.test.ts`, `daily-metric-input.json`) are `??` untracked — confirming additive, no existing file modified |
| `git status` (initial migration) | `db/migrations/001_initial.sql` — clean, not modified |
| `docs/audits/MACRO-DAILY-OFFLINE-AUDIT-001.md` | Does not exist — no overwrite risk |
| `git diff --check` | PASS — warnings only (LF→CRLF in 7 tracked files, no trailing whitespace or conflict markers) |

**Preflight: PASS.**

---

## Audit Item 1 — Only three scoped tables, no cohort table

**Requirement:** Migration creates exactly `macro_daily_global_metrics`, `macro_daily_chain_metrics`, and `macro_hourly_chain_profile`. No cohort table.

### Evidence

| Check | Location | Finding |
| --- | --- | --- |
| `CREATE TABLE` count | `002_macro_daily_metrics.sql` L1, L25, L59 | Exactly 3 `CREATE TABLE` statements |
| Table 1 | L1 | `macro_daily_global_metrics` |
| Table 2 | L25 | `macro_daily_chain_metrics` |
| Table 3 | L59 | `macro_hourly_chain_profile` |
| Cohort search | Full-file `Select-String -Pattern "cohort"` | **Zero matches** |
| Domain types | `src/domain/macro-daily.ts` L1–86 | No cohort interface or type |
| Brief service | `src/application/macro-daily-brief-service.ts` L1–206 | No cohort logic |
| Task spec | `MACRO-DAILY-OFFLINE-001.json:50` | "No cohort persistence table or cohort-producing code is created" |

**Verdict: PASS.** Exactly 3 tables. No cohort table, no cohort type, no cohort code.

---

## Audit Item 2 — Provenance fields in every observation table

**Requirement:** All three tables retain `query_ref`, `query_version`, `source_as_of`, `computed_at`, `completeness`, `warnings`.

### Evidence

| Field | `macro_daily_global_metrics` | `macro_daily_chain_metrics` | `macro_hourly_chain_profile` |
| --- | --- | --- | --- |
| `query_ref` | L13: `text NOT NULL` | L46: `text NOT NULL` | L81: `text NOT NULL` |
| `query_version` | L14: `text NOT NULL` | L47: `text NOT NULL` | L82: `text NOT NULL` |
| `source_as_of` | L15: `timestamptz NOT NULL` | L48: `timestamptz NOT NULL` | L83: `timestamptz NOT NULL` |
| `computed_at` | L16: `timestamptz NOT NULL` | L49: `timestamptz NOT NULL` | L84: `timestamptz NOT NULL` |
| `completeness` | L17: `numeric(5,4) NOT NULL CHECK(0..1)` | L50: `numeric(5,4) NOT NULL CHECK(0..1)` | L85: `numeric(5,4) NOT NULL CHECK(0..1)` |
| `warnings` | L18: `jsonb NOT NULL DEFAULT '[]'` | L51: `jsonb NOT NULL DEFAULT '[]'` | L86: `jsonb NOT NULL DEFAULT '[]'` |
| `source` | L12: `text NOT NULL` | L45: `text NOT NULL` | L80: `text NOT NULL` |

Domain type coverage (`MacroProvenance` at `macro-daily.ts:25–33`):

| Field | Type | Line |
| --- | --- | --- |
| `source` | `"dune"` | L26 |
| `queryRef` | `string` | L27 |
| `queryVersion` | `string` | L28 |
| `sourceAsOf` | `Date` | L29 |
| `computedAt` | `Date` | L30 |
| `completeness` | `number` | L31 |
| `warnings` | `MacroWarning[]` | L32 |

Service validation (`assertProvenance` at `macro-daily-brief-service.ts:153–169`):

- L154: `source !== "dune"` → reject
- L155: `queryRef` blank → reject
- L156: `queryVersion` blank → reject
- L157–158: `completeness` must be finite [0,1]
- L160–161: `sourceAsOf` must be valid Date
- L162–163: `computedAt` must be valid Date
- L166–167: each warning must have non-blank `code`

Design audit P2-1 from `MACRO-DAILY-DESIGN-AUDIT-001.md:368` noted that the *design contract* for `macro_hourly_chain_profile` was missing `query_version`. The implementation has **correctly added** `query_version` to this table (L82), resolving the P2-1 note.

**Verdict: PASS.** All six provenance fields plus `source` are present in all three SQL tables, all three TypeScript observation types extend `MacroProvenance`, and the service validates them.

---

## Audit Item 3 — Only task-whitelisted metrics accepted

**Requirement:** Only these metric families:
- **Global:** `dex_volume_usd`, `active_trader_count`, `btc_transaction_count`, `btc_fee_usd`
- **Solana:** `dex_volume_usd`, `active_trader_count`, `pump_launch_count`, `external_pool_count`
- **BSC:** `dex_volume_usd`, `active_trader_count`, `pancakeswap_pool_created_count`, `pancakeswap_lp_net_change_usd`
- **Robinhood:** `dex_volume_usd`, `active_trader_count`, `uniswap_pool_created_count`

Four.meme, stablecoin, bridge, TVL, market-cap/FDV, drawdown/survival cohort must be rejected or absent.

### Evidence

**SQL CHECK constraints (closed-form whitelist):**

| Table | Line | Constraint |
| --- | --- | --- |
| `macro_daily_global_metrics` | L4–6 | `CHECK (metric_name IN ('dex_volume_usd','active_trader_count','btc_transaction_count','btc_fee_usd'))` |
| `macro_daily_chain_metrics` | L30–39 | Per-chain `CHECK`: solana 4 metrics, bsc 4 metrics, robinhood 3 metrics — all match whitelist exactly |
| `macro_hourly_chain_profile` | L63–73 | Identical per-chain metric CHECK — all match whitelist exactly |

**TypeScript union types (closed-form whitelist):**

| Type | Line | Members |
| --- | --- | --- |
| `MacroGlobalMetricName` | `macro-daily.ts:3–7` | Exactly 4 members matching whitelist |
| `MacroChainMetricName` | `macro-daily.ts:9–16` | Exactly 7 members (union of Solana + BSC + Robinhood) |

**Service validation (`CHAIN_METRICS` lookup at `macro-daily-brief-service.ts:13–17`):**

| Chain | L13–17 | Metrics |
| --- | --- | --- |
| `solana` | L14 | `["dex_volume_usd","active_trader_count","pump_launch_count","external_pool_count"]` |
| `bsc` | L15 | `["dex_volume_usd","active_trader_count","pancakeswap_pool_created_count","pancakeswap_lp_net_change_usd"]` |
| `robinhood` | L16 | `["dex_volume_usd","active_trader_count","uniswap_pool_created_count"]` |

Service enforces at L135–136: `if (!CHAIN_METRICS[chain].includes(metricName))` → `MacroDailyValidationError`.

**Rejected metrics verification:**

| Pattern | Search scope | Result |
| --- | --- | --- |
| `stablecoin\|bridge\|tvl\|four_meme\|fdv\|market_cap\|drawdown\|survival\|valuation` | `002_macro_daily_metrics.sql` | **Zero matches** |
| Same pattern | `src/domain/macro-daily.ts`, `src/application/macro-daily-brief-service.ts` | **Zero matches** |
| `four_meme` | `test/macro-daily-brief-service.test.ts:106,109` | Used in **rejection test** — verifies `four_meme_launch_count` throws `unsupported metric for bsc` |

**Verdict: PASS.** Only whitelisted metrics are accepted. Forbidden metrics are absent from all production code and are explicitly rejected in tests.

---

## Audit Item 4 — Global and per-chain outputs separated; no score, recommendation or execution rule

**Requirement:** Global and three-chain outputs structurally separated. No ranking score, trading recommendation, or execution decision.

### Evidence

| Check | Location | Finding |
| --- | --- | --- |
| SQL tables | `002_macro_daily_metrics.sql` L1, L25, L59 | `macro_daily_global_metrics` is a separate table with no `chain` column. `macro_daily_chain_metrics` and `macro_hourly_chain_profile` have `chain` columns. Schemas are structurally distinct. |
| Domain types | `macro-daily.ts:35–43` vs `45–54` vs `56–66` | `MacroGlobalMetricObservation`, `MacroChainMetricObservation`, `MacroHourlyChainProfileObservation` are separate interfaces |
| Brief output | `macro-daily.ts:81–85` | `MacroDailyBrief` has `globalMetrics` (global array) and `chainReports` (array of `MacroChainBriefSection`). Global and chain are structurally separated. |
| Chain report | `macro-daily.ts:75–79` | `MacroChainBriefSection` has `chain`, `metrics`, `hourlyProfiles` — per-chain section |
| Brief construction | `macro-daily-brief-service.ts:64–80` | Three chain reports built independently via `.filter(m => m.chain === chain)`, then combined with separate `globalMetrics` |
| No score/recommendation | Full-file search for `score\|recommend\|execute\|trade\|signal\|trigger` | Zero matches in domain types and service. `active_trader_count` is a metric name, not a scoring concept. |

**Verdict: PASS.** Clean structural separation. No score, recommendation, or execution language.

---

## Audit Item 5 — Robinhood requires `partial_coverage` and pinned Uniswap v2/v3/v4 registry

**Requirement:** Robinhood observations must use `coverage_status=partial_coverage` and `registry_version=spellbook:dex_robinhood:uniswap_v2_v3_v4@<pinned-sha>`. This applies to both daily metrics and hourly profiles.

### Evidence

**SQL constraints:**

| Table | Line | Constraint |
| --- | --- | --- |
| `macro_daily_chain_metrics` | L52 | `CHECK (chain <> 'robinhood' OR coverage_status = 'partial_coverage')` |
| `macro_hourly_chain_profile` | L87 | `CHECK (chain <> 'robinhood' OR coverage_status = 'partial_coverage')` |

**Service validation (`validateChainMetricIdentity` at `macro-daily-brief-service.ts:128–150`):**

| Check | Line | Behavior |
| --- | --- | --- |
| Coverage enforcement | L142–145 | `if (chain === "robinhood" && coverageStatus !== "partial_coverage")` → `MacroDailyValidationError` |
| Registry regex | L146 | `/^spellbook:dex_robinhood:uniswap_v2_v3_v4@[0-9a-f]{7,64}$/` — requires hex SHA 7–64 chars |
| Registry error | L147–148 | Clear error message referencing `ROBINHOOD_REGISTRY_PREFIX` |

**Shared validation path:**

The method `validateChainMetricIdentity` is called from both:
- `validateChainMetric` at L99 (for daily chain metrics)
- `validateHourlyProfile` at L108–114 (for hourly profiles)

This means both daily and hourly Robinhood observations pass through the same `partial_coverage` + pinned-SHA check.

**Fixture confirmation:**

| Location | Value |
| --- | --- |
| `daily-metric-input.json:12` | `"registry_version": "spellbook:dex_robinhood:uniswap_v2_v3_v4@deadbeef"` — chain metric |
| `daily-metric-input.json:17` | `"registry_version": "spellbook:dex_robinhood:uniswap_v2_v3_v4@deadbeef"` — hourly profile |

**Test coverage:**

| Test | Line | Assertion |
| --- | --- | --- |
| Coverage rejection | `test:119–123` | Sets Robinhood `coverageStatus = "declared_registry"` → throws `/robinhood coverageStatus must be partial_coverage/` |
| Registry rejection | `test:125–130` | Sets `registryVersion = "spellbook:dex_robinhood:all_venues@deadbeef"` → throws `/robinhood registryVersion must be pinned/` |

**Verdict: PASS.** Both daily metrics and hourly profiles enforce `partial_coverage` and the pinned `uniswap_v2_v3_v4@<hex-sha>` format. SQL constraints, TypeScript validation, fixture, and tests are all consistent.

---

## Audit Item 6 — Hourly profiles require UTC 0–23 and `query_version` provenance

**Requirement:** `hour_utc` range [0,23], UTC semantics, `query_version` retained.

### Evidence

| Check | Location | Finding |
| --- | --- | --- |
| SQL CHECK | `002_macro_daily_metrics.sql:74` | `hour_utc smallint NOT NULL CHECK (hour_utc BETWEEN 0 AND 23)` |
| SQL `query_version` | `002_macro_daily_metrics.sql:82` | `query_version text NOT NULL` |
| TypeScript validation | `macro-daily-brief-service.ts:115–116` | `if (!Number.isInteger(profile.hourUtc) \|\| profile.hourUtc < 0 \|\| profile.hourUtc > 23)` → error |
| Provenance validation | `macro-daily-brief-service.ts:125` | `assertProvenance(profile)` — validates `queryVersion` is non-blank (L156) |
| Domain type | `macro-daily.ts:60` | `hourUtc: number` |
| Domain type | `macro-daily.ts:57–66` | `MacroHourlyChainProfileObservation extends MacroProvenance` — inherits `queryVersion` |
| Test coverage | `test:133–140` | `hourUtc: 24` → throws `/hourUtc must be an integer/`; empty `queryVersion` → throws `MacroDailyValidationError` |
| Fixture | `daily-metric-input.json:15–17` | Hours 2, 13, 19 — all valid UTC hours |
| Test assertion | `test:101` | Verifies `brief.chainReports[2]?.hourlyProfiles[0]?.hourUtc` is `19` |

**Verdict: PASS.** UTC 0–23 enforced at both SQL and TypeScript layers. `query_version` is a required field in all hourly profiles.

---

## Audit Item 7 — No network, Dune API, credentials, provider, scheduler, Feishu, database execution, BSC/Robinhood adapter or collector

### Evidence

**Import analysis of all implementation files:**

| File | Imports | Finding |
| --- | --- | --- |
| `macro-daily.ts` | None (pure type definitions) | No runtime imports at all |
| `macro-daily-brief-service.ts:1–11` | Only `../domain/macro-daily.js` (type imports only) | No `fs`, `net`, `http`, `https`, `fetch`, `pg`, `ioredis`, or third-party import |
| `test:1–11` | `node:assert/strict`, `node:fs/promises`, `node:test`, service+type imports | `readFile` used only for fixture loading; no network calls |
| `daily-metric-input.json` | N/A (data file) | No executable code |
| `002_macro_daily_metrics.sql` | N/A (DDL only) | No `SELECT`, no function creation, no `INSERT`, no procedure, no trigger |

**Full-text search for forbidden patterns:**

| Pattern | Scope | Result |
| --- | --- | --- |
| `fetch\|http\|axios\|import.*net\|dune.*api\|api.*key\|credential\|\.env\|process\.env\|webhook\|scheduler\|cron\|setInterval\|feishu\|lark` | All 4 implementation files | **Zero matches** |
| `pg\|ioredis\|connect\|pool\|client` | All 4 implementation files | **Zero matches** |
| `BSC.*adapter\|Robinhood.*adapter\|collector\|provider` | All 4 implementation files | **Zero matches** |

**Migration 002 is DDL-only:** Contains only `CREATE TABLE`, `CREATE INDEX`, `CHECK` constraints, and `DEFAULT` values. No `INSERT`, `SELECT`, `EXECUTE`, function, or trigger.

**Verdict: PASS.** The implementation is completely offline: pure types, deterministic validation, fixture-based tests. No I/O, no network, no database execution, no credentials, no scheduler, no Feishu, no BSC/Robinhood adapter, no collector.

---

## Audit Item 8 — Write-set compliance

**Requirement:** All files changed by `MACRO-DAILY-OFFLINE-001` must be inside its `write_set`. No other files should be modified.

### Evidence

| `MACRO-DAILY-OFFLINE-001` write_set | `git status --porcelain` | Match |
| --- | --- | --- |
| `db/migrations/002_macro_daily_metrics.sql` | `?? db/migrations/002_macro_daily_metrics.sql` | ✅ New file, in write_set |
| `src/domain/macro-daily.ts` | `?? src/domain/macro-daily.ts` | ✅ New file, in write_set |
| `src/application/macro-daily-brief-service.ts` | `?? src/application/macro-daily-brief-service.ts` | ✅ New file, in write_set |
| `test/macro-daily-brief-service.test.ts` | `?? test/macro-daily-brief-service.test.ts` | ✅ New file, in write_set |
| `test/fixtures/macro/daily-metric-input.json` | `?? test/fixtures/macro/daily-metric-input.json` | ✅ New file, in write_set |

| Non-write-set check | Result |
| --- | --- |
| `db/migrations/001_initial.sql` | Clean — not modified |
| `src/domain/types.ts` | Clean — not modified |
| Existing task specs | Not modified by implementation files |
| Existing source files | No other `.ts` files in `src/` modified |

All 5 new files are exactly the MACRO-DAILY-OFFLINE-001 write_set. The implementation is purely additive.

**Verdict: PASS.**

---

## Command Results

| Command | Exit code | Output summary |
| --- | --- | --- |
| `npm run harness:task -- validate harness/tasks/MACRO-DAILY-OFFLINE-AUDIT-001.json` | 0 | `{"task_id":"MACRO-DAILY-OFFLINE-AUDIT-001","status":"GREEN","errors":[]}` |
| `npm run typecheck` | 0 | Clean — no errors |
| `npm test` | 0 | 35/35 pass, 0 fail |
| `npm run build` | 0 | Clean — no errors |
| `git diff --check` | 0 | Warnings only (LF→CRLF in 7 tracked files, no trailing whitespace or conflict markers) |

---

## Findings Summary

### P0 — None

No blocking issues found.

### P1 — None

No P1 advisories.

### P2 — Notes (informational)

| ID | Item | Location | Description |
| --- | --- | --- | --- |
| P2-1 | Design audit P2-1 resolved | `002_macro_daily_metrics.sql:82` | The previous design audit noted `macro_hourly_chain_profile` contract was missing `query_version`. The implementation correctly adds `query_version text NOT NULL` to this table. |
| P2-2 | `active_trader_count` section assignment | `macro-daily-brief-service.ts:38` | `active_trader_count` is classified as section `"capital"`. This is a reasonable semantic choice (trader activity reflects capital engagement), but the design doc (L64,73,88) lists active traders under "Capital" for all three chains, confirming alignment. |
| P2-3 | Fixture uses synthetic SHA `deadbeef` | `daily-metric-input.json:9–17` | All `registry_version` values use `deadbeef` as the pinned SHA. This is acceptable for a synthetic test fixture and the task spec explicitly states "Do not treat a test fixture identifier as evidence of a real Dune query execution or a real Spellbook git pin." |

---

## Scope and Write-Set Check

| Check | Result |
| --- | --- |
| Files written by this audit | `docs/audits/MACRO-DAILY-OFFLINE-AUDIT-001.md` — matches write_set exactly |
| Source code modified | None |
| Migrations modified | None |
| Tests modified | None |
| Task specs modified | None |
| Ledger modified | None |
| Provider configuration modified | None |
| Credentials accessed | None |
| Schedules modified | None |
| BSC/Robinhood CA activated | No |
| Dune API/query executed | No |
| Database migration executed | No |
| Feishu delivery activated | No |
| Trading capability introduced | No |
| Network calls made (by auditor) | None against project resources |

---

## Pending Items

| ID | Item | Owner |
| --- | --- | --- |
| U-1 | Design audit P1-2 (`macro_listing_cohort_metrics` missing `query_ref`) remains open from MACRO-DAILY-DESIGN-AUDIT-001 — not in this task's scope since cohort tables are correctly excluded | Design author (future task) |
| U-2 | Design audit P1-1 (Four.meme inline qualifier in design doc BSC table) remains open — also not in this task's scope | Design author (future task) |

---

## Verdict

**GREEN**

The `MACRO-DAILY-OFFLINE-001` implementation correctly:

1. **Creates exactly three tables** (`macro_daily_global_metrics`, `macro_daily_chain_metrics`, `macro_hourly_chain_profile`) with no cohort table. Evidence: `002_macro_daily_metrics.sql` L1, L25, L59; zero "cohort" matches in all implementation files.

2. **Retains complete provenance** in every observation table: `query_ref`, `query_version`, `source_as_of`, `computed_at`, `completeness`, and `warnings` are present in all three SQL schemas (verified at migration lines L12–18, L45–51, L80–86), TypeScript domain types (`MacroProvenance` at `macro-daily.ts:25–33`), and service validation (`assertProvenance` at `macro-daily-brief-service.ts:153–169`).

3. **Accepts only whitelisted metrics** via closed-form SQL `CHECK` constraints and TypeScript union types. Four.meme, stablecoin, bridge, TVL, market-cap/FDV, and drawdown/survival cohort metrics are absent from production code and explicitly rejected by test (`test:104–109`).

4. **Separates global and per-chain outputs** structurally in SQL (separate tables), TypeScript (separate interfaces), and the brief model (`MacroDailyBrief` at `macro-daily.ts:81–85`). No score, recommendation, or execution rule found.

5. **Enforces Robinhood `partial_coverage`** at both SQL (L52, L87) and TypeScript (L142–148) layers, with a `uniswap_v2_v3_v4@<hex-sha>` regex constraint. Shared `validateChainMetricIdentity` method ensures both daily and hourly Robinhood observations are checked.

6. **Constrains hourly profiles to UTC 0–23** with both SQL `CHECK` (L74) and TypeScript validation (L115–116), and retains `query_version` (SQL L82, TypeScript via `MacroProvenance`).

7. **Contains no network, Dune API, credentials, provider, scheduler, Feishu, database execution, BSC/Robinhood adapter, or collector code.** All implementation files are pure types, deterministic validation, or fixture-based tests.

8. **Write-set is clean.** All 5 implementation files match the MACRO-DAILY-OFFLINE-001 write_set exactly. The initial migration `001_initial.sql` is unmodified.

All five acceptance commands pass with exit code 0. No P0 or P1 findings. Three informational P2 notes documented.
