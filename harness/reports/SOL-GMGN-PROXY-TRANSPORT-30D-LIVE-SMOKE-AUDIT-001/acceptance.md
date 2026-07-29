# Acceptance Report: SOL-GMGN-PROXY-TRANSPORT-30D-LIVE-SMOKE-AUDIT-001

## 1. Audit Metadata

| Field | Value |
| --- | --- |
| Audit Task ID | `SOL-GMGN-PROXY-TRANSPORT-30D-LIVE-SMOKE-AUDIT-001` |
| Independent HARNESS_AGENT_ID | `auditor-sol-gmgn-proxy-transport-30d-live-smoke-001` |
| Audited Task ID | `SOL-GMGN-PROXY-TRANSPORT-30D-LIVE-SMOKE-001` |
| Implementer HARNESS_AGENT_ID (must differ) | `implementer-sol-gmgn-proxy-transport-30d-live-smoke-001` |
| Audited implementation delivery SHA | `5759e2150335ece4140fa9df7306848099c320b4` |
| Audit start HEAD | `5759e2150335ece4140fa9df7306848099c320b4` |
| Remote `origin/codex/solana-daily-new-token-analysis` at start | `5759e2150335ece4140fa9df7306848099c320b4` |
| Local/remote parity at start | PASS (identical) |
| Workspace clean at start | PASS (`git status --short` empty) |
| Branch | `codex/solana-daily-new-token-analysis` |
| network_requests | `0` |
| provider_requests | `0` |
| GMGN CLI live invocations | `0` |
| address_processing | `0` |
| credential_value_reads | `0` |
| proxy_url_values_inspected_or_printed | `0` |

This audit is zero-network and read-only on application code. Only allowlisted sanitized external aggregates/summary fields, Git/Harness evidence, and offline tests were inspected. No plaintext addresses, labels, credentials, proxy URLs, raw payloads, or raw stdout/stderr were opened from input files or provider artifacts.

## 2. Prerequisite Gate

| Prerequisite | Evidence | Result |
| --- | --- | --- |
| Audited task DONE | ledger + task status | PASS |
| Audit task READY at start | task JSON + ledger | PASS |
| Harness Doctor GREEN | offline command | PASS |
| Implementer Run ID | `run-1785333023219` (acceptance + sanitized summary) | PASS |
| CLI Invocation used = 1 | summary + acceptance | PASS |
| Physical provider upper bound = 1 | summary + acceptance + code | PASS |
| period = 30d | summary + stats + code path | PASS |
| Status SUCCESS | summary + stats + acceptance | PASS |
| Record MAPPED | implementer acceptance; completeness=1 + explicitNumericFieldCount=11 consistent with MAPPED path | PASS |
| diagnosticCode null | summary + stats | PASS |
| Target fingerprint equals audited 7d smoke fingerprint | `174CF1E8ECAD45A8184B4A86201480C37F16E51C2BE7892A3FA88BDE51CDD2D6` in 7d and 30d sanitized evidence; shared salt formula in source (no plaintext address read) | PASS |
| Fingerprint verified without reading plaintext address files | compared fingerprints and code salt only | PASS |

## 3. Offline Verification Commands

Pre-condition: `git status --short` empty before each harness-related batch.

| Command | Result |
| --- | --- |
| `npm run harness:task -- validate harness/tasks/SOL-GMGN-PROXY-TRANSPORT-30D-LIVE-SMOKE-AUDIT-001.json` | GREEN, `errors: []` |
| `npm run harness:doctor` | GREEN, `errors: []`, `warnings: []` |
| `npm run typecheck` | exit 0 |
| `npm test` | 284 passed, 1 skipped, 0 failed |
| `npm run build` | exit 0 |
| `git diff --check` | exit 0 |
| `npx tsx --test test/application/gmgn/proxy-transport-30d-live-smoke.test.ts test/gmgn-wallet-stats-parser.test.ts` | 8/8 passed, offline |

## 4. A. Git and Evidence Chain

