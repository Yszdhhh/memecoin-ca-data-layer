# Dispatch: SOL-GMGN-PROXY-TRANSPORT-7D-LIVE-SMOKE-001

- **Task ID:** `SOL-GMGN-PROXY-TRANSPORT-7D-LIVE-SMOKE-001`
- **Role:** Implementer
- **HARNESS_AGENT_ID:** `implementer-sol-gmgn-proxy-transport-7d-live-smoke-001`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Network budget:** Max 1 GMGN CLI invocation / max 1 physical provider request

## Exact Assignment

1. Validate external input hashes before any provider request:
   - `sol_addresses.txt`: `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C`
   - `sol_address_labels.json`: `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3`
2. Select first valid unique Base58 32-byte Solana address in memory only.
3. Exactly one invocation: `portfolio stats --chain sol --period 7d --wallet <target> --raw` with API-key-only env (proxy allowlist + fixed NODE_OPTIONS from boundary repair).
4. No 30d, no holdings, no retry, no pagination, no fallback.
5. Export sanitized output only to `C:\Users\10639\chainfm_out\sol\derived\gmgn-proxy-transport-7d-live-smoke-001\`.

## Success criteria for declaring 7d recovery

Provider requests ≤ 1; no network/proxy/DNS/TLS error; parseable GMGN response; at least one normalized record for target; period=7d; null-for-missing; source=gmgn; verificationStatus=unverified; no address/credential/payload leakage. Auth 401/403 = network may work but credentials not restored. 429 = safe rate-limit, no retry.
