# Dispatch: SOL-GMGN-WALLET-STATS-CANONICAL-NUMERIC-STRING-7D-30D-LIVE-RESMOKE-001

- Role: Implementer
- HARNESS_AGENT_ID: `implementer-sol-gmgn-wallet-stats-canonical-numeric-string-7d-30d-live-resmoke-001`
- Branch: `codex/solana-daily-new-token-analysis`
- Budget: exactly at most 2 GMGN CLI invocations / 2 physical Provider requests.

## Assignment

1. Before any network request, verify both required external input SHA-256 values exactly.
2. Select the first valid unique Base58/32-byte Solana wallet in memory; never print or persist it.
3. Check only whether `GMGN_API_KEY` is present. Never read or forward `GMGN_PRIVATE_KEY`.
4. Execute 7d once, wait at least 1,000ms, then execute 30d once. No retry, pagination, holdings, fallback, or concurrency.
5. Parse using the audited canonical numeric-string repair. Persist only sanitized normalized output in the manifest output directory.
6. If either path is unavailable, retain safe allowlisted diagnostics and do not expand into a batch.
7. After execution, complete evidence and register the independent audit as READY. The implementer must not perform the audit.