| Check | Result |
| --- | --- |
| Delivery SHA = local HEAD = origin branch | PASS `5759e2150335ece4140fa9df7306848099c320b4` |
| Workspace clean before audit writes | PASS |
| 30d implementer task DONE | PASS |
| Audit task READY at start | PASS |
| Run ID / hashes / fingerprint consistent across task, manifest, implementer acceptance, sanitized summary | PASS |
| Historical 7d smoke and proxy-transport repair evidence not rewritten by this audit | PASS (read-only) |
| 7d independent audit still GREEN | PASS (`SOL-GMGN-PROXY-TRANSPORT-7D-LIVE-SMOKE-AUDIT-001`) |
| 30d fingerprint equals 7d fingerprint without wallet plaintext in Git/report | PASS |

Activation SHA cited by implementer (`5c7ddc50581e38b2ecdc98639fa42024123fc8f0`) and push-gate baseline (`ac93c939cd40fe4362d60b874d8e2cf726efcffd`) are present in implementer acceptance and are consistent with git history ancestry of the delivery SHA. This audit does not re-execute live smoke.

## 5. B. Request Budget and Command Boundary

| Requirement | Evidence | Result |
| --- | --- | --- |
| Max and actual 1 CLI invocation | code single `execute`; summary `cliInvocationBudgetUsed: 1`; synthetic tests | PASS |
| period fixed `30d` | `buildGmgnStatsInvocation({ period: "30d" })`; summary/stats | PASS |
| No 7d call | 30d module never builds 7d invocation; test asserts args exclude `7d` | PASS |
| No holdings call | only stats builder used; test asserts no `holdings` | PASS |
| No pagination/cursor | stats path has no cursor args | PASS |
| No auto-retry | single execute; `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS=0` | PASS |
| No concurrency | single serial path | PASS |
| No fallback providers | GMGN stats only | PASS |
| physicalProviderRequestUpperBound = 1 | code + summary | PASS |
| Failure does not issue second request | post-execute always finishes once; failure tests used=1 with no re-execute | PASS |

## 6. C. API-Key-Only Isolation and Proxy

| Requirement | Evidence | Result |
| --- | --- | --- |
| Stats uses API-key-only env builder | `buildApiKeyOnlyGmgnCliEnvironment` | PASS |
| `GMGN_PRIVATE_KEY` not read/forwarded on stats path | explicit comment + builder never sets private key; test asserts undefined | PASS |
| Disposable HOME/CWD | `createGmgnCliIsolation` + cleanup in finally | PASS |
| Proxy allowlist only HTTP_PROXY/HTTPS_PROXY/NO_PROXY (+ case-insensitive parent lookup) | `PROXY_ENVIRONMENT_KEYS` | PASS |
| ALL_PROXY never forwarded | not in allowlist | PASS |
| Non-http(s) proxy scheme fail-closed | `isAllowedHttpProxyUrl` + `gmgn_cli_proxy_configuration_invalid` | PASS |
| Fixed child NODE_OPTIONS; parent not inherited | `GMGN_NODE_OPTIONS`; runtime key list excludes parent NODE_OPTIONS | PASS |
| CLI auto rate-limit retry disabled | `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS=0` | PASS |
| Fixed subprocess timeout | `GMGN_CLI_TIMEOUT_MS = 30_000` applied on invocation | PASS |
| Raw stdout/stderr not persisted to Git or sanitized exports | only allowlisted codes/fields written; classifier drops opaque text | PASS |

## 7. D. Input Boundary and Privacy

| Requirement | Evidence | Result |
| --- | --- | --- |
| Expected input SHA-256 match declared hashes | manifest + acceptance + constants | PASS (declared values identical; auditor did not open plaintext address files) |
| Hash mismatch → 0 invocations | synthetic test | PASS |
| Fingerprint mismatch → 0 invocations + no address leakage | synthetic test | PASS |
| Target selection does not write wallet plaintext to Git/report/sanitized exports | export schema uses fingerprint only; CLI logs fingerprint/booleans | PASS |
| External outputs contain no wallet/label/key/proxy/raw payload/full exception | inspected allowlisted keys only in sanitized JSON | PASS |
| Fingerprint treated as irreversible evidence | no reverse attempt performed | PASS |

## 8. E. Sanitized 30d Output Semantics

Allowlisted fields from external sanitized artifacts (no non-allowlisted data copied):

