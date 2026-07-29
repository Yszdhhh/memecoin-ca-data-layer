# Acceptance Report: GMGN-PORTFOLIO-QUERY-TRANSPORT-DIAGNOSTICS-REPAIR-001

## 1. Task and Scope

- **Task ID:** `GMGN-PORTFOLIO-QUERY-TRANSPORT-DIAGNOSTICS-REPAIR-001`
- **HARNESS_AGENT_ID:** `implementer-gmgn-portfolio-query-transport-diagnostics-repair-001`
- **Baseline SHA:** `acca1888e3e5e9490396ed6c10e9032d86cfeaf8`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Provider / Network Requests:** `0`
- **External Address Processing:** `0`
- **Credential Value Reads:** `0`

This task repairs only mechanically provable defects in the GMGN Solana portfolio query boundary. It does not run a live request and does not claim that 7d, 30d, cumulative holdings, or all-time PnL is operational.

## 2. Implemented Repairs

1. `portfolio stats` now accepts bounded batches of up to 20 wallets per CLI invocation instead of one invocation per wallet.
2. Both stats and signed holdings invocations have a fixed 30,000ms child-process ceiling.
3. Isolated child environments set `NODE_OPTIONS=--dns-result-order=ipv4first` and `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS=0`.
4. API-key-only stats mode still strips and never forwards `GMGN_PRIVATE_KEY`.
5. Signed holdings locally normalizes escaped PEM newlines and validates Ed25519/RSA private-key structure before spawning; malformed material returns `gmgn_cli_signing_key_invalid` with zero request use.
6. Failure classification now distinguishes timeout, malformed signing key, clock/timestamp rejection, authentication rejection, rate limiting, CLI contract mismatch, network failure, provider 5xx, request rejection, response parsing failure, and generic unavailability using allowlisted codes only.
7. The async signed runner now terminates a child at the invocation timeout rather than waiting indefinitely.
8. Synthetic batch planning reduces the 20-wallet plan from 40 to 2 invocations, the 100-wallet plan from 200 to 10, and the 1,433-wallet plan from 2,866 to 144 while preserving two periods and strict serial execution.
9. Historical signed-smoke evidence now separates activation baseline from delivery commit and reports one CLI invocation plus a physical-request upper bound instead of an unobserved exact HTTP count.
10. The historical post-run audit task is now `READY`; the repair audit is dependency-blocked behind it to prevent concurrent ledger writes. No audit or live request was performed by this repair.

## 3. Data and Security Invariants

- Stats mode remains API-key-only and supports only `7d` and `30d`.
- Holdings remains a separate signed single-page snapshot contract; it is not represented as an invented all-time stats period.
- Normalized records remain `source: "gmgn"` and `verificationStatus: "unverified"`.
- Missing numeric values remain `null`, never fabricated as zero.
- No credential value, credential URL, plaintext external address, label, raw provider payload, raw stdout/stderr, or complete provider exception is persisted in Git evidence.
- No retry loop, pagination expansion, provider fallback, database, cache, queue, cron, or background process was added.

## 4. Offline Verification

| Command | Result |
| --- | --- |
| `npm run harness:task -- validate harness/tasks/GMGN-PORTFOLIO-QUERY-TRANSPORT-DIAGNOSTICS-REPAIR-001.json` | PASS / GREEN |
| `npm run harness:doctor` | PASS / GREEN |
| `npm run typecheck` | PASS |
| `npm test` | PASS - 261 passed, 1 skipped, 0 failed |
| `npm run build` | PASS |
| `git diff --check` | PASS |

The GMGN-focused synthetic subset contains 22 passing tests and covers batching, serial delay planning, timeout classification, IPv4-first/retry-disabled environments, private-key isolation, local malformed-key fail-closed behavior, safe diagnostics, null-for-missing, and external field sanitization.

## 5. Known Remaining Limitation and Gate

The prior provider failures were intentionally reduced to generic safe evidence, so their exact historical provider-side cause cannot be reconstructed. This repair removes known local transport and diagnostics defects, but live availability remains unproven.

First, an independent auditor must complete `SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-AUDIT-001`. Then `GMGN-PORTFOLIO-QUERY-TRANSPORT-DIAGNOSTICS-REPAIR-AUDIT-001` may move from `BLOCKED_DEPENDENCY` to `READY` and be completed by a different HARNESS_AGENT_ID with zero network requests. Only after a GREEN audit may a separate task authorize an exact maximum of three live CLI invocations: one API-key-only 7d stats batch, one API-key-only 30d stats batch, and one signed holdings invocation. The signed invocation should be skipped if the API-key path or local key preflight fails.
