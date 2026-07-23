import type {
  MacroChain,
  MacroChainBriefSection,
  MacroChainMetricName,
  MacroDailyBrief,
  MacroDexDuneReconciliation,
  MacroGlobalMetricName,
  MacroHourlyChainProfileObservation,
  MacroHourlyProfileMetricName,
  MacroHourlyProfileSummary,
  MacroMarketActivitySummary,
  MacroProvenance,
  MacroSentimentObservationLayer,
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
  lines.push("", "## 市场环境", renderMarketActivitySummary(brief.marketActivitySummary));
  lines.push(...renderDexDuneReconciliation(brief.dexDuneReconciliation));

  for (const chain of CHAIN_ORDER) {
    const report = brief.chainReports.find((section) => section.chain === chain) ?? emptyReport(chain);
    lines.push("", `## ${chainHeading(report)}`);
    lines.push(...renderMetrics(report.metrics, (metric) => CHAIN_LABELS_BY_METRIC[metric.metricName]));
    lines.push(...renderHourlyProfileSummaries(report.hourlyProfileSummaries ?? []));
    lines.push(...renderHourlyProfiles(report.hourlyProfiles.filter((profile) => profile.profileEndDayUtc === undefined)));
  }

  lines.push("", "## 数据质量", "- 完整溯源、查询版本与告警已持久化，简讯正文不展开原始查询信息。");
  lines.push("- 完整度为 0% 的条目不会展示数值。");
  lines.push("- 流动性留存、首次验证外部池转化和生命周期阈值目前均为 PARK；固定样本合同不构成链上结论，也不以建池、成交或价格替代它们。");
  lines.push(renderSentimentLayer(brief.sentimentLayer));
  lines.push("- PumpSwap 有效建池事件不等于外盘、迁移、毕业或 token 级转化；本简讯不构成 token 交易信号。");
  return lines.join("\n");
}

function renderMarketActivitySummary(summary: MacroMarketActivitySummary | undefined): string {
  if (!summary || summary.analysisStatus === "not_comparable") {
    return "- 跨市场 DEX 活动：不可比较。只有完整、声明注册表覆盖的成交额、交易笔数和交易腿数才可比较；Robinhood 为 Uniswap v2/v3/v4 部分覆盖，不参与全链比较。";
  }
  const leaders = summary.leadingChains!.map((chain) => CHAIN_LABELS[chain]).join(" / ");
  const eligible = summary.eligibleChains.map((chain) => CHAIN_LABELS[chain]).join(" / ");
  return `- 跨市场 DEX 活动：${leaders} 在可比市场中成交额最高（比较集：${eligible}；按完整、声明注册表覆盖的日度 DEX 成交额）。这不是用户、需求或交易信号结论。`;
}

function renderDexDuneReconciliation(reconciliation: MacroDexDuneReconciliation | undefined): string[] {
  if (!reconciliation) {
    return ["- 实时市场温度：PARK（尚未录入 DexScreener 独立快照）。"];
  }

  const snapshot = reconciliation.dexscreener;
  const lines = [
    `- 实时市场温度（${snapshot.sourceLabel}，滚动24H，截至 ${snapshot.capturedAt.toISOString()}）：Solana Volume ${formatUsd(snapshot.volumeUsd)}；Txns ${formatCount(snapshot.transactionCount)}；Latest Block ${formatCount(snapshot.latestBlock)}。`,
    "- 说明：这是外部滚动24小时观察，不是 UTC 日线；Volume 是交易量，不是流动性；Latest Block 只表示链上新鲜度。",
  ];
  if (reconciliation.analysisStatus !== "aligned_pending_calibration") {
    lines.push(`- Dex–Dune 可比性：PARK（${reconciliationStatusLabel(reconciliation.analysisStatus)}）。不与 Dune 完整 UTC 日或历史水位直接同比。`);
    return lines;
  }

  const dune = reconciliation.dune!;
  lines.push(`- Dex–Dune 校准：窗口已对齐，Dune 同窗 Volume ${formatUsd(dune.volumeUsd)}；Unique Swap Txns ${formatCount(dune.uniqueSwapTransactionCount)}；Trade Legs ${formatCount(dune.tradeLegCount)}。`);
  lines.push(`- 校准状态：待累计样本；Volume 差异 ${formatOptionalSignedPercent(reconciliation.volumeDifferencePct)}。Dex Txns 与 Dune Unique Swaps / Trade Legs 均仅作候选对照，不可直接等同。`);
  return lines;
}

function reconciliationStatusLabel(status: Exclude<MacroDexDuneReconciliation["analysisStatus"], "aligned_pending_calibration">): string {
  const labels: Record<Exclude<MacroDexDuneReconciliation["analysisStatus"], "aligned_pending_calibration">, string> = {
    park_dune_unavailable: "等待 Dune 同窗口数据",
    park_window_mismatch: "Dune 与 Dex 时间窗口不一致",
    park_dune_watermark_behind: "Dune 数据水位落后于 Dex 窗口终点",
    park_dune_incomplete: "Dune 同窗口覆盖不完整",
  };
  return labels[status];
}

function renderSentimentLayer(layer: MacroSentimentObservationLayer | undefined): string {
  const sourceLabel = layer?.sourceLabel ?? "未授权";
  return `- 情绪观察层（独立层；来源标签：${sourceLabel}）：PARK。它不会覆盖链上事实，也不被表述为已验证需求、买盘或交易信号。`;
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

function formatOptionalSignedPercent(value: number | undefined): string {
  if (value === undefined) return "不可用";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function padHour(hour: number): string {
  return hour.toString().padStart(2, "0");
}