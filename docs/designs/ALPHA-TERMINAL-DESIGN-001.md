# ALPHA-TERMINAL-DESIGN-001

**产品**：Meme 一级市场 Bloomberg Terminal
**文档状态**：Boundary-corrected Research Draft v0.2
**日期**：2026-07-27
**原则**：吸收 Chain.fm 的 *Discovery 范式*，不复制 UI/品牌；所有外部标签（GMGN / Chain.fm）只作 Observation，结论由自有引擎产出。

---

## 执行边界声明（2026-07-28）

本文件是产品与 schema 研究，不是 Harness dispatch，也不是已批准的
运行时蓝图。文中的 TypeScript、SQL、API、cron、Redis、WS、告警和多链
片段全部是未来形态草图，不得据此直接改代码或启用基础设施。

### 当前可执行

- Solana-only、Helius-only。
- 人工输入单个 CA，或人工精选 1–10 个不同 CA 后手动批量触发。
- 每个 CA 只做受限、只读的 mint、metadata、token-account 首查。
- 只返回安全摘要；不保存 raw payload，不写数据库/缓存/队列。
- 缺凭证、非法 CA、超时、部分或不可用数据一律 fail-closed。

### 可继续保留的研究

- Observation-only、外部标签不覆盖链上事实。
- `rule_version`、`evidence[]`、`completeness` 和可回放纪律。
- Discovery / Investigation 双轨交互、三栏 Terminal、Channel/Feed
  信息架构、Research Inspector 复用方向。
- 仅用 schema、mock、fixture 探索上述设计，不接 live 基础设施。

### 必须等待 Owner 决策

- 自动发现每日热门币或自动日更。
- 新增任何 provider 或 provider fallback。
- 真实 PostgreSQL/Redis、历史回填、队列、WS/SSE、Alert Worker。
- Telegram/social/KOL ingestion、Web Push、User Channel。
- BSC、Base、Robinhood 或其他链的激活。

### 当前禁止实施

- cron、后台循环、自动抓币、自动推送机会。
- 生产数据库、缓存、队列或地址库自动沉淀。
- Redis Stream、WS Gateway、Telegram/Web Push。
- GMGN、Birdeye、DexScreener、Chain.fm、TG、X 等接入当前 Helius
  CA-first 路径。
- 将受限首查描述为完整 Pump 深度分析、creator/Dev 画像、真实持仓
  集中度或完整 Alpha Terminal。

后文所有“Phase”“最终形态”和产品级验收标准均应按以上分类阅读。

---

## 0. 一句话定位

| 维度 | 原系统 | 升级后 |
|------|--------|--------|
| 入口 | 用户主动查 CA | **系统主动推送机会 + 用户深入研究** |
| 能力 | CA Analyzer + Wallet DB + Cluster | + Alpha Feed + Channel + Event Engine |
| 交互 | Investigation-only | **Discovery ‖ Investigation** 双轨 |
| 数据 | 事实层 + 规则层 | + 观测层 + 评分层 + 推送层 |

```
                    Alpha Terminal

        Discovery                    Research
     ──────────────              ──────────────
     实时 Feed                    CA 分析卡
     Wallet 事件                  Token 画像
     Cluster 事件                 风险分析
     KOL 事件                     历史回放
     Liquidity / Heat             AI Summary
```

---

## 1. Chain.fm UI / 产品拆解

> 来源：官方文档（docs.chain.fm）与公开页面（chain.fm/home、/explore、/trending）。
> 目标：提取**可迁移的产品机制**，而非视觉抄袭。

### 1.1 产品本质

Chain.fm 把链上监控从「工具查询」改成了「**可订阅的电台**」：

1. **Address Library**：大规模 Smart Money / 地址库
2. **Channel**：把地址集合 + 事件过滤打包成可关注单元
3. **Personalized Feed**：关注频道 → 首页时间线
4. **Event Filtering**：按事件类型 + 属性阈值精筛
5. **Push**：Web 通知 / Telegram，无上限感

核心交互哲学：

```
不是：用户搜索 CA → 分析
而是：系统持续推送「谁在买什么」→ 用户决定是否深挖
```

### 1.2 信息架构（IA）

| 页面 | 职责 | 可吸收点 |
|------|------|----------|
| `/home` | 订阅频道后的**统一动态流** | 日志风格时间线；连接状态；偏好（绝对时间/字号） |
| `/explore` | 发现优质频道 | 频道发现 = 降低找 Smart Money 的成本 |
| `/trending` | 全链热门 Token 表 | 多时间窗（5m/15m/1h…）；Buy/Sell 拆分；Addr 活跃 |
| Channel Detail | 单频道地址集合 + 动态 | 频道是一等公民，不是设置项 |
| Address tooltip | 标签 / 屏蔽 / 筛选 | 行内快速操作，不打断扫盘 |
| Chrome Extension | 跨站实时提醒 | 监控应可「随身」 |

### 1.3 Homepage 控件拆解

| 控件 | Chain.fm 行为 | 我们的取舍 |
|------|---------------|------------|
| 多维过滤器 | 时间 × 频道 × 地址 × 事件属性 | **保留**；增加 Alpha Score / Cluster / Heat 维度 |
| Save Search | 保存筛选组合 | **保留** 为「自定义 Channel 视图」 |
| Connection Status | 绿点 = 实时连接 | **保留**（SSE/WS 健康） |
| Activity Feed | 日志行 + 绿色可 hover 实体 | **升级**：卡片化事件 + 右侧 Research 面板 |
| Quick Trade 链接 | hover 出交易平台 | **可选**（宪法：本 repo 不做交易执行；可 deep-link 外部） |
| Custom Label / Block | 地址备注与屏蔽 | **保留** |
| Absolute Time | 复盘友好 | **默认开启绝对时间**（Bloomberg 风格） |

### 1.4 Feed 过滤四维 + 搜索

Chain.fm：

1. **Time**：1h / 3h / 24h / 7d
2. **Channel**：单选/多选关注频道
3. **Address**：跨频道地址过滤
4. **Event**：类型 + 属性（如 Buy amount > 5 SOL）
5. **Quick Search CA**：按合约反查所有相关动态

我们在此基础上增加：

6. **Alpha Score 门槛**
7. **Cluster 关联**（含/排除 Cluster 成员）
8. **Liquidity Health 等级**
9. **Market Heat 门槛**
10. **Observation Source 置信**（仅显示自有引擎确认的信号）

### 1.5 Trending 表设计可吸收点

- 时间窗切换 + 自动 refresh countdown
- Token / Age / MCap / Addr / Buy·Sell / Vol / Price·Change
- **Buy 与 Sell 分离** 而非只展示净成交

