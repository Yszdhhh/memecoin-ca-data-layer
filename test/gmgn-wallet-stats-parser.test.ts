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

  // root pnl=10, stats pnl=10, pnl_stat winrate=0.5 -> 3-way intent -> UNAVAILABLE
  const rootStatsPnlStatThreeWay = {
    wallet: walletA,
    pnl: 10,
    stats: {
      pnl: 10,
    },
    pnl_stat: {
      winrate: 0.5,
    },
  };
  const res2 = parseGmgnWalletStats(rootStatsPnlStatThreeWay, [walletA], "7d")[0]!;
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

test("7. Requirement E & numeric-string repair: canonical numeric strings with strict rejection", () => {
  // Independently audited live evidence shows allowlisted monetary/profit metrics may be canonical numeric strings.
  const numericStringPayload = {
    wallet: walletA,
    pnl: "123.45",
  };
  const res1 = parseGmgnWalletStats(numericStringPayload, [walletA], "7d")[0]!;
  assert.equal(res1.status, "PARTIAL");
  assert.equal(res1.aggregates.periodPnl, 123.45);
  assert.ok(!res1.warningCodes.includes("gmgn_wallet_stats_invalid_field_type"));

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
    pnl: "100 usd",
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

  // Canonical numeric strings are accepted for explicit aliases; non-finite/object/array remain invalid.
  const stringPercent = parseGmgnWalletStats({ wallet: walletA, pnl: 10, win_rate_percent: "45.5" }, [walletA], "7d")[0]!;
  assert.equal(stringPercent.aggregates.winRate, 45.5);
  for (const badTypeVal of [NaN, Infinity, {}, []]) {
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

    const stringRatio = parseGmgnWalletStats({ wallet: walletA, pnl: 10, [aliasKey]: "0.4" }, [walletA], "7d")[0]!;
    assert.equal(stringRatio.aggregates.winRate, 40);

    // invalid types for ratio
    for (const badTypeVal of [NaN, Infinity]) {
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

test("9. Official root + pnl_stat composite fixture is successfully parsed to MAPPED (11/11)", () => {
  const payload = {
    wallet: walletA,
    period: "7d",
    pnl: 120.5,
    realized_profit: 100.0,
    realized_profit_pnl: 0.5,
    trade_count: 15,
    buy_count: 10,
    sell_count: 5,
    bought_cost: 500.0,
    sold_income: 600.0,
    last_active_timestamp: 1715000000,
    pnl_stat: {
      token_num: 8,
      winrate: 0.6,
    },
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.wallet, walletA);
  assert.equal(parsed.status, "MAPPED");
  assert.equal(parsed.mapping, "direct_identity");
  assert.equal(parsed.completeness, 1.0);
  assert.equal(parsed.warningCodes.length, 0);
  assert.equal(parsed.aggregates.periodPnl, 120.5);
  assert.equal(parsed.aggregates.realizedProfit, 100.0);
  assert.equal(parsed.aggregates.tokenNum, 8);
  assert.equal(parsed.aggregates.winRate, 60);
});

test("10. root realized_profit + pnl_stat winrate/token_num valid composite combination", () => {
  const payload = {
    wallet: walletA,
    period: "30d",
    realized_profit_30d: 300.0,
    pnl_stat: {
      token_num: 12,
      winrate: 0.75,
    },
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "30d")[0]!;
  assert.equal(parsed.status, "PARTIAL");
  assert.equal(parsed.aggregates.realizedProfit, 300.0);
  assert.equal(parsed.aggregates.tokenNum, 12);
  assert.equal(parsed.aggregates.winRate, 75);
  assert.ok(parsed.completeness > 0 && parsed.completeness < 1.0);
});

test("11. pnl_stat.winrate = 0.4 maps to 40 percent", () => {
  const payload = {
    wallet: walletA,
    pnl: 50.0,
    pnl_stat: {
      winrate: 0.4,
    },
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.aggregates.winRate, 40);
  assert.ok(!parsed.warningCodes.includes("gmgn_wallet_stats_win_rate_unit_ambiguous"));
});

test("12. root and pnl_stat mislocated metric fail-closed", () => {
  const payload = {
    wallet: walletA,
    period: "7d",
    realized_profit: 100.0,
    pnl_stat: {
      realized_profit: 200.0,
    },
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_schema_unrecognized"));
});

test("12b. pnl_stat.realized_profit alone fails-closed", () => {
  const payload = {
    wallet: walletA,
    period: "7d",
    pnl_stat: {
      realized_profit: 100.0,
    },
  };
  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_schema_unrecognized"));
});

test("12c. pnl_stat.buy_count alone fails-closed", () => {
  const payload = {
    wallet: walletA,
    period: "7d",
    pnl_stat: {
      buy_count: 5,
    },
  };
  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_schema_unrecognized"));
});

test("12d. root.token_num in composite mode fails-closed", () => {
  const payload = {
    wallet: walletA,
    period: "7d",
    pnl: 100.0,
    token_num: 5,
    pnl_stat: {
      winrate: 0.6,
    },
  };
  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_schema_unrecognized"));
});

test("12e. mislocated field with same value in root and pnl_stat fails-closed", () => {
  const payload = {
    wallet: walletA,
    period: "7d",
    realized_profit: 100.0,
    pnl_stat: {
      realized_profit: 100.0,
      winrate: 0.6,
    },
  };
  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_schema_unrecognized"));
});

test("13. primitive or array pnl_stat safely returns UNAVAILABLE without throwing exception", () => {
  assert.doesNotThrow(() => {
    const parsedStr = parseGmgnWalletStats({ wallet: walletA, pnl_stat: "invalid_string" }, [walletA], "7d")[0]!;
    assert.equal(parsedStr.status, "UNAVAILABLE");

    const parsedNum = parseGmgnWalletStats({ wallet: walletA, pnl_stat: 12345 }, [walletA], "7d")[0]!;
    assert.equal(parsedNum.status, "UNAVAILABLE");

    const parsedArr = parseGmgnWalletStats({ wallet: walletA, pnl_stat: [1, 2, 3] }, [walletA], "7d")[0]!;
    assert.equal(parsedArr.status, "UNAVAILABLE");

    const parsedBool = parseGmgnWalletStats({ wallet: walletA, pnl_stat: true }, [walletA], "7d")[0]!;
    assert.equal(parsedBool.status, "UNAVAILABLE");
  });
});

test("14. root + stats + pnl_stat multi-container ambiguity fails-closed with gmgn_wallet_stats_schema_unrecognized", () => {
  const payload = {
    wallet: walletA,
    pnl: 100,
    stats: {
      pnl: 100,
    },
    pnl_stat: {
      winrate: 0.5,
    },
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_schema_unrecognized"));
});

test("15. decoy, summary, market, token sub-nodes cannot contribute metrics", () => {
  const payload = {
    wallet: walletA,
    period: "7d",
    summary: { pnl: 500, realized_profit: 400 },
    market: { win_rate_percent: 80 },
    token: { trade_count: 50 },
    decoy: { token_num: 10 },
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.equal(parsed.aggregates.periodPnl, undefined);
  assert.equal(parsed.aggregates.realizedProfit, undefined);
  assert.equal(parsed.aggregates.winRate, undefined);
  assert.ok(parsed.warningCodes.includes("gmgn_expected_metrics_unavailable"));
});

test("16. explicit 0 is preserved as 0, missing fields remain undefined", () => {
  const payload = {
    wallet: walletA,
    period: "7d",
    pnl: 0,
    realized_profit: 0,
    buy_count: 0,
    sell_count: 0,
    pnl_stat: {
      winrate: 0,
      token_num: 0,
    },
  };

  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "PARTIAL");
  assert.equal(parsed.aggregates.periodPnl, 0);
  assert.equal(parsed.aggregates.realizedProfit, 0);
  assert.equal(parsed.aggregates.buyCount, 0);
  assert.equal(parsed.aggregates.sellCount, 0);
  assert.equal(parsed.aggregates.winRate, 0);
  assert.equal(parsed.aggregates.tokenNum, 0);
  assert.equal(parsed.aggregates.boughtCost, undefined);
  assert.equal(parsed.aggregates.soldIncome, undefined);
  assert.equal(parsed.aggregates.tradeCount, undefined);
});


test("17. canonical numeric strings preserve live composite fields and metric-specific rules", () => {
  const payload = {
    wallet: walletA,
    period: "7d",
    realized_profit: "-12.5",
    realized_profit_pnl: "-0.125",
    buy: 3,
    sell: 2,
    bought_cost: "100",
    total_cost: "100",
    sold_income: "87.5",
    last_timestamp: 1710000000,
    pnl_stat: { token_num: 4, winrate: 0.4 },
  };
  const parsed = parseGmgnWalletStats(payload, [walletA], "7d")[0]!;
  assert.equal(parsed.status, "PARTIAL");
  assert.equal(parsed.aggregates.realizedProfit, -12.5);
  assert.equal(parsed.aggregates.realizedProfitPnl, -0.125);
  assert.equal(parsed.aggregates.boughtCost, 100);
  assert.equal(parsed.aggregates.soldIncome, 87.5);
  assert.equal(parsed.aggregates.buyCount, 3);
  assert.equal(parsed.aggregates.sellCount, 2);
  assert.equal(parsed.aggregates.lastActiveTimestamp, 1710000000);
  assert.equal(parsed.aggregates.tokenNum, 4);
  assert.equal(parsed.aggregates.winRate, 40);
  assert.ok(!parsed.warningCodes.includes("gmgn_wallet_stats_invalid_field_type"));
});

test("18. non-canonical numeric strings and non-finite conversions remain fail-closed", () => {
  for (const bad of [" 1", "1 ", "+1", "01", ".5", "1.", "1,000", "1 USD", "0x10", "", "NaN", "Infinity", "1e309"]) {
    const parsed = parseGmgnWalletStats({ wallet: walletA, pnl: bad }, [walletA], "7d")[0]!;
    assert.equal(parsed.status, "UNAVAILABLE", bad);
    assert.equal(parsed.aggregates.periodPnl, undefined, bad);
    assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_invalid_field_type"), bad);
  }
});

test("19. canonical numeric strings reapply integer, sign, and alias-conflict constraints", () => {
  const integer = parseGmgnWalletStats({ wallet: walletA, pnl: "1", buy_count: "2" }, [walletA], "7d")[0]!;
  assert.equal(integer.aggregates.buyCount, 2);

  for (const badCount of ["2.5", "9007199254740992", "-1"]) {
    const parsed = parseGmgnWalletStats({ wallet: walletA, pnl: "1", buy_count: badCount }, [walletA], "7d")[0]!;
    assert.equal(parsed.aggregates.buyCount, undefined, badCount);
    assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_invalid_field_type"), badCount);
  }

  const negativeCost = parseGmgnWalletStats({ wallet: walletA, pnl: "1", bought_cost: "-1" }, [walletA], "7d")[0]!;
  assert.equal(negativeCost.aggregates.boughtCost, undefined);
  assert.ok(negativeCost.warningCodes.includes("gmgn_wallet_stats_invalid_field_type"));

  const same = parseGmgnWalletStats({ wallet: walletA, pnl_7d: 1, pnl: "1.0" }, [walletA], "7d")[0]!;
  assert.equal(same.aggregates.periodPnl, 1);
  assert.ok(!same.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));

  const conflict = parseGmgnWalletStats({ wallet: walletA, pnl_7d: 1, pnl: "2" }, [walletA], "7d")[0]!;
  assert.equal(conflict.status, "UNAVAILABLE");
  assert.ok(conflict.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));
});

test("20. null remains missing and never becomes zero", () => {
  const parsed = parseGmgnWalletStats({ wallet: walletA, pnl: "1", realized_profit: null, bought_cost: null }, [walletA], "7d")[0]!;
  assert.equal(parsed.aggregates.periodPnl, 1);
  assert.equal(parsed.aggregates.realizedProfit, undefined);
  assert.equal(parsed.aggregates.boughtCost, undefined);
});


test("21. bought_cost primary family takes precedence over different total_cost fallback", () => {
  const parsed = parseGmgnWalletStats(
    { wallet: walletA, realized_profit: "5", bought_cost: "100", total_cost: "125" },
    [walletA],
    "30d",
  )[0]!;
  assert.equal(parsed.status, "PARTIAL");
  assert.equal(parsed.aggregates.boughtCost, 100);
  assert.ok(!parsed.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));
});

test("22. bought_cost conflicts still fail closed inside the selected primary family", () => {
  const parsed = parseGmgnWalletStats(
    { wallet: walletA, realized_profit: "5", bought_cost_30d: "100", bought_cost: "125", total_cost: "100" },
    [walletA],
    "30d",
  )[0]!;
  assert.equal(parsed.status, "UNAVAILABLE");
  assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));
});

test("23. total_cost family is used only when bought_cost family is absent", () => {
  const fallback = parseGmgnWalletStats(
    { wallet: walletA, realized_profit: "5", total_cost: "125" },
    [walletA],
    "30d",
  )[0]!;
  assert.equal(fallback.status, "PARTIAL");
  assert.equal(fallback.aggregates.boughtCost, 125);

  const conflict = parseGmgnWalletStats(
    { wallet: walletA, realized_profit: "5", total_cost: "125", buy_volume: "126" },
    [walletA],
    "30d",
  )[0]!;
  assert.equal(conflict.status, "UNAVAILABLE");
  assert.ok(conflict.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));
});

