# Memecoin 链上情报辅助系统 — Goal Mode 端到端执行蓝图 V1
版本：V1  |  日期：2026-07-30  |  Repo：https://github.com/Yszdhhh/memecoin-ca-data-layer
用途：直接提供给 /goal 模式或本地总控 Agent，作为从当前 Shell/Hotpath 波次延续至本地 v1.0 的一杆到底执行规范。
## 如何使用
- 将本文件落盘为 `docs/blueprints/GOAL_EXECUTION_BLUEPRINT_V1.md`。
- 把“附录 A：Master Goal Prompt”提交给 /goal 模式。
- Agent 必须先执行 Entry Gate；当前 Shell/Hotpath 已通过时自动跳到 G1，不重复 M0。

## 执行授权摘要
- 用户可见闭环优先：每个里程碑必须交付浏览器可操作结果，不再只以测试或审计报告作为完成标志。
- Tier-A 链上事实优先：转账、持仓 owner 聚合、资金来源、买卖语义等必须来自可复现链上证据。
- Tier-B 永远是增强层：GMGN、DexScreener、Dune、Birdeye 等数据必须带来源和 unverified 状态，不能覆盖 Tier-A。
- 热路径与冷路径分离：首屏只做有界调用与缓存命中；历史重建、聚类和回测进入任务系统。
- Fail-closed：分页、供应量对账、数据完整度或排除覆盖不完整时，不得产生 confirmed 结论。
- 辅助研究而非交易执行：系统不托管私钥、不签名、不下单，不输出未经证据支持的买卖指令。
- 长期认知资产优先：第三方数据可以替换，自建地址标签、关系、历史命中、规则版本与证据链必须长期沉淀。
- 不做大爆炸重构：保留现有 src/domain/application 资产，以边界和新 apps/packages 渐进式演进。

## 必须停止并询问 Owner 的条件
- 需要改变顶层产品方向、增加新链、增加交易/签名功能或将系统变成全市场数据平台。
- 发现凭据、私密钱包明细、DPAPI 材料、原始敏感 Provider payload 可能进入 Git、日志或浏览器 bundle。
- 出现正余额丢失、分区不守恒、ratio 与分子分母不一致、PARTIAL 被升级为 confirmed 等 P1 数据错误。
- 单个 Provider 在两次有界修复后仍无法形成稳定契约，且没有预先批准的降级路径。
- Live 调用即将超出本蓝图预算上限，或需要新的付费方案/显著提高成本。
- main 出现无法通过无实现变更方式解决的冲突，或必须改写已审计历史。

# 1. 当前基线与文档假设
| 模块 | 状态 | 解释 |
| --- | --- | --- |
| M0 CA cleaning | DONE / GREEN / MERGED | PR #4；Repair-002 与独立 Audit-002 已进入 main |
| Operator Console Shell | 本轮执行中 | fixtures/脱敏数据优先；不得等待所有 Live 能力 |
| CA Holder Hotpath | 紧随 Shell | Helius-only、手工 CA、服务端凭据、有界 Live |
| 1,433 钱包 GMGN | 抓取完成但仅 Tier-B | Alpha=0；usable pool≈1370；shortlist=8；不得重新全量抓取 |
| CA Holder Pilot | 6 CA 已完成 | 3 accounting confirmed；全部 concentration unverified |
| 累计钱包 PnL | PARKED | 先做 3–5 个钱包链上账本，再决定扩容 |
| Web/地址库/自动化/流动性 | 尚未形成闭环 | 本蓝图将其纳入连续 Goal 路线 |

本蓝图采用“当前 OPERATOR-CONSOLE-SHELL-001 与 SOL-CA-HOLDER-HOTPATH-INTEGRATION-001 最终通过”的成功路径设计；若实际未通过，Entry Gate 先在原范围内完成 repair/audit/integration，然后自动续跑。
# 2. 产品北极星与边界
系统最终形态：CA 分析入口 + 地址情报资产库 + 历史钱包复核 + 任务编排 + 流动性水位 + Web 操作台。它是研究辅助工具，不是交易执行系统、全链数据湖或第三方平台的简单复制。
- 用户可见闭环优先：每个里程碑必须交付浏览器可操作结果，不再只以测试或审计报告作为完成标志。
- Tier-A 链上事实优先：转账、持仓 owner 聚合、资金来源、买卖语义等必须来自可复现链上证据。
- Tier-B 永远是增强层：GMGN、DexScreener、Dune、Birdeye 等数据必须带来源和 unverified 状态，不能覆盖 Tier-A。
- 热路径与冷路径分离：首屏只做有界调用与缓存命中；历史重建、聚类和回测进入任务系统。
- Fail-closed：分页、供应量对账、数据完整度或排除覆盖不完整时，不得产生 confirmed 结论。
- 辅助研究而非交易执行：系统不托管私钥、不签名、不下单，不输出未经证据支持的买卖指令。
- 长期认知资产优先：第三方数据可以替换，自建地址标签、关系、历史命中、规则版本与证据链必须长期沉淀。
- 不做大爆炸重构：保留现有 src/domain/application 资产，以边界和新 apps/packages 渐进式演进。

