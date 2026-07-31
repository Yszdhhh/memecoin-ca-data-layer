# OPERATOR_CONSOLE_RESEARCH_EXECUTIVE_SUMMARY_20260731

**Task:** `OPERATOR-CONSOLE-PRODUCT-RESEARCH-AND-UX-SPEC-001` (aligned post-Hotpath)  
**Hotpath merge SHA:** `ae60368bcd82ebc3fb9f2655dd82f6d079158401` (PR #7)  
**Research source commit:** `942d00ccedda822955d5f6e1237d845f2962a894`  
**Live Wiring base:** `feature/operator-console-live-wiring-001`  
**Access date:** 2026-07-31  
**Live Provider / paid / private wallet reads during research:** 0  

This summary answers the seven Owner questions. Content aligned to binding G0–G8 after Hotpath merge. Detailed evidence lives in sibling research/product docs and the offline prototype.

---

## Binding G0–G8 map

```text
G0: Console Shell + Holder Hotpath + bounded Live + merge   [DONE]
G1: OPERATOR-CONSOLE-LIVE-WIRING-001 + Stability Batches + Observability
G2: CA Analysis Core v1
G3: Address Intelligence Store
G4: Controlled Orchestration
G5: Wallet Ledger / PnL
G6: advanced CA intelligence
G7: Liquidity Dashboard
G8: Replay / Calibration / Alerts / Security / Local Release
```

Adoption language: **ADOPT_UI_PATTERN_NOW** (UI/IA) vs **IMPLEMENT_IN_G<n>** (implementation lane). Never read research ADOPT as “wire paid providers now.”

---
## 1. Five designs most worth adopting (ADOPT_UI_PATTERN_NOW)

1. **Split trust strip, not one health score** — Always show Accounting / Exclusion Coverage / Concentration / Market Data / Wallet Intelligence as independent cells with status + one-line reason + warning count + observedAt. Borrowed from our M0 pilot semantics and extended beyond shell’s three gates.  
2. **RatioMetric honesty** — Always show numerator, denominator, ratio, verification, universe, warnings. When incomplete, ratio renders **不可确认 / 暂不可确认**, never `0%`. Already proven in shell `formatRatio` and reinforced in prototype.  
3. **DexScreener-style multi-pool awareness as Tier-B** — Primary pair is a *clue* with source + observedAt + boost/paid exposure hint; never used as pool-exclusion proof. Official free pair APIs are project-usable for enrichment (Owner may still gate volume).  
4. **Task lifecycle as first-class object** — Distinct states for credential blocked, budget exhausted, partial, stale, schema fail-closed; retry creates a **new run** with lineage. Mirrors research work, not a single spinner.  
5. **Address library as long-term asset chrome** — Tags carry source, confidence, verification, rule/version notes; Tier-B pool vs shortlist vs manual review vs on-chain verified are permanently labeled. Pattern abstracted from Nansen/Arkham *label provenance*, not their paywalled graphs.

---

## 2. Five designs to reject (REJECT)

1. **Trade / Copy-Trade / Swap primary CTAs** on research surfaces (GMGN / Photon / BullX / Axiom pattern).  
2. **Opaque composite “rug score” or “smart money count”** as the hero metric without evidence drill-down (Rugcheck score-as-traffic-light misuse; GMGN “N smart money” headlines).  
3. **Promoting third-party labels to confirmed conclusions** (GMGN/Birdeye/Nansen “Smart Money/Insider/Bundler” as truth).  
4. **Third-party Top10 / bubble cluster share overriding local holder universe** (Bubblemaps/GMGN concentration as chain fact).  
5. **Neon trading-terminal density that hides PARTIAL/ERROR** — success-colored partials, null-as-zero, emoji-only status.

---

## 3. G1 Live Wiring — minimum frontend loop

Pages: `/ca` (input + list), `/ca/:mint` (detail + Trust Strip + concentration + quality), `/tasks`, `/tasks/:taskId`.

Loop:

```text
IDLE → validate mint → POST ca-holder-tasks → poll task
  → PARTIAL (show facts, block confirmed concentration)
  → SUCCEEDED | FAILED | BLOCKED_CREDENTIAL | BUDGET_EXHAUSTED
  → open evidence (ruleVersion, watermark, warnings)
  → retry = new run + lineage
```

Components minimum: TrustStrip, ConcentrationTable, TaskLifecycle, TaskBudgetMeter, PartialBanner, BlockedState, StaleBanner, SchemaErrorBoundary, FixtureLiveIndicator, EvidenceDrawer.

Shell today: fixture-only data source; HTTP scaffold `not_configured`. Live wiring must not touch browser provider keys.

---

## 4. Component boundaries to reserve (G1 / G3 / G4 / G6 / G8)

| Milestone | Reserve in IA / contracts now | Do not implement now |
| --- | --- | --- |
| G1 Stability Batches | DataQualityTable severity + manual review queue | Auto reprocess all history before Live Wiring |
| G3 Address Intelligence | Address Library CRUD chrome, version history, watchlist link | Full cluster graph productization |
| G4 Orchestration | Schedules page placeholder, budget policies | Cron in production |
| G6 advanced CA intelligence | judgment / cluster / funding panels as NOT_WIRED | Confirmed cluster-as-truth UX |
| G8 Replay | Replay route, as-of EvidenceDrawer fields | Magic-node UX as truth |

Placeholders must remain labeled `NOT_WIRED · FUTURE_MILESTONE · NO_LIVE_DATA`.

---

## 5. Real differentiation vs competitors

Not “more fields than GMGN.” Differentiation is:

- **Trust decomposition** users can audit when domains disagree.  
- **Local deterministic reconstruction** after Helius reads (pagination, conservation, exclusion coverage) before any “confirmed.”  
- **Replayable evidence + ruleVersion** — cognitive asset, not a screenshot.  
- **Address memory across CA** (direction of product), with Tier-B never rebranded as Alpha/smart money.  
- **Research workflow UI** that coexists with GMGN: paste CA here to *re-verify*; trade elsewhere.

Users keep GMGN open for speed/market heat; they open this console when they need to know whether concentration is actually eligible and what the warnings mean.

---

## 6. Owner Gates (external / paid / access)

| Gate | Item | Status |
| --- | --- | --- |
| OG-1 | Helius key for Live CA holder path | Runtime env / DPAPI local — **bounded smoke already done** on Hotpath (not “smoke unrun”) |
| OG-2 | Birdeye API key / CU tiers | Paid; later Owner Gate; Tier-B only if ever wired |
| OG-3 | GMGN formal API / ToS | ACCESS constraints; labels remain Tier-B |
| OG-4 | Bubblemaps API partner terms | DESIGN_FOR_LATER / BENCHMARK_ONLY |
| OG-5 | Nansen / Arkham deep labels | Mostly ACCESS_BLOCKED without subscription |
| OG-6 | Hotsniper-class tools | ACCESS_BLOCKED / SOURCE_NOT_AUTHORITATIVE |
| OG-7 | Expanding beyond Helius-only live holder path | Explicit Owner decision |
| OG-8 | Cron / schedules / auto discovery | **Parked** |
| OG-9 | Stability batches | **Only after** Live Wiring GREEN |
| OG-10 | Console Live Wiring | **ACTIVE** — adapter + polling + result VM + states |

Research package made **no purchases, no login bypass, no credential requests**.

---

## 7. What must NOT be implemented now (this alignment commit)

- Production Live Wiring code in `apps/operator-console/**` is **next** on the Live Wiring branch — not part of alignment-only commit.  
- Hotpath backend edits (`src/application/operator-api/**`, provider-executor) unless confirmed API P1 + Owner Gate.  
- Trade execution, signing, copy-trade.  
- Confirmed smart-money branding from Tier-B pools.  
- Cluster graph as confirmed concentration.  
- Database writes, chainfm_out reads, private wallet inventories.  
- Claiming G0–G8 complete or Stability ready.  
- Claiming Console Live Wiring complete when only research is aligned.

---

## Bound doc gaps (recorded)

Post-Hotpath main **includes** (no longer missing):

- `docs/blueprints/GOAL_EXECUTION_BLUEPRINT_V1.md`
- `docs/architecture/OPERATOR_CONSOLE_ACCESS_LAYER_CLARIFICATION.md`
- `docs/contracts/OPERATOR_CA_HOLDER_API_V1.md`
- Hotpath reports + independent audit under `harness/reports/SOL-CA-HOLDER-HOTPATH-INTEGRATION-001*`

Still true: Console production path is fixture-only until Live Wiring.


---

## Deliverable index

| Path | Role |
| --- | --- |
| `docs/research/OPERATOR_CONSOLE_COMPETITOR_RESEARCH_20260731.md` | Competitor notes + adopt conclusions |
| `docs/research/PROVIDER_CAPABILITY_AND_TRUST_MATRIX_20260731.md` | Provider × capability matrix |
| `docs/research/OPERATOR_CONSOLE_RESEARCH_EXECUTIVE_SUMMARY_20260731.md` | This file |
| `docs/product/OPERATOR_CONSOLE_PRODUCT_POSITIONING_V1.md` | Positioning |
| `docs/product/OPERATOR_CONSOLE_INFORMATION_ARCHITECTURE_V2.md` | Full route IA |
| `docs/product/OPERATOR_CONSOLE_UI_STATE_MACHINE_V1.md` | Lifecycle + Mermaid |
| `docs/product/OPERATOR_CONSOLE_COMPONENT_CONTRACTS_V1.md` | Component DTO contracts |
| `docs/product/OPERATOR_CONSOLE_API_UI_GAP_MATRIX_V1.md` | API ↔ UI gaps |
| `docs/product/OPERATOR_CONSOLE_CLICKTHROUGH_SPEC_V1.md` | Prototype click paths |
| `docs/prototypes/operator-console-v2/**` | Offline clickable prototype |

---

## Verdict (package)

**RESEARCH_ALIGNED_READY_FOR_LIVE_WIRING**

Hotpath is merged and audited GREEN. Research package is G0–G8-aligned. Next implementer step: production Console adapter under `OPERATOR-CONSOLE-LIVE-WIRING-001` (not Stability).
