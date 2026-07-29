# Acceptance Report: SOL-GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-7D-30D-LIVE-RESMOKE-002-AUDIT-001

- **HARNESS_AGENT_ID:** `auditor-sol-gmgn-wallet-stats-documented-composite-live-resmoke-002`
- **Audited activation SHA:** `e55454c`
- **Audited execution evidence SHA:** `5fcde56`
- **Provider/CLI requests during audit:** 0
- **Final verdict:** **GREEN_WITH_BLOCKING_FINDING**

## Verification

- Sanitized external summary exists and matches the implementer acceptance: input hashes matched, API-key presence was true, and exactly 2/2 CLI invocations were consumed.
- Both 7d and 30d reached parser evaluation and returned `UNAVAILABLE` with `gmgn_expected_metrics_unavailable` plus `gmgn_wallet_stats_invalid_field_type`.
- No transport, proxy, DNS, authentication, rate-limit, or composite-envelope diagnostic occurred.
- External files contain normalized fields/safe codes only and do not contain credential-variable names, proxy-variable names, raw payload markers, stdout, or stderr.
- The run correctly did not claim mapped data and did not authorize a batch.

## Verdict boundary

The execution and privacy controls pass, but the live data path remains blocked by provider value encoding versus parser numeric typing. This audit authorizes only a one-request sanitized value-shape diagnostic and subsequent offline parser repair. It does not authorize 100-wallet or 1,433-wallet fetching.
