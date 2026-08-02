# Dispatch: WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001

## Scope
Define offline, chain-neutral shadow-trade contracts and validation rules for normalized signals, order intents, fills, lots, exits, results, metrics, run manifests, and data-quality events. Enforce source_trade_at versus observed_at versus simulated_order_at semantics; do not implement chain parsing or execution. This common contract is chain-neutral and must not be blocked by BSC stage activation.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001.json`.

## Current status
`BLOCKED_DEPENDENCY`. BLOCKED_DEPENDENCY. Do not start until every named dependency has an independent GREEN verdict where an audit task is named.

## Dependencies
- `HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001-AUDIT-001`

## Write boundary
- `src/domain/shadow-trading/contracts-v0-1.ts`
- `src/domain/shadow-trading/validation-v0-1.ts`
- `test/domain/shadow-trading/contracts-v0-1.test.ts`
- `docs/shadow_trade_contracts_v0_1.md`
- `harness/reports/WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001/`

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
