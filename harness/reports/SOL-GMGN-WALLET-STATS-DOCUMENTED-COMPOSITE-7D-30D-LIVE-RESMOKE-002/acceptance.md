# Acceptance Report: SOL-GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-7D-30D-LIVE-RESMOKE-002

- **HARNESS_AGENT_ID:** `implementer-sol-gmgn-wallet-stats-documented-composite-live-resmoke-002`
- **Activation SHA:** `e55454c`
- **Run ID:** `run-1785350790878`
- **Execution status:** **UNAVAILABLE**

## Controlled execution

- Input hashes: MATCH for both allowlisted external input files.
- API key presence: true; value not read or recorded.
- CLI invocation budget: 2 / 2.
- Provider request upper bound: 2.
- Order: 7d then 30d, serial, with the runner-enforced minimum 1,000ms delay.
- No retry, pagination, holdings, fallback, Helius, database, queue, cache, or production write.

## Results

| Period | Live status | Parser status | Completeness | Safe warnings | Safe diagnostic |
|---|---|---|---:|---|---|
| 7d | UNAVAILABLE | UNAVAILABLE | 0 | gmgn_expected_metrics_unavailable; gmgn_wallet_stats_invalid_field_type | gmgn_expected_metrics_unavailable |
| 30d | UNAVAILABLE | UNAVAILABLE | 0 | gmgn_expected_metrics_unavailable; gmgn_wallet_stats_invalid_field_type | gmgn_expected_metrics_unavailable |

The proxy, DNS, authentication, and composite-envelope failure codes did not recur. Both requests reached the parser, but all expected core metrics were rejected because one or more known aliases used provider value encodings not accepted by the current strict numeric contract. This task does not authorize a batch run.

## Sanitized outputs

External directory: `C:/Users/10639/chainfm_out/sol/derived/gmgn-wallet-stats-documented-composite-7d-30d-live-resmoke-002/`

Files: `stats_7d.json`, `stats_30d.json`, `summary.json`. They contain normalized fields and safe codes only; no plaintext address, label, credential, proxy URL, raw payload, stdout/stderr, or complete exception.

## Verdict

**GREEN_WITH_BLOCKING_FINDING** for bounded execution safety; **LIVE DATA PATH NOT RECOVERED**. A new narrow schema-encoding diagnostic/repair is required before another re-smoke or any batch run.
