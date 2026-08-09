import assert from "node:assert/strict";
import test from "node:test";
import { computeHudV02, SCENE_IDS } from "../../../src/application/wallet-intelligence/hud-v0-2.js";
import type {
  CandidateUnionEntry,
  WalletMasterV01Record,
} from "../../../src/application/wallet-intelligence/candidate-screening-v0-1.js";

type MasterOverrides = Partial<WalletMasterV01Record>;

function candidate(index: number): CandidateUnionEntry {
  return {
    address: `synthetic-${index}`,
    wallet_fingerprint: `fingerprint-${index}`,
    candidate_categories: ["A_ACTIVE_HIGH_PROFIT_LEAD"],
    candidate_reason_codes: [],
    key_metrics: {
      profit_7d: 1,
      profit_30d: index,
      win_rate_7d: 80,
      win_rate_30d: 80,
      trade_count_proxy: 0,
      token_count: index + 2,
      last_active_at: null,
      gmgn_lead_score: null,
      profit_percentile_30d: index * 5,
      data_quality_score: 10,
    },
    existing_labels: [],
    existing_note: "",
    data_confidence: "low",
    anomaly_flags: [],
    why_selected: "synthetic",
    what_is_not_known: [],
    recommended_next_action: "HUMAN_REVIEW",
    primary_recommended_action: "HUMAN_REVIEW",
    secondary_recommended_actions: [],
    action_reason_codes: [],
    research_priority_rank: index,
    category_count: 1,
    gmgn_lead_score: null,
    group_ranks: {},
  } as CandidateUnionEntry;
}

function master(
  index: number,
  profitable = true,
  overrides: MasterOverrides = {},
): WalletMasterV01Record {
  return {
    address: `synthetic-${index}`,
    wallet_fingerprint: `fingerprint-${index}`,
    source_order: index,
    existing_labels: [],
    existing_note: "",
    source_claims: [],
    existing_label: [],
    confirmed_label: null,
    confirmed_behavior_labels: null,
    gmgn_7d_status: "PARTIAL",
    gmgn_30d_status: "PARTIAL",
    gmgn_7d_completeness: null,
    gmgn_30d_completeness: null,
    data_confidence: "low",
    verification_status: "unverified",
    source_type: "borrowed",
    transport_requested_period: { "7d": "7d", "30d": "30d" },
    provider_attested_period: { "7d": null, "30d": null },
    confidence_cap: "low",
    profit_7d: profitable ? 1 : null,
    profit_30d: profitable ? index + 1 : null,
    win_rate_7d: 80,
    win_rate_30d: 80,
    buy_count: 0,
    sell_count: 0,
    trade_count_proxy: 0,
    token_count: index + 2,
    last_active_at: null,
    average_profit_per_trade_proxy: null,
    average_profit_per_token_proxy: null,
    seven_day_vs_thirty_day_consistency: null,
    anomaly_flags: [],
    activity_tier: "INACTIVE",
    data_tier: "TIER_PARTIAL",
    data_quality_score: 10,
    data_quality_tier: "DQ-C",
    profit_percentile_30d: index * 5,
    winrate_percentile_30d: null,
    trade_percentile_30d: null,
    gmgn_lead_score: null,
    gmgn_lead_tier: "",
    gmgn_lead_reason_codes: [],
    candidate_categories: ["A_ACTIVE_HIGH_PROFIT_LEAD"],
    candidate_reason_codes: [],
    human_review_status: "PENDING_HUMAN_REVIEW",
    alpha_score: null,
    final_wallet_score: null,
    final_wallet_grade: null,
    confirmed_behavior_labels_v2: null,
    ...overrides,
  } as WalletMasterV01Record;
}

function run(
  candidates: CandidateUnionEntry[],
  masters: WalletMasterV01Record[],
  evidence = new Map<string, any>(),
  previous = new Map<string, Record<string, unknown>>(),
) {
  return computeHudV02(
    candidates,
    masters,
    evidence,
    previous,
    "2026-08-02T00:00:00.000Z",
  );
}

function copyState(state: Record<string, any>): Record<string, any> {
  return JSON.parse(JSON.stringify(state)) as Record<string, any>;
}

