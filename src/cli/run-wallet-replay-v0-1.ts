import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  replayInputHash,
  replayWallet,
  scenarioIdentity,
  type ReplayEventResult,
  type ReplayScenarioResult,
  type WalletReplayInput,
  type WalletReplayResult,
} from "../application/wallet-replay/wallet-replay.js";

const RULE_VERSION = "wallet-replay-v0.1";

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n") + "\n";
}

function scenarioRows(results: WalletReplayResult[]): Array<Record<string, unknown>> {
  return results.flatMap((wallet) => wallet.scenarios.map((scenario) => ({
    wallet_id: wallet.walletId,
    chain: wallet.chain,
    scenario_id: scenarioIdentity(scenario.config),
    observation_delay_seconds: scenario.config.observationDelaySeconds,
    execution_delay_seconds: scenario.config.executionDelaySeconds,
    slippage_rate: scenario.config.slippageRate,
    ticket_notional_usd: scenario.config.ticketNotionalUsd,
    tax_rate: scenario.config.taxRate,
    liquidity_policy: scenario.config.liquidityPolicy,
    unknown_risk_policy: scenario.config.unknownRiskPolicy,
    sample_trade_count: wallet.sample.tradeCount,
    copyable_gross_return_usd: scenario.copyableGrossReturnUsd,
    copyable_net_return_usd: scenario.copyableNetReturnUsd,
    fill_rate: scenario.fillRate,
    no_fill_rate: scenario.noFillRate,
    partial_fill_rate: scenario.partialFillRate,
    average_slippage_rate: scenario.averageSlippageRate,
    fees_usd: scenario.feesUsd,
    tax_usd: scenario.taxUsd,
    max_drawdown_usd: scenario.maxDrawdownUsd,
    max_drawdown_rate: scenario.maxDrawdownRate,
    copyability_score: scenario.copyabilityScore,
    result_confidence: scenario.resultConfidence,
    failure_codes: Object.keys(scenario.failures).join("|"),
  })));
}

function eventRows(results: WalletReplayResult[]): Array<Record<string, unknown>> {
  const eventScenarios = results.flatMap((wallet) => wallet.scenarios.filter((scenario) =>
    scenario.config.observationDelaySeconds === 15
    && scenario.config.executionDelaySeconds === 5
    && scenario.config.slippageRate === 0.01
    && scenario.config.ticketNotionalUsd === 500,
  ).map((scenario) => ({ wallet, scenario })));
  return eventScenarios.flatMap(({ scenario }) => scenario.events.map((event) => ({
    wallet_id: event.walletId,
    trade_id: event.tradeId,
    token_id: event.tokenId,
    side: event.side,
    source_trade_at: event.sourceTradeAt,
    observed_at: event.observedAt,
    simulated_order_at: event.simulatedOrderAt,
    simulated_fill_at: event.simulatedFillAt,
    fill_status: event.fillStatus,
    failure_reason: event.failureReason,
    source_price_usd: event.sourcePriceUsd,
    market_price_usd: event.marketPriceUsd,
    fill_price_usd: event.fillPriceUsd,
    requested_notional_usd: event.requestedNotionalUsd,
    filled_notional_usd: event.filledNotionalUsd,
    filled_token_amount: event.filledTokenAmount,
    slippage_usd: event.slippageUsd,
    dex_fee_usd: event.dexFeeUsd,
    chain_fee_usd: event.chainFeeUsd,
    tax_usd: event.taxUsd,
    net_cash_flow_usd: event.netCashFlowUsd,
    price_observation: event.priceObservation,
    scenario_id: scenarioIdentity(scenario.config),
    observation_delay_seconds: scenario.config.observationDelaySeconds,
    execution_delay_seconds: scenario.config.executionDelaySeconds,
    slippage_rate: scenario.config.slippageRate,
    ticket_notional_usd: scenario.config.ticketNotionalUsd,
    tax_rate: scenario.config.taxRate,
    liquidity_policy: scenario.config.liquidityPolicy,
    unknown_risk_policy: scenario.config.unknownRiskPolicy,
  })));
}

