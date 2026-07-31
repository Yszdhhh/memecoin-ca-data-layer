# Operator Console — Information Architecture V2

**Status:** Product IA (binding for routes, first-screen content, and milestone wiring)  
**Audience:** Owner, implementers, auditors, UX  
**Companion:** `OPERATOR_CONSOLE_PRODUCT_POSITIONING_V1.md`  
**Grounding:** main shell `apps/operator-console`, `docs/contracts/OPERATOR_CONSOLE_DATA_SOURCE_V1.md`, `docs/contracts/CA_SCAN_RESPONSE_V1.md`, `docs/handoffs/NEXT_STAGE_EXECUTION_PLAN_20260730.md`

---

## 0. Visual direction (global)

| Axis | Spec |
| --- | --- |
| Density | High-density research terminal |
| Efficiency metaphor | Bloomberg-like: sticky keys, tables, little chrome |
| Restraint metaphor | Claude-like: calm hierarchy, no hype |
| Background | Light neutral (not dark neon) |
| Primary surfaces | **Tables first**, **evidence first** |
| Forbidden chrome | Neon gradients, trade CTAs, emoji status, opaque single risk score replacing evidence |
| Trust semantics | `null ≠ 0`; `PARTIAL ≠ SUCCESS`; **color never sole semantic** — always pair color with text label / field |

Global shell chrome (all routes):

- Left nav + brand: `Operator Console` / stage chip
- Top: global search (CA mint / wallet id / address keyword)
- Meta chip: `source: fixture|http · live=true|false` + note tooltip
- No wallet-connect, no Buy/Sell

---

## 1. Route map & milestone legend

### 1.1 Routes

| Route | Purpose (one line) |
| --- | --- |
| `/ca` | CA analysis entry + recent list |
| `/ca/:mint` | CA research card (trust-split first screen) |
| `/wallets` | Tier-B wallet pool summary + demo list |
| `/wallets/:id` | Single wallet observation detail |
| `/addresses` | Address library list / local demo labels |
| `/addresses/:id` | Address memory detail (reverse history) |
| `/tasks` | Task center list + create |
| `/tasks/:taskId` | Task run detail / budget / output links |
| `/watchlist` | Operator-curated CA / wallet watches |
| `/schedules` | Controlled schedules (Owner-gated; not free cron sprawl) |
| `/replay` | As-of / fixture replay of judgments |
| `/liquidity` | Liquidity board (macro / pair waterline) |
| `/settings` | Data source mode, display, operator prefs |

### 1.2 Milestone tags (use exactly)

| Tag | Meaning |
| --- | --- |
| **G1 shell / live wiring** | Shell UI exists or is specified for G0 shell; live/hotpath may wire via Data Source contract without IA rewrite |
| **G2+** | After shell + holder hotpath stability; address store, orchestrator, liquidity, richer intelligence |
| **NOT_WIRED** | Route or section exists in IA only; no production data path; must show FUTURE banner |
| **FUTURE_MILESTONE** | Explicit product future; not implied by current shell |
| **NO_LIVE_DATA** | Must not call live providers; fixture / empty / placeholder only |
| **Fixture** | `FixtureOperatorConsoleDataSource` / static JSON / scrubbed pilot |
| **Live** | HTTP/hotpath providers; only when meta.live and Owner-authorized paths |

### 1.3 Data source contract (all pages)

Pages depend only on `OperatorConsoleDataSource` (or FUTURE extensions of it):

```text
listCaScans() / getCaScan(mint)
listWallets() / getWallet(id)
listAddressLabels() / saveLocalDemoLabel(input)
listTasks() / getTask(id) / createLocalDemoTask(mint)
getDataSourceMeta()
```

HTTP mode is scaffold until configured; shell phase is **fixture**, `live=false`.

### 1.4 Trust field dictionary (CA)

Required on CA list + detail:

| Field | Type / values | Role |
| --- | --- | --- |
| `accountingEligible` | boolean | Accounting gate |
| `exclusionCoverage` | `complete` \| `partial` \| `unavailable` | Exclusion gate |
| `concentrationEligible` | boolean | Concentration gate (not legacy `judgmentEligible` alone) |

Ratio display: `formatRatio` → **`暂不可确认`** when `ratio` is null/undefined/NaN.

Wallet language: **Tier-B usable pool / shortlist** — never “smart money” branding for those pools.

---

## 2. Global navigation IA

### Primary nav (G1)

1. CA 分析 → `/ca`
2. 钱包库 → `/wallets`
3. 地址库 → `/addresses`
4. 任务中心 → `/tasks`

### Secondary / future nav (G2+; show disabled or “Future” until wired)

5. 观察列表 → `/watchlist` — **NOT_WIRED** until G2+
6. 调度 → `/schedules` — **NOT_WIRED** / Owner-gated
7. 回放 → `/replay` — **NOT_WIRED** / harness-aligned
8. 流动性 → `/liquidity` — G7 / **G2+**
9. 设置 → `/settings` — may land late G1 as read-only meta

### Global search routing rules (shell)

