# Solana 一级市场水位 + 清算 数据源调研（2026-08-09）

> 调研：market-researcher（Grok 4.5）2026-08-09。范围：memecoin 战壕大盘/流动性水位看板。
> 约束：只走官方免费 API；不爬虫、不绕 Cloudflare。方法：官方文档直读 + 免费 endpoint 实测。

## 1. 数据源清单

| 数据源 | 类型 | API / URL | 免费额度与限流 | 关键字段 | 文档 |
|---|---|---|---|---|---|
| DefiLlama Free | DEX 活动/宏观 | `api.llama.fi/overview/dexs/solana`、`/overview/fees/solana`、`/v2/historicalChainTvl/Solana`、`/summary/dexs/{protocol}` | 无 key；实测 200；Solana DEX total24h≈1.49B，chart 1770 点 | total24h/7d/30d、change_1d/7d/1m、totalDataChart[[ts,vol]]、protocols[] | api-docs.defillama.com |
| Dune Analytics | 发射/毕业/活跃/收入 | `api.dune.com/api/v1`；dex_solana.trades、gas_solana.fees | Free 15/40 rpm（low/high）；~2500 credits/月 [INFERENCE 待 dashboard 复核] | 自定义 SQL 日 volume、unique traders、launches、graduations、fees | docs.dune.com/api-reference/overview/rate-limits |
| Coinalyze | 清算/OI/funding（CEX 永续） | `api.coinalyze.net/v1` `/liquidation-history` `/open-interest` `/future-markets` | 免费需 key；40 calls/min；intraday 约 1500–2000 点滚动；每 symbol 计 1 call（batch ≤20） | history[].t/l(liq vol)/s(short liq)；OI value/update；symbol `SOLUSDT_PERP.A` | api.coinalyze.net/v1/doc/ |
| GeckoTerminal DEX API | 新池/发射侧 | `api.geckoterminal.com/api/v2/networks/solana/new_pools`、`trending_pools` | 无 key；官方 ~10 calls/min（付费 250/min）；实测 new_pools 200 | pool_created_at、reserve_in_usd、volume_usd.m5..h24、transactions.buys/sells、fdv_usd | geckoterminal.com/dex-api |
| DexScreener Free | 新池/热门 pair 快照 | `api.dexscreener.com` `/token-profiles/latest/v1`、`/latest/dex/search`、`/token-pairs/v1/solana/{addr}` | 多数无 key；60 rpm（明文）；pair/token 核心未明标 [部分确认]；实测 search 200 | volume.m5..h24、txns、liquidity.usd、priceUsd、pairCreatedAt、dexId | docs.dexscreener.com/api/reference |
| Birdeye Data Services | CA 微观（付费链级） | `public-api.birdeye.so` Header X-API-KEY；`/defi/v2/tokens/new_listing`、`/defi/v3/token/meme/list`；链级 `/market/v1/blockchain-metrics` | Standard 免费 30k CU/月、1 rps；blockchain-metrics 需 Lite+（付费） | new_listing、meme list、token_overview；付费链级 volume/trade_count/active_trading_tokens | docs.birdeye.so/docs/pricing |
| GMGN OpenAPI | Meme 发射/热度 | 账户 OpenAPI + github.com/GMGNAI/gmgn-skills | ~1 rps（弱确认）；不稳定 | 新币/热度/持有人 | gmgn.ai |
| Raydium API v3（可选） | 单协议池对照 | `api-v3.raydium.io/pools/info/list?poolSortField=volume24h` | 无 key；缓存 1–5 min；限流未硬标 [INFERENCE] | pool volume24h/7d/30d、TVL、mint | api-v3.raydium.io/docs |
| Helius Free RPC（非首选大盘） | 原始链上 | docs.helius.dev | ~1M credits/月；无现成 chain-wide 活跃地址聚合 | 需自聚合，成本高 | docs.helius.dev |

### 看板指标 → 源映射

