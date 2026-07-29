# Acceptance Report: SOL-GMGN-PROXY-TRANSPORT-30D-LIVE-SMOKE-001

## 1. Run Identity

- **Task ID:** `SOL-GMGN-PROXY-TRANSPORT-30D-LIVE-SMOKE-001`
- **HARNESS_AGENT_ID:** `implementer-sol-gmgn-proxy-transport-30d-live-smoke-001`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Push Gate baseline SHA:** `ac93c939cd40fe4362d60b874d8e2cf726efcffd`
- **Activation / materialization SHA:** `5c7ddc50581e38b2ecdc98639fa42024123fc8f0`
- **Live execution run ID:** `run-1785333023219`
- **Fetched at (UTC):** `2026-07-29T13:50:25.310Z`

## 2. Budget and Gate

| Control | Value |
| --- | --- |
| CLI invocation budget cap | `1` |
| CLI invocation budget used | `1` |
| Physical provider request upper bound | `1` |
| Period | `30d` only |
| Wallets | `1` (first valid unique Base58 32-byte address, in memory; same rule as 7d) |
| Retry | none |
| Pagination | none |
| 7d path | not executed |
| Signed holdings path | not executed |
| Secondary providers | none |
| DB / Redis / cache / queue writes | none |

## 3. Input Verification

- `sol_addresses.txt` SHA-256: `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C` (match)
- `sol_address_labels.json` SHA-256: `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3` (match)
- Target fingerprint: `174CF1E8ECAD45A8184B4A86201480C37F16E51C2BE7892A3FA88BDE51CDD2D6` (matches 7d smoke)
- API key present (boolean only): `true`
- Private key: not used (API-key-only stats path)

## 4. Live Result

| Field | Value |
| --- | --- |
| Status | `SUCCESS` |
| Diagnostic code | `null` |
| Mapped record present | `true` |
| Record status | `MAPPED` |
| Completeness | `1` |
| Explicit provider numeric fields | `11/11` allowlisted metric keys present |
| Source | `gmgn` |
| Verification status | `unverified` |
| Warning codes | `[]` |

Normalized aggregates were returned by the provider path for period `30d` (allowlisted fields only). Numeric zeros in the external file are provider-normalized values for this wallet/window, not fabricated fill-ins for missing fields. `lastActiveTimestamp` was an explicit non-zero provider value. This smoke does **not** claim on-chain verified profitability, signed holdings recovery, or cumulative full-pagination recovery.

External sanitized outputs (outside Git):

- `C:\Users\10639\chainfm_out\sol\derived\gmgn-proxy-transport-30d-live-smoke-001\stats_30d.json`
- `C:\Users\10639\chainfm_out\sol\derived\gmgn-proxy-transport-30d-live-smoke-001\summary.json`

## 5. Recovery Assessment (mandatory axis split)

| Axis | Status |
| --- | --- |
| **A. Proxy/Transport code repair offline** | GREEN (prior independent audits) |
| **B. 7d Live recovered** | YES (prior independent 7d audit GREEN) |
| **C. 30d Live recovered** | **YES (scoped implementer claim)** for this one-request smoke (parseable MAPPED record; fingerprint bound; no network/proxy/DNS/TLS/auth/rate-limit failure). Final scoped recovery requires independent audit GREEN. |
| **D. Signed Holdings recovered** | **NOT tested** |
| **E. Cumulative full-pagination recovered** | **NOT tested** |

30d recovery is scoped to: Solana, official GMGN CLI/API, one wallet, period=30d, one CLI invocation. Explicit all-zero profit metrics prove transport/auth/parse success for this window only and do **not** verify profitability accuracy.

## 6. Privacy

- No plaintext address, label, credential, proxy URL, raw payload, or raw stderr in Git evidence.
- Console output used fingerprint, booleans, counts, and allowlisted codes only.

## 7. Next Gate

`SOL-GMGN-PROXY-TRANSPORT-30D-LIVE-SMOKE-AUDIT-001` must be executed by a different `HARNESS_AGENT_ID` (`auditor-sol-gmgn-proxy-transport-30d-live-smoke-001`) with zero network. Only after that audit is GREEN may a separate exact task authorize one signed holdings single-page live smoke. Cumulative profitability remains forbidden until full cursor pagination + dedupe audit.