| Input | Navigate |
| --- | --- |
| Starts with `fp-` or `demo-` | `/wallets/:id` |
| Length ≥ 32 (mint-like) | `/ca/:mint` |
| Else | `/addresses?q=…` |

Future: exact wallet base58 → `/addresses/:id` or `/wallets/:id` when mapping exists.

---

## 3. Route specifications

Each route documents:

- User goal  
- First-screen fields  
- Secondary / expand fields  
- Data sources (Tier-A / Tier-B)  
- Required APIs (current main or FUTURE)  
- Loading / empty / error  
- Primary action  
- Prohibited behaviors  
- Milestone  
- Fixture vs Live  

---

### 3.1 `/ca`

#### User goal

Enter or open a CA research card; scan recent analyses with **split trust gates** before drilling in.

#### First-screen fields

- Page title: CA 分析
- Data-source banner: mode note, zero Live claims when fixture
- Input row: mint text field, **打开** button, fixture CA select
- Table (recent / fixture pilot):

| Column | Source field |
| --- | --- |
| 状态 | `status` (`OK` / `PARTIAL` / `REJECTED` / …) as text badge |
| Token | `symbol` / `name` → link `/ca/:mint` |
| Mint | shortened mint |
| Accounting | `accountingLabel(accountingEligible)` |
| Exclusion | `exclusionLabel(exclusionCoverage)` |
| Concentration | `concentrationLabel(concentrationEligible)` |
| observedAt | `observedAt` |

#### Secondary / expand fields

- Filter by status / eligibility (FUTURE)
- Sort by observedAt (FUTURE)
- Link to related task that produced scan (FUTURE when task graph wired)

#### Data sources

| Field group | Tier |
| --- | --- |
| List identity (mint, symbol, name, observedAt) | Display; provenance from scan envelope |
| Accounting / exclusion / concentration gates | Derived from Tier-A holder cleaning path when live; fixture in shell |
| Market columns | **Not** on list first screen (avoid implying market truth) |

#### Required APIs

| API | Status |
| --- | --- |
| `listCaScans()` | **Current main** (fixture implemented) |
| `getDataSourceMeta()` | **Current main** |
| FUTURE: `searchCaScans(query)` | G2+ |
| FUTURE: hotpath `POST /ca/scan` enqueue | G1 Live Wiring |

#### Loading / empty / error

| State | UI |
| --- | --- |
| Loading | “加载中…” |
| Empty | “暂无 fixture CA” / “暂无分析” |
| Error | “加载失败：{message}” — no fake rows |

#### Primary action

- Open CA by mint (`/ca/:mint`) or select fixture CA.

#### Prohibited behaviors

- Live provider calls in fixture mode  
- Showing concentration % on list without eligibility  
- Trade CTAs  
- Single composite “risk” column replacing the three gates  

#### Milestone

**G1 shell / live wiring** — implemented in shell with fixtures.

#### Fixture vs Live

| Mode | Behavior |
| --- | --- |
| Fixture | Static pilot list; scrubbed |
| Live | List from hotpath/store; still show gates + watermarks |

---

### 3.2 `/ca/:mint`  ★ primary research card

#### User goal

Answer, under explicit trust split: *What do we know about this mint, what is incomplete, and what evidence supports each claim?*

#### First-screen layout (binding)

```text
┌─ Sticky header ─────────────────────────────────────────────┐
│ Symbol · status badge · short mint · copy mint               │
│ observedAt · sourceWatermark · dataSource · provider · live  │
│ Primary: 刷新/重新分析 (when live) · 打开任务 · 加入观察列表   │
└──────────────────────────────────────────────────────────────┘
┌─ Trust Strip (FIVE domains, SEPARATE — never one score) ────┐
│ [Accounting] [Exclusion Coverage] [Concentration]            │
│ [Market Data] [Wallet Intelligence]                          │
│ each: text label + optional color; tooltip = definition      │
└──────────────────────────────────────────────────────────────┘
┌─ Holder universes (counts + amounts) ──┬─ Concentration table ┐
│ raw / included / excluded / unresolved  │ topN num/den/ratio/st │
└─────────────────────────────────────────┴──────────────────────┘
┌─ Data quality issues ───────────────────────────────────────┐
┌─ Address hits (library) ────────────────────────────────────┐
┌─ Evidence drawer (collapsed summary + expand) ──────────────┐
┌─ FUTURE placeholders (explicit NOT_WIRED banners) ──────────┐
```

#### Sticky header — first-screen fields

| Field | Notes |
| --- | --- |
| `symbol` / `name` | “—” if null |
| `status` | OK / PARTIAL / REJECTED — text badge |
| `mint` | full mono + copy |
| `decimals` | display metadata only |
| `mintSupplyRaw` | raw integer string |
| `observedAt` | ISO |
| `sourceWatermark` | required |
| `dataSource` / `provider` | provenance |
| Mode banner | Fixture / scrubbed / Live 未接入 when applicable |

#### Trust Strip — FIVE domains (separate)

Each domain is its **own** cell/badge. No rollup score.

