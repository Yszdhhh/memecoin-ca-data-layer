# Dispatch: GMGN-WALLET-STATS-SINGLE-WALLET-INVOCATION-TRANSPORT-REPAIR-001

- **Task ID:** `GMGN-WALLET-STATS-SINGLE-WALLET-INVOCATION-TRANSPORT-REPAIR-001`
- **Role:** Internal Coordinator + Implementer
- **HARNESS_AGENT_ID:** `implementer-gmgn-wallet-stats-single-wallet-invocation-transport-repair-001`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Resource budget:** Zero network/provider/CLI requests, zero credential reads, zero real-address processing.

## Objective

Replace the invalid multi-wallet stats batching assumption with an exact one-wallet-per-invocation contract. The audited live evidence showed a 20-wallet request returned one top-level identity record and omitted 19 requested wallets. Enforce one wallet at the CLI boundary and application planner, plan 1,433 wallets across 7d and 30d as exactly 2,866 strictly serial invocations with at least 1,000ms spacing, and prove behavior with offline synthetic tests only.
