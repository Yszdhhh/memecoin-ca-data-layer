# MACRO-HOURLY-LIFECYCLE-DESIGN-015

| 字段 | 内容 |
| --- | --- |
| task_id | `MACRO-HOURLY-LIFECYCLE-DESIGN-015` |
| tier / role | `T1 / researcher` |
| report_utc | `2026-07-21` |
| chain | `solana` only |
| write_set | `harness/tasks/MACRO-HOURLY-LIFECYCLE-DESIGN-015.json`, `docs/designs/MACRO-HOURLY-LIFECYCLE-DESIGN-015.md` |
| verdict | **GREEN_WITH_ADVISORY** — 指标合同、状态机和确定性验证向量已定义；只有日度/小时活动所依赖的源码结构已固定。流动性、token-to-pool 关联、外盘转化、价格/估值衰减和情绪来源均尚未执行验证，不能产生链上结论。 |

## 0. 目的、范围与硬边界

本设计把日报扩展为**市场环境观察**，而不是 token 买入、卖出或风险指令。它只设计 Solana-first 的离线合同；不实现查询、不执行 Dune、不建库、不调度、不推送、不启用任何链适配器。

本设计不改变也不读取为推断输入：CA 创建者事实、持仓清洗、Dev 行为、钱包集群、交易钱包质量规则。本文的“集中度”仅指**时间分布集中度**，绝不是 holder、钱包、人群或实体集中度。

BSC 与 Robinhood 不在本任务实现范围。Robinhood 后续即使有日报观测，也必须固定写为 Uniswap v2/v3/v4 的 `partial_coverage`；不得写成全链覆盖。Four.meme 仍为 `PARK`。

## 1. 证据状态与共同时间合同

### 1.1 已固定的结构证据

沿用研究任务 `MACRO-MICRO-DUNE-RESEARCH-010` 与 `MACRO-DUNE-QUERY-PROVENANCE-001` 的 Spellbook pin：

```text
b553234af744bef843a51e7f1cfd319d5cced24d
```

在该 pin 下，以下仅为**结构已核验**的来源：

| 来源 | 已知可支持的观察 | 不能从中推出 |
| --- | --- | --- |
| `dex_solana.trades` | `block_date`、`block_time`、`amount_usd`、`trader_id` 和 trade-leg 粒度的日度/小时 DEX 活动 | 买方、真实用户、净流、需求、流动性余额或 token 生命周期 |
| Pump `create` 指令映射 | 成功 create-event 的时间序列 | 唯一 token 数、毕业、迁移、外盘转化 |
| `pumpswap_solana.pools` | `created_at` 与 `is_valid_pool` 的有效 PumpSwap 建池事件 | 外盘/毕业事实、与某次 Pump launch 的 token 级匹配、流动性余额 |

所有这些来源仍是 **UNEXECUTED**：没有查询结果、`source_as_of`、覆盖率、价格覆盖、行数或数据延迟证据。

### 1.2 时间符号与严格 UTC 边界

| 符号 | 精确定义 |
| --- | --- |
| `D` | 一个 UTC 报告日，区间为 `[D 00:00:00Z, D+1 00:00:00Z)`；结束边界排除。 |
| `F` | 某来源宣称完整、最终化且可复现的最新 UTC 截止时点。没有 `F`，不得声称完整性。 |
| `W` | 小时画像的完整 UTC 日窗口，只允许 `60` 或 `90`。 |
| `E` | 小时画像的最后一个完整 UTC 日；`E+1 day <= F` 必须成立。 |
| `Δ` | 生命周期来源声明的原生采样间隔（秒）；没有来源声明的 `Δ`，时间到事件指标为 `PARK`。 |
| `t0` | 已验证的 token/pool cohort 基线时点；不同指标必须记录其基线事件和 pool identity。 |
| `H` | 固定随访 horizon；本设计采用 `1h`、`6h`、`24h`，主展示 horizon 为 `24h`。 |

所有存储和比较均以 UTC 为准。Asia/Shanghai 或其他时区只能是渲染层标签，不能参与分桶、日界线、cohort 年龄或比较窗口。

