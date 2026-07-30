# Independent Audit Acceptance: SOL-GMGN-WALLET-STATS-COST-ALIAS-7D-30D-LIVE-RESMOKE-001-AUDIT-001

## Final verdict

**GREEN**

The bounded 7d and 30d live re-smoke is accepted as a safe, usable **PARTIAL** GMGN observation for both periods. This verdict unlocks creation of a separately specified full 1,433-wallet rerun under the exact batching, budget, sanitization, and independent-audit controls stated below.

## Identity and evidence chain

- Auditor HARNESS_AGENT_ID: `auditor-sol-gmgn-wallet-stats-cost-alias-7d-30d-live-resmoke-001`
- Repair audit baseline SHA: `1ebea19`
- Live task activation SHA: `d7f8a5e`
- Runner delivery SHA: `916e2de`
- Audited live delivery SHA: `975359f865f5ae83abbe7e22417a5e2813c75caa`
- Run ID: `run-1785353319627`
- Target fingerprint: `5D4F995BAA762A0081532C9E1C434BB9BD26E07EFBD7B8C927AE3A9E423724B4`

## Independent findings

1. Both required external input SHA-256 values matched the approved manifest before the live run.
2. The live runner used exactly 2 of 2 permitted GMGN CLI invocations: one 7d invocation followed serially by one 30d invocation with at least 1,000 ms separation.
3. The physical provider request upper bound was 2. No retry, fallback, pagination, concurrency, Helius, signed holdings, or third-party provider path was used.
4. The 7d result is `PARTIAL` with completeness `0.73`; the 30d result is `PARTIAL` with completeness `0.82`.
5. Both periods contain explicit core profitability fields. Missing fields remain null, while provider-supplied numeric zeros remain explicit zeros.
6. Neither period emitted a blocking schema, alias, type, or period diagnostic. The only warnings were `gmgn_wallet_stats_partial_fields` and `gmgn_wallet_stats_period_unverified`.
7. Output semantics remain fixed to `source: "gmgn"` and `verificationStatus: "unverified"`. The observations are not chain-verified profitability facts and do not create wallet grades or LLM conclusions.
8. The sanitized output and Git evidence contain no plaintext wallet address or label, credential, private key, proxy URL, raw provider payload, raw stdout/stderr, credential URL, or complete exception.

## Audited outcome table

| Period | Live/parser status | Completeness | Blocking diagnostic | Allowlisted warnings |
|---|---|---:|---|---|
| 7d | PARTIAL | 0.73 | none | `gmgn_wallet_stats_partial_fields`, `gmgn_wallet_stats_period_unverified` |
| 30d | PARTIAL | 0.82 | none | `gmgn_wallet_stats_partial_fields`, `gmgn_wallet_stats_period_unverified` |

## Zero-network audit verification

The independent audit itself issued:

- network requests: 0
- provider requests: 0
- GMGN CLI invocations: 0
- credential reads: 0
- real-address processing: 0

Clean-tree verification passed:

- audit task validation: GREEN
- Harness Doctor: GREEN
- typecheck: PASS
- tests: 325 total, 324 passed, 1 skipped, 0 failed
- build: PASS
- git diff --check: PASS

## Downstream authorization and limits

A new full rerun task may now be created for exactly 1,433 valid unique Solana addresses, subject to all of the following:

- periods are only 7d and 30d;
- at most 20 wallets per CLI invocation;
- exactly 72 planned invocations per period and at most 144 total CLI/provider invocations;
- strictly serial execution with at least 1,000 ms between adjacent invocations;
- zero retries, fallback, pagination expansion, signed holdings, Helius, other providers, background loops, or production writes;
- fail closed with zero network calls on either input-hash mismatch;
- PARK if `GMGN_API_KEY` is absent, checking presence only;
- `GMGN_PRIVATE_KEY` must not be read or forwarded;
- output must be written to a new external directory and must not overwrite historical invalid 100-wallet or 1,433-wallet outputs;
- Git acceptance evidence may contain only aggregate counts, coverage, budgets, allowlisted codes, approved hashes, selection rules, and irreversible fingerprints;
- the full rerun remains incomplete until a separate zero-network independent audit returns GREEN.

Historical 100-wallet and 1,433-wallet runs remain invalid and are not reinterpreted by this verdict.