function baselineScenario(wallet: WalletReplayResult, liquidityPolicy: "conservative_no_fill" | "proxy_full", unknownRiskPolicy: "exclude" | "allow_with_warning"): ReplayScenarioResult | null {
  return wallet.scenarios.find((scenario) =>
    scenario.config.observationDelaySeconds === 15
    && scenario.config.executionDelaySeconds === 5
    && scenario.config.slippageRate === 0.01
    && scenario.config.ticketNotionalUsd === 500
    && scenario.config.taxRate === 0
    && scenario.config.liquidityPolicy === liquidityPolicy
    && scenario.config.unknownRiskPolicy === unknownRiskPolicy,
  ) ?? null;
}

function classifications(wallet: WalletReplayResult, conservative: ReplayScenarioResult | null, mechanical: ReplayScenarioResult | null): string[] {
  const labels: string[] = [];
  if (wallet.sample.tradeCount === 0) labels.push("样本不足");
  if (wallet.providerPnlStatus === "provider_only") labels.push("仅平台统计，不足以下结论");
  if (conservative?.failures.liquidity_unknown_conservative) labels.push("流动性不足");
  if (wallet.sample.tradeFrequencyPerDay !== null && wallet.sample.tradeFrequencyPerDay >= 20) labels.push("高频难以复制");
  if (wallet.sample.tradeCount > 0 && mechanical && mechanical.copyableNetReturnUsd !== null && wallet.providerPnlUsd !== null && mechanical.copyableNetReturnUsd < 0 && wallet.providerPnlUsd > 0) labels.push("成本后优势消失");
  if (wallet.sample.tradeCount > 0 && mechanical && mechanical.copyableNetReturnUsd !== null && wallet.providerPnlUsd !== null && wallet.providerPnlUsd > 0 && mechanical.copyableNetReturnUsd < wallet.providerPnlUsd * 0.5) labels.push("容易晚到接盘");
  if (wallet.sample.tradeCount > 0 && conservative && conservative.fillRate !== null && conservative.fillRate >= 0.6 && conservative.copyableNetReturnUsd !== null && conservative.copyableNetReturnUsd > 0) labels.push("可复制性较好");
  if (mechanical && mechanical.copyableNetReturnUsd !== null && mechanical.copyableNetReturnUsd > 0 && wallet.sample.tradeCount > 0) labels.push("值得重点观察");
  return [...new Set(labels.length ? labels : ["样本不足"])] as string[];
}

function walletRows(results: WalletReplayResult[]): Array<Record<string, unknown>> {
  return results.map((wallet) => {
    const conservative = baselineScenario(wallet, "conservative_no_fill", "exclude");
    const mechanical = baselineScenario(wallet, "proxy_full", "allow_with_warning");
    const labels = classifications(wallet, conservative, mechanical);
    return {
      wallet_id: wallet.walletId,
      chain: wallet.chain,
      wallet_reported_provider_pnl_usd: wallet.providerPnlUsd,
      provider_pnl_status: wallet.providerPnlStatus,
      sample_trade_count: wallet.sample.tradeCount,
      sample_wallet_realized_return_usd: wallet.sample.realizedPnlUsd,
      sample_wallet_realized_trade_count: wallet.sample.realizedTradeCount,
      sample_wallet_unmatched_sell_count: wallet.sample.unmatchedSellCount,
      simulated_copyable_gross_return_usd: conservative?.copyableGrossReturnUsd ?? null,
      simulated_copyable_net_return_usd: conservative?.copyableNetReturnUsd ?? null,
      mechanical_upper_bound_gross_return_usd: mechanical?.copyableGrossReturnUsd ?? null,
      mechanical_upper_bound_net_return_usd: mechanical?.copyableNetReturnUsd ?? null,
      fill_rate: conservative?.fillRate ?? null,
      no_fill_rate: conservative?.noFillRate ?? null,
      partial_fill_rate: conservative?.partialFillRate ?? null,
      average_slippage_rate: conservative?.averageSlippageRate ?? null,
      fees_usd: conservative?.feesUsd ?? null,
      tax_assumption_rate: conservative?.config.taxRate ?? null,
      max_drawdown_usd: conservative?.maxDrawdownUsd ?? null,
      trade_frequency_per_day: wallet.sample.tradeFrequencyPerDay,
      median_holding_seconds: wallet.sample.medianHoldingSeconds,
      top_token_concentration: wallet.sample.topTokenConcentration,
      copyability_score: conservative?.copyabilityScore ?? null,
      mechanical_upper_bound_score: mechanical?.copyabilityScore ?? null,
      result_confidence: conservative?.resultConfidence ?? "low",
      classifications: labels.join("｜"),
      conservative_failure_codes: conservative ? Object.keys(conservative.failures).join("|") : "sample_insufficient",
    };
  });
}

