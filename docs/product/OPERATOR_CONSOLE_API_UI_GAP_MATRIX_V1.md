# Operator Console API ↔ UI Gap Matrix V1

**Document:** `OPERATOR_CONSOLE_API_UI_GAP_MATRIX_V1`  
**Scope:** Contract-level gap analysis between **current main / shell** and **target Operator Console UI**  
**Honesty rule:** Prefer **MISSING** over invented endpoints. Do not claim Live HTTP exists on main when shell uses fixtures.

**Related:**

- `docs/product/OPERATOR_CONSOLE_UI_STATE_MACHINE_V1.md`
- `docs/product/OPERATOR_CONSOLE_COMPONENT_CONTRACTS_V1.md`
- `docs/contracts/OPERATOR_CONSOLE_DATA_SOURCE_V1.md`
- `docs/contracts/CA_SCAN_RESPONSE_V1.md`
- Shell app: `apps/operator-console`
- Next task pointer: `SOL-CA-HOLDER-HOTPATH-INTEGRATION-001` (`docs/handoffs/NEXT_STAGE_EXECUTION_PLAN_20260730.md`)

---

## Executive summary

| Layer | Reality on main (2026-07-31) |
|-------|------------------------------|
| Operator Console UI | **Exists** — React+Vite shell, fixture data source **active** |
| Data source interface | `listCaScans`, `getCaScan`, `listWallets`, `getWallet`, `listAddressLabels`, `listTasks`, `getTask`, `createLocalDemoTask`, `getDataSourceMeta` |
| HTTP adapter | **Scaffold only** — `HttpOperatorConsoleDataSource` throws `not_configured` |
| REST `GET /api/v1/health` | **Not exposed** as Operator Console shell dependency (no in-app health client) |
| REST `POST/GET …/ca-holder-tasks` | **MISSING on main shell** — design target for M2 hotpath integration |
| REST `GET …/ca-holder-results/:taskId` | **MISSING on main shell** |
| Domain card | `CaScanResponse` v1 + pilot cleaning reports exist **in domain/application**, not as console HTTP |
| Live providers from UI | **Forbidden** in shell; zero Live calls |

**Conclusion:** UI components and state machine can be specified now; **wiring requires new HTTP surface** (or expansion of data-source adapter) under hotpath/orchestrator milestones. Fixture remains source of truth for M1.

---

## Current Operator Console data plane (main shell)

```text
Pages
  → createOperatorConsoleDataSource()
      → FixtureOperatorConsoleDataSource   [ACTIVE]
      → HttpOperatorConsoleDataSource      [SCAFFOLD / fail-closed]
```

| Interface method | Fixture | HTTP (main) | Target Live mapping (design) |
|------------------|---------|-------------|------------------------------|
| `listCaScans()` | `fixtures/ca-scans.json` | MISSING | list latest results / index |
| `getCaScan(mint)` | fixture by mint | MISSING | `GET …/tokens/:mint/latest` or result by mint |
| `listWallets()` / `getWallet` | wallets fixture | MISSING | `GET …/wallets/:address` |
| `listAddressLabels` / `saveLocalDemoLabel` | addresses + localStorage | MISSING | `GET/POST …/addresses` |
| `listTasks` / `getTask` | tasks fixture + localStorage demos | MISSING | `GET …/ca-holder-tasks/:id` / list |
| `createLocalDemoTask` | localStorage only | MISSING | `POST …/ca-holder-tasks` |
| `getDataSourceMeta` | `{ mode: fixture, live: false }` | `{ mode: http, live: false, note }` | `{ live: true }` only when gated |

---

## Legend

| Column | Meaning |
|--------|---------|
| **current endpoint** | Path if exists; else MISSING |
| **current DTO** | Shape available today **to the console**, or domain-only note |
| **target component** | Primary UI consumer(s) |
| **missing field** | Fields UI needs that DTO/endpoint lack |
| **temporary UI behavior** | Honest shell/hotpath interim behavior |
| **backend change needed** | Contract work (not an implement order here) |
| **milestone** | From execution plan vocabulary |

Milestone tags used:

