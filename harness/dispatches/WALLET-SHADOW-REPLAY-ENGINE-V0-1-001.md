# Dispatch: WALLET-SHADOW-REPLAY-ENGINE-V0-1-001

## Scope
Implement a deterministic offline replay engine using the approved contracts. Support fixed USD nominal entries, mirror exits, 5m/30m/2h/24h windows, fee/slippage/liquidity/tax-aware fill outcomes, no-lookahead price selection, and evidence-bounded followability conclusions. This chain-neutral engine depends only on audited shadow contracts, not BSC stage activation.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/WALLET-SHADOW-REPLAY-ENGINE-V0-1-001.json`.

## Current status
`BLOCKED_DEPENDENCY`. BLOCKED_DEPENDENCY. Do not start until every named dependency has an independent GREEN verdict where an audit task is named.

## Dependencies
- `WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001-AUDIT-001`

## Write boundary
- `src/application/shadow-trading/replay-engine-v0-1.ts`
- `src/application/shadow-trading/metrics-v0-1.ts`
- `test/application/shadow-trading/replay-engine-v0-1.test.ts`
- `docs/shadow_replay_engine_v0_1.md`
- `harness/reports/WALLET-SHADOW-REPLAY-ENGINE-V0-1-001/`

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
## Acceptance commands
- `npm run harness:task -- validate harness/tasks/WALLET-SHADOW-REPLAY-ENGINE-V0-1-001.json`
- `npm run harness:doctor`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run security:scan`
- `git diff --check`
- `MUST IMPLEMENT AND EXECUTE before DONE: tsx src/cli/run-wallet-shadow-replay-engine-v0-1.ts --private-root "$CHAINFM_OUT_DIR" --input-manifest "$CHAINFM_OUT_DIR/shadow/shadow_contracts_input_manifest.json" --output-private "$CHAINFM_OUT_DIR/shadow/shadow_replay_engine_v0_1/"; use authorized real private input, run twice with identical input, verify input/output record counts and identical output SHA-256, write replay_manifest.json and source_hashes.json, and verify chainfm_out is not tracked by Git.`
## Private offline replay requirement
The task-specific offline CLI above is a future implementation obligation. Before a DONE claim, run it against authorized real private input twice with the identical input; verify input and output record counts and equal output SHA-256; retain a private replay manifest and source hashes; and prove that `chainfm_out` is not tracked by Git.
