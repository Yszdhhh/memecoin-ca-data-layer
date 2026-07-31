# Operator Console API ↔ UI Gap Matrix V1

**Document:** `OPERATOR_CONSOLE_API_UI_GAP_MATRIX_V1`  
**Scope:** Contract-level gap analysis between **post-Hotpath main** and **target Operator Console UI**  
**Honesty rule:** Backend CA-holder endpoints **exist** after PR #7 merge `ae60368bcd82ebc3fb9f2655dd82f6d079158401`. Production Console HTTP wiring / Browser Live path are **not** done. Never claim the four ca-holder routes are "missing on main."  
**Aligned as of:** 2026-07-31 · independent audit GREEN

**Related:**

- `docs/product/OPERATOR_CONSOLE_UI_STATE_MACHINE_V1.md`
- `docs/product/OPERATOR_CONSOLE_COMPONENT_CONTRACTS_V1.md`
- `docs/contracts/OPERATOR_CONSOLE_DATA_SOURCE_V1.md`
- `docs/contracts/OPERATOR_CA_HOLDER_API_V1.md`
- `docs/contracts/CA_SCAN_RESPONSE_V1.md`
- Shell app: `apps/operator-console`
- Active task: `OPERATOR-CONSOLE-LIVE-WIRING-001` (`docs/handoffs/NEXT_STAGE_EXECUTION_PLAN_20260730.md`)

---

## Binding milestone map (G0–G8)

```text
G0: Console Shell + Holder Hotpath + bounded Live + merge   [DONE — PR #6 / #7]
G1: OPERATOR-CONSOLE-LIVE-WIRING-001 + Stability Batches + Observability
G2: CA Analysis Core v1
G3: Address Intelligence Store
G4: Controlled Orchestration
G5: Wallet Ledger / PnL
G6: advanced CA intelligence (dev / early buyer / funding / cluster / cross-CA / judgment)
G7: Liquidity Dashboard
G8: Replay / Calibration / Alerts / Security / Local Release
```

Adoption language:

- **ADOPT_UI_PATTERN_NOW** — UI/IA/prototype pattern safe to adopt in design
- **IMPLEMENT_IN_G<n>** — product/backend implementation belongs in that G lane

---

## Executive summary

| Layer | Reality on main (post-Hotpath `ae60368`) |
|-------|-------------------------------------------|
| Operator Console UI | **Exists** — React+Vite shell, fixture data source **active** |
| Data source interface | fixture methods active; HTTP scaffold `not_configured` |
| HTTP adapter (Console) | **Scaffold only** — not wired to Operator API |
| Backend Operator API | **Implemented** — loopback `127.0.0.1` (`npm run operator-api`) |
| REST `GET /api/v1/health` | **Backend implemented** · Console client **not wired** |
| REST `POST/GET …/ca-holder-tasks` | **Backend implemented** · Console client **not wired** |
| REST `GET …/ca-holder-results/:taskId` | **Backend implemented** · Console client **not wired** |
| Live providers from browser | **Forbidden** — keys stay process env / DPAPI |
| Helius bounded smoke | **Done** (Hotpath ≤20 requests) · PR #7 merged |

```text
API Live exists  ≠  Console Live Wiring complete
Backend endpoint = implemented
Production Console HTTP wiring = not implemented
Browser Live path = not wired
Current next gap = adapter + polling + result VM + states   (G1 Live Wiring)
```

**Conclusion:** Do **not** invent missing ca-holder endpoints on main. Gap is **Console → loopback Operator API** under `OPERATOR-CONSOLE-LIVE-WIRING-001`. Stability only **after** Live Wiring. Schedules/cron remain parked. Fixture remains source of truth for Console until Live Wiring ships.

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
| `listCaScans()` | `fixtures/ca-scans.json` | Console not wired | list latest results / index |
| `getCaScan(mint)` | fixture by mint | Console not wired | `GET …/tokens/:mint/latest` or result by mint |
| `listWallets()` / `getWallet` | wallets fixture | Console not wired | `GET …/wallets/:address` |
| `listAddressLabels` / `saveLocalDemoLabel` | addresses + localStorage | Console not wired | `GET/POST …/addresses` |
| `listTasks` / `getTask` | tasks fixture + localStorage demos | Console not wired (backend tasks exist) | `GET …/ca-holder-tasks/:id` / list |
| `createLocalDemoTask` | localStorage only | Console not wired (backend POST exists) | `POST …/ca-holder-tasks` |
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

