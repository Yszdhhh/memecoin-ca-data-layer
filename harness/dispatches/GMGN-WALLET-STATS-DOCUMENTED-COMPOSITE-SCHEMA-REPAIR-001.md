# Dispatch: GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-SCHEMA-REPAIR-001

- **Task ID:** `GMGN-WALLET-STATS-DOCUMENTED-COMPOSITE-SCHEMA-REPAIR-001`
- **Role:** Internal Coordinator + Implementer
- **HARNESS_AGENT_ID:** `implementer-gmgn-wallet-stats-documented-composite-schema-repair-001`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Resource budget:** Zero network requests, zero provider requests, zero CLI invocations, zero credential reads.

## Objective

Repair GMGN Wallet Stats Parser V2 (`src/infrastructure/gmgn/wallet-stats-parser.ts`) to support GMGN official fixed composite response structure (`root` + `pnl_stat`) without misjudging it as container ambiguity. Enforce explicit field ownership, ratio-to-percent conversion for `pnl_stat.winrate`, fail-closed alias/multi-location conflicts, strict numeric validation, and retain period & completeness contracts.

## Key Constraints

1. Do not issue any network requests or GMGN CLI calls.
2. Do not read credentials or real address files.
3. Do not mark failed live smoke as GREEN or alter historical evidence.
4. Do not include node_modules in Harness inputs or Git commits.
