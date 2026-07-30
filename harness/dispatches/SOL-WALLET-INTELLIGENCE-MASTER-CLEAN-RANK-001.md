# Dispatch Brief: SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-001

## Task Summary
- **Task ID**: SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-001
- **Role**: Implementer / Internal Coordinator
- **Tier**: T2
- **Layer**: Cold Path
- **Objective**: Pure offline cleaning, merging, quality evaluation, anomaly identification, and candidate tiering on 1,433 Solana wallets with GMGN 7d/30d normalized stats, address order, labels, and notes.

## Inputs
- `C:\Users\10639\chainfm_out\sol\sol_addresses.txt` (SHA-256: 64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C)
- `C:\Users\10639\chainfm_out\sol\sol_address_labels.json` (SHA-256: B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3)
- `C:\Users\10639\chainfm_out\sol\derived\gmgn-wallet-stats-full-1433-live-rerun-002\normalized_wallet_profiles.json`
- `C:\Users\10639\chainfm_out\sol\derived\gmgn-wallet-stats-full-1433-live-rerun-002\summary.json`

## Outputs
Target Output Directory: `C:\Users\10639\chainfm_out\sol\derived\wallet-intelligence-master-clean-rank-001\`
Required Output Files:
1. `wallet_master_private.csv`
2. `wallet_master_private.jsonl`
3. `wallet_identity_map.jsonl`
4. `candidate_shortlist.csv`
5. `candidate_shortlist.json`
6. `data_quality_summary.json`
7. `ranking_summary.json`
8. `warning_code_summary.json`
9. `data_dictionary.md`
10. `replay_manifest.json`

## Boundaries & Constraints
- Pure offline: 0 network requests, 0 provider requests, 0 CLI invocations, 0 credential reads.
- Never promote GMGN borrowed stats into verified chain PnL or formal Alpha Tiers.
- Plaintext addresses and labels must NOT appear in git artifacts or harness acceptance reports.
