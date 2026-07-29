# Dispatch: SOL-GMGN-PORTFOLIO-THREE-PATH-LIVE-DIAGNOSTIC-001

- **Task ID:** `SOL-GMGN-PORTFOLIO-THREE-PATH-LIVE-DIAGNOSTIC-001`
- **Role:** Internal Coordinator + Implementer
- **HARNESS_AGENT_ID:** `implementer-sol-gmgn-portfolio-three-path-live-diagnostic-001`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Baseline:** `ee24e2bb44f3cf0034ea7d139da10af928e1c9d3`
- **Network budget:** Max 3 CLI invocations (GMGN official CLI/API path only)

## Exact Assignment

Execute a single, manual, read-only, bounded 3-path live diagnostic for Solana GMGN portfolio queries:

1. Validate input file hashes:
   - `sol_addresses.txt`: `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C`
   - `sol_address_labels.json`: `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3`
2. Select the first valid Base58 32-byte Solana address in memory only.
3. Invocation 1: 7d stats (`portfolio stats --chain sol --period 7d --wallet <target> --raw`) with API-key-only env.
4. Invocation 2: 30d stats (`portfolio stats --chain sol --period 30d --wallet <target> --raw`) with API-key-only env (only if Invocation 1 succeeds).
5. Invocation 3: Signed holdings (`portfolio holdings --chain sol --wallet <target> --limit 50 --hide-closed false --raw`) with signed env (only if Invocation 1 and 2 succeed AND local private key preflight succeeds).
6. Total CLI invocation budget: <= 3. Strictly serial with >= 1000ms delay between calls.
7. Export sanitized output to `C:\Users\10639\chainfm_out\sol\derived\gmgn-portfolio-three-path-live-diagnostic-001\`.

## Non-Negotiable Boundaries

No Helius, Chain.fm, Dune, Dexscreener, Birdeye, BSC, Robinhood, RPC, web scraping, or browser automation. No auto retry, pagination cursor continuation, fallback, cron, or concurrency. No plaintext address, credentials, raw payload, or raw stdout/stderr in Git or console.
