# Dispatch: GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-002

- **Task ID:** `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-002`
- **Role:** Implementer
- **HARNESS_AGENT_ID:** `implementer-gmgn-wallet-stats-schema-contract-parser-hardening-repair-002`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Baseline SHA:** `af8b7c28fb9f0a563a3c370656e3b5d58a31215d`
- **Network budget:** Strictly 0 (offline-only task)
- **Independent auditor (must not be implementer):** `auditor-gmgn-wallet-stats-schema-contract-parser-hardening-repair-002`
- **Independent audit task:** `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-002-AUDIT-001`

## Assignment Objective

Harden GMGN Wallet Stats Parser and Consumer Contracts to resolve issues A–F:
1. Ensure runtime safety for all envelope nodes (`data`, `result`, `stats`, `pnl_stat` as non-objects or malformed types) without throwing `TypeError`.
2. Collect and validate ALL explicit period declarations across record, root, data, result, and metric containers before declaring `verified` or `period_mismatch`.
3. Detect multiple alias resolution conflicts within a container and fail-closed with `UNAVAILABLE` and `gmgn_wallet_stats_alias_conflict`.
4. Enforce invalid candidate container ambiguity detection (do not ignore containers with invalid metric fields or filter by `validCount > 0`).
5. Enforce strict per-field numeric type validation (JSON numbers only, no loose numeric string parsing unless explicitly permitted).
6. Contractually enforce winRate unit safety for percentage and ratio aliases.