test("HUD v0.2 compares only within scene and withholds small-cohort percentiles", () => {
  const candidates = Array.from({ length: 12 }, (_, index) => candidate(index));
  const masters = Array.from({ length: 11 }, (_, index) => master(index)).concat(
    master(11, false),
  );
  const first = run(candidates, masters);
  const second = run(candidates, masters);
  const states = first.wallets.map((wallet) => wallet.state);
  const multiStates = states.filter(
    (state) => state.primary_scene === "MULTI_TOKEN_REPEATABILITY",
  );
  assert.equal(multiStates.length, 10);
  assert.equal(
    multiStates[0]?.scene_scores.MULTI_TOKEN_REPEATABILITY.peer_n,
    10,
  );
  assert.notEqual(
    multiStates.find(
      (state) => state.scene_scores.MULTI_TOKEN_REPEATABILITY.scene_percentile !== null,
    )?.scene_scores.MULTI_TOKEN_REPEATABILITY.scene_percentile,
    null,
  );
  assert.equal(
    states[0]?.scene_scores.MULTI_TOKEN_REPEATABILITY.raw_score,
    null,
  );
  assert.equal(
    states[0]?.scene_scores.MULTI_TOKEN_REPEATABILITY.eligible_n,
    10,
  );
  assert.equal(
    states[0]?.scene_scores.MULTI_TOKEN_REPEATABILITY.scene_percentile,
    null,
  );
  assert.equal(states[11]?.scene_scores.MULTI_TOKEN_REPEATABILITY.raw_score, null);
  assert.equal(states[0]?.scene_scores.PAYOFF_ASYMMETRY.scene_percentile, null);
  for (const state of states) {
    for (const scene of SCENE_IDS) {
      const score = state.scene_scores[scene];
      assert.ok(score.peer_n <= score.eligible_n);
      if (score.scene_percentile !== null) {
        assert.ok(score.peer_n >= 10);
        assert.ok(score.peer_n <= score.eligible_n);
      }
    }
  }
  assert.deepEqual(
    first.wallets.map((wallet) => wallet.state),
    second.wallets.map((wallet) => wallet.state),
  );
  assert.equal(first.previews.every((row) => row.changed === true), true);
  const serialized = JSON.stringify(states[0]) as string;
  assert.equal(serialized.includes("shadow_win_rate"), false);
  assert.equal(serialized.includes("shadow_profit_factor"), false);
  assert.equal(serialized.includes("followability_percentile"), false);
  assert.deepEqual(SCENE_IDS, [
    "MULTI_TOKEN_REPEATABILITY",
    "PAYOFF_ASYMMETRY",
    "ACTIVITY_PERSISTENCE",
    "HIGH_FREQUENCY_SIGNAL_VALUE",
    "TRANSFER_ACCOUNTING_RISK",
  ]);
});

test("risk overlay cannot become primary and primary selection is not cross-scene raw sorting", () => {
  const candidates = [candidate(0)];
  const masters = [
    master(0, true, {
      token_count: 6,
      trade_count_proxy: 2,
      activity_tier: "ACTIVE_7D",
      anomaly_flags: ["TRANSFER_IN_SELL"],
    }),
  ];
  const evidence = new Map<string, any>([
    [
      "synthetic-0",
      {
        verification: {
          address: "synthetic-0",
          fingerprint12: "fingerprint-0",
          transfer_artifact_risk: "HIGH",
          reconstructed_pnl_status: "PNL_PARTIAL",
          verified_profit_token_count: "13",
          verified_loss_token_count: "0",
        },
        concentration: {
          fingerprint12: "fingerprint-0",
          verified_profit_token_count: "3",
          gmgn_top1_share: "0.2",
        },
        followability: null,
        v01State: null,
      },
    ],
  ]);
  const state = run(candidates, masters, evidence).wallets[0]!.state;
  assert.equal(state.primary_scene, "MULTI_TOKEN_REPEATABILITY");
  assert.notEqual(state.primary_scene, "TRANSFER_ACCOUNTING_RISK");
  assert.equal(
    state.scene_scores.TRANSFER_ACCOUNTING_RISK.score_source,
    "CHAIN_SAMPLED_PROXY",
  );
  assert.equal(
    state.scene_scores.ACTIVITY_PERSISTENCE.score_source,
    "BORROWED_PROXY",
  );
  assert.equal(
    state.scene_scores.MULTI_TOKEN_REPEATABILITY.score_source,
    "CHAIN_SAMPLED_PROXY",
  );
});

