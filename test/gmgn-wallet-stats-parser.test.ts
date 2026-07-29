import assert from "node:assert/strict";
import test from "node:test";
import {
  GMGN_WALLET_STATS_PARSER_VERSION,
  parseGmgnWalletStats,
} from "../src/infrastructure/gmgn/wallet-stats-parser.js";

const walletA = "5K3N1vqmdgPNfk79SXJdmdhbR2q5KvcunZiWd6D7iTUT";
const walletB = "EzbeF2bADKo6GutJyWmgodyGJFeBPhcrXSdZUXPX5WGc";

test("1. maps direct wallet-identity record with exact matching and 11/11 explicit provider fields", () => {
  const payload = {
    wallet: walletA,
    period: "7d",
    pnl: 100.5,
    realized_profit: 80.0,
    realized_profit_pnl: 0.25,
    win_rate: 60,
    trade_count: 10,
    buy_count: 6,
    sell_count: 4,
    bought_cost: 200,
    sold_income: 280,
    last_active_timestamp: 1715000000,
    token_num: 3,
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d");
  assert.equal(parsed.length, 1);
  const result = parsed[0]!;
  assert.equal(result.wallet, walletA);
  assert.equal(result.parserVersion, GMGN_WALLET_STATS_PARSER_VERSION);
  assert.equal(result.status, "MAPPED");
  assert.equal(result.mapping, "direct_identity");
  assert.equal(result.completeness, 1.0);
  assert.equal(result.warningCodes.length, 0);
  assert.equal(result.aggregates.periodPnl, 100.5);
  assert.equal(result.aggregates.winRate, 60);
  assert.equal(result.aggregates.tradeCount, 10);
});

test("2. maps wallet-keyed dictionary envelope", () => {
  const payload = {
    result: {
      [walletA]: {
        pnl: 42.0,
        realized_profit: 40.0,
        realized_profit_pnl: 0.1,
        winrate: 50,
        trade_count: 5,
        buy: 3,
        sell: 2,
        bought_cost: 100,
        sold_income: 140,
        last_active: 1715000000,
        token_num: 2,
        period: "30d",
      },
    },
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "30d");
  const result = parsed[0]!;
  assert.equal(result.wallet, walletA);
  assert.equal(result.status, "MAPPED");
  assert.equal(result.mapping, "wallet_keyed");
  assert.equal(result.completeness, 1.0);
});

test("3. maps record-list envelope under rows/data/list", () => {
  const payload = {
    data: {
      rows: [
        {
          wallet_address: walletA,
          pnl_7d: 15.0,
          realized_profit_7d: 10.0,
          realized_profit_pnl_7d: 0.05,
          win_rate_7d: 80,
          trade_count_7d: 4,
          buy_7d: 2,
          sell_7d: 2,
          bought_cost_7d: 50,
          sold_income_7d: 65,
          last_active_time: 1715000000,
          token_num_7d: 1,
          period: "7d",
        },
      ],
    },
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d");
  const result = parsed[0]!;
  assert.equal(result.wallet, walletA);
  assert.equal(result.status, "MAPPED");
  assert.equal(result.mapping, "record_list");
  assert.equal(result.completeness, 1.0);
  assert.equal(result.aggregates.buyCount, 2);
});

test("4. rejects wrong wallet identity", () => {
  const payload = {
    wallet: walletB,
    pnl: 100,
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d");
  assert.equal(parsed[0]!.status, "UNAVAILABLE");
  assert.equal(parsed[0]!.completeness, 0);
  assert.ok(
    parsed[0]!.warningCodes.includes("gmgn_wallet_stats_schema_unrecognized") ||
      parsed[0]!.warningCodes.includes("gmgn_wallet_stats_identity_mismatch")
  );
});

test("5. expectedPeriod is mandatory and fails closed if runtime parameter is invalid", () => {
  const payload = { wallet: walletA, pnl: 50, period: "7d" };
  // @ts-expect-error Testing runtime check for missing/invalid expectedPeriod
  assert.throws(() => parseGmgnWalletStats(payload, [walletA]), /expectedPeriod must be explicitly '7d' or '30d'/);
  // @ts-expect-error Testing runtime check for invalid period string
  assert.throws(() => parseGmgnWalletStats(payload, [walletA], "90d"), /expectedPeriod must be explicitly '7d' or '30d'/);
});

test("6. expectedPeriod controls period-specific field reading and ignores other period fields", () => {
  const payload = {
    wallet: walletA,
    pnl_7d: 70,
    buy_7d: 7,
    pnl_30d: 300,
    buy_30d: 30,
    period: "30d",
  };

  const parsed30d = parseGmgnWalletStats(payload, [walletA], "30d")[0]!;
  assert.equal(parsed30d.aggregates.periodPnl, 300);
  assert.equal(parsed30d.aggregates.buyCount, 30);

  const parsed7d = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed7d.status, "UNAVAILABLE");
  assert.ok(parsed7d.warningCodes.includes("gmgn_wallet_stats_period_mismatch"));
});

test("7. explicit period conflict or unsupported period returns UNAVAILABLE with gmgn_wallet_stats_period_mismatch", () => {
  const payloadMismatch = {
    wallet: walletA,
    period: "7d",
    pnl: 50,
  };
  const parsedMismatch = parseGmgnWalletStats(payloadMismatch, [walletA], "30d")[0]!;
  assert.equal(parsedMismatch.status, "UNAVAILABLE");
  assert.ok(parsedMismatch.warningCodes.includes("gmgn_wallet_stats_period_mismatch"));

  const unsupportedPeriods = ["90d", "all", "1d", "unknown", ""];
  for (const periodVal of unsupportedPeriods) {
    const payloadUnsupported = { wallet: walletA, period: periodVal, pnl: 100 };
    const res = parseGmgnWalletStats(payloadUnsupported, [walletA], "7d")[0]!;
    assert.equal(res.status, "UNAVAILABLE");
    assert.ok(res.warningCodes.includes("gmgn_wallet_stats_period_mismatch"), `period=${periodVal} must emit gmgn_wallet_stats_period_mismatch`);
    assert.equal(res.aggregates.periodPnl, undefined, "unsupported period must not read通用 pnl fields");
  }
});

test("8. rejects cross-node aggregate composition (root vs stats)", () => {
  const payload = {
    wallet: walletA,
    pnl: 500, // at root
    stats: {
      win_rate: 60, // in stats sub-container
      buy_count: 10,
    },
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_schema_unrecognized"));
});

test("9. rejects cross-node aggregate composition (pnl_stat vs stats conflict)", () => {
  const payload = {
    wallet: walletA,
    pnl_stat: {
      realized_profit: 80,
    },
    stats: {
      win_rate: 60,
    },
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_schema_unrecognized"));
});

test("10. provider offering 10/11 fields without tradeCount key yields PARTIAL status (10/11 completeness) and NOT MAPPED", () => {
  const payload = {
    wallet: walletA,
    period: "7d",
    pnl: 100.5,
    realized_profit: 80.0,
    realized_profit_pnl: 0.25,
    win_rate: 60,
    // trade_count is intentionally missing!
    buy_count: 6,
    sell_count: 4,
    bought_cost: 200,
    sold_income: 280,
    last_active_timestamp: 1715000000,
    token_num: 3,
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "PARTIAL");
  assert.equal(parsed.completeness, 0.91); // 10/11 = 0.909... -> 0.91
  assert.notEqual(parsed.status, "MAPPED");
  assert.equal(parsed.aggregates.tradeCount, undefined);
});

test("11. ignores deep decoy aggregates and summary/market/token node PnL", () => {
  const payload = {
    wallet: walletA,
    trade_count: 5,
    summary: { pnl: 9999 },
    market: { realized_profit: 8888 },
    token: { profit: 7777 },
    decoy: { nested: { pnl: 6666 } },
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_expected_metrics_unavailable"));
  assert.equal(parsed.aggregates.periodPnl, undefined);
  assert.equal(parsed.aggregates.realizedProfit, undefined);
});

test("12. explicit 0 preserved, missing fields remain undefined, clean numeric string parsed", () => {
  const payload = {
    wallet: walletA,
    pnl: 0,
    realized_profit: "0",
    trade_count: "0",
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.aggregates.periodPnl, 0);
  assert.equal(parsed.aggregates.realizedProfit, 0);
  assert.equal(parsed.aggregates.tradeCount, 0);
  assert.equal(parsed.aggregates.buyCount, undefined);
});

test("13. rejects NaN, Infinity, '10.5 SOL', objects, and arrays in numeric fields", () => {
  const payload = {
    wallet: walletA,
    pnl: NaN,
    realized_profit: Infinity,
    trade_count: {},
    win_rate: [],
    buy_count: "10.5 SOL",
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.equal(parsed.aggregates.periodPnl, undefined);
  assert.equal(parsed.aggregates.realizedProfit, undefined);
  assert.equal(parsed.aggregates.tradeCount, undefined);
  assert.equal(parsed.aggregates.winRate, undefined);
});

test("14. winRate unit validation (percent, ratio, ambiguous 0.4, out of range)", () => {
  // Valid percent field 45.5
  const validPercent = parseGmgnWalletStats({ wallet: walletA, pnl: 10, win_rate: 45.5 }, [walletA], "7d")[0]!;
  assert.equal(validPercent.aggregates.winRate, 45.5);

  // Explicit ratio field 0.455
  const validRatio = parseGmgnWalletStats({ wallet: walletA, pnl: 10, win_rate_ratio: 0.455 }, [walletA], "7d")[0]!;
  assert.equal(validRatio.aggregates.winRate, 45.5);

  // Ambiguous win_rate=0.4 (could be 0.4% or ratio 0.40) -> fail-closed
  const ambiguous = parseGmgnWalletStats({ wallet: walletA, pnl: 10, win_rate: 0.4 }, [walletA], "7d")[0]!;
  assert.equal(ambiguous.aggregates.winRate, undefined);
  assert.ok(ambiguous.warningCodes.includes("gmgn_wallet_stats_win_rate_unit_ambiguous"));

  // Out of range > 100
  const outOfRange = parseGmgnWalletStats({ wallet: walletA, pnl: 10, win_rate: 150 }, [walletA], "7d")[0]!;
  assert.equal(outOfRange.aggregates.winRate, undefined);
  assert.ok(outOfRange.warningCodes.includes("gmgn_wallet_stats_win_rate_unit_ambiguous"));
});

test("15. completeness=1.0 ONLY when all 11 schema metrics are present and valid", () => {
  const payload = {
    wallet: walletA,
    pnl: 100,
    realized_profit: 80,
    realized_profit_pnl: 0.2,
    win_rate: 75,
    trade_count: 10,
    buy_count: 6,
    sell_count: 4,
    bought_cost: 500,
    sold_income: 600,
    last_active_timestamp: 1715000000,
    token_num: 5,
    period: "7d",
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "MAPPED");
  assert.equal(parsed.completeness, 1.0);
  assert.equal(parsed.warningCodes.length, 0);
});

test("16. parser does not leak unknown keys or raw values into aggregates", () => {
  const payload = {
    wallet: walletA,
    pnl: 100,
    secret_key: "sensitive_data",
    user_private_info: { id: 123 },
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal("secret_key" in parsed.aggregates, false);
  assert.equal("user_private_info" in parsed.aggregates, false);
  assert.equal(JSON.stringify(parsed).includes("sensitive_data"), false);
});
