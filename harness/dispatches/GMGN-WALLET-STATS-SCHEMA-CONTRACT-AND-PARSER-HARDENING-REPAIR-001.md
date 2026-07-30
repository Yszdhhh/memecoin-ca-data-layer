# Dispatch: GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-001

- **Task ID:** `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-001`
- **Role:** Implementer
- **HARNESS_AGENT_ID:** `implementer-gmgn-wallet-stats-schema-contract-parser-hardening-repair-001`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Baseline SHA:** `214c010c3200601657b509bbb49431b4fb2e1412`
- **Network budget:** Strictly 0 (offline-only task)
- **Independent auditor (must not be implementer):** `auditor-gmgn-wallet-stats-schema-contract-parser-hardening-repair-001`
- **Independent audit task:** `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-AUDIT-001`

## Assignment Objective

Repair GMGN Wallet Stats Parser and Consumer Contract to resolve defects A–I:
1. Repair Write Set boundary overrun by adding missing files to tracked write_set and recording append-only correction in original acceptance report.
2. Require mandatory `expectedPeriod` ("7d" | "30d") in `parseGmgnWalletStats` without default fallbacks or optional parameters.
3. Enforce strict single metric-container extraction contract to forbid cross-node aggregate composition.
4. Calculate provider completeness strictly from explicit, validated provider fields without tradeCount derivation.
5. Fail closed on explicit unsupported periods ("90d", "all", "1d", etc.).
6. Contractually validate winRate units (percent vs ratio), failing closed with safe warnings when unit is ambiguous.
7. Maintain strict consumer status mapping (Parser MAPPED -> SUCCESS, Parser PARTIAL -> PARTIAL, Parser UNAVAILABLE -> UNAVAILABLE).
8. Add comprehensive synthetic counter-example unit tests covering all edge cases.