# 3. 目标架构
建议采用渐进式模块化：不进行一次性目录大迁移；新应用落在 `apps/`，稳定契约逐步进入 `packages/`，现有 `src/` 通过适配层迁移。
```text
apps/operator-console   React/Vite 操作台
apps/operator-api       本地只读 API
apps/worker             任务 worker
packages/contracts      跨应用稳定 DTO/JSON Schema
packages/domain         领域对象与纯函数规则
packages/providers      Helius/DexScreener/GMGN/Dune
packages/analytics      holder/wallet/cluster/liquidity
packages/storage        PostgreSQL repositories
packages/reporting      Judgment/Evidence/ViewModel
packages/testkit        fixtures/replay/fake providers
```

## 数据可信度
- Tier-A：可复现链上事实；confirmed 的必要条件。
- Tier-B：平台观察与市场增强；永远带 source/unverified。
- Derived：版本化纯函数产生；必须保留输入、规则版本和完整度。
- Judgment：只消费证据，不主动抓数；LLM 仅负责表述。

# 4. 最终页面与展示数据
## 4.1 CA Analysis
| 区块 | 字段 | 可信度要求 |
| --- | --- | --- |
| A. 身份与市场 | mint、symbol/name、program、decimals、supply、价格、MC/FDV、流动性、24h 量、pair age、主要池、links | Tier-A 身份 + Tier-B 市场 |
| B. 数据可信度 | accounting、pagination、exclusion coverage、concentration、source watermark、observedAt、warnings | 必须首屏可见 |
| C. 权限与发射 | mint/freeze authority、metadata mutable、creator/authority、launch platform、create signature | Tier-A 优先 |
| D. 持仓结构 | raw/cleaned/excluded/unresolved owner、Top1/5/10/20/50/100、residual、holder distribution | 分子分母和 universe 必须可见 |
| E. Pool/基础设施 | 池地址、program owner、LP/bonding curve、排除证据、coverage | 无硬证据不 confirmed 排除 |
| F. 地址库命中 | Tier-B shortlist、verified wallet、风险地址、KOL/标签、历史 CA 命中 | 本地集合交集 |
| G. Dev/Creator | 初始分配、当前持仓、转移/卖出、关联地址、行为时间线 | 事实与推断分开 |
| H. 早期买家 | 前 N 买家、首买区块/时间、买入量、当前持仓、卖出/转走、集中度 | 列表版本固定 |
| I. Cluster/关系 | 共同 funder、同窗口、共同代币、共同对手方、cluster 证据 | 多证据加权 |
| J. 历史对照 | 相似历史币、重复赢家、重复风险集群、命中数量与结果 | 仅使用 as-of 可用数据 |
| K. 研究结论 | 分维度风险、机会、数据缺口、需要人工复核、下一步动作 | 不输出自动买卖 |
| L. 证据与任务 | 来源、签名/slot、规则版本、任务调用、错误、重放链接 | 全量可追溯 |

## 4.2 Wallet
| 区块 | 字段 |
| --- | --- |
| 身份/状态 | 地址、alias、标签、Tier、verification、first/last seen、review status |
| 7d/30d 平台观察 | GMGN PnL/胜率/交易数/完整度/warning，明确 Tier-B |
| 链上账本 | swap/transfer/airdrop/unknown、token lots、现金流、余额守恒 |
| 表现 | realized/unrealized、成本基础、入场/离场 MC、持有时长、胜率、样本量 |
| 参与历史 | 命中 CA、早期/后期、盈利/亏损、重复参与 cluster |
| 资金与关系 | 首次 funding、共同 funder、关系边、cluster membership |
| 运营 | 备注、标签版本、watchlist、review、导入/导出 |

## 4.3 Address Library
- 地址搜索、alias、标签、来源、Tier、confidence、verification、first/last seen。
- CA 命中历史、wallet-token edges、cluster、review queue、标签版本和人工备注。
- 批量导入/导出只允许显式本地操作；Git 只保存不可逆摘要。

## 4.4 Task Center
- 任务状态、幂等 lineage、输入、Provider、预算、调用数、时延、重试、错误、产物和重放。
- 任何 Live 任务都显示手工/定时来源、凭据状态、budget exhausted 和 partial 原因。

## 4.5 Liquidity Dashboard
- 总体水位、Solana DEX 活动、meme 发射/毕业、新池、活跃地址、收入、7d/30d 分位、数据新鲜度。
- 与 CA 热路径独立刷新；CA 页面只读取最新摘要。

# 5. 统一契约与数据模型
## 5.1 API endpoints
| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | /api/v1/health | 服务、DB、worker、Provider 配置（不泄露值） |
| POST | /api/v1/ca-tasks | 手工提交一个 Solana CA 分析任务 |
| GET | /api/v1/tasks/:id | 任务状态、预算、错误、输出引用 |
| GET | /api/v1/ca-results/:id | CaAnalysisResponseV2 |
| GET | /api/v1/tokens/:mint/latest | 最近可用快照（缓存优先） |
| GET | /api/v1/wallets/:address | WalletProfileV2 与证据摘要 |
| GET | /api/v1/addresses | 搜索/过滤地址库 |
| POST | /api/v1/addresses/:address/labels | 新增人工标签/备注 |
| GET | /api/v1/liquidity/latest | 最新 LiquiditySnapshotV1 |
| GET | /api/v1/liquidity/history | 历史趋势和分位 |
| POST | /api/v1/schedules | 创建限定 watchlist/日报计划 |

