# 系统现状收口与下一阶段方向（2026-07-30）

面向：云端审核 / Owner 决策 / 下一波任务派工。  
本地主克隆路径见 [`docs/LOCAL_WORKSPACE_PATHS.md`](../LOCAL_WORKSPACE_PATHS.md)（`G:\链上战壕`）。

**本文件可提交 Git。** 不包含密钥、明文钱包 bulk 列表、原始 Provider payload。

---

## 0. 一句话现状

系统已形成两条并行事实链路，且 **M0 + Console Shell + CA Holder Hotpath 已合入 main**：

1. **钱包情报（GMGN 借用层）**：1433 地址 7d/30d 已全量抓取；累计盈利未打通（明细仅本地）。
2. **CA 持仓（Helius Tier-A）**：M0 试点 GREEN 已 merge；**Hotpath Operator API（PR #7）已 merge**（独立审计 GREEN）。

**当前 ACTIVE**：`OPERATOR-CONSOLE-LIVE-WIRING-001`  
**DONE（刚完成）**：`SOL-CA-HOLDER-HOTPATH-INTEGRATION-001`（PR #7 merge `ae60368`）  

不要重复 Hotpath 实现/审计；不要进入 Stability（须先完成 Live Wiring）。

---

## 1. 仓库与分支

| 项 | 值 |
| --- | --- |
| Remote | `https://github.com/Yszdhhh/memecoin-ca-data-layer.git` |
| 本地主路径 | `G:\链上战壕` |
| 主干 | `main`（Hotpath 已合入） |
| Hotpath merge commit | `ae60368bcd82ebc3fb9f2655dd82f6d079158401` |
| Hotpath PR | [#7](https://github.com/Yszdhhh/memecoin-ca-data-layer/pull/7) |
| Hotpath independent audit | `harness/reports/SOL-CA-HOLDER-HOTPATH-INTEGRATION-001-AUDIT-001/` |
| Console Shell merge | `5cc414c83d5b0d602d55eac9bc392953a3161196`（PR #6） |
| M0 merge commit | `2976316e3853e377eff112484f9817ac2e1eba57`（PR #4） |
| ACTIVE branch | `feature/operator-console-live-wiring-001` |

---

## 2. 链路 A — 钱包 1433

| 指标 | 值 |
| --- | --- |
| 唯一钱包 | 1,433 |
| 周期记录 | 2,866 |
| MAPPED | 0 |
| PARTIAL | ~97% |
| 至少一个周期 UNAVAILABLE | 84 钱包 |
| Repair-003 Alpha | 0 |
| Tier-B usable pool | ~1,370（不得称聪明钱） |
| Manual Review | ~63 |
| 原 17 候选 | 8 shortlist + 9 Manual Review |
| 累计 PnL | 未打通 |

**暂停**：全量重抓 1433；全量累计 PnL。  
明细仅本地 `chainfm_out`，**不进 Git**。

---

## 3. 链路 B — CA 持仓试点

| 项 | 值 |
| --- | --- |
| 样本 | 6 公开 CA，Helius-only |
| 历史请求 | 30（审计期不得重打） |
| 批次 | 3 OK / 3 PARTIAL |
| Repair-002 | mixed-owner 修复；accounting / exclusion / concentration 分离 |
| 语义 | 3 OK：accounting 可 confirmed；**全部 6 CA concentration unverified** |
| exclusionCoverage | partial |
| 状态 | MERGED to main via PR #4 |

---

## 4. 信任分层

| 数据 | 层 | 可用途 | 不可用途 |
| --- | --- | --- | --- |
| GMGN 7d/30d | Tier-B | 候选筛选（unverified） | confirmed 聪明钱 |
| Helius holder（试点） | Tier-A | 供应对账（完整时） | 无 pool 证据时的 confirmed 集中度 |
| 累计 holdings | 未通 | — | 任何累计已证实话术 |

---

## 5. 地址库 / Web / 流动性

- 地址领域模型与 PG adapter 存在；**无**运营闭环。  
- Operator Console **Shell 已 merge**（fixture）；**Live Wiring 进行中**（连 loopback Operator API）。  
- Hotpath API：`127.0.0.1` only；`OPERATOR_API_LIVE=1` + runtime `HELIUS_API_KEY`。  
- 流动性：SQL/日报骨架；无稳定看板。  
- DPAPI 仅本地。

---

## 6. 资源原则

```text
60%：CA 可用闭环与 Web 操作
25%：地址库和少量链上复核
15%：流动性
```

---

## 7. Hotpath 合并后状态（权威）

```text
M0：DONE / GREEN / MERGED（PR #4）
OPERATOR-CONSOLE-SHELL-001：DONE / GREEN / MERGED（PR #6）
SOL-CA-HOLDER-HOTPATH-INTEGRATION-001（Holder Hotpath / G0）：DONE / GREEN / MERGED（PR #7）
  Merge：ae60368bcd82ebc3fb9f2655dd82f6d079158401
  Audit：GREEN / ACCEPT_AND_MERGE
  Hotpath Live smoke：2 public CA / 11 total Helius HTTP requests
  Main critical gates：PASS（harness:doctor wallets.json P2 预存）
G0：DONE

ACTIVE：OPERATOR-CONSOLE-LIVE-WIRING-001
NEXT：SOL-CA-HOLDER-STABILITY-BATCHES-001
AFTER：OBSERVABILITY-BASELINE-001

不得声称：
Stability 已完成
G2–G8 已完成
研究 prototype 已进入生产
钱包已链上 verified

PARKED：
1433 全量重抓
全量累计 PnL
自动发现
cron
BSC
完整 SOL-E2E
G2–G8 offline product surfaces
Watchlist / Schedules / Replay / Liquidity
```

---

## 8. 相关入口

| 用途 | 路径 |
| --- | --- |
| 任务板 | `harness/CURRENT_WAVE.md` |
| 计划 | `docs/handoffs/NEXT_STAGE_EXECUTION_PLAN_20260730.md` |
| CA 试点 | `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-001/` |
| M0 集成 | `harness/reports/M0-CA-CLEANING-MAIN-INTEGRATION-001/` |
| Hotpath 实现报告 | `harness/reports/SOL-CA-HOLDER-HOTPATH-INTEGRATION-001/` |
| Hotpath 独立审计 | `harness/reports/SOL-CA-HOLDER-HOTPATH-INTEGRATION-001-AUDIT-001/` |
| CA Holder API 合同 | `docs/contracts/OPERATOR_CA_HOLDER_API_V1.md` |
