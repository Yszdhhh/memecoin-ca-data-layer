import assert from "node:assert/strict";
import test from "node:test";
import {
  GMGN_WALLET_STATS_PARSER_VERSION,
  parseGmgnWalletStats,
} from "../src/infrastructure/gmgn/wallet-stats-parser.js";

const walletA = "5K3N1vqmdgPNfk79SXJdmdhbR2q5KvcunZiWd6D7iTUT";
const walletB = "EzbeF2bADKo6GutJyWmgodyGJFeBPhcrXSdZUXPX5WGc";

test("1 & 4. maps direct wallet-identity record with exact matching", () => {
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

test("5. rejects wrong wallet identity", () => {
  const payload = {
    wallet: walletB,
    pnl: 100,
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d");
  assert.equal(parsed[0]!.status, "UNAVAILABLE");
  assert.equal(parsed[0]!.completeness, 0);
  assert.ok(parsed[0]!.warningCodes.includes("gmgn_wallet_stats_schema_unrecognized") || parsed[0]!.warningCodes.includes("gmgn_wallet_stats_identity_mismatch"));
});

test("6 & 7. expectedPeriod controls period-specific field reading and ignores other period fields", () => {
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

test("8. explicit period conflict returns UNAVAILABLE with gmgn_wallet_stats_period_mismatch", () => {
  const payload = {
    wallet: walletA,
    period: "7d",
    pnl: 50,
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "30d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_period_mismatch"));
});

test("9 & 10. ignores deep decoy aggregates and summary/market/token node PnL", () => {
  const payload = {
    wallet: walletA,
    trade_count: 5,
    summary: {
      pnl: 9999, // Decoy summary node PnL
    },
    market: {
      realized_profit: 8888, // Decoy market node
    },
    token: {
      profit: 7777, // Decoy token node
    },
    decoy: {
      nested: {
        pnl: 6666,
      },
    },
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_expected_metrics_unavailable"));
  assert.equal(parsed.aggregates.periodPnl, undefined);
  assert.equal(parsed.aggregates.realizedProfit, undefined);
});

test("11 & 12. no cross-node field splicing or depth scoring", () => {
  const payload = {
    data: [
      { wallet: walletA, pnl: 50 },
      { wallet: walletA, buy_count: 10 },
    ],
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.aggregates.periodPnl, 50);
  assert.equal(parsed.aggregates.buyCount, undefined); // Does not splice buy_count from second node
});

test("13. alone tradeCount does not yield mapped profit record", () => {
  const payload = {
    wallet: walletA,
    trade_count: 25,
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_expected_metrics_unavailable"));
});

test("14. alone lastActiveTimestamp does not yield mapped profit record", () => {
  const payload = {
    wallet: walletA,
    last_active_timestamp: 1715000000,
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_expected_metrics_unavailable"));
});

test("15 & 16 & 17. missing fields remain undefined, explicit 0 preserved, clean numeric string parsed", () => {
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

test("18. rejects NaN, Infinity, objects, and arrays in numeric fields", () => {
  const payload = {
    wallet: walletA,
    pnl: NaN,
    realized_profit: Infinity,
    trade_count: {},
    win_rate: [],
    buy_count: "invalid-string",
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.equal(parsed.aggregates.periodPnl, undefined);
  assert.equal(parsed.aggregates.realizedProfit, undefined);
  assert.equal(parsed.aggregates.tradeCount, undefined);
  assert.equal(parsed.aggregates.winRate, undefined);
});

test("19 & 20. completeness calculated by field coverage ratio, PARTIAL status for incomplete fields", () => {
  const payload = {
    wallet: walletA,
    pnl: 100,
    trade_count: 5,
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "PARTIAL");
  assert.equal(parsed.completeness, 0.18); // 2 valid fields / 11 = 0.18
  assert.ok(parsed.completeness < 1.0);
  assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_partial_fields"));
});

test("21. completeness=1.0 ONLY when all 11 schema metrics are present and valid", () => {
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

test("22 & 23. winRate unit validation and ambiguous unit warning", () => {
  const validPayload = {
    wallet: walletA,
    pnl: 10,
    win_rate: 45.5,
  };
  const parsedValid = parseGmgnWalletStats(validPayload, [walletA], "7d")[0]!;
  assert.equal(parsedValid.aggregates.winRate, 45.5);

  const invalidPayload = {
    wallet: walletA,
    pnl: 10,
    win_rate: 150, // Invalid percentage > 100
  };
  const parsedInvalid = parseGmgnWalletStats(invalidPayload, [walletA], "7d")[0]!;
  assert.equal(parsedInvalid.aggregates.winRate, undefined);
  assert.ok(parsedInvalid.warningCodes.includes("gmgn_wallet_stats_win_rate_unit_ambiguous"));
});

test("24. buy_30d field correctly mapped when expectedPeriod is 30d", () => {
  const payload = {
    wallet: walletA,
    pnl_30d: 500,
    buy_30d: 12,
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "30d")[0]!;
  assert.equal(parsed.aggregates.periodPnl, 500);
  assert.equal(parsed.aggregates.buyCount, 12);
});

test("25. parser does not leak unknown keys or raw values into aggregates", () => {
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
