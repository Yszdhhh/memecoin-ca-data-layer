# Dispatch: SOL-GMGN-WALLET-STATS-BATCH-CARDINALITY-LIVE-DIAGNOSTIC-001

- Role: Implementer
- HARNESS_AGENT_ID: `implementer-sol-gmgn-wallet-stats-batch-cardinality-live-diagnostic-001`
- Baseline SHA: `22b6a7c6e0c0219b8a7fa31f8755d496b85bbaef`
- Dependency: audited single-wallet 7d/30d live re-smoke GREEN; prior full rerun is PARKED_DATA_QUALITY.

Create and validate these task artifacts before code changes or live execution. Verify both approved external input hashes before the single network call. Deterministically select the first 20 valid unique strict Solana addresses, issue exactly one 30d GMGN stats CLI invocation, and persist only an allowlisted structural/cardinality summary. Never print or store addresses, identity values, raw payload, arbitrary provider keys, raw stdout/stderr, credentials, or proxy URLs. Do not change parser semantics in this task. Register the independent audit as BLOCKED_DEPENDENCY.