我们的升级：Addr 改为 **独立买家 + 新增 Holder**；Vol 附 **Volume Quality**；加 **Heat / LP Health** 列。

### 1.6 Channel 机制可吸收点

| 机制 | 说明 | 我们的差异 |
|------|------|------------|
| 用户创建频道 | 地址列表 + 备注 | 支持，但 **系统频道优先** |
| 社区订阅 | 近千频道网络效应 | 内测阶段：系统策展 > 社交 |
| 频道 Score / Alpha(14d) | 探索页排序 | 用 **自有 Alpha Score Engine** 排序 |
| 分享频道 | 可传播 | 后续；先做私有/团队订阅 |

### 1.7 明确 **不** 复制的部分

- 视觉皮肤、文案语气、品牌命名
- 把第三方「Smart Money」列表当真理
- 纯社交关注流（无自有评分）
- 交易执行闭环（本系统定位分析 Terminal）

### 1.8 与我们的能力对照

| Chain.fm 强项 | 我们已有 | 我们要补齐 |
|---------------|----------|------------|
| 推送式 Feed | ❌ 主动查询 | Event Engine + Alpha Feed |
| Channel 订阅 | ❌ | Channel System |
| 地址库 | Wallet Quality + Labels 雏形 | Alpha Wallet Intelligence 扩展 |
| 集群 | ✅ funding-clusters | 升级为实时 Cluster Activity Channel |
| CA 深度研究 | ✅ Quick/Deep Analysis | CA Research Card UI |
| 流动性 | MarketSnapshot 单值 | Liquidity Health Score |
| 热度 | Macro 水位（日级） | Market Heat Score（分钟级） |

---

## 2. 系统总架构（升级后）

```
Data Sources (Observation only)
  GMGN · Birdeye · DexScreener · Helius · Chain.fm · Telegram · X
           │
           ▼
   Observation Layer          ← 标准化外部信号，打 source + confidence + observed_at
           │
           ▼
   Wallet Intelligence Engine ← 现有 wallet-quality + 扩展 Alpha Wallet Profile
           │
           ▼
   Cluster Engine             ← 现有 funding-clusters + 实时 activity 检测
           │
           ▼
   Alpha Score Engine         ← 自有结论，不信任单一外部标签
           │
           ▼
   Event Engine               ← 把「事实变更」变成可推送 Event
           │
     ┌─────┴─────┬────────────┬──────────────┐
     ▼           ▼            ▼              ▼
 Alpha Feed  Channel Sys  Alert System  CA Research Card
```

### 2.1 分层职责（硬约束）

| 层 | 输入 | 输出 | 禁止 |
|----|------|------|------|
| Observation | 外部 API / 社交 | `Observation` 记录 | 直接写进 Alpha Score 结论 |
| Fact | Helius/RPC 链上事实 | Trade / Transfer / FundingEdge | 被 Market API 覆盖 |
| Intelligence | Fact + Observation | WalletProfile / Cluster / Risk | 无 evidence 的黑盒分 |
| Alpha Score | Intelligence 多特征 | `AlphaScore` + reasons | 单源依赖 |
| Event | Score 阈值 + 规则 | `AlphaEvent` | 刷屏重复事件 |
| Presentation | Event / Analysis | Feed / Card / Alert | 前端重算评分 |

**数据真实性原则（与 PROJECT_CONSTITUTION 对齐）**：

- GMGN Smart Money / Chain.fm 频道 = **Feature Observation**
- Market APIs 补价量 = **enrichment**，不覆盖链上事实
- Partial data → warnings + completeness，禁止假精确
- 每个分数附 `rule_version` + `evidence[]`

---

## 3. Alpha Terminal UI 设计稿

### 3.1 总体布局：三栏 Terminal（非传统 Dashboard）

```
┌──────────┬─────────────────────────────┬──────────────────────────┐
│  LEFT    │         CENTER              │         RIGHT            │
│  220px   │         flex 1              │         420–480px        │
│          │                             │                          │
│ Channels │  Alpha Event Timeline       │  Research Inspector      │
│ + filters│  (Discovery Feed)           │  (Investigation)         │
│ + status │                             │                          │
└──────────┴─────────────────────────────┴──────────────────────────┘
│ TOP BAR: chain switch · CA search · connection · prefs · alerts   │
└───────────────────────────────────────────────────────────────────┘
```

**不要**做成：KPI 卡片墙 + 多图 Dashboard。
**要**做成：操作台（扫描流）+ 检视器（深研）。

### 3.2 左侧：Channel 列表

```
📡 ALPHA TERMINAL          [● live]

🔍 搜频道 / CA

── SYSTEM ──────────────
🔥 Alpha Feed          128
⭐ Smart Money          34
⚡ Sniper               12
🕸 Cluster               7
🐳 Whale                 9
📢 KOL                   5
💧 Liquidity             4
🌡 Heat Spike            6

── MY VIEWS ────────────
★ High Alpha No Cluster
★ Early Sniper SOL≥3
+ New View…

── PRESETS ─────────────
⏱ 15m  1h  4h  24h
```

交互：

- 单击切换主 Feed 源
- 多选 = 合并流（与 Chain.fm Channel 多选一致）
- 角标 = 未读 / 最近 15m 计数
- 拖拽排序（本地 preference）

### 3.3 中间：实时事件流（Timeline）

单行事件卡片（密度优先，可展开）：

```
10:31:20  🔥 SSR_SMART_MONEY_BUY          α 87  ·  Heat 72  ·  LP A
─────────────────────────────────────────────────────────────────
$ABC · FDV 45K · Liq 8K · MC 42K
Wallet  7xK2…f9a1  [SSR]  hist: 42 tok · 9×10x+ · cluster: none
Reason  历史捕捉 12 个 10x · 无 Cluster 关联 · LP ratio 18%
        [Open Research]  [Filter Wallet]  [Filter Token]  [Mute]
```

视觉规范（Bloomberg 暗色）：

| 元素 | 规范 |
|------|------|
| 背景 | `#0B0E11` / row `#12161C` |
| 强调 | Smart Money 橙；Sniper 电青；Cluster 琥珀；Risk 红 |
| 时间 | 绝对时间 `HH:mm:ss` 等宽字体 |
| 分数 | 等宽 + 色阶（≥80 绿，60–79 黄，<60 灰） |
| 密度 | 默认 compact；hover 显示操作条 |
| 去重 | 同 wallet+token+side 30s 内折叠为计数 |

分组（可选）：

- 按分钟折叠
- 同 Token 连续事件合并为「Token Burst」母卡

### 3.4 右侧：Research Inspector（CA Research Card）

点击任意事件后展开（或 CA Search 直接打开）：

