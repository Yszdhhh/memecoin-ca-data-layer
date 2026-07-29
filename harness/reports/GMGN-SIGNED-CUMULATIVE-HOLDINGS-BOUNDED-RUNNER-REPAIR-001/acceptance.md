# Acceptance Report: GMGN-SIGNED-CUMULATIVE-HOLDINGS-BOUNDED-RUNNER-REPAIR-001

## Scope and verdict

- **Verdict**: **GREEN** (zero-network bounded-runner repair).
- **Branch**: `codex/solana-daily-new-token-analysis`.
- **Start baseline**: `4945b38d63fc2978899f4bda7a6504a26f82b94e`.
- **Provider / network requests**: **0 / 0**.
- **External input reads**: **0**.
- **Credential reads or disclosures**: **0**.
- **Child-process spawns**: **0**. All execution coverage was dependency-injected synthetic testing.

## Implemented controls

1. Added a dedicated signed cumulative-holdings runner and CLI entrypoint; the live path is still blocked and was not executed.
2. Added `buildBoundedSignedGmgnCliEnvironment`, which mechanically sets `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS=0` in the actual isolated signed child environment.
3. The runner verifies both required input SHA-256 values before selection, credential presence checks, isolation, or CLI execution; a mismatch safely parks with no spawn.
4. The runner selects only the first strict Base58, exact-32-byte Solana address in memory, deduplicates by first occurrence, and returns only an irreversible fingerprint.
5. The only invocation construction is fixed to `portfolio holdings --chain sol --limit 50 --hide-closed false --raw`; it supplies no cursor and has no pagination, fallback, or retry path.
6. Successful output is parsed only through the existing holdings parser. Returned data is restricted to sanitized aggregates, `source: gmgn`, and `verificationStatus: unverified`; raw payloads, stdout/stderr, secrets, labels, and addresses are not returned or persisted.
7. Synthetic tests cover hash mismatch and missing credentials with zero spawns; the fixed one-invocation contract; retry disablement; no cursor; isolated environment; and raw-error disposal after safe classification.

## Task-chain update

- The live smoke remains `BLOCKED_DEPENDENCY`.
- Its failed preflight dependency was replaced with `SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-002`.
- `GMGN-SIGNED-CUMULATIVE-HOLDINGS-BOUNDED-RUNNER-REPAIR-AUDIT-001` remains required before the fresh preflight audit. No live authorization is implied by this GREEN repair verdict.

## Acceptance evidence

| Command | Result |
| --- | --- |
| `npm run harness:task -- validate harness/tasks/GMGN-SIGNED-CUMULATIVE-HOLDINGS-BOUNDED-RUNNER-REPAIR-001.json` | PASS |
| `npm run harness:doctor` | PASS (final task state; no active Ledger write-set overlap) |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 258 passed, 1 skipped, 0 failed |
| `npm run build` | PASS |
| `git diff --check` | PASS |

All tracked output fingerprints are recorded in `harness/inputs/GMGN-SIGNED-CUMULATIVE-HOLDINGS-BOUNDED-RUNNER-REPAIR-001/manifest.json`. This report deliberately contains no wallet address, label, credential, provider payload, raw child output, or full provider error.
