# Dispatch: SOL-GMGN-WALLET-STATS-COST-ALIAS-7D-30D-LIVE-RESMOKE-001

- Role: Implementer
- HARNESS_AGENT_ID: `implementer-sol-gmgn-wallet-stats-cost-alias-7d-30d-live-resmoke-001`
- Baseline SHA: `1ebea19`
- Budget: exactly 2 serial GMGN stats CLI invocations (7d then 30d), at least 1,000ms apart.

Create the task artifacts before runner changes or live execution. Verify both external input hashes before any request. Use one deterministic valid unique Solana address without displaying it. Execute only 7d and 30d API-key stats, never private-key holdings. Persist only sanitized normalized fields, fingerprints, aggregate status, budgets, allowlisted warning/diagnostic codes, source gmgn, verificationStatus unverified, and fetchedAt.
