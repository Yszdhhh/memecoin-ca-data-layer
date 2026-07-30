# Acceptance Report: SOL-GMGN-WALLET-STATS-CANONICAL-NUMERIC-STRING-7D-30D-LIVE-RESMOKE-001

## Verdict

**PARTIAL WITH BLOCKING 30D PARSER FINDING**

The bounded live transport completed exactly two serial GMGN stats invocations after both external input hashes matched and the API-key presence check passed. The canonical numeric-string repair improved 7d from unavailable to a safe partial record, but 30d remains unavailable because the parser detected an alias conflict. This task does not authorize batch expansion.

## Execution evidence

- Activation commit: `b293533cf3da283e646da87ed334a5329d30d344`
- Runner commit: `7f84c2fb25e7a325ddf9c1947c604742c3d5d5bb`
- Run ID: `run-1785352022375`
- Input hashes: MATCH
- Target fingerprint: `5D4F995BAA762A0081532C9E1C434BB9BD26E07EFBD7B8C927AE3A9E423724B4`
- API-key present: true (presence only)
- CLI invocation budget: 2 / 2
- Physical Provider request upper bound: 2
- Execution: 7d once, at least 1,000ms delay, then 30d once
- Source: `gmgn`
- Verification status: `unverified`

## Period outcomes

### 7d

- status: `PARTIAL`
- completeness: `0.73`
- diagnostic: `null`
- warning codes: `gmgn_wallet_stats_invalid_field_type, gmgn_wallet_stats_partial_fields, gmgn_wallet_stats_period_unverified`
- Sanitized record has explicit provider zeros for 8 of 11 metrics. Missing/invalid metrics remain null; no value was fabricated.

### 30d

- status: `UNAVAILABLE`
- completeness: `0`
- diagnostic: `gmgn_wallet_stats_alias_conflict`
- warning codes: `gmgn_wallet_stats_alias_conflict`

## Formal verification before live execution

- Task validation: GREEN
- Harness Doctor: GREEN, 0 errors, 0 warnings
- Typecheck: PASS
- Tests: 319 total, 318 passed, 1 skipped, 0 failed
- Build: PASS
- `git diff --check`: PASS

## Safety

No plaintext wallet address, label, API/private key, proxy URL, raw Provider payload, raw stdout/stderr, or complete exception was printed, persisted, or committed. No holdings, retry, pagination, fallback, Helius, or third-party provider was used.

## Blocking conclusion

The stats transport and authentication work, and canonical numeric strings are now accepted. However, the 7d invalid-field warning and 30d alias conflict require a new bounded safe schema diagnostic and a separate repair/audit before any 100/1,433-wallet run.