- **G0-SHELL** — Operator Console shell (fixtures) — DONE
- **G0-HOTPATH** — `SOL-CA-HOLDER-HOTPATH-INTEGRATION-001` — DONE / MERGED (`ae60368`)
- **G1-LIVE-WIRING** — Console adapter + polling + result VM + states
- **G1 Stability** — stability batches after Live Wiring
- **G3-ADDR** — address intelligence store
- **G4-ORCH** — controlled orchestration
- **G7-LIQ** — liquidity dashboard
- **G8** — Replay / Calibration / Alerts / Security / Local Release
- **FUTURE** — contract-only; do not implement in Live Wiring

---

# Part A — CURRENT main endpoints (contract-level)

> **Note (post-Hotpath):** The four CA-holder Operator API routes **are implemented** on main (`src/application/operator-api/**`, CLI bind `127.0.0.1`). Console still uses fixtures. Rows separate **backend** vs **Console wiring**.

---

## A1. `GET /api/v1/health`

| Column | Content |
|--------|---------|
| **current endpoint** | **Backend: implemented** (loopback Operator API). **Console HTTP wiring: not implemented.** |
| **current DTO** | Backend health JSON exists; Console still uses `getDataSourceMeta()` only |
| **target component** | `FixtureLiveIndicator` (ops strip); optional Layout health dot |
| **missing field** | Console client map of status / liveDefault / bind host (never secrets) |
| **temporary UI behavior** | Rely on `getDataSourceMeta()`; no green “API healthy” until adapter + health poll |
| **backend change needed** | None for basic health (already on main) |
| **milestone** | G1-LIVE-WIRING |

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
| **current endpoint** | **Backend: implemented** on main (loopback Operator API). **Console HTTP wiring: not implemented.** Closest UI action: `createLocalDemoTask(mint)` → localStorage demo (no Helius/network). |
| **current DTO** | Backend accepts `{ mint, idempotencyKey? }`; rejects unknown/forbidden fields. Shell write today: local `TaskViewModel` only. |
| **target component** | CA input form; `TaskLifecycle` (`SUBMITTING`→`QUEUED`); `TaskBudgetMeter` |
| **missing field (Console)** | Adapter wiring: map 202 response to VM (`taskId`, `status`, `requestBudget`, `requestsUsed`, `failureReason`, `warnings[]`, `providerBudgetExhausted`, …) |
| **temporary UI behavior** | Demo task only; banner “未调用 Helius / 无网络”; never claim Live |
| **backend change needed** | **None for G0 ca-holder create** (already on main). Live Wiring is Console adapter only. |
| **milestone** | G1-LIVE-WIRING |

**UI mapping notes:**

| Response | UI state |
|----------|----------|
| 202 + `queued` | `QUEUED` |
| `blocked` + credential reason | `BLOCKED_CREDENTIAL` |
| 400 invalid mint / live_gate_disabled | `INVALID_INPUT` / blocked |
| 5xx | `FAILED` |

---

## A3. `GET /api/v1/ca-holder-tasks/:taskId`

| Column | Content |
|--------|---------|
| **current endpoint** | **Backend: implemented.** **Console HTTP wiring: not implemented.** Fixture: `getTask` / `listTasks` + localStorage demos. |
| **current DTO (backend)** | Hotpath task summary: `status` ∈ `queued|running|completed|partial|failed|blocked` plus `failureReason`, `providerBudgetExhausted`, `paginationComplete`, eligibility flags, counters |
| **target component** | `TaskLifecycle`, `TaskBudgetMeter`, Tasks table, poll driver |
| **missing field (Console)** | Poll adapter + map backend status+failureReason+warnings → UI badges (`BUDGET_EXHAUSTED`, `BLOCKED_CREDENTIAL`, `STALE_RESULT`, …) |
| **temporary UI behavior** | Static fixture badges; do not invent separate backend status values that Hotpath does not emit |
| **backend change needed** | **None for core task GET** (already on main) |
| **milestone** | G1-LIVE-WIRING |

