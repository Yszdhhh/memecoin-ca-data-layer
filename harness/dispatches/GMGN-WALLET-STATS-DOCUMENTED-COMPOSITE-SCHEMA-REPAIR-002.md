# Dispatch: GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-SCHEMA-REPAIR-002

- **Task ID:** `GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-SCHEMA-REPAIR-002`
- **Role:** Internal Coordinator + Implementer
- **HARNESS_AGENT_ID:** `implementer-gmgn-wallet-stats-documented-composite-schema-repair-002`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Resource budget:** Zero network requests, zero provider requests, zero CLI invocations, zero credential reads.

## Objective

Repair GMGN Wallet Stats Parser (`src/infrastructure/gmgn/wallet-stats-parser.ts`) to enforce explicit container field ownership in GMGN official composite schema (`root` + `pnl_stat`). Mislocated metrics (e.g. `pnl_stat.realized_profit`, `pnl_stat.buy_count`, `root.token_num`) must fail-closed with `gmgn_wallet_stats_schema_unrecognized`. Preserve legal structures and standalone stats mode. Correct evidence SHA records in Repair-001 acceptance via append-only correction, transition Repair-001 Audit to PARK, and expand offline synthetic test suite.
