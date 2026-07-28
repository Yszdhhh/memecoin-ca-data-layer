# SOL-GMGN-HELIUS-DAILY-AUTO-ANALYSIS-AUDIT-001

## Verdict

**RED** — one blocking request-budget mismatch was reproduced. No live GMGN or Helius call was made during this audit.

Audited branch and commit:

- Branch: `codex/solana-daily-new-token-analysis`
- Commit: `77bcd156e1a3d0d24cdc882e51aa498c3529d2fb`
- Audit agent: `codex-auditor-sol-daily-auto-analysis-001`
- Harness run: `harness/runs/20260728072636_SOL-GMGN-HELIUS-DAILY-AUTO-ANALYSIS-AUDIT-001`

## Blocking finding

### P1 / High — declared GMGN request maximum is lower than the pinned CLI can issue

The generated report declares `gmgnRequestsMax: 1`, and the application starts the pinned GMGN CLI only once. However, `gmgn-cli@1.5.4` enables one automatic retry for qualifying rate-limited GET requests. Its request client can therefore perform two HTTP attempts during one discovery invocation.

This makes the declared hard bound of one GMGN request inaccurate on the retry path. The implementation must either disable the retry in a verifiable way or change the bounded contract and report to a truthful maximum of two requests with matching tests and task evidence.

Evidence:

- `src/application/live/solana-daily-new-token-analysis.ts` declares `gmgnRequestsMax: 1`.
- `src/application/discovery/gmgn-daily-token-selector.ts` launches the CLI once.
- `package.json` and `package-lock.json` pin `gmgn-cli@1.5.4`.
- `node_modules/gmgn-cli/dist/client/OpenApiClient.js` configures GET retry attempts with a maximum of two attempts on the relevant rate-limit path.

## Controls that passed

- Candidate age is bounded to the previous 24 hours; future timestamps and timestamps older than 24 hours are rejected.
- Market capitalization is strictly greater than USD 1,000,000.
- Selection is sorted by provider-reported market capitalization, capped at 10, and fails closed if fewer than 5 eligible candidates remain.
- Every candidate CA is Base58-decoded and strictly validated as 32 bytes before any Helius source is created.
- Helius analysis is read-only and bounded to three request classes per CA and 30 Helius requests per batch.
- Provider exceptions, raw provider text, raw payloads, API keys, and credential-bearing URLs are not emitted or persisted by the feature path.
- GMGN holder, top-10, creator, dev-team, insider, bundler, and sniper fields are explicitly labeled `unverified_provider_claim`.
- The implementation does not claim that Helius independently verifies holder concentration, address clustering, creator history, or Dev behavior.
- Helius endpoint selection is restricted to fixed endpoint modes and rejects arbitrary URLs.
- DPAPI credentials are scoped to the current Windows user, injected only into the child process environment, cleared in `finally`, and not printed.
- Windows scheduling is explicit opt-in, once daily, removable, and configured for the current logged-in user.
- The feature path does not write a database, cache, queue, address library, production system, or trading system. Its only intended persistence is a sanitized report outside the repository.

## Offline verification

The independent auditor ran only offline checks:

- audit task validation: GREEN
- `npm run harness:doctor`: GREEN
- `npm run typecheck`: passed
- `npm test`: 228 total, 227 passed, 1 live test skipped, 0 failed
- TypeScript no-emit build: passed
- `npm ls gmgn-cli --offline`: confirmed `gmgn-cli@1.5.4`
- `git diff --check`: passed
- final audited worktree: clean

## Residual operational limits

- Live operation requires the current Windows user's personal `GMGN_API_KEY` and `HELIUS_API_KEY`.
- The scheduled task runs only while that user is logged in.
- GMGN-derived holder and creator-related fields remain unverified third-party claims.
- Helius output remains limited to mint facts, metadata availability, token-account availability/count/completeness, and slots.
- There is no complete holder concentration analysis, owner clustering, creator transaction history, automated address library, persistence layer, or trading capability.

## Required follow-up

Create a narrow repair task for the GMGN retry/request-budget mismatch, then perform a fresh independent audit with a different audit run and agent identity.