**Status mapping (binding Hotpath DTO):**

| Backend `status` | `failureReason` / flags | UI derived state |
|-------------------|--------------------------|------------------|
| `queued` | — | `QUEUED` |
| `running` | — | `RUNNING` |
| `completed` | — | `SUCCEEDED` |
| `partial` | `request_budget_exhausted` or `providerBudgetExhausted=true` | `BUDGET_EXHAUSTED` (banner) + raw status remains `partial` |
| `partial` | other / exclusion partial | `PARTIAL` |
| `failed` | — | `FAILED` |
| `blocked` | credential | `BLOCKED_CREDENTIAL` |

Derived UI states (`BUDGET_EXHAUSTED`, `STALE_RESULT`, `SCHEMA_ERROR`, `EMPTY`) come from **status + failureReason + warnings**, never from inventing a separate backend status enum.

---

## A4. `GET /api/v1/ca-holder-results/:taskId`

| Column | Content |
|--------|---------|
| **current endpoint** | **Backend: implemented.** **Console HTTP wiring: not implemented.** Console still reads **by mint** via fixture `getCaScan(mint)`. |
| **current DTO (backend)** | Public result summary: accounting, exclusionCoverage, concentrationEligible, concentration metrics with `ratio:null` when ineligible, watermark, scrubbed fields |
| **target component** | `TrustStrip`, tables, `EvidenceDrawer`, banners, `SchemaErrorBoundary` |
| **missing field (Console)** | Result VM bound to `taskId`; poll→render path; keep ratio-null non-confirmable; never invent confirmed concentration when ineligible |
| **temporary UI behavior** | Fixture CA detail; `formatRatio(null)` → 不可确认; concentration unverified when `concentrationEligible=false` |
| **backend change needed** | **None for G0 result GET** (already on main). Optional later enrichment is G2+ |
| **milestone** | G1-LIVE-WIRING (+ G1 Stability for load/edge honesty) |

**Critical mapping debt (Console only):**

| UI need | Backend today | Console today |
|---------|---------------|---------------|
| Concentration gate | `concentrationEligible` + ratio null | fixture partial; not wired to taskId |
| ratio null | supported | supported in shell formatRatio |
| taskId binding | results by taskId | fixture by mint only |
| Budget exhaust mid-flight | partial + request_budget_exhausted | not demonstrated via Live path |

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
| **milestone** | G0-HOTPATH / G1-LIVE-WIRING / G4-ORCH |

### A5.2 Wallets (fixture)

| Column | Content |
|--------|---------|
| **current endpoint** | **N/A REST** — `listWallets` / `getWallet` |
| **current DTO** | `WalletPoolSummary`, `WalletViewModel` (fingerprints, tiers, unverified) |
| **target component** | Wallet list/detail, `AddressHitTable` patterns |
| **missing field** | Real addresses (privacy: fingerprints in fixture), CA hit history, live stats |
| **temporary UI behavior** | Disclaimer + scrubbed pool; CA hits placeholder text |
| **backend change needed** | Wallet profile API + verificationStatus honesty |
| **milestone** | G3-ADDR / FUTURE wallet APIs |

### A5.3 Addresses (fixture + local demo labels)

| Column | Content |
|--------|---------|
| **current endpoint** | **N/A REST** — `listAddressLabels` / `saveLocalDemoLabel` |
| **current DTO** | `AddressLabelViewModel` |
| **target component** | Addresses page |
| **missing field** | Server persistence, trust promotion workflow |
| **temporary UI behavior** | localStorage demo labels only |
| **backend change needed** | Address library HTTP aligned to sedimentation |
| **milestone** | G3-ADDR |

### A5.4 Tasks list (fixture)

| Column | Content |
|--------|---------|
| **current endpoint** | **N/A REST** — `listTasks` |
| **current DTO** | `TaskViewModel[]` |
| **target component** | Tasks page |
| **missing field** | Server list filters, lineage columns |
| **temporary UI behavior** | Static + local demos |
| **backend change needed** | Task index API |
| **milestone** | G0-HOTPATH / G1-LIVE-WIRING / G4-ORCH |

