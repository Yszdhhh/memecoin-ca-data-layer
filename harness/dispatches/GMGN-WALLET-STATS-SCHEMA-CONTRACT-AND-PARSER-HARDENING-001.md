# Dispatch: GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-001

- **Task ID:** `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-001`
- **Role:** Implementer
- **HARNESS_AGENT_ID:** `implementer-gmgn-wallet-stats-schema-contract-and-parser-hardening-001`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Baseline SHA:** `85f9503b2d68fecb328a8902db29575dcb4395e2`
- **Network budget:** Strictly 0 (offline-only task)
- **Independent auditor (must not be implementer):** `auditor-gmgn-wallet-stats-schema-contract-and-parser-hardening-001`
- **Independent audit task:** `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-AUDIT-001`

## Assignment Objective

Harden the GMGN Wallet Stats Parser (`gmgn-wallet-stats-v2`) and related consumers to resolve Findings F1–F8 from prior 30d live smoke audit:
1. F1: Remove broad recursive alias scanning.
2. F2: Remove depth scoring and cross-node aggregate composition.
3. F3 & F4: Replace blanket MAPPED/completeness=1 with explicit schema contract, mapped field coverage completeness, and PARTIAL status.
4. F5 & F6: Define explicit supported envelope schemas and field path allowlists; avoid accidental synthetic test passes.
5. F7: Pass expectedPeriod ("7d" | "30d") as input contract, validate self-describing period fields, fail-closed on period mismatch.
6. F8: Strict distinction between missing (null), explicit zero (0), and invalid non-numeric values.
7. WinRate unit validation: fail-closed with warning when winRate unit is ambiguous; no heuristic unit multiplication.
8. Maintain source="gmgn" and verificationStatus="unverified".
9. Update consumers (`wallet-profile-pilot.ts`, `proxy-transport-7d-live-smoke.ts`, `proxy-transport-30d-live-smoke.ts`) to consume genuine completeness from Parser V2.
10. Ensure zero network, zero CLI, zero credential reads, zero address processing.
