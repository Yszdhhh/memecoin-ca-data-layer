# Acceptance — SOL-WALLET-CLEAN-RANK-REPLAY-UNDER-REPAIR-003-RULES-001

## Verdict

**GREEN** (offline deterministic replay complete; product Alpha empty under Repair-003)

Date: 2026-07-30  
Role: Offline implementer / data replay analyst  
Rule surface: current `master-table-builder` + Repair-003 `alphaEligible` + `wallet-data-quality-v3`  
Local private detail root:  
`C:\Users\10639\chainfm_out\sol\derived\SOL-WALLET-CLEAN-RANK-REPLAY-UNDER-REPAIR-003-RULES-001\`

## Boundary

| Boundary | Actual |
| --- | --- |
| Network / GMGN / Helius / RPC | 0 |
| Credential reads | 0 |
| Plaintext addresses in Git | 0 (fingerprints only) |
| Rules relaxed to keep candidate count | No |
| GMGN marked confirmed | No |
| smartMoneyConfirmed / verifiedAlpha claims | 0 |

## Input SHA (must match rerun-002 audit)

| Input | SHA-256 | Match |
| --- | --- | --- |
| `sol_addresses.txt` | `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C` | YES |
| `sol_address_labels.json` | `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3` | YES |
| `normalized_wallet_profiles.json` | `F461061BB7B747D512DF2193D46E0DE02DEA50A86C661E9F8234B6E8F8737EE6` | YES |
| `summary.json` | `55DFAB261C1BEADBDD2E16574BB569DC69076463A97A46360F041EDC1024263D` | YES |

## Determinism proof

Two independent offline builder runs, identical inputs:

| Artifact | Run 1 SHA | Run 2 SHA | Equal |
| --- | --- | --- | --- |
| `wallet_master_private.jsonl` | `BE5E81A3B13CC9197CF78C06E6C721FACFD3D109AAB9F11435A1AA2B9A2C73A0` | same | YES |
| Manifest output hash set | equal across runs | | YES |

Run 2 private detail dir:  
`...\SOL-WALLET-CLEAN-RANK-REPLAY-UNDER-REPAIR-003-RULES-001-rerun2\`

## Old vs current rules (strict builder)

### Old baseline (`wallet-intelligence-master-clean-rank-001`, DQ rule v1 era)

| Metric | Count |
| --- | --- |
| DQ-A | 1037 |
| DQ-B | 280 |
| DQ-C | 116 |
| DQ-D | 0 |
| DQ-U | 0 |
| alpha / candidate union | **17** |
| manualReviewRequired | 382 |

### Strict current builder (Repair-003 Alpha gates + fail-closed status parse)

Profiles from rerun-002 **do not carry a top-level `status` field**. Current builder fail-closes missing status to `UNAVAILABLE` + `invalid_gmgn_period_status` (2866 period rows).

| Metric | Count |
| --- | --- |
| DQ-A | 0 |
| DQ-B | 0 |
| DQ-C | 0 |
| DQ-D | 0 |
| DQ-U | **1433** |
| alphaCandidate | **0** |
| reviewPriority | **1433** |
| candidate union | **0** |
| insufficientData (status fail-closed) | **1433** |

Repair-003 Alpha predicate (unchanged, not relaxed):

- 7d and 30d each: `MAPPED` + `completeness === 1` + no `period_unverified` / `partial_fields`
- plus DQ-A/B, non-null 30d profit, non-null composite, not manual-review

### Gates (strict builder)

| Gate | Result |
| --- | --- |
| Alpha ∩ review = ∅ | PASS (0 ∩ 1433) |
| PARTIAL/UNAVAILABLE not in Alpha | PASS (Alpha empty) |
| Forbidden leak language claims | PASS |
| typecheck / tests / build | PASS |

## Derived semantic replay (analysis only — never invents MAPPED)

To answer product questions without relaxing Alpha, an offline analysis re-derives period status from profile warnings/completeness:

- usable metrics / positive completeness → **PARTIAL**
- network/expected-metrics unavailable → **UNAVAILABLE**
- **never MAPPED** (matches rerun-002 audit: MAPPED=0)

Then Repair-003 Alpha gates are applied unchanged. `wallet-data-quality-v3` also nulls borrowed composite when `period_unverified` is present (all usable GMGN rows).

| Layer | Count | Meaning |
| --- | --- | --- |
| **Alpha** | **0** | Must satisfy Repair-003; empty on this dataset |
| **Tier-B Research Candidate** | **1370** | PARTIAL allowed; always **unverified**; not Alpha |
| **Manual Review** | **63** | `manualReviewRequired` under recovered PARTIAL semantics |
| **Unavailable** | **0** | both periods UNAVAILABLE under derive (84 wallets have ≥1 UNAVAILABLE period; none both-only under this derive) |

Derived DQ distribution (capped by v3 partial/unverified rules): **DQ-C = 1433**.

Derived score distribution: composite **null for all 1433** (v3: `period_unverified` blocks borrowed lead scores).

### Field coverage (derived, wallet-level)

| Field | Coverage rate |
| --- | --- |
| realizedProfit 7d / 30d | 0.9979 / 0.9435 |
| winRate 7d / 30d | 0.9979 / 0.9435 |
| periodPnl 7d / 30d | 0 / 0 |
| tradeCount 7d / 30d | 0 / 0 |

### Warning histogram (profile-native; no invalid_status injection)

| Code | Count |
| --- | --- |
| `gmgn_wallet_stats_partial_fields` | 2782 |
| `gmgn_wallet_stats_period_unverified` | 2782 |
| `gmgn_expected_metrics_unavailable` | 77 |
| `gmgn_cli_network_unavailable` | 7 |

## Original candidate union 17 → new destinies

All 17 irreversible fingerprints remain **not Alpha**. None become Repair-003 Alpha.

| Union rank | Fingerprint (prefix) | Old DQ | New layer | New status 7d/30d |
| --- | --- | --- | --- | --- |
| 1 | `b0368d73…` | DQ-A | Tier-B Research | PARTIAL/PARTIAL |
| 2 | `9deefa80…` | DQ-A | Tier-B Research | PARTIAL/PARTIAL |
| 3 | `3fc29992…` | DQ-A | Tier-B Research | PARTIAL/PARTIAL |
| 4 | `c420a236…` | DQ-A | Manual Review | PARTIAL/PARTIAL |
| 5 | `64035b78…` | DQ-A | Tier-B Research | PARTIAL/PARTIAL |
| 6 | `fcc226ad…` | DQ-B | Manual Review | PARTIAL/PARTIAL |
| 7 | `80f6da6b…` | DQ-B | Manual Review | PARTIAL/PARTIAL |
| 8 | `08c847c2…` | DQ-B | Manual Review | PARTIAL/PARTIAL |
| 9 | `50e1e28f…` | DQ-B | Manual Review | PARTIAL/PARTIAL |
| 10 | `d4fb6b1f…` | DQ-B | Manual Review | PARTIAL/PARTIAL |
| 11 | `f785e19d…` | DQ-C | Manual Review | PARTIAL/PARTIAL |
| 12 | `253cfef4…` | DQ-B | Manual Review | PARTIAL/PARTIAL |
| 13 | `7f5bd70f…` | DQ-B | Tier-B Research | PARTIAL/PARTIAL |
| 14 | `5b380bc4…` | DQ-B | Tier-B Research | PARTIAL/PARTIAL |
| 15 | `1ec27b79…` | DQ-B | Tier-B Research | PARTIAL/PARTIAL |
| 16 | `dd678722…` | DQ-B | Tier-B Research | PARTIAL/PARTIAL |
| 17 | `46b6b831…` | DQ-C | Manual Review | PARTIAL/PARTIAL |

Full fingerprint list: `summary-desensitized.json` → `originalCandidateUnion17Destinies`.

**Summary:** 8 → Tier-B Research Candidate; 9 → Manual Review; 0 → Alpha; 0 remain as formal Alpha shortlist.

## Owner decisions unlocked by this replay

1. **Re-fetch 7d/30d?**  
   Not required solely to re-inflate Alpha under Repair-003. Current usable rows are PARTIAL with `partial_fields` + `period_unverified`; Alpha needs MAPPED + completeness=1 + no those warnings. Re-fetch only if a new parser/contract can produce true MAPPED rows.

2. **Which 3–5 wallets for on-chain ledger spot check?**  
   Prefer top Tier-B fingerprints by old composite (union ranks 1–3, optionally 5 and 13) — still **unverified** research picks, not confirmed Alpha.

3. **Keep old candidate union 17 as Tier-B review list?**  
   **Yes, recommended.** Treat the 17 fingerprints as a private Tier-B / Manual review list only. Do not brand as Alpha / smart money / confirmed.

## Product layer contract (must keep)

| Layer | Rule |
| --- | --- |
| Alpha | Repair-003 only; empty here |
| Tier-B Research Candidate | PARTIAL allowed; always unverified |
| Manual Review | DQ/anomaly manual flags |
| Unavailable | no usable period metrics |

## Offline gates

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS (389 pass / 1 skipped / 0 fail) |
| `npm run build` | PASS |
| `npm run harness:doctor` | GREEN (dirty-tree warning during dual-task delivery) |
| Input SHA match | PASS |
| Dual-run hash equality | PASS |
| Alpha/review disjoint | PASS |
| PARTIAL/UNAVAILABLE ∉ Alpha | PASS |
| Forbidden leak / language | PASS |

## Local-only full detail (not Git)

```text
C:\Users\10639\chainfm_out\sol\derived\SOL-WALLET-CLEAN-RANK-REPLAY-UNDER-REPAIR-003-RULES-001\
  wallet_master_private.csv|.jsonl
  wallet_identity_map.jsonl
  candidate_shortlist.csv|.json
  data_quality_summary.json
  ranking_summary.json
  warning_code_summary.json
  replay_manifest.json
  replay_analysis_desensitized.json
  candidate_union_17_destinies.json
```

## Git artifacts

- `harness/tasks/SOL-WALLET-CLEAN-RANK-REPLAY-UNDER-REPAIR-003-RULES-001.json`
- `harness/reports/SOL-WALLET-CLEAN-RANK-REPLAY-UNDER-REPAIR-003-RULES-001/acceptance.md`
- `harness/reports/SOL-WALLET-CLEAN-RANK-REPLAY-UNDER-REPAIR-003-RULES-001/summary-desensitized.json`
