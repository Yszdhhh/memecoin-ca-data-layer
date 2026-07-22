# MACRO-MICRO-DUNE-RESEARCH-010

| 字段 | 内容 |
| --- | --- |
| task_id | `MACRO-MICRO-DUNE-RESEARCH-010` |
| tier / role | `T1 / researcher` |
| report_utc | `2026-07-21` |
| dependencies | `MACRO-DUNE-QUERY-PROVENANCE-001`, `MACRO-DAILY-LARK-SHIM-RESOLUTION-009` |
| write_set | `docs/research/MACRO-MICRO-DUNE-RESEARCH-010.md` only |
| verdict | **GREEN_WITH_ADVISORY** — 已核验的是固定 Spellbook 源码中的表结构、字段和事件映射；所有数值、覆盖率、时效和链上结果仍为 **UNEXECUTED / UNVERIFIED**，不得据此运行 Dune 或把观察写成需求、买方或交易信号。 |

## 0. 执行边界（强制）

1. 本任务**没有**调用 Dune API、CLI、Dashboard、已保存查询、Cookie、凭据或付费查询；没有执行任何 DuneSQL。
2. 本文的查询形状、字段和事件语义仅是后续离线路径的研究证据，不是已执行结果，不产生真实日报，也不授权数据库、调度、飞书推送或任何链适配器。
3. 当前可用事实只限于：已固定版本的 Spellbook 源码定义了所列模型、字段和事件解码路径。真实行数、数据延迟、`amount_usd` 覆盖、重组/回填行为和项目注册表完整性，均须经单独 Owner 授权执行后才可验证。
4. 本任务不修改、推断或覆盖 CA 创建者事实、持仓清洗、Dev 行为、钱包集群或交易钱包质量规则。

## 1. 证据锁定与术语

### 1.1 源码锁

沿用 `MACRO-DUNE-QUERY-PROVENANCE-001` 的 immutable Spellbook pin：

- repo：`duneanalytics/spellbook`
- full commit SHA：`b553234af744bef843a51e7f1cfd319d5cced24d`
- immutable commit：`https://github.com/duneanalytics/spellbook/commit/b553234af744bef843a51e7f1cfd319d5cced24d`
- Solana DEX trade registry：`spellbook:dex_solana:base_trades_union@b553234af744bef843a51e7f1cfd319d5cced24d`
- Pump create mapping：`spellbook:pumpdotfun:create@b553234af744bef843a51e7f1cfd319d5cced24d`
- PumpSwap pool mapping：`spellbook:pumpswap:pools@b553234af744bef843a51e7f1cfd319d5cced24d`

研究时直接核阅的固定源码：

1. `https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/solana/models/_sector/dex/dex_solana_trades.sql`
2. `https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/solana/models/_sector/dex/dex_solana_base_trades.sql`
3. `https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/solana/models/_sector/dex/pumpdotfun/solana/pumpdotfun_solana_base_trades.sql`
4. `https://raw.githubusercontent.com/duneanalytics/spellbook/b553234af744bef843a51e7f1cfd319d5cced24d/dbt_subprojects/solana/models/_sector/dex/pumpswap/pumpswap_solana_pools.sql`

### 1.2 统一口径

| 术语 | 本报告允许的含义 | 禁止扩展为 |
| --- | --- | --- |
| `report_day` | `block_date`/`CAST(block_time AS date)` 对应的 **UTC** 日历日 | 本地自然日，或未说明时区的“今天” |
| DEX trade leg | 去重后的一个 DEX trade 行，Solana 粒度为 `(tx_id, outer_instruction_index, inner_instruction_index, tx_index, block_month)` | 一名买家、一笔独立买入、一次真实需求 |
| active trader | 在声明注册表内、满足查询过滤条件的唯一 `trader_id` | 去重后的真人、买家、聪明钱或需求方 |
| Pump launch | 成功 Pump `create` 指令事件的计数 | 已验证唯一 token 数、已毕业 token 数或可交易标的数 |
| valid PumpSwap pool | 源模型中 `is_valid_pool = true` 的 PumpSwap 建池事件；该标志由 quote mint allowlist 给出 | Pump 迁移/毕业事实、所有外盘、或与某次 launch 的一一对应 |
| `amount_usd` volume | DEX trade leg 的 `SUM(amount_usd)` | 净流入、LP 净变化、买压或实际买方资金 |

所有日报显示必须同时保留：`source`、`query_ref`、`query_version`/SQL hash、`source_as_of`、`computed_at`、`registry_version`、`coverage_status`、`completeness` 和 `warnings`。真实执行前，`source_as_of` 不能伪造，`completeness` 必须为 `0`。

## 2. 已核验的日度微观观察合同

下表中的“结构核验”仅表示固定源码可支持该查询形状；不表示任何数字、覆盖率或时间水位已经验证。