- **M1-SHELL** — Operator Console shell (fixtures)
- **M2-HOTPATH** — `SOL-CA-HOLDER-HOTPATH-INTEGRATION-001` + stability batches
- **M3-ADDR** — address intelligence store
- **M4-ORCH** — research task orchestrator
- **M5-LIQ** — liquidity dashboard
- **FUTURE** — contract-only; do not implement backend in this doc’s scope

---

# Part A — CURRENT main endpoints (contract-level)

> **Note:** There is **no** production Operator HTTP server checked in as the console’s live backend. Rows below describe **target REST names** the product expects, plus **what main actually has** (domain modules, fixtures, or true absence).

---

## A1. `GET /api/v1/health`

| Column | Content |
|--------|---------|
| **current endpoint** | **MISSING** as Operator Console-facing route on main shell. (Other subsystems may have process health; console does not call one.) |
| **current DTO** | **MISSING on main shell** |
| **target component** | `FixtureLiveIndicator` (ops strip); optional Layout health dot |
| **missing field** | `status`, `version`, `schemaVersions[]`, `liveGate`, `providers.configured` (boolean only — never secrets), `time` |
| **temporary UI behavior** | Rely on `getDataSourceMeta()` only; show fixture/http note; no green “API healthy” claim |
| **backend change needed** | Expose allowlisted health JSON for console base URL; fail-closed if down |
| **milestone** | M2-HOTPATH (minimum) |

**Target DTO (contract-only sketch):**

```ts
interface HealthResponseV1 {
  status: "ok" | "degraded" | "down";
  service: "operator-api";
  version: string;
  schemaVersions: string[]; // e.g. ["ca-scan-response/v1"]
  liveGate: boolean;
  // booleans only — no key material
  credentialsConfigured?: { helius?: boolean; gmgn?: boolean };
  now: string;
}
```

---

## A2. `POST /api/v1/ca-holder-tasks`

| Column | Content |
|--------|---------|
| **current endpoint** | **MISSING on main shell HTTP.** Closest UI action: `createLocalDemoTask(mint)` → localStorage demo task (`provider: "local-demo"`), **no Helius/network**. |
| **current DTO** | Shell write: `TaskViewModel` locally. Domain: pilot/orchestration modules exist for CA cleaning **CLI/application**, not this REST. |
| **target component** | CA input form; `TaskLifecycle` (`SUBMITTING`→`QUEUED`); `TaskBudgetMeter` |
| **missing field** | Response: `taskId`, `status`, `requestBudget`, `requestsUsed`, `parentTaskId`, `lineageRootId`, `input.mint`, `createdAt`, `failureReason?`, `warnings[]`, `ruleVersion?` |
| **temporary UI behavior** | Demo task only; banner “未调用 Helius / 无网络”; map demo status into lifecycle badges without claiming Live |
| **backend change needed** | Authenticated/local POST; validate mint; enqueue holder task; return durable `taskId`; set budget; support lineage on retry; distinct `blocked` vs `failed` |
| **milestone** | M2-HOTPATH |

**Target request/response (contract-only):**

```ts
interface CreateCaHolderTaskRequestV1 {
  mint: string;
  chain?: "solana";
  parentTaskId?: string;
  lineageRootId?: string;
  requestBudget?: number; // server may clamp
}

interface CreateCaHolderTaskResponseV1 {
  taskId: string;
  status: "queued" | "blocked" | "failed";
  input: { mint: string; chain: "solana" };
  requestBudget: number;
  requestsUsed: number;
  parentTaskId?: string | null;
  lineageRootId?: string | null;
  warnings: string[];
  failureReason?: string | null; // credential_unavailable etc.
  createdAt: string;
}
```

**UI mapping notes:**

| Response | UI state |
|----------|----------|
| 202/200 + `queued` | `QUEUED` |
| `blocked` + credential reason | `BLOCKED_CREDENTIAL` |
| 400 invalid mint | `INVALID_INPUT` |
| 5xx | `FAILED` |

---

## A3. `GET /api/v1/ca-holder-tasks/:taskId`

