# Dispatch: SOL-WALLET-SHADOW-REPLAY-PILOT-001

## Scope
Build the Solana-only offline adapter and pilot on authorized historical local inputs: normalize/deduplicate events, price and liquidity as-of lookup, fee model, chain-specific unfillable rules, golden fixtures, negative cases, and deterministic replay evidence. This Solana adapter must not be blocked by BSC stage activation.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/SOL-WALLET-SHADOW-REPLAY-PILOT-001.json`.

## Current status
`BLOCKED_DEPENDENCY`. BLOCKED_DEPENDENCY. Do not start until every named dependency has an independent GREEN verdict where an audit task is named.

## Dependencies
- `WALLET-SHADOW-REPLAY-ENGINE-V0-1-001-AUDIT-001`
- `SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-002-AUDIT-001`

## Write boundary
- `src/application/shadow-trading/sol-adapter-v0-1.ts`
- `src/cli/run-sol-wallet-shadow-replay-pilot.ts`
- `test/application/shadow-trading/sol-adapter-v0-1.test.ts`
- `docs/sol_shadow_replay_pilot_v0_1.md`
- `harness/reports/SOL-WALLET-SHADOW-REPLAY-PILOT-001/`
- `artifacts/sol_shadow_replay_pilot_v0_1/`

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
