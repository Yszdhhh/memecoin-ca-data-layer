# Macro Liquidity Snapshot V1 — 实现说明（2026-08-09）

> 对应 docs/research/MACRO_LIQUIDITY_DATA_SOURCES_20260809.md 的 P0 MVP（DefiLlama 水位 + Coinalyze 清算 fixture 路径）。
> 契约对齐 docs/blueprints/GOAL_EXECUTION_BLUEPRINT_V1.md §5.1 `/api/v1/liquidity/latest`（metric set / window / values / freshness / quality + §5.3 source watermark）。
> 本轮只做数据层：不接 UI/API/定时任务；测试零真实网络依赖。

## 1. 改动文件

| 文件 | 作用 |
|---|---|
| `src/domain/macro-liquidity.ts` | LiquiditySnapshotV1 及全部领域类型（new） |
| `src/application/macro-liquidity-percentiles.ts` | 7d/30d 分位纯函数（nearest-rank P25/P50/P75、percentile_rank、z-score；ruleVersion=`liquidity-percentiles-v1`） |
| `src/application/macro-liquidity-defillama.ts` | DefiLlama 适配器：`/overview/dexs/solana`、`/overview/fees/solana`、`/v2/historicalChainTvl/Solana`，注入 transport，逐端点降级 null+warnings |
| `src/application/macro-liquidity-coinalyze.ts` | Coinalyze 适配器：无 key fail-closed；有 key 走 `/v1/liquidation-history`（1hour + 1day，convert_to_usd），聚合 long/short |
| `src/application/macro-liquidity-snapshot.ts` | `buildLiquiditySnapshot()` 组装 LiquiditySnapshotV1 |
| `src/cli/run-macro-liquidity-snapshot.ts` | CLI：stdout 或 `--out <dir>` 写文件 |
| `src/infrastructure/type-guards.ts` | 项目统一 `isRecord`（rule: ts-no-local-is-record） |
| `test/macro-liquidity-{percentiles,defillama,coinalyze,snapshot}.test.ts` | 26 个新测试 |
| `package.json` | `macro:liquidity:snapshot` script |
| `.gitignore` | `artifacts/liquidity/`（私有输出目录） |
| `.env.example` | `COINALYZE_API_KEY` 说明 |
| `docs/MACRO_LIQUIDITY_SNAPSHOT_V1.md` | 本说明 |

## 2. 输出结构（LiquiditySnapshotV1）

```jsonc
{
  "schemaVersion": "liquidity-snapshot-v1",
  "generatedAt": "ISO-8601",
  "metricSets": [
    // (metric, source, window, value, changePct, percentile)
    { "metric": "dex_volume_usd", "source": "defillama", "window": "24h", "value": 1493144029.54, "changePct": 9.69, "percentile": null },
    { "metric": "dex_volume_usd", "source": "defillama", "window": "7d",  "value": 10678381205.42, "changePct": 14.29,
      "percentile": { "windowDays": 7, "current": 1468769311.41, "p25": 1361283964.02, "p50": 1493144029.54, "p75": 1712393241.88,
                      "rank": 42.86, "zScore": -0.356, "sampleCount": 7, "ruleVersion": "liquidity-percentiles-v1" } }
    // ... dex_volume 30d / protocol_fees 24h·7d·30d / tvl 24h·7d·30d / long·short_liquidation 24h·7d（共 13 行）
  ],
  "protocolShares": [ { "name": "PumpSwap", "volume24hUsd": 688113244, "share24hPct": 46.08 }, ... ],
  "freshness": { "observedAt": "ISO-8601", "maxMetricAgeHours": 0 },
  "quality": { "completeness": 0.692, "status": "degraded" },   // verified | degraded | unavailable
  "sources": [ { "source": "defillama", "tier": "B", "verificationStatus": "verified", "observedAt": "...", "completeness": 1, "warnings": [] }, ... ],
  "warnings": [ { "code": "coinalyze_requires_api_key", "message": "..." } ]
}
```