| Column | Content |
|--------|---------|
| **current endpoint** | **MISSING on main shell HTTP.** Fixture: `getTask(taskId)` / `listTasks()` from `tasks.json` + demo localStorage. |
| **current DTO** | `TaskViewModel`: `taskId`, `input.mint?`, `provider`, `status` (`queued|running|completed|partial|failed|blocked`), `requestBudget`, `requestsUsed`, `startedAt`, `endedAt`, `warnings[]`, `outputLink`, `failureReason` |
| **target component** | `TaskLifecycle`, `TaskBudgetMeter`, Tasks page table, poll driver |
| **missing field** | `parentTaskId`, `lineageRootId`, `phase`, `deadlineAt`, `freshnessPolicy`, `resultTaskId`/`outputRef`, explicit `status` values: `budget_exhausted`, `timed_out`, `cancelled`, `empty`, `schema_error`; `ruleVersion` |
| **temporary UI behavior** | Poll fixtures not required (static); badge from fixture status; `blocked`+`credential_unavailable` → credential blocked chrome if UI implements state machine early |
| **backend change needed** | Durable task store; status machine server-side; budget counters; reason codes; lineage fields; no secret leakage in `failureReason` |
| **milestone** | M2-HOTPATH |

**Gap detail — status vocabulary:**

| Shell `TaskStatus` | Target API status | UI state |
|--------------------|-------------------|----------|
| `queued` | `queued` | `QUEUED` |
| `running` | `running` | `RUNNING` |
| `completed` | `succeeded` | `SUCCEEDED` |
| `partial` | `partial` | `PARTIAL` |
| `failed` | `failed` | `FAILED` |
| `blocked` | `blocked` | `BLOCKED_CREDENTIAL` (when credential) |
| *(missing)* | `budget_exhausted` | `BUDGET_EXHAUSTED` |
| *(missing)* | `timed_out` | `TIMED_OUT` |
| *(missing)* | `cancelled` | `CANCELLED` |
| *(missing)* | `empty` | `EMPTY` |

---

## A4. `GET /api/v1/ca-holder-results/:taskId`

| Column | Content |
|--------|---------|
| **current endpoint** | **MISSING on main shell HTTP.** Console reads **by mint** via `getCaScan(mint)`, not by `taskId`. Domain has `CaScanResponse` v1 + pilot report shapes. |
| **current DTO (console)** | `CaScanViewModel` (fixture): trust gates, accounting block, ownerCounts, concentration map, issues, `observedAt`, `sourceWatermark`, `status`, warnings-ish fields |
| **current DTO (domain, not HTTP)** | `CaScanResponse` v1 envelope: tokenIdentity, marketSnapshot, authorityFacts, holderUniverses, cohortMetrics, walletTokenSignals, … completeness, warnings, sourceProvenance |
| **target component** | `TrustStrip`, `HolderUniverseTable`, `ConcentrationTable`, `DataQualityTable`, `AddressHitTable`, `WarningList`, `ObservedAt`, `SourceWatermark`, `EvidenceDrawer`, `PartialBanner`, `StaleBanner`, `SchemaErrorBoundary` |
| **missing field (console-facing)** | Bind `taskId`↔result; `schema`+`version`; full six holder universes as tables (fixture is summary counts, not full rows); per-metric `RatioMetric` provenance; `freshness_status`; `evidence[]` structured; explicit `empty` flag; `lineage`; `verificationStatus` on every metric (fixture has some); `judgmentEvidence[]` |
| **temporary UI behavior** | Fixture CA detail; `formatRatio(null)→暂不可确认`; concentration UNVERIFIED when `concentrationEligible=false`; fixture banner; no taskId-centric result route required yet |
| **backend change needed** | Persist result per taskId; validate `ca-scan-response` v1 fail-closed; map cleaning pilot → console view-model **server-side**; never require UI to recompute ratios |
| **milestone** | M2-HOTPATH (+ stability batches for pagination/residual edge cases) |

**Critical mapping debt:**

| UI need | Fixture today | Target result API |
|---------|---------------|-------------------|
| Concentration confirmed gate | `concentrationEligible` boolean | same + per-metric `verificationStatus` |
| ratio null | supported | mandatory |
| Holder universe rows | counts only | full universes or paginated rows |
| Evidence drawer | issues.evidence string arrays partial | structured evidence refs |
| Stale | not first-class | `freshness_status` / policy |
| Schema fail-closed | client trusts JSON | `schema`+`version` validated |

