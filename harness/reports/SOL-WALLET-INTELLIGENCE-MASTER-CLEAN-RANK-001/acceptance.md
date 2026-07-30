# Acceptance Report: SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-001

## Status
GREEN

## Task Metadata
- **Task ID**: SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-001
- **Tier**: T2
- **Role**: Implementer / Internal Coordinator
- **Chain**: Solana
- **Layer**: Cold Path
- **Rule Version**: `wallet-data-quality-v1`

## Input File Evidence & SHA-256 Hashes
| Input File | Expected SHA-256 | Actual SHA-256 | Verification |
| --- | --- | --- | --- |
| `sol_addresses.txt` | `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C` | `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C` | MATCH |
| `sol_address_labels.json` | `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3` | `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3` | MATCH |
| `normalized_wallet_profiles.json` | `F461061BB7B747D512DF2193D46E0DE02DEA50A86C661E9F8234B6E8F8737EE6` | `F461061BB7B747D512DF2193D46E0DE02DEA50A86C661E9F8234B6E8F8737EE6` | MATCH |
| `summary.json` | `55DFAB261C1BEADBDD2E16574BB569DC69076463A97A46360F041EDC1024263D` | `55DFAB261C1BEADBDD2E16574BB569DC69076463A97A46360F041EDC1024263D` | MATCH |

## Processing & Association Metrics
- **Total Input Addresses**: 1,433
- **Valid Unique Solana Wallets**: 1,433
- **7d GMGN Profile Matches**: 1,433
- **30d GMGN Profile Matches**: 1,433
- **Pair Coverage**: 100% (1,433 / 1,433 wallets matched both 7d & 30d profiles)

## Data Quality Tier Distribution
- **DQ-A (Score 80-100)**: 1,037 wallets (72.37%)
- **DQ-B (Score 65-79.9)**: 280 wallets (19.54%)
- **DQ-C (Score 50-64.9)**: 116 wallets (8.09%)
- **DQ-D (Score 1-49.9)**: 0 wallets (0.00%)
- **DQ-U (Score 0 / Unavailable)**: 0 wallets (0.00%)
- **Average Data Quality Score**: 84.51 / 100
- **Average Internal Consistency Score**: 89.66 / 100

## 30d Realized Profit Aggregate Counts
- **Positive Profit (> $0)**: 651 wallets
- **Zero Profit ($0)**: 701 wallets
- **Negative Profit (< $0)**: 81 wallets

## Warning & Anomaly Code Aggregations
- `gmgn_wallet_stats_partial_fields`: 2,782 occurrences
- `gmgn_wallet_stats_period_unverified`: 2,782 occurrences
- `gmgn_expected_metrics_unavailable`: 77 occurrences
- `gmgn_cli_network_unavailable`: 7 occurrences

## Candidate Shortlist Groups & Union
| Group Name | Count | Group Description |
| --- | --- | --- |
| `raw_gmgn_profit_top5` | 5 | Top 5 by GMGN 30d realized profit (unfiltered) |
| `quality_adjusted_top5` | 5 | Top 5 by composite lead score balancing profit, activity & quality |
| `active_consistent_top5` | 5 | Top 5 active traders with high 7d/30d consistency |
| `high_win_rate_review_top5` | 5 | Top 5 win rate (sample size >= 5 trades) |
| `anomaly_verification_top5` | 5 | Top 5 profit with accounting residual / anomaly flags |
| `label_priority_top5` | 5 | Top 5 with existing labels & notes |
| **`candidate_union`** | **17** | **Deduplicated candidate union across all groups (<= 20)** |

