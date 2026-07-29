# Acceptance Report: GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-AUDIT-001

## 1. Audit Metadata

- **Audit Task ID:** `GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-AUDIT-001`
- **HARNESS_AGENT_ID:** `auditor-gmgn-cli-proxy-transport-root-cause-repair-001`
- **Audited Task:** `GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-001`
- **Implementer HARNESS_AGENT_ID (must differ):** `implementer-gmgn-cli-proxy-transport-root-cause-repair-001`
- **Repair baseline SHA:** `a435992280134e4b2b3cc9a3f31cb84ade630172`
- **Repair implementation delivery SHA:** `31422e4f53d7fcab0b6b51fb5ddcfb7e28ad943a`
- **Repair harness completion SHA:** `9fc699cbc4f505d23fce884826e896c17cc052f2`
- **Local HEAD at audit start:** `9fc699cbc4f505d23fce884826e896c17cc052f2`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Workspace clean at start:** PASS
- **Run ID:** `20260729125328_GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-AUDIT-001`
- **network_requests:** `0`
- **provider_requests:** `0`
- **address_processing:** `0`
- **credential_reads:** `0`
- **proxy_url_values_inspected_or_printed:** `0`

## 2. Itemized Code Contract Review

### A. Proxy allowlist and fail-closed scheme gate

| Check | Result |
| --- | --- |
| Only `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` forwarded | PASS (`PROXY_ENVIRONMENT_KEYS`) |
| `ALL_PROXY` never forwarded | PASS |
| Case-insensitive parent lookup, canonical uppercase child keys | PASS |
| `http:` / `https:` only for proxy URLs | PASS (`isAllowedHttpProxyUrl`) |
| Illegal scheme → `GmgnCliEnvironmentError` code only, no URL in message | PASS |
| Empty / absent proxy → direct mode, no forged proxy vars | PASS (synthetic tests) |

### B. Isolation and NODE_OPTIONS

| Check | Result |
| --- | --- |
| Disposable HOME / USERPROFILE / APPDATA / LOCALAPPDATA / CWD | PASS |
| Parent `NODE_OPTIONS` not in runtime allowlist | PASS |
| Fixed child `NODE_OPTIONS=--use-env-proxy --dns-result-order=ipv4first` | PASS |
| `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS=0` | PASS |
| Timeout 30_000 ms retained on invocations | PASS |

### C. Credential boundaries

| Check | Result |
| --- | --- |
| Stats / exist-auth path never forwards `GMGN_PRIVATE_KEY` | PASS |
| Signed path still requires local structural preflight | PASS |
| No ambient HOME GMGN config read to bypass credentials | PASS (disposable empty home) |

### D. Safe diagnostics

| Check | Result |
| --- | --- |
| Expanded codes: dns, proxy config, proxy connect, refused, reset, TLS, network, auth, rate-limit, etc. | PASS |
| Classifier returns only allowlisted codes | PASS |
| Synthetic tests assert proxy secret tokens never appear in codes or public snapshots | PASS |
| CLI stats/holdings argument contracts unchanged by proxy repair | PASS |

### E. Live recovery claims

| Axis | Audited claim |
| --- | --- |
| A. Proxy/transport offline repair | Allowed to assert offline completeness only after this GREEN |
| B. 7d Live | **NOT recovered / not claimed** |
| C. 30d Live | **NOT recovered / not claimed** |
| D. Signed Holdings | **NOT recovered / not claimed** |
| E. Cumulative full pagination | **NOT recovered / not claimed** |

Implementer acceptance correctly separates axes and forbids using this repair as live proof.

## 3. Findings

| ID | Finding | Severity |
| --- | --- | --- |
| — | None blocking | — |

Advisory (non-blocking): live availability remains unproven until a separately audited one-request 7d smoke.

## 4. Offline Gates

Executed as acceptance commands of this audit (local toolchain only; zero provider intent):

| Command | Result |
| --- | --- |
| task validate (this audit) | PASS / GREEN |
| harness:doctor | PASS (at verify; see evidence correction below) |
| typecheck | PASS (at verify) |
| test | PASS (at verify) |
| build | PASS (at verify) |
| git diff --check | PASS (at verify) |

## 4b. Evidence correction (Harness declared input — ledger only)

Historical note (not erased): this audit recorded `harness:doctor` as PASS at its original verify time.

Reproducible fact at final 7d audit HEAD `42c375ec95ac5d6fe2fec49920485114133b7759`: Doctor later failed because the audited task still declared untracked input `node_modules/gmgn-cli/package.json`.

This is a **ledger/input-evidence** defect only. It does not invalidate the offline proxy/transport code contracts reviewed in §2 of this audit, nor does it re-open or re-interpret the subsequent 7d live smoke results.

Ledger repair is performed offline by `HARNESS-GMGN-PROXY-TRANSPORT-INPUT-EVIDENCE-REPAIR-001` (0 provider/network; no GMGN implementation change; no live re-run). Post-correction Doctor GREEN is recorded on that evidence-repair acceptance report.

## 5. Verdict

**Audit task verdict:** `GREEN`

GREEN means the offline proxy/transport repair and safety contracts are correct. GREEN does **not** mean GMGN live 7d/30d/holdings works. GREEN at original audit time does not waive later Doctor failure caused by an untracked declared input; that ledger issue is corrected separately.

## 6. Downstream clearance

- **Allowed:** create and execute `SOL-GMGN-PROXY-TRANSPORT-7D-LIVE-SMOKE-001` with exact budget: Solana, 1 wallet, period=7d, max 1 CLI invocation, max 1 physical provider request, no retry/pagination/fallback.
- **Forbidden:** re-run 100/1433 wallets; simultaneous 30d + holdings in the first smoke; claim recovery without live smoke + independent live smoke audit GREEN.
