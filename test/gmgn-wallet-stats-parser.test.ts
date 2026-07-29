import assert from "node:assert/strict";
import test from "node:test";
import {
  GMGN_WALLET_STATS_PARSER_VERSION,
  parseGmgnWalletStats,
} from "../src/infrastructure/gmgn/wallet-stats-parser.js";

const walletA = "5K3N1vqmdgPNfk79SXJdmdhbR2q5KvcunZiWd6D7iTUT";

test("1. maps direct wallet-identity record with exact matching and 11/11 explicit provider fields", () => {
  const payload = {
    wallet: walletA,
    period: "7d",
    pnl: 100.5,
    realized_profit: 80.0,
    realized_profit_pnl: 0.25,
    win_rate_percent: 60,
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
        win_rate_percent: 50,
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

  // root win_rate_percent={}, pnl_stat realized_profit=10 -> intent in root & pnl_stat -> UNAVAILABLE
  const rootObjPnlStatValid = {
    wallet: walletA,
    win_rate_percent: {},
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

test("7. Requirement E & Repair-003 C: strict per-field numeric type validation & retaining invalid_field_type diagnostic", () => {
  // Numeric string "123.45" on pnl -> status UNAVAILABLE, contains BOTH invalid_field_type AND expected_metrics_unavailable
  const numericStringPayload = {
    wallet: walletA,
    pnl: "123.45",
  };
  const res1 = parseGmgnWalletStats(numericStringPayload, [walletA], "7d")[0]!;
  assert.equal(res1.status, "UNAVAILABLE");
  assert.equal(res1.aggregates.periodPnl, undefined);
  assert.ok(res1.warningCodes.includes("gmgn_wallet_stats_invalid_field_type"), "must contain invalid_field_type");
  assert.ok(res1.warningCodes.includes("gmgn_expected_metrics_unavailable"), "must contain expected_metrics_unavailable");

  // Object on realized_profit -> status UNAVAILABLE, contains BOTH invalid_field_type AND expected_metrics_unavailable
  const objectProfitPayload = {
    wallet: walletA,
    realized_profit: {},
  };
  const res2 = parseGmgnWalletStats(objectProfitPayload, [walletA], "7d")[0]!;
  assert.equal(res2.status, "UNAVAILABLE");
  assert.equal(res2.aggregates.realizedProfit, undefined);
  assert.ok(res2.warningCodes.includes("gmgn_wallet_stats_invalid_field_type"));
  assert.ok(res2.warningCodes.includes("gmgn_expected_metrics_unavailable"));

  // Array on bought_cost with valid pnl -> status PARTIAL, contains invalid_field_type
  const arrayCostPayload = {
    wallet: walletA,
    period: "7d",
    pnl: 100,
    bought_cost: [],
  };
  const res3 = parseGmgnWalletStats(arrayCostPayload, [walletA], "7d")[0]!;
  assert.equal(res3.status, "PARTIAL");
  assert.equal(res3.aggregates.periodPnl, 100);
  assert.equal(res3.aggregates.boughtCost, undefined);
  assert.ok(res3.warningCodes.includes("gmgn_wallet_stats_invalid_field_type"));

  // Multiple core metrics all invalid
  const multipleInvalidPayload = {
    wallet: walletA,
    pnl: "100",
    realized_profit: {},
    realized_profit_pnl: [],
  };
  const res4 = parseGmgnWalletStats(multipleInvalidPayload, [walletA], "7d")[0]!;
  assert.equal(res4.status, "UNAVAILABLE");
  assert.ok(res4.warningCodes.includes("gmgn_wallet_stats_invalid_field_type"));
  assert.ok(res4.warningCodes.includes("gmgn_expected_metrics_unavailable"));

  // Valid core metric mixed with invalid alias of same field (pnl_7d: 100, pnl: "bad") -> fail closed with alias conflict
  const validAndInvalidAliasPayload = {
    wallet: walletA,
    pnl_7d: 100,
    pnl: "bad",
  };
  const res5 = parseGmgnWalletStats(validAndInvalidAliasPayload, [walletA], "7d")[0]!;
  assert.equal(res5.status, "UNAVAILABLE");
  assert.ok(res5.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));
});

test("8. Requirement F & Repair-003 A & B: winRate unit contracts and boundary counterexamples", () => {
  // 1. win_rate_percent alias: 0, 0.4, 1, 45.5, 100 are ALL deterministically accepted as percent
  for (const [val, expected] of [[0, 0], [0.4, 0.4], [1, 1], [45.5, 45.5], [100, 100]]) {
    const res = parseGmgnWalletStats({ wallet: walletA, pnl: 10, win_rate_percent: val }, [walletA], "7d")[0]!;
    assert.equal(res.aggregates.winRate, expected, `win_rate_percent ${val} should equal ${expected}`);
    assert.ok(!res.warningCodes.includes("gmgn_wallet_stats_win_rate_unit_ambiguous"));
  }

  // win_rate_percent out-of-range: -0.01, 100.01 emit win_rate_unit_ambiguous and omit winRate
  for (const invalidVal of [-0.01, 100.01]) {
    const res = parseGmgnWalletStats({ wallet: walletA, pnl: 10, win_rate_percent: invalidVal }, [walletA], "7d")[0]!;
    assert.equal(res.aggregates.winRate, undefined);
    assert.ok(res.warningCodes.includes("gmgn_wallet_stats_win_rate_unit_ambiguous"));
  }

  // win_rate_percent invalid types: numeric string, NaN, Infinity, object, array -> invalid_field_type
  for (const badTypeVal of ["45.5", NaN, Infinity, {}, []]) {
    const res = parseGmgnWalletStats({ wallet: walletA, pnl: 10, win_rate_percent: badTypeVal }, [walletA], "7d")[0]!;
    assert.equal(res.aggregates.winRate, undefined);
    assert.ok(res.warningCodes.includes("gmgn_wallet_stats_invalid_field_type"));
  }

  // 2. win_rate_ratio & winrate_ratio aliases: 0, 0.4, 1 converted to %, 0 -> 0, 0.4 -> 40, 1 -> 100
  for (const aliasKey of ["win_rate_ratio", "winrate_ratio"]) {
    const res0 = parseGmgnWalletStats({ wallet: walletA, pnl: 10, [aliasKey]: 0 }, [walletA], "7d")[0]!;
    assert.equal(res0.aggregates.winRate, 0);

    const res04 = parseGmgnWalletStats({ wallet: walletA, pnl: 10, [aliasKey]: 0.4 }, [walletA], "7d")[0]!;
    assert.equal(res04.aggregates.winRate, 40);

    const res1 = parseGmgnWalletStats({ wallet: walletA, pnl: 10, [aliasKey]: 1 }, [walletA], "7d")[0]!;
    assert.equal(res1.aggregates.winRate, 100);

    // out of range for ratio
    for (const badRatio of [-0.01, 1.01]) {
      const resBad = parseGmgnWalletStats({ wallet: walletA, pnl: 10, [aliasKey]: badRatio }, [walletA], "7d")[0]!;
      assert.equal(resBad.aggregates.winRate, undefined);
      assert.ok(resBad.warningCodes.includes("gmgn_wallet_stats_win_rate_unit_ambiguous"));
    }

    // invalid types for ratio
    for (const badTypeVal of ["0.4", NaN, Infinity]) {
      const resBadType = parseGmgnWalletStats({ wallet: walletA, pnl: 10, [aliasKey]: badTypeVal }, [walletA], "7d")[0]!;
      assert.equal(resBadType.aggregates.winRate, undefined);
      assert.ok(resBadType.warningCodes.includes("gmgn_wallet_stats_invalid_field_type"));
    }
  }

  // 3. Both percent and ratio aliases present -> alias conflict fail-closed
  const bothSameConverted = parseGmgnWalletStats({ wallet: walletA, pnl: 10, win_rate_percent: 40, win_rate_ratio: 0.4 }, [walletA], "7d")[0]!;
  assert.equal(bothSameConverted.status, "UNAVAILABLE");
  assert.ok(bothSameConverted.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));

  const bothDiffConverted = parseGmgnWalletStats({ wallet: walletA, pnl: 10, win_rate_percent: 50, win_rate_ratio: 0.4 }, [walletA], "7d")[0]!;
  assert.equal(bothDiffConverted.status, "UNAVAILABLE");
  assert.ok(bothDiffConverted.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));

  // 4. Generic aliases without schema evidence (win_rate, winrate, winning_rate, win_rate_7d, win_rate_30d):
  // 0, 0.4, 1 use completely identical rules (unit-unverified, omit winRate, emit win_rate_unit_ambiguous)
  for (const genericAlias of ["win_rate", "winrate", "winning_rate", "win_rate_7d"]) {
    for (const val of [0, 0.4, 1]) {
      const res = parseGmgnWalletStats({ wallet: walletA, pnl: 100, [genericAlias]: val }, [walletA], "7d")[0]!;
      assert.equal(res.aggregates.winRate, undefined, `Generic alias ${genericAlias} with val ${val} must not output winRate`);
      assert.equal(res.aggregates.periodPnl, 100, "Must not affect parsing of other valid metrics");
      assert.ok(res.warningCodes.includes("gmgn_wallet_stats_win_rate_unit_ambiguous"), "Must emit win_rate_unit_ambiguous");
    }
  }
});
