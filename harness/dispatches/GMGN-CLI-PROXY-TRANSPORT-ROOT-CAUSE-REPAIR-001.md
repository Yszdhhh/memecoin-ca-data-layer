# Dispatch: GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-001

- **Task ID:** `GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-001`
- **Role:** Implementer
- **HARNESS_AGENT_ID:** `implementer-gmgn-cli-proxy-transport-root-cause-repair-001`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Network budget:** `0` (offline only)

## Exact Assignment

1. Prove offline that disposable isolation currently strips `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` while the Windows parent has them set, and that gmgn-cli@1.5.4 configures undici `ProxyAgent` from those env vars at startup.
2. Repair `src/application/gmgn/gmgn-cli-boundary.ts`:
   - Keep disposable HOME / USERPROFILE / APPDATA / LOCALAPPDATA / CWD isolation.
   - Allowlist-forward only `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` (and case-insensitive parent lookup; write canonical uppercase to the child).
   - Proxy URL schemes allowed: `http` / `https` only; invalid scheme fail-closed with safe code `gmgn_cli_proxy_configuration_invalid` (never embed the URL in the error).
   - Do not forward `ALL_PROXY`.
   - Never inherit parent `NODE_OPTIONS`; set fixed child `NODE_OPTIONS=--use-env-proxy --dns-result-order=ipv4first`.
   - Keep `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS=0`, 30s timeout, stats never forwards private key, signed preflight unchanged.
3. Expand in-memory failure classification with specific safe codes; clear raw text after classification; never put raw stderr into test failures.
4. Clear three-path doctor blockers without changing live behavior contracts.
5. Offline synthetic tests covering the required proxy/isolation/privacy matrix.
6. Write acceptance report stating **A only** (code repair). Do not claim B–E live recovery.

## Non-Negotiable Boundaries

Zero live requests. Zero proxy URL / credential / address leakage. No CLI upgrade. No 100/1433 re-run. Independent audit required before any one-request 7d live smoke.
