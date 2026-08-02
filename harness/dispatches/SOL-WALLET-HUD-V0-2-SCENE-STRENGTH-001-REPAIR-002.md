# Dispatch: SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-001-REPAIR-002

## Scope
Repair the existing PR #15 implementation without rebuilding it: prevent activity-strength collapse, enforce defensible reproduction thresholds, maintain last-emitted GMGN baseline and cumulative-delta debounce, retain append-only history, persist source snapshot hashes, and synchronize acceptance evidence. After this governance PR is Owner-merged, checkout feat/sol-wallet-hud-v0-2-scene-strength directly, append commits, and push the existing PR #15. Do not create a replacement branch or PR.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-001-REPAIR-002.json`.

## Current status
`READY`. READY only after this governance PR is Owner-merged with a merge commit. Do not self-merge.

## Dependencies
- None

## Write boundary
- `src/application/wallet-intelligence/hud-v0-2.ts`
- `src/cli/run-sol-wallet-hud-v0-2.ts`
- `test/application/wallet-intelligence/hud-v0-2.test.ts`
- `docs/hud_v0_2_methodology.md`
- `artifacts/wallet_hud_v0_2/`
- `harness/reports/SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-001-REPAIR-002/`

## Git lane
Checkout `feat/sol-wallet-hud-v0-2-scene-strength` directly, append commits to that existing branch, and push the update to existing PR #15. Do not create `fix/sol-wallet-hud-v0-2-repair-002`, a replacement branch, or a replacement PR. Do not merge, squash, or rebase.

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
## Acceptance commands
- `npm run harness:task -- validate harness/tasks/SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-001-REPAIR-002.json`
- `npm run harness:doctor`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run security:scan`
- `git diff --check`
- `npm run wallet:hud:refresh:v0-2`
- `MUST IMPLEMENT AND EXECUTE before DONE: tsx src/cli/run-sol-wallet-hud-v0-2.ts --private-root "$CHAINFM_OUT_DIR" --input-manifest "$CHAINFM_OUT_DIR/sol/sol_wallet_hud_v0_2_input_manifest.json" --output-private "$CHAINFM_OUT_DIR/sol/wallet_hud_v0_2/"; use authorized real private input, run twice with identical input, verify input/output record counts and identical output SHA-256, write replay_manifest.json and source_hashes.json, and verify chainfm_out is not tracked by Git.`
## Private offline replay requirement
The task-specific offline CLI above is a future implementation obligation. Before a DONE claim, run it against authorized real private input twice with the identical input; verify input and output record counts and equal output SHA-256; retain a private replay manifest and source hashes; and prove that `chainfm_out` is not tracked by Git.
