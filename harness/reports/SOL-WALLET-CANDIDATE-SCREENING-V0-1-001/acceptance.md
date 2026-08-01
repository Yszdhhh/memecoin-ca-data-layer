# Acceptance Report: SOL-WALLET-CANDIDATE-SCREENING-V0-1-001

## Verdict

**IMPLEMENTER SUCCESS (pending independent audit).** Private address detail remains outside Git.

## Scope boundary (code inventory)

### Reused as-is
- `normalizeSolanaAddress`, fingerprint/SHA helpers from `master-table-builder.ts`
- `evaluateWalletDataQuality` rule engine (`wallet-data-quality-v3`)
- Fixed 1,433 address + label hashes from RERUN-002 / CLEAN-RANK
- Local GMGN RERUN-002 normalized profiles (offline only)

### Small modifications
- `calculateBorrowedCandidateScores`: `period_unverified` no longer nulls lead scores; small-sample penalty explicit; quality factor floor 0.25
- `resolveGmgnConfidenceCap` added
- RERUN-002 status field omission handled via derived PARTIAL/UNAVAILABLE

### Not implemented (by design / out of scope)
- Formal Alpha Score / UR·SSR·S·EX grades
- Chain-verified PnL, funding clusters, bot confirmation
- Operator Console / BSC / Robinhood / liquidity
- Live GMGN re-fetch or note write-back
- Per-token concentration HHI

## Input hashes (verified at run)

| Input | SHA-256 |
| --- | --- |
| sol_addresses.txt | `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C` |
| sol_address_labels.json | `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3` |
| gmgn normalized_wallet_profiles.json | `F461061BB7B747D512DF2193D46E0DE02DEA50A86C661E9F8234B6E8F8737EE6` |
| gmgn summary.json | `55DFAB261C1BEADBDD2E16574BB569DC69076463A97A46360F041EDC1024263D` |
| **address set hash** (ordered unique join) | `A6FF9CCCC5384CA2AABBA9AC904A101BDF8585B7D2F847CFC104FF6438F07049` |

## Real run metrics (desensitized)

| Metric | Value |
| --- | ---: |
| Master rows (unique addresses) | 1433 |
| Unique candidates | 32 |
| Research packs | 15 |
| Categories represented | 8 |
| TIER_PARTIAL | 1349 |
| TIER_SPARSE | 84 |
| DQ-C (period_unverified cap) | 1433 |
| gmgn_lead_score non-null | 1352 |

### Group pool sizes (pre-union)

| Category | Pool size |
| --- | ---: |
| A_ACTIVE_HIGH_PROFIT_LEAD | 12 |
| B_HIGH_WINRATE_ADEQUATE_SAMPLE | 10 |
| C_LOW_WINRATE_HIGH_PROFIT_LEAD | 8 |
| D_RECENT_OUTPERFORMANCE | 8 |
| E_HISTORICAL_STRONG_RECENT_DECAY | 8 |
| F_HIGH_FREQ_OR_ANOMALY_SUSPICIOUS | 8 |
| G_LABEL_STAT_CONFLICT | 8 |
| H_INSUFFICIENT_DATA_HIGH_INTEL | 8 |

### Union membership (unique address may multi-label)

| Category | Members in union |
| --- | ---: |
| A_ACTIVE_HIGH_PROFIT_LEAD | 12 |
| B_HIGH_WINRATE_ADEQUATE_SAMPLE | 10 |
| C_LOW_WINRATE_HIGH_PROFIT_LEAD | 4 |
| D_RECENT_OUTPERFORMANCE | 3 |
| E_HISTORICAL_STRONG_RECENT_DECAY | 6 |
| F_HIGH_FREQ_OR_ANOMALY_SUSPICIOUS | 4 |
| G_LABEL_STAT_CONFLICT | 2 |
| H_INSUFFICIENT_DATA_HIGH_INTEL | 2 |

### recommended_next_action distribution (union)

| Action | Count |
| --- | ---: |
| CHAIN_VERIFICATION | 18 |
| DORMANT_MONITOR | 5 |
| EXCLUDE_FROM_FOLLOWING | 4 |
| GMGN_HISTORY_REVIEW | 2 |
| INSUFFICIENT_DATA | 2 |
| HUMAN_REVIEW | 1 |

## Policy checks

| Check | Result |
| --- | --- |
| Missing fields not silent-filled | PASS |
| existing labels not upgraded to confirmed_* | PASS (always null) |
| GMGN source_type=borrowed / verification_status=unverified | PASS |
| alpha_score / final_wallet_score / final_wallet_grade null | PASS |
| Candidate list non-empty in 30–50 | PASS (32) |
| ≥6 categories | PASS (8) |
| No BUY/SELL/COPY_TRADE actions | PASS |
| Private master not in Git | PASS (local chainfm_out only) |
| Over-implementation | NONE |

## Commands

```bash
# Real offline run (local paths)
npx tsx src/cli/run-sol-wallet-candidate-screening-v0-1.ts

# Gates
npm run typecheck
npm test
npm run build
```

Private outputs (local only):
`chainfm_out/sol/derived/wallet_intelligence_v0_1/`

Desensitized repo copies:
`artifacts/wallet_intelligence_v0_1/`

## Independent audit

**Not completed.** Requires separate auditor task. Do not merge until audit GREEN.

## Merge status

Feature branch only — not merged to main.
