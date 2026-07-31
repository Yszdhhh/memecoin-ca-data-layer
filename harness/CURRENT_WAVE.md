# Current wave

## Objective

Wire Operator Console shell to live CA holder hotpath Operator API
(`OPERATOR-CONSOLE-LIVE-WIRING-001`). Hotpath backend is merged; Console remains
fixture-first until Live Wiring GREEN. Wallet GMGN full re-fetch and cumulative
PnL remain parked. Do **not** start Stability.

## Status as of 2026-07-31 (Hotpath merged + G1 launch)

| Workstream | Status | Notes |
| --- | --- | --- |
| M0 CA cleaning pilot | DONE / GREEN / MERGED | PR #4 |
| **OPERATOR-CONSOLE-SHELL-001** | DONE / GREEN / MERGED | PR #6; merge `5cc414c` |
| **SOL-CA-HOLDER-HOTPATH-INTEGRATION-001** (G0) | DONE / GREEN / MERGED | PR #7; merge `ae60368`; independent audit GREEN |
| Hotpath Live smoke | 2 public CA / 11 total Helius HTTP requests | Historical implementer smoke; accepted in audit package |
| G0 | DONE | Shell + Holder Hotpath on main |
| Main integration gates | CRITICAL PASS | typecheck/test/build/console/security PASS; harness:doctor FAIL pre-existing wallets.json P2 |
| **OPERATOR-CONSOLE-LIVE-WIRING-001** | ACTIVE | Console → loopback Operator API; G1 only |

## ACTIVE

```text
OPERATOR-CONSOLE-LIVE-WIRING-001
```

## NEXT

```text
SOL-CA-HOLDER-STABILITY-BATCHES-001
```

(Owner-gated; only after Live Wiring GREEN. Do **not** start Stability early.)

## AFTER

```text
OBSERVABILITY-BASELINE-001
```

## Overall

```text
CONTINUE_LIVE_WIRING
Hotpath backend MERGED (PR #7)
G0 = DONE
Overall ≠ G2–G8 completed
Overall ≠ Live Wiring done
Overall ≠ Stability ready
Overall ≠ research prototype in production
Overall ≠ wallets chain-verified
```

## DONE

```text
SOL-CA-HOLDER-HOTPATH-INTEGRATION-001
OPERATOR-CONSOLE-SHELL-001
M0-CA-CLEANING-MAIN-INTEGRATION-001
G0
```

## PARKED

* 全量 1,433 重抓
* 全量累计 PnL
* 自动发现
* cron
* BSC
* 完整 SOL-E2E
* G2–G8 offline product surfaces (withdrawn from Hotpath; not in main product path)
* Watchlist / Schedules / Replay / Liquidity product surfaces
* PostgreSQL operational path for console
* Claiming research prototype is production-bound
* Claiming wallets are chain-verified

## Authority docs

| Doc | Path |
| --- | --- |
| System status | `docs/handoffs/STATUS_SYSTEM_20260730.md` |
| Plan | `docs/handoffs/NEXT_STAGE_EXECUTION_PLAN_20260730.md` |
| Console DS | `docs/contracts/OPERATOR_CONSOLE_DATA_SOURCE_V1.md` |
| CA Holder API | `docs/contracts/OPERATOR_CA_HOLDER_API_V1.md` |
| Access layer | `docs/architecture/OPERATOR_CONSOLE_ACCESS_LAYER_CLARIFICATION.md` |
| Goal blueprint | `docs/blueprints/GOAL_EXECUTION_BLUEPRINT_V1.md` |
| Hotpath audit | `harness/reports/SOL-CA-HOLDER-HOTPATH-INTEGRATION-001-AUDIT-001/` |