## 5.2 PostgreSQL 核心表
| 表 | 主要内容 |
| --- | --- |
| tokens | mint PK、chain、program、decimals、first_seen、metadata |
| token_observations | token、source、observed_at、watermark、payload_ref、status |
| holder_snapshots | token、slot、raw/cleaned/excluded/unresolved、accounting status |
| owner_holdings | snapshot、owner、amount_raw、class、evidence_ref |
| wallets | address PK、alias、tier、verification、first/last seen |
| wallet_labels / label_versions | label、source、confidence、status、valid_from/to、evidence |
| wallet_token_events | wallet、token、signature、event_type、amount、quote、slot/time |
| wallet_token_ledgers | wallet、token、cost basis、realized/unrealized、completeness |
| address_relations | from/to、edge_type、weight、evidence、rule_version |
| clusters / cluster_members | cluster、status、score、member、evidence bundle |
| jobs / job_runs | type、input hash、state、budget、lease、attempt、output |
| provider_calls | run、provider、operation、latency、status、cost、scrubbed error |
| liquidity_snapshots | metric set、window、values、freshness、quality |
| judgments / evidence_items | subject、dimension、verdict、confidence、rule_version、evidence |

## 5.3 通用 Evidence Envelope
```json
{
  "source": "helius|solana_rpc|dexscreener|gmgn|dune|manual",
  "tier": "A|B|DERIVED",
  "verificationStatus": "confirmed|partial|unverified|unavailable",
  "observedAt": "ISO-8601",
  "sourceWatermark": {"slot": 0, "cursor": null, "executionId": null},
  "completeness": 0.0,
  "ruleVersion": "string|null",
  "evidenceRefs": ["signature/account/report ref"],
  "warnings": []
}
```

# 6. 里程碑总览
| 里程碑 | 名称 | 发布边界 | 任务数 | 核心用户结果 |
| --- | --- | --- | --- | --- |
| G0 | 当前波次收口与执行基线冻结 | v0.1 可操作壳层 | 3 | 在不重复 M0 的前提下，完成 Shell 与 Holder Hotpath；若本轮已 GREEN，则只做集成与契约冻结，然后自动进入 G1。 |
| G1 | Live Console 闭环与 CA 稳定性 | v0.2 可用 CA 工作台 | 3 | 让用户在网页输入 CA、发起任务、查看真实 Helius 结果，并用 20–30 个公开 CA 量化稳定性。 |
| G2 | CA Analysis Core v1 | v0.3 完整 CA 基础分析 | 5 | 从“持仓对账工具”升级为基础 CA 研究卡：市场、权限、池子证据、持仓、质量与可解释摘要。 |
| G3 | 地址情报资产库落地 | v0.4 可运营地址库 | 5 | 把本地 JSON/私密表升级为可搜索、可标注、可追溯、可被 CA 命中的长期地址资产。 |
| G4 | 受控任务编排与自动化 | v0.5 可持续抓取 | 4 | 替换散落脚本：建立本地优先、可审计、有预算、有重试的任务系统；先手工队列，再有限定时。 |
| G5 | 钱包链上复核与真实 PnL | v0.6 可验证钱包研究 | 5 | 用 3–5 个 shortlist 证明链上历史、wallet-token ledger 与 PnL 口径，再扩至 20–50；不直接处理 1433。 |
| G6 | 高级 CA 情报与关系图 | v0.8 情报引擎 | 6 | 补齐 Dev、早期买家、资金关系、Cluster、跨 CA 历史与解释性判断，使 CA 分析产生真正的长期认知资产。 |
| G7 | 宏观与链上流动性看板 | v0.9 市场水位 | 4 | 以每日级刷新提供 Solana/加密总体与 meme 一级市场水位，和 CA 热路径分离。 |
| G8 | 回测、预警、硬化与本地发布 | v1.0 本地研究辅助工具 | 5 | 用历史回放校准规则，加入 watchlist/提醒，完成安全、备份、CI 与可重复本地部署。 |

# 7.1 G0 — 当前波次收口与执行基线冻结
目标：在不重复 M0 的前提下，完成 Shell 与 Holder Hotpath；若本轮已 GREEN，则只做集成与契约冻结，然后自动进入 G1。
发布边界：v0.1 可操作壳层
### GOAL-ENTRY-GATE-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 治理 |
| 依赖 | 当前 main |
| 实现范围 | 读取 main、CURRENT_WAVE、Shell/Hotpath 报告与 PR；确认是否 GREEN/已合并；修复真实 UTF-8 损坏但不因终端乱码误改文件。 |
| 交付物 | entry-gate.json、基线 SHA、当前波次状态 |
| 验收/Owner Gate | 不得重跑 M0；未通过的当前任务在原范围内完成或 repair；无阻塞则继续。 |
| Live 边界 | 0（仅核验） |