### 1.3 完整性、零值、未知值

1. **零值**仅在来源水位证明整个应观测区间已被覆盖、且该区间确实没有符合条件的事件时成立。
2. 来源缺失、迟到、未最终化、注册表改变、缺价或 token/pool 无法关联均是 `unknown`/`partial`，绝不可填零。
3. `completeness` 是“合同所需输入已完整出现的比例”，不是价格准确度、经济真实性或全链覆盖率。
4. 所有输出必须携带 `source`、`query_ref`、`query_version`/hash、`registry_version`、`source_as_of`、`computed_at`、`coverage_status`、`completeness` 和 `warnings`。未执行时 `completeness=0`，`source_as_of` 不得虚构。

## 2. 小时活动画像与时间集中度合同

### 2.1 Cohort 与窗口

画像窗口由 `E` 向前连续取 `W` 个**完整 UTC 日**：

```text
start_day = E - (W - 1) days
window = [start_day 00:00:00Z, (E + 1 day) 00:00:00Z)
expected_day_count = W
```

某一天只有在同一来源、同一注册表版本、同一查询版本证明它完整后，才计入 `covered_day_count`。若 `covered_day_count < W`：

- 可以保留原始部分聚合，`completeness = covered_day_count / W`；
- 必须写 `incomplete_profile_window` 与缺失 UTC 日；
- **不得**输出峰值小时、连续高活跃窗口、时间集中度或跨窗口比较。

### 2.2 每小时基础指标

`hour_utc = EXTRACT(HOUR FROM block_time)`，取值只能为 `0..23`。一个事件属于小时 `h` 当且仅当：

```text
window_start <= event_time < window_end
hour_utc(event_time) = h
```

| `metric_name` | 每日每小时基数 | 窗口聚合 `M_h` | 显示边界 |
| --- | --- | --- | --- |
| `dex_volume_usd` | `SUM(amount_usd)`，仅非空 USD trade leg | 对全部完整日的日小时 USD leg sum 求和 | `volume_is_leg_sum`；缺价 leg 不等于零成交额。 |
| `active_trader_address_hour_count` | 某日某小时 `COUNT(DISTINCT trader_id)`，并采用与 USD 成交额相同的 `amount_usd IS NOT NULL` 过滤 | 对 `day × hour` 计数求和 | 是“定价 trade-leg 地址-小时-日观察数”，不是整个窗口的唯一人、买家或需求方。必须标记 `priced_trade_rows_only`。 |
| `swap_transaction_count` | 完整 trade-leg 去重后，一个小时内的 `COUNT(DISTINCT tx_id)` | 对 `day × hour` 计数求和 | 是至少含一个已登记 trade leg 的交易 ID；路由可含多腿。 |
| `trade_leg_count` | `(tx_id, outer_instruction_index, inner_instruction_index, tx_index, block_month)` 去重后的行数 | 对 `day × hour` 计数求和 | 交易腿数不等于交易数、用户数或独立买卖意图。 |
| `pump_create_event_count` | 成功 Pump create 指令事件数 | 对 `day × hour` 计数求和 | `pump_only`；不是所有 Solana 发射、唯一 mint 或毕业。 |
| `valid_pumpswap_pool_create_event_count` | `is_valid_pool=true` 的 PumpSwap 建池事件数 | 对 `day × hour` 计数求和 | `not_migrate`；不得命名为外盘、毕业或转化。 |

对每个可显示指标：

```text
metric_value[h] = M_h
metric_share[h] = M_h / Σ(M_0 ... M_23)
```

若总和为零，在完整覆盖前提下可显示“该完整窗口无该类事件”；此时 `metric_share`、峰值、集中度和高活跃窗口均为 `not_applicable`，不得把 24 个小时伪装成均匀分布。

### 2.3 峰值、高活跃窗口与时间集中度

这些派生结果仅在 `covered_day_count = W` 且 `ΣM_h > 0` 时产生。

