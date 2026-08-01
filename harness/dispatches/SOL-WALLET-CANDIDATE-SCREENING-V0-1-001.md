# Dispatch: SOL-WALLET-CANDIDATE-SCREENING-V0-1-001

## Role
Implementer — cold path, offline only.

## Goal
Produce the first real-data wallet master table + multi-scenario candidate shortlist (30–50 unique) from the fixed 1,433 Solana addresses and GMGN RERUN-002, without formal Alpha grades.

## Reuse
- `wallet-data-quality.ts` (DQ + lead scores)
- `master-table-builder.ts` hashes / fingerprint helpers
- Local inputs under `chainfm_out/sol` and RERUN-002 derived folder

## Change
- Fix: `period_unverified` must not null all lead scores
- New: `candidate-screening-v0-1` pipeline + CLI + tests
- Outputs: private under `chainfm_out/.../wallet_intelligence_v0_1`; desensitized summaries in `artifacts/` and harness reports

## Forbidden
Network, credentials, Console/BSC/Robinhood/liquidity, formal grades, committing private addresses.