```
┌─ TOKEN HEADER ─────────────────────────────────────┐
│ $ABC  ·  Solana  ·  Pump  ·  Age 14m               │
│ CA: xxxx…yyyy  [copy] [gmgn] [dex] [birdeye]       │
│ Price $0.00x  FDV 45K  MC 42K  24h ±—              │
│ α Token 74   Heat 🔥 87   LP Health A   Risk MED   │
└────────────────────────────────────────────────────┘

Tabs: Overview | Market | Liquidity | Holders | Wallets
      | Cluster | History | Risk | AI Summary

Overview
  · Trigger event 摘要
  · Smart Money 参与数 / Sniper 数 / Cluster 命中
  · 一句话 AI Summary（可展开 evidence）

Market
  · 价格迷你图（1m/5m/15m）
  · Buy/Sell 拆分 volume
  · 独立买家 / 新增 Holder 曲线

Liquidity
  · LP 规模、LP/FDV、30m 增长
  · Volume Quality 组件
  · Score 字母 + 原因列表

Holders
  · Clean Top10/20（复用 real-holders）
  · 排除原因 evidence
  · 集中度告警

Wallets
  · 本事件相关钱包 + Alpha Profile
  · 历史成功案例缩略

Cluster
  · cluster-id · 成员 · 资金层数 · 同步买入图
  · 历史参与/成功率

History
  · 创建 → 前 30 块买卖 → 关键点事件回放

Risk
  · Dev 行为 / mint-auth / 集中度 / 刷量 / Cluster
  · 综合 Risk Grade

AI Summary
  · 结构化 bullets + 置信度
  · 「Observation vs Conclusion」分区
```

### 3.5 双轨导航

| 模式 | 入口 | 主视图 |
|------|------|--------|
| Discovery | 默认 `/terminal` | 左 Channel + 中 Feed |
| Investigation | Feed 点击 / 顶栏 CA 搜索 | 右 Inspector 置顶；可选全屏 Research |
| Deep Link | `/token/{chain}/{ca}` | 全页 CA Research Card |
| Wallet | `/wallet/{address}` | Wallet Intelligence 页 |
| Cluster | `/cluster/{id}` | Cluster 图谱 + 历史 |

### 3.6 空态 / 延迟 / 降级

- WS 断开：顶栏黄点 + 「Reconnecting」；Feed 可回退轮询
- Partial analysis：Inspector 显示 completeness 条与 warnings
- 无 Alpha 事件：展示「Observation only」灰条，禁止伪造 SSR 信号

---

## 4. Channel 系统 Schema

### 4.1 概念

**Channel** = 可订阅的事件过滤器 + 可选地址宇宙 + 排序策略。

- **System Channel**：平台策展（Smart Money / Sniper / Cluster…）
- **Derived Channel**：基于规则自动维护成员（Alpha Score > 80 等）
- **User Channel**：用户自选地址 / 自定义过滤器
- **View**：临时 Save Search，可升级为 Channel

### 4.2 TypeScript Schema

```typescript
// domain/alpha/channel.ts

export type ChannelKind =
  | "system"
  | "derived"
  | "user"
  | "shared";

export type ChannelId =
  | "alpha_feed"
  | "smart_money"
  | "sniper"
  | "cluster_activity"
  | "whale"
  | "kol"
  | "liquidity"
  | "heat"
  | `user:${string}`
  | `derived:${string}`;

export type EventType =
  | "smart_money_buy"
  | "smart_money_sell"
  | "sniper_buy"
  | "cluster_activity"
  | "whale_buy"
  | "whale_sell"
  | "kol_signal"
  | "liquidity_shift"
  | "heat_spike"
  | "token_launch"
  | "risk_flag";

export interface ChannelFilter {
  eventTypes?: EventType[];
  chains?: Array<"solana" | "bsc" | "base" | "robinhood">;
  /** Alpha Score of actor wallet or composite event score */
  minAlphaScore?: number;
  maxAlphaScore?: number;
  minHeatScore?: number;
  liquidityGrades?: Array<"A" | "B" | "C" | "D">;
  /** exclude if wallet in high-confidence cluster */
  excludeClusteredActors?: boolean;
  /** only events with cluster activity */
  requireCluster?: boolean;
  minBuyNative?: number;       // e.g. SOL
  minBuyUsd?: number;
  maxEntryFdvUsd?: number;
  maxEntryAgeSeconds?: number; // sniper window
  tokenAllowlist?: string[];   // ca list
  tokenBlocklist?: string[];
  walletAllowlist?: string[];
  walletBlocklist?: string[];
  observationSources?: string[]; // gmgn|chainfm|helius|internal — for debug
  /** require internal engine confirmation beyond observation */
  requireInternalConfirm?: boolean;
}

export interface ChannelMembershipRule {
  /** for derived channels: who is in the address universe */
  kind: "static" | "query" | "score_threshold";
  staticAddresses?: string[];
  query?: {
    minAlphaScore: number;
    activeWithinDays: number;
    maxClusterConfidence?: number;
    minSuccess10x?: number;
    minTokensParticipated?: number;
  };
  refreshCron?: string; // e.g. "*/15 * * * *"
}

export interface ChannelDefinition {
  id: ChannelId;
  kind: ChannelKind;
  name: string;
  description: string;
  icon: string; // emoji or icon key
  filter: ChannelFilter;
  membership?: ChannelMembershipRule;
  sort: "time_desc" | "alpha_desc" | "heat_desc" | "size_desc";
  dedupeWindowSeconds: number;
  rateLimitPerMinute?: number; // soft cap to reduce noise
  isDefaultSubscribed: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelSubscription {
  userId: string;
  channelId: ChannelId;
  muted: boolean;
  customFilterOverride?: Partial<ChannelFilter>;
  notify: {
    web: boolean;
    telegram: boolean;
    minAlphaScore?: number;
  };
  sortOrder: number;
  unreadCursorEventId?: string;
}
```

### 4.3 系统频道定义（默认）

#### 4.3.1 Smart Money Channel

```yaml
id: smart_money
filter:
  eventTypes: [smart_money_buy, smart_money_sell]
  minAlphaScore: 80
  excludeClusteredActors: true   # 非明显 Cluster
  requireInternalConfirm: true
membership:
  kind: score_threshold
  query:
    minAlphaScore: 80
    activeWithinDays: 30
    maxClusterConfidence: 0.5
    minSuccess10x: 3
    minTokensParticipated: 10
```

展示字段（事件卡）：

