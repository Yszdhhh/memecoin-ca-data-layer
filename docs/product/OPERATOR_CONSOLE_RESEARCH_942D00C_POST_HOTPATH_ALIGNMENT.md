# OPERATOR_CONSOLE_RESEARCH_942D00C_POST_HOTPATH_ALIGNMENT

**Status:** design input only (not production-binding until Live Wiring GREEN)  
**Research tip absorbed:** `942d00ccedda822955d5f6e1237d845f2962a894`  
**Absorb method:** merge `--no-ff` into `feature/operator-console-live-wiring-001`  
**Research merge commit:** see git log for `Merge research/operator-console-product-research-ux-spec-001`  
**Hotpath on main:** PR #7 merge `ae60368bcd82ebc3fb9f2655dd82f6d079158401`  
**Audited tip (pre-merge feature):** `57345911d54f132664c41753cd371d12c1166353`  
**Date:** 2026-07-31

## Purpose

Correct research pack assumptions after Holder Hotpath landed on main. Research
docs and the offline prototype remain **design references**. They must not
overwrite Hotpath API truth, restore self-made M-lanes as binding product status,
or ship G2–G8 product surfaces as production during Live Wiring.

## 1. G0–G8 mapping (binding)

```text
G0: Console Shell + Holder Hotpath + bounded Live + merge   [DONE — PR #6 / #7]
G1: OPERATOR-CONSOLE-LIVE-WIRING-001 + Stability Batches + Observability
G2: CA Analysis Core v1
G3: Address Intelligence Store
G4: Controlled Orchestration
G5: Wallet Ledger / PnL
G6: advanced CA intelligence
G7: Liquidity Dashboard
G8: Replay / Calibration / Alerts / Security / Local Release
```

| Deprecated research tag | Corrected |
| --- | --- |
| M1-SHELL | G0-SHELL (done) |
| M2-HOTPATH | G0-HOTPATH (done) + G1-LIVE-WIRING (active) |
| M2 stability / “G2 stability” | G1 Stability (after Live Wiring) |
| “G5 task orchestrator” | G4 Orchestration |
| “G6 replay” | G8 Replay; G6 = advanced CA intelligence only |
| M3-ADDR / M4-ORCH / M5-LIQ | G3 / G4 / G7 |
| bare `ADOPT_NOW` | `ADOPT_UI_PATTERN_NOW` vs `IMPLEMENT_IN_G<n>` |

**ACTIVE:** `OPERATOR-CONSOLE-LIVE-WIRING-001`  
**NEXT after G1 Live Wiring GREEN:** Stability batches (still G1 lane) — not G2 product core.

## 2. Hotpath API truth (binding)

Loopback-only (`127.0.0.1`). Browser never holds `HELIUS_API_KEY`.

| Method | Path | Backend on main | Console wiring |
| --- | --- | --- | --- |
| GET | `/api/v1/health` | **implemented** | not wired |
| POST | `/api/v1/ca-holder-tasks` | **implemented** | not wired |
| GET | `/api/v1/ca-holder-tasks/:taskId` | **implemented** | not wired |
| GET | `/api/v1/ca-holder-results/:taskId` | **implemented** | not wired |

```text
API Live exists  ≠  Console Live Wiring complete
Backend endpoint = implemented
Production Console HTTP wiring = not implemented
Browser Live path = not wired
Current next gap = adapter + polling + result VM + states
```

Never write “endpoints missing on main” for the four routes above.

## 3. Owner Gate refresh

| Gate | Status |
| --- | --- |
| Helius bounded smoke | **Done** and merged with PR #7 (`ae60368`) |
| Runtime HELIUS_API_KEY | Local runtime / security boundary (not “G0 smoke unrun”) |
| Paid Birdeye / GMGN / Bubblemaps | Later Owner Gate |
| Stability | **Only after** Live Wiring GREEN |
| Schedules / cron / auto-discovery | **Parked** |

## 4. Prototype semantic fixes (aligned)

| Topic | Contract |
| --- | --- |
| Budget exhaust | `status=partial` + `failureReason=request_budget_exhausted` + `providerBudgetExhausted=true` + pagination/accounting/concentration ineligible + ratio null; UI banner `BUDGET_EXHAUSTED` |
| Success scenario | Title and data agree: accounting complete, exclusion complete, concentration eligible |
| Watermark | `DESIGN PROTOTYPE / SYNTHETIC + SCRUBBED PUBLIC FIXTURE` |
| Status map | Backend `queued|running|completed|partial|failed|blocked`; UI derived from status+failureReason+warnings |

Research strengths retained: five-domain Trust Strip, ratio-null non-confirmable, Tier-B unverified, Evidence Drawer, task lineage, fixture/live indicator, NOT_WIRED, no trade CTA, provider matrix, clickable offline prototype.

## 5. Tests

```bash
node docs/prototypes/operator-console-v2/lib/render-helpers.test.cjs
```

## 6. Production code during alignment

```text
Production code changed during alignment: 0
(apps/operator-console/** and Hotpath src/** untouched)
```

## Verdict

```text
RESEARCH_ALIGNED_READY_FOR_LIVE_WIRING
```
