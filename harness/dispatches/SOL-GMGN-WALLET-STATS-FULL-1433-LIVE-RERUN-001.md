# Dispatch: SOL-GMGN-WALLET-STATS-FULL-1433-LIVE-RERUN-001

- Role: Implementer
- HARNESS_AGENT_ID: `implementer-sol-gmgn-wallet-stats-full-1433-live-rerun-001`
- Baseline SHA: `5f257d9c35821128861631adf86503b24575ea87`
- Dependency: independently audited single-wallet 7d/30d live re-smoke GREEN.

Create and validate the task artifacts before code changes or live execution. Verify both approved external input hashes before any network call. Deterministically validate Solana Base58 plus strict 32-byte addresses and select exactly all 1,433 valid unique wallets in source order. Query only 7d and 30d GMGN stats, at most 20 wallets per invocation, exactly 72 planned invocations per period, maximum 144 total, strictly serial with at least 1,000ms between adjacent invocations. No retries, pagination, fallback, signed holdings, private-key reads, or other providers.

Write sanitized normalized output only under `C:/Users/10639/chainfm_out/sol/derived/gmgn-wallet-stats-full-1433-live-rerun-001/`. Git evidence must remain aggregate-only. Register the independent audit as BLOCKED_DEPENDENCY and do not mark the batch complete until that audit is GREEN.