| Field | Observed | Required | Result |
| --- | --- | --- | --- |
| period | `30d` | `30d` | PASS |
| status | `SUCCESS` | `SUCCESS` | PASS |
| diagnosticCode | `null` | `null` | PASS |
| source | `gmgn` | `gmgn` | PASS |
| verificationStatus | `unverified` | `unverified` | PASS |
| requestBudgetUsed | `1` | `1` | PASS |
| cliInvocationBudgetUsed | `1` | `1` | PASS |
| physicalProviderRequestUpperBound | `1` | `1` | PASS |
| completeness | `1` | consistent with MAPPED path | PASS |
| explicitNumericFieldCount | `11` | ≥1 explicit numeric | PASS |
| warningCodes | `[]` | empty or allowlisted | PASS |
| targetFingerprint / sourceInputFingerprint | `174CF1E8…CDD2D6` | same as 7d | PASS |
| inputHashesMatch | `true` | true | PASS |
| lastActiveTimestamp | non-zero number present | may be explicit provider-mapped value | PASS (as mapped sanitized number) |

**Null vs explicit 0 semantics**

- Sanitized export uses `metricOrNull`: missing aggregate keys become JSON `null`; present numeric values (including `0`) are preserved as numbers.
- Observed zeros for profit/trade/count fields are recorded as **parser-mapped explicit numeric zeros in the sanitized result**, not auditor-proved raw provider field-path values.
- Auditor **cannot** independently re-prove raw provider payload field paths because raw payloads are intentionally not retained.
- Therefore the allowed statement is only: sanitized results record parser-mapped explicit zeros (and one non-zero `lastActiveTimestamp`). It is **not** an independent proof of raw provider payload contents.

No evidence was found that the runner fabricates zeros for missing fields on the success path used by this smoke.

## 9. F. Parser Schema / Completeness / Winrate Risk Review

Shared parser inspected read-only as a transitive dependency. **No parser repairs performed.**

| # | Question | Observation | Severity |
| --- | --- | --- | --- |
| 1 | Broad recursive alias scan? | Yes — multi-key sets + recursive `collectCandidates` / `collectAggregates` | Advisory |
| 2 | Nested sub-object field composition? | Yes — nested walk can fill different aggregate keys from different depths | Advisory |
| 3 | Candidate scoring prefers deeper candidates? | Yes — `candidateScore` adds `depth * 2` | Advisory |
| 4 | Any single aggregate field ⇒ MAPPED? | Yes — `Object.keys(aggregates).length > 0` → MAPPED | Advisory |
| 5 | Runner maps any MAPPED → completeness=1? | Yes | Advisory |
| 6 | winRate 0–1 vs 0–100 ambiguity? | Accepts finite numbers in `[0, 100]`; does not pin unit contract | Advisory |
| 7 | Synthetic `buy_30d` recognized by parser? | **No** — `BUY_COUNT_KEYS` lacks `buy_30d`; fixture success relies on other aliases (`pnl`, `realized_profit`) | Advisory |
| 8 | Tests pin exact GMGN CLI 1.5.4 stats schema? | No — synthetic envelopes / partial aliases only | Advisory |
| 9 | period=30d enforced only by CLI args? | Yes — parser does not validate response period | Advisory |
| 10 | All-zero metrics + non-null lastActiveTimestamp | Sanitized mapping observation only; needs schema-contract hardening, not transport rejection | Advisory |

These findings **do not overturn** one-request transport/auth/basic parse recovery for this bounded smoke. They **do block** treating sanitized zeros as a profit dataset, batch re-runs, or cumulative profitability claims.

## 10. G. Recovery Claim Boundaries

| Axis | Audit answer |
| --- | --- |
| 1. Proxy/Transport recovered? | **YES (scoped)** — supported by prior GREEN repair audit + GREEN 7d audit + this 30d smoke evidence chain |
| 2. API-key-only Stats auth recovered? | **YES (scoped)** for this one-wallet stats path |
| 3. Single-wallet 30d Stats live smoke recovered? | **YES (bounded smoke)** — one request, period=30d, SUCCESS/MAPPED path, fingerprint-bound, privacy intact |
| 4. Exact 30d field schema semantics fully verified? | **NO** — parser alias breadth / completeness / winrate / period-response contract still need hardening |
| 5. Signed Holdings recovered? | **NOT tested** |
| 6. Full cursor pagination recovered? | **NOT tested** |
| 7. Cumulative profitability recovered? | **NO / NOT recovered** |
| 8. Re-run 100 wallets authorized? | **NO** — not authorized; parser schema + pagination gates first |
| 9. Re-run 1,433 wallets authorized? | **NO** — not authorized |

