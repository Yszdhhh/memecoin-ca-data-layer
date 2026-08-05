import assert from "node:assert/strict";
import test from "node:test";
import { analyzeIdentity, buildWalletLibrary, generateGmgnNote } from "../../../src/application/wallet-library/wallet-library.js";
import { WalletLibraryInput, WalletLibraryInputRecord } from "../../../src/application/wallet-library/types.js";

function wallet(overrides: Partial<WalletLibraryInputRecord> = {}): WalletLibraryInputRecord {
  return {
    chain: "BSC",
    address: "fixture-bsc-1",
    address_type: "EOA",
    labels: ["BSC Wick李", "wick李钱包", "Wick李"],
    current_note: "旧备注",
    source_count: 5,
    identity_last_verified_at: null,
    identity_verified: false,
    social: { wallet_social_mapping_status: "NO_MATCH", social_sources: [] },
    stats: {
      win_rate_30d: 50,
      payoff_ratio: null,
      pnl_7d: 0,
      pnl_30d: 0,
      trade_count_7d: 0,
      trade_count_30d: 0,
      profitable_token_count: 0,
      losing_token_count: 0,
      token_count: 0,
      multi_token_repeatability: null,
      pnl_concentration: null,
      last_active_at: "2026-08-04T00:00:00.000Z",
      provider_data_quality: "C",
      provider_data_status: "SUCCESS",
      provider_pnl_status: "provider_only",
      provider_pnl_source: "fixture",
      provider_pnl_confidence: "LOW",
      pnl_currency: "USD",
      verification_status: "PROVIDER_ONLY",
      replay_followability_status: "UNKNOWN",
      data_completeness: 0.35,
    },
    ...overrides,
  };
}

function input(wallets: WalletLibraryInputRecord[]): WalletLibraryInput {
  return {
    schema_version: "wallet-library-input-v1",
    as_of: "2026-08-05T00:00:00.000Z",
    source_versions: { fixture: "v1" },
    input_hashes: { fixture: "HASH" },
    wallets,
  };
}

test("identity normalization clusters exact aliases without fuzzy-merging names", () => {
  const result = analyzeIdentity({
    chain: "BSC",
    address: "fixture-bsc-1",
    labels: ["BSC Wick李", "wick李钱包", "Wick李", "冷静"],
    identity_verified: false,
  });

  assert.equal(result.raw_label_count, 4);
  assert.equal(result.dominant_alias_count, 3);
  assert.equal(result.identity_status, "STRONG_ALIAS_CLUSTER");
  assert.equal(result.alias_variants.length, 2);
  assert.ok(result.alias_variants.some((value) => value.includes("Wick李")));
  assert.ok(result.alias_variants.some((value) => value.includes("冷静")));
});

test("zero and null statistics remain distinct in records and benchmarks", () => {
  const built = buildWalletLibrary(
    input([
      wallet(),
      wallet({
        address: "fixture-bsc-2",
        labels: [],
        stats: { ...wallet().stats, win_rate_30d: null, pnl_30d: null, trade_count_30d: null, token_count: null },
      }),
    ]),
  );
  const zero = built.records.find((record) => record.address === "fixture-bsc-1");
  const missing = built.records.find((record) => record.address === "fixture-bsc-2");
  assert.ok(zero);
  assert.ok(missing);
  assert.equal(zero?.win_rate_30d, 50);
  assert.equal(zero?.pnl_30d, 0);
  assert.equal(zero?.trade_count_30d, 0);
  assert.equal(missing?.win_rate_30d, null);
  assert.equal(missing?.pnl_30d, null);
  assert.equal(missing?.trade_count_30d, null);
  const pnlMetric = built.benchmarks.cohorts.BSC_all?.pnl_30d;
  assert.ok(pnlMetric);
  assert.equal(pnlMetric.zero_count, 1);
  assert.equal(pnlMetric.null_count, 1);
});

test("unverified social followers never enter the GMGN note", () => {
  const handleOnly = wallet({
    social: {
      x_handle: "@fixture",
      x_followers_exact: 123456,
      x_followers_compact: "123K",
      wallet_social_mapping_status: "HANDLE_ONLY",
      social_sources: ["fixture"],
    },
  });
  const verified = wallet({
    address: "fixture-bsc-3",
    social: {
      x_handle: "@fixture_verified",
      x_followers_exact: 123456,
      x_followers_compact: "123K",
      wallet_social_mapping_status: "VERIFIED_WALLET_MATCH",
      social_sources: ["public_wallet_page"],
    },
  });
  const built = buildWalletLibrary(input([handleOnly, verified]));
  const first = built.records.find((record) => record.address === "fixture-bsc-1");
  const second = built.records.find((record) => record.address === "fixture-bsc-3");
  assert.ok(first);
  assert.ok(second);
  assert.equal(first?.social.x_followers_exact, null);
  assert.equal(second?.social.x_followers_exact, 123456);
  assert.ok(!first?.gmgn_note.includes("123K"));
  assert.ok(second?.gmgn_note.includes("X123K"));
});

test("GMGN notes are bounded and avoid prohibited certainty language", () => {
  const record = buildWalletLibrary(
    input([
      wallet({
        labels: ["多项目聪明钱", "确认Bot", "wallet"],
        stats: {
          ...wallet().stats,
          pnl_30d: 2_000_000,
          trade_count_30d: 4000,
          multi_token_repeatability: "high",
        },
      }),
    ]),
  ).records[0]!;
  const note = generateGmgnNote(record);
  assert.ok(Array.from(note).length <= 32);
  assert.ok(!note.includes("确认聪明钱"));
  assert.ok(!note.includes("可直接跟单"));
  assert.ok(!note.includes("勿直接跟"));
  assert.ok(note.includes("待核") || note.includes("标签线索") || note.includes("高频"));
});

test("same input produces stable library records, benchmarks, and changes", () => {
  const fixture = input([
    wallet(),
    wallet({ chain: "SOL", address: "fixture-sol-1", labels: ["SOL alpha"] }),
  ]);
  const first = buildWalletLibrary(fixture);
  const second = buildWalletLibrary(fixture);
  assert.deepEqual(first.records, second.records);
  assert.deepEqual(first.benchmarks, second.benchmarks);
  assert.deepEqual(first.changes, second.changes);
});