test("scene provenance stays scene-specific and provider-only labels remain clues", () => {
  const providers = run([candidate(0)], [master(0, true, { token_count: 4 })]);
  const providerState = providers.wallets[0]!.state;
  assert.equal(
    providerState.scene_scores.MULTI_TOKEN_REPEATABILITY.score_source,
    "BORROWED_PROXY",
  );
  assert.match(providerState.gmgn_name, /多币活跃线索/);
  assert.doesNotMatch(providerState.gmgn_name, /多币盈利复现/);

  const chain = new Map<string, any>([
    [
      "synthetic-0",
      {
        verification: {
          address: "synthetic-0",
          fingerprint12: "fingerprint-0",
          transfer_artifact_risk: "LOW",
          reconstructed_pnl_status: "PNL_RECONSTRUCTED",
          verified_profit_token_count: "3",
          verified_loss_token_count: "1",
        },
        concentration: {
          fingerprint12: "fingerprint-0",
          verified_profit_token_count: "3",
          gmgn_top1_share: "0.2",
        },
        followability: null,
        v01State: null,
      },
    ],
  ]);
  const chainState = run([candidate(0)], [master(0, true, { token_count: 4 })], chain)
    .wallets[0]!.state;
  assert.equal(
    chainState.scene_scores.MULTI_TOKEN_REPEATABILITY.score_source,
    "CHAIN_SAMPLED_PROXY",
  );
  assert.match(chainState.gmgn_name, /多币盈利复现/);
  assert.equal(
    chainState.scene_scores.ACTIVITY_PERSISTENCE.score_source,
    "BORROWED_PROXY",
  );
});

test("primary scene changes are debounced across two v0.2 refreshes", () => {
  const candidates = [candidate(0)];
  const baseline = [master(0, true, { token_count: 3 })];
  const first = run(candidates, baseline);
  assert.equal(first.wallets[0]?.state.primary_scene, "MULTI_TOKEN_REPEATABILITY");
  const changed = [
    master(0, true, {
      token_count: 1,
      trade_count_proxy: 1,
      activity_tier: "ACTIVE_7D",
      seven_day_vs_thirty_day_consistency: 1,
    }),
  ];
  const previousOne = new Map([
    [first.wallets[0]!.state.address, first.wallets[0]!.state as unknown as Record<string, unknown>],
  ]);
  const second = run(candidates, changed, new Map(), previousOne);
  assert.equal(second.wallets[0]?.state.primary_scene, "MULTI_TOKEN_REPEATABILITY");
  assert.equal(second.wallets[0]?.state.pending_primary_scene, "ACTIVITY_PERSISTENCE");
  const previousTwo = new Map([
    [second.wallets[0]!.state.address, second.wallets[0]!.state as unknown as Record<string, unknown>],
  ]);
  const third = run(candidates, changed, new Map(), previousTwo);
  assert.equal(third.wallets[0]?.state.primary_scene, "ACTIVITY_PERSISTENCE");
  assert.equal(third.wallets[0]?.state.pending_primary_scene, null);
});

