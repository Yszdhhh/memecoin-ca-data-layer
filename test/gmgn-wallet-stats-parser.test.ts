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

test("3. Requirement A: safe runtime envelope type validation for primitive, array, and malformed types", () => {
  // data as string, number, array
  assert.doesNotThrow(() => parseGmgnWalletStats({ data: "string_payload" }, [walletA], "7d"));
  assert.doesNotThrow(() => parseGmgnWalletStats({ data: 12345 }, [walletA], "7d"));
  assert.doesNotThrow(() => parseGmgnWalletStats({ data: [1, "foo", null] }, [walletA], "7d"));

  // result as string
  assert.doesNotThrow(() => parseGmgnWalletStats({ result: "invalid_result" }, [walletA], "7d"));

  // stats as array, pnl_stat as primitive
  const malformedPayload = {
    wallet: walletA,
    stats: [10, 20, 30],
    pnl_stat: true,
  };
  const parsed = parseGmgnWalletStats(malformedPayload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_schema_unrecognized") || parsed.warningCodes.includes("gmgn_expected_metrics_unavailable"));
});

test("4. Requirement B: collects and validates ALL explicit period declarations across locations", () => {
  // root=7d, data=30d conflict
  const rootDataConflict = {
    period: "7d",
    data: {
      wallet: walletA,
      period: "30d",
      pnl: 100,
    },
  };
  const res1 = parseGmgnWalletStats(rootDataConflict, [walletA], "7d")[0]!;
  assert.equal(res1.status, "UNAVAILABLE");
  assert.ok(res1.warningCodes.includes("gmgn_wallet_stats_period_mismatch"));

  // root=7d, stats=30d conflict
  const rootStatsConflict = {
    wallet: walletA,
    period: "7d",
    stats: {
      period: "30d",
      pnl: 100,
    },
  };
  const res2 = parseGmgnWalletStats(rootStatsConflict, [walletA], "7d")[0]!;
  assert.equal(res2.status, "UNAVAILABLE");
  assert.ok(res2.warningCodes.includes("gmgn_wallet_stats_period_mismatch"));

  // record=30d, expected=7d
  const recordExpectedMismatch = {
    wallet: walletA,
    period: "30d",
    pnl: 100,
  };
  const res3 = parseGmgnWalletStats(recordExpectedMismatch, [walletA], "7d")[0]!;
  assert.equal(res3.status, "UNAVAILABLE");
  assert.ok(res3.warningCodes.includes("gmgn_wallet_stats_period_mismatch"));

  // period = 90d, all, 1d, unknown, empty string
  for (const invalidPeriod of ["90d", "all", "1d", "unknown", ""]) {
    const payload = { wallet: walletA, period: invalidPeriod, pnl: 100 };
    const res = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
    assert.equal(res.status, "UNAVAILABLE");
    assert.ok(res.warningCodes.includes("gmgn_wallet_stats_period_mismatch"));
  }

  // Multiple locations all 7d -> verified
  const all7d = {
    period: "7d",
    data: {
      wallet: walletA,
      period: "7d",
      pnl: 100,
    },
  };
  const resVerified = parseGmgnWalletStats(all7d, [walletA], "7d")[0]!;
  assert.ok(!resVerified.warningCodes.includes("gmgn_wallet_stats_period_unverified"));
  assert.ok(!resVerified.warningCodes.includes("gmgn_wallet_stats_period_mismatch"));

  // Period completely missing -> period_unverified
  const noPeriod = {
    wallet: walletA,
    pnl: 100,
  };
  const resUnverified = parseGmgnWalletStats(noPeriod, [walletA], "7d")[0]!;
  assert.ok(resUnverified.warningCodes.includes("gmgn_wallet_stats_period_unverified"));
});

test("5. Requirement C: alias conflict fail-closed behavior", () => {
  // pnl_7d vs pnl conflict with different values
  const pnlConflict = {
    wallet: walletA,
    pnl_7d: 100,
    pnl: 200,
  };
  const res1 = parseGmgnWalletStats(pnlConflict, [walletA], "7d")[0]!;
  assert.equal(res1.status, "UNAVAILABLE");
  assert.ok(res1.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));

  // realized_profit_30d vs realized_profit conflict
  const profitConflict = {
    wallet: walletA,
    period: "30d",
    realized_profit_30d: 10,
    realized_profit: 20,
  };
  const res2 = parseGmgnWalletStats(profitConflict, [walletA], "30d")[0]!;
  assert.equal(res2.status, "UNAVAILABLE");
  assert.ok(res2.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));

  // win_rate_7d vs win_rate conflict
  const winRateConflict = {
    wallet: walletA,
    pnl: 50,
    win_rate_7d: 50,
    win_rate: 60,
  };
  const res3 = parseGmgnWalletStats(winRateConflict, [walletA], "7d")[0]!;
  assert.equal(res3.status, "UNAVAILABLE");
  assert.ok(res3.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));

  // trade_count vs tx_count conflict
  const tradeCountConflict = {
    wallet: walletA,
    pnl: 50,
    trade_count: 10,
    tx_count: 20,
  };
  const res4 = parseGmgnWalletStats(tradeCountConflict, [walletA], "7d")[0]!;
  assert.equal(res4.status, "UNAVAILABLE");
  assert.ok(res4.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));

  // Identical alias values are deterministically accepted
  const identicalAlias = {
    wallet: walletA,
    pnl_7d: 100,
    pnl: 100,
  };
  const resIdentical = parseGmgnWalletStats(identicalAlias, [walletA], "7d")[0]!;
  assert.equal(resIdentical.aggregates.periodPnl, 100);
  assert.ok(!resIdentical.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));

  // Determinism: JSON property order does not alter identical alias acceptance
  const swappedOrder = {
    wallet: walletA,
    pnl: 100,
    pnl_7d: 100,
  };
  const resSwapped = parseGmgnWalletStats(swappedOrder, [walletA], "7d")[0]!;
  assert.equal(resSwapped.aggregates.periodPnl, 100);
  assert.deepEqual(resIdentical.aggregates, resSwapped.aggregates);
});