### ARCH-CONSOLE-CLARIFICATION-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 架构 |
| 依赖 | Entry Gate |
| 实现范围 | 澄清 PROJECT_ARCHITECTURE 中“not a UI”：Operator Console 是访问层，不拥有 Provider、规则或判断；核心壁垒仍是数据与认知资产。 |
| 交付物 | binding architecture clarification + required reading 更新 |
| 验收/Owner Gate | 不改变四层架构；不把 UI 逻辑写入 domain/provider。 |
| Live 边界 | 0 |

### CURRENT-WAVE-INTEGRATION-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 产品/热路径 |
| 依赖 | Shell 与 Hotpath 实现 |
| 实现范围 | Shell 与 Hotpath 各自测试、PR、merge commit；API summary 直接暴露 accountingEligible/exclusionCoverage/concentrationEligible。 |
| 交付物 | 可启动 Console、只读本地 API、任务详情和 CA 结果 |
| 验收/Owner Gate | 根项目+Console 门禁全绿；bundle 无凭据；Hotpath 有界 smoke 通过。 |
| Live 边界 | 1–2 CA，≤20 总请求 |

# 7.2 G1 — Live Console 闭环与 CA 稳定性
目标：让用户在网页输入 CA、发起任务、查看真实 Helius 结果，并用 20–30 个公开 CA 量化稳定性。
发布边界：v0.2 可用 CA 工作台
### OPERATOR-CONSOLE-LIVE-WIRING-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 输入/产品 |
| 依赖 | G0 |
| 实现范围 | HttpOperatorConsoleDataSource 接入本地 API；轮询任务状态；错误、PARTIAL、预算耗尽、凭据缺失均有明确 UI。 |
| 交付物 | 真实 CA 任务流、任务中心、结果链接 |
| 验收/Owner Gate | 浏览器不接触 Key；前端不能直接请求 Provider；fixture/live 标签清晰。 |
| Live 边界 | 手工触发 |

### SOL-CA-HOLDER-STABILITY-BATCHES-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 热路径 |
| 依赖 | Live Wiring |
| 实现范围 | 三个批次，每批 5–10 个手工公开 CA；记录分页、残差、请求、时延、重试、shape drift。 |
| 交付物 | 30 CA 稳定性数据集与问题矩阵 |
| 验收/Owner Gate | 总并发=1；每 CA ≤20 请求；PARTIAL 不 confirmed；禁止自动发现。 |
| Live 边界 | ≤30 CA，≤600 请求 |

### OBSERVABILITY-BASELINE-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 基础设施 |
| 依赖 | Stability |
| 实现范围 | 统一结构化日志、provider_call、task_run、source watermark、错误分类与脱敏。 |
| 交付物 | 本地观测面板/日志查询、基线指标 |
| 验收/Owner Gate | 日志不含完整 URL/Key/raw payload；可按 taskId 重放。 |
| Live 边界 | 无新增业务调用 |

# 7.3 G2 — CA Analysis Core v1
目标：从“持仓对账工具”升级为基础 CA 研究卡：市场、权限、池子证据、持仓、质量与可解释摘要。
发布边界：v0.3 完整 CA 基础分析
### MARKET-CONTEXT-ADAPTER-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 热路径/Tier-B |
| 依赖 | G1 |
| 实现范围 | DexScreener 市场快照：价格、FDV/MC、流动性、24h 量、pair age、pair 地址、links；缓存与降级。 |
| 交付物 | MarketSnapshotV1 + UI 市场栏 |
| 验收/Owner Gate | 缺失即 null；不得覆盖链上供应量；source=DEXSCREENER/unverified。 |
| Live 边界 | ≤3 calls/CA |

### TOKEN-AUTHORITY-METADATA-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 热路径/Tier-A |
| 依赖 | G1 |
| 实现范围 | mint/freeze authority、token program、decimals、supply、metadata、creator/authority 观察；slot watermark。 |
| 交付物 | TokenIdentityAndAuthorityV1 |
| 验收/Owner Gate | 每个字段有来源；解析失败降级，不猜测。 |
| Live 边界 | Helius/RPC 有界 |

### POOL-EVIDENCE-REGISTRY-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | Tier-A 清洗 |
| 依赖 | Market + Holder |
| 实现范围 | 建立 Pump/PumpSwap/Raydium/Meteora 等 program/pool evidence registry；pair 地址仅作线索，链上 owner/program 证据决定 confirmed exclusion。 |
| 交付物 | PoolEvidenceV1、规则版本、回归 fixtures |
| 验收/Owner Gate | 无 owner-level hard evidence 不整体排除；coverage 可量化。 |
| Live 边界 | 公开程序/账户有界查询 |

### CA-ANALYSIS-COMPOSER-V1-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 判断 |
| 依赖 | 前三项 |
| 实现范围 | 合成 Token/Market/Authority/Holder/Pool/DataQuality；输出证据包和非交易性 Research Priority。 |
| 交付物 | CaAnalysisResponseV2 |
| 验收/Owner Gate | 判断层不 fetch；每个结论可追溯；无单一黑盒 Alpha Score。 |
| Live 边界 | 0（纯函数） |