| # | Domain | First-screen display | Gate / fields | Semantic rules |
| --- | --- | --- | --- | --- |
| 1 | **Accounting** | `CONFIRMED` / `PARTIAL` / `UNVERIFIED` via `accountingLabel(accountingEligible, accounting.completeness)` | `accountingEligible`, residual, pagination | Confirmed only when eligible; partial completeness → PARTIAL |
| 2 | **Exclusion Coverage** | `COMPLETE` / `PARTIAL` / `UNAVAILABLE` via `exclusionLabel(exclusionCoverage)` | pool/LP/bonding-curve coverage | Incomplete coverage blocks cleaned concentration language |
| 3 | **Concentration** | `CONFIRMED` / `UNVERIFIED` via `concentrationLabel(concentrationEligible)` | `concentrationEligible` | **Must not** confirm when exclusion incomplete; banner when ineligible |
| 4 | **Market Data** | `UNVERIFIED` / `UNAVAILABLE` / FUTURE `PARTIAL` | price, liq, FDV, pair | Tier-B typical; never overrides chain facts; shell may show `UNAVAILABLE` or placeholder |
| 5 | **Wallet Intelligence** | hit counts + verification mix | library hits, labels | Hits are features; confirmed smart money only Tier-A rules; pools are usable/shortlist language |

When `concentrationEligible === false`, sticky or strip-adjacent **warn banner** (shell pattern):

> Concentration 为 UNVERIFIED：pool / bonding curve exclusion coverage incomplete。不得称为「已清洗投资者控盘率」。TopN ratio 在未确认时显示「暂不可确认」，不会显示 0%。

#### Holder universes — first screen

| Field | Mapping |
| --- | --- |
| raw owner count | `ownerCounts.total` |
| included | `ownerCounts.included` |
| excluded | `ownerCounts.excluded` |
| unresolved | `ownerCounts.unresolved` |
| token accounts | `ownerCounts.tokenAccounts` |
| included amount | `accounting.includedOwnerBalanceRaw` |
| excluded amount | `accounting.excludedBalanceRaw` |
| unresolved amount | `accounting.unresolvedBalanceRaw` |
| accounting residual | `accounting.accountingResidualRaw` |
| residual ratio | may be null → 暂不可确认 if displayed as ratio |
| pagination | COMPLETE / PARTIAL from `paginationComplete` |
| identity | `accounting.identity` |
| universe definition | `universeDefinition` |

Contract reminder (full CA Scan Response): when `holderUniverses` non-null, six populations exist: `raw_top_holders`, `owner_aggregated_holders`, `cleaned_top_holders`, `excluded_infrastructure`, `excluded_pools`, `excluded_burn_addresses`. Shell view model may summarize counts first; expand lists in secondary.

#### Concentration table — first screen

Columns (binding):

| Metric | Numerator | Denominator | Ratio | Status |
| --- | --- | --- | --- | --- |
| top1…top100 | raw string | raw string | `formatRatio(ratio)` | `CONFIRMED` / `UNVERIFIED` |

Rules:

- Always show **num** and **denom** when present; never ratio alone  
- `ratio === null` → **`暂不可确认`**, not `0%`  
- `verificationStatus` per metric  
- `concentrationWarnings[]` listed under table  

#### Data quality — first screen (summary table)

| Column | Field |
| --- | --- |
| Code | `issues[].code` |
| Severity | text badge (not emoji) |
| Records | `affectedRecordCount` |
| Balance | `affectedBalance` raw |
| Manual review | yes/no |
| Evidence | joined evidence refs |

Empty issues: muted “无 issue records” — **not** a green “all clear” score.

#### Address hits — first screen

| Field | Notes |
| --- | --- |
| Hit count by label class | e.g. library risk / behavior / capability |
| Sample addresses | link to `/addresses/:id` or `/wallets/:id` |
| verificationStatus mix | confirmed vs unverified counts |
| Disclaimer | Tier-B features until Tier-A confirms |

Shell today may only have placeholders on wallet detail (`caHitsPlaceholder`); CA detail should still reserve this **first-screen region** with empty/FUTURE states rather than omitting the concept.

#### Evidence drawer — first screen (collapsed ok)

Collapsed: count of evidence items + highest severity warning.  
Expanded:

- JudgmentEvidence rows: code, summary, evidenceRefs, confidence, ruleVersion, sourceTier, completeness, warnings, status  
- Residual reasons  
- Source provenance list (`source`, tier, verification, observedAt, watermark)  
- Link to task output / fixture path when available  

Invariant: `sourceTier === "B"` and `status === "confirmed"` never shown as valid.

#### Secondary / expand fields

- Full holder tables per universe (raw / owner_aggregated / cleaned / excluded_*)  
- Accounting identity formula detail  
- `heliusRequestCountHistorical` / request budget (when live)  
- Market snapshot panel (Tier-B fields: price, liq, volume, pair) with unverified badges  
- Authority facts (mint/freeze) when available  
- Cross-links: related tasks, watchlist, replay as-of  

#### FUTURE placeholders on `/ca/:mint` (mandatory marking)

Render as panels with badges: **`NOT_WIRED` · `FUTURE_MILESTONE` · `NO_LIVE_DATA`**

