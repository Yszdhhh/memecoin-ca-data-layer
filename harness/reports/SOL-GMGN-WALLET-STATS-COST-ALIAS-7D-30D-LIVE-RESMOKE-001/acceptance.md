# Acceptance Report: SOL-GMGN-WALLET-STATS-COST-ALIAS-7D-30D-LIVE-RESMOKE-001

## Verdict

GREEN_WITH_ADVISORY — both bounded live paths are usable as PARTIAL borrowed GMGN observations; independent audit is required before any full batch.

## Execution evidence

- Baseline SHA: `1ebea19`
- Task activation SHA: `d7f8a5e`
- Runner delivery SHA: `916e2de`
- Run ID: `run-1785353319627`
- Input hash verification: both MATCH
- Target fingerprint: `5D4F995BAA762A0081532C9E1C434BB9BD26E07EFBD7B8C927AE3A9E423724B4`
- CLI invocation budget: 2 / 2
- Physical provider request upper bound: 2
- Execution: strictly serial, 7d then at least 1,000ms before 30d

## Sanitized outcomes

| Period | Status | Completeness | Blocking diagnostic | Warning codes |
|---|---:|---:|---|---|
| 7d | PARTIAL | 0.73 | none | `gmgn_wallet_stats_partial_fields`, `gmgn_wallet_stats_period_unverified` |
| 30d | PARTIAL | 0.82 | none | `gmgn_wallet_stats_partial_fields`, `gmgn_wallet_stats_period_unverified` |

Both periods contain explicit core profitability fields and parse without schema-unrecognized, alias-conflict, invalid-field-type, or period-mismatch diagnostics. Missing fields remain null. Provider-supplied zeros remain explicit zeros and are not treated as verified profitability.

## Output

Sanitized files were written only under:
`C:/Users/10639/chainfm_out/sol/derived/gmgn-wallet-stats-cost-alias-7d-30d-live-resmoke-001/`

No plaintext address, label, credential, proxy URL, raw provider payload, raw stdout/stderr, or complete exception is present in Git or the sanitized output.

## Offline verification

- live task validation: GREEN
- audit task validation: GREEN
- Harness Doctor: GREEN
- typecheck: PASS
- tests: 325 total, 324 passed, 1 skipped, 0 failed
- build: PASS
- git diff --check: PASS

## Boundary

Source is fixed to `gmgn` and verificationStatus to `unverified`. This result validates transport/authentication/parser usability for the sampled wallet only. It does not independently verify profitability and does not authorize a full batch until the separate zero-network audit is GREEN.
