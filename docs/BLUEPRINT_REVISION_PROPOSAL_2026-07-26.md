# 蓝图修订提案 — 混合数据 · 秒级 CA 分析 · 地址库沉淀

> 状态：**提案，待 Owner 确认**。确认后并入 PROJECT_CONSTITUTION / DESIGN，剩余任务可交其它 agent 按 §5 执行。
> 日期：2026-07-26。依据：Owner 2026-07-26 两条方向消息 + 两份 Owner 文档（Alpha Score 重构蓝图完整版、深度研究与重构建议）+ 数据源调研（见 §3 引用）。
>
> **v2 更新（2026-07-26 晚）**：融合了 Owner 两份 docx 文档。新增四层架构、Alpha Score 动态评分体系、UR/SSR 等级、地址多维画像、标签冲突优先级、四类 harness 测试、parser 契约。这些已固化为 **`PROJECT_ARCHITECTURE.md`（binding）**，接进必读链以防后续 agent 漂移。方法级执行细节见 `docs/METHODS_ALPHA_SCORE_AND_DETECTORS.md`。

## 0. Owner 新方向解读（请确认理解是否准确）

核心目标从"孤立本地数据层"转为 **"混合数据 + 秒级 CA 分析的实战辅助工具"**。三条硬需求：

1. **秒级 CA 分析**：粘贴 CA 的一瞬间，用「我标记的地址库」对新币出详细链上分析——
   有没有潜在阴谋集团、有没有真正独立的聪明钱、有没有 bot 狙击手。
2. **旧代币盈利榜挖掘**：丢一个老代币，拉出该币盈利榜地址，逐个分析，
   把聪明钱 / 阴谋集团 / bot 沉淀进地址库。
3. **数据沉淀成库**：把挖到的地址清洗成可复用的库，服务未来新币的秒级交叉比对，链路要最简。

关键约束（Owner 原话）：
- **不是全孤立本地系统**：GMGN/DEX/其它平台能直接抓或直接拿的，走近实时"借用"。
- **底层一手数据**（可信度攸关的原始 swap/transfer/holder）可能要一手（直连 RPC/indexer）。
- **快 > 一切**：链上一级市场，快就胜过一切。GMGN 已有类似看板，我们要"清洗成自己的库"+ 自己的判定逻辑。

## 1. 与现有蓝图的关系：增补，不是推翻

现有 DESIGN.md 已预留：`address_labels` 地址库表；市场补充源"只补价不作事实来源"的借用边界；
Helius Enhanced + RPC 一手路径；分层（链上事实/规则/读模型）。方向与原设计同线，只是把"地址库"
从被动名单升级为**主动沉淀 + 秒级交叉比对**的一等公民，并新增盈利榜重建能力。

## 1b. 四层架构（binding，来自 Owner AlphaScore 蓝图，已固化到 PROJECT_ARCHITECTURE.md）

每个模块归且仅归一层，任务必须声明所属层，层间不越界：
1. **输入层**：接 CA / 钱包 / 转发的 TG·社交消息 / 历史代币列表；只做链识别、地址校验、缓存命中、并发分发，不做推理。
2. **热路径分析层（秒级）**：几十字段 + 少量 provider 调用 + 极少关联 → 市场/流动性/安全/holder结构/smart money/sniper/bundler + **地址库命中**。p95<2s。
3. **冷路径沉淀层（异步）**：wallet库 / token历史 / wallet-token边 / cluster图 / 盈利榜 / 行为模型。批量回放、重建、聚类。
4. **判断层**：Alpha Score / 团伙识别 / 狙击手识别 / 跟踪价值评分。消费沉淀数据+一手证据，产出可解释裁决；自己不拉 live 数据。

**热/冷分离铁律**：热路径只做"快"，凡批量历史/关系聚类/旧币重算/盈利榜重建/LLM总结一律进冷路径异步。让首屏依赖慢SQL/长串行API/大LLM总结 = 漂移违规。

## 2. 三大新能力的最简链路

