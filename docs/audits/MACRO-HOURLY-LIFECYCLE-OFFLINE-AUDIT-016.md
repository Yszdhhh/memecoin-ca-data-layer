# MACRO-HOURLY-LIFECYCLE-OFFLINE-AUDIT-016

| 字段 | 内容 |
| --- | --- |
| task_id | `MACRO-HOURLY-LIFECYCLE-OFFLINE-AUDIT-016` |
| tier / role | `T1 / auditor` |
| report_utc | `2026-07-22` |
| chain | `solana` only |
| audit_subject | `MACRO-HOURLY-LIFECYCLE-OFFLINE-016` 实际代码实现、离线合同与测试行为 |
| write_set | `harness/tasks/MACRO-HOURLY-LIFECYCLE-OFFLINE-AUDIT-016.json`, `docs/audits/MACRO-HOURLY-LIFECYCLE-OFFLINE-AUDIT-016.md` |
| verdict | **GREEN** — `MACRO-HOURLY-LIFECYCLE-OFFLINE-016` 的实际实现完全符合 `MACRO-HOURLY-LIFECYCLE-DESIGN-015` 设计与项目宪章边界。代码保持只读/离线设计，未发起 Dune 查询或外部 API，离线小时画像及 V1–V5 测试向量行为正确，报告与卡片渲染保持 fail-closed 严谨措辞，未发生权限或数据越界。 |

---

## 1. 审计概述与独立性声明

本审计由独立 auditor 角色执行。本审计针对的是 `MACRO-HOURLY-LIFECYCLE-OFFLINE-016` 的**实际代码实现、单元测试、SQL 蓝图和报告渲染行为**，而非仅审查 015 设计文档。

审计依据项目宪章（`PROJECT_CONSTITUTION.md`）、操作剧本（`PROJECT_OPERATING_PLAYBOOK.md`）、已知限制（`KNOWN_LIMITATIONS.md`）以及任务卡（`MACRO-HOURLY-LIFECYCLE-OFFLINE-016.json`）规定的离线边界要求，逐行核验了新增与修改的代码文件。

独立性保证：
- Auditor 未参与 016 的代码编写。
- 审计结论完全基于代码、配置文件、单元测试输出以及 Git 状态等客观事实证据。

---

## 2. 前置阅读与合规核验

审计前，按规定顺序完整阅读并核验了以下项目文档与任务输入：
1. `PROJECT_REQUIRED_READING.md`
2. `AGENTS.md`
3. `PROJECT_CONSTITUTION.md`
4. `PROJECT_OPERATING_PLAYBOOK.md`
5. `KNOWN_LIMITATIONS.md`
6. `OWNER_DECISIONS_NEEDED.md`
7. `harness/config/project.json`
8. `harness/tasks/MACRO-HOURLY-LIFECYCLE-OFFLINE-AUDIT-016.json`
9. `docs/designs/MACRO-HOURLY-LIFECYCLE-DESIGN-015.md`
10. `docs/research/MACRO-MICRO-DUNE-RESEARCH-010.md`
11. `harness/tasks/MACRO-HOURLY-LIFECYCLE-OFFLINE-016.json`

---

## 3. 逐项审计核验结果

