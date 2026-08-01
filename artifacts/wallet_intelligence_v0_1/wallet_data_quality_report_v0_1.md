# Wallet Data Quality Report v0.1

Task: `SOL-WALLET-CANDIDATE-SCREENING-V0-1-001`

## Totals
- Addresses: **1433** (unique)
- Address set hash: `A6FF9CCCC5384CA2AABBA9AC904A101BDF8585B7D2F847CFC104FF6438F07049`
- Input sol_addresses.txt: `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C`
- Input labels: `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3`
- GMGN profiles: `F461061BB7B747D512DF2193D46E0DE02DEA50A86C661E9F8234B6E8F8737EE6`

## Data tiers
- TIER_COMPLETE: 0
- TIER_PARTIAL: 1349
- TIER_SPARSE: 84
- TIER_MISSING: 0

## Data quality tiers (wallet-data-quality rule)
- DQ-A: 0
- DQ-B: 0
- DQ-C: 1433
- DQ-D: 0
- DQ-U: 0

## Activity tiers
- ACTIVE_7D: 412
- ACTIVE_30D_ONLY: 310
- INACTIVE: 711
- UNKNOWN: 0

## Candidate summary
- Unique candidates: **32** (target 30–50)
- Categories represented: **8**
  - A_ACTIVE_HIGH_PROFIT_LEAD: 12
  - B_HIGH_WINRATE_ADEQUATE_SAMPLE: 10
  - C_LOW_WINRATE_HIGH_PROFIT_LEAD: 8
  - D_RECENT_OUTPERFORMANCE: 8
  - E_HISTORICAL_STRONG_RECENT_DECAY: 8
  - F_HIGH_FREQ_OR_ANOMALY_SUSPICIOUS: 8
  - G_LABEL_STAT_CONFLICT: 8
  - H_INSUFFICIENT_DATA_HIGH_INTEL: 8
- Research packs: **15**

## Policies
- Missing → null (never silent 0-fill)
- GMGN → source_type=borrowed, verification_status=unverified
- period_unverified → confidence_cap low/medium; lead scores retained for screening only
- alpha_score / final_wallet_score / final_wallet_grade / confirmed_behavior_labels → always null
- existing labels stay source_claim only