test("24. present null bought_cost suppresses fallback rather than inventing precedence", () => {
  const parsed = parseGmgnWalletStats(
    { wallet: walletA, realized_profit: "5", bought_cost: null, total_cost: "125" },
    [walletA],
    "30d",
  )[0]!;
  assert.equal(parsed.status, "PARTIAL");
  assert.equal(parsed.aggregates.boughtCost, undefined);
  assert.ok(!parsed.warningCodes.includes("gmgn_wallet_stats_alias_conflict"));
});

test("25. zero last timestamp is an unavailable sentinel without fabricated activity", () => {
  const parsed = parseGmgnWalletStats(
    { wallet: walletA, realized_profit: "5", last_timestamp: 0 },
    [walletA],
    "30d",
  )[0]!;
  assert.equal(parsed.status, "PARTIAL");
  assert.equal(parsed.aggregates.lastActiveTimestamp, undefined);
  assert.ok(!parsed.warningCodes.includes("gmgn_wallet_stats_invalid_field_type"));
});

test("26. positive timestamps remain valid while negative and malformed timestamps are rejected", () => {
  const positive = parseGmgnWalletStats(
    { wallet: walletA, realized_profit: "5", last_timestamp: 1710000000 },
    [walletA],
    "30d",
  )[0]!;
  assert.equal(positive.aggregates.lastActiveTimestamp, 1710000000);

  for (const badTimestamp of [-1, "bad"]) {
    const parsed = parseGmgnWalletStats(
      { wallet: walletA, realized_profit: "5", last_timestamp: badTimestamp },
      [walletA],
      "30d",
    )[0]!;
    assert.equal(parsed.aggregates.lastActiveTimestamp, undefined);
    assert.ok(parsed.warningCodes.includes("gmgn_wallet_stats_invalid_field_type"));
  }
});
