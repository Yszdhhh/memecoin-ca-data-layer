# GMGN wallet stats schema-adapter repair audit

**Verdict: GREEN_WITH_ADVISORY**

## Independent audit scope

- Auditor Harness identity: `codex-gmgn-wallet-stats-parser-auditor-20260728` (distinct from the implementation run).
- This audit made **no GMGN, Helius, or other network request** and did not inspect credential values.
- Reviewed the committed implementation task, its finished Harness manifest, parser, pure unit tests, bounded runner, and sanitized live report.

## Verified

1. `src/infrastructure/gmgn/wallet-stats-parser.ts` has a versioned, pure in-memory parser. Its output contains only the frozen wallet identity, parser version, mapping status, allowlisted numeric period aggregates, and stable warning codes. Synthetic tests cover nested direct-identity, wallet-keyed, malformed, and unrelated inputs.
2. `harness/gmgn-wallet-stats-live-smoke.ts` validates all eleven frozen addresses with strict Base58/32-byte validation before the child-process path. Its only defined periods are `7d` and `30d`; the valid-input path makes one GMGN CLI stats call per period, with no retry, pagination, Helius invocation, fallback, discovery, persistence, or scheduler.
3. The sanitized live report records exactly two mapped wallet-period observations and twenty unavailable wallet-period observations. Mapped values are explicitly labelled `borrowed_unverified` and provider-reported **period** aggregates.
4. Neither the parser, runner, implementation report, nor this audit report stores raw payloads, arbitrary provider text, credential-bearing URLs, API-key values, signatures, counterparties, token mints, or per-trade records.
5. The implementation report explicitly excludes cumulative/all-time profit, chain-verified PnL, wallet-quality/tier, clustering, complete history, and address-library admission claims.

## Advisory

GMGN supplied safely mappable period aggregates for only one of the eleven frozen wallets in this bounded batch response (two periods). That is a provider-response coverage limitation, not evidence that the other wallets have no activity or no profitability. A future widening must use a new task and must not silently retry or interpret the unavailable records as negative facts.