1. **峰值小时**：`peak_hour_utc = min(argmax_h(M_h))`；并列取数值较小的 UTC 小时。
2. **高活跃阈值**：`T = 0.80 × max_h(M_h)`；小时 `h` 为 high 当且仅当 `M_h >= T`。
3. **连续高活跃窗口**：把 24 个 UTC 小时视为环，枚举所有相邻 high-hour run。每个 run 的分数是 `(Σ metric_share[h], run_length, -start_hour)`；取字典序最大的 run。跨午夜 run 允许渲染为例如 `22:00–02:00 UTC`；若全部 24 小时为 high，窗口为 `00:00–24:00 UTC`。
4. **时间集中度 HHI**：

```text
intraday_time_concentration_hhi = Σ(metric_share[h]^2), h=0..23
effective_active_hours = 1 / intraday_time_concentration_hhi
```

它只描述已声明来源内活动在 UTC 小时上的集中程度。它不是 holder concentration、钱包集中度、操纵证据、机器人比例或市场质量结论。

### 2.4 小时画像覆盖与告警

| 条件 | `completeness` / 告警 | 渲染行为 |
| --- | --- | --- |
| 全部 `W` 天完整，注册表与查询版本不变 | `1.0` | 可输出全量画像、峰值、high window 和时间 HHI。 |
| 完整日少于 `W` | `covered_day_count/W`; `incomplete_profile_window` | 不输出峰值/high window/HHI；可显示“部分累计值”，但不作周期性主张。 |
| 窗口中版本变化 | `registry_or_query_version_changed` | 分段保存，不能拼成单个 profile。 |
| `amount_usd` 缺失 | `priced_trade_rows_only`，另保留 `unpriced_trade_leg_count`（若来源可提供） | 不把计价地址/成交额称为全量活动。 |
| 当前 UTC 日或未最终化日 | `unfinished_or_unfinalized_day_excluded` | 绝不并入 `E`。 |

## 3. 池级流动性留存合同（条件性；当前 PARK）

### 3.1 Cohort 单位与来源前置条件

流动性留存的单位是**一个明确的 token + pool**，而不是模糊的 token 市场或“全链流动性”。每个输入至少要有：

```text
token_address, pool_address, venue_registry_version, pool_created_at,
liquidity_snapshot_at, liquidity_usd, interval_seconds, source_as_of
```

当前输入没有核验出该 Solana 历史池流动性快照合同，因此本节为可审计设计，状态 `PARK`；不得由成交额、pool creation 或价格代替 `liquidity_usd`。

### 3.2 基线、随访与公式

设 `t0 = first_verified_external_pool_time`。只有一个版本化 venue registry 已证明该 pool 属于“launchpad/bonding curve 之外的外部 DEX”，才可使用该 `t0`；当前 PumpSwap 建池行本身不满足此证明。

要求 `Δ <= 300 seconds`。基线和随访选择规则如下：

```text
L0 = earliest finalized liquidity snapshot in [t0, t0 + Δ]
LH = earliest finalized liquidity snapshot in [t0 + H, t0 + H + Δ]
liquidity_retention_H = LH / L0
```

其中 `H ∈ {1h, 6h, 24h}`。若 `L0 <= 0`，记为 `invalid_baseline_liquidity`；若指定闭区间没有快照，记为 `missing_followup_snapshot`。不得使用 `t0+H` 前的快照，也不得静默用很晚的快照替代边界值。

同一 token 出现多个 pool 时，先按 pool 分别输出。没有经过版本化、可重放的 canonical-pool 选择规则之前，禁止合并为 token 级留存率。

### 3.3 流动性 cohort 状态

| 状态 | 判定 | 分母处理 |
| --- | --- | --- |
| `not_yet_mature` | `t0 + H + Δ > F` | 右删失于当前可观测截止；不进入 H 内留存点估计分母。 |
| `observed` | 基线、随访快照和整个来源水位均可验证 | 进入分母。`LH=0` 只有在快照明确给出 0 时才是观测零。 |
| `unknown_insufficient_coverage` | 目标区间来源不完整、快照缺失或 pool identity 不确定 | 不进入分母；不是零、不是流失。 |
| `invalid_baseline` | `L0` 缺失或非正 | 不进入分母，并单列原因。 |

