# OPERATOR_CONSOLE_RESEARCH_942D00C_POST_HOTPATH_ALIGNMENT

**Status:** design input only (not production-binding until Live Wiring GREEN)  
**Research tip absorbed:** `942d00ccedda822955d5f6e1237d845f2962a894`  
**Absorb method:** merge into `feature/operator-console-live-wiring-001` (`c25ee24`)  
**Hotpath on main:** PR #7 merge `ae60368`; audited tip `5734591`  
**Date:** 2026-07-31

## Purpose

Correct research pack assumptions after Holder Hotpath landed on main. Research
docs and the offline prototype remain **design references**. They must not
overwrite Hotpath API truth, restore old M1–M5 maps as binding product status,
or ship G2–G8 offline implementations as production.

## 1. G0–G8 mapping (corrected)

| Gate | Meaning after Hotpath merge | Status |
| --- | --- | --- |
| **G0** | Shell + Holder Hotpath Operator API on main | **DONE** (Shell PR #6, Hotpath PR #7) |
| **G1** | Operator Console Live Wiring to loopback CA-holder API | **ACTIVE** (`OPERATOR-CONSOLE-LIVE-WIRING-001`) |
| **G2+** | Stability batches, observability, address/wallet/liquidity product surfaces | **NOT STARTED** — parked until G1 GREEN + Owner gates |

Deprecated research labels (do not use as authority):

| Old research tag | Corrected |
| --- | --- |
| M1-SHELL | G0-SHELL (done) |
| M2-HOTPATH | G0-HOTPATH (done) + G1-LIVE-WIRING (active); Stability is separate NEXT |
| M3-ADDR / M4-ORCH / M5-LIQ | Map to later Gx product gates only; **not** in G1 write-set |

**NEXT after G1 GREEN:** `SOL-CA-HOLDER-STABILITY-BATCHES-001`  
**AFTER:** `OBSERVABILITY-BASELINE-001`

## 2. Hotpath API truth (binding)

Loopback-only (`127.0.0.1`). Browser never holds `HELIUS_API_KEY`.

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/v1/health` | Liveness |
| POST | `/api/v1/ca-holder-tasks` | Create single-CA task `{ mint }` (+ optional idempotencyKey) |
| GET | `/api/v1/ca-holder-tasks/:taskId` | Task status / provider accounting |
| GET | `/api/v1/ca-holder-results/:taskId` | Scrubbed result summary |

Live gate: `OPERATOR_API_LIVE=1` + runtime env `HELIUS_API_KEY` on the **server**.
Without gate → `live_gate_disabled`. Missing credential → `status=blocked`,
`failureReason=credential_unavailable`, `providerRequestCount=0`.

## 3. `budget_exhausted = partial` (not failed)

When further HTTP would exceed task budget:

- `status = partial` (task + result)
- warning / reason includes `request_budget_exhausted`
- `providerBudgetExhausted = true`
- `accountingEligible = false`, `concentrationEligible = false`
- concentration `ratio = null` (UI must not render `0%`)
- incomplete pagination retained; no HTTP beyond hard budget

Exact-budget success remains `completed` with `providerBudgetExhausted=false`.

## 4. Success path (G1 happy path)

```text
Browser enters public Solana CA
→ POST /api/v1/ca-holder-tasks  (loopback; JSON only; no keys)
→ taskId
→ poll GET /api/v1/ca-holder-tasks/:taskId
→ when result ready: GET /api/v1/ca-holder-results/:taskId
→ map scrubbed summary → CA detail view (Accounting / Exclusion / Concentration split)
```

Console env for HTTP mode: `VITE_OPERATOR_API_BASE=http://127.0.0.1:8787`  
(Default without env remains fixture mode.)

## 5. Fixture vs Live watermark

| Mode | `dataSource` / watermark | Live flag |
| --- | --- | --- |
| Fixture | scrubbed pilot fixtures; `mode=fixture`, `live=false` | Never claims Live |
| HTTP Live | `sourceWatermark` from Operator API result; `mode=http`, `live=true` only when base URL configured and responses are from Operator API | Never invents fixture rows as Live |

UI must show an explicit fixture/live chip (Layout meta + page banners).

## 6. Owner Gate

- Stability / G2–G8 / 1,433-wallet bulk / PostgreSQL console path require explicit Owner gate after G1.
- Live smoke historical evidence: **2 public CA / 11 total Helius HTTP requests** (implementer smoke accepted in audit). Do not re-burn budget for launch status.
- Research prototype (`docs/prototypes/operator-console-v2`) is offline design — **not** production-bound.

## 7. API / UI gap (G1 slice only)

| Surface | G1 action |
| --- | --- |
| `/ca` | Mint input → create task / open detail; list = session tasks + optional fixture hybrid |
| `/ca/:mint` | Poll task + show result; trust badges split |
| `/tasks` | List tasks from Operator API session + create |
| `/tasks/:taskId` | Task detail + link to result CA |
| Wallets / Addresses / Watchlist / Schedules / Replay / Liquidity | **Out of G1** — remain fixture or nav-only; no new product backends |

Terminal states UI must eventually cover (implementation may start thin, expand on branch):

```text
completed | partial | failed | blocked(credential)
request_budget_exhausted | timeout | schema_error | empty | stale
queued | running
```

## 8. Hard non-goals for this branch

- Browser Helius key or direct Provider calls
- Stability batches
- Watchlist / Schedules / Replay / Liquidity
- PostgreSQL for console
- Reading 1,433 wallets as console hot path
- G2–G8 offline domain engines from research prototype
- Claiming wallets chain-verified or research prototype in production

## 9. Absorb evidence

```text
research commit: 942d00ccedda822955d5f6e1237d845f2962a894
merge on product branch: c25ee24 (Merge research/... into live-wiring)
paths: docs/product/*, docs/research/*, docs/prototypes/operator-console-v2/*
Hotpath API / src application paths: not overwritten by research merge
```
