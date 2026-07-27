# 链上战壕 — 进度收口（2026-07-27）

## Claude 最新进度（会话 `195e5e8d`）

Claude 在额度/连接中断前已完成：

| 里程碑 | 结果 |
|---|---|
| 审计队列收口（repair / wallet / harness / FIND-4 / market） | 多条 GREEN / GREEN_WITH_ADVISORY |
| Owner 方向锁定（免费栈、borrow-then-confirm、Telegram 延后） | `OWNER_DECISIONS_NEEDED` + architecture |
| Dispatch plan / 蓝图 | `harness/DISPATCH_PLAN.md`、`PROJECT_ARCHITECTURE.md` |
| Wave A1 `SOL-OBSERVATION-SCHEMA-001` | DONE + 独立审计 GREEN_WITH_ADVISORY（`74314da` / `436f928`） |
| Funder-tags 修复 | DONE + 再审 GREEN |
| Harness automation 4×P1 修复 | DONE + 再审 GREEN_WITH_ADVISORY |
| **Wave A2 `SOL-HARNESS-SUITES-001`** | **中断**：准备派 sub-agent 时 connection closed / 订阅被禁用 |

最后用户指令：`go on` → Claude 无法继续。

## Grok 接续完成

实现 **A2 · 四套离线验收套件**（Claude 未完成的唯一 READY 实现任务）：

| 套件 | 作用 | 预算/容差文件 |
|---|---|---|
| `latency` | 虚拟时钟；并行 = max；P50≤900 / P95≤2000 | `latency-budget@1.json` |
| `replay` | 钉死旧 token 时间线 field-by-field | `replay/case-old-token/*` |
| `source-degradation` | 源×失败模式矩阵；一手 holder 失败不得借用 Top10 | `source-degradation-matrix.json` |
| `label-decision` | 检测器 FP/FN vs 版本化容差 | `label-tolerance@1.json` |

- 路径：`src/harness-suites/*`、`test/fixtures/harness/**`、`test/harness-suites/suites.test.ts`
- 运行：`npx tsx src/harness-suites/<suite>.ts [runDir]`
- Harness run：`20260727_SOL_HARNESS_SUITES_001` **GREEN**
- 任务：`SOL-HARNESS-SUITES-001` → **DONE**；`SOL-HARNESS-SUITES-AUDIT-001` → **READY**（独立审计，留给下一班）

验收：`npm run typecheck` / `npm test`（140+） / `npm run build` 全绿。

---

## 现在处于什么阶段？（一句话）

**Solana CA 离线主链路 + 架构/派工蓝图已齐；Wave A 离线地基 A1–A2 实现完成；下一实现波是 A3 Alpha-Score / A4 Detectors / Wave B 适配器（fixture）；Live 仍 PARK。**

### 阶段地图

```
[已完成] Phase 0 债务 + CA 编排/修复/钱包/FIND-4/市场观察 + 审计收口
[已完成] 架构转向：混合数据 / 即时 CA / 地址库 / 免费栈 Owner 决策
[已完成] Wave A1 Observation schema + migration 008
[已完成] Wave A2 四套 harness 验收维度（实现；审计待独立跑）
[下一步] Wave A3 SOL-ALPHA-SCORE-001 → A4 SOL-DETECTORS-001
[下一步] Wave B Helius/市场适配器（fixture 实现，live 翻转 Owner 门）
[闸门]   SOL-E2E-001 PARK（live CA / 凭证 / 保留策略）
[闸门]   BSC / Robinhood BLOCKED_STAGE
```

### 任务账本快照（约）

| 状态 | 含义 |
|---|---|
| DONE ~54+ | 含 CA 主路径、观察 schema、四套 suites 实现 |
| READY | `SOL-HARNESS-SUITES-AUDIT-001`（+ 若有其他审计） |
| 下一实现 READY（dispatch plan） | Alpha-Score、Detectors、Wave B… 以 `harness/DISPATCH_PLAN.md` 为准 |
| PARK | `SOL-E2E-001`、部分 live/安全项 |
| BLOCKED_STAGE | BSC / Robinhood |

### 模块水位

| 模块 | 水位 |
|---|---|
| **CA 分析** | 离线编排 + 证据完整性 + 钱包清洗 + FIND-4 对齐：**生产前需 live E2E + 审计队列清空** |
| **流动性/市场** | 设计 + offline选择 + migration：**无 live provider** |
| **观察/地址库** | schema + 008 migration：**已落地** |
| **Harness 治理** | lifecycle + 四维 suites：**实现齐，suites 审计待跑** |
| **Alpha / 检测器** | 文档齐，**代码未做**（A3/A4） |
| **Live 数据面** | **未开**（Helius free 1M 已 Owner 选定，但适配器 live 翻转未做） |

---

## 其它 agent 接手读什么

1. `PROJECT_REQUIRED_READING.md` 链  
2. `harness/DISPATCH_PLAN.md`（唯一派工源）  
3. `OWNER_DECISIONS_NEEDED.md`（免费栈 / borrow-then-confirm）  
4. 本文件 + `git log --oneline -15`

建议下一任务（不重叠 write set）：

1. 独立审计 `SOL-HARNESS-SUITES-AUDIT-001`  
2. 实现 `SOL-ALPHA-SCORE-001`  
3. 或并行（写集不冲突时）Wave B fixture 适配器

**禁止**：未开 Owner 门就 live 打 Helius/行情；实现者自审自批 T2 为唯一 GREEN。