输出必须同时显示 `eligible_pool_count`、`observed_pool_count`、各状态数及 `observed_pool_count / eligible_pool_count`；只显示留存中位数会掩盖选择偏差，禁止单独显示。

## 4. 发射到首个已验证外部池的转化合同（条件性；当前 PARK）

### 4.1 名称与反误导边界

允许的名称是：

```text
launch_to_first_verified_external_pool_rate_<H>
```

它不是 `graduation_rate`、`migration_rate` 或“供给被吸收率”。`graduation` 只有在权威 launchpad/program 事件明确给出毕业语义时才能单列事实；本设计不假设 Pump create 或 PumpSwap pool row 具有该语义。

### 4.2 必需关联证据

每个 launch cohort record 必须保留：

```text
launch_event_id, token_address, launch_time, launch_source_version,
external_pool_address, external_pool_time, pool_source_version,
venue_role, match_evidence, source_as_of
```

分子里的 pool 必须同时满足：

1. `token_address` 与 launch 中已解码且唯一的 token mint 一致；
2. pool 事件可验证，且 `external_pool_time >= launch_time`；
3. 版本化 venue registry 将其标记为 `external_dex`，并明确排除 launchpad/bonding curve；
4. 选择最早满足条件的 pool，按 `(external_pool_time, external_pool_address)` 排序打破并列。

当前日度 Pump create 计数没有 token mint 去重输出，当前 PumpSwap pool 研究也没有该 token 级关联或 `external_dex` 角色证明，因此不能执行该合同。

### 4.3 分母、公式与缺失处理

对于 `H ∈ {1h, 6h, 24h}`：

```text
eligible launches = unique successful launches with:
  (a) token_address decoded and unambiguous;
  (b) launch_time + H <= F;
  (c) complete launch and external-pool discovery coverage for [launch_time, launch_time + H].

converted launches = eligible launches whose first verified external pool is in
  [launch_time, launch_time + H].

rate_H = converted launches / eligible launches
```

- 只有在 pool discovery 覆盖完整而未找到匹配 pool 时，才是已知的 `not_converted_within_H`。
- 缺 token、重复 launch mint、未覆盖 venue、缺水位或无法证明 venue role 时是 `unknown_linkage_or_coverage`，不得记入未转化分子或分母。
- `launch_time + H > F` 是 `not_yet_mature`，不得把截至当前的未观察到外部 pool 当作失败。
- 日报必须同时显示 `eligible`、`converted`、`not_converted_within_H`、`unknown_linkage_or_coverage`、`not_yet_mature` 和关联覆盖率。

## 5. 生命周期衰减与 right-censoring 合同（条件性；当前 PARK）

### 5.1 通用观察网格

生命周期的每个 token/pool cohort 使用相同 `t0`、同一来源的 `Δ` 和明确的 pool identity。时间到事件合同要求 `Δ <= 300 seconds`，并在 `[t0, min(t0+H, F)]` 内满足：

```text
observed_slot_count / expected_slot_count = coverage_ratio
max_gap_seconds <= 2 × Δ
```

不插值穿越缺口。若 `coverage_ratio < 1`、`max_gap_seconds > 2Δ`、基线缺失或来源版本改变，该 cohort 对相应阈值记为 `unknown_insufficient_coverage`，而不是“未达到阈值”。

### 5.2 价格腰斩与跌 90%（只设计合同）

默认合同是 `pool_price_drawdown`，不是 market cap 或 FDV：

```text
P0 = earliest finalized pool price snapshot in [t0, t0 + Δ]
P(t) = observed price at each later source slot
reached_50pct = exists first t where P(t) <= 0.50 × P0
reached_90pct = exists first t where P(t) <= 0.10 × P0
time_to_threshold = first qualifying observed t - t0
```

若未来使用估值而非 pool price，必须额外存 `valuation_basis`、经验证供应量和每个快照的来源；在此之前，严禁使用或显示 `market_cap`/`FDV`。

### 5.3 活跃度与流动性衰减

池级活跃度需要能将 DEX trade leg 明确关联到该 pool。其基线和随访采用非重叠的一小时窗口：

