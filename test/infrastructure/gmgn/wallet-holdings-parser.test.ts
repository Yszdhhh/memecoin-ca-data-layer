import assert from "node:assert/strict";
import test from "node:test";
import { parseGmgnWalletHoldingsPage } from "../../../src/infrastructure/gmgn/wallet-holdings-parser.js";

test("cumulative holdings parser aggregates only approved metrics from a terminal page", () => {
  const parsed = parseGmgnWalletHoldingsPage({
    data: {
      holdings: [
        {
          wallet_address: "synthetic-wallet-identity",
          token_address: "synthetic-token-identity",
          label: "synthetic-label",
          history_bought_cost: "40",
          history_sold_income: 55,
          realized_profit: "15",
          last_active_timestamp: 100,
        },
        {
          history_bought_cost: 10,
          history_sold_income: "20",
          realized_profit: 10,
          last_active_timestamp: 200,
        },
      ],
      token_num: "2",
    },
  });

  assert.equal(parsed.source, "gmgn");
  assert.equal(parsed.verificationStatus, "unverified");
  assert.equal(parsed.status, "MAPPED");
  assert.equal(parsed.completeness, 1);
  assert.deepEqual(parsed.aggregates, {
    realizedProfit: 25,
    boughtCost: 50,
    soldIncome: 75,
    lastActiveTimestamp: 200,
    tokenNum: 2,
  });
  assert.deepEqual(parsed.warningCodes, []);
  assert.equal(JSON.stringify(parsed).includes("synthetic-wallet-identity"), false);
  assert.equal(JSON.stringify(parsed).includes("synthetic-token-identity"), false);
  assert.equal(JSON.stringify(parsed).includes("synthetic-label"), false);
});

test("a next cursor is partial, while an echoed request cursor is not treated as continuation", () => {
  const terminal = parseGmgnWalletHoldingsPage({
    holdings: [{ realized_profit: 1 }],
    cursor: "echoed-request-position",
  });
  assert.equal(terminal.status, "MAPPED");
  assert.equal(terminal.completeness, 1);
  assert.deepEqual(terminal.warningCodes, []);

  const partial = parseGmgnWalletHoldingsPage({
    data: {
      holdings: [{ realized_profit: 1 }],
      next_cursor: "opaque-next-page",
    },
  });
  assert.equal(partial.status, "PARTIAL");
  assert.equal(partial.completeness, 0.5);
  assert.deepEqual(partial.warningCodes, ["gmgn_holdings_cursor_remaining"]);
  assert.equal(JSON.stringify(partial).includes("opaque-next-page"), false);
});

test("missing cumulative metrics remain null and malformed payloads fail closed", () => {
  const sparse = parseGmgnWalletHoldingsPage({ holdings: [] });
  assert.equal(sparse.status, "PARTIAL");
  assert.equal(sparse.completeness, 0);
  assert.deepEqual(sparse.aggregates, {
    realizedProfit: null,
    boughtCost: null,
    soldIncome: null,
    lastActiveTimestamp: null,
    tokenNum: null,
  });
  assert.deepEqual(sparse.warningCodes, ["gmgn_expected_metrics_unavailable"]);

  const malformed = parseGmgnWalletHoldingsPage({ unexpected: true });
  assert.equal(malformed.status, "UNAVAILABLE");
  assert.equal(malformed.completeness, 0);
  assert.deepEqual(malformed.warningCodes, ["gmgn_response_invalid"]);
});