---

# Part A matrix (compact)

| current endpoint | current DTO (or Console not wired (backend may exist)) | target component | missing field | temporary UI behavior | backend change needed | milestone |
|------------------|----------------------------------------|------------------|---------------|----------------------|----------------------|-----------|
| `GET /api/v1/health` | **Backend implemented**; Console not wired | FixtureLiveIndicator | client health map | meta-only until G1 | none (backend done) | G1-LIVE-WIRING |
| `POST /api/v1/ca-holder-tasks` | **Backend implemented**; Console uses local demo only | TaskLifecycle, form submit | live enqueue wiring | `createLocalDemoTask` | none (backend done) | G1-LIVE-WIRING |
| `GET /api/v1/ca-holder-tasks/:taskId` | **Backend implemented**; Console fixture/local | TaskLifecycle, TaskBudgetMeter | poll + status map | Static fixture statuses | none (backend done) | G1-LIVE-WIRING |
| `GET /api/v1/ca-holder-results/:taskId` | **Backend implemented**; Console reads by mint fixture | TrustStrip, tables, EvidenceDrawer | taskId binding result VM | Fixture by mint; null ratio → 不可确认 | none (backend done) | G1-LIVE-WIRING |
| *(dataSource)* `listCaScans` / `getCaScan` | Fixture JSON | CA list/detail | Live/index/task link | Fixture only | Latest-by-mint API | G0-HOTPATH / G1-LIVE-WIRING |
| *(dataSource)* wallets | Fixture pool | Wallet pages | Live profile, hits | Placeholder hits | Wallet API | G3-ADDR |
| *(dataSource)* addresses | Fixture + localStorage | Addresses page | Server write | Demo labels | Address library API | G3-ADDR |
| *(dataSource)* tasks | Fixture + localStorage | Tasks page | Server list/lineage | Demo tasks | Task index | G1/G4 |

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
| **milestone** | G4-ORCH / FUTURE |

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
| **milestone** | G4-ORCH / FUTURE |

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
| **milestone** | G0-HOTPATH / G1-LIVE-WIRING → G4-ORCH (replay) |

**Note:** Product may keep `ca-holder-results/:taskId` as the first read path and later add `ca-results/:resultId` for multi-version history.

---

## B4. `GET /api/v1/tokens/:mint/latest`

| Column | Content |
|--------|---------|
| **current endpoint** | **Console HTTP not wired**; fixture `getCaScan(mint)` is the stand-in |
| **current DTO** | `CaScanViewModel` |
| **target component** | CA detail “latest” view, list row drill-in |
| **missing field** | `taskId` of latest, `resultId`, `freshness_status`, `isStale`, schema headers |
| **temporary UI behavior** | Fixture always “as of fixture observedAt”; show fixture indicator — **not** “latest live” |
| **backend change needed** | Latest pointer per mint; never silently substitute stale without flag |
| **milestone** | G0-HOTPATH / G1-LIVE-WIRING |

**Stale rule:** If latest pointer is stale, UI enters `STALE_RESULT` with banner — never badge as newest market terminal.

---

## B5. `GET /api/v1/wallets/:address`

| Column | Content |
|--------|---------|
| **current endpoint** | **Console HTTP not wired**; fixture `getWallet(id)` uses fingerprint ids |
| **current DTO** | `WalletViewModel` (scrubbed) |
| **target component** | Wallet detail, VerificationBadge, WarningList |
| **missing field** | period stats with PARTIAL honesty, labels with Tier-B, CA hits, `observedAt`, `sourceWatermark` |
| **temporary UI behavior** | Scrubbed fixture; disclaimer; no Live GMGN from UI |
| **backend change needed** | Profile read from library/stats store; fail-closed on missing periods |
| **milestone** | G3-ADDR / FUTURE |

---

## B6. `GET /api/v1/addresses`

