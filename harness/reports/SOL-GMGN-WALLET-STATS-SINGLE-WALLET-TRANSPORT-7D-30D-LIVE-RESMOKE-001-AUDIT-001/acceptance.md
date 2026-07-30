# Independent Audit: SOL-GMGN-WALLET-STATS-SINGLE-WALLET-TRANSPORT-7D-30D-LIVE-RESMOKE-001-AUDIT-001

## Verdict

**GREEN**

## Audit identity and boundaries

- HARNESS_AGENT_ID: `auditor-sol-gmgn-wallet-stats-single-wallet-transport-7d-30d-live-resmoke-001`
- Live implementation activation: `177eac1`
- Live execution delivery: `ff8a5a0`
- Audit mode: zero network, zero provider requests, zero credential reads, zero real-address processing

## Evidence verified

- Approved input hashes were reported MATCH before provider access.
- Exactly 2 valid unique targets were selected and represented only by irreversible fingerprints.
- Exactly 4 CLI/provider invocations were consumed: one wallet per invocation across 7d and 30d.
- Execution was strictly serial with at least 1,000ms spacing.
- All 4 wallet-period observations were identity-bound and parseable: 0 MAPPED, 4 PARTIAL, 0 UNAVAILABLE.
- External normalized files contain only allowlisted normalized keys; no plaintext address, label, credential, proxy URL, raw provider payload, raw stdout/stderr, or complete exception is present.
- All records preserve `source: "gmgn"` and `verificationStatus: "unverified"`.
- Missing values remain null; provider-returned values are not promoted to verified profitability.

## Data-quality observations

- Field coverage is sufficient for bounded transport recovery: realizedProfit, realizedProfitPnl, winRate, buyCount, sellCount, boughtCost, soldIncome, and tokenNum were present in all four observations.
- periodPnl and tradeCount were absent in all four and remain null.
- lastActiveTimestamp coverage was 25%.
- Allowlisted warnings were `gmgn_wallet_stats_partial_fields` (4) and `gmgn_wallet_stats_period_unverified` (4).

## Resource counters

- network_requests: 0 (audit)
- provider_requests: 0 (audit)
- gmgn_cli_invocations: 0 (audit)
- credential_reads: 0
- real_address_processing: 0

## Authorization

The one-wallet-per-invocation 7d/30d transport is recovered for bounded use. This GREEN verdict authorizes creation and execution of a corrected full 1,433-wallet rerun task with exactly 2,866 strictly serial single-wallet invocations, a new non-overwriting output directory, fixed fail-closed budget, and independent zero-network audit. It does not authorize signed holdings or cumulative pagination.