| 指标 | 已核验的数据形状 | UTC 边界与建议聚合 | 事实边界与必须警告 | 研究状态 |
| --- | --- | --- | --- | --- |
| `dex_volume_usd`（Solana） | `dex_solana.trades` 提供 `block_date`、`block_time`、`amount_usd`、项目和交易粒度字段 | `block_date = report_day`；`SUM(amount_usd)`，仅汇总非空 USD 行 | 是 **leg sum**，非净流、非买入额；缺价行被排除，不能当作零；注册表含多个 DEX，且源码明确排除 Sanctum router | 结构核验；执行未核验 |
| `active_trader_count`（Solana） | `dex_solana.trades.trader_id` | `block_date = report_day`；在与日成交额相同的 `amount_usd IS NOT NULL` 过滤下 `COUNT(DISTINCT trader_id)` | 当前日度蓝图实际衡量“有定价 trade leg 的唯一地址”，不是全链活跃地址、真实用户或买家；必须加 `priced_trade_rows_only` 警告 | 结构核验；执行未核验 |
| `swap_transaction_count`（Solana） | `tx_id` 与完整 trade-leg 唯一键 | 先按 `(tx_id, outer_instruction_index, inner_instruction_index, tx_index, block_month)` 去重，再 `COUNT(DISTINCT tx_id)` | 应解释为“至少含一个已登记 DEX trade leg 的交易 ID 数”；一笔路由交易可有多腿，不能宣称原子 swap 数或用户意图数 | 结构核验；执行未核验 |
| `trade_leg_count`（Solana） | 同上 | 完整 trade-leg 粒度去重后 `COUNT(*)` | 用于说明路由/拆分复杂度；不得与交易数混称，也不得作为独立买卖人数 | 结构核验；执行未核验 |
| `pump_launch_count`（Solana） | Pump 程序 `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`、成功交易、create discriminator `0x181ec828051c0777` | `CAST(block_time AS date) = report_day`；统计成功 create 指令事件 | 是 Pump 范围的 create-event 计数；未从该日度计数中解码并去重 mint，不能写成所有 Solana 发射、唯一 token 数、毕业数或已吸收供给 | 映射结构核验；执行未核验 |
| `external_pool_count`（当前名称） | `pumpswap_solana.pools` 提供 `created_at` 与 `is_valid_pool` | `CAST(created_at AS date) = report_day AND is_valid_pool = true` | 仅可如实展示为“有效 PumpSwap 建池事件数”；应保留 `not_migrate`，且不证明外盘、毕业、迁移或 launch-to-pool 转化 | 映射结构核验；执行未核验 |

### 2.1 日度相对水位的安全使用

已经存在的日环比和 7 日相对水位只能在**同一原生指标、同一链、同一注册表、同一查询版本和相同 UTC 边界**内比较。推荐解释是“声明覆盖范围内的观测活动相对其自身近期历史变化”，不构成跨链统一评分、真实需求判断或 token-buy 信号。

若任一比较窗口包含未完成日、查询版本变更、注册表变更、`amount_usd` 覆盖未知、或缺失日，应不显示该比较或将该指标降为部分覆盖；不可用零值填补。

### 2.2 可以呈现的组合观察，及其限制

| 允许的日报观察 | 必须同时展示 | 不得写成 |
| --- | --- | --- |
| 声明 Solana DEX 注册表内的成交额、唯一 `trader_id`、交易 ID 数和 trade leg 数相对同口径历史上升/下降 | UTC 日、注册表版本、价格覆盖警告、日环比/7 日口径 | “买方增加”“资金净流入”“真实需求确认” |
| 成功 Pump create-event 与有效 PumpSwap pool-create-event 的并列日度数量 | 两个独立事件来源、`pump_only`、`not_migrate`、不可匹配警告 | “毕业率”“转化率”“供给被市场吸收” |
| `trade_leg_count / swap_transaction_count` 的描述性比值（仅在两个分母均大于零且同源同日） | 完整去重键、注册表和价格覆盖并不影响该比值但仍需记录数据水位 | 用户质量、机器人比例、路由效率或交易质量结论 |

## 3. 明确不通过本任务验证的指标