| Column | Content |
|--------|---------|
| **current endpoint** | **Console HTTP not wired**; fixture list + localStorage labels |
| **current DTO** | `AddressLabelViewModel[]` |
| **target component** | Addresses page, filters, label editor (server) |
| **missing field** | pagination, query, verification filters, write audit |
| **temporary UI behavior** | Demo labels local only |
| **backend change needed** | Address library query API aligned to Postgres sedimentation when authorized |
| **milestone** | G3-ADDR |

---

## B7. `GET /api/v1/liquidity/latest`

| Column | Content |
|--------|---------|
| **current endpoint** | **Console not wired** |
| **current DTO** | MISSING (macro liquidity designs exist as docs; not console API) |
| **target component** | Future `/liquidity` page (IA); not G0 shell routes as Live |
| **missing field** | pool snapshots, freshness, provenance Tier, warnings |
| **temporary UI behavior** | Route absent or `NOT_WIRED · FUTURE_MILESTONE · NO_LIVE_DATA` |
| **backend change needed** | Liquidity observation read models |
| **milestone** | G7-LIQ / FUTURE |

---

## B8. `POST /api/v1/schedules`

| Column | Content |
|--------|---------|
| **current endpoint** | **Console not wired** |
| **current DTO** | MISSING |
| **target component** | Future `/schedules` |
| **missing field** | cron/spec, mint set, budget class, Owner approval flag, idempotency key |
| **temporary UI behavior** | Not in shell; do not fake recurring Live jobs |
| **backend change needed** | Scheduler with Owner gates; no unattended credential expansion without policy |
| **milestone** | G4-ORCH / FUTURE (cron explicitly parked in execution plan) |

---

# Part B matrix (compact)

| future endpoint | current DTO | target component | missing field | temporary UI behavior | backend change needed | milestone |
|-----------------|-------------|------------------|---------------|----------------------|----------------------|-----------|
| `POST /api/v1/ca-tasks` | MISSING | unified create form | kind, modules, lineage | hide multi-module | orchestrator create | G4 / FUTURE |
| `GET /api/v1/tasks/:id` | MISSING | Task detail route | polymorphic task | alias holder task when ready | unified task record | G4 / FUTURE |
| `GET /api/v1/ca-results/:id` | domain v1 not HTTP | detail/replay/evidence | resultId, immutability, schema | fixture by mint | result store + validate | G1→G4 |
| `GET /api/v1/tokens/:mint/latest` | fixture CaScan VM | CA latest view | freshness, ids | fixture + not “live latest” | latest pointer | G0-HOTPATH / G1-LIVE-WIRING |
| `GET /api/v1/wallets/:address` | fixture wallet VM | wallet detail | live stats, hits | scrubbed disclaimer | profile API | G3 / FUTURE |
| `GET /api/v1/addresses` | fixture labels | addresses | query/persist | localStorage demo | library API | G3-ADDR |
| `GET /api/v1/liquidity/latest` | MISSING | liquidity page | entire resource | NOT_WIRED | liquidity read model | G7 / FUTURE |
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
| G0-SHELL | Browse fixture CA/wallets/addresses/tasks | none (fixture) |
| G0-HOTPATH / G1-LIVE-WIRING | Submit real CA holder task; poll; view result by task | health + ca-holder-tasks + ca-holder-results (+ optional tokens/latest) |
| G1 Stability | PARTIAL/budget/timeout/residual honesty under load | status reasons + budgets + pagination completeness |
| G3-ADDR | Address library browser + hits on CA | addresses + wallets APIs |
| G4-ORCH | Generic tasks, lineage browser, schedules UI (if unparked) | ca-tasks, tasks/:id, schedules |
| G7-LIQ | Liquidity page | liquidity/latest |

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


---

## Owner Gate refresh (post-Hotpath)

| Gate | Status |
|------|--------|
| Helius bounded smoke | **Done** and merged with PR #7 (`ae60368`) |
| Runtime HELIUS_API_KEY | Still local runtime / security boundary (not “G0 smoke not run”) |
| Paid Birdeye / GMGN / Bubblemaps | Still later Owner Gate |
| Stability batches | **Only after** Live Wiring GREEN |
| Schedules / cron / auto-discovery | **Parked** |

```text
API Live exists ≠ Console Live Wiring complete
```