| Panel | Intent | Must not |
| --- | --- | --- |
| **Dev** | Creator provenance, Dev sell totals, related-wallet separation | Infer creator from Tier-B alone; mix related into direct Dev |
| **Early Buyer** | First N buyers with library overlay | Call them smart money without rules |
| **Cluster** | Funding graph / cluster summaries | Confirmed cluster from Tier-B only |
| **Cross-CA** | Same addresses on other mints | Invent history without library store |
| **Replay** | Jump to `/replay?mint=&asOf=` | Imply live time-travel without watermarks |

#### Data sources (Tier-A / Tier-B)

| Domain | Tier-A | Tier-B |
| --- | --- | --- |
| Accounting / holders / residual | Helius DAS + RPC enumeration, owner aggregation | Display snapshots only as non-authoritative |
| Exclusion | Versioned exclusion rules + evidence | Platform pool hints as features |
| Concentration | Built on cleaned universe + eligibility | Never from platform “top holders %” alone as confirmed |
| Market Data | Optional chain-adjacent checks later | DexScreener / Birdeye / GMGN price-liq |
| Wallet Intelligence | Confirmed labels from pure rules + edges | GMGN/Birdeye tags, shortlist stats |

#### Required APIs

| API | Status |
| --- | --- |
| `getCaScan(mint)` | **Current main** (fixture) |
| FUTURE: hotpath scan by mint | G1 Live Wiring |
| FUTURE: `listAddressHitsForMint(mint)` | G2+ address store |
| FUTURE: `listEvidence(mint, asOf?)` | G2+ / replay |
| FUTURE: market snapshot attach | Tier-B adapter, still unverified |

#### Loading / empty / error

| State | UI |
| --- | --- |
| Loading | `scan === undefined` → “加载中…” |
| Empty / not found | `scan === null` → “未找到…”, link back to `/ca` |
| Error | “加载失败：…”, no fabricated concentration |
| Partial success | status PARTIAL + domains + null ratios + issues — **success chrome must not hide partial** |

#### Primary action

- **Understand trust state** (read strip) then expand evidence  
- Live (later): re-run scan / open task  
- G2+: add to watchlist, open replay  

#### Prohibited behaviors

- Single risk score replacing five domains  
- `0%` for null ratio  
- “已清洗投资者控盘率” when `!concentrationEligible`  
- Trade CTAs, emoji status  
- Promoting Tier-B labels to confirmed  
- Calling wallet pool hits “smart money”  
- Hiding residual ≠ 0  

#### Milestone

| Layer | Tag |
| --- | --- |
| Token basics + Accounting / Exclusion / Concentration + holder summary + concentration table + issues | **G1 shell** (fixture live today) |
| Market Data domain populated | G1 Live Wiring (still Tier-B) |
| Address hits live | **G2+** |
| Dev / Early Buyer / Cluster / Cross-CA / Replay panels | **NOT_WIRED · FUTURE_MILESTONE · NO_LIVE_DATA** until respective milestones |

#### Fixture vs Live

| | Fixture | Live |
| --- | --- | --- |
| Banner | Fixture / scrubbed pilot · Live 未接入 | source + watermark + live=true |
| Data | Scrubbed pilot JSON | Hotpath + store; fail closed |
| Network | None | Bounded provider fan-out |

---

### 3.3 `/wallets`

#### User goal

Inspect **Tier-B wallet pool health** and open demo / fingerprinted wallets—without mistaking the pool for confirmed smart money.

#### First-screen fields

- Title + **disclaimer banner** (required): third-party / not confirmed smart money language from `summary.disclaimer`
- Meta: `source`, `verificationStatus`, `observedAt`
- Summary tiles:

| Tile | Field | Copy rule |
| --- | --- | --- |
| Alpha | `alpha` | Numeric; do not relabel as “smart money count” |
| Tier-B usable pool | `tierBUsablePool` | Exact phrase **Tier-B usable pool** |
| Tier-B shortlist | `tierBShortlist` | Exact phrase **Tier-B shortlist** |
| Manual Review | `manualReview` | |
| MAPPED / PARTIAL≈ | `mapped` / `partialApproxPct` | PARTIAL ≠ success |
| ≥1 period UNAVAILABLE | `unavailablePeriodWallets` | |

- Table: id/fingerprint link, tier, 7d/30d status badges, completeness, verification, warnings  

#### Secondary / expand fields

- Filters: tier, verification, completeness threshold (FUTURE)  
- Export shortlist for manual review (FUTURE)  
- Mapping coverage diagnostics (FUTURE)  

#### Data sources

| Element | Tier |
| --- | --- |
| Pool stats / GMGN-derived completeness | **Tier-B** |
| Confirmed smart money (if ever shown) | **Tier-A only**, separate module — not this summary |

#### Required APIs

| API | Status |
| --- | --- |
| `listWallets()` | **Current main** |
| FUTURE: `listWalletPool(filter)` | G2+ |
| FUTURE: Tier-A wallet verify job | G2+ tasks |

#### Loading / empty / error

| State | UI |
| --- | --- |
| Loading | “加载中…” until summary |
| Empty list | Summary may still show; table “无演示钱包” |
| Error | Explicit fail; do not zero-fill pool as success |

