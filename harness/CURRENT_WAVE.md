# Current wave

## Objective

M0 CA cleaning pilot is **merged to main**. Deliver the Operator Console shell
next, then a bounded CA holder hotpath. Wallet GMGN full re-fetch and
cumulative PnL remain parked.

## Status as of 2026-07-30 (post-M0 merge)

| Workstream | Status | Notes |
| --- | --- | --- |
| Historical Waves A–D | DONE, prior audits | Not reopened. |
| Wallet 1433 GMGN 7d/30d full pull | DONE | Local `chainfm_out` only; not in Git. |
| Clean-rank + Repair-003 offline replay | DONE | Alpha=0; Tier-B usable pool ~1370; shortlist 8 + review 9. |
| SOL-CA-REAL-DATA-CLEANING-PILOT-001 | DONE / **MERGED** | 6 public CA; 3 OK / 3 PARTIAL scrubbed evidence. |
| SOL-CA-REAL-DATA-CLEANING-PILOT-AUDIT-001 | DONE / REQUEST_CHANGES | Superseded by repair + REPAIR-AUDIT-002. |
| SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-002 | DONE / **MERGED** | Pin `a1d56da`. |
| SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-AUDIT-002 | DONE / **GREEN** | Pin `a1d56da`. |
| **M0-CA-CLEANING-MAIN-INTEGRATION-001** | DONE / **GREEN** | PR #4 merge commit `2976316`; report `e8929a6`. |

## M0 integration (authoritative)

```text
M0：DONE / GREEN / MERGED

PR：#4
Merge commit：2976316e3853e377eff112484f9817ac2e1eba57
Main integration report：e8929a61262f2c32924ede3b7ba6067bc1d15b79
Audited implementation pin：a1d56dade268d24a1205e010581b6f6c478ac1bb
```

## ACTIVE (primary task)

```text
OPERATOR-CONSOLE-SHELL-001
```

Goal: first browser-operable shell (fixtures / desensitized data allowed).
Do **not** require full Live Provider wiring for shell acceptance.

`OPERATOR-CONSOLE-SHELL-001` is **M1 Operator Console MVP phase 1**.

## NEXT

```text
SOL-CA-HOLDER-HOTPATH-INTEGRATION-001
```

Then (after hotpath + Owner gates): stability batches 001–003,
`ADDRESS-INTELLIGENCE-LOCAL-STORE-MVP-001`, task orchestrator, liquidity dashboard.

## PARKED

* 全量 1,433 重抓
* 全量累计 PnL
* GMGN signed holdings 私有路径
* 自动发现
* cron
* BSC
* 完整 SOL-E2E
* 为产生 Alpha 数量放宽 Repair-003
* 无限新增 Harness 微任务

## Still blocked (not M0 — product/Owner gates)

* 真实 CA Web live Provider 接线（shell 可用 fixtures 先做）
* CA stability Live batches without hotpath readiness
* Production database deploy
* Confirmed smart-money branding without on-chain review

## Owner gates already applied

- Helius-only for CA holder live path until a new Owner decision.
- Manual CA selection only; no automatic discovery.
- DPAPI secrets and private wallet tables stay local.
- Do not brand Tier-B usable pool as smart money / Alpha / verified winners.
- Concentration remains unverified while exclusion coverage is partial.
- M0 merge complete; do **not** re-run M0 audit/integration unless regression.

## Next execution gate

1. Dispatch and implement **`OPERATOR-CONSOLE-SHELL-001`**.
2. Then **`SOL-CA-HOLDER-HOTPATH-INTEGRATION-001`**.
3. Do not re-open M0 merge or full 1433 re-fetch.

## Authority docs

| Doc | Path |
| --- | --- |
| System status | `docs/handoffs/STATUS_SYSTEM_20260730.md` |
| Next-stage plan (unique) | `docs/handoffs/NEXT_STAGE_EXECUTION_PLAN_20260730.md` |
| Local paths | `docs/LOCAL_WORKSPACE_PATHS.md` |
| M0 integration report | `harness/reports/M0-CA-CLEANING-MAIN-INTEGRATION-001/` |