| 字段 | 来源 |
|------|------|
| Wallet + tier 标签 | Alpha Wallet Profile |
| Token / Entry FDV | Market + trade |
| 历史参与 / 10x+ 次数 | Wallet stats |
| Alpha Score | Alpha Score Engine |
| Cluster | Cluster Engine（None / id） |

#### 4.3.2 Sniper Channel

```yaml
id: sniper
filter:
  eventTypes: [sniper_buy]
  maxEntryAgeSeconds: 30   # 创建后 30s 内
  minBuyNative: 0.5
membership: # 历史 sniper 表现过滤在 Event 生成阶段做
```

展示：Block offset、Amount、历史 launch 数、盈利%、平均 ROI。

#### 4.3.3 Cluster Activity Channel（核心差异）

```yaml
id: cluster_activity
filter:
  eventTypes: [cluster_activity]
  requireCluster: true
```

展示：cluster-id、钱包数、同步买入 token、资金关系层数、历史成功、Risk。

#### 4.3.4 KOL Channel

```yaml
id: kol
filter:
  eventTypes: [kol_signal]
```

数据：X / Telegram / GMGN 标签 → Observation；提前买入钱包由链上对齐。

#### 4.3.5 其他

| Channel | 触发 |
|---------|------|
| Whale | 单笔 ≥ 阈值（动态：max(固定 SOL, liq%)） |
| Liquidity | LP 30m 增长 ≥ X% 或 grade 跃迁 |
| Heat | Market Heat 跨阈值或 15m 暴涨 |
| Alpha Feed | 上述高质量事件的并集 + 排序加权 |

### 4.4 DB 表（增量）

```sql
-- 007_alpha_channel_event.sql (sketch)

CREATE TABLE channel_definitions (
  id            text PRIMARY KEY,
  kind          text NOT NULL,
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  icon          text NOT NULL DEFAULT '',
  filter_json   jsonb NOT NULL,
  membership_json jsonb,
  sort          text NOT NULL DEFAULT 'time_desc',
  dedupe_window_seconds int NOT NULL DEFAULT 30,
  rate_limit_per_minute int,
  is_default_subscribed boolean NOT NULL DEFAULT false,
  version       int NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE channel_subscriptions (
  user_id       text NOT NULL,
  channel_id    text NOT NULL REFERENCES channel_definitions(id),
  muted         boolean NOT NULL DEFAULT false,
  filter_override jsonb,
  notify_json   jsonb NOT NULL DEFAULT '{}',
  sort_order    int NOT NULL DEFAULT 0,
  unread_cursor text,
  PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE channel_members (
  channel_id    text NOT NULL,
  address       text NOT NULL,
  chain         text NOT NULL DEFAULT 'solana',
  added_reason  text,
  alpha_score   numeric,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, chain, address)
);
```

---

## 5. Event Schema

### 5.1 统一事件信封

```typescript
// domain/alpha/event.ts

export type ObservationSource =
  | "helius"
  | "rpc"
  | "birdeye"
  | "dexscreener"
  | "gmgn"
  | "chainfm"
  | "telegram"
  | "x"
  | "internal";

export interface EvidenceItem {
  key: string;
  value: string | number | boolean | null;
  source: ObservationSource;
  confidence: number; // 0–1
  observedAt: string; // ISO
  note?: string;
}

export interface AlphaEventBase {
  eventId: string;              // ulid
  eventType: EventType;
  chain: "solana" | "bsc" | "base" | "robinhood";
  occurredAt: string;           // chain time preferred
  ingestedAt: string;
  severity: "info" | "watch" | "high" | "critical";

  token?: {
    ca: string;
    symbol?: string;
    name?: string;
    launchpad?: string;
    createdAt?: string;
  };

  actors: Array<{
    address: string;
    role: "buyer" | "seller" | "funder" | "kol" | "cluster_member" | "dev";
    label?: string;
    alphaScore?: number;
    tier?: "SSR" | "SR" | "R" | "N";
  }>;

  metrics: {
    alphaScore?: number;        // event-level composite
    heatScore?: number;
    liquidityGrade?: "A" | "B" | "C" | "D";
    riskGrade?: "low" | "medium" | "high" | "critical";
    fdvUsd?: number;
    liquidityUsd?: number;
    amountNative?: number;
    amountUsd?: number;
    blockOffset?: number;       // for sniper
  };

  summary: string;              // one-line human
  reasons: string[];            // bullet reasons (conclusion side)
  evidence: EvidenceItem[];     // observation + fact side
  clusterId?: string;
  relatedEventIds?: string[];

  channels: ChannelId[];        // fan-out targets after routing
  dedupeKey: string;            // e.g. sm_buy:wallet:ca:tx
  completeness: "complete" | "partial";
  warnings: string[];
  ruleVersions: Record<string, string>;
}
```

### 5.2 分类型 Payload

```typescript
export interface SmartMoneyBuyEvent extends AlphaEventBase {
  eventType: "smart_money_buy";
  payload: {
    txHash: string;
    side: "buy";
    entryFdvUsd: number | null;
    walletStats: {
      tokensParticipated: number;
      success10x: number;
      success5x: number;
      winRate?: number;
      avgRoi?: number;
      lastActiveAt?: string;
    };
    cluster: { id: string | null; confidence: number };
  };
}

export interface SniperBuyEvent extends AlphaEventBase {
  eventType: "sniper_buy";
  payload: {
    txHash: string;
    blockOffset: number;        // blocks or seconds from create
    secondsFromCreate: number;
    sniperStats: {
      launches: number;
      profitRate: number;       // 0–1
      avgRoi: number;
      medianRoi?: number;
    };
    elite: boolean;             // passes performance filter
  };
}

export interface ClusterActivityEvent extends AlphaEventBase {
  eventType: "cluster_activity";
  payload: {
    clusterId: string;
    memberCount: number;
    membersBuying: string[];
    fundingDepth: number;       // 资金关系层数
    syncWindowSeconds: number;
    clusterStats: {
      tokensParticipated: number;
      successCount: number;
      risk: "low" | "medium" | "high";
    };
    totalBuyNative?: number;
  };
}

export interface KolSignalEvent extends AlphaEventBase {
  eventType: "kol_signal";
  payload: {
    account: string;            // handle or id
    platform: "x" | "telegram" | "gmgn_tag";
    firstMentionAt: string;
    messageRef?: string;
    earlyBuyWallets: string[];  // on-chain aligned
    hitRate?: number;           // historical
    lagSecondsToFirstSmartBuy?: number;
  };
}

export interface LiquidityShiftEvent extends AlphaEventBase {
  eventType: "liquidity_shift";
  payload: {
    fromUsd: number;
    toUsd: number;
    window: "5m" | "15m" | "30m" | "1h";
    changePct: number;
    lpToFdv: number | null;
    gradeBefore: "A" | "B" | "C" | "D";
    gradeAfter: "A" | "B" | "C" | "D";
    volumeQuality: VolumeQuality;
  };
}

export interface HeatSpikeEvent extends AlphaEventBase {
  eventType: "heat_spike";
  payload: {
    heatScore: number;
    components: MarketHeatComponents;
    drivers: string[];          // + Smart Money / + Holder ...
    dampeners: string[];        // - Cluster risk ...
  };
}

export type AlphaEvent =
  | SmartMoneyBuyEvent
  | SniperBuyEvent
  | ClusterActivityEvent
  | KolSignalEvent
  | LiquidityShiftEvent
  | HeatSpikeEvent
  | AlphaEventBase;
```

