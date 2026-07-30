# Dispatch: HARNESS-GMGN-SIGNED-CUMULATIVE-HOLDINGS-PREFLIGHT-EVIDENCE-MANIFEST-REPAIR-001

Execute only `harness/tasks/HARNESS-GMGN-SIGNED-CUMULATIVE-HOLDINGS-PREFLIGHT-EVIDENCE-MANIFEST-REPAIR-001.json`. This is an offline, zero-network evidence-integrity repair. Before any Harness run, confirm a clean worktree.

## Exact permitted mutation

Read the tracked current SHA-256 of `harness/tasks/GMGN-SIGNED-CUMULATIVE-HOLDINGS-BOUNDED-RUNNER-REPAIR-AUDIT-001.json`, then replace only its corresponding value in `harness/inputs/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-002/manifest.json`. The acceptance report must state the stale and replacement hashes, the blocking finding ID `PF-002-001`, and that this repair creates no live authorization.

## Prohibited

Do not access the external Solana input directory, credentials, `.env`, any provider/network, or the live CLI. Do not alter runner code, tests, task status for the live smoke, historic reports, or any other manifest entries. Do not unlock or run the live smoke.

## Completion

Use `HARNESS_AGENT_ID=implementer-gmgn-signed-cumulative-holdings-preflight-evidence-manifest-repair-001`. Run only the task-specified offline validation commands, finish the repair task, commit only its write set, and normal-push. A new independent preflight audit is still required before any live execution.