### CA-DASHBOARD-V1-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 产品 |
| 依赖 | Composer |
| 实现范围 | 实现最终 CA 页面基础版：摘要、市场、权限、持仓、集中度、数据质量、来源与任务轨迹。 |
| 交付物 | CA Dashboard v1 + 截图验收 |
| 验收/Owner Gate | accounting 与 concentration 分开展示；null 不显示为 0。 |
| Live 边界 | 经 API |

# 7.4 G3 — 地址情报资产库落地
目标：把本地 JSON/私密表升级为可搜索、可标注、可追溯、可被 CA 命中的长期地址资产。
发布边界：v0.4 可运营地址库
### ADDRESS-STORE-SCHEMA-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 冷路径/存储 |
| 依赖 | G2 |
| 实现范围 | 本地 PostgreSQL：addresses、labels、label_versions、observations、wallet_token_edges、review_queue。 |
| 交付物 | 迁移、repository、备份/导出策略 |
| 验收/Owner Gate | 明文私密批量数据不进 Git；所有标签有 source/tier/status。 |
| Live 边界 | 0 |

### TIERB-WALLET-IMPORT-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 冷路径 |
| 依赖 | Schema |
| 实现范围 | 从本地 chainfm_out 导入≈1370 usable pool、8 shortlist、9 review；导入工具只本地运行。 |
| 交付物 | 导入清单、SHA、计数、不可逆 Git 摘要 |
| 验收/Owner Gate | 不上传地址明细；不产生 Alpha/confirmed 标签。 |
| Live 边界 | 0 |

### LABEL-OPS-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 产品/存储 |
| 依赖 | Schema |
| 实现范围 | 标签、备注、置信度、验证状态、来源、历史版本、批量导入导出与 review workflow。 |
| 交付物 | Address Label API + UI |
| 验收/Owner Gate | 人工标签与自动标签分离；升级 confirmed 需证据。 |
| Live 边界 | 0 |

### CA-ADDRESS-HIT-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 热路径 |
| 依赖 | Address Store |
| 实现范围 | CA 当前 owner 与本地地址库集合交集；输出命中、标签、历史 CA、验证状态。 |
| 交付物 | AddressHitSummaryV1 |
| 验收/Owner Gate | 本地集合查询，不逐钱包调用 Provider；不泄漏私密全库。 |
| Live 边界 | 0 |

### ADDRESS-DASHBOARD-V1-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 产品 |
| 依赖 | 上述 |
| 实现范围 | 地址搜索、过滤、详情、标签、命中历史、review 队列、导入导出。 |
| 交付物 | Address Library 页面 v1 |
| 验收/Owner Gate | 权限与本地数据提示；敏感导出显式操作。 |
| Live 边界 | 0 |

# 7.5 G4 — 受控任务编排与自动化
目标：替换散落脚本：建立本地优先、可审计、有预算、有重试的任务系统；先手工队列，再有限定时。
发布边界：v0.5 可持续抓取
### ORCHESTRATOR-CORE-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 输入/基础设施 |
| 依赖 | G3 |
| 实现范围 | PostgreSQL job queue、状态机、幂等键、lease、FOR UPDATE SKIP LOCKED、worker heartbeat。 |
| 交付物 | jobs/job_runs/provider_calls 表与 worker |
| 验收/Owner Gate | 进程重启可恢复；同输入不重复执行；不依赖 Redis 才能正确。 |
| Live 边界 | 0 |

### PROVIDER-BUDGET-CIRCUIT-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 基础设施 |
| 依赖 | Core |
| 实现范围 | 按 task/provider 限流、预算、timeout、retry、429/backoff、circuit breaker。 |
| 交付物 | 统一 ProviderExecutor |
| 验收/Owner Gate | 预算硬截止；错误分类稳定；无无限重试。 |
| Live 边界 | 受配置控制 |

### TASK-CENTER-LIVE-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 产品 |
| 依赖 | Core |
| 实现范围 | 任务创建、队列、运行、partial、失败、重跑、产物、调用预算和错误时间线。 |
| 交付物 | 真实任务中心 |
| 验收/Owner Gate | 每次重跑需新 run 但共享 idempotency lineage。 |
| Live 边界 | 手工 |

### CONTROLLED-SCHEDULE-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 自动化 |
| 依赖 | 稳定运行 |
| 实现范围 | 仅对用户选择的 CA/watchlist 和每日流动性任务开放计划；默认关闭。 |
| 交付物 | schedule 表、启停、下一次运行、预算 |
| 验收/Owner Gate | 禁止全市场扫描；频率和清单显式；可一键停用。 |
| Live 边界 | 有限定时 |

# 7.6 G5 — 钱包链上复核与真实 PnL
目标：用 3–5 个 shortlist 证明链上历史、wallet-token ledger 与 PnL 口径，再扩至 20–50；不直接处理 1433。
发布边界：v0.6 可验证钱包研究
### WALLET-HISTORY-HELIUS-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | Tier-A 冷路径 |
| 依赖 | G4 |
| 实现范围 | getTransactionsForAddress/签名分页、ATA 关联、完整度、重试、slot watermark。 |
| 交付物 | WalletTransactionHistoryV1 |
| 验收/Owner Gate | 历史不完整明确 PARTIAL；有成本预算；原始响应短期本地。 |
| Live 边界 | 3–5 钱包，每钱包≤100 calls |

