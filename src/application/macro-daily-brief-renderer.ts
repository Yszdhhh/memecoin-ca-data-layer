import type {
  MacroChain,
  MacroChainBriefSection,
  MacroChainMetricName,
  MacroDailyBrief,
  MacroGlobalMetricName,
  MacroHourlyChainProfileObservation,
  MacroHourlyProfileMetricName,
  MacroHourlyProfileSummary,
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
  swap_transaction_count: "DEX 交易笔数",
  trade_leg_count: "DEX 交易腿数",
  dex_volume_usd: "DEX 成交额",
  active_trader_count: "DEX 独立交易地址",
  pump_launch_count: "Pump 发射数",
  external_pool_count: "PumpSwap 有效建池事件",
  pancakeswap_pool_created_count: "Pancake 新池数",
  pancakeswap_lp_net_change_usd: "Pancake LP 净变化",
  uniswap_pool_created_count: "Uniswap 新池数",
};

const HOURLY_LABELS: Record<MacroHourlyProfileMetricName, string> = {
  ...CHAIN_LABELS_BY_METRIC,
  active_trader_address_hour_count: "定价 trade-leg 地址-小时观察数",
  pump_create_event_count: "Pump create 事件数",
  valid_pumpswap_pool_create_event_count: "PumpSwap 有效建池事件数",
};

export function renderMacroDailyBrief(brief: MacroDailyBrief): string {
  const lines = [`# 每日链上市场简讯 · ${brief.reportDay}`, "", "## 全球市场关注"];
  lines.push(...renderMetrics(brief.globalMetrics, (metric) => GLOBAL_LABELS[metric.metricName]));

  for (const chain of CHAIN_ORDER) {
    const report = brief.chainReports.find((section) => section.chain === chain) ?? emptyReport(chain);
    lines.push("", `## ${chainHeading(report)}`);
    lines.push(...renderMetrics(report.metrics, (metric) => CHAIN_LABELS_BY_METRIC[metric.metricName]));
    lines.push(...renderHourlyProfileSummaries(report.hourlyProfileSummaries ?? []));
    lines.push(...renderHourlyProfiles(report.hourlyProfiles.filter((profile) => profile.profileEndDayUtc === undefined)));
  }

  lines.push("", "## 数据质量", "- 完整溯源、查询版本与告警已持久化，简讯正文不展开原始查询信息。");
  lines.push("- 完整度为 0% 的条目不会展示数值。");
  lines.push("- 流动性留存、首次验证外部池转化、生命周期阈值与情绪观察目前均为 PARK；不以建池、成交或价格替代它们。");
  lines.push("- PumpSwap 有效建池事件不等于外盘、迁移、毕业或 token 级转化；本简讯不构成 token 交易信号。");
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

function renderHourlyProfileSummaries(summaries: readonly MacroHourlyProfileSummary[]): string[] {
  return summaries.map((summary) => {
    const label = `${HOURLY_LABELS[summary.metricName]} ${summary.profileWindowDays}日 UTC 小时画像`;
    if (summary.analysisStatus === "partial") {
      return `- ${label}：窗口不完整（${summary.coveredDayCount}/${summary.expectedDayCount} 天），仅部分累计；未输出峰值、高活跃窗口或时间集中度。`;
    }
    if (summary.analysisStatus === "not_applicable") {
      return `- ${label}：完整窗口无该类事件；峰值、高活跃窗口和时间集中度不适用。`;
    }
    return `- ${label}：峰值 ${padHour(summary.peakHourUtc!)}:00 UTC；高活跃窗口 ${summary.highActivityWindowUtc!}；时间 HHI ${summary.intradayTimeConcentrationHhi!.toFixed(4)}（有效活跃小时 ${summary.effectiveActiveHours!.toFixed(2)}）。`;
  });
}

function renderHourlyProfiles(profiles: readonly MacroHourlyChainProfileObservation[]): string[] {
  if (profiles.length === 0) return [];
  return profiles.map((profile) => {
    const value = profile.completeness === 0 ? "数据不可用" : formatValue(profile.metricValue, unitForProfile(profile));
    const label = `${HOURLY_LABELS[profile.metricName]} 活跃时段（UTC ${padHour(profile.hourUtc)}:00）`;
    return `- ${label}：${value}，占比 ${formatPercent(profile.metricShare)}`;
  });
}

function chainHeading(report: MacroChainBriefSection): string {
  if (report.chain === "robinhood") return `${CHAIN_LABELS[report.chain]}（部分覆盖：Uniswap v2/v3/v4）`;
  return CHAIN_LABELS[report.chain];
}

function emptyReport(chain: MacroChain): MacroChainBriefSection {
  return { chain, metrics: [], hourlyProfiles: [], hourlyProfileSummaries: [] };
}

function unitForProfile(profile: MacroHourlyChainProfileObservation): "usd" | "count" {
  return profile.metricName === "dex_volume_usd" ? "usd" : "count";
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