### 2.1 秒级 CA 热路径
```
CA 粘贴 → resolve chain → 并行:
  (a) 借平台快照: holder/price/liq/已知标签 (Tier-B)
  (b) 查地址库: 该币 early buyer/holder 命中多少已知 smart-money/bot/cluster
→ 2s 内出初判卡片(标"快照/未核实"): 聪明钱 N / 疑似 bot M / 疑似阴谋集团 K 组
→ 异步深挖入队(Tier-A 一手重建 funding graph/cluster/dev) → 完成后刷新卡片
```
目标：初判 p95 < 2s；深挖 5–30s 异步。

### 2.2 旧代币盈利榜挖掘
```
老 CA → 拿盈利榜地址(路径B借平台 / 路径A一手重建) → 逐地址画像
     → 判定(独立聪明钱? 同源集群? sniper bot?) → 沉淀进地址库(证据+置信度+来源币+rule_version)
```

### 2.3 数据沉淀（见 §4）

## 3. 数据源策略：信任分级（核心原则）

**Tier-B（可借用，追求快，容错高，允许不可复现）**
- 数据：价格/流动性/FDV、per-token 盈利榜、平台现成钱包标签、holder 展示快照。
- 来源：GMGN（Top Traders + 标签）、Birdeye、Dexscreener、Vybe。
- 铁律：**永不作为链上事实来源**。进库标 `source=platform, unverified=true`，被一手确认前不能升级为"已确认"。

**Tier-A（必须一手，追求可信，判定攸关，必须可复现）**
- 数据：原始 swap（buy/sell 语义）、transfer、holder owner 聚合、funding edge、Pump create.creator、首笔 SOL 来源。
- 来源：Helius Enhanced + Solana RPC（幂等入库 + slot watermark）。加固可选 Shyft/Solscan。
- 铁律：cluster/dev/独立聪明钱的"已确认"标签只能由 Tier-A 数据 + 带 rule_version 的纯函数产生。

**协作方式（快与可信统一）**：热路径 Tier-B 秒出初判 → 异步 Tier-A 确认/推翻 → 升降级库标签 → 刷新卡片。
库里永远分得清哪条核实过。

### 3b. Provider 选型 —— 全免费栈（Owner 2026-07-26 决策 D-A/B/D）

Owner 定调：**能免费就免费；Helius 已在免费 1M 档**。单人按需分析（一次一个 CA，非批量），免费档 ~1 req/s 够用，"选哪个付费商"全部收敛为免费档。
- **热路径（全免费）**：Birdeye 免费档 + Dexscreener 免费无 key + GMGN 免费官方 OpenAPI + Helius 免费 1M。首屏该有的（价格/流动性/持币/聪明钱/狙击/榜单）都覆盖。
- **一手底层**：Helius 免费 1M（DAS 持币 + 解析 swap + Funding-Source 追首笔 SOL 来源=聚类种子）。
- **富化**：Dexscreener 免费 + Jupiter 免费（元数据校验）。
- **成本 = $0**（先零成本验证好不好用，好用了再针对被证实的瓶颈升级）。**只走官方/免费 API，不爬网页不绕 Cloudflare**（D-A）。
- 额度纪律：Helius 免费 1M 有限，盈利榜一手重算耗额度 → 节流/排队 + 缓存 `token_analyses`（D-D）。
- 限速墙（免费档，单 CA 够用）：Birdeye 免费 1rps、GMGN 1rps、Helius 免费 DAS 2rps → 热路径每 CA 控制 4–6 路调用 + 缓存。
- 升级路径（仅当免费限速被证实挡路）：SolanaTracker €50 无限速 / Birdeye 付费档。**默认不升级**。

### 3c. 盈利榜两条路径
- 路径 B（借，快，热路径默认）：GMGN/Birdeye/Moralis/SolanaTracker/Bitquery 直接拿榜。标 unverified，只用于筛选。
- 路径 A（一手，可信）：Helius 拉全 mint swap → FIFO/加权成本自算 PnL，可审计。写入库正式标签前用。
- 默认策略建议：先 B 筛候选 → 对候选走 A 确认 → 通过才升级库标签。（列入 Owner 决策 D-C。）