```text
A0 = sum(priced DEX trade-leg USD in [t0, t0 + 1h))
AH = sum(priced DEX trade-leg USD in [t0 + H, t0 + H + 1h))
activity_retention_H = AH / A0
```

`A0 = 0`、池关联不确定、USD 覆盖未知或窗口不完整时，结果为 `invalid_or_unknown_activity_baseline`，不计算比值。它描述已定价 trade-leg 活动留存，不能叫真实需求留存。

流动性衰减使用第 3 节的 `liquidity_retention_H`。可由此定义阈值事件：

```text
liquidity_50pct_decay: first t where L(t) <= 0.50 × L0
liquidity_90pct_decay: first t where L(t) <= 0.10 × L0
```

`P(t)`、`A(t)` 与 `L(t)` 绝不能互相替代。

### 5.4 达到、删失与缺失的强制区分

| cohort 状态（每一阈值、每一 H） | 含义 | 日报处理 |
| --- | --- | --- |
| `reached` | 在可验证连续观察中第一次达到阈值 | 记录 `time_to_*`；纳入 reached count 与 reached-only 时间统计。 |
| `right_censored_not_reached` | cohort 已成熟且连续覆盖至 H，但尚未达到阈值 | 记录删失于 H；**不**填 `time_to_*=H`，不纳入 reached-only 中位数。 |
| `not_yet_mature` | 到 `F` 时年龄不足 H | 删失于当前年龄；不进入 H 内到达率分母。 |
| `unknown_insufficient_coverage` | 时间序列有缺口、基线/身份/版本不确定 | 不能被当成 reached 或 censored；排除在可比较分母外并显示原因。 |

固定 horizon 的到达率为：

```text
reached_within_H / (reached_within_H + right_censored_not_reached_within_H)
```

同时显示 `unknown_insufficient_coverage` 与 `not_yet_mature`。`median_time_to_*` 仅在 `reached` cohorts 中计算，并同时显示 reached count；不得把删失时间混入中位数。

## 6. 情绪观察层：只可并列，不可覆盖链上事实

情绪尚无批准的来源、许可、平台覆盖或执行证据，因此当前没有可显示值。未来任何情绪记录必须与链上表分离，最小字段为：

```text
observation_id, provider, source_type, platform, language_scope,
query_or_filter_version, observed_at, collected_at, coverage_status,
availability, content_retention_policy, source_reference, warnings
```

它只能表述“某已声明外部来源在某时点的观察”，例如来源可用率或经来源标注的讨论量；不得改写 DEX volume、pool、launch、活跃地址、流动性或 token cohort 事实，也不得被渲染为验证的需求、买盘、投资建议或 trader 质量结论。未采集、私密、删除或无权限内容统一为 `unknown`，不是零情绪。

## 7. 指标就绪矩阵与 016 实施边界

| 指标合同 | 当前结构证据 | 015 结论 | 016 可以做什么 | 仍不可做什么 |
| --- | --- | --- | --- | --- |
| Solana 小时 DEX 成交/地址小时/交易 ID/腿数 | `dex_solana.trades` 字段与粒度已固定 | 可设计 | 可做离线合同、未执行查询蓝图、固定样本与中文日报渲染 | 不执行 Dune，不称全链用户/需求。 |
| Pump create-event 小时画像 | Pump create 映射已固定 | 可设计 | 可做离线合同、蓝图、固定样本 | 不称唯一 token、毕业或全链发射。 |
| 有效 PumpSwap 建池 event 小时画像 | pool 行与 `is_valid_pool` 已固定 | 可设计 | 可做“valid PumpSwap pool-create event”合同 | 不称 external listing、迁移或转化。 |
| 时间 HHI | 依赖已定义的完整小时画像 | 可设计 | 可在固定样本上实现 | 不称钱包/holder/实体集中度。 |
| 池级流动性留存 | 无核验快照来源 | `PARK` | 仅可实现无数据时 fail-closed 的合同/fixture | 不产出真实留存。 |
| launch-to-first-external-pool | 无 mint-level linkage 与 venue role 证据 | `PARK` | 仅可实现明确 `unknown` 的固定样本状态机 | 不产出转化/毕业率。 |
| 价格、活跃度、流动性生命周期衰减 | 无池关联、连续快照/价格覆盖证据 | `PARK` | 仅可实现确定性 fixture 的删失/缺失判定 | 不报告真实腰斩、跌 90%、survival 或估值。 |
| 情绪观察 | 无来源/许可/覆盖合同 | `PARK` | 仅可保留空的来源边界，不采集 | 不显示情绪需求或覆盖链上事实。 |

