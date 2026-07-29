# Dispatch: SOL-GMGN-WALLET-STATS-PARSER-V2-7D-30D-LIVE-RESMOKE-001

- **Task ID:** `SOL-GMGN-WALLET-STATS-PARSER-V2-7D-30D-LIVE-RESMOKE-001`
- **Role:** Implementer
- **HARNESS_AGENT_ID:** `implementer-sol-gmgn-wallet-stats-parser-v2-7d-30d-live-resmoke-001`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Network budget:** Max 2 GMGN CLI invocations / max 2 physical provider requests (1 for 7d, 1 for 30d)

## Exact Assignment

1. Validate external input hashes before any provider request:
   - `sol_addresses.txt`: `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C`
   - `sol_address_labels.json`: `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3`
2. Select first valid unique Base58 32-byte Solana address in memory only.
3. Execute max 2 invocations:
   - First 7d request: `portfolio stats --chain sol --period 7d --wallet <target> --raw`
   - Delay at least 1,000ms
   - Second 30d request: `portfolio stats --chain sol --period 30d --wallet <target> --raw`
4. Use hardened Parser V2 (`src/infrastructure/gmgn/wallet-stats-parser.ts`) to parse real responses into 7d and 30d records.
5. No retries, no pagination, no holdings, no fallback, no batch 100/1433 wallets.
6. Export sanitized outputs to `C:\Users\10639\chainfm_out\sol\derived\gmgn-wallet-stats-parser-v2-7d-30d-live-resmoke-001\`.

## Privacy & Safety Contract

Never log, print, store, or commit plaintext wallet addresses, labels, API keys, private keys, proxy URLs, credential URLs, raw provider payloads, or raw stdout/stderr.
