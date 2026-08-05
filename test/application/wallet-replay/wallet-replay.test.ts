import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReplayScenarioGrid,
  replayInputHash,
  runWalletReplayScenario,
  type ReplayScenarioConfig,
  type WalletReplayInput,
} from "../../../src/application/wallet-replay/wallet-replay.js";

const baseConfig: ReplayScenarioConfig = {
  observationDelaySeconds: 0,
  executionDelaySeconds: 0,
  slippageRate: 0,
  ticketNotionalUsd: 100,
  taxRate: 0,
  liquidityPolicy: "proxy_full",
  unknownRiskPolicy: "allow_with_warning",
  maxPriceJumpRate: 0.2,
  maxLiquidityParticipationRate: 0.1,
  dexFeeRate: 0,
  solUsdRate: 170,
  solNetworkFeeUsd: 0,
  solPriorityFeeUsd: 0,
  bscGasFeeUsd: 0,
  fillLatencySeconds: 0,
};

function input(overrides: Partial<WalletReplayInput> = {}): WalletReplayInput {
  return {
    walletId: "SOL-TEST",
    chain: "solana",
    providerPnlUsd: null,
    providerPnlStatus: "unavailable",
    trades: [
      {
        tradeId: "buy-1",
        walletId: "SOL-TEST",
        chain: "solana",
        tokenId: "token-a",
        side: "buy",
        sourceTradeAt: "2026-01-01T00:00:00.000Z",
        tokenAmount: 100,
        priceUsd: 1,
        quoteAsset: "USDC",
        dex: "fixture-dex",
        tokenRisk: "known",
        liquidityUsd: 10_000,
      },
      {
        tradeId: "sell-1",
        walletId: "SOL-TEST",
        chain: "solana",
        tokenId: "token-a",
        side: "sell",
        sourceTradeAt: "2026-01-01T00:01:00.000Z",
        tokenAmount: 100,
        priceUsd: 1.2,
        quoteAsset: "USDC",
        dex: "fixture-dex",
        tokenRisk: "known",
        liquidityUsd: 10_000,
      },
    ],
    ...overrides,
  };
}

test("scenario grid includes all required delays, slippage, notionals, and BSC tax sensitivity", () => {
  const sol = buildReplayScenarioGrid("solana");
  const bsc = buildReplayScenarioGrid("bsc");
  assert.equal(new Set(sol.map((x) => x.observationDelaySeconds)).size, 5);
  assert.deepEqual([...new Set(sol.map((x) => x.executionDelaySeconds))].sort((a, b) => a - b), [0, 5, 15]);
  assert.deepEqual([...new Set(sol.map((x) => x.ticketNotionalUsd))].sort((a, b) => a - b), [100, 500, 1_000]);
  assert.deepEqual([...new Set(bsc.map((x) => x.taxRate))].sort((a, b) => a - b), [0, 0.02, 0.05, 0.1]);
});

test("time fields are separated and delays do not use future trades to schedule an order", () => {
  const result = runWalletReplayScenario(input(), { ...baseConfig, observationDelaySeconds: 15, executionDelaySeconds: 5 });
  const event = result.events[0]!;
  assert.equal(event.sourceTradeAt, "2026-01-01T00:00:00.000Z");
  assert.equal(event.observedAt, "2026-01-01T00:00:15.000Z");
  assert.equal(event.simulatedOrderAt, "2026-01-01T00:00:20.000Z");
  assert.equal(event.simulatedFillAt, "2026-01-01T00:00:20.000Z");
  assert.equal(event.fillStatus, "fully_filled");
});

test("known liquidity produces a full fill and deterministic positive net return", () => {
  const result = runWalletReplayScenario(input(), baseConfig);
  assert.equal(result.fillRate, 1);
  assert.equal(result.noFillRate, 0);
  assert.equal(result.partialFillRate, 0);
  assert.equal(result.copyableNetReturnUsd, 20);
  assert.equal(result.averageSlippageRate, 0);
  assert.equal(result.feesUsd, 0);
});

test("unknown liquidity is conservative no-fill and remains distinct from zero slippage", () => {
  const trades = input().trades.map((trade) => ({ ...trade, liquidityUsd: null }));
  const result = runWalletReplayScenario(input({ trades }), { ...baseConfig, liquidityPolicy: "conservative_no_fill" });
  assert.equal(result.fillRate, 0);
  assert.equal(result.noFillRate, 1);
  assert.equal(result.averageSlippageRate, null);
  assert.equal(result.feesUsd, 0);
  assert.ok((result.failures.liquidity_unknown_conservative ?? 0) > 0);
});

test("liquidity shortage creates a partial fill and a large jump creates a no-fill", () => {
  const partial = input({ trades: input().trades.map((trade) => ({ ...trade, liquidityUsd: 50 })) });
  const partialResult = runWalletReplayScenario(partial, baseConfig);
  assert.equal(partialResult.partialFillRate, 1);
  assert.equal(partialResult.fillRate, 0);

  const jump = input({ trades: [
    { ...input().trades[0]!, liquidityUsd: 10_000 },
    { ...input().trades[0]!, tradeId: "buy-2", sourceTradeAt: "2026-01-01T00:01:00.000Z", priceUsd: 2, liquidityUsd: 10_000 },
  ] });
  const jumpResult = runWalletReplayScenario(jump, { ...baseConfig, maxPriceJumpRate: 0.2, observationDelaySeconds: 60 });
  assert.ok((jumpResult.failures.price_jump_too_large ?? 0) > 0);
  assert.ok(jumpResult.noFillRate !== null && jumpResult.noFillRate > 0);
});

test("null provider PnL is preserved and unknown token risk is excluded by the conservative policy", () => {
  const unknownRisk = input({ trades: input().trades.map((trade) => ({ ...trade, tokenRisk: "unknown" })) });
  const result = runWalletReplayScenario(unknownRisk, { ...baseConfig, unknownRiskPolicy: "exclude" });
  assert.equal(unknownRisk.providerPnlUsd, null);
  assert.equal(result.fillRate, 0);
  assert.ok((result.failures.token_risk_unknown_conservative ?? 0) > 0);
});

test("empty trade samples preserve null replay returns instead of reporting a zero result", () => {
  const result = runWalletReplayScenario(input({ trades: [] }), baseConfig);
  assert.equal(result.copyableGrossReturnUsd, null);
  assert.equal(result.copyableNetReturnUsd, null);
  assert.equal(result.fillRate, null);
  assert.equal(result.noFillRate, null);
  assert.equal(result.copyabilityScore, null);
});

test("same input hash is deterministic regardless of input object reuse", () => {
  const value = input();
  assert.equal(replayInputHash([value]), replayInputHash([JSON.parse(JSON.stringify(value)) as WalletReplayInput]));
});