### 5.3 事件表

```sql
CREATE TABLE alpha_events (
  event_id      text PRIMARY KEY,
  event_type    text NOT NULL,
  chain         text NOT NULL,
  occurred_at   timestamptz NOT NULL,
  ingested_at   timestamptz NOT NULL DEFAULT now(),
  severity      text NOT NULL,
  token_ca      text,
  cluster_id    text,
  dedupe_key    text NOT NULL,
  channels      text[] NOT NULL DEFAULT '{}',
  alpha_score   numeric,
  heat_score    numeric,
  liquidity_grade char(1),
  risk_grade    text,
  body          jsonb NOT NULL,          -- full AlphaEvent
  completeness  text NOT NULL,
  UNIQUE (dedupe_key, occurred_at)       -- soft uniqueness; adjust as needed
);

CREATE INDEX alpha_events_feed_idx
  ON alpha_events (occurred_at DESC, event_type);

CREATE INDEX alpha_events_token_idx
  ON alpha_events (chain, token_ca, occurred_at DESC);

CREATE INDEX alpha_events_channels_gin
  ON alpha_events USING gin (channels);
```

### 5.4 路由规则（Event → Channel）

```
Event produced
  → apply ChannelFilter for each active ChannelDefinition
  → attach matching channel ids
  → write alpha_events
  → publish to Redis Stream `alpha:events`
  → fan-out: WS rooms / Telegram if subscription.notify
```

---

## 6. Liquidity Health + Market Heat 模块

### 6.1 问题：单点 Liquidity 不可用

错误展示：

```
Liquidity: 50K
```

无法区分：虚高 FDV、刷量、真资金进入。

### 6.2 Liquidity Health Score

#### 维度

| # | 维度 | 定义 | 信号 |
|---|------|------|------|
| 1 | LP 规模 | `liquidityUsd` | 基础承载力 |
| 2 | LP / FDV | `liq / fdv` | 过低 = 虚高或易砸 |
| 3 | Liquidity Growth | 窗口内 liq 变化 | 资金进场/撤池 |
| 4 | Volume Quality | 量 vs 独立买家 vs 重复地址 | 真热度 vs 刷量 |

#### Volume Quality

```typescript
export interface VolumeQuality {
  window: "5m" | "15m" | "30m" | "1h";
  volumeUsd: number;
  uniqueBuyers: number;
  newHolders: number;
  repeatAddressRatio: number;   // 重复地址成交占比
  washSuspectScore: number;     // 0–1
  volumePerUniqueBuyer: number;
  holderGrowthToVolume: number; // newHolders / volumeUsd * scale
  label: "organic" | "mixed" | "suspicious" | "unknown";
  evidence: EvidenceItem[];
}
```

启发式（v1，可配置）：

```
washSuspect ↑ when:
  - repeatAddressRatio > 0.45
  - uniqueBuyers low while volume high
  - holder growth ≈ 0 under high volume
  - buy/sell ping-pong same set of wallets

organic when:
  - uniqueBuyers & newHolders co-move with volume
  - repeatAddressRatio low
  - smart money / non-cluster participation present
```

#### 字母评级

| Grade | 含义 | 粗规则（v1） |
|-------|------|----------------|
| **A** | 真实资金进入 | LP/FDV ≥ 10%，growth 健康，VQ organic，无严重撤池 |
| **B** | 正常 | 指标中位，无显著异常 |
| **C** | 风险 | LP/FDV 偏低或 growth 异常或 VQ mixed |
| **D** | 疑似刷量 / 脆弱 | washSuspect 高或 LP 极低且 FDV 虚高 |

```typescript
export interface LiquidityHealth {
  grade: "A" | "B" | "C" | "D";
  score0to100: number;
  liquidityUsd: number | null;
  fdvUsd: number | null;
  lpToFdv: number | null;
  growth: {
    window: "30m";
    fromUsd: number | null;
    toUsd: number | null;
    changePct: number | null;
  };
  volumeQuality: VolumeQuality;
  reasons: string[];
  evidence: EvidenceItem[];
  ruleVersion: string; // "liq_health_v1"
  completeness: "complete" | "partial";
  calculatedAt: string;
}
```

展示组件：

```
💧 Liquidity Health    A
LP 80K · LP/FDV 15% · 30m 10K→80K (+700%)
Volume Quality: organic
+ 真实资金进入  + Holder 增长匹配
```

### 6.3 Market Heat Score

```typescript
export interface MarketHeatComponents {
  volumeGrowth: number;       // 0–100 normalized
  activeAddressGrowth: number;
  newHolderGrowth: number;
  socialBuzz: number;         // TG/X observation, capped weight
  smartMoneyParticipation: number;
  liquidityGrowth: number;
  clusterPenalty: number;     // subtract
}

export interface MarketHeat {
  score: number;              // 0–100
  components: MarketHeatComponents;
  drivers: string[];          // ["+ Smart Money增加", "+ Holder增长"]
  dampeners: string[];        // ["- Cluster风险存在"]
  ruleVersion: string;        // "heat_v1"
  completeness: "complete" | "partial";
  calculatedAt: string;
}
```

合成（示意权重 v1）：

```
raw =
  0.22 * volumeGrowth +
  0.18 * activeAddressGrowth +
  0.18 * newHolderGrowth +
  0.12 * liquidityGrowth +
  0.18 * smartMoneyParticipation +
  0.12 * socialBuzz
  - clusterPenalty

score = clamp(raw, 0, 100)
```

**Social 与 GMGN 权重必须 capped**，且 `socialBuzz` 的 source 全部进 evidence 为 observation。

与现有 Macro「水位」关系：

| 模块 | 粒度 | 用途 |
|------|------|------|
| Macro Water-Level（Dune 日级） | 链/平台 24h | 大盘水温 |
| Market Heat | Token 分钟级 | 单币热度 / Feed 排序 |

---

## 7. Frontend 组件拆分

### 7.1 应用结构