#### Primary action

- Open wallet detail; internal review of shortlist / manual review counts  

#### Prohibited behaviors

- Branding usable pool or shortlist as smart money / Alpha winners  
- Confirmed badge on Tier-B-only rows  
- Bulk plaintext address dumps in UI/repo  
- Trade CTAs  

#### Milestone

**G1 shell** fixture summary + demo rows. Live pool wiring **G2+** / controlled re-fetch (not full 1433 re-scrape by default).

#### Fixture vs Live

| Fixture | Live |
| --- | --- |
| Fingerprints / synthetic demos; disclaimer that bulk plaintext not in git | Authorized APIs only; same Tier-B labeling |

---

### 3.4 `/wallets/:id`

#### User goal

Inspect one wallet observation: completeness, period status, labels with source/confidence/verification—not a trade profile.

#### First-screen fields

- Title: fingerprint / id  
- Banner: *Third-party Tier-B observation · Not confirmed on-chain smart money*  
- `disclaimer`  
- KV: id, tier, status7d, status30d, completeness, verificationStatus, observedAt, warnings  
- CA hits placeholder / count  
- Labels table: label, source, confidence, verification  

#### Secondary / expand fields

- Period breakdown 7d/30d fields (FUTURE detailed PnL — parked at product level)  
- Linked CA list (when address store exists)  
- Enqueue Tier-A verification task (FUTURE)  
- Funding edges / cluster (FUTURE, Tier-A)  

#### Data sources

Primarily **Tier-B** observation; any confirmed label requires Tier-A provenance in the label row.

#### Required APIs

| API | Status |
| --- | --- |
| `getWallet(walletId)` | **Current main** |
| FUTURE: `listWalletCaEdges(id)` | G2+ |
| FUTURE: `verifyWalletTierA(id)` → task | G2+ |

#### Loading / empty / error

| State | UI |
| --- | --- |
| Loading | “加载中…” |
| Not found | “未找到演示钱包” + back link |
| Error | message; no fake labels |

#### Primary action

- Read verification + warnings; navigate to related CA when links exist  

#### Prohibited behaviors

- “Smart money” hero title  
- Hiding `unverified`  
- PnL as fact without completeness  
- Trade / copy-trade buttons  

#### Milestone

**G1 shell** for demo wallets. Rich edges **G2+**.

#### Fixture vs Live

Fixture: synthetic fingerprints. Live: still Tier-B until verification pipeline exists.

---

### 3.5 `/addresses`

#### User goal

Operate the **address library** (local demo in shell): search labels, add operator notes—sedimentation surface for long-term memory.

#### First-screen fields

- Banner: *Local demo data — not persisted to production database* (shell)  
- Search: id / label / note  
- Add form: addressId, label, note → save to demo store  
- Table: ID, Display, Labels (label · source · conf · verification badge), Note  

#### Secondary / expand fields

- Filter by verificationStatus / sourceTier  
- Label priority display (risk > behavior > capability > social)  
- Bulk import from task output (FUTURE)  
- Link to Postgres address library when G3 lands  

#### Data sources

| Element | Tier |
| --- | --- |
| Operator demo notes | Local / non-production |
| Borrowed tags | Tier-B + unverified |
| Confirmed library labels | Tier-A + rule_version (G3) |

#### Required APIs

| API | Status |
| --- | --- |
| `listAddressLabels()` | **Current main** |
| `saveLocalDemoLabel(input)` | **Current main** (localStorage demo) |
| FUTURE: address library CRUD / search | G3 `ADDRESS-INTELLIGENCE-LOCAL-STORE-MVP` |
| FUTURE: reverse search by mint | G2+ |

#### Loading / empty / error

| State | UI |
| --- | --- |
| Loading | optional; table empty state if none |
| Empty filter | “无匹配地址” |
| Save error | surface; do not claim production persistence |

#### Primary action

- Search + save demo label / note  

#### Prohibited behaviors

- Claiming production DB write in shell  
- Promoting Tier-B label to confirmed on save  
- Secrets / raw provider dumps in notes UI  

#### Milestone

**G1 shell** local demo. **G3** real address asset store.

#### Fixture vs Live

Fixture/demo store only in shell. Live library is Owner-gated persistence.

---

### 3.6 `/addresses/:id`

#### User goal

Deep address memory: multi-label profile, evidence, reverse CA history, relationship notes.

#### First-screen fields

- Address id / display / short  
- Verification summary (counts by status)  
- Labels table with source, confidence, ruleVersion, sourceTier, verificationStatus  
- Recent CA hits table (mint, role, observedAt, link `/ca/:mint`)  
- Operator notes  
- Trust reminder: Tier-B features vs Tier-A confirmed  

#### Secondary / expand fields

- Identity / capability / behavior / relationship facets  
- Cluster membership (FUTURE)  
- Funding graph snippet (FUTURE)  
- Rule version history / label supersession  
- Evidence drawer  

#### Data sources

Mixed: library store (target Tier-A confirmed + Tier-B features). Cross-CA edges from sedimentation.

#### Required APIs

