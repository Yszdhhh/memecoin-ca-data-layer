# Dispatch: SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-003

Execute only `harness/tasks/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-003.json`. Use a unique Auditor identity and perform a fully offline, independent preflight audit. No live request is allowed during this task.

## Required checks

1. Verify every `tracked_input_sha256` entry in `harness/inputs/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-003/manifest.json` against the current tracked input bytes before relying on any evidence.
2. Verify the prior preflight-002 FAILED due `PF-002-001`, and verify the narrow repair pins the current completed bounded-runner repair-audit task specification without changing the historical FAILED verdict.
3. Inspect actual code and synthetic tests—not prose alone—for the exact one-child/no-cursor/one-request cap, retry wait `0`, hash-before-spawn sequence, strict in-memory selection, secret isolation, and sanitized output/error controls.
4. Confirm `SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-001` remains blocked during the audit.

## Prohibited

Do not access external inputs, `.env`, credentials, or any provider/network. Do not run a live CLI or alter code/test/package/live-task/dispatch/manifest files. Do not disclose sensitive or provider data.

## Completion

Use `HARNESS_AGENT_ID=auditor-sol-gmgn-signed-cumulative-holdings-live-smoke-preflight-003`. Run the required Harness lifecycle and all listed offline validation commands. Finish GREEN only if all input hashes and mechanical controls pass; otherwise FAIL. Commit and normal-push only the exact audit write set.