`MACRO-HOURLY-LIFECYCLE-OFFLINE-016` 如启动，必须遵守上表：Solana-first；已具结构证据的小时活动可实现离线合同，其他 cohort 只能是 fail-closed 合同和固定样本，直到新的权威来源研究获得批准。它不授权 BSC/Robinhood CA 适配器、真实 Dune、数据库或交付运营。

## 8. 确定性验证向量

下列向量是合同测试案例，不是链上样本、Dune 结果或市场结论。

### V1：完整小时画像与时间 HHI

给定 `W=3`、`covered_day_count=3`，窗口内 `dex_volume_usd` 聚合为：

| hour UTC | `M_h` |
| --- | ---: |
| 00 | 50 |
| 01 | 30 |
| 02 | 20 |
| 03–23 | 0 |

预期：

```text
ΣM = 100
metric_share[00,01,02] = [0.50, 0.30, 0.20]
peak_hour_utc = 00
T = 0.80 × 50 = 40
high_activity_window = 00:00–01:00 UTC
HHI = 0.50² + 0.30² + 0.20² = 0.38
effective_active_hours = 1 / 0.38 = 2.63157895
```

### V2：不完整画像必须压制峰值结论

给定 `W=60`、`covered_day_count=57`：

```text
completeness = 57 / 60 = 0.95
warnings includes incomplete_profile_window
```

即使部分聚合的 `M_13` 最大，也不得输出 `peak_hour_utc`、high window 或 HHI；不得主张“13:00 UTC 是活跃时间”。

### V3：流动性边界快照选择

给定 `Δ=5m`、`t0=00:00Z`、`L0=100` 的首个快照在 `00:04Z`、`L24=40` 的首个合格快照在次日 `00:03Z`：

```text
liquidity_retention_24h = 40 / 100 = 0.40
```

若只有次日 `23:58Z` 的快照而 `[00:00Z, 00:05Z]` 没有快照，则结果必须为 `missing_followup_snapshot` / `unknown_insufficient_coverage`；不能使用 23:58Z 的早期值。

### V4：外部池转化的正确分母

给定四个成功且唯一的 launch，均已超过 24h：

| launch | 24h pool discovery 覆盖 | 首个匹配 external pool | 分类 |
| --- | --- | --- | --- |
| A | 完整 | launch 后 2h | `converted` |
| B | 完整 | launch 后 26h | `not_converted_within_24h` |
| C | 完整 | 无匹配 | `not_converted_within_24h` |
| D | 缺失 | 无法判断 | `unknown_linkage_or_coverage` |

预期：

```text
eligible = 3
converted = 1
launch_to_first_verified_external_pool_rate_24h = 1 / 3
unknown_linkage_or_coverage = 1
```

不得用 `1 / 4`，不得把该比率叫毕业率。

### V5：阈值事件、right-censoring 与缺失

给定 `H=24h`、`Δ=5m`、三个成熟且连续覆盖的 price cohorts，`P0=100`：

| cohort | 关键价格观测 | 50% 状态 | 90% 状态 |
| --- | --- | --- | --- |
| A | 2h 时 `P=49`，至 24h 从未 `<=10` | reached at 2h | right-censored at 24h |
| B | 4h 时 `P=10` | reached at 4h | reached at 4h |
| C | 至 24h 最低 `P=60` | right-censored at 24h | right-censored at 24h |

预期：

```text
50% reached_within_24h = 2 / 3
50% reached-only median time = median(2h, 4h) = 3h
90% reached_within_24h = 1 / 3
90% reached-only median time = 4h
```

