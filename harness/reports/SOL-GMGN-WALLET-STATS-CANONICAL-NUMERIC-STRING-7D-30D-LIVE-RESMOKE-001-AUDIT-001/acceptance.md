# Independent Audit: SOL-GMGN-WALLET-STATS-CANONICAL-NUMERIC-STRING-7D-30D-LIVE-RESMOKE-001-AUDIT-001

## Final verdict

**GREEN_WITH_BLOCKING_FINDING**

The live task complied with its two-request budget, input-hash gate, serial execution, isolation, and privacy contract. Its evidence is trustworthy. The observed data result does **not** authorize a batch: 7d is PARTIAL and 30d is UNAVAILABLE.

## Audit identity and evidence

- HARNESS_AGENT_ID: `auditor-sol-gmgn-wallet-stats-canonical-numeric-string-7d-30d-live-resmoke-001`
- Live task activation: `b293533cf3da283e646da87ed334a5329d30d344`
- Runner commit: `7f84c2fb25e7a325ddf9c1947c604742c3d5d5bb`
- Live evidence commit: `ba9fde875846db942cc7670573bc2e83108393b9`
- Run ID: `run-1785352022375`
- Audit network/provider/CLI requests: 0

## Verified execution controls

- Both external input SHA-256 values matched before network.
- Exactly 2 of 2 CLI invocations were consumed: one 7d and one 30d.
- Calls were serial with the configured minimum 1,000ms delay.
- API-key-only isolation was used; no private key was forwarded.
- No retries, pagination, holdings, fallback, concurrency, Helius, or third-party provider were used.
- Git evidence and normalized external files contain no plaintext wallet, label, credential, proxy URL, raw payload, raw stderr/stdout, or complete exception.

## Result finding

- 7d: PARTIAL, completeness 0.73, with `gmgn_wallet_stats_invalid_field_type`, `gmgn_wallet_stats_partial_fields`, and `gmgn_wallet_stats_period_unverified`.
- 30d: UNAVAILABLE, completeness 0, with blocking `gmgn_wallet_stats_alias_conflict`.
- Canonical numeric-string normalization is demonstrably active because valid explicit zero metrics were mapped, but the remaining field/alias contract is not fully aligned with the current Provider response.

## Offline verification

- Audit task validation: GREEN
- Harness Doctor: GREEN, 0 errors, 0 warnings
- Typecheck: PASS
- Tests: 319 total, 318 passed, 1 skipped, 0 failed
- Build: PASS
- `git diff --check`: PASS

## Downstream decision

A new minimal safe field/alias-shape diagnostic is allowed under a separate exact task and budget. A 100-wallet or 1,433-wallet batch remains blocked until a repair, independent audit, and fresh 7d/30d live re-smoke both produce usable records without blocking schema diagnostics.
