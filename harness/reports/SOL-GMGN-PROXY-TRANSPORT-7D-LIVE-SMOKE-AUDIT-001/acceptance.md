# Acceptance Report: SOL-GMGN-PROXY-TRANSPORT-7D-LIVE-SMOKE-AUDIT-001

## 1. Audit Metadata

- **Audit Task ID:** `SOL-GMGN-PROXY-TRANSPORT-7D-LIVE-SMOKE-AUDIT-001`
- **HARNESS_AGENT_ID:** `auditor-sol-gmgn-proxy-transport-7d-live-smoke-001`
- **Audited Task:** `SOL-GMGN-PROXY-TRANSPORT-7D-LIVE-SMOKE-001`
- **Implementer HARNESS_AGENT_ID (must differ):** `implementer-sol-gmgn-proxy-transport-7d-live-smoke-001`
- **Smoke delivery SHA:** `1159c313e788efd077e1f6a9fd828dfaab325d50`
- **Prior proxy repair audit SHA:** `73a415dc63a71d76ce67bfa362d1d1b1b9c6cb64`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Workspace clean at start:** PASS
- **Run ID:** `20260729130045_SOL-GMGN-PROXY-TRANSPORT-7D-LIVE-SMOKE-AUDIT-001`
- **network_requests:** `0`
- **provider_requests:** `0`
- **credential_reads:** `0`
- **proxy_url_values_inspected:** `0`

This audit is zero-network. External sanitized summary was inspected only for allowlisted fields (status, budget, fingerprint, codes).

## 2. Budget and Scope Verification

| Requirement | Evidence | Result |
| --- | --- | --- |
| Max 1 CLI invocation | `cliInvocationBudgetUsed: 1` / cap `1` | PASS |
| Max 1 physical provider upper bound | `physicalProviderRequestUpperBound: 1` | PASS |
| period=`7d` only | summary + code path | PASS |
| No 30d / holdings in this task | task forbidden_actions + single invocation module | PASS |
| No retry / pagination / fallback | code review of smoke module | PASS |
| Hash gate before spawn | synthetic tests + acceptance | PASS |
| API-key-only (no private key) | smoke uses `buildApiKeyOnlyGmgnCliEnvironment` | PASS |
| Proxy repair path active | depends on GREEN repair audit | PASS |

## 3. Live Result Honesty

| Claim | Justified? |
| --- | --- |
| Status `SUCCESS` with `MAPPED` record | YES — consistent summary + implementer report |
| No network/proxy/DNS/TLS/auth/rate-limit diagnostic | YES — `diagnosticCode: null`, empty warnings |
| `source=gmgn`, `verificationStatus=unverified` | YES |
| 7d transport recovery for this one-wallet smoke | YES |
| 30d recovered | NO — not tested |
| Signed holdings recovered | NO — not tested |
| Cumulative full pagination recovered | NO — not tested |
| Historical 100 / 1433 runs are valid profit datasets | NO — still invalid |

## 4. Privacy

PASS. Git evidence contains no plaintext address, credential, proxy URL, raw payload, or raw stderr. Fingerprint only.

## 5. Verdict Separation

| Axis | Verdict |
| --- | --- |
| A. Proxy/Transport offline repair | GREEN (prior) |
| B. 7d Live recovered (bounded smoke) | **GREEN / YES** |
| C. 30d Live | **NOT recovered (not tested)** |
| D. Signed Holdings | **NOT recovered (not tested)** |
| E. Cumulative full-pagination | **NOT recovered (not tested)** |

**Audit task verdict:** `GREEN`

GREEN certifies the one-request 7d smoke evidence is bound-correct and supports a scoped 7d transport recovery claim. It does **not** authorize 30d, holdings, batch mining, or cumulative PnL conclusions.

## 6. Downstream Clearance

- Allowed: separate exact tasks for one 30d invocation and one signed holdings single page, each with own audit.
- Forbidden: re-run 100/1433 wallets; claim cumulative profitability without full cursor pagination + dedupe audit.
