import type {
  MacroChain,
  MacroChainBriefSection,
  MacroChainMetricName,
  MacroDailyBrief,
  MacroGlobalMetricName,
  MacroHourlyChainProfileObservation,
  MacroProvenance,
} from "../domain/macro-daily.js";

const CHAIN_ORDER: readonly MacroChain[] = ["solana", "bsc", "robinhood"];

const CHAIN_LABELS: Record<MacroChain, string> = {
  solana: "Solana",
  bsc: "BSC",
  robinhood: "Robinhood",
};

const GLOBAL_LABELS: Record<MacroGlobalMetricName, string> = {
  dex_volume_usd: "DEX 成交额",
  active_trader_count: "DEX 独立交易地址",
  btc_transaction_count: "BTC 链上交易数",
  btc_fee_usd: "BTC 手续费",
};

const CHAIN_LABELS_BY_METRIC: Record<MacroChainMetricName, string> = {
  swap_transaction_count: "DEX \u4ea4\u6613\u7b14\u6570",
  trade_leg_count: "DEX \u4ea4\u6613\u817f\u6570",
  dex_volume_usd: "DEX 成交额",
  active_trader_count: "DEX 独立交易地址",
  pump_launch_count: "Pump 发射数",
  external_pool_count: "PumpSwap 外部池创建数",
  pancakeswap_pool_created_count: "Pancake 新池数",
  pancakeswap_lp_net_change_usd: "Pancake LP 净变化",
  uniswap_pool_created_count: "Uniswap 新池数",
};

export function renderMacroDailyBrief(brief: MacroDailyBrief): string {
  const lines = [`# 每日链上市场简讯 · ${brief.reportDay}`, "", "## 全球市场关注"];
  lines.push(...renderMetrics(brief.globalMetrics, (metric) => GLOBAL_LABELS[metric.metricName]));

  for (const chain of CHAIN_ORDER) {
    const report = brief.chainReports.find((section) => section.chain === chain) ?? emptyReport(chain);
    lines.push("", `## ${chainHeading(report)}`);
    lines.push(...renderMetrics(report.metrics, (metric) => CHAIN_LABELS_BY_METRIC[metric.metricName]));
    lines.push(...renderHourlyProfiles(report.hourlyProfiles));
  }

  lines.push("", "## 数据质量", "- 完整溯源、查询版本与告警已持久化，简讯正文不展开原始查询信息。");
  lines.push("- 完整度为 0% 的条目不会展示数值。");
  return lines.join("\n");
}

function renderMetrics<T extends MacroProvenance & { value: number; unit: "usd" | "count" }>(
  metrics: readonly T[],
  label: (metric: T) => string,
): string[] {
  if (metrics.length === 0) return ["- 暂无已注入观测数据。"];
  return metrics.map((metric) => {
    const renderedValue = metric.completeness === 0 ? "数据不可用" : formatValue(metric.value, metric.unit);
    return `- ${label(metric)}：${renderedValue}`;
  });
}

function renderHourlyProfiles(profiles: readonly MacroHourlyChainProfileObservation[]): string[] {
  if (profiles.length === 0) return [];
  return profiles.map((profile) => {
    const value = profile.completeness === 0 ? "数据不可用" : formatValue(profile.metricValue, unitForProfile(profile));
    const label = `${CHAIN_LABELS_BY_METRIC[profile.metricName]} 活跃时段（UTC ${padHour(profile.hourUtc)}:00）`;
    return `- ${label}：${value}，占比 ${formatPercent(profile.metricShare)}`;
  });
}

function chainHeading(report: MacroChainBriefSection): string {
  if (report.chain === "robinhood") return `${CHAIN_LABELS[report.chain]}（部分覆盖：Uniswap v2/v3/v4）`;
  return CHAIN_LABELS[report.chain];
}

function emptyReport(chain: MacroChain): MacroChainBriefSection {
  return { chain, metrics: [], hourlyProfiles: [] };
}

function unitForProfile(profile: MacroHourlyChainProfileObservation): "usd" | "count" {
  return profile.metricName.endsWith("_usd") ? "usd" : "count";
}

function formatValue(value: number, unit: "usd" | "count"): string {
  return unit === "usd" ? formatUsd(value) : formatCount(value);
}

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 1 : 2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 1_000_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}`;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

function padHour(hour: number): string {
  return hour.toString().padStart(2, "0");
}