| API | Status |
| --- | --- |
| FUTURE: `getAddress(id)` | **NOT_WIRED** (no route in shell App today) |
| FUTURE: `listAddressCaHits(id)` | G3 |
| FUTURE: `listAddressEvidence(id)` | G2+ |

#### Loading / empty / error

| State | UI |
| --- | --- |
| Loading | standard |
| Not found | empty + search CTA |
| Partial labels | show partial; never upgrade status |

#### Primary action

- Review labels + jump to related CAs; edit operator note (when allowed)  

#### Prohibited behaviors

- Confirmed without Tier-A  
- Smart-money hero without evidence  
- Trade CTAs  

#### Milestone

**NOT_WIRED · FUTURE_MILESTONE** relative to shell routes; implement with **G3**.

#### Fixture vs Live

Fixture: synthetic address cards. Live: DB-backed library.

---

### 3.7 `/tasks`

#### User goal

See research tasks (queue, budget, partial/fail) and create **local demo** tasks in shell without network side effects.

#### First-screen fields

- Banner: shell tasks = fixture + local demo; **no Helius/GMGN/RPC** on create in shell  
- Create row: optional mint, **发起本地 demo 任务**  
- Table: Task ID, Input, Provider, Budget used/budget, Status, Start/End, Warnings, Output link, Failure  

Status enum: `queued` | `running` | `completed` | `partial` | `failed` | `blocked`  
**PARTIAL and FAILED remain first-class** — not remapped to success.

#### Secondary / expand fields

- Filters by status / provider  
- Request budget policies  
- Link to orchestrator logs (FUTURE)  

#### Data sources

Task metadata is control-plane; task **outputs** may attach Tier-A/B scan artifacts with their own provenance.

#### Required APIs

| API | Status |
| --- | --- |
| `listTasks()` | **Current main** |
| `createLocalDemoTask(mint)` | **Current main** (local only) |
| `getTask(taskId)` | **Current main** (for detail route) |
| FUTURE: real orchestrator create/cancel | G4 `RESEARCH-TASK-ORCHESTRATOR-MVP` |

#### Loading / empty / error

| State | UI |
| --- | --- |
| Loading | load table |
| Empty | “暂无任务” + create CTA |
| Create note | confirm **no network** in shell |

#### Primary action

- Create demo task; open output link when present  

#### Prohibited behaviors

- Implying live provider spend on demo create  
- Auto-cron from this page without Owner gate  
- Hiding failed/partial rows  

#### Milestone

**G1 shell** demo/fixture. **G4** real orchestration.

#### Fixture vs Live

| Fixture | Live |
| --- | --- |
| Static + localStorage demo tasks | Bounded live jobs with budget and watermarks |

---

### 3.8 `/tasks/:taskId`

#### User goal

Audit one run: inputs, budget, timeline, warnings, failure reason, output artifact links—for accountability and replay entry.

#### First-screen fields

- taskId, status badge (text)  
- input (mint, etc.)  
- provider  
- requestsUsed / requestBudget  
- startedAt / endedAt  
- warnings[]  
- failureReason  
- outputLink → `/ca/:mint` or artifact  
- mode: fixture vs live  

#### Secondary / expand fields

- Step log / provider call list (FUTURE)  
- Source degradation notes  
- Replay pin (hashes, rule versions)  
- Cancel / retry (FUTURE, policy-bound)  

#### Data sources

Control-plane + linked scan provenance (Tier-A/B as on artifact).

#### Required APIs

| API | Status |
| --- | --- |
| `getTask(taskId)` | **Current main** interface; **route NOT_WIRED** in shell `App.tsx` (list only today) |
| FUTURE: `getTaskSteps(taskId)` | G4 |
| FUTURE: `retryTask` / `cancelTask` | G4 + Owner policy |

#### Loading / empty / error

| State | UI |
| --- | --- |
| Loading | standard |
| Not found | empty + back to `/tasks` |
| Failed task | show failureReason prominently — not a soft success |

#### Primary action

- Open output; copy taskId for audit  

#### Prohibited behaviors

- Silent retry storms  
- Displaying incomplete output as COMPLETE  
- Live calls from “view” in fixture mode  

#### Milestone

IA **G1** (detail page should land with shell completion); full orchestrator **G4**. Route currently **NOT_WIRED** in shell router until implemented.

#### Fixture vs Live

Fixture task JSON vs live run registry.

---

### 3.9 `/watchlist`

#### User goal

Maintain operator-curated list of mints/wallets to re-open quickly; not a social feed.

#### First-screen fields

- Table: entity type (CA/wallet), id, note, lastObservedAt, last trust strip summary (3–5 domain chips if CA), link  
- Add by mint / address  
- FUTURE: last task status  

#### Secondary / expand fields

- Groups / tags  
- Alert thresholds (Owner-gated; not default)  

#### Data sources

Local operator prefs first; optional library join. No Tier promotion.

#### Required APIs

| API | Status |
| --- | --- |
| FUTURE: `listWatchlist` / `addWatch` / `removeWatch` | **NOT_WIRED · FUTURE_MILESTONE** |

#### Loading / empty / error

