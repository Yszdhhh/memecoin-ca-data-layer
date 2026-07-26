# 蓝图修订提案 — 混合数据 · 秒级 CA 分析 · 地址库沉淀

> 状态：**提案，待 Owner 确认**。确认后并入 PROJECT_CONSTITUTION / DESIGN，剩余任务可交其它 agent 按 §5 执行。
> 日期：2026-07-26。依据：Owner 2026-07-26 两条方向消息 + 数据源调研（见 §3 引用）。

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

### 3b. Provider 选型（详见调研）
- 热路径主引擎（三选一，单次 REST 出 持币榜+TopTrader PnL榜+狙击名单 <1s）：
  Birdeye Starter $99（独有 wallet_tags）/ Moralis Pro $199（独有 snipers-by-pair + pump.fun bonding）/ SolanaTracker €50（最直白榜单+无限速）。
- 富化借用：Dexscreener 免费（价格/流动性）+ Jupiter 免费（元数据校验）。
- 一手底层：Helius Dev $49（DAS 持币 + 解析 swap + Funding-Source 追首笔 SOL 来源=聚类种子）。
- 回填/离线：Bitquery Pro $79 或 Dune。
- **入门成本（solo 按需）≈ $150–250/月**。
- 限速墙（影响并发设计）：Birdeye 钱包类 API 全等级 5rps/75rpm、Vybe 免费 4rpm、Helius 免费 DAS 2rps、GMGN 1rps → 热路径每 CA 控制 4–6 路调用 + 缓存。

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

**Phase 3 — 盈利榜挖掘 + 聪明钱/bot 判定**
- P3-1 盈利榜路径 B + 路径 A（Helius 原始 swap 自建 PnL）
- P3-2 聪明钱判定规则（多币反复盈利+独立资金源+非簇非bot）
- P3-3 bot/sniper 判定规则（狙击延迟+同质行为+批量地址）
- P3-4 判定结果沉淀回地址库

**Phase 4 — 流动性趋势（第二部分，Owner 批 provider 后）**
- P4-1 live 行情采集/轮询；P4-2 时间序列聚合与趋势查询

每个实现任务配独立审计（T2），沿用 start/verify/finish + 独立 agent 身份纪律。

## 6. 需 Owner 拍板的新增决策点（详见 OWNER_DECISIONS_NEEDED.md 第 8–12 条）
- D-A 借用平台数据是否接受其 ToS/限流/封禁风险（尤其 GMGN 网页端抓取）。
- D-B 主引擎选哪家（Birdeye / Moralis / SolanaTracker）。
- D-C 盈利榜默认走"借平台（快、不可复现）"还是"一手重建（慢、可审计）"，或先借后一手确认。
- D-D 一手数据源选型与预算（Helius plan——原 Owner 门第 1 条，热路径依赖，这次要真选）。
- D-E 地址库判定置信门槛（多严算 smart-money/bot/cluster）。
