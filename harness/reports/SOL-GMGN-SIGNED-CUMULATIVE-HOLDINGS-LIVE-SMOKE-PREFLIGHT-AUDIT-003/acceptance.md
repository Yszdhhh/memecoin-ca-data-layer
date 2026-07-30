# Acceptance Report: SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-003

## Audit identity and zero-access boundary

- **Role:** independent read-only auditor.
- **HARNESS_AGENT_ID:** `auditor-sol-gmgn-signed-cumulative-holdings-live-smoke-preflight-003`.
- **Audit baseline / remote-aligned HEAD:** `3e9b342615b693e5d163f51f580171becf3194cf`.
- **Scope:** only this audit task's declared write set.
- **Network requests:** `0`.
- **Provider requests:** `0`.
- **External input reads:** `0`.
- **Credential reads:** `0`.
- **Live CLI executions:** `0`.

This audit did not read the external Solana input directory, any `.env` file, API key, private key, credential-bearing configuration, raw provider payload, raw child stdout/stderr, or full provider error. It did not select or retain an address, run the live CLI, or modify code, tests, packages, dispatches, input manifests, the live task, or historical outputs.

## Fresh evidence-manifest integrity check

Before approving the bounded live path, the auditor independently recalculated SHA-256 for every **17/17** repository-tracked entries declared by `harness/inputs/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-003/manifest.json` under `tracked_input_sha256`.

- **Result:** all 17 hashes matched exactly.
- **Allowed evidence scope:** repository-tracked task, dispatch, manifest, report, runner, boundary, parser, synthetic-test, and package files only.
- **No external address/label file, environment file, or credential was read to perform this check.**

This closes the stale bounded-runner-audit task-spec fingerprint finding recorded by preflight audit 002: the repaired preflight evidence manifest now pins the current tracked evidence set correctly.

## Mechanical control review

The audit independently inspected the pinned runner, CLI boundary, parser, and synthetic tests. The following controls are implemented mechanically, rather than asserted only by task prose:

1. The runner reads both authorized external input byte streams and verifies both required SHA-256 values before address selection, credential presence gating, isolation creation, or child execution; a mismatch returns a safe PARK code with zero child executions.
2. Selection is in memory only, uses the existing strict Solana Base58/exact-32-byte normalizer, deduplicates by first occurrence, and reduces a selected value only to a task-scoped SHA-256 fingerprint; it never returns the address.
3. Credential logic is presence-only. The runner returns a safe PARK code when either signed credential is absent and does not expose either value.
4. A disposable temporary CWD and HOME are created for the child. The bounded signed environment explicitly sets `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS=0` and does not forward ambient debug configuration.
5. The live runner constructs one fixed `portfolio holdings` invocation for Solana with limit 50, closed holdings included, raw output, and no supplied cursor. There is no runner retry or pagination loop; the result contract declares one GMGN CLI invocation and one physical provider-request maximum.
6. Child stdout/stderr is used only transiently for in-memory parse/classification. Returned data is a sanitized aggregate record or allowlisted safe diagnostic code; parsed records remain `source: "gmgn"` and `verificationStatus: "unverified"`. Missing fields remain nullable and a continuation cursor is represented only as partial completeness/warning, not as complete all-time PnL.
7. Synthetic tests cover hash mismatch before spawn, missing credentials before spawn, exactly one no-cursor invocation with retry disabled and isolated HOME/CWD, source/verification preservation, and raw child failure-text suppression. The tests use synthetic values and do not read real external address files.

## Required offline validation

| Command | Result |
| --- | --- |
| `npm run harness:task -- validate harness/tasks/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-003.json` | PASS / GREEN |
| `npm run harness:doctor` | PASS / GREEN |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 258 passed, 1 skipped, 0 failed |
| `npm run build` | PASS |
| `git diff --check` | PASS |

The Harness run lifecycle for this audit is `start -> verify -> finish GREEN`. Its persisted run evidence contains only the task-required offline command logs.

## Live-task gate and verdict

`SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-001` was checked during this audit and remains `BLOCKED_DEPENDENCY`; this audit does not enable it.

**Verdict: GREEN.** The fresh tracked-evidence fingerprints are complete and match, and the audited implementation satisfies the one-request, hash-before-spawn, secret-contained, isolated, no-cursor, retry-disabled, sanitized-output control contract. This GREEN is a preflight authorization gate only: it is not a live execution, does not establish GMGN data availability, does not claim complete all-time wallet PnL, and does not elevate any GMGN observation above unverified borrowed data.