Empty: “观察列表为空 — 从 CA 详情加入”. Error: no fake watches.

#### Primary action

- Add/remove; open entity  

#### Prohibited behaviors

- Auto-discovery feed  
- Push-trading alerts as core  
- Emoji “hot” ranking  

#### Milestone

**NOT_WIRED · G2+**

#### Fixture vs Live

Fixture empty or sample watches; live = user store.

---

### 3.10 `/schedules`

#### User goal

View/configure **Owner-gated** schedules (e.g. macro or approved batch)—not free-form infinite cron.

#### First-screen fields

- Banner: schedules are restricted; many automations PARKED  
- Table: schedule id, job type, cadence, enabled, last run status (incl. partial/fail), next run  
- Link to last task  

#### Secondary / expand fields

- Edit cadence (Owner only)  
- Disable switch  
- Budget caps  

#### Data sources

Control-plane; job outputs carry their own Tier-A/B.

#### Required APIs

| API | Status |
| --- | --- |
| FUTURE: schedule registry APIs | **NOT_WIRED · FUTURE_MILESTONE · Owner-gated** |

#### Loading / empty / error

Empty: “无已授权调度”. Never invent enabled crons.

#### Primary action

- Inspect last run; disable if policy allows  

#### Prohibited behaviors

- Enabling auto discovery / full wallet re-scrape without Owner  
- Hidden background loops  
- “Set and forget” trading bots  

#### Milestone

**NOT_WIRED**; align with execution plan PARKED items (cron, auto discovery).

#### Fixture vs Live

Fixture: empty or disabled examples. Live: explicit authorization.

---

### 3.11 `/replay`

#### User goal

Re-evaluate or inspect a CA/wallet judgment **as-of** pinned watermarks and rule versions—research integrity, not chart replay candy.

#### First-screen fields

- Inputs: mint or taskId or fixture id; `asOf` timestamp; ruleVersion pin  
- Comparison strip: current vs as-of domain gates  
- Table of metrics with num/denom/ratio/status under both pins  
- Evidence diff summary  

#### Secondary / expand fields

- Harness case id  
- Byte-level artifact hashes  
- Parser version / rule version matrix  

#### Data sources

Pinned snapshots (fixture / stored Tier-A). Tier-B historical only if recorded; never invent.

#### Required APIs

| API | Status |
| --- | --- |
| FUTURE: `replayCaScan({ mint, asOf, ruleVersion })` | **NOT_WIRED · FUTURE_MILESTONE** |
| Harness suite `replay` | Research/engineering, not necessarily UI |

#### Loading / empty / error

Missing pin → block with “需要 watermark / fixture pin”. Partial replay → PARTIAL visible.

#### Primary action

- Run replay; open evidence diff  

#### Prohibited behaviors

- Replay without pins  
- Silencing differences  
- Using live market mid-replay as historical fact  

#### Milestone

**NOT_WIRED · G2+** (UI). Harness replay exists as engineering path separately.

#### Fixture vs Live

Fixture-first; live as-of only with stored watermarks.

---

### 3.12 `/liquidity`

#### User goal

Monitor liquidity / macro waterlines relevant to research (pair depth, regime)—**not** a DEX aggregator UI.

#### First-screen fields

- Scope banner: research board; Tier-B market enrichment unless stated  
- Table/panels: pair or macro metrics with observedAt, source, verificationStatus  
- Completeness / degraded flags  
- Link to related CA when pair→mint known  

#### Secondary / expand fields

- Time series (FUTURE)  
- Reconciliation notes (e.g. Dune vs DEX — macro workstream)  
- Thresholds for manual attention  

#### Data sources

Primarily **Tier-B** market/macro; on-chain vault balances if later Tier-A path exists must be labeled separately.

#### Required APIs

| API | Status |
| --- | --- |
| FUTURE: liquidity dashboard APIs | G7 `MACRO-LIQUIDITY-DASHBOARD-MVP` · **G2+** |
| Macro daily / Dune paths | Separate workstream; do not silently merge into CA card as chain fact |

#### Loading / empty / error

Degraded source → PARTIAL board, not empty zeros as “no liquidity risk”.

#### Primary action

- Inspect waterline + open linked CA  

#### Prohibited behaviors

- Trade CTA / swap route  
- Treating USD price as mint supply truth  
- Neon “liquidity score” without sources  

#### Milestone

**NOT_WIRED** in shell; **G7**

#### Fixture vs Live

Fixture sample series; live macro collectors when authorized.

---

### 3.13 `/settings`

#### User goal

See and (later) configure console mode: data source, display density, feature flags—without exposing secrets.

#### First-screen fields

- Data source mode: fixture | http  
- `live` boolean + note (from `getDataSourceMeta()`)  
- Build / shell version chip  
- Display: density, timezone (FUTURE)  
- Feature flags: show FUTURE panels yes/no  
- Privacy: demo store reset  

#### Secondary / expand fields

- HTTP base URL (when Owner configures; never commit secrets)  
- Request budget defaults (FUTURE)  
- Danger zone: clear localStorage demo  

#### Data sources

Local config only; no chain.

#### Required APIs