### WALLET-TOKEN-LEDGER-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 冷路径 |
| 依赖 | History |
| 实现范围 | 区分 swap/transfer/airdrop/LP/unknown，构建 token lot、现金流、余额和事件账本。 |
| 交付物 | WalletTokenLedgerV1 |
| 验收/Owner Gate | 买卖语义不确定时 unknown；金额守恒；可重放。 |
| Live 边界 | 0（解析） |

### WALLET-PNL-V1-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 派生 |
| 依赖 | Ledger |
| 实现范围 | 已实现/未实现 PnL、成本基础、入场/离场 MC、持有时长、胜率与数据完整度。 |
| 交付物 | WalletPerformanceV1 |
| 验收/Owner Gate | 价格缺失、转入成本未知时不得伪造 PnL；明确会计口径。 |
| Live 边界 | 市场价格补充 Tier-B |

### SHORTLIST-VERIFY-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 研究 |
| 依赖 | PnL |
| 实现范围 | 复核 3–5 个，扩到 20–50 的条件由准确率和成本决定；更新标签。 |
| 交付物 | verified/rejected/insufficient 结果与证据 |
| 验收/Owner Gate | GMGN 仅对照；确认标签只由 Tier-A+规则产生。 |
| Live 边界 | 有界 |

### WALLET-DASHBOARD-V1-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 产品 |
| 依赖 | 上述 |
| 实现范围 | 钱包账本、PnL、参与代币、入场 MC、标签、证据、CA 命中与 review。 |
| 交付物 | Wallet Dashboard v1 |
| 验收/Owner Gate | 链上 verified 与第三方 observation 明确区分。 |
| Live 边界 | 经任务 |

# 7.7 G6 — 高级 CA 情报与关系图
目标：补齐 Dev、早期买家、资金关系、Cluster、跨 CA 历史与解释性判断，使 CA 分析产生真正的长期认知资产。
发布边界：v0.8 情报引擎
### CREATOR-DEV-FACTS-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | Tier-A/冷路径 |
| 依赖 | G5 |
| 实现范围 | creator/authority、初始分配、dev 地址集合、转移与卖出事实；Pump create 解析。 |
| 交付物 | DevBehaviorV1 |
| 验收/Owner Gate | Creator/Dev 关系必须有 signature/account evidence。 |
| Live 边界 | 有界历史 |

### EARLY-BUYER-SNIPER-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | Tier-A/派生 |
| 依赖 | 交易解码 |
| 实现范围 | 首批买家、区块/时间、首买占比、当前持仓、转走/卖出区分和完整度。 |
| 交付物 | EarlyBuyerCohortV1 |
| 验收/Owner Gate | 无法区分转走和卖出时不强判；名单版本固定。 |
| Live 边界 | 有界历史 |

### FUNDING-GRAPH-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 冷路径 |
| 依赖 | Wallet History |
| 实现范围 | 首次 SOL funding、共同 funder、时间窗、共同对手方、同买卖窗口等边。 |
| 交付物 | AddressRelationEdgeV1 |
| 验收/Owner Gate | 每条边有 evidence/weight/source；不因单一弱边判集团。 |
| Live 边界 | 短名单/高价值 owner |

### CLUSTER-ENGINE-V1-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 判断 |
| 依赖 | Graph |
| 实现范围 | 版本化加权聚类与 cluster evidence；区分 confirmed/suspected/coincidental。 |
| 交付物 | ClusterSummaryV1 |
| 验收/Owner Gate | 阈值通过回放校准；结果可解释。 |
| Live 边界 | 0 |

### CROSS-CA-ARCHIVE-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 冷路径 |
| 依赖 | Address Store |
| 实现范围 | CA→wallet、wallet→CA、cluster→CA、历史赢家/风险集群反向索引。 |
| 交付物 | CrossTokenMatchV1 |
| 验收/Owner Gate | 查询本地资产，不在线逐钱包抓取。 |
| Live 边界 | 0 |

### JUDGMENT-ENGINE-V1-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 判断 |
| 依赖 | 全部 |
| 实现范围 | 风险/机会分维度输出：安全、持仓、Dev、早期买家、地址质量、流动性、完整度；规则证据先于 LLM 文案。 |
| 交付物 | JudgmentBundleV1 |
| 验收/Owner Gate | LLM 只改写，不制造事实；不输出交易执行建议。 |
| Live 边界 | 0 |

# 7.8 G7 — 宏观与链上流动性看板
目标：以每日级刷新提供 Solana/加密总体与 meme 一级市场水位，和 CA 热路径分离。
发布边界：v0.9 市场水位
### LIQUIDITY-DATA-PIPELINE-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 独立冷路径 |
| 依赖 | G4 |
| 实现范围 | Dune/公开数据查询执行、结果缓存、更新时间、缺失状态；保留现有 SQL 并版本化。 |
| 交付物 | LiquidityRawSnapshotV1 |
| 验收/Owner Gate | 日级刷新；查询失败保留上一版并标 stale。 |
| Live 边界 | 每日有限 API |