### A. 离线与权限边界
- **核验结论：合格（PASS）**
- **证据分析**：
  1. **零外部交互/零 Dune 执行**：检查 [`src/infrastructure/dune/macro-core-query-definitions.ts`](file:///G:/%E9%93%BE%E4%B8%8A%E6%88%98%E5%A3%95/src/infrastructure/dune/macro-core-query-definitions.ts)，新增的小时活动查询蓝图 `OFFLINE_HOURLY_PROFILE_QUERY_DEFINITIONS`（`S5`~`S8`）均为未执行 SQL 文本，未被包含在 `CORE_QUERY_DEFINITIONS` 中。测试 `test/macro-hourly-lifecycle-contracts.test.ts#L86-L90` 显式校验了 `OFFLINE_HOURLY_PROFILE_QUERY_DEFINITIONS` 绝不会被注册到 live core query 列表。
  2. **无凭据/数据库/调度器调用**：实现代码不包含网络 Fetch、Dune API/CLI 实例化、数据库写入、Cron 调度或外部推送。
  3. **Solana-First & 阶段隔离**：小时活动查询蓝图仅为 Solana（`S5_solana_hourly_dex_activity_60d`, `S6_solana_hourly_dex_activity_90d`, `S7_solana_hourly_pump_activity_60d`, `S8_solana_hourly_pump_activity_90d`）。BSC 没有被激活，Four.meme 在 [`src/application/macro-daily-brief-service.ts`](file:///G:/%E9%93%BE%E4%B8%8A%E6%88%98%E5%A3%95/src/application/macro-daily-brief-service.ts#L171-L175) 中若被输入会明确抛出 `MacroDailyValidationError: unsupported metric for bsc: four_meme_launch_count` 保持 PARK 拦截。
  4. **Robinhood 明确限制为 partial_coverage**：[`src/application/macro-daily-brief-service.ts`](file:///G:/%E9%93%BE%E4%B8%8A%E6%88%98%E5%A3%95/src/application/macro-daily-brief-service.ts#L205-L212) 强制校验 Robinhood 的 `coverageStatus` 必须为 `"partial_coverage"`，注册表版本必须匹配 `spellbook:dex_robinhood:uniswap_v2_v3_v4@...`；在跨市场 DEX 活动比较中（`summarizeMarketActivity`），Robinhood 被强制排除（`reason: "partial_coverage"`），且渲染器显式标记 `Robinhood（部分覆盖：Uniswap v2/v3/v4）`。

### B. 小时活动合同
- **核验结论：合格（PASS）**
- **证据分析**：
  1. **UTC 边界严谨**：[`src/application/macro-hourly-lifecycle-contracts.ts`](file:///G:/%E9%93%BE%E4%B8%8A%E6%88%98%E5%A3%95/src/application/macro-hourly-lifecycle-contracts.ts#L42-L90) 中的 `summarizeHourlyProfile` 严格限定 UTC 0..23 小时。SQL 蓝图使用 `EXTRACT(HOUR FROM block_time)` 与 UTC 日边界 `[window_start, window_end)`。
  2. **完整覆盖防误导机制**：在 `summarizeHourlyProfile` 中，若 `coveredDayCount < expectedDayCount`（如 57/60 天），分析状态设为 `"partial"`，输出警告 `incomplete_profile_window`，并压制 `peakHourUtc`、`highActivityWindowUtc`、`intradayTimeConcentrationHhi` 和 `effectiveActiveHours`（返回 `undefined`）。测试向量 V2 证实该压制逻辑生效。
  3. **时间集中度与事实边界限制**：`intradayTimeConcentrationHhi` 仅代表 UTC 小时分布的赫芬达尔-赫希曼指数。渲染器 [`src/application/macro-daily-brief-renderer.ts`](file:///G:/%E9%93%BE%E4%B8%8A%E6%88%98%E5%A3%95/src/application/macro-daily-brief-renderer.ts) 与 CardKit [`src/application/macro-daily-brief-card.ts`](file:///G:/%E9%93%BE%E4%B8%8A%E6%88%98%E5%A3%95/src/application/macro-daily-brief-card.ts) 均明确标注其不代表 holder 集中度、钱包集中度、真实用户、买家或交易信号。

### C. 流动性留存、外池转化、生命周期衰减
- **核验结论：合格（PASS）**
- **证据分析**：
  1. **基线与随访窗口严谨性**：[`evaluateFixtureLiquidityRetention`](file:///G:/%E9%93%BE%E4%B8%8A%E6%88%98%E5%A3%95/src/application/macro-hourly-lifecycle-contracts.ts#L92-L108) 强制在 `[t0, t0 + interval]` 内寻找基线快照 `L0`，在 `[t0 + H, t0 + H + interval]` 内寻找随访快照 `LH`。缺少合格快照时返回 `unknown_insufficient_coverage` 与对应警告（`missing_baseline_snapshot` / `missing_followup_snapshot`），绝不伪造或越界估算。测试向量 V3 成功验证此逻辑。
  2. **外池转化分母过滤**：[`summarizeFixtureExternalPoolConversion`](file:///G:/%E9%93%BE%E4%B8%8A%E6%88%98%E5%A3%95/src/application/macro-hourly-lifecycle-contracts.ts#L110-L132) 仅把成熟（`mature`）且覆盖完整（`coverageComplete`）的 launch 放入分母 `eligible`。未成熟计入 `notYetMature`，覆盖不完整计入 `unknownLinkageOrCoverage`。测试向量 V4 验证 4 个 cohort 中 1 个覆盖不完整被剔除后，分母为 3，转化率为 `1/3`，绝不混淆概念。
  3. **PumpSwap pool-create 事件防误导**：`valid_pumpswap_pool_create_event_count` 的定义包含警告代码 `["not_migrate", "not_external_listing", "not_graduation"]`；简讯渲染器明示：“PumpSwap 有效建池事件不等于外盘、迁移、毕业或 token 级转化”。
  4. **生命周期队列精确拆分**：[`summarizeFixtureLifecycleThreshold`](file:///G:/%E9%93%BE%E4%B8%8A%E6%88%98%E5%A3%95/src/application/macro-hourly-lifecycle-contracts.ts#L134-L163) 明确区分 `reached`、`rightCensoredNotReached`、`notYetMature` 和 `unknownInsufficientCoverage` 四种状态。测试向量 V5 证明 reached 中位数与删失分母计算符合统计要求。
  5. **Fail-Closed PARK 状态保持**：所有生命周期与转化函数均作为带有 `Fixture` 前缀的确定性测试向量合同存在，简讯正文显式输出：“流动性留存、首次验证外部池转化和生命周期阈值目前均为 PARK；固定样本合同不构成链上结论”。

### D. 跨市场活动与报告措辞
- **核验结论：合格（PASS）**
- **证据分析**：
  1. **跨市场比较门槛**：`summarizeMarketActivity` 要求至少有两个完整、`declared_registry` 覆盖的可比市场。若不足 2 个（如 Robinhood 仅为 partial_coverage），输出 `analysisStatus: "not_comparable"` 与警告 `insufficient_comparable_markets`。
  2. **措辞防误导**：当可比时，输出附带限制条件警告 `volume_is_leg_sum` 与 `not_real_users_or_demand`。渲染文本包含：“比较集：...；按完整、声明注册表覆盖的日度 DEX 成交额。这不是用户、需求或交易信号结论。”
  3. **零买卖/推荐措辞**：渲染器与 CardKit 的测试用例显式匹配 `assert.doesNotMatch(rendered, /交易建议|执行决策|买入|卖出|预测/)` 和 `assert.doesNotMatch(serialized, /买入|卖出|用户|买家/)`，确保无违规措辞。

### E. 情绪层
- **核验结论：合格（PASS）**
- **证据分析**：
  1. **完全隔离**：`MacroSentimentObservationLayer` 独立定义于 [`src/domain/macro-daily.ts`](file:///G:/%E9%93%BE%E4%B8%8A%E6%88%98%E5%A3%95/src/domain/macro-daily.ts#L100-L107)，作为独立可选字段存在，不混入链上事实指标。
  2. **PARK 状态锁**：在 [`src/application/macro-daily-brief-service.ts`](file:///G:/%E9%93%BE%E4%B8%8A%E6%88%98%E5%A3%95/src/application/macro-daily-brief-service.ts#L175-L189) 中，`validateSentimentLayer` 强制要求 `sourceAuthorization: "not_authorized"`, `coverageStatus: "unknown"`, `observationStatus: "park"`。
  3. **数值化结论防护**：`validateSentimentLayer` 检查若输入对象中包含 `value`, `score` 或 `demand` 属性，则抛出 `MacroDailyValidationError: sentiment layer cannot carry a value, score, or demand assertion`。测试用例 `test/macro-daily-brief-service.test.ts#L140-L167` 对此进行了否定性断言校验。

### F. 范围隔离
- **核验结论：合格（PASS）**
- **证据分析**：
  在 016 实现中，未对以下核心规则文件进行任何修改或重定义：
  - CA 创建者事实与规则（`src/domain/rules/dev-behavior.ts`，Pump `create.creator` 优先权）
  - 持仓清洗规则（`src/domain/rules/real-holders.ts`）
  - 资金集群规则（`src/domain/rules/funding-clusters.ts`）
  - 交易钱包质量规则（`src/domain/rules/wallet-quality.ts`）

---

## 4. 运行验证与质量门禁记录

在 `G:\链上战壕` 工作区执行了标准质量门禁命令，原始输出摘要如下：

### 1. 任务卡校验
```powershell
npm run harness:task -- validate harness/tasks/MACRO-HOURLY-LIFECYCLE-OFFLINE-AUDIT-016.json
```
- **退出码**：`0`
- **输出**：`{"task_id":"MACRO-HOURLY-LIFECYCLE-OFFLINE-AUDIT-016","status":"GREEN","errors":[]}`

### 2. TypeScript 类型检查
```powershell
npm run typecheck
```
- **退出码**：`0`
- **输出**：`tsc -p tsconfig.json --noEmit` (无报错，Clean)

### 3. 单元测试套件
```powershell
npm test
```
- **退出码**：`0`
- **输出**：
  ```text
  ℹ tests 74
  ℹ suites 0
  ℹ pass 74
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ duration_ms 703.7754
  ```
- 包含 V1~V5 合同测试、小时画像解析测试、卡片渲染测试以及 Robinhood/情绪层边界测试等 74 项测试全部通过。

### 4. 项目构建
```powershell
npm run build
```
- **退出码**：`0`
- **输出**：`tsc -p tsconfig.json` (构建成功)

### 5. Git 差异检查
```powershell
git diff --check
```
- **退出码**：`0`
- **输出**：无空白字符或换行符冲突错误（仅有标准的 LF/CRLF 转换提示）。

---

## 5. 审计结论与建议

### 审计Verdict：**GREEN**

**总结说明**：
1. `MACRO-HOURLY-LIFECYCLE-OFFLINE-016` 实现了纯离线的 Solana 小时活动合同、SQL 蓝图（未执行）、确定性简讯与 CardKit 渲染，以及 V1–V5 离线测试向量。
2. 所有数据边界控制得当：流动性留存、外池转化、生命周期衰减和情绪观察层均保持 fail-closed PARK 状态；Robinhood 严格受限于 partial_coverage 且不参与全链比较；Four.meme 保持 PARK；报告与卡片措辞无买卖信号或过度推断。
3. 允许写入路径完全限定在 `docs/audits/MACRO-HOURLY-LIFECYCLE-OFFLINE-AUDIT-016.md` 和对应的审计任务卡，符合 auditor 角色约束。

本实现已被验证为完全通过（GREEN）。
