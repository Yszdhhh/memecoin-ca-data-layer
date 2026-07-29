# Dispatch: SOL-GMGN-WALLET-PROFILE-BATCH-100-LIVE-SMOKE-001

- **Role:** Implementer (internal Coordinator + Implementer)
- **Task spec:** `harness/tasks/SOL-GMGN-WALLET-PROFILE-BATCH-100-LIVE-SMOKE-001.json`
- **Agent identity:** `implementer-sol-gmgn-wallet-profile-batch-100-live-smoke-001`
- **Dependencies:** the audited GMGN wallet-profile pilot, pilot repair, and pilot audit are DONE.

## Objective

Perform exactly one manually triggered, read-only, Solana-only GMGN official-API smoke for the next 100 deterministic wallets: validate Base58 plus exact 32-byte decode, deduplicate in input order, skip the first 20 pilot wallets, then select positions 21–120. Fetch only `7d` and `30d`, serially, with a minimum 1,000 ms delay between adjacent requests and an absolute 200-request cap.

## Mandatory preflight

1. Verify the two external input SHA-256 values before reading selection output or making any network request.
2. If a hash differs, fail closed with an allowlisted code and make zero requests.
3. Only check whether `GMGN_API_KEY` exists. Do not print it. If absent, PARK with zero requests.
4. Never read, print, or pass `GMGN_PRIVATE_KEY` to the stats subprocess.
5. Before every `harness run start`, confirm `git status --short` is empty.

## Write set and evidence

Write only the declared task write set. The external normalized output may be written only to `C:/Users/10639/chainfm_out/sol/derived/gmgn-wallet-profile-batch-100-live-smoke-001/` and may include only allowlisted metric fields, completeness, safe warning codes, request budget use, `source`, `verificationStatus`, input fingerprint, and `fetchedAt`. Do not persist addresses, labels, credentials, raw payloads, credential URLs, or full provider exceptions.

The Git acceptance report must contain aggregates, input hashes, selection rule, one irreversible batch-selection fingerprint, field coverage, request budget, and allowlisted warning/error-code counts only.

## Forbidden actions

No Helius, BSC, Robinhood, other provider/fallback, browser/scraper/GMGN web page, database/cache/queue/production write, signing/trading, cron/background loop/autodiscovery, pagination expansion, retry loop, wallet-quality score, UR/N/P grade, or LLM conclusion.

## Required acceptance

Run the declared Harness validation commands plus the live smoke runner. After implementation evidence is GREEN, create the downstream audit handoff; its auditor must use a different `HARNESS_AGENT_ID` and send no live requests. The batch-100 completion gate remains open until that independent audit is GREEN.
