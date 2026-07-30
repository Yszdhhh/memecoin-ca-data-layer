# Current wave

## Objective

Close the CA real-data cleaning Repair gate under independent zero-network
audit, then shift delivery toward an operable Operator Console and bounded CA
holder hotpath. Wallet GMGN full re-fetch and cumulative PnL remain parked.

## Status as of 2026-07-30 (evening alignment)

| Workstream | Status | Notes |
| --- | --- | --- |
| Historical Waves A–D (offline schema, fixtures, harness, PG adapters, mining runners) | DONE, prior audits GREEN / GREEN_WITH_ADVISORY | Not reopened this wave. |
| Wallet 1433 GMGN 7d/30d full pull | DONE | 2866 period rows; MAPPED=0; ~97% PARTIAL; local `chainfm_out` only. |
| Clean-rank + Repair-003 offline replay | DONE | Alpha=0; Tier-B usable pool ~1370; Manual Review ~63; original 17 → 8 shortlist + 9 review. |
| SOL-CA-REAL-DATA-CLEANING-PILOT-001 | DONE | 6 public CA, 30 Helius historical requests, 3 OK / 3 PARTIAL scrubbed evidence. |
| SOL-CA-REAL-DATA-CLEANING-PILOT-AUDIT-001 | DONE / REQUEST_CHANGES | Pin `84b9a8d`; blocking mixed-owner + pool-scope findings. |
| SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-002 | DONE (implementer) | Pin `a1d56da`; mixed-owner + accounting/concentration split. |
| **SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-AUDIT-002** | **DONE / GREEN** | Independent zero-network auditor; exact pin `a1d56da`. Stopped at Owner gate. |

## ACTIVE (primary task)

```text
None — REPAIR-AUDIT-002 complete (GREEN). Awaiting Owner decision.
```

Completed this evening:

```text
SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-AUDIT-002  →  GREEN
```

- Role: Independent zero-network auditor  
- Branch: `feature/sol-ca-real-data-cleaning-pilot-001`  
- Exact pin: `a1d56dade268d24a1205e010581b6f6c478ac1bb`  
- Runtime network / Helius / GMGN / RPC / credential / DPAPI reads: **0**  
- Implementation code modifications by auditor: **0**  
- main / merge / rebase / push / force-push: **0**

## BLOCKED_BY_M0

M0 audit is GREEN, but merge/hotpath/Live still require **Owner open**. Until Owner approves:

* CA pilot merge to main  
* `SOL-CA-HOLDER-HOTPATH-INTEGRATION-001`  
* CA stability batches (`SOL-CA-HOLDER-STABILITY-BATCH-001` … `003`)  
* 真实 CA Web 接入（live Provider wiring into console）

## PLANNED_AFTER_M0

* `OPERATOR-CONSOLE-MVP-001`  
* `ADDRESS-INTELLIGENCE-LOCAL-STORE-MVP-001`

(Also planned later, after M0 and product order: research task orchestrator,
liquidity dashboard — see `docs/handoffs/NEXT_STAGE_EXECUTION_PLAN_20260730.md`.)

## PARKED

* 全量 1,433 重抓  
* 全量累计 PnL  
* GMGN signed holdings 私有路径  
* BSC  
* 完整 SOL-E2E  
* 自动发现和 cron  
* 为产生 Alpha 数量放宽 Repair-003  
* 无限新增 Harness 微任务  

## Owner gates already applied

- Helius-only for CA holder live path until a new Owner decision.  
- Manual CA selection only; no automatic discovery.  
- DPAPI secrets and private wallet tables stay local.  
- Do not brand Tier-B usable pool as smart money / Alpha / verified winners.  
- Concentration remains unverified while exclusion coverage is partial.

## Next execution gate

1. Finish **REPAIR-AUDIT-002** (GREEN / REQUEST_CHANGES / BLOCKED only).  
2. On GREEN: stop; Owner decides merge readiness.  
3. Do **not** auto-start hotpath, Live batches, or Web live Provider wiring.

## Authority docs

| Doc | Path |
| --- | --- |
| System status | `docs/handoffs/STATUS_SYSTEM_20260730.md` |
| Next-stage plan (unique) | `docs/handoffs/NEXT_STAGE_EXECUTION_PLAN_20260730.md` |
| Local paths | `docs/LOCAL_WORKSPACE_PATHS.md` |
