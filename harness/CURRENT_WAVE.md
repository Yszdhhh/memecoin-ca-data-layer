# Current wave

## Objective

Run public-CA holder stability batches on the full product path
(`SOL-CA-HOLDER-STABILITY-BATCHES-001`). Operator Console Live Wiring is merged
(PR #8). Wallet GMGN full re-fetch and cumulative PnL remain parked. Do **not**
start Observability baseline or G2 market/authority work early.

## Status as of 2026-08-01 (Live Wiring merged + G1 Stability ACTIVE)

| Workstream | Status | Notes |
| --- | --- | --- |
| M0 CA cleaning pilot | DONE / GREEN / MERGED | PR #4 |
| **OPERATOR-CONSOLE-SHELL-001** (Console Shell) | DONE / GREEN / MERGED | PR #6; merge `5cc414c` |
| **SOL-CA-HOLDER-HOTPATH-INTEGRATION-001** (Holder Hotpath / G0) | DONE / GREEN / MERGED | PR #7; merge `ae60368`; independent audit GREEN |
| Hotpath Live smoke | 2 public CA / 11 total Helius HTTP requests | Historical implementer smoke; accepted in audit package |
| **OPERATOR-CONSOLE-LIVE-WIRING-001** | DONE / GREEN / MERGED | PR #8; merge `22826bc`; audit tip `caa7a03`; implementation tip `52dfc96` |
| Browser Live smoke | 1 public CA / 6 of 10 Helius requests | browserDirectHelius=0; credential exposure=0 |
| Auditor re-smoke | provider_shape_drift after 1 request | P2 for Stability measurement; not a merge blocker |
| G0 | DONE | Shell + Holder Hotpath + Live Wiring on main |
| Main integration gates | CRITICAL PASS | typecheck/test/build/console/security PASS; harness:doctor FAIL pre-existing wallets.json P2 |
| **SOL-CA-HOLDER-STABILITY-BATCHES-001** | ACTIVE | 20–30 public CA executions; shape-drift measurement; fail-closed trust |

## ACTIVE

```text
SOL-CA-HOLDER-STABILITY-BATCHES-001
```

## NEXT

```text
OBSERVABILITY-BASELINE-001
```

(Owner-gated; only after Stability GREEN for independent audit. Do **not** start early.)

## AFTER

```text
MARKET-CONTEXT-ADAPTER-001
```

## Overall

```text
CONTINUE_HOLDER_STABILITY_BATCHES
Live Wiring MERGED (PR #8)
M0 / Console Shell / Holder Hotpath / Live Wiring = DONE / GREEN / MERGED
G0 = DONE
Overall ≠ Stability GREEN_FOR_INDEPENDENT_AUDIT yet
Overall ≠ G2–G8 completed
Overall ≠ research prototype in production
Overall ≠ wallets chain-verified
```

## DONE

```text
OPERATOR-CONSOLE-LIVE-WIRING-001
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

## Retained smoke evidence

```text
Hotpath smoke = 2 public CA / 11 Helius requests
Browser Live smoke = 1 public CA / 6 of 10 requests
Auditor re-smoke = provider_shape_drift after 1 request
```

## Authority docs

| Doc | Path |
| --- | --- |
| System status | `docs/handoffs/STATUS_SYSTEM_20260730.md` |
| Plan | `docs/handoffs/NEXT_STAGE_EXECUTION_PLAN_20260730.md` |
| Console DS | `docs/contracts/OPERATOR_CONSOLE_DATA_SOURCE_V1.md` |
| CA Holder API | `docs/contracts/OPERATOR_CA_HOLDER_API_V1.md` |
| Access layer | `docs/architecture/OPERATOR_CONSOLE_ACCESS_LAYER_CLARIFICATION.md` |
| Goal blueprint | `docs/blueprints/GOAL_EXECUTION_BLUEPRINT_V1.md` |
| Live Wiring audit | `harness/reports/OPERATOR-CONSOLE-LIVE-WIRING-001-AUDIT-001/` |
| Hotpath audit | `harness/reports/SOL-CA-HOLDER-HOTPATH-INTEGRATION-001-AUDIT-001/` |
