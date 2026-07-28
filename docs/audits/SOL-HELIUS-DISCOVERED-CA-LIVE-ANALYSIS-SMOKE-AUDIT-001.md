# SOL-HELIUS-DISCOVERED-CA-LIVE-ANALYSIS-SMOKE-AUDIT-001

## Verdict

**GREEN_WITH_ADVISORY — the committed two-CA diagnostic is consistent with the reviewed bounded CA-first implementation, preserves sanitization and request limits, and does not overstate the observed partial data.**

Audited state:

- Branch: `codex/solana-daily-new-token-analysis`
- Audit start HEAD: `84908e5`
- Live-smoke result commit: `f4143b5`
- Audit agent: `codex-auditor-helius-discovered-ca-smoke-001`
- Harness run: `harness/runs/20260728080447_SOL-HELIUS-DISCOVERED-CA-LIVE-ANALYSIS-SMOKE-AUDIT-001`
- Provider calls during audit: none

## Findings

### 1. Frozen inputs and validation order — GREEN

The implementation task fixes exactly these two CAs:

- `9ufyZ2pyL9Apa7fB7JdHnSujhYTQ4Y19qNdBEgJUpump`
- `EUx9N4UXDyAXJpziyLF36j6Ut3Gu9X3VKEGptbmfpump`

The acceptance report contains the same two addresses and no substitutes. `readSolanaManualCaBatch` normalizes the complete list, rejects an empty or over-limit batch, rejects duplicates, and requires every entry to pass `isSolanaAddress` before entering the loop that constructs a source. `normalizeSolanaAddress` performs Base58 decoding and accepts only a decoded length of exactly 32 bytes.

### 2. Provider and request bounds — GREEN

The production batch CLI constructs only `LiveHeliusDataSource` instances. Each per-CA source is configured with `requestBudget: 3`; the two fixed CAs therefore permit at most six Helius requests in this diagnostic. The data source reserves budget before a request and throws the stable `helius_request_budget_exhausted` code when exhausted. There is no provider fallback in this path.

### 3. Sanitization — GREEN

`readSolanaLiveCaFirst` catches each source failure and passes it through `safeSolanaLiveWarning`. The warning mapper exposes only a fixed allowlist, maps Helius HTTP statuses to `helius_http_error`, and maps every other thrown value to `helius_live_read_unavailable`. The CLI serializes only the normalized result contract. The committed acceptance report contains counts, availability flags, slots and allowlisted warning codes; it contains no API key, credential-bearing URL, raw payload, arbitrary provider message or full exception text.

### 4. Result interpretation — GREEN

The report truthfully marks the batch and both CAs `DEGRADED`. It records mint availability for both, unavailable metadata for both, unavailable token accounts for the first CA, and 1,000 bounded token-account rows for the second. It explicitly states that the row count is not a holder count or concentration analysis. It does not claim creator history, Dev behavior, wallet classification, address-library persistence, a complete 5–10 candidate daily batch or scheduler activation.

### 5. Evidence limitation — ADVISORY

The sanitized acceptance report is intentionally the durable live-output artifact. It is sufficient to audit boundary compliance and report interpretation, but it does not retain raw provider payloads and therefore cannot independently replay or prove each upstream field without making another provider call. That limitation is correct for this repository's credential and raw-payload prohibition and is not a request to weaken sanitization.

## Acceptance evidence

The Harness acceptance run for this audit executes:

- audit task validation
- Harness doctor
- TypeScript typecheck
- complete test suite
- build
- `git diff --check`

The verdict remains accepting only if all commands pass and the audit changes remain inside the exact task, ledger and audit-report write set.

## Residual limits

- This result proves a bounded Helius CA-first diagnostic, not complete Pump analysis.
- The 1,000 rows are token-account rows, not verified unique holders or concentration.
- No first-hand wallet PnL, profitable-wallet leaderboard, creator/Dev history, wallet classification or CA-to-address-library linkage was exercised.
- The daily workflow still requires 5–10 eligible candidates and remains unscheduled until a qualifying one-shot run and explicit registration.
- No database, cache, queue or production persistence is active.
