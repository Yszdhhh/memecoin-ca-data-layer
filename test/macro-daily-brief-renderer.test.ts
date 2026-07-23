import assert from "node:assert/strict";
import test from "node:test";
import { renderMacroDailyBrief } from "../src/application/macro-daily-brief-renderer.js";
import type { MacroDailyBrief, MacroProvenance } from "../src/domain/macro-daily.js";

const provenance: MacroProvenance = {
  source: "dune",
  queryRef: "dune:blueprint:fixture",
  queryVersion: "blueprint:fixture@deadbeef#T1",
  sourceAsOf: new Date("2026-07-21T00:00:00Z"),
  computedAt: new Date("2026-07-21T00:05:00Z"),
  completeness: 1,
  warnings: [{ code: "SYNTHETIC_FIXTURE" }],
};

function brief(): MacroDailyBrief {
  return {
    reportDay: "2026-07-20",
    globalMetrics: [
      {
        ...provenance,
        reportDay: "2026-07-20",
        metricName: "dex_volume_usd",
        subject: "global_evm",
        value: 1250000,
        unit: "usd",
      },
    ],
    chainReports: [
      {
        chain: "robinhood",
        metrics: [
          {
            ...provenance,
            reportDay: "2026-07-20",
            chain: "robinhood",
            section: "supply",
            metricName: "uniswap_pool_created_count",
            value: 5,
            unit: "count",
            registryVersion: "spellbook:dex_robinhood:uniswap_v2_v3_v4@deadbeef",
            coverageStatus: "partial_coverage",
          },
        ],
        hourlyProfiles: [],
      },
      { chain: "bsc", metrics: [], hourlyProfiles: [] },
      {
        chain: "solana",
        metrics: [
          {
            ...provenance,
            reportDay: "2026-07-20",
            chain: "solana",
            section: "capital",
            metricName: "dex_volume_usd",
            value: 500000,
            unit: "usd",
            registryVersion: "spellbook:dex_solana@deadbeef",
            coverageStatus: "declared_registry",
          },
        ],
        hourlyProfiles: [
          {
            ...provenance,
            chain: "solana",
            profileWindowDays: 60,
            metricName: "dex_volume_usd",
            hourUtc: 2,
            sampleDayCount: 60,
            metricValue: 31000,
            metricShare: 0.08,
            registryVersion: "spellbook:dex_solana@deadbeef",
            coverageStatus: "declared_registry",
          },
        ],
      },
    ],
  };
}