test("delta debounce suppresses same state and tiny Pxx/N movement while honoring thresholds", () => {
  const candidates = Array.from({ length: 12 }, (_, index) => candidate(index));
  const masters = Array.from({ length: 12 }, (_, index) => master(index));
  const baseline = run(candidates, masters);
  const baseState = baseline.wallets[11]!.state as unknown as Record<string, any>;
  const same = run(
    candidates,
    masters,
    new Map(),
    new Map([[baseState.address, baseState]]),
  );
  assert.equal(same.previews[11]?.changed, false);

  const tiny = copyState(baseState);
  const tinyScene = "MULTI_TOKEN_REPEATABILITY" as const;
  tiny.scene_scores[tinyScene].scene_percentile = 99;
  tiny.scene_scores[tinyScene].sample_n = Math.max(
    0,
    Number(tiny.scene_scores[tinyScene].sample_n) - 1,
  );
  const tinyResult = run(
    candidates,
    masters,
    new Map(),
    new Map([[tiny.address, tiny]]),
  );
  assert.equal(tinyResult.previews[11]?.changed, false);

  const thresholdState = copyState(baseState);
  thresholdState.scene_scores[tinyScene].scene_percentile = 49;
  const thresholdResult = run(
    candidates,
    masters,
    new Map(),
    new Map([[thresholdState.address, thresholdState]]),
  );
  assert.equal(thresholdResult.previews[11]?.changed, true);
  assert.match(String(thresholdResult.previews[11]?.change_reason), /PERCENTILE/);

  const sampleState = copyState(baseState);
  sampleState.scene_scores[tinyScene].sample_n =
    Number(sampleState.scene_scores[tinyScene].sample_n) - 5;
  const sampleResult = run(
    candidates,
    masters,
    new Map(),
    new Map([[sampleState.address, sampleState]]),
  );
  assert.equal(sampleResult.previews[11]?.changed, true);
  assert.match(String(sampleResult.previews[11]?.change_reason), /SAMPLE/);

  const trendState = copyState(baseState);
  trendState.recent_trend = "DECAYING";
  const enhancingMasters = masters.map((record, index) =>
    index === 11
      ? master(index, true, { activity_tier: "ACTIVE_7D", seven_day_vs_thirty_day_consistency: 1.2 })
      : record,
  );
  const trendResult = run(
    candidates,
    enhancingMasters,
    new Map(),
    new Map([[trendState.address, trendState]]),
  );
  assert.equal(trendResult.previews[11]?.changed, true);
  assert.match(String(trendResult.previews[11]?.change_reason), /TREND/);

  const riskState = copyState(baseState);
  riskState.primary_risk = "PROVIDER_PERIOD_UNVERIFIED";
  const riskyEvidence = new Map<string, any>([
    [
      "synthetic-11",
      {
        verification: {
          address: "synthetic-11",
          fingerprint12: "fingerprint-11",
          transfer_artifact_risk: "HIGH",
          reconstructed_pnl_status: "PNL_PARTIAL",
          verified_profit_token_count: "13",
          verified_loss_token_count: "0",
        },
        concentration: null,
        followability: null,
        v01State: null,
      },
    ],
  ]);
  const riskCurrent = run(candidates, masters, riskyEvidence);
  riskState.scene_scores[tinyScene].scene_percentile =
    riskCurrent.wallets[11]!.state.scene_scores[tinyScene].scene_percentile;
  const riskResult = run(
    candidates,
    masters,
    riskyEvidence,
    new Map([[riskState.address, riskState]]),
  );
  assert.equal(riskResult.previews[11]?.changed, true);
  assert.match(String(riskResult.previews[11]?.change_reason), /RISK/);

  const followState = copyState(baseState);
  followState.followability_status = "UNKNOWN";
  const followEvidence = new Map<string, any>([
    [
      "synthetic-11",
      {
        verification: null,
        concentration: null,
        followability: { followability_status: "FOLLOWABILITY_LOW" },
        v01State: null,
      },
    ],
  ]);
  const followResult = run(
    candidates,
    masters,
    followEvidence,
    new Map([[followState.address, followState]]),
  );
  assert.equal(followResult.previews[11]?.changed, true);
  assert.match(String(followResult.previews[11]?.change_reason), /FOLLOWABILITY/);
});

test("GMGN names use T/E units and stay concise", () => {
  const candidates = Array.from({ length: 12 }, (_, index) => candidate(index));
  const masters = Array.from({ length: 12 }, (_, index) =>
    master(index, true, {
      token_count: index === 11 ? 8 : index + 2,
      trade_count_proxy: index === 11 ? 100 : index + 1,
      activity_tier: index === 11 ? "ACTIVE_7D" : "INACTIVE",
    }),
  );
  const result = run(candidates, masters);
  const eventName = result.wallets[11]!.state.gmgn_name;
  assert.match(eventName, /E/);
  assert.equal(eventName.length <= 28, true);
  const tokenName = result.wallets[1]!.state.gmgn_name;
  assert.match(tokenName, /T/);
  assert.equal(tokenName.length <= 28, true);
});


test("activity strength does not collapse when provider event count is unknown", () => {
  const result = run([candidate(0)], [master(0, true, { activity_tier: "ACTIVE_7D", trade_count_proxy: null, token_count: null })]);
  const state = result.wallets[0]!.state;
  assert.equal(state.primary_scene, "ACTIVITY_PERSISTENCE");
  assert.notEqual(state.scene_scores.ACTIVITY_PERSISTENCE.raw_score, null);
  assert.match(state.scene_scores.ACTIVITY_PERSISTENCE.reason_codes.join("|"), /ACTIVITY_EVENT_COUNT_UNKNOWN/);
});

test("loss-only chain sample cannot satisfy reproduction threshold", () => {
  const evidence = new Map<string, any>([["synthetic-0", { verification: { address: "synthetic-0", fingerprint12: "fingerprint-0", verified_profit_token_count: "0", verified_loss_token_count: "5", reconstructed_pnl_status: "PNL_PARTIAL" }, concentration: null, followability: null, v01State: null }]]);
  const result = run([candidate(0)], [master(0, true, { activity_tier: "INACTIVE", token_count: 0 })], evidence);
  assert.equal(result.wallets[0]!.state.scene_scores.MULTI_TOKEN_REPEATABILITY.raw_score, null);
  assert.equal(result.wallets[0]!.state.primary_scene, null);
});