### LIQUIDITY-METRICS-V1-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 派生 |
| 依赖 | Data Pipeline |
| 实现范围 | DEX volume、swap、活跃地址、新币、毕业/外盘、新池、收入、7d/30d 分位、综合水位。 |
| 交付物 | LiquiditySnapshotV1 + metric dictionary |
| 验收/Owner Gate | 每项有公式/分母/窗口/来源；综合水位可拆解。 |
| Live 边界 | 0 |

### LIQUIDITY-DASHBOARD-V1-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 产品 |
| 依赖 | Metrics |
| 实现范围 | 总体水位、趋势、分位、发射质量、资本轮动、异常和数据新鲜度。 |
| 交付物 | Liquidity Dashboard v1 |
| 验收/Owner Gate | 图表不隐藏缺失；CA 页面只消费摘要，不耦合刷新。 |
| Live 边界 | 经 API |

### DAILY-BRIEF-V1-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 报告 |
| 依赖 | Dashboard |
| 实现范围 | 生成每日结构化简报，列变化、原因、风险和待观察项。 |
| 交付物 | 日报 JSON/Markdown/Web 卡片 |
| 验收/Owner Gate | 只引用可追溯指标；无数据时不编故事。 |
| Live 边界 | 0 |

# 7.9 G8 — 回测、预警、硬化与本地发布
目标：用历史回放校准规则，加入 watchlist/提醒，完成安全、备份、CI 与可重复本地部署。
发布边界：v1.0 本地研究辅助工具
### REPLAY-BACKTEST-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 研究 |
| 依赖 | G6/G7 |
| 实现范围 | 按时间点重建可见信息，防止未来数据泄漏；测试规则与结局关系。 |
| 交付物 | ReplayDatasetV1、前视回测报告 |
| 验收/Owner Gate | 严格 as-of；不可用当前标签解释历史。 |
| Live 边界 | 0 |

### SCORE-CALIBRATION-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 判断 |
| 依赖 | Backtest |
| 实现范围 | 校准阈值、分位、误报/漏报；替代拍脑袋 40%/55% 阈值。 |
| 交付物 | versioned rules + calibration report |
| 验收/Owner Gate | 无样本支持的指标只显示 observation。 |
| Live 边界 | 0 |

### WATCHLIST-ALERTS-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 产品/自动化 |
| 依赖 | Orchestrator |
| 实现范围 | 重点 CA/地址变化提醒：持仓、Dev sell、地址库命中、流动性异常；仅研究通知。 |
| 交付物 | watchlist、alert events、Web 通知 |
| 验收/Owner Gate | 去重、冷却、证据链接；默认不开自动交易。 |
| Live 边界 | 限定 watchlist |

### SECURITY-RETENTION-CI-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 硬化 |
| 依赖 | 全部 |
| 实现范围 | secret scan、依赖审计、CORS、本地鉴权、日志脱敏、raw retention、备份恢复、CI。 |
| 交付物 | 安全基线与恢复演练 |
| 验收/Owner Gate | 恢复可验证；敏感文件永不进 Git；所有 PR 自动门禁。 |
| Live 边界 | 0 |

### LOCAL-RELEASE-V1-001
| 属性 | 内容 |
| --- | --- |
| 所属层 | 发布 |
| 依赖 | 全部 |
| 实现范围 | 一键本地启动、配置向导、诊断、数据目录、升级/回滚、用户手册。 |
| 交付物 | v1.0 tag/release notes/local bundle |
| 验收/Owner Gate | 新环境可按文档启动；不依赖开发者手工改代码。 |
| Live 边界 | 受配置 |

# 8. Goal Mode 连续执行协议
- 每个里程碑使用独立 feature 分支；实现、测试、产品验收、独立审计、正常 merge commit 后自动进入下一里程碑。
- 每个里程碑最多一个实现任务包、一个审计任务包和两轮 repair；禁止无限新增微任务。
- Agent 可自行决定非核心 UI 样式、内部类名、文件拆分和轻量依赖；不得改变最终数据契约和信任语义。
- 所有 Live Provider 经统一 ProviderExecutor，服务端读取凭据，前端只能调用本地 API。
- 独立 auditor 不修改实现；有 finding 时返回 implementer repair，再由 auditor 复验。
- GREEN 自动 merge；P1/P0、泄漏、预算或顶层方向变化才停止。

## 分支与合并策略
```text
main -> feature/<milestone-or-task>
implement -> gates -> independent audit -> bounded repair -> audit GREEN
normal push -> PR -> merge commit/no-ff -> main integration gates -> next milestone
禁止 force-push / rebase audited commits / squash audited lineage
```

## 统一门禁
- harness:doctor、typecheck、unit/contract/integration tests、build。
- deterministic replay、amount conservation、ratio consistency、unknown-field fail-closed。
- secret/provider/raw-payload/private-wallet/browser-bundle/local-path scans。
- 用户可见验收截图与操作清单。
- Live budget、provider calls、watermark 和 scrubbed output SHA。

