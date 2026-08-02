import assert from "node:assert/strict";
import test from "node:test";
import { computeHudV02, SCENE_IDS } from "../../../src/application/wallet-intelligence/hud-v0-2.js";
import type { CandidateUnionEntry, WalletMasterV01Record } from "../../../src/application/wallet-intelligence/candidate-screening-v0-1.js";

function candidate(index: number): CandidateUnionEntry {
  return {
    address: `synthetic-${index}`,
    wallet_fingerprint: `fingerprint-${index}`,
    candidate_categories: ["A_ACTIVE_HIGH_PROFIT_LEAD"],
    candidate_reason_codes: [],
    key_metrics: { profit_7d: 1, profit_30d: index, win_rate_7d: 80, win_rate_30d: 80, trade_count_proxy: 0, token_count: index + 2, last_active_at: null, gmgn_lead_score: null, profit_percentile_30d: index * 5, data_quality_score: 10 },
    existing_labels: [], existing_note: "", data_confidence: "low", anomaly_flags: [], why_selected: "synthetic",
    what_is_not_known: [], recommended_next_action: "HUMAN_REVIEW", primary_recommended_action: "HUMAN_REVIEW", secondary_recommended_actions: [],
    action_reason_codes: [], research_priority_rank: index, category_count: 1, gmgn_lead_score: null, group_ranks: {},
  } as CandidateUnionEntry;
}

function master(index: number, profitable = true): WalletMasterV01Record {
  return {
    address: `synthetic-${index}`, wallet_fingerprint: `fingerprint-${index}`, source_order: index, existing_labels: [], existing_note: "", source_claims: [], existing_label: [],
    confirmed_label: null, confirmed_behavior_labels: null, gmgn_7d_status: "PARTIAL", gmgn_30d_status: "PARTIAL", gmgn_7d_completeness: null, gmgn_30d_completeness: null,
    data_confidence: "low", verification_status: "unverified", source_type: "borrowed", transport_requested_period: { "7d": "7d", "30d": "30d" }, provider_attested_period: { "7d": null, "30d": null }, confidence_cap: "low",
    profit_7d: profitable ? 1 : null, profit_30d: profitable ? index + 1 : null, win_rate_7d: 80, win_rate_30d: 80, buy_count: 0, sell_count: 0, trade_count_proxy: 0, token_count: index + 2,
    last_active_at: null, average_profit_per_trade_proxy: null, average_profit_per_token_proxy: null, seven_day_vs_thirty_day_consistency: null, anomaly_flags: [], activity_tier: "INACTIVE", data_tier: "TIER_PARTIAL",
    data_quality_score: 10, data_quality_tier: "DQ-C", profit_percentile_30d: index * 5, winrate_percentile_30d: null, trade_percentile_30d: null, gmgn_lead_score: null, gmgn_lead_tier: "", gmgn_lead_reason_codes: [],
    candidate_categories: ["A_ACTIVE_HIGH_PROFIT_LEAD"], candidate_reason_codes: [], human_review_status: "PENDING_HUMAN_REVIEW", alpha_score: null, final_wallet_score: null, final_wallet_grade: null, confirmed_behavior_labels_v2: null,
  } as WalletMasterV01Record;
}

test("HUD v0.2 compares only within scene and withholds small-cohort percentiles", () => {
  const candidates = Array.from({ length: 11 }, (_, index) => candidate(index));
  const masters = Array.from({ length: 10 }, (_, index) => master(index)).concat(master(10, false));
  const first = computeHudV02(candidates, masters, new Map(), new Map(), "2026-08-01T00:00:00.000Z");
  const second = computeHudV02(candidates, masters, new Map(), new Map(), "2026-08-01T00:00:00.000Z");
  const states = first.wallets.map((wallet) => wallet.state);
  const multiStates = states.filter((state) => state.primary_scene === "MULTI_TOKEN_REPEATABILITY");
  assert.equal(multiStates.length, 10);
  assert.equal(multiStates[0]?.scene_scores.MULTI_TOKEN_REPEATABILITY.peer_n, 10);
  assert.notEqual(multiStates[0]?.scene_scores.MULTI_TOKEN_REPEATABILITY.scene_percentile, null);
  assert.equal(states[10]?.scene_scores.MULTI_TOKEN_REPEATABILITY.raw_score, null);
  assert.equal(states[10]?.scene_scores.MULTI_TOKEN_REPEATABILITY.scene_percentile, null);
  assert.equal(states[0]?.scene_scores.PAYOFF_ASYMMETRY.scene_percentile, null);
  assert.deepEqual(first.wallets.map((wallet) => wallet.state), second.wallets.map((wallet) => wallet.state));
  const serialized = JSON.stringify(states[0]) as string;
  assert.equal(serialized.includes("shadow_win_rate"), false);
  assert.equal(serialized.includes("shadow_profit_factor"), false);
  assert.equal(serialized.includes("followability_percentile"), false);
  assert.deepEqual(SCENE_IDS, ["MULTI_TOKEN_REPEATABILITY", "PAYOFF_ASYMMETRY", "ACTIVITY_PERSISTENCE", "HIGH_FREQUENCY_SIGNAL_VALUE", "TRANSFER_ACCOUNTING_RISK"]);
});






test("primary scene changes are debounced across two v0.2 refreshes", () => {
  const candidates = Array.from({ length: 11 }, (_, index) => candidate(index));
  const baseline = Array.from({ length: 11 }, (_, index) => master(index));
  const first = computeHudV02(candidates, baseline, new Map(), new Map(), "2026-08-01T00:00:00.000Z");
  const changed = baseline.map((record, index) => index === 0 ? { ...record, activity_tier: "ACTIVE_7D", seven_day_vs_thirty_day_consistency: 1 } as WalletMasterV01Record : record);
  const previousOne = new Map([[first.wallets[0]!.state.address, first.wallets[0]!.state as unknown as Record<string, unknown>]]);
  const second = computeHudV02(candidates, changed, new Map(), previousOne, "2026-08-01T00:00:00.000Z");
  assert.equal(second.wallets[0]?.state.primary_scene, "MULTI_TOKEN_REPEATABILITY");
  assert.equal(second.wallets[0]?.state.pending_primary_scene, "ACTIVITY_PERSISTENCE");
  const previousTwo = new Map([[second.wallets[0]!.state.address, second.wallets[0]!.state as unknown as Record<string, unknown>]]);
  const third = computeHudV02(candidates, changed, new Map(), previousTwo, "2026-08-01T00:00:00.000Z");
  assert.equal(third.wallets[0]?.state.primary_scene, "ACTIVITY_PERSISTENCE");
  assert.equal(third.wallets[0]?.state.pending_primary_scene, null);
});