| 指标 | 首选免费源 | 备选 |
|---|---|---|
| Solana DEX 日/7d/30d volume | DefiLlama /overview/dexs/solana | Dune dex_solana.trades（已有 SQL） |
| 协议收入/fees | DefiLlama /overview/fees/solana | Dune fees SQL |
| TVL | DefiLlama /v2/historicalChainTvl/Solana | — |
| 发射/毕业计数 | Dune（pump create + migrate） | GeckoTerminal new_pools 弱代理 |
| 新池列表 | GeckoTerminal new_pools | DexScreener / Birdeye new_listing |
| 活跃地址 | Dune unique trader | Birdeye blockchain-metrics（付费） |
| 清算 long/short | Coinalyze /liquidation-history | — |

## 2. 最低可行查询要点

- DefiLlama：`GET /overview/dexs/solana?excludeTotalDataChart=false&dataType=dailyVolume`（PumpSwap 24h 领跑，2026-08-09 样本）
- Dune：POST `/query/{id}/execute` → GET `/execution/{id}/results`；**策略：浏览器/定时跑 query，API 只拉 latest results**（省 credit）；SQL 必须 block_time 分区过滤；毕业 SQL 勿写死单一 program（pump 目标曾迁 Raydium 后 PumpSwap）
- Coinalyze：`/liquidation-history?symbols=BTCUSDT_PERP.A,ETHUSDT_PERP.A,SOLUSDT_PERP.A&interval=1hour&from&to&convert_to_usd=true`；聚合 sum(l)/sum(s)/偏斜
- GeckoTerminal：每 10–15 min 拉 new_pools page=1..N（≤10 rpm），本地去重计数

## 3. 刷新节奏与 7d/30d 分位

| 层 | 指标 | 源 | 刷新 |
|---|---|---|---|
| L0 宏观水位 | DEX vol/fees/TVL | DefiLlama | 1–4h |
| L1 清算 | long/short liq、OI | Coinalyze | 15–30 min（1h bar） |
| L2 发射/新池 | new pool count、median liq | GeckoTerminal | 10–15 min |
| L3 毕业/活跃/收入 | graduations、unique traders | Dune | 日更 1–2 次 |
| L4 CA 微观 | 单币 | GMGN/Birdeye/DexScreener | 与大盘解耦 |

分位算法（本地）：取 totalDataChart 最后 7/30 完整日点 → `percentile_rank(x) = 100*count(v<=x)/N`，同时输出 P25/P50/P75、z-score。credit 友好：DefiLlama 每小时 3 个 GET 重建全部宏观分位。

## 4. 风险

- 需要 key：Coinalyze（已有 key TODO）、Dune、Birdeye、GMGN → 最小看板可先 DefiLlama+GeckoTerminal 无 key
- 限流严：Birdeye 1rps/30k CU；GT ~10/min；Coinalyze per-symbol；Dune credit
- 免费包砍功能：Birdeye blockchain-metrics 不在 Standard → 活跃地址走 Dune
- DefiLlama 口径：适配器定义 volume，与链上原始 sum 可能不一致；协议改名（PumpSwap vs pump.fun）
- Coinalyze 是 CEX 永续清算，非链上：产品文案写清
- GMGN/CF：官方 API 仍可能不稳定，大盘主路径避开
- Dune credit 2500/月：上线前账户 Usage 复核

## 5. MVP 定义（推荐顺序）

1. P0 DefiLlama：Solana DEX 24h vol + 30d/7d 分位 + fees/TVL 分位（无 key，实测可用）
2. P0 Coinalyze：SOL+BTC+ETH 24h long/short 清算（用户有 key）
3. P1 Dune 日更（复用已有 solana_dex_volume.sql / memecoin_revenue.sql）或 GeckoTerminal new_pools（零 credit 发射代理）
4. 后置：Birdeye/GMGN/DexScreener 继续服务 CA 卡，不进 v1 大盘主路径

## 6. 实测记录（2026-08-09）

- defillama dexs/fees/tvl solana：全部 HTTP 200
- geckoterminal new_pools：200
- dexscreener search：200
- 样本：Solana DEX total24h = 1,493,144,029.54 USD
