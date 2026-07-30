# Independent Audit: SOL-GMGN-WALLET-STATS-FULL-1433-LIVE-RERUN-002-AUDIT-001

## Audit identity and scope

- HARNESS_AGENT_ID: `auditor-sol-gmgn-wallet-stats-full-1433-live-rerun-002`
- Role: independent zero-network auditor
- Audited implementation/run evidence SHA: `168ad85a81cd1a9658a7f6542e862e3aac079157`
- Branch: `codex/solana-daily-new-token-analysis`
- Provider/network requests: 0
- GMGN CLI invocations: 0
- Credential reads: 0
- Plaintext address or label processing: 0

## Final verdict

**GREEN WITH DATA-QUALITY ADVISORIES.** The corrected full 1,433-wallet fetch is complete under its bounded task contract. This verdict confirms execution integrity, output hygiene, cardinality, and provenance; it does not upgrade GMGN observations beyond borrowed, unverified data and does not claim every provider response contained usable profitability metrics.

## Verified execution contract

- Approved input hashes are recorded as matching before the live run.
- Deterministic selection count: **1,433** valid unique strict-32-byte Solana wallets.
- Transport cardinality: exactly **one wallet per CLI invocation**.
- Periods: **7d** and **30d** only.
- Invocation/provider upper bound and actual use: **2,866 / 2,866**.
- Period distribution: **1,433 7d records + 1,433 30d records**.
- Ordering: strict serial execution with at least 1,000ms between adjacent invocations; no retry, concurrency, pagination, fallback, or auto-fill.
- Unique irreversible source fingerprints: **1,433**, each appearing exactly twice, once per period.
- The versioned output directory is `gmgn-wallet-stats-full-1433-live-rerun-002`; historical rerun-001 and earlier outputs were not overwritten.

## Output and privacy audit

- Normalized record count: **2,866**.
- Every record has exactly the allowlisted top-level fields and exactly the 11 allowlisted aggregate fields.
- Schema violations found: **0**.
- All 2,866 records retain `source: "gmgn"` and `verificationStatus: "unverified"`.
- Missing metrics remain `null`; explicit provider zeros remain numbers and are not reinterpreted.
- No plaintext wallet address, label, credential, private key, proxy URL, raw provider payload, raw stdout/stderr, token/transaction identifier, counterparty, or complete exception is present in the normalized output or Git acceptance evidence.

## Outcome and field-quality evidence

- MAPPED: **0**
- PARTIAL: **2,782**
- UNAVAILABLE: **84**
- Usable identity-bound observations: **2,782 / 2,866 (97.07%)**.
- Average completeness: **0.7449**.
- Field coverage: realizedProfit, realizedProfitPnl, winRate, buyCount, sellCount, boughtCost, soldIncome, and tokenNum each **97.07%**; lastActiveTimestamp **40.33%**; periodPnl and tradeCount **0%**.
- Allowlisted warning counts:
  - `gmgn_wallet_stats_partial_fields`: 2,782
  - `gmgn_wallet_stats_period_unverified`: 2,782
  - `gmgn_cli_network_unavailable`: 7
  - `gmgn_expected_metrics_unavailable`: 77

## Advisories and downstream interpretation

1. The 2,782 usable records remain PARTIAL because GMGN omitted periodPnl and tradeCount and did not echo an explicit period attestation in the response body. The requested period is transport-bound but not provider-body-verified.
2. Seven observations encountered safely classified network unavailability. The no-retry contract intentionally preserved those gaps rather than silently retrying.
3. Seventy-seven observations lacked the minimum expected profitability metrics and remain UNAVAILABLE; no zero values were fabricated.
4. This dataset is suitable as a sanitized borrowed GMGN stats dataset with explicit completeness and warning metadata. It is not chain-confirmed profitability, cumulative/all-time PnL, wallet quality grading, UR/N/P classification, or an LLM conclusion.

## Offline verification

- Audit task validation: GREEN.
- Harness Doctor: GREEN with 0 errors and 0 warnings before audit evidence writing.
- Sanitized external-output audit: PASS (2,866 records, 1,433 two-period fingerprints, exact period/budget/source semantics, zero schema violations).
- Full repository typecheck, test, build, and `git diff --check` are required again on the clean audit delivery commit.

## Completion decision

The task `SOL-GMGN-WALLET-STATS-FULL-1433-LIVE-RERUN-002` is accepted as completed. No additional 100-wallet or 1,433-wallet rerun is required solely for transport/cardinality repair. Any attempt to fill the 84 unavailable observations must be a separate, explicitly budgeted retry task and must not overwrite this immutable 002 result.
