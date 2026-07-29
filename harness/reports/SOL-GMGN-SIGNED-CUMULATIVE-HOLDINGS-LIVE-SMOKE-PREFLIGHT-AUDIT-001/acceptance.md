# Acceptance Report: SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-001

## 1. Audit metadata

- **Task ID**: `SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-001`
- **Role**: independent preflight auditor
- **HARNESS_AGENT_ID**: `auditor-sol-gmgn-signed-cumulative-holdings-live-smoke-preflight-001`
- **Branch**: `codex/solana-daily-new-token-analysis`
- **Audited baseline SHA**: `a01320d5afd808a1318d9fe81ebc690576de6d9b`
- **Audit Harness run ID**: `20260729094057_SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-001`
- **Audit verdict**: **FAIL**

This is a zero-network preflight design audit. It does not execute, authorize, or validate a live GMGN request.

## 2. Zero-network and privacy declaration

- Provider requests issued: **0**.
- Network requests issued: **0**.
- Credential reads or presence checks: **0**.
- External address-file reads or address selections: **0**.
- No wallet address, label, token identifier, credential value, credential URL, raw provider payload, raw stdout/stderr, or full provider error was retained in this report.

## 3. Controls verified

The proposed live task correctly declares the following design controls:

- Solana-only and GMGN-only scope.
- Two required external input SHA-256 checks before any provider operation.
- In-memory-only selection of one strict Base58 address decoding to 32 bytes, with only a non-reversible target fingerprint permitted for evidence.
- One wallet, one CLI invocation, one physical provider request, no cursor, pagination, fallback, automation, production writes, or retries.
- Isolated HOME/CWD and signed environment helpers in `src/application/gmgn/gmgn-cli-boundary.ts`.
- Pinned `gmgn-cli` version `1.5.4` in the package lock.
- A normalized Holdings parser that preserves `source: "gmgn"`, `verificationStatus: "unverified"`, null missing values, allowlisted warning codes, and partial-page semantics.
- No claim that a first Holdings page is complete all-time wallet PnL or chain-confirmed data.
- All tracked local source hashes declared by the live-task input manifest matched the audited files.

## 4. Blocking findings

### P1 — exact one-physical-request control is declared but not enforced by a tracked execution artifact

**Status: OPEN / BLOCKING**

The live task requires `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS=0` so a pinned CLI invocation cannot expand into an automatic rate-limit retry. However, the audited tracked source does not set or enforce this value:

- `src/application/gmgn/gmgn-cli-boundary.ts` builds signed CLI environments but does not add the rate-limit retry control.
- Tracked references to `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS` exist only in the proposed live task and dispatch text, not in a controlled runner or boundary contract.
- The live task write set permits only its task state, ledger entry, and acceptance report. It cannot add a minimal controlled runner or amend the boundary implementation before execution.

Accordingly, the audit cannot verify the task objective's required exact maximum of one physical provider request. A textual instruction to set an environment variable is insufficient evidence for a T3 quota boundary when the task has no tracked execution artifact that enforces it.

### P1 — no tracked runner binds the required sequence into one auditable execution path

**Status: OPEN / BLOCKING**

The audited task/dispatch describes the required order (input-hash verification, in-memory strict selection, credential-presence checks, disposable isolation, one signed CLI invocation, sanitized parsing, and evidence writing), but no task input or permitted write-set file implements that sequence as a controlled runner. The reusable boundary also permits an optional cursor for other callers, while the live task merely forbids cursor textually.

Without a tracked runner, this preflight cannot establish that all hard controls execute in the stated order or that the request cap is mechanically preserved. The live smoke must remain blocked until a separately dispatched narrow implementation repair introduces an auditable, bounded runner and then receives a new independent preflight audit.

## 5. Offline acceptance evidence

| Command | Result | Notes |
| --- | --- | --- |
| `npm run harness:task -- validate harness/tasks/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-001.json` | PASS | Task schema status GREEN; 0 errors. |
| `npm run harness:doctor` | PASS | Final status GREEN, 0 errors. It reports only the expected dirty-worktree warning while this audit's allowed artifacts are uncommitted. |
| `npm run typecheck` | PASS | Exit code 0. |
| `npm test` | PASS | 253 passed, 1 skipped, 0 failed. |
| `npm run build` | PASS | Exit code 0. |
| `git diff --check` | PASS | No whitespace errors. |
| `npm run harness:run -- verify <audit-run>` | PASS | Harness verification GREEN; no out-of-scope changes or unresolved deliverables. |

At the clean baseline before this audit's report/state artifacts were created, an initial Harness Doctor check observed an unrelated active Ledger write-set overlap with `SOL-GMGN-WALLET-HOLDINGS-HISTORY-PILOT-AUDIT-001`. This audit did not modify that task. After this audit's own task and Ledger statuses were finalized, the required final Doctor check was GREEN. This transient coordination observation is not the basis for the FAIL verdict; the two blocking execution-control findings in Section 4 are.
## 6. Required remediation and live-task disposition

- **Do not execute** `SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-001`.
- Do not read credentials, external address files, or issue any GMGN request for this smoke under the current task design.
- Create a separate, narrow, zero-network repair task that is authorized to add a controlled local runner or extend the GMGN boundary contract. That repair must mechanically enforce all of the following before any child spawn:
  1. the two approved input hashes;
  2. strict in-memory address selection with no address persistence;
  3. credential-presence checks without value disclosure;
  4. disposable HOME/CWD isolation;
  5. `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS=0` in the isolated child environment;
  6. exactly one CLI invocation and no cursor/pagination/fallback/retry;
  7. sanitized parser output and allowlisted diagnostics only.
- After that repair receives an independent audit GREEN, create a fresh preflight audit for the amended live task. Do not reinterpret this FAIL as authorization for a live request.

## 7. State updates

- This preflight audit task is marked `DONE` with verdict **FAIL**.
- The matching Harness Ledger entry is marked `DONE`.
- The proposed live smoke task remains `BLOCKED_DEPENDENCY` and was not modified.