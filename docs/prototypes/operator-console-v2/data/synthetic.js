/**
 * Fully synthetic / scrubbed demo data for offline prototype.
 * No private wallets. No provider keys. No network.
 */
(function (root) {
  "use strict";

  var SYNTH_MINT = "So1DemoMint1111111111111111111111111111111";
  var PUBLIC_PILOT_MINT = "H3GtwGSrYRVqp7dtjkaDfjE2inydLkHwFkFJSPzrpump";

  function baseCa(overrides) {
    var o = overrides || {};
    return Object.assign(
      {
        mint: PUBLIC_PILOT_MINT,
        symbol: "BNUT",
        name: "Baseball Squirrel",
        status: "OK",
        observedAt: "2026-07-30T09:12:12.623Z",
        sourceWatermark: "pagination_complete",
        dataSource: "synthetic-fixture",
        provider: "helius-scrubbed-pilot",
        accountingEligible: true,
        exclusionCoverage: "partial",
        concentrationEligible: false,
        marketDataStatus: "UNVERIFIED",
        walletIntelStatus: "UNVERIFIED",
        accounting: {
          mintSupplyRaw: "966968333378029",
          enumeratedTokenAccountBalanceRaw: "966968333378029",
          includedOwnerBalanceRaw: "966968333378029",
          excludedBalanceRaw: "0",
          unresolvedBalanceRaw: "0",
          accountingResidualRaw: "0",
          completeness: "complete",
          paginationComplete: true,
        },
        ownerCounts: {
          total: 2265,
          included: 2265,
          excluded: 0,
          unresolved: 0,
          tokenAccounts: 2270,
        },
        concentration: {
          top1: {
            numerator: "315947465296453",
            denominator: "966968333378029",
            ratio: null,
            verificationStatus: "unverified",
          },
          top5: {
            numerator: "401013503325765",
            denominator: "966968333378029",
            ratio: null,
            verificationStatus: "unverified",
          },
          top10: {
            numerator: "463331015755564",
            denominator: "966968333378029",
            ratio: null,
            verificationStatus: "unverified",
          },
          top20: {
            numerator: "552874852247110",
            denominator: "966968333378029",
            ratio: null,
            verificationStatus: "unverified",
          },
          top50: {
            numerator: "699539796546903",
            denominator: "966968333378029",
            ratio: null,
            verificationStatus: "unverified",
          },
          top100: {
            numerator: "808643367814253",
            denominator: "966968333378029",
            ratio: null,
            verificationStatus: "unverified",
          },
        },
        concentrationWarnings: [
          "pool_exclusion_coverage_incomplete",
          "not_cleaned_investor_concentration",
          "concentration_partial_or_unconfirmed",
        ],
        issues: [],
        universeDefinition: "owner_aggregated_observational_vs_mint_supply_pool_exclusion_incomplete",
        ruleVersion: "exclusion-v1",
        market: {
          priceUsd: "0.00001234",
          liquidityUsd: "42000",
          volume24h: "180000",
          pairAgeHours: 36,
          primaryPair: "SYNTH_PAIR_RAYDIUM",
          source: "dexscreener",
          tier: "B",
          verificationStatus: "unverified",
          boostsActive: 2,
          observedAt: "2026-07-30T09:10:00.000Z",
        },
        addressHits: [
          {
            kind: "tier_b_usable_pool",
            label: "gmgn_smart_money_style_tag",
            source: "gmgn",
            verificationStatus: "unverified",
            note: "Tier-B external observation — not on-chain confirmed",
          },
          {
            kind: "manual_review",
            label: "local_review_queue",
            source: "local",
            verificationStatus: "unverified",
            note: "Requires human review",
          },
        ],
        taskId: "task_synth_001",
      },
      o
    );
  }

  var SCENARIOS = {
    success: {
      id: "success",
      title: "Success (accounting OK; concentration still gated)",
      ca: baseCa({
        status: "OK",
        accountingEligible: true,
        exclusionCoverage: "complete",
        concentrationEligible: true,
        concentration: {
          top1: {
            numerator: "100",
            denominator: "1000",
            ratio: 0.1,
            verificationStatus: "confirmed",
          },
          top5: {
            numerator: "350",
            denominator: "1000",
            ratio: 0.35,
            verificationStatus: "confirmed",
          },
          top10: {
            numerator: "500",
            denominator: "1000",
            ratio: 0.5,
            verificationStatus: "confirmed",
          },
          top20: {
            numerator: "650",
            denominator: "1000",
            ratio: 0.65,
            verificationStatus: "confirmed",
          },
          top50: {
            numerator: "800",
            denominator: "1000",
            ratio: 0.8,
            verificationStatus: "confirmed",
          },
          top100: {
            numerator: "900",
            denominator: "1000",
            ratio: 0.9,
            verificationStatus: "confirmed",
          },
        },
        concentrationWarnings: [],
        marketDataStatus: "UNVERIFIED",
        walletIntelStatus: "UNVERIFIED",
      }),
      task: {
        taskId: "task_synth_success",
        status: "completed",
        requestBudget: 20,
        requestsUsed: 6,
        failureReason: null,
        warnings: [],
      },
      banner: null,
    },
    partial: {
      id: "partial",
      title: "Partial — exclusion incomplete, ratio null",
      ca: baseCa({ status: "PARTIAL" }),
      task: {
        taskId: "task_synth_partial",
        status: "partial",
        requestBudget: 20,
        requestsUsed: 12,
        failureReason: null,
        warnings: ["pool_exclusion_coverage_incomplete", "pagination_window_limited"],
      },
      banner: {
        kind: "partial",
        text: "PARTIAL: 已展示可取得事实；Concentration 不可确认（exclusion coverage partial）。",
      },
    },
    credential_blocked: {
      id: "credential_blocked",
      title: "Credential blocked",
      ca: baseCa({
        status: "BLOCKED",
        accountingEligible: false,
        exclusionCoverage: "unavailable",
        concentrationEligible: false,
        marketDataStatus: "UNAVAILABLE",
        walletIntelStatus: "UNAVAILABLE",
        concentration: {
          top1: { numerator: null, denominator: null, ratio: null, verificationStatus: "unverified" },
          top5: { numerator: null, denominator: null, ratio: null, verificationStatus: "unverified" },
          top10: { numerator: null, denominator: null, ratio: null, verificationStatus: "unverified" },
          top20: { numerator: null, denominator: null, ratio: null, verificationStatus: "unverified" },
          top50: { numerator: null, denominator: null, ratio: null, verificationStatus: "unverified" },
          top100: { numerator: null, denominator: null, ratio: null, verificationStatus: "unverified" },
        },
      }),
      task: {
        taskId: "task_synth_cred",
        status: "blocked",
        requestBudget: 20,
        requestsUsed: 0,
        failureReason: "BLOCKED_CREDENTIAL: HELIUS_API_KEY unavailable in this environment",
        warnings: ["credential_unavailable"],
      },
      banner: {
        kind: "blocked",
        text: "BLOCKED_CREDENTIAL：凭据不可用 — 这不是 generic failed，也不是数据为空。",
      },
    },
    budget_exhausted: {
      id: "budget_exhausted",
      title: "Budget exhausted",
      ca: baseCa({
        status: "PARTIAL",
        accountingEligible: false,
        exclusionCoverage: "partial",
        concentrationEligible: false,
        accounting: {
          mintSupplyRaw: "966968333378029",
          enumeratedTokenAccountBalanceRaw: "120000000000000",
          includedOwnerBalanceRaw: "120000000000000",
          excludedBalanceRaw: "0",
          unresolvedBalanceRaw: "0",
          accountingResidualRaw: "846968333378029",
          completeness: "partial",
          paginationComplete: false,
        },
      }),
      task: {
        taskId: "task_synth_budget",
        status: "failed",
        requestBudget: 8,
        requestsUsed: 8,
        failureReason: "BUDGET_EXHAUSTED: request budget reached before pagination complete",
        warnings: ["request_budget_exhausted", "pagination_incomplete"],
      },
      banner: {
        kind: "budget",
        text: "BUDGET_EXHAUSTED：预算耗尽 ≠ complete。已取得的 partial 事实可展示，但不得标记 SUCCESS。",
      },
    },
    stale: {
      id: "stale",
      title: "Stale result",
      ca: baseCa({
        status: "OK",
        observedAt: "2026-07-28T01:00:00.000Z",
        sourceWatermark: "stale_cache_as_of_2026-07-28",
      }),
      task: {
        taskId: "task_synth_stale",
        status: "completed",
        requestBudget: 20,
        requestsUsed: 5,
        failureReason: null,
        warnings: ["result_stale_relative_to_policy"],
      },
      banner: {
        kind: "stale",
        text: "STALE_RESULT：结果可能过期，不得伪装为最新。建议 rescan 创建新 run（保留 lineage）。",
      },
    },
    schema_error: {
      id: "schema_error",
      title: "Schema error fail-closed",
      ca: null,
      task: {
        taskId: "task_synth_schema",
        status: "failed",
        requestBudget: 20,
        requestsUsed: 3,
        failureReason: "SCHEMA_ERROR: unknown fields / contract mismatch — fail closed",
        warnings: ["schema_unknown_fail_closed"],
      },
      banner: {
        kind: "schema",
        text: "SCHEMA_ERROR：契约未知 — fail-closed，不渲染可疑数值。",
      },
    },
    empty: {
      id: "empty",
      title: "Empty universe",
      ca: baseCa({
        mint: SYNTH_MINT,
        symbol: null,
        name: null,
        status: "EMPTY",
        accountingEligible: false,
        exclusionCoverage: "unavailable",
        concentrationEligible: false,
        ownerCounts: { total: 0, included: 0, excluded: 0, unresolved: 0, tokenAccounts: 0 },
        concentration: {
          top1: { numerator: "0", denominator: "0", ratio: null, verificationStatus: "unverified" },
          top5: { numerator: "0", denominator: "0", ratio: null, verificationStatus: "unverified" },
          top10: { numerator: "0", denominator: "0", ratio: null, verificationStatus: "unverified" },
          top20: { numerator: "0", denominator: "0", ratio: null, verificationStatus: "unverified" },
          top50: { numerator: "0", denominator: "0", ratio: null, verificationStatus: "unverified" },
          top100: { numerator: "0", denominator: "0", ratio: null, verificationStatus: "unverified" },
        },
        issues: [{ code: "EMPTY_TOKEN_ACCOUNTS", severity: "info", evidence: ["no token accounts in window"] }],
      }),
      task: {
        taskId: "task_synth_empty",
        status: "completed",
        requestBudget: 20,
        requestsUsed: 2,
        failureReason: null,
        warnings: ["empty_result_not_error"],
      },
      banner: {
        kind: "empty",
        text: "EMPTY：结果为空（不是 error）。可重试或检查 mint 是否正确。",
      },
    },
  };

  var CA_LIST = [
    {
      mint: PUBLIC_PILOT_MINT,
      symbol: "BNUT",
      name: "Baseball Squirrel",
      status: "PARTIAL",
      accountingEligible: true,
      exclusionCoverage: "partial",
      concentrationEligible: false,
      observedAt: "2026-07-30T09:12:12.623Z",
    },
    {
      mint: "EUx9N4UXDyAXJpziyLF36j6Ut3Gu9X3VKEGptbmfpump",
      symbol: "bulltom",
      name: "bulltom",
      status: "OK",
      accountingEligible: true,
      exclusionCoverage: "partial",
      concentrationEligible: false,
      observedAt: "2026-07-30T09:07:46.831Z",
    },
    {
      mint: SYNTH_MINT,
      symbol: "DEMO",
      name: "Synthetic Empty Demo",
      status: "EMPTY",
      accountingEligible: false,
      exclusionCoverage: "unavailable",
      concentrationEligible: false,
      observedAt: "2026-07-31T00:00:00.000Z",
    },
  ];

  var WALLETS = [
    {
      id: "w_fp_001",
      fingerprint: "fp_a1b2c3d4",
      tier: "tier_b_usable_pool",
      status7d: "partial",
      status30d: "partial",
      completeness: 0.72,
      warnings: ["gmgn_window_incomplete"],
      verificationStatus: "unverified",
      disclaimer: "Third-party Tier-B observation · Not confirmed on-chain smart money",
      labels: [
        {
          label: "platform_smart_money_style",
          source: "gmgn",
          confidence: 0.4,
          verificationStatus: "unverified",
        },
      ],
      note: "Synthetic demo wallet — not a private address",
      caHitsPlaceholder: "Cross-CA hits: FUTURE_MILESTONE / NO_LIVE_DATA",
      observedAt: "2026-07-29T12:00:00.000Z",
    },
    {
      id: "w_fp_002",
      fingerprint: "fp_e5f6g7h8",
      tier: "tier_b_shortlist",
      status7d: "ok",
      status30d: "partial",
      completeness: 0.91,
      warnings: [],
      verificationStatus: "unverified",
      disclaimer: "Third-party Tier-B observation · Not confirmed on-chain smart money",
      labels: [
        {
          label: "manual_review_candidate",
          source: "local",
          confidence: 0.5,
          verificationStatus: "unverified",
        },
      ],
      note: "Shortlist candidate for on-chain review",
      caHitsPlaceholder: "Cross-CA hits: FUTURE_MILESTONE / NO_LIVE_DATA",
      observedAt: "2026-07-29T12:00:00.000Z",
    },
  ];

  var ADDRESSES = [
    {
      id: "addr_001",
      display: "demo_addr_…aaaa",
      labels: [
        { label: "pool_vault_candidate", source: "local_rule", confidence: 0.8, verificationStatus: "unverified" },
      ],
      note: "Synthetic address library row",
      source: "local",
      confidence: 0.8,
      verificationStatus: "unverified",
    },
    {
      id: "addr_002",
      display: "demo_addr_…bbbb",
      labels: [
        { label: "burn_address", source: "local_rule", confidence: 0.99, verificationStatus: "confirmed" },
      ],
      note: "Local deterministic burn set",
      source: "local",
      confidence: 0.99,
      verificationStatus: "confirmed",
    },
  ];

  var TASKS = [
    {
      taskId: "task_synth_001",
      input: { mint: PUBLIC_PILOT_MINT },
      provider: "helius",
      status: "partial",
      requestBudget: 20,
      requestsUsed: 12,
      startedAt: "2026-07-30T09:10:00.000Z",
      endedAt: "2026-07-30T09:12:12.623Z",
      warnings: ["pool_exclusion_coverage_incomplete"],
      outputLink: "#/ca/" + PUBLIC_PILOT_MINT,
      failureReason: null,
      lineage: { parentTaskId: null, attempt: 1 },
    },
    {
      taskId: "task_synth_cred",
      input: { mint: SYNTH_MINT },
      provider: "helius",
      status: "blocked",
      requestBudget: 20,
      requestsUsed: 0,
      startedAt: "2026-07-31T01:00:00.000Z",
      endedAt: "2026-07-31T01:00:01.000Z",
      warnings: ["credential_unavailable"],
      outputLink: null,
      failureReason: "BLOCKED_CREDENTIAL",
      lineage: { parentTaskId: null, attempt: 1 },
    },
  ];

  root.OcSynthetic = {
    SCENARIOS: SCENARIOS,
    CA_LIST: CA_LIST,
    WALLETS: WALLETS,
    ADDRESSES: ADDRESSES,
    TASKS: TASKS,
    PUBLIC_PILOT_MINT: PUBLIC_PILOT_MINT,
    SYNTH_MINT: SYNTH_MINT,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