test("renders stable compact global and chain sections without inline provenance", () => {
  const rendered = renderMacroDailyBrief(brief());

  assert.match(rendered, /# 每日链上市场简讯 · 2026-07-20/);
  assert.match(rendered, /DEX 成交额：\$1\.3M/);
  assert.match(rendered, /Solana[\s\S]*DEX 成交额：\$500\.0K/);
  assert.match(rendered, /活跃时段（UTC 02:00）：\$31\.0K，占比 8%/);
  assert.match(rendered, /Robinhood（部分覆盖：Uniswap v2\/v3\/v4）/);
  assert.doesNotMatch(rendered, /dune:blueprint:fixture|blueprint:fixture@deadbeef#T1/);
  assert.ok(rendered.indexOf("## Solana") < rendered.indexOf("## BSC"));
  assert.ok(rendered.indexOf("## BSC") < rendered.indexOf("## Robinhood"));
});

test("renders a coverage-gated cross-market activity leader without a demand claim", () => {
  const input = brief();
  input.marketActivitySummary = {
    reportDay: "2026-07-20",
    basis: "complete_declared_daily_dex_activity",
    analysisStatus: "complete",
    eligibleChains: ["solana", "bsc"],
    leadingChains: ["solana"],
    excludedChains: [{ chain: "robinhood", reason: "partial_coverage" }],
    warnings: [{ code: "volume_is_leg_sum" }, { code: "not_real_users_or_demand" }],
  };

  const rendered = renderMacroDailyBrief(input);
  assert.match(rendered, /跨市场 DEX 活动：Solana 在可比市场中成交额最高（比较集：Solana \/ BSC；按完整、声明注册表覆盖的日度 DEX 成交额）/);
  assert.match(rendered, /这不是用户、需求或交易信号结论/);
});

test("does not render values for unavailable observations or inline query metadata", () => {
  const input = brief();
  input.globalMetrics[0] = { ...input.globalMetrics[0]!, value: 999, completeness: 0, warnings: [{ code: "UNEXECUTED_BLUEPRINT" }] };
  const rendered = renderMacroDailyBrief(input);

  assert.match(rendered, /DEX 成交额：数据不可用/);
  assert.doesNotMatch(rendered, /\$999/);
  assert.doesNotMatch(rendered, /UNEXECUTED_BLUEPRINT|dune:query:/);
});

test("renders no recommendation or execution language", () => {
  const rendered = renderMacroDailyBrief(brief());

  assert.doesNotMatch(rendered, /交易建议|执行决策|买入|卖出|预测/);
  assert.match(rendered, /完整溯源、查询版本与告警已持久化/);
});

test("renders the source label from the separate PARK sentiment layer", () => {
  const input = brief();
  input.sentimentLayer = {
    layer: "sentiment",
    sourceLabel: "fixture-source-not-authorized",
    sourceAuthorization: "not_authorized",
    coverageStatus: "unknown",
    observationStatus: "park",
    warnings: [{ code: "source_not_authorized" }],
  };

  assert.match(renderMacroDailyBrief(input), /来源标签：fixture-source-not-authorized）：PARK/);
});

test("renders complete hourly time concentration and keeps unsupported lifecycle lines PARK", () => {
  const input = brief();
  input.chainReports.find((report) => report.chain === "solana")!.hourlyProfileSummaries = [{
    chain: "solana",
    metricName: "dex_volume_usd",
    profileWindowDays: 60,
    profileEndDayUtc: "2026-07-19",
    coveredDayCount: 60,
    expectedDayCount: 60,
    totalMetricValue: 100,
    analysisStatus: "complete",
    peakHourUtc: 0,
    highActivityWindowUtc: "00:00–01:00 UTC",
    intradayTimeConcentrationHhi: 0.38,
    effectiveActiveHours: 1 / 0.38,
    warnings: [],
  }];
  const rendered = renderMacroDailyBrief(input);

  assert.match(rendered, /DEX 成交额 60日 UTC 小时画像：峰值 00:00 UTC；高活跃窗口 00:00–01:00 UTC；时间 HHI 0\.3800/);
  assert.match(rendered, /流动性留存、首次验证外部池转化和生命周期阈值目前均为 PARK/);
  assert.match(rendered, /情绪观察层（独立层；来源标签：未授权）：PARK/);
  assert.match(rendered, /不会覆盖链上事实，也不被表述为已验证需求、买盘或交易信号/);
  assert.match(rendered, /PumpSwap 有效建池事件不等于外盘、迁移、毕业或 token 级转化/);
});
test("renders a DexScreener rolling-24H snapshot separately from Dune history", () => {
  const input = brief();
  input.dexDuneReconciliation = {
    layer: "dex_dune_reconciliation",
    chain: "solana",
    dexscreener: {
      layer: "dexscreener_realtime",
      sourceLabel: "DexScreener manual fixture",
      chain: "solana",
      capturedAt: new Date("2026-07-20T12:00:00.000Z"),
      rollingWindowStart: new Date("2026-07-19T12:00:00.000Z"),
      rollingWindowEnd: new Date("2026-07-20T12:00:00.000Z"),
      volumeUsd: 120_000_000,
      transactionCount: 300_000,
      latestBlock: 400_000_000,
      warnings: [],
    },
    analysisStatus: "park_dune_unavailable",
    directComparisonStatus: "not_directly_comparable",
    warnings: [{ code: "dune_rolling_window_unavailable" }],
  };

  const rendered = renderMacroDailyBrief(input);
  assert.match(rendered, /DexScreener manual fixture，滚动24H/);
  assert.match(rendered, /Volume 是交易量，不是流动性/);
  assert.match(rendered, /Dex–Dune 可比性：PARK/);
  assert.doesNotMatch(rendered, /买入|卖出|预测|执行建议/);
});