function rankingRows(results: WalletReplayResult[]): Array<Record<string, unknown>> {
  return [...walletRows(results)]
    .sort((a, b) => Number(b.mechanical_upper_bound_score ?? -1) - Number(a.mechanical_upper_bound_score ?? -1) || String(a.wallet_id).localeCompare(String(b.wallet_id)))
    .map((row, index) => ({ ranking: index + 1, ...row }));
}

function noteSuggestions(results: WalletReplayResult[]): Array<Record<string, unknown>> {
  return results.map((wallet) => {
    const conservative = baselineScenario(wallet, "conservative_no_fill", "exclude");
    const mechanical = baselineScenario(wallet, "proxy_full", "allow_with_warning");
    const labels = classifications(wallet, conservative, mechanical);
    const note = labels.includes("高频难以复制")
      ? "高频难以复制｜延迟/流动性敏感｜仅样本回放"
      : labels.includes("可复制性较好")
        ? "样本回放可复制性较好｜仍需链上持续复核"
        : labels.includes("流动性不足")
          ? "流动性/风险未知｜保守回放不成交｜勿直接跟"
          : "样本不足｜仅平台统计或链上覆盖有限｜待复核";
    return { wallet_id: wallet.walletId, suggested_note: note, reasons: labels, manual_review_required: true };
  });
}

function summary(results: WalletReplayResult[], inputHash: string): string {
  const rows = walletRows(results);
  const lines = [
    "# Wallet replay v0.1 summary",
    "",
    `rule_version: ${RULE_VERSION}`,
    `input_sha256_prefix: ${inputHash.slice(0, 16)}`,
    "",
    "This is an offline, deterministic sensitivity replay. Provider PnL is displayed as provider-reported only; it is not chain-reconstructed profit.",
    "",
    "| Alias | Chain | Provider PnL status | Sample trades | Conservative net | Mechanical upper bound net | Fill rate | Confidence | Classification |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |",
    ...rows.map((row) => `| ${row.wallet_id} | ${row.chain} | ${row.provider_pnl_status} | ${row.sample_trade_count ?? ""} | ${row.simulated_copyable_net_return_usd ?? "null"} | ${row.mechanical_upper_bound_net_return_usd ?? "null"} | ${row.fill_rate ?? "null"} | ${row.result_confidence} | ${row.classifications} |`),
    "",
    "Time fields are kept separate in replay_trade_events.csv: source_trade_at, observed_at, simulated_order_at, simulated_fill_at.",
    "",
    "BSC token-tax sensitivity runs 0%, 2%, 5%, and 10%; missing BSC trade samples remain sample-insufficient/provider-only.",
    "",
  ];
  return lines.join("\n");
}