test("6. Requirement D: invalid candidate container ambiguity handling", () => {
  // root pnl="bad", stats pnl=10 -> intent in root & stats -> UNAVAILABLE
  const rootInvalidStatsValid = {
    wallet: walletA,
    pnl: "bad",
    stats: {
      pnl: 10,
    },
  };
  const res1 = parseGmgnWalletStats(rootInvalidStatsValid, [walletA], "7d")[0]!;
  assert.equal(res1.status, "UNAVAILABLE");
  assert.ok(res1.warningCodes.includes("gmgn_wallet_stats_schema_unrecognized"));

  // root win_rate={}, pnl_stat realized_profit=10 -> intent in root & pnl_stat -> UNAVAILABLE
  const rootObjPnlStatValid = {
    wallet: walletA,
    win_rate: {},
    pnl_stat: {
      realized_profit: 10,
    },
  };
  const res2 = parseGmgnWalletStats(rootObjPnlStatValid, [walletA], "7d")[0]!;
  assert.equal(res2.status, "UNAVAILABLE");
  assert.ok(res2.warningCodes.includes("gmgn_wallet_stats_schema_unrecognized"));

  // root has NO metric keys, only stats has valid metrics -> select stats cleanly
  const rootNoMetricsStatsValid = {
    wallet: walletA,
    period: "7d",
    stats: {
      pnl: 50,
      realized_profit: 40,
    },
  };
  const res3 = parseGmgnWalletStats(rootNoMetricsStatsValid, [walletA], "7d")[0]!;
  assert.equal(res3.aggregates.periodPnl, 50);
  assert.equal(res3.aggregates.realizedProfit, 40);
  assert.ok(!res3.warningCodes.includes("gmgn_wallet_stats_schema_unrecognized"));
});

test("7. Requirement E: strict per-field numeric type validation (reject numeric strings)", () => {
  // Numeric strings "100" are rejected with invalid_field_type
  const numericStringPayload = {
    wallet: walletA,
    pnl: "100",
  };
  const res1 = parseGmgnWalletStats(numericStringPayload, [walletA], "7d")[0]!;
  assert.equal(res1.status, "UNAVAILABLE");
  assert.equal(res1.aggregates.periodPnl, undefined);

  // NaN, Infinity, objects, arrays, empty strings, text with units
  const invalidTypes = {
    wallet: walletA,
    pnl: NaN,
    realized_profit: Infinity,
    trade_count: {},
    win_rate: [],
    buy_count: "",
    sell_count: "10.5 SOL",
  };
  const res2 = parseGmgnWalletStats(invalidTypes, [walletA], "7d")[0]!;
  assert.equal(res2.status, "UNAVAILABLE");
  assert.equal(res2.aggregates.periodPnl, undefined);
  assert.equal(res2.aggregates.realizedProfit, undefined);
  assert.equal(res2.aggregates.tradeCount, undefined);
});

test("8. Requirement F: winRate unit contracts for percent vs ratio aliases", () => {
  // Percent alias 45.5 is valid
  const percentValid = parseGmgnWalletStats({ wallet: walletA, pnl: 10, win_rate: 45.5 }, [walletA], "7d")[0]!;
  assert.equal(percentValid.aggregates.winRate, 45.5);

  // Ambiguous 0 < v < 1 (e.g. 0.4) on percent alias emits win_rate_unit_ambiguous and omits winRate
  const ambiguousVal = parseGmgnWalletStats({ wallet: walletA, pnl: 10, win_rate: 0.4 }, [walletA], "7d")[0]!;
  assert.equal(ambiguousVal.aggregates.winRate, undefined);
  assert.ok(ambiguousVal.warningCodes.includes("gmgn_wallet_stats_win_rate_unit_ambiguous"));

  // Ratio alias win_rate_ratio: 0.45 converts to 45%
  const ratioValid = parseGmgnWalletStats({ wallet: walletA, pnl: 10, win_rate_ratio: 0.45 }, [walletA], "7d")[0]!;
  assert.equal(ratioValid.aggregates.winRate, 45);

  // Presenting both percent and ratio aliases in same container causes alias conflict fail-closed
  const bothAliases = parseGmgnWalletStats({ wallet: walletA, pnl: 10, win_rate: 45, win_rate_ratio: 0.45 }, [walletA], "7d")[0]!;
  assert.equal(bothAliases.status, "UNAVAILABLE");
  assert.ok(bothAliases.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));
});
