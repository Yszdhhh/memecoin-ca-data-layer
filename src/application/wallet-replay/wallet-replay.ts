import { createHash } from "node:crypto";

export const WALLET_REPLAY_RULE_VERSION = "wallet-replay-v0.1";
export const OBSERVATION_DELAYS_SECONDS = [5, 15, 30, 60, 180] as const;
export const EXECUTION_DELAYS_SECONDS = [0, 5, 15] as const;
export const SLIPPAGE_RATES = [0.005, 0.01, 0.02, 0.05] as const;
export const TICKET_NOTIONALS_USD = [100, 500, 1_000] as const;

export type ReplayChain = "solana" | "bsc";
export type ReplaySide = "buy" | "sell";
export type TokenRisk = "known" | "unknown";
export type LiquidityPolicy = "conservative_no_fill" | "proxy_full";
export type UnknownRiskPolicy = "exclude" | "allow_with_warning";
export type FillStatus = "fully_filled" | "partially_filled" | "no_fill";

export interface ReplayTrade {
  tradeId: string;
  walletId: string;
  chain: ReplayChain;
  tokenId: string;
  side: ReplaySide;
  sourceTradeAt: string;
  tokenAmount: number;
  priceUsd: number;
  quoteAsset: string;
  dex: string;
  tokenRisk: TokenRisk;
  liquidityUsd?: number | null;
  sourceFeeUsd?: number | null;
}

export interface WalletReplayInput {
  walletId: string;
  chain: ReplayChain;
  providerPnlUsd: number | null;
  providerPnlStatus: "reported" | "unavailable" | "provider_only";
  trades: ReplayTrade[];
}

export interface ReplayScenarioConfig {
  observationDelaySeconds: number;
  executionDelaySeconds: number;
  slippageRate: number;
  ticketNotionalUsd: number;
  taxRate: number;
  liquidityPolicy: LiquidityPolicy;
  unknownRiskPolicy: UnknownRiskPolicy;
  maxPriceJumpRate: number;
  maxLiquidityParticipationRate: number;
  dexFeeRate: number;
  solUsdRate: number;
  solNetworkFeeUsd: number;
  solPriorityFeeUsd: number;
  bscGasFeeUsd: number;
  fillLatencySeconds: number;
}

export interface ReplayEventResult {
  walletId: string;
  tradeId: string;
  tokenId: string;
  side: ReplaySide;
  sourceTradeAt: string;
  observedAt: string;
  simulatedOrderAt: string;
  simulatedFillAt: string;
  fillStatus: FillStatus;
  failureReason: string | null;
  sourcePriceUsd: number;
  marketPriceUsd: number | null;
  fillPriceUsd: number | null;
  requestedNotionalUsd: number | null;
  filledNotionalUsd: number | null;
  filledTokenAmount: number | null;
  slippageUsd: number | null;
  dexFeeUsd: number;
  chainFeeUsd: number;
  taxUsd: number;
  netCashFlowUsd: number;
  priceObservation: "at_fill" | "source_fallback" | "unavailable";
}

export interface SourceSampleMetrics {
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  realizedPnlUsd: number | null;
  realizedTradeCount: number;
  unmatchedSellCount: number;
  medianHoldingSeconds: number | null;
  tradeFrequencyPerDay: number | null;
  topTokenConcentration: number | null;
  sourcePriceAssumption: "input_price_usd";
}

export interface ReplayScenarioResult {
  walletId: string;
  chain: ReplayChain;
  config: ReplayScenarioConfig;
  startingCashUsd: number;
  endingCashUsd: number;
  endingEquityUsd: number | null;
  copyableGrossReturnUsd: number | null;
  copyableNetReturnUsd: number | null;
  fillRate: number | null;
  noFillRate: number | null;
  partialFillRate: number | null;
  averageSlippageRate: number | null;
  feesUsd: number;
  taxUsd: number;
  maxDrawdownUsd: number | null;
  maxDrawdownRate: number | null;
  medianHoldingSeconds: number | null;
  tradeFrequencyPerDay: number | null;
  topTokenConcentration: number | null;
  copyabilityScore: number | null;
  resultConfidence: "high" | "medium" | "low";
  failures: Record<string, number>;
  events: ReplayEventResult[];
}

