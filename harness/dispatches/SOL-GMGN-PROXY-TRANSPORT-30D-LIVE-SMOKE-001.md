# Dispatch: SOL-GMGN-PROXY-TRANSPORT-30D-LIVE-SMOKE-001

- **Task ID:** `SOL-GMGN-PROXY-TRANSPORT-30D-LIVE-SMOKE-001`
- **Role:** Implementer
- **HARNESS_AGENT_ID:** `implementer-sol-gmgn-proxy-transport-30d-live-smoke-001`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Network budget:** Max 1 GMGN CLI invocation / max 1 physical provider request
- **Independent auditor (must not be implementer):** `auditor-sol-gmgn-proxy-transport-30d-live-smoke-001`
- **Independent audit task:** `SOL-GMGN-PROXY-TRANSPORT-30D-LIVE-SMOKE-AUDIT-001`

## Exact Assignment

1. Validate external input hashes before any provider request:
   - `sol_addresses.txt`: `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C`
   - `sol_address_labels.json`: `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3`
2. Select first valid unique Base58 32-byte Solana address in memory only (same rule as 7d smoke).
3. Bind irreversible target fingerprint using the same identity formula as 7d smoke; expected:
   `174CF1E8ECAD45A8184B4A86201480C37F16E51C2BE7892A3FA88BDE51CDD2D6`. Fingerprint mismatch = FAIL_CLOSED, 0 provider requests, no plaintext address output.
4. Exactly one invocation: `portfolio stats --chain sol --period 30d --wallet <target> --raw` with API-key-only env (proxy allowlist + fixed NODE_OPTIONS from boundary repair; `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS=0`).
5. No 7d, no holdings, no retry, no pagination, no fallback, no Helius/third-party, no batch 100/1433, no DB/Redis/cache writes.
6. Export sanitized output only to `C:\Users\10639\chainfm_out\sol\derived\gmgn-proxy-transport-30d-live-smoke-001\`.

## Success criteria for declaring 30d scoped recovery

Provider requests ≤ 1; `period=30d`; input hashes match; fingerprint matches 7d; parseable GMGN response bound to target; at least one explicit provider numeric field; `diagnosticCode=null`; null-for-missing (no fabricated zeros); `source=gmgn`; `verificationStatus=unverified`; no address/credential/payload leakage; independent 30d audit GREEN. Explicit all-zero provider values may prove transport/auth/parse success but do not verify profitability accuracy. Auth 401/403 = `gmgn_cli_auth_rejected` (UNAVAILABLE). 429 = `gmgn_cli_rate_limited` (no retry).

## Forbidden claims

- Signed Holdings recovery
- Cumulative full-pagination recovery
- On-chain verified profitability