## Top Candidate Irreversible Fingerprints
1. `b0368d733d9e0a590f9b668744c1e8415d1911ef432e870675ee588b4b032b37` (Union Rank: 1, DQ: DQ-A, Composite Lead Score: 87.03)
2. `9deefa80375023e7dd7ef901d0aca82b2680a87b064e51e27f4013d1d2365faa` (Union Rank: 2, DQ: DQ-A, Composite Lead Score: 82.35)
3. `3fc2999201f0bb0df09fb010d866aa1d5a1ae46d0009a060e77715b5637a5645` (Union Rank: 3, DQ: DQ-A, Composite Lead Score: 81.20)
4. `c420a2367d7d7ababf0cb70858359652eaebb3f05e34299438ccc5204a445cc3` (Union Rank: 4, DQ: DQ-A, Composite Lead Score: 80.70)
5. `64035b787e491189df24d724afffa8bfbf862cb23024ef44f1f88945d5db79e3` (Union Rank: 5, DQ: DQ-A, Composite Lead Score: 78.16)
6. `fcc226ada9093411e13736b81329379101c806a71823110df3a2cb26352d0f1e` (Union Rank: 6, DQ: DQ-B, Composite Lead Score: 75.21)
7. `80f6da6bfeac825f2fb8f55717c02cf4aa5b2e1c132b5a448b4bd169686c854c` (Union Rank: 7, DQ: DQ-B, Composite Lead Score: 73.68)
8. `08c847c247b686bd3e5224af10d8e26344e0dbb5ed218b02dec08b1d5ce50e7b` (Union Rank: 8, DQ: DQ-B, Composite Lead Score: 69.34)
9. `50e1e28f1932d7067f67ee3145cc0d8d6807ab71144907c3fe5306655c6a7157` (Union Rank: 9, DQ: DQ-B, Composite Lead Score: 60.85)
10. `d4fb6b1f86e38a13392f702db0a467e2fd3b7b9cae7bccfb42d6750f96f208db` (Union Rank: 10, DQ: DQ-B, Composite Lead Score: 54.29)
11. `f785e19d074a5c49ce2177a150212ec7f2fae2e74d037a5ce7b74551917a6f0a` (Union Rank: 11, DQ: DQ-C, Composite Lead Score: 52.37)
12. `253cfef4c5905eb317a86d7214fdab02e11988a7c4c347879053e59bfbe86a80` (Union Rank: 12, DQ: DQ-B, Composite Lead Score: 50.02)
13. `7f5bd70f2b0610687e9089662a255ed96f841cebb30ce27ddd90698df7c2290b` (Union Rank: 13, DQ: DQ-B, Composite Lead Score: 41.28)
14. `5b380bc4055ffe4f20533daa91d873a027dd33db4b75a59818dd4b2c0a67667a` (Union Rank: 14, DQ: DQ-B, Composite Lead Score: 41.02)
15. `1ec27b79741ee872c2944610f02670dd0cab74b4bd67e0d99b8d7f0a76b630f7` (Union Rank: 15, DQ: DQ-B, Composite Lead Score: 39.88)
16. `dd678722d3191ea99416522efa3908789968ed9c7b0840b53e0d406f54d7482d` (Union Rank: 16, DQ: DQ-B, Composite Lead Score: 37.67)
17. `46b6b83146815900f016b0079af83c1b4e6d1bacc0ea074d0921a5d2dd4a65b7` (Union Rank: 17, DQ: DQ-C, Composite Lead Score: 36.77)

## Output Files & SHA-256 Hashes
Target Output Directory: `C:\Users\10639\chainfm_out\sol\derived\wallet-intelligence-master-clean-rank-001\`

| Output File Name | SHA-256 Hash |
| --- | --- |
| `wallet_master_private.csv` | `40A397AB52BC7F4614D5F74EF850B90475050F8D15CD9320A872ACBF87E2455B` |
| `wallet_master_private.jsonl` | `BD4576195DDD61DF31C31D475E823A5E67DE763BE10B29492AE96BF5B193041A` |
| `wallet_identity_map.jsonl` | `EE9E688969BEC0B5ADA3B50987225D6FBD43751219136AC9904FDE773CF40AE4` |
| `candidate_shortlist.csv` | `60FD0A30354B4ACA7B56FAB498AADC61DC2BA3B44EC1005E1DC31A4367C6B445` |
| `candidate_shortlist.json` | `2E7CF4371983B6F10822A9D192F669A9E6DEA34D021A666159CA03C4742A011D` |
| `data_quality_summary.json` | `436F41C831F2AE25EBBD5E4D853772388EE39D93E6D7BA412319E75BC9D1440F` |
| `ranking_summary.json` | `712AA8E22B982BF4E2EA32CF0C4E46042198C2FF81ABCEA94024C27DF34BF22D` |
| `warning_code_summary.json` | `F9238DD32EF7B2BD8BB091EA8535AA24DEAFBB7E33D9300C857C09914DE457F1` |
| `data_dictionary.md` | `7880C4BBEE216D0953974FE1D4F463DC03B167B209288441F41FC868B7B6F955` |
| `replay_manifest.json` | `D1FA3F80894DC907FB4AC4C670FB2FE33BD6867727142EEBFEEA8C55BCF0FEE2` |

## Resource & Network Boundary Verification
- **network_requests**: 0
- **provider_requests**: 0
- **gmgn_cli_invocations**: 0
- **helius_requests**: 0
- **credential_reads**: 0

## Acceptance Test Results
- `npm run harness:task -- validate harness/tasks/SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-001.json`: PASSED
- `npm run harness:task -- validate harness/tasks/SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-AUDIT-001.json`: PASSED
- `npm run harness:doctor`: PASSED (GREEN)
- `npm run typecheck`: PASSED
- `npm test`: PASSED (342/342 tests pass)
- `npm run build`: PASSED
- `git diff --check`: PASSED

## Strict Data & Security Boundary Statement
This task ran completely offline with zero network requests or credential access. All GMGN 7d/30d metrics are marked as `borrowed / unverified` and are used exclusively for candidate screening and quality assessment. No formal Alpha Tiers (UR/SSR/SR/R/N), verified chain PnL, or confirmed smart money labels were produced or persisted in repository files. Plaintext wallet addresses, labels, and original notes exist strictly in the controlled external output directory (`C:\Users\10639\chainfm_out\sol\derived\wallet-intelligence-master-clean-rank-001\`) for private Owner review and are strictly excluded from Git commits, logs, and Harness reports.
