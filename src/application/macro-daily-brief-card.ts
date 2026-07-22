import { createHash } from "node:crypto";
import type { MacroChain, MacroDailyBrief, MacroGlobalMetricObservation, MacroChainMetricObservation } from "../domain/macro-daily.js";
import type { MacroDailyDynamics, MacroMetricDynamics } from "./macro-daily-core-run-service.js";

export interface FeishuInteractiveCard {
  schema: "2.0";
  config: { wide_screen_mode: true };
  header: { title: { tag: "plain_text"; content: string }; template: "blue" };
  body: { elements: Array<Record<string, unknown>> };
}

export function buildMacroDailyBriefCard(brief: MacroDailyBrief, dynamics?: MacroDailyDynamics): FeishuInteractiveCard {
  const global = metricMap(brief.globalMetrics);
  const sections: Array<Record<string, unknown>> = [
    markdown("**全球市场关注**\n" + lines([
      ["DEX 成交额", global.dex_volume_usd],
      ["DEX 独立交易地址", global.active_trader_count],
      ["BTC 链上交易数", global.btc_transaction_count],
      ["BTC 手续费", global.btc_fee_usd],
    ])),
  ];
  for (const chain of ["solana", "bsc", "robinhood"] as const) {
    const report = brief.chainReports.find((item) => item.chain === chain);
    const metrics = metricMap(report?.metrics ?? []);
    const heading = chain === "robinhood" ? "**Robinhood（Uniswap v2/v3/v4 部分覆盖）**" : `**${chainLabel(chain)}**`;
    const entries: Array<[string, MacroChainMetricObservation | undefined]> = [
      ["DEX 成交额", metrics.dex_volume_usd],
      ["DEX 独立交易地址", metrics.active_trader_count],
    ];
    entries.push(["DEX \u4ea4\u6613\u7b14\u6570", metrics.swap_transaction_count], ["DEX \u4ea4\u6613\u817f\u6570", metrics.trade_leg_count]);
    const activityLine = `\n${formatLegsPerTransaction(metrics.swap_transaction_count, metrics.trade_leg_count)}`;
    if (chain === "solana") entries.push(["交易强度", intensity(metrics.dex_volume_usd, metrics.active_trader_count)], ["Pump 发射", metrics.pump_launch_count], ["PumpSwap 有效建池事件", metrics.external_pool_count]);
    if (chain === "bsc") entries.push(["Pancake 新池", metrics.pancakeswap_pool_created_count]);
    const dynamicsLine = chain === "solana" ? `\n日变动 / 7D 水位：${formatDynamics(dynamics?.chain["solana:dex_volume_usd"])}` : "";
    sections.push({ tag: "hr" }, markdown(`${heading}\n${lines(entries)}${activityLine}${dynamicsLine}`));
  }
  sections.push({ tag: "hr" }, markdown(`数据质量：${qualitySummary(brief)}。完整溯源已持久化，不在卡片展开。`));
  return { schema: "2.0", config: { wide_screen_mode: true }, header: { title: { tag: "plain_text", content: `每日链上市场简讯 · ${brief.reportDay}` }, template: "blue" }, body: { elements: sections } };
}

export function hashMacroDailyBriefCard(card: FeishuInteractiveCard): string {
  return createHash("sha256").update(JSON.stringify(card)).digest("hex");
}

function metricMap<T extends { metricName: string }>(metrics: readonly T[]): Record<string, T> {
  return Object.fromEntries(metrics.map((metric) => [metric.metricName, metric]));
}

function lines(entries: Array<[string, MacroGlobalMetricObservation | MacroChainMetricObservation | undefined]>): string {
  return entries.map(([label, metric]) => `${label}：${metric ? formatMetric(metric) : "数据不可用"}`).join("\n");
}

function intensity(volume: MacroChainMetricObservation | undefined, traders: MacroChainMetricObservation | undefined): MacroChainMetricObservation | undefined {
  if (!volume || !traders || traders.value === 0 || volume.completeness === 0 || traders.completeness === 0) return undefined;
  return { ...volume, metricName: "dex_volume_usd", value: volume.value / traders.value };
}

function formatMetric(metric: MacroGlobalMetricObservation | MacroChainMetricObservation): string {
  if (metric.completeness === 0) return "数据不可用";
  return metric.unit === "usd" ? formatUsd(metric.value) : formatCount(metric.value);
}

function formatLegsPerTransaction(transactions: MacroChainMetricObservation | undefined, legs: MacroChainMetricObservation | undefined): string {
  if (!transactions || !legs || transactions.completeness === 0 || legs.completeness === 0 || transactions.value === 0) return "\u6bcf\u7b14\u4ea4\u6613\u817f\u6570\uff1a\u6570\u636e\u4e0d\u53ef\u7528";
  return `\u6bcf\u7b14\u4ea4\u6613\u817f\u6570\uff1a${(legs.value / transactions.value).toFixed(2)}`;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 1 : 2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}`;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatDynamics(dynamics: MacroMetricDynamics | undefined): string {
  if (dynamics === undefined) return "历史积累中";
  const parts: string[] = [];
  if (dynamics.dayChangePct !== undefined) parts.push(`日变动 ${formatSignedPercent(dynamics.dayChangePct)}`);
  if (dynamics.sevenDayRelativePct !== undefined) parts.push(`7D 水位 ${formatPercent(dynamics.sevenDayRelativePct)}`);
  if (parts.length === 0) parts.push(`历史积累中 ${dynamics.baselineDayCount}/7`);
  else if (dynamics.sevenDayRelativePct === undefined) parts.push(`7D 积累 ${dynamics.baselineDayCount}/7`);
  return parts.join(" · ");
}

function formatSignedPercent(value: number): string { return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`; }
function formatPercent(value: number): string { return `${value.toFixed(0)}%`; }

function markdown(content: string): Record<string, unknown> { return { tag: "markdown", content }; }
function chainLabel(chain: MacroChain): string { return chain === "solana" ? "Solana" : "BSC"; }
function qualitySummary(brief: MacroDailyBrief): string {
  const observations = [...brief.globalMetrics, ...brief.chainReports.flatMap((report) => report.metrics)];
  const complete = observations.filter((metric) => metric.completeness === 1).length;
  return `${complete}/${observations.length} 项完整`;
}