---

## A5. Cross-cutting shell endpoints (not ca-holder, but current console)

These are **fixture data-source methods**, not REST on main:

### A5.1 CA list / detail (fixture)

| Column | Content |
|--------|---------|
| **current endpoint** | **N/A REST** — `listCaScans` / `getCaScan` |
| **current DTO** | `CaScanListItem` / `CaScanViewModel` |
| **target component** | CA list page, CA detail, Trust badges |
| **missing field** | Live pagination, server search, task linkage |
| **temporary UI behavior** | Static fixture list; 未找到 → empty (not error) |
| **backend change needed** | Index of latest results; optional search |
| **milestone** | M2-HOTPATH / M4-ORCH |

### A5.2 Wallets (fixture)

| Column | Content |
|--------|---------|
| **current endpoint** | **N/A REST** — `listWallets` / `getWallet` |
| **current DTO** | `WalletPoolSummary`, `WalletViewModel` (fingerprints, tiers, unverified) |
| **target component** | Wallet list/detail, `AddressHitTable` patterns |
| **missing field** | Real addresses (privacy: fingerprints in fixture), CA hit history, live stats |
| **temporary UI behavior** | Disclaimer + scrubbed pool; CA hits placeholder text |
| **backend change needed** | Wallet profile API + verificationStatus honesty |
| **milestone** | M3-ADDR / FUTURE wallet APIs |

### A5.3 Addresses (fixture + local demo labels)

| Column | Content |
|--------|---------|
| **current endpoint** | **N/A REST** — `listAddressLabels` / `saveLocalDemoLabel` |
| **current DTO** | `AddressLabelViewModel` |
| **target component** | Addresses page |
| **missing field** | Server persistence, trust promotion workflow |
| **temporary UI behavior** | localStorage demo labels only |
| **backend change needed** | Address library HTTP aligned to sedimentation |
| **milestone** | M3-ADDR |

### A5.4 Tasks list (fixture)

| Column | Content |
|--------|---------|
| **current endpoint** | **N/A REST** — `listTasks` |
| **current DTO** | `TaskViewModel[]` |
| **target component** | Tasks page |
| **missing field** | Server list filters, lineage columns |
| **temporary UI behavior** | Static + local demos |
| **backend change needed** | Task index API |
| **milestone** | M2-HOTPATH / M4-ORCH |

---

# Part A matrix (compact)

| current endpoint | current DTO (or MISSING on main shell) | target component | missing field | temporary UI behavior | backend change needed | milestone |
|------------------|----------------------------------------|------------------|---------------|----------------------|----------------------|-----------|
| `GET /api/v1/health` | **MISSING** | FixtureLiveIndicator, Layout health | status, liveGate, schemaVersions, credential booleans | Meta from dataSource only; no API healthy claim | Health JSON allowlist | M2-HOTPATH |
| `POST /api/v1/ca-holder-tasks` | **MISSING** HTTP; local demo task only | TaskLifecycle, form submit | taskId, lineage, budget, blocked vs failed | `createLocalDemoTask`; no network | Enqueue + validate + lineage + budget | M2-HOTPATH |
| `GET /api/v1/ca-holder-tasks/:taskId` | **MISSING** HTTP; `TaskViewModel` fixture | TaskLifecycle, TaskBudgetMeter, Tasks table | lineage, budget_exhausted/timed_out/cancelled/empty, phase | Static fixture statuses | Durable task status machine | M2-HOTPATH |
| `GET /api/v1/ca-holder-results/:taskId` | **MISSING** HTTP; `CaScanViewModel` by **mint** fixture; domain `CaScanResponse` v1 not served | TrustStrip, tables, banners, EvidenceDrawer, SchemaErrorBoundary | taskId binding, schema/version, full universes, freshness, evidence graph | Fixture by mint; null ratio → 不可确认; fixture banner | Persist+validate result; server map to VM | M2-HOTPATH |
| *(dataSource)* `listCaScans` / `getCaScan` | Fixture JSON | CA list/detail | Live/index/task link | Fixture only | Latest-by-mint API | M2-HOTPATH |
| *(dataSource)* wallets | Fixture pool | Wallet pages | Live profile, hits | Placeholder hits | Wallet API | M3-ADDR |
| *(dataSource)* addresses | Fixture + localStorage | Addresses page | Server write | Demo labels | Address library API | M3-ADDR |
| *(dataSource)* tasks | Fixture + localStorage | Tasks page | Server list/lineage | Demo tasks | Task index | M2/M4 |

