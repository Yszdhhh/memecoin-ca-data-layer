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