```
apps/alpha-terminal/                 # 或 packages/ui 若 monorepo
  src/
    app/
      terminal/page.tsx              # 三栏壳
      token/[chain]/[ca]/page.tsx
      wallet/[address]/page.tsx
      cluster/[id]/page.tsx
    components/
      layout/
        TerminalShell.tsx
        TopBar.tsx
        ConnectionBadge.tsx
      channel/
        ChannelRail.tsx
        ChannelListItem.tsx
        ChannelBadgeCount.tsx
        SaveViewDialog.tsx
      feed/
        EventTimeline.tsx
        EventRow.tsx
        EventRowCompact.tsx
        EventBurstGroup.tsx
        FeedFilters.tsx
        FeedEmptyState.tsx
        AbsoluteTimeLabel.tsx
      research/
        ResearchInspector.tsx
        TokenHeader.tsx
        TabStrip.tsx
        panels/
          OverviewPanel.tsx
          MarketPanel.tsx
          LiquidityPanel.tsx
          HoldersPanel.tsx
          WalletsPanel.tsx
          ClusterPanel.tsx
          HistoryPanel.tsx
          RiskPanel.tsx
          AiSummaryPanel.tsx
      scores/
        AlphaScorePill.tsx
        HeatMeter.tsx
        LiquidityGradeBadge.tsx
        RiskGradeBadge.tsx
        ScoreReasonList.tsx
      entities/
        WalletChip.tsx
        TokenChip.tsx
        ClusterChip.tsx
        EntityTooltip.tsx          # label / filter / mute
      charts/
        MiniPriceChart.tsx
        BuySellVolumeBars.tsx
        HolderGrowthSpark.tsx
        ClusterSyncChart.tsx
    hooks/
      useAlphaFeed.ts              # WS + fallback poll
      useChannelSubscriptions.ts
      useTokenResearch.ts          # getQuick/DeepAnalysis
      useFeedFilters.ts
    lib/
      eventCopy.ts                 # summary templates
      format.ts
    stores/
      terminalUiStore.ts           # selected event, layout
      preferenceStore.ts
```

### 7.2 组件职责矩阵

| 组件 | 数据依赖 | 备注 |
|------|----------|------|
| `EventTimeline` | `GET/WS /feed` | 虚拟列表（react-virtual） |
| `EventRow` | `AlphaEvent` | 不请求分析；点选才拉 Research |
| `ResearchInspector` | `getQuickAnalysis` → 可选 deep | 复用现有 AnalysisService |
| `LiquidityPanel` | `LiquidityHealth` API | 独立 endpoint，30–60s 缓存 |
| `HoldersPanel` | AnalysisResult.concentration | 现有 real-holders |
| `ClusterPanel` | Cluster Engine API | 扩展 funding-clusters |
| `EntityTooltip` | wallet profile cache | Chain.fm 式行内操作 |

### 7.3 状态流

```
WS alpha:events
  → feedStore.append (dedupe)
  → ChannelRail badge++
  → if selected token matches → soft invalidate research

User clicks EventRow
  → terminalUiStore.selectedEventId
  → useTokenResearch(ca) → Quick Analysis + Heat/Liq
  → panels render
```

### 7.4 技术建议

- Next.js / React + Tailwind + 暗色 design tokens
- 虚拟列表：事件高峰 10+/s
- WS 优先，SSE 次选；断线指数退避
- 分数与金额等宽字体（IBM Plex Mono / JetBrains Mono）

---

## 8. Backend 事件流设计

### 8.1 拓扑

```
                    ┌──────────── Observation Adapters ────────────┐
                    │ GMGN  Chain.fm  Birdeye  TG/X  DexScreener   │
                    └──────────────────┬───────────────────────────┘
                                       ▼
                              Observation Normalizer
                                       │
Helius WS / Webhook / Yellowstone ─────┤
RPC reconcile ─────────────────────────┤
                                       ▼
                              Fact Ingest (idempotent)
                              normalized_trades, transfers,
                              funding_edges, token creates
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
            Wallet Intel         Cluster Engine     Market Enricher
            (profile/score)      (activity detect)  (liq/heat inputs)
                    └──────────────────┼──────────────────┘
                                       ▼
                              Alpha Score Engine
                                       │
                                       ▼
                                Event Factory
                          (type-specific detectors)
                                       │
                                       ▼
                              Channel Router + Dedupe
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
              PostgreSQL         Redis Stream          Alert Worker
              alpha_events       alpha:events          TG / Web Push
                                       │
                                       ▼
                                 WS Gateway
                              /ws/feed?channels=
```

### 8.2 核心服务

| Service | 职责 |
|---------|------|
| `ObservationIngestService` | 外部信号入库，不产生结论事件 |
| `FactIngestService` | 链上事实幂等写入（现有 adapter 扩展） |
| `WalletIntelligenceService` | 扩展 `classifyWallet` → Alpha Profile |
| `ClusterActivityService` | 在 funding-clusters 上检测「同步行动」 |
| `AlphaScoreService` | 钱包 / 事件综合分 |
| `LiquidityHealthService` | LP Health + Volume Quality |
| `MarketHeatService` | Token Heat |
| `EventFactory` | 生成 `AlphaEvent` |
| `ChannelRouter` | 过滤、去重、写入、发布 |
| `FeedQueryService` | 历史回放 + 游标分页 |
| `AlertService` | 订阅通知 |
| `AnalysisService` | **保持** Quick/Deep CA 研究（Investigation） |

### 8.3 EventFactory 检测器（示例）

```typescript
// Smart Money Buy detector (pseudo)
onNormalizedTrade(trade):
  if trade.side != buy: return
  profile = walletIntel.get(trade.trader)
  if profile.alphaScore < 80: return
  if profile.clusterConfidence > 0.5 && profile.success10x < 3: return  // optional
  if !profile.activeWithin(30d): return

  cluster = clusterEngine.forWallet(trade.trader)
  liq = liqHealth.get(trade.token)
  heat = heat.get(trade.token)

  emit SmartMoneyBuyEvent {
    metrics: { alphaScore: profile.alphaScore, ... }
    reasons: buildReasons(profile, cluster, liq)
    evidence: [...profile.evidence, observationTags...]
    channels: router.match(...)
  }
```

```typescript
// Sniper detector
onTokenCreate(token):
  window = first 30 seconds trades
  for buy in window:
    stats = sniperStats.get(buy.trader)
    if stats.elite: emit SniperBuyEvent
```

```typescript
// Cluster activity detector
onBuys in sliding 120s:
  groups = wallets sharing funding cluster id
  if group.size >= minimumMembers && synced buys on same token:
    emit ClusterActivityEvent
```

### 8.4 API 草图

