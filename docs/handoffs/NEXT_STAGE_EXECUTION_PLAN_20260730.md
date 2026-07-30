# 下一阶段唯一执行计划（2026-07-30）

**权威文件**：本文件是下一阶段计划的唯一落盘处。  
**状态事实**：见 `docs/handoffs/STATUS_SYSTEM_20260730.md`（含「2026-07-30 晚间执行对齐」）。  
**任务板**：见 `harness/CURRENT_WAVE.md`。

---

# 项目目标

项目最终形态 **不是** 单纯 CA Scanner，而是：

```text
CA 分析入口
+ 地址情报资产库
+ 任务编排
+ 历史钱包复核
+ 流动性水位
+ Web 操作台
```

当前阶段从「持续建设底层规则」切换为：

```text
可信数据底座收口
→ 可操作 Web 闭环
→ 真实使用反馈
→ 定向修复底层
```

---

# 优先级原则

未来开发资源按以下比例安排：

```text
60%：CA 可用闭环与 Web 操作
25%：地址库和少量钱包链上复核
15%：流动性模块
```

**禁止**再次把大部分资源投入 GMGN 字段适配或全量钱包重复抓取。

---

# 里程碑

## M0：关闭 CA Repair 并达到合并条件

任务：

```text
SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-AUDIT-002
```

**审计对象 Pin（固定，不得审计浮动 HEAD）**：

```text
a1d56dade268d24a1205e010581b6f6c478ac1bb
```

完成条件：

* mixed-owner 强制回归通过；
* 正余额守恒；
* accounting 与 concentration 信任状态分离；
* 6 CA 离线 replay 语义正确；
* 网络、Provider、凭据读取均为 0；
* 独立审计 **GREEN**。

**M0 GREEN 后**，才允许准备合并 CA pilot 到 main（仍须 Owner 显式批准 merge）。

## M1：Operator Console MVP

目标：浏览器里可以实际完成：

* 输入 CA；
* 查看 CA 持仓和数据质量；
* 打开钱包详情；
* 搜索地址库；
* 手工增加标签和备注；
* 查看和发起手工任务。

第一版页面：

1. CA 分析页；
2. 钱包详情页；
3. 地址库页；
4. 任务中心。

必须显示：

* Tier-A / Tier-B；
* confirmed / unverified / partial；
* accounting status；
* exclusion coverage；
* unresolved ratio；
* Provider 更新时间；
* 数据质量警告。

第一版可以使用 fixtures、脱敏报告和本地数据，**不等待**全部 Live 能力完成。

建议任务 ID：`OPERATOR-CONSOLE-MVP-001`（M0 之后）。

## M2：CA Holder 热路径与稳定性

任务：

```text
SOL-CA-HOLDER-HOTPATH-INTEGRATION-001
SOL-CA-HOLDER-STABILITY-BATCH-001
SOL-CA-HOLDER-STABILITY-BATCH-002
SOL-CA-HOLDER-STABILITY-BATCH-003
```

要求：

* 每批手工 5–10 个公开 CA；
* 累计至少 20–30 个；
* 不启用 cron 和自动选币；
* 统计：accounting OK 率、pagination failure、residual 分布、请求数、P50/P95 延迟、Helius credit、retry 收益、Provider shape drift。

只有获得一手 pool/bonding curve 排除证据后，才允许将集中度逐步升级为 confirmed。

**全部 BLOCKED_BY_M0。**

## M3：地址资产库落地

任务：

```text
ADDRESS-INTELLIGENCE-LOCAL-STORE-MVP-001
```

要求：

* 连接本地 PostgreSQL；
* 导入 Tier-B usable pool（约 1,370）；
* 单独维护 8 个 Tier-B shortlist；
* 保存标签来源、置信度和验证状态；
* 支持人工备注和历史版本；
* CA 命中钱包自动沉降；
* 仅挑选 3–5 个钱包做 Helius 链上历史复核；
* 未经链上复核不得升级为 confirmed smart money。

## M4：受控任务编排

任务：

```text
RESEARCH-TASK-ORCHESTRATOR-MVP-001
```

第一版只做：

* job table；
* manual queue；
* idempotency key；
* budget；
* timeout；
* retry；
* concurrency limit；
* Provider circuit breaker；
* task status；
* Web 手工操作。

稳定后才允许有限定时任务。  
**禁止**一开始自动扫描全市场。

## M5：流动性看板

任务：

```text
MACRO-LIQUIDITY-DASHBOARD-MVP-001
```

第一版只做每日级指标：

* Solana DEX volume；
* swap 数；
* 活跃交易地址；
* 新币发射量；
* Pump 毕业或外盘量；
* 新池数量；
* Meme 相关收入；
* 7d/30d 历史分位；
* 数据更新时间；
* 缺失和异常状态；
* 综合水位。

CA 和流动性可以使用同一个 Web Console，但任务、服务和数据刷新逻辑必须分离。

---

# 明确暂缓

在对应 Owner Gate 开启前，禁止：

* 再次全量抓取 1,433 钱包；
* 1,433 钱包全量累计 PnL；
* BSC；
* Robinhood；
* 完整 SOL-E2E 一次性开发；
* Dev、creator、funding cluster 同时开发；
* 自动热门币发现；
* 全市场自动扫描；
* 生产数据库部署；
* cron；
* 为了产生 Alpha 数量而放宽 Repair-003；
* 继续无限新增 Harness 微任务。

---

# 项目验收方式调整

今后每个阶段 **不能只以**：

```text
typecheck pass
test pass
audit green
```

作为完成标志。

必须增加用户可见验收：

```text
用户可以完成什么操作？
页面可以看到什么结果？
结果是否可追溯？
失败状态是否清楚？
```

---

# 建议执行顺序（M0 GREEN 后）

1. Owner 批准：feature → main 合并准备（仅 CA pilot 相关、不含私密数据）。
2. `OPERATOR-CONSOLE-MVP-001`（fixtures / 脱敏优先）。
3. `SOL-CA-HOLDER-HOTPATH-INTEGRATION-001`（手工触发、Helius-only）。
4. Stability batches 001–003（累计 20–30 CA）。
5. `ADDRESS-INTELLIGENCE-LOCAL-STORE-MVP-001`（本地 PG + Tier-B 导入 + 3–5 链上抽检）。
6. `RESEARCH-TASK-ORCHESTRATOR-MVP-001`。
7. `MACRO-LIQUIDITY-DASHBOARD-MVP-001`。

---

# 口径约束（全阶段）

| 允许 | 禁止 |
| --- | --- |
| Tier-B usable pool（~1370） | 称 1370 为聪明钱候选 / Alpha |
| Tier-B shortlist（8） | confirmed smart money / verified winner |
| accounting confirmed（供应对账） | 用 accounting confirmed 暗示集中度 confirmed |
| concentration unverified + partial exclusion | cleaned investor universe 在 coverage 不完整时 |