## 4. 最简沉淀数据模型（三表）

复用现有 `address_labels`，仅加两张分析快照表，不囤原始数据：
- `addresses`（钱包主表=地址库核心）：address PK、first_seen_token、labels JSON{smart_money/bot/sniper/insider/bundler/cluster:id/cex/kol}、**label_source**（self_computed > birdeye > vybe > gmgn > manual）、**label_confidence**、**funding_source**（Helius 首笔 SOL 来源=聚类种子）、updated_ts。
- `token_analyses`（每次分析快照，轻）：token_ca PK、analyzed_ts、top_traders[{addr,realized,unrealized,source}]、holder_snapshot_ref、cluster_findings。
- `clusters`（同源簇，一手算）：cluster_id PK、member_addresses、shared_funder、detected_on_token、detected_ts。

铁律：只写钱包级结论不囤原始 swap；每标签带 source+confidence（自算>借用）；
新币分析用 top-trader 地址 JOIN `addresses` = "贴 CA 瞬间交叉引用"。

## 4c. 判断层：Alpha Score + 等级 + 地址多维画像（来自 Owner 两份文档）

**Alpha Score = Relative Alpha Performance（相对市场超额，动态，非固定门槛）**
- 不是"固定定义高手"，而是"能否跑赢当前市场"，随市场环境实时重算。
- 四组因子：① 市场环境调整（牛熊/meme胜率/市场均ROI/百倍币数）② 钱包表现（超额收益/ROI/胜率/盈亏比/最大盈利贡献/多币持续性）③ 风险调整（单次幸运/依赖单一超级币/是否集团/是否bot模式）④ 时间衰减（近期权重更高）。
- 方法级公式、时间衰减、阈值推导、诚实降级见 `docs/METHODS_ALPHA_SCORE_AND_DETECTORS.md`。

**等级体系（市场排名百分位，阈值随分布自动调整，非固定收益）**：UR 90+ / SSR 80-90 / SR 65-80 / R 50-65 / N <50。

**地址多维画像（同一地址允许多标签并存）**：
- Identity：Human Trader / Bot / Sniper / KOL / Cluster 成员
- Capability：Alpha 能力 / 盈利能力 / 稳定性（→ Alpha Score 等级）
- Behavior：早期狙击 / 波段 / 长持 / 套利 / 跟单
- Relationship：独立钱包 / 团伙关系 / 资金来源

**标签冲突展示优先级**：风险(Insider/Cluster) > 行为(Sniper/Bot) > 能力(UR/SSR/SR) > 社交(KOL)。

**核心原则（binding）：外部标签是特征不是结论**。GMGN/Birdeye/Rugcheck 的 Smart Money/Sniper/Bundler/insider graph 当强特征喂给我们的检测器，最终裁决是我们自己带证据、可逆、带 rule_version 的评分输出。直接把平台标签当结论 = 漂移违规。

**三大检测器（方法级见 METHODS 文档）**：
- 独立聪明钱：高盈利 + 与已知团伙低共现 + 非单一bot模式入场 + 卖出节奏独立。
- 阴谋集团：同资金源/同上游出入金 + 高频同块入场 + 高频同窗卖出 + 多币高共现 + 与 dev/owner/early-LP 有关系。
- bot 狙击手：极早区块/slot入场 + 首分钟高频 + 分布式多地址同模式 + 持仓极短。

## 4d. 每日自动成长闭环（冷路径，来自 Owner 蓝图 九）
扫描热门 Token（GMGN/DexScreener/Birdeye/社区信号）→ 抓 Top Buyers/Sellers/Early Buyers/盈利榜 → 分析钱包历史 → 更新 Alpha Score/标签/Cluster 关系 → 形成新研究资产。（自动化触发是 Owner 门，见决策 D-F。）

