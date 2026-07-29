# Acceptance Report: SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-002

## Audit identity and boundary

- **Role:** independent read-only auditor.
- **HARNESS_AGENT_ID:** `auditor-sol-gmgn-signed-cumulative-holdings-live-smoke-preflight-002`.
- **Audit baseline:** `8ab48576854f3be8b74f81ae299484f1de59e616`.
- **Scope:** only the tracked preflight task write set.
- **Network / provider requests:** `0`.
- **External input reads:** `0`.
- **Credential reads:** `0`.
- **Live CLI executions:** `0`.

No external directory, `.env`, API key, private key, raw provider payload, raw child stdout/stderr, or full provider error was read, printed, retained, or committed.

## Offline validation

All task-required offline commands passed:

| Command | Result |
| --- | --- |
| `npm run harness:task -- validate harness/tasks/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-002.json` | PASS |
| `npm run harness:doctor` | PASS / GREEN |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 258 passed, 1 skipped, 0 failed |
| `npm run build` | PASS |
| `git diff --check` | PASS |

## Mechanical preflight review

The audit inspected the actual tracked runner and boundary rather than relying on task prose. It confirmed the following controls are implemented and covered by synthetic/offline tests:

1. The runner reads both prescribed input byte streams and compares both SHA-256 values before address selection, credential presence gating, isolation creation, or child execution.
2. Candidate selection is in-memory only and uses the strict Solana Base58/exact-32-byte normalizer with local de-duplication; the selected value is not returned and is reduced only to a task-scoped non-reversible fingerprint.
3. Credential handling is a presence-only gate. The runner does not disclose credential values; the child receives an isolated disposable HOME and CWD.
4. The actual bounded signed child environment mechanically sets `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS=0` and does not forward ambient debug configuration.
5. The runner creates at most one fixed signed holdings invocation, with no supplied cursor and no retry loop. Its declared physical provider-request cap is one.
6. Child stdout/stderr is retained only transiently for in-memory parsing or safe classification. Returned outcomes contain only allowlisted safe diagnostic/warning codes and sanitized aggregate records, retaining `source: "gmgn"` and `verificationStatus: "unverified"` where a record exists.

## Blocking finding

**Finding PF-002-001 — input evidence manifest integrity mismatch (blocking).**

The preflight input manifest declares a SHA-256 fingerprint for the completed bounded-runner repair audit task specification, but that fingerprint does not match the current tracked completed audit task specification. The mismatch is confined to tracked audit-evidence metadata; this audit does not modify the prior task or attempt a repair.

Because this preflight is required to provide a fresh, integrity-pinned approval before any signed live execution, a stale tracked input fingerprint prevents a GREEN verdict even though the reviewed runner controls and all offline commands pass.

## Verdict

**FAIL** — no live request is authorized. `SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-001` remains `BLOCKED_DEPENDENCY` until a narrow evidence-manifest repair and a new independent preflight audit produce an explicit GREEN result.

No code, test, package, live-task, live-dispatch, live-manifest, historical output, or external input was changed by this audit.