```
GET  /api/v1/channels
GET  /api/v1/channels/:id/feed?cursor=&limit=
WS   /ws/v1/feed?channels=smart_money,cluster_activity

GET  /api/v1/tokens/:chain/:ca/research?depth=quick|deep
GET  /api/v1/tokens/:chain/:ca/liquidity-health
GET  /api/v1/tokens/:chain/:ca/heat

GET  /api/v1/wallets/:address/profile
GET  /api/v1/clusters/:id

POST /api/v1/me/subscriptions
POST /api/v1/me/views
POST /api/v1/me/mutes
```

### 8.5 性能与正确性

| 关注点 | 策略 |
|--------|------|
| 幂等 | `dedupe_key` + tx/event_index 唯一 |
| 乱序 | 按 `occurred_at` 插入；WS 允许短暂乱序，UI 稳定排序 |
| Reorg | finalized 回补；降级事件可标记 `provisional` |
| 风暴 | Channel `rateLimitPerMinute` + 客户端合并 |
| 缓存 | Research Quick 30s；Heat/Liq 15–60s；Profile 5–15m |
| 审计 | 所有分数 `rule_version` + evidence 可回放 |

---

## 9. 与现有 Wallet Intelligence / CA Data Layer 整合

### 9.1 现有资产（复用，不重写）

| 现有模块 | 路径 | Terminal 中的角色 |
|----------|------|-------------------|
| `AnalysisService` | `application/analysis-service.ts` | Investigation：Research Card 数据源 |
| `detectFundingClusters` | `domain/rules/funding-clusters.ts` | Cluster Channel + Holder 清洗 |
| `classifyWallet` | `domain/rules/wallet-quality.ts` | Wallet profile 基础标签 |
| `calculateRealHolderConcentration` | `domain/rules/real-holders.ts` | Holders 面板 |
| `calculateDevBehavior` | `domain/rules/dev-behavior.ts` | Risk 面板 |
| `MarketSnapshot` | `types.ts` | Liq/FDV 原始输入 |
| `ChainDataAdapter` / Helius | `infrastructure/solana` | Fact 流 |
| Macro Water-Level | macro daily services | 大盘上下文，非 token heat |
| Constitution | `PROJECT_CONSTITUTION.md` | 外部数据不覆盖链上事实 |

### 9.2 扩展点（增量）

```
src/domain/
  alpha/
    types-event.ts
    types-channel.ts
    types-score.ts
    types-liquidity-heat.ts
  rules/
    wallet-quality.ts          # keep
    alpha-wallet-score.ts      # NEW：历史 10x、活跃、反 cluster
    sniper-stats.ts            # NEW
    volume-quality.ts          # NEW
    liquidity-health.ts        # NEW
    market-heat.ts             # NEW
    event-reasons.ts           # NEW

src/application/
  analysis-service.ts          # keep Investigation
  wallet-intelligence-service.ts  # NEW facade
  event-factory-service.ts     # NEW
  channel-router-service.ts    # NEW
  feed-query-service.ts        # NEW
  liquidity-health-service.ts  # NEW
  market-heat-service.ts       # NEW

src/infrastructure/
  stream/
    redis-event-bus.ts
  ws/
    feed-gateway.ts
  observation/
    gmgn-adapter.ts            # observation only
    chainfm-adapter.ts         # observation only
    social-adapter.ts
```

### 9.3 WalletQuality → Alpha Wallet Intelligence

现有 `WalletQualityLabel`：

`new_wallet | historical_wallet | suspected_bot | whitelist | blacklist | unknown`

扩展为 **Profile**（不破坏旧接口）：

```typescript
export interface AlphaWalletProfile {
  address: string;
  quality: WalletQuality;           // existing
  alphaScore: number;               // 0–100 internal
  tier: "SSR" | "SR" | "R" | "N";
  stats: {
    tokensParticipated30d: number;
    tokensParticipatedAll: number;
    success10x: number;
    success5x: number;
    winRate?: number;
    avgRoi?: number;
    sniperLaunches?: number;
    sniperProfitRate?: number;
  };
  cluster: {
    clusterId: string | null;
    confidence: number;
    isPrimaryClusterActor: boolean;
  };
  observations: EvidenceItem[];     // gmgn tags etc.
  activeWithinDays: number;
  ruleVersions: Record<string, string>;
  completeness: "complete" | "partial";
}
```

映射建议：

| AlphaScore | Tier | 进入 Smart Money Channel |
|------------|------|---------------------------|
| ≥ 90 | SSR | 是 |
| 80–89 | SR | 是 |
| 65–79 | R | 仅 Alpha Feed 降权 |
| < 65 | N | 否（除非 Whale 等其它频道） |

**白名单/黑名单**：继续作硬标签；GMGN smart money 只进 `observations`，由 `alpha-wallet-score` 决定是否加分。

### 9.4 Cluster Engine 整合

现有：token 级同源 funding cluster，service funder 抑制。

增量：

1. **持久化全局 Cluster 身份**（跨 token 追踪同一集团）
2. **实时 Cluster Activity**：时间窗内多成员同 token 买入 → Event
3. **Feed 展示**资金深度（1–4 跳，窗口严格）
4. Research 面板复用 holder 排除 evidence

### 9.5 Investigation 路径（不变的核心）

```
User pastes CA
  → AnalysisService.getQuickAnalysis
  → 并行 LiquidityHealth + MarketHeat
  → ResearchInspector tabs
  → optional getDeepAnalysis (creator history, longer window)
```

Discovery 事件点击 token 时 **复用同一路径**，保证 Feed 与搜索结论一致。

### 9.6 数据流对照（最终形态）

```
Data Sources → Observation Layer → Wallet Intelligence Engine
     → Alpha Score Engine → Event Engine
           ↙        ↓         ↘
    Alpha Feed  Channel Sys  Alert Sys
           ↘        ↓         ↙
              CA Research Card
              (AnalysisService + Heat/Liq + Cluster)
```

---

## 10. Alpha Score Engine（结论层）

### 10.1 钱包分（Wallet）

特征（v1）：

| 特征 | 方向 | 说明 |
|------|------|------|
| 历史 10x / 5x 次数 | + | 需可验证价格路径；incomplete → 降权 |
| 胜率 / 样本数 | + | 小样本惩罚 |
| 最近 30d 活跃 | + | 冷钱包降权 |
| Cluster 成员置信 | − | 阴谋集团减分或剔除 SM Channel |
| Bot 嫌疑 | − | 沿用 wallet-quality |
| 黑名单 | 一票否决 | score=0 |
| Observation: GMGN SM | 弱 + | cap ≤ +8 分 |
| Observation: Chain.fm 频道热度 | 弱 + | cap ≤ +5 分 |

