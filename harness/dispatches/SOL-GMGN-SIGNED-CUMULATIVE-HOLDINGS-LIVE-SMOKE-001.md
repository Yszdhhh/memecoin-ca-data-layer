# Dispatch: SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-001

## Exact task

Execute only `harness/tasks/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-001.json` after its preflight audit is independently GREEN.

## Role and identity

- Role: implementer
- Required `HARNESS_AGENT_ID`: `implementer-sol-gmgn-signed-cumulative-holdings-live-smoke-001`
- Owner authorization: 2026-07-29, limited to this single, manual, read-only Solana / GMGN smoke.

## Hard limits

- Wallets selected: exactly 1.
- GMGN CLI invocations: exactly 1 maximum.
- Physical provider requests: exactly 1 maximum.
- The isolated child environment must set `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS=0`; this disables the pinned CLI's automatic rate-limit retry path.
- Cursor, pagination, retry, fallback, background loop, cron, discovery and automatic replenishment are forbidden.

## Required sequence

1. Confirm clean Git worktree, current branch and preflight audit GREEN.
2. Verify SHA-256 of both approved external files before a provider call. A mismatch is fail-closed with zero network requests.
3. Select only the first valid unique strict 32-byte Base58 Solana address in memory; do not print or persist it.
4. Confirm only the presence of `GMGN_API_KEY` and `GMGN_PRIVATE_KEY` in the process environment. Do not show values. If either is absent, PARK before spawning the CLI.
5. Create disposable HOME/CWD isolation and issue only the pinned `portfolio holdings --chain sol --wallet <in-memory> --limit 50 --hide-closed false --raw` invocation.
6. Capture child output in memory only, parse only with the approved normalized holdings parser, and write only safe aggregate output or an allowlisted safe failure code.
7. Update task state, ledger and sanitized acceptance report; run the required offline verification commands; finish the Harness run.
8. Do not mark this live task fully complete until the separate post-execution audit task is independently GREEN.

## Allowlisted write set

- `harness/tasks/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-001.json`
- `harness/ledger/tasks.json`
- `harness/reports/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-001/acceptance.md`

## Data statement

Any successfully parsed provider observation must remain `source: "gmgn"` and `verificationStatus: "unverified"`. A first-page Holdings snapshot is not complete cumulative/all-time PnL, chain-confirmed data, a wallet quality score or an Alpha classification.