- **metricSets 13 行**：dex_volume 24h/7d/30d（value 取 DefiLlama total24h/total7d/total30d，7d/30d 行带分位）、protocol_fees 24h/7d/30d、tvl 24h/7d/30d（TVL 是水位不是流量：三行同值，7d/30d 行带分位）、long/short_liquidation 24h（1hour 聚合）与 7d（1day 聚合）。
- **分位语义**：`current` = 最新日点（可能是当天未完结 bucket），样本 = 其前 N 个完整日点；`rank = 100·count(v ≤ current)/N`；P25/P50/P75 为 nearest-rank；z-score 用总体标准差，零方差时为 null；样本 <2 个点时整个分位为 null。
- **协议占比**：取 `protocols[].total24h / total24h`（当前真实 API 形状；兼容旧 `volume` 字段），回退 `totalDataChartBreakdown`（当前形状为 `[[ts, {proto: value}]]`，取最新点）。
- **null 语义**：null = 不可用，永不显示为 0；每类缺失都伴随显式 warning code。

## 3. 降级与 fail-closed 契约

- DefiLlama 三个端点独立降级：HTTP 失败 / 抛错 / malformed → 该端点 null + `defillama_{dex_volume|fees|tvl}_{unavailable|malformed}` warning，其余端点照常，整体不抛异常。
- Coinalyze 无 `COINALYZE_API_KEY`（或 key 为空）：**fail-closed** — `available: false`、liquidation 指标全 null、warning `coinalyze_requires_api_key`，transport 不被调用、不假装有数据。
- Coinalyze 有 key 时走真实路径（`api_key` header）；1hour 成功但 1day 失败 → 24h 指标保留 + 7d 指标 null + warning；key 非法/HTTP 非 2xx → 整体 fail-closed。
- **口径声明**：Coinalyze 是 CEX 永续清算（BTC/ETH/SOL perp），不是链上数据；文档与 warning 文案均已写明。

## 4. CLI

```bash
npm run macro:liquidity:snapshot                 # snapshot JSON → stdout（最后一行是运行摘要 JSON）
npm run macro:liquidity:snapshot -- --out <dir>  # 写 <dir>/liquidity-snapshot-<ts>.json（不进 Git）
```

DefiLlama 无需 key，直接 live。Coinalyze 需配置环境变量（见下）。

## 5. Coinalyze key 配置说明

1. 在 api.coinalyze.net 注册获取 API key（免费档 40 calls/min，per-symbol 计费）。
2. 在 `.env`（勿提交）中设置：
   ```
   COINALYZE_API_KEY=<your_key>
   ```
3. 在运行 CLI 的 shell 中导出（或由启动器注入）该变量。未配置时程序按第 3 节 fail-closed，其余指标不受影响。
4. 注意：`/liquidation-history` 每个 symbol 计 1 call；本实现固定查询 BTC/ETH/SOL 三个 perp symbol，1hour + 1day 两个 interval，共 6 calls/次。

## 6. 测试清单（26 个，零真实网络）

- `macro-liquidity-percentiles.test.ts`：nearest-rank P25/P50/P75、percentile_rank 公式、z-score（含零方差 null）、7d/30d window、空序列/单点→null、全 0 窗口、trailingWindowValues 拆分。
- `macro-liquidity-defillama.test.ts`：dexs 全字段解析（24h/7d/30d、changes、protocol shares、7d/30d 分位精确值）、fees/TVL 解析、单端点 500 降级、transport 抛错全降级、malformed 体、缺 protocols→空+warning、旧 `volume` 字段兼容、新 breakdown 数组形状回退、<2 点 chart→分位 null、TVL malformed 降级。
- `macro-liquidity-coinalyze.test.ts`：无 key fail-closed 且 transport 不被调用、有 key 跨 symbol/interval 聚合精确值（含 header 校验）、HTTP 失败 fail-closed、malformed 体 fail-closed、1hour 成功+1day 失败→保留 24h+warning、全 0 清算→longShare null 非 NaN。
- `macro-liquidity-snapshot.test.ts`：全源完整快照（13 行、分位、protocolShares、sources watermarks、freshness、quality=verified）、无 key→liquidation 全 null+degraded、双源全挂→unavailable、warning 按 code 去重。

## 7. Live 实测记录（2026-08-09）

- `npm run macro:liquidity:snapshot`（无 COINALYZE_API_KEY）：HTTP 200 全通；Solana DEX 24h volume = 1,493,144,029.54 USD（与调研文档样本一致）；7d 分位 rank 42.86、30d rank 36.67；PumpSwap 24h 占比 46.08%（领跑，符合调研记录）；TVL = 4,824,980,961；Coinalyze 按预期 fail-closed（quality=degraded 0.692，warning `coinalyze_requires_api_key`）。
- 全量门禁：`npm run typecheck` / `npm test`（522 tests, 521 pass + 1 pre-existing skip）/ `npm run build` 全绿；`git diff --check` clean。