export interface WalletReplayResult {
  walletId: string;
  chain: ReplayChain;
  providerPnlUsd: number | null;
  providerPnlStatus: WalletReplayInput["providerPnlStatus"];
  sample: SourceSampleMetrics;
  scenarios: ReplayScenarioResult[];
}

interface NormalizedTrade extends ReplayTrade {
  timeMs: number;
}

interface Position {
  tokenAmount: number;
  averageCostUsd: number;
}

interface Lot {
  tokenAmount: number;
  costUsd: number;
  timeMs: number;
}

function finitePositive(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0;
}

function finiteNonNegative(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value >= 0;
}

function round(value: number, digits = 8): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function isoAt(ms: number): string {
  return new Date(ms).toISOString();
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeTrades(input: WalletReplayInput): NormalizedTrade[] {
  return input.trades
    .map((trade) => {
      const timeMs = Date.parse(trade.sourceTradeAt);
      if (!Number.isFinite(timeMs)) throw new Error(`invalid sourceTradeAt:${trade.tradeId}`);
      if (trade.walletId !== input.walletId || trade.chain !== input.chain) {
        throw new Error(`trade ownership mismatch:${trade.tradeId}`);
      }
      if (!finitePositive(trade.tokenAmount) || !finitePositive(trade.priceUsd)) {
        throw new Error(`invalid trade amount or price:${trade.tradeId}`);
      }
      if (trade.side !== "buy" && trade.side !== "sell") {
        throw new Error(`invalid trade side:${trade.tradeId}`);
      }
      return { ...trade, timeMs };
    })
    .sort((a, b) => a.timeMs - b.timeMs || a.tradeId.localeCompare(b.tradeId));
}

function sourceSampleMetrics(trades: NormalizedTrade[]): SourceSampleMetrics {
  if (trades.length === 0) {
    return {
      tradeCount: 0,
      buyCount: 0,
      sellCount: 0,
      realizedPnlUsd: null,
      realizedTradeCount: 0,
      unmatchedSellCount: 0,
      medianHoldingSeconds: null,
      tradeFrequencyPerDay: null,
      topTokenConcentration: null,
      sourcePriceAssumption: "input_price_usd",
    };
  }

  const lots = new Map<string, Lot[]>();
  const notionalByToken = new Map<string, number>();
  const holdingSeconds: number[] = [];
  let realizedPnlUsd = 0;
  let realizedTradeCount = 0;
  let unmatchedSellCount = 0;

  for (const trade of trades) {
    const notional = trade.tokenAmount * trade.priceUsd;
    notionalByToken.set(trade.tokenId, (notionalByToken.get(trade.tokenId) ?? 0) + notional);
    const queue = lots.get(trade.tokenId) ?? [];
    if (trade.side === "buy") {
      queue.push({ tokenAmount: trade.tokenAmount, costUsd: notional, timeMs: trade.timeMs });
      lots.set(trade.tokenId, queue);
      continue;
    }

    let remaining = trade.tokenAmount;
    while (remaining > 0 && queue.length > 0) {
      const lot = queue[0]!;
      const matched = Math.min(remaining, lot.tokenAmount);
      const cost = lot.costUsd * (matched / lot.tokenAmount);
      realizedPnlUsd += matched * trade.priceUsd - cost;
      holdingSeconds.push((trade.timeMs - lot.timeMs) / 1_000);
      realizedTradeCount += 1;
      remaining -= matched;
      lot.tokenAmount -= matched;
      lot.costUsd -= cost;
      if (lot.tokenAmount <= 1e-12) queue.shift();
    }
    if (remaining > 1e-12) unmatchedSellCount += 1;
  }

  const totalNotional = [...notionalByToken.values()].reduce((sum, value) => sum + value, 0);
  const topNotional = Math.max(...notionalByToken.values());
  const spanDays = (trades.at(-1)!.timeMs - trades[0]!.timeMs) / 86_400_000;
  return {
    tradeCount: trades.length,
    buyCount: trades.filter((trade) => trade.side === "buy").length,
    sellCount: trades.filter((trade) => trade.side === "sell").length,
    realizedPnlUsd: round(realizedPnlUsd),
    realizedTradeCount,
    unmatchedSellCount,
    medianHoldingSeconds: median(holdingSeconds),
    tradeFrequencyPerDay: round(trades.length / Math.max(1, spanDays)),
    topTokenConcentration: totalNotional === 0 ? null : round(topNotional / totalNotional),
    sourcePriceAssumption: "input_price_usd",
  };
}

function priceAtOrAfter(trades: NormalizedTrade[], tokenId: string, timeMs: number): NormalizedTrade | undefined {
  return trades.find((trade) => trade.tokenId === tokenId && trade.timeMs >= timeMs);
}

function chainFeeUsd(chain: ReplayChain, config: ReplayScenarioConfig): number {
  return chain === "solana"
    ? (config.solNetworkFeeUsd + config.solPriorityFeeUsd)
    : config.bscGasFeeUsd;
}

function configKey(config: ReplayScenarioConfig): string {
  return [
    config.observationDelaySeconds,
    config.executionDelaySeconds,
    config.slippageRate,
    config.ticketNotionalUsd,
    config.taxRate,
    config.liquidityPolicy,
    config.unknownRiskPolicy,
  ].join("|");
}

function scenarioConfidence(input: WalletReplayInput, trades: NormalizedTrade[], config: ReplayScenarioConfig): "high" | "medium" | "low" {
  if (input.providerPnlStatus === "provider_only" || trades.length === 0) return "low";
  if (trades.some((trade) => trade.liquidityUsd === null || trade.liquidityUsd === undefined)) return "low";
  if (trades.some((trade) => trade.tokenRisk === "unknown") && config.unknownRiskPolicy === "allow_with_warning") return "low";
  return "medium";
}

function fillRatioFor(
  trade: NormalizedTrade,
  requestedNotionalUsd: number,
  config: ReplayScenarioConfig,
): { ratio: number; failureReason: string | null } {
  if (trade.tokenRisk === "unknown" && config.unknownRiskPolicy === "exclude") {
    return { ratio: 0, failureReason: "token_risk_unknown_conservative" };
  }
  if (trade.liquidityUsd === null || trade.liquidityUsd === undefined) {
    return config.liquidityPolicy === "conservative_no_fill"
      ? { ratio: 0, failureReason: "liquidity_unknown_conservative" }
      : { ratio: 1, failureReason: "liquidity_unknown_proxy" };
  }
  const capacity = trade.liquidityUsd * config.maxLiquidityParticipationRate;
  if (!finiteNonNegative(capacity) || capacity <= 0) return { ratio: 0, failureReason: "liquidity_insufficient" };
  const ratio = clamp(capacity / requestedNotionalUsd, 0, 1);
  return ratio <= 0
    ? { ratio: 0, failureReason: "liquidity_insufficient" }
    : { ratio, failureReason: ratio < 1 ? "liquidity_partial" : null };
}

function scoreScenario(result: Pick<ReplayScenarioResult, "startingCashUsd" | "copyableNetReturnUsd" | "fillRate" | "maxDrawdownRate">): number | null {
  if (result.copyableNetReturnUsd === null || result.fillRate === null) return null;
  const returnRate = result.copyableNetReturnUsd / result.startingCashUsd;
  const positive = clamp(returnRate, 0, 1);
  const negative = clamp(-returnRate, 0, 1);
  const drawdown = result.maxDrawdownRate === null ? 0.5 : clamp(result.maxDrawdownRate, 0, 1);
  return round(clamp((0.5 * result.fillRate + 0.35 * positive + 0.15 * (1 - drawdown) - 0.25 * negative) * 100, 0, 100), 4);
}

export function buildReplayScenarioGrid(chain: ReplayChain): ReplayScenarioConfig[] {
  const taxRates = chain === "bsc" ? [0, 0.02, 0.05, 0.1] : [0];
  const configs: ReplayScenarioConfig[] = [];
  for (const observationDelaySeconds of OBSERVATION_DELAYS_SECONDS) {
    for (const executionDelaySeconds of EXECUTION_DELAYS_SECONDS) {
      for (const slippageRate of SLIPPAGE_RATES) {
        for (const ticketNotionalUsd of TICKET_NOTIONALS_USD) {
          for (const taxRate of taxRates) {
            for (const liquidityPolicy of ["conservative_no_fill", "proxy_full"] as const) {
              for (const unknownRiskPolicy of ["exclude", "allow_with_warning"] as const) {
                configs.push({
                  observationDelaySeconds,
                  executionDelaySeconds,
                  slippageRate,
                  ticketNotionalUsd,
                  taxRate,
                  liquidityPolicy,
                  unknownRiskPolicy,
                  maxPriceJumpRate: 0.2,
                  maxLiquidityParticipationRate: 0.1,
                  dexFeeRate: 0.003,
                  solUsdRate: 170,
                  solNetworkFeeUsd: 0.001,
                  solPriorityFeeUsd: 0.02,
                  bscGasFeeUsd: 0.25,
                  fillLatencySeconds: 0,
                });
              }
            }
          }
        }
      }
    }
  }
  return configs.sort((a, b) => configKey(a).localeCompare(configKey(b)));
}

export function runWalletReplayScenario(input: WalletReplayInput, rawConfig: ReplayScenarioConfig): ReplayScenarioResult {
  const trades = normalizeTrades(input);
  const config = { ...rawConfig };
  if (!Number.isInteger(config.observationDelaySeconds) || config.observationDelaySeconds < 0) throw new Error("observation delay must be non-negative integer");
  if (!Number.isInteger(config.executionDelaySeconds) || config.executionDelaySeconds < 0) throw new Error("execution delay must be non-negative integer");
  if (!finiteNonNegative(config.slippageRate) || !finiteNonNegative(config.taxRate)) throw new Error("slippage and tax must be non-negative");
  if (!finitePositive(config.ticketNotionalUsd)) throw new Error("ticket notional must be positive");

  const startingCashUsd = config.ticketNotionalUsd * 10;
  let cashUsd = startingCashUsd;
  const positions = new Map<string, Position>();
  const latestPrices = new Map<string, number>();
  const events: ReplayEventResult[] = [];
  const failureCounts: Record<string, number> = {};
  const equityCurve: number[] = [startingCashUsd];
  let totalFees = 0;
  let totalTax = 0;
  let weightedSlippage = 0;
  let weightedSlippageBase = 0;

  const recordFailure = (reason: string): void => {
    failureCounts[reason] = (failureCounts[reason] ?? 0) + 1;
  };

  const markEquity = (): number | null => {
    let equity = cashUsd;
    for (const [tokenId, position] of positions) {
      const price = latestPrices.get(tokenId);
      if (!finitePositive(price)) return null;
      equity += position.tokenAmount * price;
    }
    return equity;
  };

  for (const trade of trades) {
    latestPrices.set(trade.tokenId, trade.priceUsd);
    const observedMs = trade.timeMs + config.observationDelaySeconds * 1_000;
    const orderMs = observedMs + config.executionDelaySeconds * 1_000;
    const fillMs = orderMs + config.fillLatencySeconds * 1_000;
    const marketTrade = priceAtOrAfter(trades, trade.tokenId, fillMs);
    const marketPriceUsd = marketTrade?.priceUsd ?? trade.priceUsd;
    const priceObservation = marketTrade ? "at_fill" : "source_fallback";
    const priceMove = trade.priceUsd === 0 ? 0 : Math.abs(marketPriceUsd / trade.priceUsd - 1);
    const requestedNotionalUsd = trade.side === "buy"
      ? Math.min(config.ticketNotionalUsd, cashUsd)
      : (positions.get(trade.tokenId)?.tokenAmount ?? 0) * marketPriceUsd;
    let fillStatus: FillStatus = "no_fill";
    let failureReason: string | null = null;
    let fillPriceUsd: number | null = null;
    let filledNotionalUsd: number | null = null;
    let filledTokenAmount: number | null = null;
    let slippageUsd: number | null = null;
    let dexFeeUsd = 0;
    let chainFeeUsd = 0;
    let taxUsd = 0;
    let netCashFlowUsd = 0;

    if (!finitePositive(requestedNotionalUsd)) {
      failureReason = trade.side === "buy" ? "insufficient_cash" : "no_position";
    } else if (priceMove > config.maxPriceJumpRate) {
      failureReason = "price_jump_too_large";
    } else {
      const liquidity = fillRatioFor(trade, requestedNotionalUsd, config);
      if (liquidity.failureReason === "token_risk_unknown_conservative" || liquidity.failureReason === "liquidity_unknown_conservative" || liquidity.failureReason === "liquidity_insufficient") {
        failureReason = liquidity.failureReason;
      } else {
        const ratio = liquidity.ratio;
        fillPriceUsd = marketPriceUsd * (trade.side === "buy" ? 1 + config.slippageRate : 1 - config.slippageRate);
        slippageUsd = Math.abs(fillPriceUsd - marketPriceUsd);
        const requestedQuantity = trade.side === "buy"
          ? requestedNotionalUsd / fillPriceUsd
          : (positions.get(trade.tokenId)?.tokenAmount ?? 0);
        filledTokenAmount = requestedQuantity * ratio;
        filledNotionalUsd = filledTokenAmount * fillPriceUsd;
        dexFeeUsd = filledNotionalUsd * config.dexFeeRate;
        chainFeeUsd = chainFeeUsdFor(input.chain, config);
        taxUsd = trade.side === "sell" ? filledNotionalUsd * config.taxRate : 0;
        const totalCosts = dexFeeUsd + chainFeeUsd + taxUsd;

        if (trade.side === "buy") {
          const totalDebit = filledNotionalUsd + totalCosts;
          if (totalDebit > cashUsd + 1e-9) {
            const affordableRatio = cashUsd / Math.max(1e-9, filledNotionalUsd + totalCosts);
            filledTokenAmount *= affordableRatio;
            filledNotionalUsd = filledTokenAmount * fillPriceUsd;
            dexFeeUsd = filledNotionalUsd * config.dexFeeRate;
            chainFeeUsd = chainFeeUsdFor(input.chain, config);
            taxUsd = 0;
            failureReason = "insufficient_cash_partial";
          }
          const position = positions.get(trade.tokenId) ?? { tokenAmount: 0, averageCostUsd: 0 };
          const newAmount = position.tokenAmount + filledTokenAmount;
          position.averageCostUsd = newAmount === 0
            ? 0
            : (position.tokenAmount * position.averageCostUsd + filledNotionalUsd + dexFeeUsd + chainFeeUsd) / newAmount;
          position.tokenAmount = newAmount;
          positions.set(trade.tokenId, position);
          cashUsd -= filledNotionalUsd + dexFeeUsd + chainFeeUsd;
          netCashFlowUsd = -(filledNotionalUsd + dexFeeUsd + chainFeeUsd);
        } else {
          const position = positions.get(trade.tokenId)!;
          const costBasis = position.averageCostUsd * filledTokenAmount;
          position.tokenAmount -= filledTokenAmount;
          if (position.tokenAmount <= 1e-9) positions.delete(trade.tokenId);
          cashUsd += filledNotionalUsd - totalCosts;
          netCashFlowUsd = filledNotionalUsd - totalCosts;
        }
        if (liquidity.failureReason) failureReason = liquidity.failureReason;
        const partialFill = ratio < 0.999999 || liquidity.failureReason === "liquidity_partial" || failureReason === "insufficient_cash_partial";
        fillStatus = partialFill ? "partially_filled" : "fully_filled";
        if (failureReason) recordFailure(failureReason);
        if (config.unknownRiskPolicy === "allow_with_warning" && trade.tokenRisk === "unknown") recordFailure("unknown_token_risk_allowed");
        weightedSlippage += slippageUsd * filledNotionalUsd;
        weightedSlippageBase += filledNotionalUsd;
        totalFees += dexFeeUsd + chainFeeUsd;
        totalTax += taxUsd;
      }
    }
    if (fillStatus === "no_fill" && failureReason) recordFailure(failureReason);
    events.push({
      walletId: input.walletId,
      tradeId: trade.tradeId,
      tokenId: trade.tokenId,
      side: trade.side,
      sourceTradeAt: isoAt(trade.timeMs),
      observedAt: isoAt(observedMs),
      simulatedOrderAt: isoAt(orderMs),
      simulatedFillAt: isoAt(fillMs),
      fillStatus,
      failureReason,
      sourcePriceUsd: trade.priceUsd,
      marketPriceUsd,
      fillPriceUsd,
      requestedNotionalUsd: finitePositive(requestedNotionalUsd) ? requestedNotionalUsd : null,
      filledNotionalUsd,
      filledTokenAmount,
      slippageUsd,
      dexFeeUsd,
      chainFeeUsd,
      taxUsd,
      netCashFlowUsd,
      priceObservation,
    });
    const equity = markEquity();
    if (equity !== null) equityCurve.push(equity);
  }

  const endingEquityUsd = trades.length === 0 ? null : markEquity();
  const copyableGrossReturnUsd = endingEquityUsd === null ? null : endingEquityUsd - startingCashUsd + (totalFees + totalTax);
  const copyableNetReturnUsd = endingEquityUsd === null ? null : endingEquityUsd - startingCashUsd;
  const fills = events.filter((event) => event.fillStatus === "fully_filled").length;
  const partials = events.filter((event) => event.fillStatus === "partially_filled").length;
  const noFills = events.filter((event) => event.fillStatus === "no_fill").length;
  const peak = equityCurve.length ? Math.max(...equityCurve) : null;
  const troughDrawdown = peak === null ? null : Math.max(...equityCurve.map((equity) => peak - equity));
  const maxDrawdownUsd = troughDrawdown;
  const maxDrawdownRate = troughDrawdown === null ? null : troughDrawdown / startingCashUsd;
  const baseResult = {
    startingCashUsd,
    copyableNetReturnUsd: copyableNetReturnUsd === null ? null : round(copyableNetReturnUsd),
    fillRate: events.length === 0 ? null : fills / events.length,
    maxDrawdownRate: maxDrawdownRate === null ? null : round(maxDrawdownRate),
  };
  const sample = sourceSampleMetrics(trades);
  return {
    walletId: input.walletId,
    chain: input.chain,
    config,
    startingCashUsd,
    endingCashUsd: round(cashUsd),
    endingEquityUsd: endingEquityUsd === null ? null : round(endingEquityUsd),
    copyableGrossReturnUsd: copyableGrossReturnUsd === null ? null : round(copyableGrossReturnUsd),
    copyableNetReturnUsd: copyableNetReturnUsd === null ? null : round(copyableNetReturnUsd),
    fillRate: events.length === 0 ? null : round(fills / events.length),
    noFillRate: events.length === 0 ? null : round(noFills / events.length),
    partialFillRate: events.length === 0 ? null : round(partials / events.length),
    averageSlippageRate: weightedSlippageBase === 0 ? null : round(weightedSlippage / weightedSlippageBase),
    feesUsd: round(totalFees),
    taxUsd: round(totalTax),
    maxDrawdownUsd: maxDrawdownUsd === null ? null : round(maxDrawdownUsd),
    maxDrawdownRate: maxDrawdownRate === null ? null : round(maxDrawdownRate),
    medianHoldingSeconds: sample.medianHoldingSeconds,
    tradeFrequencyPerDay: sample.tradeFrequencyPerDay,
    topTokenConcentration: sample.topTokenConcentration,
    copyabilityScore: scoreScenario(baseResult),
    resultConfidence: scenarioConfidence(input, trades, config),
    failures: Object.fromEntries(Object.entries(failureCounts).sort(([a], [b]) => a.localeCompare(b))),
    events,
  };
}

function chainFeeUsdFor(chain: ReplayChain, config: ReplayScenarioConfig): number {
  return chainFeeUsd(chain, config);
}

export function replayWallet(input: WalletReplayInput, scenarios = buildReplayScenarioGrid(input.chain)): WalletReplayResult {
  const trades = normalizeTrades(input);
  const sample = sourceSampleMetrics(trades);
  return {
    walletId: input.walletId,
    chain: input.chain,
    providerPnlUsd: input.providerPnlUsd,
    providerPnlStatus: input.providerPnlStatus,
    sample,
    scenarios: scenarios.map((scenario) => runWalletReplayScenario(input, scenario)),
  };
}

export function replayInputHash(inputs: readonly WalletReplayInput[]): string {
  return createHash("sha256")
    .update(JSON.stringify(inputs, (_key, value) => typeof value === "number" ? round(value, 12) : value))
    .digest("hex");
}

export function scenarioIdentity(config: ReplayScenarioConfig): string {
  return configKey(config);
}