## 5. 落地任务拆分（Owner 认可蓝图后可交其它 agent）

**Phase 0 — 清偿现有审计债（已识别，可立即排）**
- P0-1: HARNESS-AO-AUTOMATION-REPAIR-001（已注册，修 4×P1 治理漏洞）+ 再审。
- P0-2: SOL-WALLET-CLEANING-FUNDER-TAGS-001（已注册，修 funder tag 覆盖缺口），顺带收 holder-exclusion 审计 partial 路径测试缺口。

**Phase 1 — 一手底层（Tier-A，需 Owner 批 Helius）**
- P1-1 SolanaDataAdapter 真实实现（Helius DAS + Enhanced Tx + Funding-Source）
- P1-2 PumpFunDecoder 版本化（program+IDL 注册表 + pinned fixtures）
- P1-3 地址库三表 migration + 沉淀写入服务

**Phase 2 — 借用层 + 秒级热路径（Tier-B）**
- P2-1 主引擎适配器（Owner 定 Birdeye/Moralis/SolanaTracker 三选一）
- P2-2 秒级 CA 卡片编排（Tier-B 初判 + 库命中 <2s；异步深挖入队）
- P2-3 Dexscreener/Jupiter 富化适配器

**Phase 2.5 — parser 契约 + observation schema + 四类 harness（判断层前置，防漂移地基）**
- P2.5-1 versioned parser + 统一 observation schema（market/security/holder_concentration/wallet_signal/promotion_social/call_source）
- P2.5-2 四类 harness 落地：latency / replay / source-degradation / label-decision（作为 acceptance 维度接进 harness）

**Phase 3 — 判断层：盈利榜挖掘 + Alpha Score + 三大检测器（方法见 METHODS 文档）**
- P3-1 盈利榜路径 B（借平台）+ 路径 A（Helius 原始 swap 自建 PnL，FIFO/加权成本）
- P3-2 Alpha Score 动态评分引擎 + UR/SSR/SR/R/N 等级（相对市场，随分布调整）
- P3-3 独立聪明钱检测器（多币盈利+低团伙共现+非bot入场+独立卖出）
- P3-4 阴谋集团检测器（扩展 funding-clusters.ts，不降 0.85 阈值）
- P3-5 bot/sniper 检测器（狙击延迟+同质行为+批量地址）
- P3-6 判定结果沉淀回地址库（多维画像 + 标签冲突优先级）

**Phase 4 — 每日自动成长闭环 + 流动性趋势（均 Owner 门）**
- P4-1 每日热门币扫描→抓榜→更新评分/标签/cluster（自动化触发 = Owner 门 D-F）
- P4-2 live 行情采集/轮询；P4-3 时间序列聚合与趋势查询

每个实现任务配独立审计（T2），沿用 start/verify/finish + 独立 agent 身份纪律。
**每个触及热路径/provider/检测器的任务，其 acceptance 必须包含 §6 对应的 harness 维度**（PROJECT_ARCHITECTURE.md §6）。

## 6. 需 Owner 拍板的新增决策点（详见 OWNER_DECISIONS_NEEDED.md 第 8–12 条）
- D-A 借用平台数据是否接受其 ToS/限流/封禁风险（尤其 GMGN 网页端抓取）。
- D-B 主引擎选哪家（Birdeye / Moralis / SolanaTracker）。
- D-C 盈利榜默认走"借平台（快、不可复现）"还是"一手重建（慢、可审计）"，或先借后一手确认。
- D-D 一手数据源选型与预算（Helius plan——原 Owner 门第 1 条，热路径依赖，这次要真选）。
- D-E 地址库判定置信门槛（多严算 smart-money/bot/cluster）。
- D-F 每日自动成长闭环是否启用、频率、以及是否允许自动抓热门币（涉及 provider 配额消耗与自动化触发）。
- D-G Telegram/社交采集方式（人工转发 vs TDLib 用户客户端），后者有账号/ToS 风险，需 Owner 明确授权。