---

# Part B — FUTURE endpoints (contract-only)

> **Do NOT implement backend in the scope of this document.**  
> These exist for UI IA, gap planning, and orchestrator design. Names are product contracts, not promises of current main.

---

## B1. `POST /api/v1/ca-tasks`

| Column | Content |
|--------|---------|
| **current endpoint** | **MISSING** (broader than holder-only task) |
| **current DTO** | MISSING |
| **target component** | Unified task create (holder + market + depth options) |
| **missing field** | `taskKind`, `depth`, `modules[]`, budget class, schedule hook |
| **temporary UI behavior** | Do not show multi-module create in shell; holder-only path later |
| **backend change needed** | Orchestrator accepting kinded tasks; default kind=`ca_holder` |
| **milestone** | M4-ORCH / FUTURE |

**Sketch:**

```ts
interface CreateCaTaskRequestV1 {
  mint: string;
  kind: "ca_holder" | "ca_full" | "ca_refresh";
  modules?: Array<"holders" | "market" | "authority" | "dev" | "clusters">;
  parentTaskId?: string;
  lineageRootId?: string;
}
```

**Relation to A2:** `ca-holder-tasks` may be a specialized alias or first implementation of `kind=ca_holder`. UI should tolerate either once adapter normalizes.

---

## B2. `GET /api/v1/tasks/:id`

| Column | Content |
|--------|---------|
| **current endpoint** | **MISSING** (generic task resource) |
| **current DTO** | MISSING (fixture tasks are not generic) |
| **target component** | TaskLifecycle, orchestrator UI, `/tasks/:taskId` route |
| **missing field** | polymorphic `kind`, child tasks, cancel API, shared budget pool |
| **temporary UI behavior** | Use ca-holder task GET when exists; hide generic route or alias |
| **backend change needed** | Unified task record across holder/macro/research |
| **milestone** | M4-ORCH / FUTURE |

---

## B3. `GET /api/v1/ca-results/:id`

| Column | Content |
|--------|---------|
| **current endpoint** | **MISSING** (result by result id, not only taskId) |
| **current DTO** | Domain `CaScanResponse` v1 not HTTP-served |
| **target component** | CA detail, Replay, EvidenceDrawer, SchemaErrorBoundary |
| **missing field** | stable `resultId`, immutable snapshot, `schema`/`version`, full provenance |
| **temporary UI behavior** | Fixture mint detail; no replay |
| **backend change needed** | Immutable result store; validation fail-closed; content hash optional |
| **milestone** | M2-HOTPATH → M4-ORCH (replay) |

**Note:** Product may keep `ca-holder-results/:taskId` as the first read path and later add `ca-results/:resultId` for multi-version history.

---

## B4. `GET /api/v1/tokens/:mint/latest`

| Column | Content |
|--------|---------|
| **current endpoint** | **MISSING** HTTP; fixture `getCaScan(mint)` is the stand-in |
| **current DTO** | `CaScanViewModel` |
| **target component** | CA detail “latest” view, list row drill-in |
| **missing field** | `taskId` of latest, `resultId`, `freshness_status`, `isStale`, schema headers |
| **temporary UI behavior** | Fixture always “as of fixture observedAt”; show fixture indicator — **not** “latest live” |
| **backend change needed** | Latest pointer per mint; never silently substitute stale without flag |
| **milestone** | M2-HOTPATH |

**Stale rule:** If latest pointer is stale, UI enters `STALE_RESULT` with banner — never badge as newest market terminal.

---

## B5. `GET /api/v1/wallets/:address`