## 11. Findings Table

| ID | Finding | Severity | Blocks 30d bounded recovery? |
| --- | --- | --- | --- |
| F1 | Wallet-stats parser uses broad recursive alias scanning and nested field composition | Advisory | No |
| F2 | Candidate scoring can prefer deeper nodes; one mapped aggregate yields MAPPED | Advisory | No |
| F3 | Runner completeness=1 for any MAPPED record overstates schema completeness | Advisory | No |
| F4 | winRate unit (fraction vs percent) not strictly locked | Advisory | No |
| F5 | No raw payload retention → auditor cannot re-prove exact provider field paths | Advisory (by design) | No |
| F6 | Synthetic fixture uses `buy_30d`, which parser does not map; tests do not pin GMGN CLI 1.5.4 exact stats schema | Advisory | No |
| F7 | Response period not validated by parser; period trust is CLI-arg-only | Advisory | No |
| F8 | All-zero mapped metrics with non-zero lastActiveTimestamp is a schema-semantics observation only | Advisory | No |

No RED findings (no fabricated zeros on success path, no address/credential/proxy leakage in Git evidence, no budget overrun, no wrong period, no second request, no holdings/signed path execution in this task).

## 12. Final Verdict

### Verdict: `GREEN_WITH_ADVISORY`

**Meaning of this verdict**

- Core controls for this task are established: one CLI invocation, period=`30d`, API-key-only, proxy isolation/fail-closed, hash/fingerprint gates, sanitized exports, SUCCESS with mapped aggregates, diagnosticCode null, fingerprint parity with audited 7d smoke, offline quality gates green.
- Advisory parser/schema issues remain and are recorded above. They do **not** overturn bounded 30d transport/auth/basic-parse recovery, but they **prevent** expansion to batch profit datasets or cumulative profitability conclusions.

**This GREEN_WITH_ADVISORY confirms only:**

- single wallet;
- single request;
- period=`30d`;
- API-key-only;
- GMGN Stats;
- bounded live smoke;
- `source=gmgn`;
- `verificationStatus=unverified`.

**This verdict does not confirm:**

- Signed Holdings recovery;
- full cursor pagination recovery;
- cumulative profitability recovery;
- promotion of GMGN data to chain-confirmed fact;
- UR/N/P wallet tiers;
- LLM scoring;
- authorization to re-run 100 or 1,433 wallets.

## 13. Downstream Unlock Scope

| Downstream | Allowed now? |
| --- | --- |
| Declare 30d single-wallet bounded smoke recovered (scoped, unverified borrow path) | YES |
| Create exact follow-up task for parser schema contract hardening | YES (recommended) |
| Signed Holdings single-page live smoke | Only via a **separate exact task** after this audit completes; not authorized by this report alone as “recovered” |
| Full cursor pagination / cumulative PnL | NO until dedicated pagination+dedupe tasks + audits |
| Batch 100 / 1,433 re-run | NO / not recommended until parser schema contract + holdings pagination validation |

### Recommended next task (not executed here)

`GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-001`

Must include its own independent audit. Auditor of this task must not implement that repair.

## 14. Write-Set and Post-Audit Git Notes

Allowed writes for this audit only:

1. `harness/reports/SOL-GMGN-PROXY-TRANSPORT-30D-LIVE-SMOKE-AUDIT-001/acceptance.md`
2. `harness/tasks/SOL-GMGN-PROXY-TRANSPORT-30D-LIVE-SMOKE-AUDIT-001.json` (status update only)
3. `harness/ledger/tasks.json` (this audit task status only)

Audit completion SHA and remote parity are recorded after the normal commit/push of the audit write set (no force push; no amend of implementer history).
