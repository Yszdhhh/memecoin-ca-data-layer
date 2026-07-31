# Current wave

## Objective

Operator Console Shell is **merged**. Deliver CA holder hotpath Operator API
(G0) with accurate per-HTTP provider accounting and loopback security.
Wallet GMGN full re-fetch and cumulative PnL remain parked.

## Status as of 2026-07-31 (Hotpath repair + Live smoke)

| Workstream | Status | Notes |
| --- | --- | --- |
| M0 CA cleaning pilot | DONE / GREEN / MERGED | PR #4 |
| **OPERATOR-CONSOLE-SHELL-001** | DONE / **MERGED** | PR #6; merge `5cc414c` |
| **SOL-CA-HOLDER-HOTPATH-INTEGRATION-001** | Offline **GREEN**; Live smoke **executed**; overall awaiting **independent audit** | PR #7 |
| Hotpath offline | GREEN | Provider HTTP accounting + loopback browser-origin protection |
| Hotpath Live | Bounded smoke executed (≤20 total requests) | Not merge-GREEN until independent audit |

## ACTIVE

```text
SOL-CA-HOLDER-HOTPATH-INTEGRATION-001 (independent audit gate)
```

## Overall

```text
CONTINUE_G0
Overall ≠ G0–G8 completed
Overall ≠ Live Wiring done
Overall ≠ Stability ready
Implementer tip ready for independent audit (not self-merge-GREEN)
```

## DONE

```text
OPERATOR-CONSOLE-SHELL-001
M0-CA-CLEANING-MAIN-INTEGRATION-001
```

## NEXT (after Hotpath merge + independent audit GREEN)

```text
OPERATOR-CONSOLE-LIVE-WIRING-001
```

Do **not** start Stability Batch until Live Wiring is complete.

## PARKED

* 全量 1,433 重抓
* 全量累计 PnL
* 自动发现
* cron
* BSC
* 完整 SOL-E2E
* G2–G8 offline product surfaces (not part of this Hotpath PR)

## Authority docs

| Doc | Path |
| --- | --- |
| System status | `docs/handoffs/STATUS_SYSTEM_20260730.md` |
| Plan | `docs/handoffs/NEXT_STAGE_EXECUTION_PLAN_20260730.md` |
| Console DS | `docs/contracts/OPERATOR_CONSOLE_DATA_SOURCE_V1.md` |
| CA Holder API | `docs/contracts/OPERATOR_CA_HOLDER_API_V1.md` |
| Access layer | `docs/architecture/OPERATOR_CONSOLE_ACCESS_LAYER_CLARIFICATION.md` |
| Goal blueprint | `docs/blueprints/GOAL_EXECUTION_BLUEPRINT_V1.md` |