### 10.2 事件分（Event）

```
eventAlpha ≈
  0.45 * walletAlpha +
  0.20 * entryQuality (低 FDV、合理 LP) +
  0.15 * heat +
  0.10 * liqHealth +
  0.10 * antiRisk (无 cluster / 无 wash)
```

### 10.3 输出纪律

每个分数必须：

```json
{
  "score": 87,
  "tier": "SR",
  "reasons": ["..."],
  "evidence": [{"key": "...", "source": "internal", "confidence": 0.9}],
  "ruleVersion": "alpha_wallet_v1",
  "completeness": "partial"
}
```

---

## 11. 分阶段落地（建议）

### Phase 0 — 对齐（1 周）

- 冻结 Event / Channel / Score schema
- Observation 适配器接口（mock）
- 宪法：外部源 observation-only 测试用例

### Phase 1 — Discovery MVP（2–3 周）

- Helius 交易流 → Smart Money Buy 事件（基于内部 Alpha 阈值）
- Channel：`alpha_feed` + `smart_money`
- 三栏 UI 骨架 + EventTimeline + ResearchInspector(Quick)
- Redis Stream + WS

### Phase 2 — 差异化（2 周）

- Cluster Activity Channel（核心）
- Sniper Channel + sniper stats
- Liquidity Health + Heat 面板

### Phase 3 — 社交与告警（2 周）

- KOL Observation（X/TG）+ 链上 early buy 对齐
- Telegram Alert
- User Channel / Save View

### Phase 4 — 增强

- 多链（BSC，在 Solana E2E GREEN 后）
- 全局 Cluster 图谱
- 回放与纸面组合复盘

---

## 12. 验收标准（产品级）

| # | 标准 |
|---|------|
| 1 | 用户 0 次手动搜 CA 也能从 Feed 看到带 reasons 的机会事件 |
| 2 | 点击事件 3s 内打开 Research Card（Quick 缓存命中 <100ms 目标保持） |
| 3 | GMGN 标 SM 但内部 cluster 高置信时 **不会** 进 Smart Money Channel |
| 4 | Liquidity 展示必须含 grade + LP/FDV + VQ，禁止单数字 |
| 5 | Heat 展示含 drivers/dampeners |
| 6 | 全部事件可按 `eventId` 回放 evidence |
| 7 | 与 `getQuickAnalysis` 对同一 CA 的 holder/dev 结论一致 |
| 8 | Constitution：无交易执行、无密钥、partial 不假精确 |

---

## 13. 风险与开放问题

| 风险 | 缓解 |
|------|------|
| Smart Money 标签污染 | 内部分 + cluster 否决 + 样本惩罚 |
| Sniper 误报 | elite 历史过滤 + 最低金额 |
| 刷量误判 | VQ 多特征；completeness |
| Feed 噪音 | rate limit、dedupe、订阅粒度 |
| 外部 API 限流 | Observation 降采样；不阻断 Fact 路径 |
| 成功 ROI 统计偏差 | 明确价格采样方法；标 incomplete |

**待 Owner 决策**：

1. 是否对 C 端开放 User-generated Channel（Chain.fm 社交模式）还是仅系统频道？
2. Telegram Alert 是否进本 repo 边界（宪法写明不做 TG；可由侧车服务做）？
3. 多链启动顺序是否仍锁定 Solana-first？
4. SSR 阈值是否对外公开算法细节？

---

## 14. 附录：示例事件 JSON

```json
{
  "eventId": "01JABC...",
  "eventType": "smart_money_buy",
  "chain": "solana",
  "occurredAt": "2026-07-27T10:31:20.000Z",
  "ingestedAt": "2026-07-27T10:31:20.400Z",
  "severity": "high",
  "token": {
    "ca": "So1...abc",
    "symbol": "ABC",
    "launchpad": "pump_fun"
  },
  "actors": [
    {
      "address": "7xK2...f9a1",
      "role": "buyer",
      "label": "SSR-042",
      "alphaScore": 87,
      "tier": "SSR"
    }
  ],
  "metrics": {
    "alphaScore": 87,
    "heatScore": 72,
    "liquidityGrade": "A",
    "riskGrade": "low",
    "fdvUsd": 45000,
    "liquidityUsd": 8000,
    "amountNative": 4.2,
    "amountUsd": 720
  },
  "summary": "SSR Smart Money 买入 $ABC · FDV 45K · 无 Cluster",
  "reasons": [
    "历史捕捉 12 个 10x",
    "无 Cluster 关联",
    "LP ratio 18% · Volume organic"
  ],
  "evidence": [
    {
      "key": "wallet.success10x",
      "value": 9,
      "source": "internal",
      "confidence": 0.92,
      "observedAt": "2026-07-27T10:31:20.000Z"
    },
    {
      "key": "observation.gmgn_smart_money",
      "value": true,
      "source": "gmgn",
      "confidence": 0.6,
      "observedAt": "2026-07-27T09:00:00.000Z",
      "note": "feature only; not decisive"
    }
  ],
  "clusterId": null,
  "channels": ["alpha_feed", "smart_money"],
  "dedupeKey": "sm_buy:7xK2...f9a1:So1...abc:5tx...",
  "completeness": "complete",
  "warnings": [],
  "ruleVersions": {
    "alpha_wallet": "v1",
    "liq_health": "v1",
    "heat": "v1",
    "funding_clusters": "v1"
  },
  "payload": {
    "txHash": "5tx...",
    "side": "buy",
    "entryFdvUsd": 45000,
    "walletStats": {
      "tokensParticipated": 42,
      "success10x": 9,
      "success5x": 15
    },
    "cluster": { "id": null, "confidence": 0 }
  }
}
```

---

## 15. 文档结论

Chain.fm 值得吸收的不是皮肤，而是：

1. **Channel 化监控**（持续推送 > 主动搜索）
2. **日志时间线 + 强过滤**（扫盘效率）
3. **地址/事件一等公民**（tooltip 快捷操作）

我们必须用自有 **Wallet Intelligence + Cluster + Alpha Score + Risk** 把外部 Observation 压成可信结论，并用 **Liquidity Health / Market Heat** 补齐一级市场最关键的「假量/假流动性」识别。

最终产品形态：

```
Discovery（谁在买什么）  ×  Investigation（这币值不值得买）
= Meme 一级市场 Bloomberg Terminal
```

---

*Next：若认可本设计，建议拆 PR Plan：*
`SCHEMA-001` → `EVENT-PIPELINE-001` → `FEED-UI-001` → `CLUSTER-CHANNEL-001` → `LIQ-HEAT-001`。
