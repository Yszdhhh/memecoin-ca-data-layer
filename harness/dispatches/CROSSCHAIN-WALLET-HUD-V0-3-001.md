# Dispatch: CROSSCHAIN-WALLET-HUD-V0-3-001

## Scope
After all five declared audit prerequisites are independently GREEN and there is a valid shadow-event batch, extend the local HUD to display chain-separated behavior scene, scene strength, evidence confidence, followability, current state, and risk overlays. The declared inputs are the five audit acceptance reports; Live Observation is optional future enhancement evidence and is neither an input nor a hard dependency. Preserve SOL/BSC metric separation and unknown identity boundaries.
## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/CROSSCHAIN-WALLET-HUD-V0-3-001.json`.

## Current status
`PARK`. PARK. Do not start without the exact Owner authorization and every named dependency GREEN.

## Dependencies
- `SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-002-AUDIT-001`
- `BSC-WALLET-CHAIN-VERIFICATION-PILOT-001-AUDIT-001`
- `WALLET-SHADOW-REPLAY-ENGINE-V0-1-001-AUDIT-001`
- `SOL-WALLET-SHADOW-REPLAY-PILOT-001-AUDIT-001`
- `BSC-WALLET-SHADOW-REPLAY-PILOT-001-AUDIT-001`

## Write boundary
- `src/application/wallet-intelligence/crosschain-hud-v0-3.ts`
- `src/cli/run-crosschain-wallet-hud-v0-3.ts`
- `test/application/wallet-intelligence/crosschain-hud-v0-3.test.ts`
- `docs/crosschain_wallet_hud_v0_3.md`
- `harness/reports/CROSSCHAIN-WALLET-HUD-V0-3-001/`
- `artifacts/crosschain_wallet_hud_v0_3/`

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
## Acceptance commands
- `npm run harness:task -- validate harness/tasks/CROSSCHAIN-WALLET-HUD-V0-3-001.json`
- `npm run harness:doctor`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run security:scan`
- `git diff --check`
- `tsx src/cli/run-crosschain-wallet-hud-v0-3.ts --private-root "$CHAINFM_OUT_DIR" --input-manifest "$CHAINFM_OUT_DIR/crosschain/crosschain_wallet_hud_v0_3_input_manifest.json" --output-private "$CHAINFM_OUT_DIR/crosschain/crosschain_wallet_hud_v0_3/"`
## Private offline replay requirement
The task-specific offline CLI above is a future implementation obligation. Before a DONE claim, run it against authorized real private input twice with the identical input; verify input and output record counts and equal output SHA-256; retain a private replay manifest and source hashes; and prove that `chainfm_out` is not tracked by Git.