async function main(): Promise<void> {
  const inputPath = argument("--input", "");
  const outputDir = argument("--output-dir", "");
  if (!inputPath || !outputDir) throw new Error("usage: run-wallet-replay-v0-1.ts --input <json> --output-dir <dir>");
  const input = JSON.parse(await readFile(inputPath, "utf8")) as { schema_version: string; wallets: WalletReplayInput[] };
  if (input.schema_version !== "wallet-replay-input-v0.1") throw new Error("unsupported replay input schema");
  const wallets = [...input.wallets].sort((a, b) => a.walletId.localeCompare(b.walletId));
  const inputHash = replayInputHash(wallets);
  const results = wallets.map((wallet) => replayWallet(wallet));
  await mkdir(outputDir, { recursive: true });
  const scenarios = scenarioRows(results);
  const events = eventRows(results);
  const walletSummary = walletRows(results);
  const ranking = rankingRows(results);
  const failures = results.map((wallet) => ({ wallet_id: wallet.walletId, scenarios: wallet.scenarios.map((scenario) => ({ scenario_id: scenarioIdentity(scenario.config), failures: scenario.failures })) }));
  const assumptions = {
    schema_version: "wallet-replay-assumptions-v0.1",
    rule_version: RULE_VERSION,
    input_sha256: inputHash,
    starting_cash_multiple_of_ticket: 10,
    source_price_unit: "input_price_usd",
    unknown_liquidity: "conservative_no_fill or proxy_full sensitivity; proxy_full is an upper-bound mechanical sensitivity, not a chain fact",
    unknown_token_risk: "exclude or allow_with_warning sensitivity; allow_with_warning is not a safety conclusion",
    max_price_jump_rate: 0.2,
    max_liquidity_participation_rate: 0.1,
    dex_fee_rate: 0.003,
    solana: { sol_usd_rate: 170, network_fee_usd: 0.001, priority_fee_usd: 0.02 },
    bsc: { gas_fee_usd: 0.25, token_tax_rates: [0, 0.02, 0.05, 0.1] },
    no_lookahead: "orders use only source trade time plus configured delays; a later source price is used only as execution outcome after the simulated fill time",
  };
  await writeFile(path.join(outputDir, "replay_trade_events.csv"), csv(events, ["wallet_id", "scenario_id", "trade_id", "token_id", "side", "source_trade_at", "observed_at", "simulated_order_at", "simulated_fill_at", "fill_status", "failure_reason", "source_price_usd", "market_price_usd", "fill_price_usd", "requested_notional_usd", "filled_notional_usd", "filled_token_amount", "slippage_usd", "dex_fee_usd", "chain_fee_usd", "tax_usd", "net_cash_flow_usd", "price_observation", "observation_delay_seconds", "execution_delay_seconds", "slippage_rate", "ticket_notional_usd", "tax_rate", "liquidity_policy", "unknown_risk_policy"]), "utf8");
  await writeFile(path.join(outputDir, "replay_scenarios.csv"), csv(scenarios, Object.keys(scenarios[0] ?? { wallet_id: "" })), "utf8");
  await writeFile(path.join(outputDir, "wallet_vs_copyable_pnl.csv"), csv(walletSummary, Object.keys(walletSummary[0] ?? { wallet_id: "" })), "utf8");
  await writeFile(path.join(outputDir, "wallet_followability_ranking.csv"), csv(ranking, Object.keys(ranking[0] ?? { ranking: "" })), "utf8");
  await writeFile(path.join(outputDir, "replay_failures.json"), JSON.stringify({ schema_version: "wallet-replay-failures-v0.1", rule_version: RULE_VERSION, input_sha256: inputHash, wallets: failures }, null, 2) + "\n", "utf8");
  await writeFile(path.join(outputDir, "replay_assumptions.json"), JSON.stringify(assumptions, null, 2) + "\n", "utf8");
  await writeFile(path.join(outputDir, "replay_summary.md"), summary(results, inputHash), "utf8");
  await writeFile(path.join(outputDir, "gmgn_note_update_suggestions.json"), JSON.stringify(noteSuggestions(results), null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ status: "GREEN", rule_version: RULE_VERSION, input_sha256: inputHash, wallet_count: wallets.length, scenario_count: scenarios.length, trade_event_count: events.length, output_dir: path.resolve(outputDir) }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
