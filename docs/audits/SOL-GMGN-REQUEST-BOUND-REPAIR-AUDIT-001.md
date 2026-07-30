# SOL-GMGN-REQUEST-BOUND-REPAIR-AUDIT-001

## Verdict

**GREEN** — the narrow repair truthfully accounts for the pinned GMGN CLI retry path, and no existing safety boundary was weakened.

Audited state:

- Branch: `codex/solana-daily-new-token-analysis`
- Audited HEAD: `e604bc4af51ee6e34c72aad433a33f8229e4d8b5`
- Repair commit: `6ddd6258fe243640fd0a08decf549e0c5e2c7648`
- Audit agent: `codex-auditor-gmgn-request-bound-repair-002`
- Harness run: `harness/runs/20260728073905_SOL-GMGN-REQUEST-BOUND-REPAIR-AUDIT-001`
- Provider calls: none

## Request-bound finding closure

The project pins `gmgn-cli@1.5.4` and starts one fixed `market trending` discovery invocation per daily run. The pinned CLI performs one GET and allows at most one additional attempt on its qualifying rate-limit retry path. The truthful maximum is therefore two underlying GMGN HTTP attempts.

The repaired report contract now declares `gmgnRequestsMax: 2` in both analyzed and rejected reports. Tests assert the value on a successful five-candidate path and on the fail-closed insufficient-candidate path. The runbook distinguishes one discovery invocation from at most two underlying HTTP attempts.

Evidence:

- `package.json` and `package-lock.json` pin `gmgn-cli@1.5.4`.
- `src/application/discovery/gmgn-daily-token-selector.ts` starts one fixed discovery command.
- `node_modules/gmgn-cli/dist/commands/market.js` invokes the trending request once.
- `node_modules/gmgn-cli/dist/client/OpenApiClient.js` fixes the GET attempt loop at two and only reaches the second attempt on the qualifying retry path.
- `src/application/live/solana-daily-new-token-analysis.ts` declares and emits `gmgnRequestsMax: 2` on all report paths.
- `test/application/live/solana-daily-new-token-analysis.test.ts` covers ready and rejected reports.
- `docs/runbooks/SOLANA_DAILY_NEW_TOKEN_ANALYSIS.md` records the same bound.

## Preserved controls

- Solana-only discovery and analysis.
- Candidate age no greater than 24 hours, with future timestamps rejected.
- Provider-reported market capitalization strictly greater than USD 1,000,000.
- Descending market-cap selection, maximum 10, minimum 5, no padding or guessing.
- Base58 decoding and strict 32-byte validation of every CA before any Helius source is created.
- Helius remains read-only and limited to mint, metadata, and token-account calls.
- Helius remains bounded to 3 requests per CA and 30 requests per batch.
- Raw payloads, arbitrary provider errors, full exception text, API keys, and credential-bearing URLs remain excluded from output and persistence.
- GMGN market, holder, creator, dev-team, insider, bundler, and sniper fields remain labeled `unverified_provider_claim`.
- DPAPI remains scoped to the current Windows user, with process-only injection and cleanup.
- Scheduling remains an explicit, removable, once-daily Windows Task Scheduler action for the logged-in user.
- No database, cache, queue, automated address library, production persistence, signing, swap, order, or trading behavior was introduced.

## Acceptance evidence

The Harness acceptance run for this audit executes:

- audit task validation
- Harness doctor
- TypeScript typecheck
- complete test suite
- build
- `git diff --check`

The audit is GREEN only if all commands pass and the run remains inside its exact audit write set.

## Residual limits

- The two-attempt bound describes the pinned CLI's explicit fetch-attempt loop; it does not guarantee provider availability or success.
- GMGN-derived holder and creator-related values remain unverified third-party claims.
- Helius facts do not constitute complete holder concentration, owner clustering, creator history, Dev behavior analysis, or a durable address library.
- The workflow remains local, read-only, non-trading, and without database/cache/queue persistence.
- Operational activation still requires the current Windows user's personal GMGN and Helius credentials and explicit schedule registration.
