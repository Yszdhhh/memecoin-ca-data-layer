# Acceptance Report: SOL-GMGN-PROXY-TRANSPORT-7D-LIVE-SMOKE-001

## 1. Run Identity

- **Task ID:** `SOL-GMGN-PROXY-TRANSPORT-7D-LIVE-SMOKE-001`
- **HARNESS_AGENT_ID:** `implementer-sol-gmgn-proxy-transport-7d-live-smoke-001`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Activation / code baseline SHA:** `73a415dc63a71d76ce67bfa362d1d1b1b9c6cb64` (proxy repair audit GREEN)
- **Smoke task materialization SHA:** `fe6a243f8c82757052de73d314686fa6207adf7b`
- **Harness run ID:** `20260729125621_SOL-GMGN-PROXY-TRANSPORT-7D-LIVE-SMOKE-001`
- **Live execution run ID:** `run-1785329782374`
- **Fetched at (UTC):** `2026-07-29T12:56:23.774Z`

## 2. Budget and Gate

| Control | Value |
| --- | --- |
| CLI invocation budget cap | `1` |
| CLI invocation budget used | `1` |
| Physical provider request upper bound | `1` |
| Period | `7d` only |
| Wallets | `1` (first valid unique Base58 32-byte address, in memory) |
| Retry | none |
| Pagination | none |
| 30d path | not executed |
| Signed holdings path | not executed |
| Secondary providers | none |

## 3. Input Verification

- `sol_addresses.txt` SHA-256: `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C` (match)
- `sol_address_labels.json` SHA-256: `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3` (match)
- Target fingerprint: `174CF1E8ECAD45A8184B4A86201480C37F16E51C2BE7892A3FA88BDE51CDD2D6`
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
| Source | `gmgn` |
| Verification status | `unverified` |
| Warning codes | `[]` |

Normalized aggregates were returned by the provider path for period `7d` (allowlisted fields only). Numeric zeros in the external file are provider-normalized values for this wallet/window, not fabricated fill-ins for missing fields. This smoke does **not** reinterpret historical 100-wallet (0/200 mapped) or 1,433-wallet (5/2866 mapped) outputs as valid profit datasets.

External sanitized outputs (outside Git):

- `C:\Users\10639\chainfm_out\sol\derived\gmgn-proxy-transport-7d-live-smoke-001\stats_7d.json`
- `C:\Users\10639\chainfm_out\sol\derived\gmgn-proxy-transport-7d-live-smoke-001\summary.json`

## 5. Recovery Assessment (mandatory axis split)

| Axis | Status |
| --- | --- |
| **A. Proxy/Transport code repair offline** | GREEN (prior independent audit) |
| **B. 7d Live recovered** | **YES** for this one-request smoke (parseable MAPPED record; no network/proxy/DNS/TLS/auth/rate-limit failure) |
| **C. 30d Live recovered** | **NOT tested** |
| **D. Signed Holdings recovered** | **NOT tested** |
| **E. Cumulative full-pagination recovered** | **NOT tested** |

7d recovery is scoped to: Solana, official GMGN CLI/API, one wallet, period=7d, one CLI invocation. It is **not** production readiness for batch mining or cumulative PnL.

## 6. Privacy

- No plaintext address, label, credential, proxy URL, raw payload, or raw stderr in Git evidence.
- Console output used fingerprint, booleans, counts, and allowlisted codes only.

## 7. Next Gate

`SOL-GMGN-PROXY-TRANSPORT-7D-LIVE-SMOKE-AUDIT-001` must be executed by a different `HARNESS_AGENT_ID` with zero network. Only after that audit is GREEN may separate exact tasks authorize:

1. one 30d stats invocation;
2. one signed holdings single-page invocation;

and only after full holdings cursor pagination + dedupe audit may cumulative profitability be claimed.