| Column | Content |
|--------|---------|
| **current endpoint** | **MISSING** HTTP; fixture `getWallet(id)` uses fingerprint ids |
| **current DTO** | `WalletViewModel` (scrubbed) |
| **target component** | Wallet detail, VerificationBadge, WarningList |
| **missing field** | period stats with PARTIAL honesty, labels with Tier-B, CA hits, `observedAt`, `sourceWatermark` |
| **temporary UI behavior** | Scrubbed fixture; disclaimer; no Live GMGN from UI |
| **backend change needed** | Profile read from library/stats store; fail-closed on missing periods |
| **milestone** | M3-ADDR / FUTURE |

---

## B6. `GET /api/v1/addresses`

| Column | Content |
|--------|---------|
| **current endpoint** | **MISSING** HTTP; fixture list + localStorage labels |
| **current DTO** | `AddressLabelViewModel[]` |
| **target component** | Addresses page, filters, label editor (server) |
| **missing field** | pagination, query, verification filters, write audit |
| **temporary UI behavior** | Demo labels local only |
| **backend change needed** | Address library query API aligned to Postgres sedimentation when authorized |
| **milestone** | M3-ADDR |

---

## B7. `GET /api/v1/liquidity/latest`

| Column | Content |
|--------|---------|
| **current endpoint** | **MISSING** |
| **current DTO** | MISSING (macro liquidity designs exist as docs; not console API) |
| **target component** | Future `/liquidity` page (IA); not M1 shell routes as Live |
| **missing field** | pool snapshots, freshness, provenance Tier, warnings |
| **temporary UI behavior** | Route absent or `NOT_WIRED · FUTURE_MILESTONE · NO_LIVE_DATA` |
| **backend change needed** | Liquidity observation read models |
| **milestone** | M5-LIQ / FUTURE |

---

## B8. `POST /api/v1/schedules`

| Column | Content |
|--------|---------|
| **current endpoint** | **MISSING** |
| **current DTO** | MISSING |
| **target component** | Future `/schedules` |
| **missing field** | cron/spec, mint set, budget class, Owner approval flag, idempotency key |
| **temporary UI behavior** | Not in shell; do not fake recurring Live jobs |
| **backend change needed** | Scheduler with Owner gates; no unattended credential expansion without policy |
| **milestone** | M4-ORCH / FUTURE (cron explicitly parked in execution plan) |

---

# Part B matrix (compact)

| future endpoint | current DTO | target component | missing field | temporary UI behavior | backend change needed | milestone |
|-----------------|-------------|------------------|---------------|----------------------|----------------------|-----------|
| `POST /api/v1/ca-tasks` | MISSING | unified create form | kind, modules, lineage | hide multi-module | orchestrator create | M4 / FUTURE |
| `GET /api/v1/tasks/:id` | MISSING | Task detail route | polymorphic task | alias holder task when ready | unified task record | M4 / FUTURE |
| `GET /api/v1/ca-results/:id` | domain v1 not HTTP | detail/replay/evidence | resultId, immutability, schema | fixture by mint | result store + validate | M2→M4 |
| `GET /api/v1/tokens/:mint/latest` | fixture CaScan VM | CA latest view | freshness, ids | fixture + not “live latest” | latest pointer | M2-HOTPATH |
| `GET /api/v1/wallets/:address` | fixture wallet VM | wallet detail | live stats, hits | scrubbed disclaimer | profile API | M3 / FUTURE |
| `GET /api/v1/addresses` | fixture labels | addresses | query/persist | localStorage demo | library API | M3-ADDR |
| `GET /api/v1/liquidity/latest` | MISSING | liquidity page | entire resource | NOT_WIRED | liquidity read model | M5 / FUTURE |
| `POST /api/v1/schedules` | MISSING | schedules page | entire resource | hidden / parked | scheduler + gates | FUTURE (parked cron) |

---

# Part C — Field-level gaps for CA holder happy path

Minimum fields the **state machine + components** need once Live is wired:

| Field | POST task | GET task | GET result | Fixture today | Notes |
|-------|-----------|----------|------------|---------------|-------|
| `taskId` | ✓ | ✓ | ✓ | tasks only | results by mint today |
| `parentTaskId` / lineage | ✓ | ✓ | optional | **missing** | retry law H5 |
| `status` (rich enum) | ✓ | ✓ | section status | partial enum | budget/timeout/empty |
| `failureReason` | ✓ | ✓ | optional | yes | credential distinct |
| `requestBudget` / `requestsUsed` | ✓ | ✓ | optional | yes | budget ≠ complete |
| `warnings[]` | ✓ | ✓ | ✓ | partial | codes allowlisted |
| `observedAt` | — | optional | ✓ | yes | never client now |
| `sourceWatermark` | — | optional | ✓ | yes | stale honesty |
| `ruleVersion` | optional | optional | ✓ | partial | per metric ideal |
| `verificationStatus` | — | — | ✓ per metric | concentration map yes | no client derive |
| `accountingEligible` | — | — | ✓ | yes | TrustStrip |
| `exclusionCoverage` | — | — | ✓ | yes | TrustStrip |
| `concentrationEligible` | — | — | ✓ | yes | not judgmentEligible |
| `ratio` nullability | — | — | ✓ | yes | 不可确认 |
| `schema` + `version` | — | — | ✓ | **missing on fixture root** | SchemaErrorBoundary |
| `freshness_status` | — | — | ✓ | **missing** | StaleBanner |
| `evidence` / refs | — | optional | ✓ | issues.evidence partial | EvidenceDrawer |
| `holderUniverses` rows | — | — | ✓ | counts only | tables |
| `whetherManualReviewRequired` | — | — | ✓ | issues yes | human review banner |

---

# Part D — Adapter strategy (when HTTP lands)

```text
HttpOperatorConsoleDataSource (future activation)
  health()           → GET /api/v1/health
  createTask(mint)   → POST /api/v1/ca-holder-tasks
  getTask(id)        → GET /api/v1/ca-holder-tasks/:id
  getResult(taskId)  → GET /api/v1/ca-holder-results/:taskId
  getCaScan(mint)    → GET /api/v1/tokens/:mint/latest
                       OR map from latest result
```

**Activation gates:**

1. Base URL configured  
2. Health `liveGate` / Owner policy  
3. Schema versions include `ca-scan-response/v1`  
4. Fixture mode remains default until gate green  
5. Fail-closed: unknown schema → `SCHEMA_ERROR`, not best-effort UI  

**Non-goals for adapter:**

- Recompute concentration  
- Call Helius from browser  
- Store API keys in localStorage  

---

# Part E — Milestone wiring checklist

| Milestone | User-visible unlock | API prerequisite |
|-----------|---------------------|------------------|
| M1-SHELL | Browse fixture CA/wallets/addresses/tasks | none (fixture) |
| M2-HOTPATH | Submit real CA holder task; poll; view result by task | health + ca-holder-tasks + ca-holder-results (+ optional tokens/latest) |
| M2 stability | PARTIAL/budget/timeout/residual honesty under load | status reasons + budgets + pagination completeness |
| M3-ADDR | Address library browser + hits on CA | addresses + wallets APIs |
| M4-ORCH | Generic tasks, lineage browser, schedules UI (if unparked) | ca-tasks, tasks/:id, schedules |
| M5-LIQ | Liquidity page | liquidity/latest |

---

# Part F — Honesty assertions (audit)

1. **Main Operator Console does not currently call `ca-holder-tasks` HTTP.**  
2. **`HttpOperatorConsoleDataSource` is scaffold-only and throws `not_configured`.**  
3. **Fixture tasks with `provider: "helius"` + `blocked` are still fixture rows** — not proof of Live credential integration in UI.  
4. **Domain `CaScanResponse` v1 is not the same as an exposed Operator REST result** until an endpoint serves validated payloads.  
5. **Future endpoints in Part B are contracts only** — listing them is not authorization to implement.  
6. **Empty fixture miss (`getCaScan` null) is EMPTY-like UX, not FAILED.**  
7. **`ratio: null` remains 不可确认 across fixture and Live.**  

---

## Document control

| Version | Date | Notes |
|---------|------|-------|
| v1 | 2026-07-31 | Gap matrix for main shell vs target ca-holder HTTP and future APIs |
