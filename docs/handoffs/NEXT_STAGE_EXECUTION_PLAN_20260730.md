# 下一阶段唯一执行计划（2026-07-30）

**权威文件**：本文件是下一阶段计划的唯一落盘处。  
**状态事实**：见 `docs/handoffs/STATUS_SYSTEM_20260730.md`。  
**任务板**：见 `harness/CURRENT_WAVE.md`。

## 当前阶段指针

```text
M0：DONE / GREEN / MERGED

PR：#4
Merge commit：2976316e3853e377eff112484f9817ac2e1eba57
Main integration report：e8929a61262f2c32924ede3b7ba6067bc1d15b79

当前 ACTIVE：
OPERATOR-CONSOLE-SHELL-001

NEXT：
SOL-CA-HOLDER-HOTPATH-INTEGRATION-001

PARKED：
1433 全量重抓
全量累计 PnL
自动发现
cron
BSC
完整 SOL-E2E
```

`OPERATOR-CONSOLE-SHELL-001` = **M1 Operator Console MVP 的第一阶段**（fixtures / 脱敏优先）。

不要再等待 M0 merge；不要重复 M0 审计/集成。

---

# 项目目标

项目最终形态不是单纯 CA Scanner，而是：

```text
CA 分析入口
+ 地址情报资产库
+ 任务编排
+ 历史钱包复核
+ 流动性水位
+ Web 操作台
```

当前阶段：

```text
可信数据底座收口
→ 可操作 Web 闭环
→ 真实使用反馈
→ 定向修复底层
```

---

# 优先级原则

```text
60%：CA 可用闭环与 Web 操作
25%：地址库和少量钱包链上复核
15%：流动性模块
```

禁止再次把大部分资源投入 GMGN 字段适配或全量钱包重复抓取。

---

# 里程碑

## M0 — DONE / GREEN / MERGED

| 项 | 值 |
| --- | --- |
| 审计 | REPAIR-AUDIT-002 GREEN |
| 实现 Pin | `a1d56dade268d24a1205e010581b6f6c478ac1bb` |
| PR | #4 |
| Merge | `2976316e3853e377eff112484f9817ac2e1eba57` |

## M1 — Operator Console（ACTIVE = SHELL-001）

任务：`OPERATOR-CONSOLE-SHELL-001`

目标：浏览器可完成 CA 查看、钱包摘要、地址库演示标签、任务中心；使用 fixtures；零 Live Provider。

完整 M1 页面：CA 分析、钱包详情、地址库、任务中心。  
必须显示 Tier-A/B、confirmed/unverified/partial、accounting、exclusion coverage、concentration、warnings。

## M2 — CA Holder 热路径与稳定性（NEXT）

```text
SOL-CA-HOLDER-HOTPATH-INTEGRATION-001
SOL-CA-HOLDER-STABILITY-BATCH-001..003
```

不再 BLOCKED_BY_M0。顺序：Shell → Hotpath → Stability batches。

## M3 — 地址资产库

`ADDRESS-INTELLIGENCE-LOCAL-STORE-MVP-001`

## M4 — 受控任务编排

`RESEARCH-TASK-ORCHESTRATOR-MVP-001`

## M5 — 流动性看板

`MACRO-LIQUIDITY-DASHBOARD-MVP-001`

---

# 明确暂缓

全量 1433 重抓、全量累计 PnL、BSC、Robinhood、完整 SOL-E2E、自动发现、cron、生产库、放宽 Repair-003。

---

# 验收方式

除 typecheck / test / audit 外，必须回答：

```text
用户可以完成什么操作？
页面可以看到什么结果？
结果是否可追溯？
失败状态是否清楚？
```

---

# 执行顺序

1. ~~M0 merge~~ 已完成  
2. **OPERATOR-CONSOLE-SHELL-001**（ACTIVE）  
3. **SOL-CA-HOLDER-HOTPATH-INTEGRATION-001**  
4. Stability batches  
5. ADDRESS-INTELLIGENCE-LOCAL-STORE-MVP-001  
6. RESEARCH-TASK-ORCHESTRATOR-MVP-001  
7. MACRO-LIQUIDITY-DASHBOARD-MVP-001  

---

# 口径约束

| 允许 | 禁止 |
| --- | --- |
| Tier-B usable pool（~1370） | 称 1370 为聪明钱 / Alpha |
| Tier-B shortlist（8） | confirmed smart money |
| accounting confirmed | 用 accounting 暗示 concentration confirmed |
| concentration unverified + partial exclusion | cleaned investor universe（coverage 不完整时） |