第四个 cohort 若在首 24h 出现大于 `2Δ` 的缺口，必须为 `unknown_insufficient_coverage`，不加入上述三个分母；未达到阈值绝不能把 `time_to_*` 写成 24h。

## 9. 未来输出字段（合同，不是迁移）

后续实现应保留原始值与状态，而不是只保留一个结论。建议的最小逻辑字段如下：

```text
macro_hourly_chain_profile:
  chain, profile_window_days, profile_end_day_utc, metric_name, hour_utc,
  metric_value, metric_share, covered_day_count, expected_day_count,
  intraday_time_concentration_hhi, effective_active_hours,
  peak_hour_utc, high_activity_window_utc, registry_version,
  coverage_status, source, query_ref, query_version, source_as_of,
  computed_at, completeness, warnings

macro_pool_lifecycle_observation:
  chain, token_address, pool_address, venue_registry_version, t0,
  horizon_seconds, interval_seconds, metric_name, baseline_value,
  followup_value, retention_value, threshold, reached, time_to_threshold_seconds,
  cohort_status, observed_slot_count, expected_slot_count, max_gap_seconds,
  source, query_ref, query_version, source_as_of, completeness, warnings

macro_launch_external_pool_cohort:
  chain, token_address, launch_event_id, launch_time, external_pool_address,
  first_external_pool_time, horizon_seconds, conversion_status,
  venue_role, match_evidence, launch_source_version, pool_source_version,
  source_as_of, completeness, warnings

macro_sentiment_observation (separate layer):
  provider, source_type, platform, language_scope, query_or_filter_version,
  observed_at, collected_at, coverage_status, availability, source_reference,
  warnings
```

这些字段是后续离线合同的设计，不授权修改 `db/migrations/002_macro_daily_metrics.sql` 或创建数据库表。

## 10. 真实运行前检查清单（不执行）

在任何 live operation 前，Owner 必须分别授权并记录：

1. Dune 授权范围、查询归属、私有/公开策略和执行限额；
2. 数据库目标、访问边界、保留期和 live payload 是否允许留存；
3. 交付目的地、发送时段、失败重试、幂等键与人工暂停开关；
4. 每次运行的 query version/hash、execution ID、参数、结果哈希、`source_as_of`、覆盖率、告警与失败原因；
5. 延迟、缺失、版本漂移、重复运行和推送失败的监控与告警负责人。

以上未获授权前，真实 Dune、数据库、调度和推送均保持未启用。

## 11. 验收命令

```text
npm run harness:task -- validate harness/tasks/MACRO-HOURLY-LIFECYCLE-DESIGN-015.json
npm run typecheck
npm test
git diff --check
```

## 12. 验收结果

| 命令 | 退出码 | 证据 |
| --- | --- | --- |
| `npm run harness:task -- validate harness/tasks/MACRO-HOURLY-LIFECYCLE-DESIGN-015.json` | 0 | `{"task_id":"MACRO-HOURLY-LIFECYCLE-DESIGN-015","status":"GREEN","errors":[]}` |
| `npm run typecheck` | 0 | `tsc -p tsconfig.json --noEmit` clean |
| `npm test` | 0 | 60 passed, 0 failed |
| `git diff --check` | 0 | 无空白错误；Git 仅提示工作区部分已改文件会在后续 Git 操作时发生 LF/CRLF 转换。 |

命令通过只说明该设计文档与现有仓库兼容；不会把任何未执行的来源升级为链上事实。
## 13. 结论

**GREEN_WITH_ADVISORY**

- 小时活动、UTC 边界、时间集中度、缺失和完整性合同已经可供 Solana-first 离线固定样本实现。
- 流动性留存、可信外部池转化、腰斩/跌 90%、活跃度与流动性衰减均已给出 fail-closed 的 cohort、时间和删失合同，但其真实来源尚未核验，当前必须保持 `PARK`。
- 情绪只能在来源、覆盖、许可和事实边界获得独立核验后作为旁路观察层出现；它永远不能覆盖链上事实或变成买入信号。
