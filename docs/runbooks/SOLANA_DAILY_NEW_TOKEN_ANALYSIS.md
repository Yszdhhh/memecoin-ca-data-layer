# Solana daily new-token analysis

## Current capability

This workflow is an explicit, bounded daily automation for Solana only. Each run:

1. asks the pinned `gmgn-cli` dependency for Solana candidates created within the previous 24 hours;
2. independently enforces market cap strictly greater than USD 1,000,000;
3. sorts by provider-reported market cap descending and keeps at most 10;
4. rejects the run rather than padding the list when fewer than 5 valid candidates remain;
5. validates every candidate as a strict 32-byte Solana address before constructing a Helius source;
6. reads bounded Helius mint, metadata, and token-account availability facts; and
7. writes only the normalized report to the current user's local application-data directory.

GMGN market, holder, creator, top-10, insider, bundler, sniper, and dev-team fields are retained only as allowlisted numeric/address claims and are marked `unverified_provider_claim`. This workflow does not claim independently reconstructed holder concentration, owner clustering, creator history, or a durable address library.

The workflow does not write a database, cache, queue, production service, or trading system. It has no background loop and no provider fallback. Windows Task Scheduler is the only recurring trigger.

## Secure credential injection

Run this once as the same Windows user that will own the scheduled task:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set-solana-daily-secrets.ps1
```

The script securely prompts for `GMGN_API_KEY` and `HELIUS_API_KEY`. It stores Windows DPAPI-encrypted values under `%LOCALAPPDATA%\memecoin-ca-data-layer\secrets` and never prints the plaintext values.

A personal GMGN API key is required for operational use. The repository-pinned CLI package is not treated as a production credential source.

## One-time run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-solana-daily-new-token-analysis.ps1
```

The default Helius endpoint mode is `gatekeeper_beta`, an explicitly allowlisted Helius-owned endpoint. To use the standard endpoint:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-solana-daily-new-token-analysis.ps1 -HeliusRpcEndpointMode mainnet
```

The process decrypts both keys only into process-local environment variables, clears those variables after the run, and zeroes the unmanaged plaintext buffers. Reports default to `%LOCALAPPDATA%\memecoin-ca-data-layer\reports`.

Exit codes:

- `0`: all selected candidates returned complete bounded Helius facts;
- `2`: the run completed with degraded Helius facts;
- `1`: discovery, validation, credential, or report execution was rejected.

## Register the daily trigger

After a successful one-time run, register a daily 09:00 trigger:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\register-solana-daily-new-token-analysis.ps1 -At 09:00
```

The task runs only while the same Windows user is logged on. This is intentional: the DPAPI files are scoped to that user and no unattended service credential is introduced.

Inspect the task without exposing secrets:

```powershell
Get-ScheduledTask -TaskName 'Memecoin CA Daily Solana Analysis' | Select-Object TaskName, State
```

Remove the trigger:

```powershell
Unregister-ScheduledTask -TaskName 'Memecoin CA Daily Solana Analysis' -Confirm:$false
```

## Report safety

Reports include normalized CA, safe symbol, provider-reported bounded market/risk numbers, Helius completeness, bounded counts, slots, and allowlisted warning codes. They do not include raw provider payloads, arbitrary provider error text, API keys, or credential-bearing URLs.