| 目标指标/说法 | 结论 | 原因与下一步 |
| --- | --- | --- |
| 小时活跃画像 | **PARK（待设计）** | 源码含 `block_time`，可支持 UTC 小时分桶；但 60/90 日窗口、全小时缺失处理、样本日数、覆盖率、峰值/连续窗口算法尚未获本任务定义或测试。交由 `MACRO-HOURLY-LIFECYCLE-DESIGN-015`。 |
| 流动性留存、LP 净变化 | **PARK** | 本任务输入未提供可验证的 Solana 历史池流动性余额合同；`amount_usd` 成交额不是流动性。不得以交易额、pool creation 或价格代替。 |
| launch-to-external-pool / graduation conversion | **PARK** | 已核验的 Pump create 与 PumpSwap pool 事件没有 token 级 launch-to-pool 关联，也没有迁移/毕业事实字段。不能用同日计数相除。 |
| 生命周期衰减、腰斩、跌 90%、估值/FDV | **PARK** | 本任务没有经过权威核验的逐间隔 token 估值、可验证供应量、基线选择和随访覆盖。不得产生 survival、drawdown 或 market-cap/FDV 结论。 |
| 情绪、社媒热度、KOL/第三方标签 | **PARK** | 本任务没有批准的来源、许可、覆盖定义、抓取时点或事实边界。后续只能作为 source-labelled observation layer；不得覆盖链上事实，缺失绝不等于无情绪。 |
| BSC Four.meme | **PARK** | `Four.meme` 仍没有权威 launch 事件来源，且 BSC 处于阶段锁定。 |
| Robinhood 全链结论 | **禁止** | 仅可维持 Uniswap v2/v3/v4 注册表范围的 `partial_coverage`，不能报告为 Robinhood 全链覆盖。 |
| 真实 Dune 执行、数据库、调度、推送 | **未授权** | 必须在 Owner 对 Dune、数据库目标、保留期和交付目的地授权后，另行进入 `MACRO-LIVE-OPERATIONS-018`。 |

## 4. 给后续设计任务的可审计前置条件

本任务不实施下列设计；它只记录未来实现前必须补齐的证据与合同边界。

1. **小时画像**：固定 `UTC [00:00, 24:00)`、滚动窗口的含首尾规则、每小时分母、无数据日与迟到数据处理、连续高活跃窗口算法、`sample_day_count`、链/注册表覆盖状态。
2. **流动性留存**：固定 pool identity、首次可验证基线、精确随访时点与允许容差、流动性组成/计价方法、已消失池和缺价样本的处理；不得把缺失写成零。
3. **可信转化**：逐 token 关联 launch event 与首个“launchpad/bonding curve 之外”的已验证 pool/trade，并保留事件 ID、配对地址、时间和无法关联的原因。只有成熟度足以观察到目标窗口的 token 才进入分母。
4. **生命周期与删失**：为每个 token 定义入组时间、观测截止时间、50%/90% 阈值的可验证估值基线、采样粒度和缺失处理。尚未达到阈值的 token 是 right-censored；日报同时显示固定 horizon 的到达率、已到达样本的时间统计和删失数，不得将其视作在截止时达到阈值。
5. **情绪观察层**：逐条记录 provider/source、采集时间、语言/平台覆盖、查询或筛选规则、可用率、已删除/私密内容处理和延迟；该层只可描述外部观测，必须与链上事实字段分列。

## 5. 未来真实运行的最小证据包（未执行）

只有 Owner 授权后，一次真实运行才可以把本研究中的“结构核验”升级为“执行核验”。每次运行至少保留：

```text
Dune query ID / SQL body hash / query_version / execution ID /
parameters / source_as_of / result checksum / registry_version /
coverage_status / completeness / warnings / computed_at / failure reason
```

实时执行、数据库写入、调度、保留、交付、重试及监控仍不在本任务授权内；运行前须明确 Dune 授权、数据库目标、数据保留策略、交付目的地、retry 规则和监控/告警责任。

## 6. 验收命令

```text
npm run harness:task -- validate harness/tasks/MACRO-MICRO-DUNE-RESEARCH-010.json
npm run typecheck
npm test
git diff --check
```

## 7. 验收结果

| 命令 | 退出码 | 证据 |
| --- | --- | --- |
| `npm run harness:task -- validate harness/tasks/MACRO-MICRO-DUNE-RESEARCH-010.json` | 0 | `{"task_id":"MACRO-MICRO-DUNE-RESEARCH-010","status":"GREEN","errors":[]}` |
| `npm run typecheck` | 0 | `tsc -p tsconfig.json --noEmit` clean |
| `npm test` | 0 | 60 passed, 0 failed |
| `git diff --check` | 0 | 无空白错误；Git 仅提示本工作区会在后续 Git 操作时将该 Markdown 的 LF 转为 CRLF。 |

命令通过不改变本报告的执行边界，也不将任何未执行 Dune 蓝图升级为链上事实。

## 8. 最终结论

**GREEN_WITH_ADVISORY**

- 日报可以安全地描述 Solana 声明 DEX 注册表中的已定价 trade-leg 活动、唯一 `trader_id`、含 trade-leg 的交易 ID、Pump create-event 和有效 PumpSwap pool-create-event 的相对变化。
- 它仍**不能**回答“谁在买”“供给是否被吸收”“是否毕业”“流动性能否留存”或“近期 cohort 如何衰减”；这些需要后续任务建立 token/pool 级、时间可追溯且带删失处理的合同与固定样本测试。
- Robinhood 必须持续写明为 Uniswap v2/v3/v4 的 `partial_coverage`；BSC/Four.meme、情绪层、真实 Dune、数据库、调度和推送均未被本任务启用。