# 9. 技术选择与实现约束
| 领域 | 推荐实现 | 原因/约束 |
| --- | --- | --- |
| Web | React + Vite + TypeScript；TanStack Query/Table；轻量图表库 | 高密度研究台；不在前端放业务规则和凭据 |
| API | Fastify 或等价轻量 Node server + JSON Schema/Zod | 严格输入、日志脱敏、低样板；不引入大型企业框架 |
| System of Record | PostgreSQL + 现有 pg/migrations | 地址、任务、证据和版本关系适合关系模型 |
| Queue | PostgreSQL job queue + SKIP LOCKED | 本地工具足够可靠；先不强依赖 Redis |
| Cache/Lock | Redis 可选 | 仅性能优化，不影响正确性 |
| Provider | Helius Tier-A；DexScreener/GMGN/Dune Tier-B | 可替换 adapter，统一预算和审计 |
| Rules | TypeScript 版本化纯函数 | 可重放、可测试、可解释 |
| Deployment | 本地 Node + PG；可选 Docker Compose | 优先适配现有 Windows 工作区 |

# 10. 禁止回头项
- 不重复 M0。
- 不重新全量抓 1433，除非新契约证明可产生真实 MAPPED。
- 不在未验证 wallet ledger 前全量累计 PnL。
- 不把 Tier-B 叫 Alpha/confirmed smart money。
- 不在 pool coverage 不完整时确认投资者集中度。
- 不自动发现全市场、不默认 cron、不开发交易执行。
- 不上传 chainfm_out、DPAPI、.env、私密明细或原始敏感 payload。

# 附录 A：Master Goal Prompt
```text
/goal

你是 memecoin-ca-data-layer 项目的总控执行 Agent。请读取并遵守仓库中的 PROJECT_CONSTITUTION.md、PROJECT_ARCHITECTURE.md、PROJECT_OPERATING_PLAYBOOK.md、AGENTS.md，以及本蓝图落盘后的 docs/blueprints/GOAL_EXECUTION_BLUEPRINT_V1.md。

目标：在不反复询问 Owner 的前提下，从当前波次结束状态持续执行 G0→G8，交付一个本地优先、浏览器可操作、数据可信、可审计、可重放的 Solana CA/地址/钱包/流动性研究辅助工具。

执行规则：
1. 首先执行 GOAL-ENTRY-GATE-001。若 OPERATOR-CONSOLE-SHELL-001 或 SOL-CA-HOLDER-HOTPATH-INTEGRATION-001 尚未 GREEN/合并，在原范围内完成、修复、审计和正常 merge；不得重跑 M0。
2. 每个里程碑使用独立 feature 分支。实现完成后运行产品验收、离线门禁、泄漏扫描和独立 auditor。无 P1/P0 且全部 GREEN 时使用正常 merge commit 合入 main，并自动进入下一里程碑。
3. 每个里程碑最多一个实现任务包、一个独立审计任务包、最多两轮有界 repair。不得把每个小字段拆成 Harness 微任务。
4. 允许自行决定非核心 UI 细节、内部类型命名、文件拆分、测试工具和轻量依赖；必须遵守本蓝图的最终数据契约、页面信息结构、信任等级和技术边界。
5. Live 调用必须使用服务端运行时凭据、显式开关、预算、并发和重试上限。浏览器、Git、日志、截图和报告不得出现凭据、私密钱包明细或原始敏感 payload。
6. Tier-B 只能作为 unverified observation；confirmed 结论只能由 Tier-A 可复现证据和版本化纯函数规则产生。分页、对账、排除覆盖或历史完整度不足时 fail-closed。
7. 不实现交易、签名、托管钱包、自动买卖；不启动 BSC/Robinhood；不全量重抓 1433；不全量计算累计 PnL；不自动扫描全市场。
8. 仅在本蓝图“必须停止”的条件出现时停止并回传 Owner。其他情况下采用保守实现并继续。
9. 每个里程碑必须回答：用户现在能完成什么操作、页面看到什么结果、失败状态如何表达、结果如何追溯。
10. 持续更新一个权威 CURRENT_WAVE 和一个权威执行计划；不要创建重复状态文档。

最终交付：完成 G8 的本地 v1.0 release；输出完整 lineage、里程碑结果、用户手册、数据字典、备份恢复说明和未完成风险。
```

# 附录 B：参考资料
- **R1 — Project architecture (binding)**：https://github.com/Yszdhhh/memecoin-ca-data-layer/blob/main/PROJECT_ARCHITECTURE.md
- **R2 — Current wave**：https://github.com/Yszdhhh/memecoin-ca-data-layer/blob/main/harness/CURRENT_WAVE.md
- **R3 — Next-stage execution plan**：https://github.com/Yszdhhh/memecoin-ca-data-layer/blob/main/docs/handoffs/NEXT_STAGE_EXECUTION_PLAN_20260730.md
- **R4 — System status**：https://github.com/Yszdhhh/memecoin-ca-data-layer/blob/main/docs/handoffs/STATUS_SYSTEM_20260730.md
- **R5 — Helius DAS getTokenAccounts**：https://www.helius.dev/docs/api-reference/das/gettokenaccounts
- **R6 — Helius getTransactionsForAddress**：https://www.helius.dev/docs/rpc/gettransactionsforaddress
- **R7 — DEX Screener API reference**：https://docs.dexscreener.com/api/reference
- **R8 — GMGN Agent API**：https://docs.gmgn.ai/cn/gmgn-agent-api
- **R9 — Dune query executions/API**：https://docs.dune.com/query-engine/query-executions

