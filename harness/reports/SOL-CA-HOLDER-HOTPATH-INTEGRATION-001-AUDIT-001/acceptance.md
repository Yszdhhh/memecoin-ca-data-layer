# Independent Audit Acceptance — SOL-CA-HOLDER-HOTPATH-INTEGRATION-001-AUDIT-001

## Final verdict

```text
GREEN
```

## Merge stance

```text
ACCEPT_AND_MERGE
```

Merge method required: **normal merge commit only**. No squash, no rebase, no force-push.

## Facts pinned

| Item | Value |
| --- | --- |
| Repo | `Yszdhhh/memecoin-ca-data-layer` |
| Base main | `5cc414c83d5b0d602d55eac9bc392953a3161196` |
| Branch | `feature/sol-ca-holder-hotpath-integration-001` |
| Audited tip | `57345911d54f132664c41753cd371d12c1166353` |
| PR | #7 |
| Task | SOL-CA-HOLDER-HOTPATH-INTEGRATION-001 |
| Auditor role | Independent read-only (zero business-implementation edits) |

## Acceptance criteria

### 1. Ancestry + allowlist — PASS

- Clean checkout at tip `5734591` (worktree not required; branch HEAD exact tip; `git status` clean during audit).
- `git merge-base HEAD 5cc414c…` = `5cc414c83d5b0d602d55eac9bc392953a3161196`.
- Graph shows normal reverts: `47fbe70` / `e7c28dd` / `f06819e` reverse `6e043e4` / `7953a19` / `85f6291`. No rebase/reset/force-push rewrite observed.
- Effective `5cc414c…5734591` name-only diff = 25 paths, matches implementer `exact-write-set.txt`.
- No G2–G8 product slices retained (no domain engines / offline backend / Watchlist / Schedules / Replay / Liquidity product impl in effective diff).

### 2. Source + loopback security — PASS (no P0/P1)

Binding budget/accounting/status semantics verified against tip sources:

| Semantic | Result |
| --- | --- |
| Every real Helius HTTP attempt → `consumeHttpAttempt` | PASS |
| Pagination pages counted | PASS |
| 429/5xx/timeout/malformed retries each attempt counted | PASS |
| `providerRequestCount` = real fetch attempts | PASS |
| `providerOperationCount` = logical ops only | PASS |
| budget+1 refused without fetch | PASS |
| Exact-budget success → completed, `providerBudgetExhausted=false`, no `request_budget_exhausted` | PASS (tip 5734591) |
| Further refuse → partial + `request_budget_exhausted` + eligibility false + ratio null | PASS |
| Credential unavailable → blocked + `credential_unavailable` + requestCount 0 | PASS |
| No secrets in logs / public summaries | PASS |

Loopback controls:

| Control | Result |
| --- | --- |
| CLI bind 127.0.0.1 | PASS |
| Host allowlist | PASS |
| Origin allowlist | PASS |
| Sec-Fetch-Site cross-site reject | PASS |
| application/json + unknown/forbidden field reject | PASS |
| Client-provided key reject | PASS |
| No CORS `*` | PASS |
| OPTIONS only allowlisted origin | PASS |
| GET non-mutating | PASS |

Advisories only (P2, not merge-blocking): see `findings.json` — stale metrics snapshot on unexpected throw; library host override without non-loopback fail-closed; harness doctor wallet fixture rule.

### 3. Offline gates — ACCEPTABLE

Honest exit codes recorded in `gate-results.json` (auditor re-ran on tip):

| Gate | Result |
| --- | --- |
| npm ci | PASS (0) |
| typecheck | PASS (0) |
| npm test | PASS — 430 pass / 0 fail / 1 skipped |
| build | PASS (0) |
| console:check | PASS (0) |
| console:build | PASS (0) |
| security:scan | PASS (0; classifiedLeaks=0) |
| provider-accounting tests | PASS — 5/5 |
| ca-holder-task-service tests | PASS — 11/11 |
| http-server-security tests | PASS — 7/7 |
| git diff --check | PASS (0) |
| harness:doctor | **FAIL (1)** — pre-existing `wallets.json` rule; not Hotpath-introduced |

`harness:doctor` FAIL classified as **P2 Advisory** (fixture already on main from OPERATOR-CONSOLE-SHELL-001; scrubbed summary + fingerprints only; no plaintext wallet bulk). **Not** rewritten to PASS. M0 **not** reopened. M0 rerun = 0. `chainfm_out` not read. 1,433-wallet bulk not read. No credentials/raw provider payloads written into git by auditor.

### 4. Live evidence — ACCEPTED on exact tip

Prior implementer smoke (2 CA, 11 requests, budgets 10+10, 6+5 requests, non-exhausted completed paths) reviewed: scrubbed, public/fingerprint mint, no keys/URLs/raw payloads, total 11 ≤ 20, exclusion partial ⇒ concentration ineligible consistent.

**Post-smoke tip delta `327e77e…5734591`:** only changes “full utilization == exhausted” → “exhausted only on refused attempt”. Prior 6/10 and 5/10 paths never hit full utilization; transport path unchanged. Impact analysis in auditor scratch corroborates non-exhausted paths remain valid.

**Auditor re-smoke (not forged)** with runtime `HELIUS_API_KEY` on tip `5734591`:

| Field | Value |
| --- | --- |
| executedAtCommit | `57345911d54f132664c41753cd371d12c1166353` |
| publicCaCount | 1 |
| requestBudget | 9 |
| providerRequestCount | 6 |
| providerOperationCount | 3 |
| pageCount | 4 |
| retryCount | 0 |
| timeoutCount | 0 |
| status | completed |
| providerBudgetExhausted | false |
| paginationComplete | true |
| accountingEligible | true |
| exclusionCoverage | partial |
| concentrationEligible | false |
| scrubbedOutputSha | `8bf6dd45…` (matches prior CA1) |
| mintFingerprint | `1c2c7d3cac226153` |
| cumulativeSmokeRequests | 17 ≤ 20 |

### 5. Privacy / trust scans — CLEAR

`git grep` privacy pattern hits are documentation, harness history, and allowlisted policy references only. Classification:

```text
M0 rerun = 0
chainfm_out reads = 0
private wallet bulk = 0
credential persisted = 0
raw provider payload committed = 0
trading/signing = 0
Tier-B promoted confirmed = 0
```

Hotpath public summaries force concentration ratios `null` when `concentrationEligible` is false (exclusion partial).

## Why GREEN / ACCEPT_AND_MERGE

```text
no P0/P1                  ✓
offline gates acceptable  ✓ (doctor FAIL pre-existing P2 only)
Live evidence accepted    ✓ (exact-tip re-smoke)
trust semantics correct   ✓
privacy clear             ✓
```

## Boundaries observed by auditor

- No business-implementation edits
- No merge / push / squash / rebase / force-push performed by auditor
- No M0 rerun; no `chainfm_out`; no 1433 bulk; no credentials in git
- Next task after merge: `OPERATOR-CONSOLE-LIVE-WIRING-001` (not Stability)

## Artifacts

```text
harness/reports/SOL-CA-HOLDER-HOTPATH-INTEGRATION-001-AUDIT-001/acceptance.md
harness/reports/SOL-CA-HOLDER-HOTPATH-INTEGRATION-001-AUDIT-001/findings.json
harness/reports/SOL-CA-HOLDER-HOTPATH-INTEGRATION-001-AUDIT-001/gate-results.json
harness/reports/SOL-CA-HOLDER-HOTPATH-INTEGRATION-001-AUDIT-001/exact-write-set.txt
```
