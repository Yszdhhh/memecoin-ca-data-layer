# OPERATOR_CONSOLE_CLICKTHROUGH_SPEC_V1

**Task:** `OPERATOR-CONSOLE-PRODUCT-RESEARCH-AND-UX-SPEC-001`  
**Prototype path:** `docs/prototypes/operator-console-v2/`  
**Mode:** offline synthetic · Live Provider calls = 0  

---

## 1. How to open

| Method | Command / action |
| --- | --- |
| Double-click | Open `docs/prototypes/operator-console-v2/index.html` in a desktop browser |
| `file://` | Supported — plain scripts, no ES modules |
| Optional static server | `npx --yes serve docs/prototypes/operator-console-v2` |

On `file://`, a non-blocking hint banner explains offline mode. Core demo data never uses `fetch`.

---

## 2. Global chrome (always visible)

1. **Watermark:** `DESIGN PROTOTYPE / SYNTHETIC DATA` (fixed overlay + meta strip).
2. **Primary nav:** CA · Tasks · Wallets · Addresses · Watchlist · Schedules · Replay · Liquidity · Settings.
3. **State switcher:** `success | partial | credential blocked | budget exhausted | stale | schema error | empty`.
4. **Meta strip:** `mode=fixture · live=false` · five trust domain names · null-ratio rule · Tier-B rule.

**Prohibited CTAs anywhere:** Swap, Buy, Sell, Copy Trade, Snipe, Quick Buy.

---

## 3. Click paths (acceptance demos)

### Path A — CA list → CA detail (default partial)

| Step | Action | Expected |
| --- | --- | --- |
| A1 | Land on `#/ca` | CA table with BNUT / bulltom / DEMO rows; trust columns separate |
| A2 | Click BNUT symbol | Navigate `#/ca/<mint>` |
| A3 | Inspect Trust Strip | Five cells: Accounting, Exclusion Coverage, Concentration, Market Data, Wallet Intelligence — separate badges |
| A4 | Inspect Concentration | With sim=`partial`, every ratio shows **不可确认** (not `0%`); numerator/denominator still visible |
| A5 | Inspect Address hits | Tier-B rows include `unverified` / external observation wording |
| A6 | Click **Evidence drawer** | Side panel: source, tier, verification, observedAt, ruleVersion, watermark, warnings — no credential URL |
| A7 | Future placeholders | Dev / Early Buyer / Cluster / Cross-CA / Replay marked `NOT_WIRED · FUTURE_MILESTONE · NO_LIVE_DATA` |

### Path B — State switcher matrix

For each simulated state, stay on CA detail (or task detail for schema) and confirm banner + badges:

| State | UI must show | Must NOT show |
| --- | --- | --- |
| success | SUCCEEDED / concentration may be CONFIRMED only when scenario sets eligible | — |
| partial | PARTIAL banner; concentration UNVERIFIED; ratios 不可确认 | SUCCESS greenwash |
| credential blocked | BLOCKED_CREDENTIAL distinct copy | generic FAILED only |
| budget exhausted | BUDGET_EXHAUSTED; budget used==budget; incomplete pagination | complete / SUCCESS |
| stale | STALE_RESULT; old observedAt; stale watermark | “latest” without caveat |
| schema error | SCHEMA_ERROR fail-closed; no fake holder table | invented ratios |
| empty | EMPTY distinct from error | FAILED |

### Path C — Task center

| Step | Action | Expected |
| --- | --- | --- |
| C1 | Nav → Tasks | List with budget `used/budget`, status badges |
| C2 | Open `task_synth_001` | Task detail: failureReason, warnings, lineage JSON |
| C3 | Click Retry | Demo alert: new run + lineage parent (no live call) |
| C4 | Open result link | Returns to CA detail |

### Path D — Wallet detail

| Step | Action | Expected |
| --- | --- | --- |
| D1 | Nav → Wallets | Persistent banner: Tier-B observation · not confirmed smart money |
| D2 | Open wallet | Pool tier `tier_b_usable_pool` / `tier_b_shortlist`; labels show Tier-B unverified |

### Path E — Address library

| Step | Action | Expected |
| --- | --- | --- |
| E1 | Nav → Addresses | Tags, source, confidence, verification columns |
| E2 | Confirm local burn row may be `confirmed` only for local deterministic rules |

### Path F — Future routes

Watchlist / Schedules / Replay / Liquidity / Settings each show explicit `NOT_WIRED` placeholder (not empty error).

---

## 4. First 5 seconds (product intent mirrored in prototype)

1. Paste / select CA (list primary action).
2. See task status + Trust Strip before deep tables.
3. Immediately read: Accounting vs Exclusion vs Concentration (may disagree).
4. Market & wallet intel clearly Tier-B.
5. No trade button competing for attention.

---

## 5. Visual / a11y checklist

| Check | Spec |
| --- | --- |
| Width 1440 | Comfortable multi-column Trust Strip + tables |
| Width 1280 | Trust Strip wraps to 3 cols; usable |
| Width 768 | Single column; still readable; tables horizontal scroll |
| Keyboard | Tab to nav, select, buttons, table links |
| Color | Badges include text labels; not color-only |
| Long strings | mint / warning codes use mono + word-break |

---

## 6. Automated checks shipped with prototype

```bash
node docs/prototypes/operator-console-v2/lib/render-helpers.test.cjs
```

Asserts:

- `formatRatio(null)` → non-confirmable label (not `0%`)
- Tier-B display never `confirmed: true`
- Trade CTA detector flags Swap/Buy/Sell/Copy Trade
- Watermark exact string
- Five trust domain labels
- `BLOCKED_CREDENTIAL` badge distinct

---

## 7. Mapping to Live Wiring (next milestone, not this branch)

| Prototype control | Future live binding |
| --- | --- |
| State switcher | Task poll DTO status |
| Synthetic CA | `GET ca-holder-results/:taskId` |
| Create task button | `POST ca-holder-tasks` |
| Evidence drawer | evidence refs + ruleVersion + SHAs |
| FixtureLiveIndicator | `getDataSourceMeta()` |

No backend implementation on this research branch.

---

## 8. Decisions log (implementer)

| Decision | Choice | Why |
| --- | --- | --- |
| SPA vs multi-page HTML | Hash SPA single `index.html` | One watermark/state switcher; offline friendly |
| Module system | Classic scripts + `.cjs` helpers | `file://` works; Node tests work despite root `"type":"module"` |
| Default sim state | `partial` | Matches pilot reality (accounting OK, exclusion partial, ratio null) |
| Trade CTAs | Omitted entirely | Research terminal, not execution |
| Future modules | Visible placeholders with NOT_WIRED | Avoid synthetic data looking shipped |
