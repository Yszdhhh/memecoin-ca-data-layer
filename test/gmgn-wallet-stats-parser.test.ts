import assert from "node:assert/strict";
import test from "node:test";
import {
  GMGN_WALLET_STATS_PARSER_VERSION,
  parseGmgnWalletStats,
} from "../src/infrastructure/gmgn/wallet-stats-parser.js";

const walletA = "5K3N1vqmdgPNfk79SXJdmdhbR2q5KvcunZiWd6D7iTUT";
const walletB = "EzbeF2bADKo6GutJyWmgodyGJFeBPhcrXSdZUXPX5WGc";

test("maps direct wallet-identity records from a sanitized nested envelope", () => {
  const parsed = parseGmgnWalletStats({
    data: {
      rows: [
        { wallet_address: walletA, pnl: "12.5", win_rate: "75", trade_count: "8" },
        { address: walletB, total_profit: -3, winrate: 50, total_trades: 4 },
      ],
    },
  }, [walletA, walletB]);

  assert.deepEqual(parsed, [
    {
      wallet: walletA,
      parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
      status: "MAPPED",
      mapping: "direct_identity",
      aggregates: { periodPnl: 12.5, winRate: 75, tradeCount: 8 },
      warningCodes: [],
    },
    {
      wallet: walletB,
      parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
      status: "MAPPED",
      mapping: "direct_identity",
      aggregates: { periodPnl: -3, winRate: 50, tradeCount: 4 },
      warningCodes: [],
    },
  ]);
});

test("maps a wallet-keyed record without exposing unallowlisted content", () => {
  const parsed = parseGmgnWalletStats({
    result: {
      [walletA]: { realized_pnl: 4.2, winning_rate: 33.3, tx_count: 9, ignored_text: "never emitted" },
    },
  }, [walletA]);

  assert.deepEqual(parsed[0], {
    wallet: walletA,
    parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
    status: "MAPPED",
    mapping: "wallet_keyed",
    aggregates: { periodPnl: 4.2, winRate: 33.3, tradeCount: 9 },
    warningCodes: [],
  });
});

test("does not fabricate metrics from malformed or unrelated values", () => {
  const parsed = parseGmgnWalletStats({
    data: [
      { wallet: walletA, pnl: "not-a-number", win_rate: 101, trade_count: 1.5 },
      { address: "not-an-input-wallet", total_profit: 999 },
    ],
  }, [walletA, walletB]);

  assert.deepEqual(parsed, [
    {
      wallet: walletA,
      parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
      status: "PARTIAL",
      mapping: "direct_identity",
      aggregates: {},
      warningCodes: ["gmgn_expected_metrics_unavailable"],
    },
    {
      wallet: walletB,
      parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
      status: "UNAVAILABLE",
      mapping: null,
      aggregates: {},
      warningCodes: ["gmgn_wallet_metric_unavailable"],
    },
  ]);
});