| API | Status |
| --- | --- |
| `getDataSourceMeta()` | **Current main** (shown in topbar today) |
| FUTURE: settings persistence | G1 late / G2 |
| **Never** | API keys in repo or readable settings dump |

#### Loading / empty / error

N/A heavy; misconfigured HTTP → explicit `not_configured`.

#### Primary action

- Read mode; reset demo store; toggle FUTURE panel visibility  

#### Prohibited behaviors

- Pasting secrets into settings that get logged  
- Enabling live providers without Owner path  
- Dark-pattern “live by default”  

#### Milestone

**G1** read-only meta can ship early; full page **G1 late / G2**. Route **NOT_WIRED** in shell router today.

#### Fixture vs Live

Settings controls which mode; does not itself fetch market data.

---

## 4. Cross-route trust rules (binding)

1. **Five domains on CA detail stay independent** — no average score.  
2. **`null ≠ 0`**: ratios and residual ratios use `暂不可确认` when null.  
3. **`PARTIAL ≠ SUCCESS`**: status text must say PARTIAL; color is secondary.  
4. **`accountingEligible` does not imply `concentrationEligible`.**  
5. **Tier-B + confirmed is invalid** on any label/metric.  
6. **Wallet pools**: usable / shortlist / manual review only — not smart money.  
7. **Color never sole semantic**: every badge has a readable label.  
8. **FUTURE panels** on CA detail must show `NOT_WIRED · FUTURE_MILESTONE · NO_LIVE_DATA`.  
9. **No trade CTAs** on any route.  
10. **No emoji status.**  

---

## 5. Shell vs target matrix (summary)

| Route | Shell router today | Milestone | Fixture | Live |
| --- | --- | --- | --- | --- |
| `/ca` | Yes | G1 | Yes | Wiring later |
| `/ca/:mint` | Yes | G1 (+ FUTURE panels marked) | Yes | G1+ |
| `/wallets` | Yes | G1 | Yes | G2+ controlled |
| `/wallets/:id` | Yes | G1 | Yes | G2+ |
| `/addresses` | Yes | G1 demo | Yes | G3 |
| `/addresses/:id` | No | G3 · NOT_WIRED | Planned | Planned |
| `/tasks` | Yes | G1 demo | Yes | G4 |
| `/tasks/:taskId` | No | G1 complete / G4 · NOT_WIRED route | Interface exists | G4 |
| `/watchlist` | No | G2+ · NOT_WIRED | — | — |
| `/schedules` | No | Owner-gated · NOT_WIRED | — | — |
| `/replay` | No | G2+ · NOT_WIRED | Harness-first | Watermarked only |
| `/liquidity` | No | G7 · NOT_WIRED | — | Macro path |
| `/settings` | No | G1 late · NOT_WIRED | Meta in topbar | HTTP config |

---

## 6. `/ca/:mint` acceptance checklist (IA)

Use this as UX/audit checklist for the primary card:

- [ ] Sticky header with mint, status, watermarks, source mode  
- [ ] Trust Strip shows **five** domains separately: Accounting, Exclusion Coverage, Concentration, Market Data, Wallet Intelligence  
- [ ] Holder universes counts + residual + pagination  
- [ ] Concentration table: numerator, denominator, ratio (`暂不可确认` if null), status  
- [ ] Ineligible concentration banner when `!concentrationEligible`  
- [ ] Data quality issues table  
- [ ] Address hits region (empty/FUTURE allowed, not omitted forever without label)  
- [ ] Evidence drawer  
- [ ] Dev / Early Buyer / Cluster / Cross-CA / Replay placeholders marked **NOT_WIRED · FUTURE_MILESTONE · NO_LIVE_DATA**  
- [ ] No trade CTA, no emoji, no single risk score  
- [ ] Color not sole semantic  

---

## 7. API extension backlog (FUTURE contract sketches)

Non-binding names for implementers; real tasks must still declare write sets.

```text
// G1 complete
getTask(taskId) → route /tasks/:taskId

// G3
getAddress(id)
listAddressHitsForMint(mint)
listAddressCaHits(addressId)
listWatchlist / addWatch / removeWatch

// G1 live CA
enqueueCaScan(mint) → taskId
getCaScanLive(mint) // still returns same trust fields

// G4
createResearchTask(spec)
getTaskSteps(taskId)
cancelTask / retryTask

// G7
getLiquidityBoard(scope)

// Replay
replayCaScan({ mint, asOf, ruleVersions })

// Settings
getConsoleSettings / updateConsoleSettings // no secrets
```

All extensions **preserve** `accountingEligible`, `exclusionCoverage`, `concentrationEligible` on CA payloads and Tier-B wallet disclaimers.

---

## 8. Document control

| Field | Value |
| --- | --- |
| Version | V2 |
| Path | `docs/product/OPERATOR_CONSOLE_INFORMATION_ARCHITECTURE_V2.md` |
| Aligns with | Positioning V1, Data Source V1, CA Scan Response V1, main shell types/pages |
| Shell path param note | Wallet detail param is `walletId` in code; IA uses `:id` as product alias for `/wallets/:id` |
