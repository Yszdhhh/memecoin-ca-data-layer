# Acceptance Report: SOL-GMGN-WALLET-PROFILE-BATCH-100-LIVE-SMOKE-001

## Execution Gate

- **Task ID**: `SOL-GMGN-WALLET-PROFILE-BATCH-100-LIVE-SMOKE-001`
- **Role / HARNESS_AGENT_ID**: implementer / `implementer-sol-gmgn-wallet-profile-batch-100-live-smoke-001`
- **Run status**: `DONE`
- **Remote completion SHA**: `aeaa5ca4422f022f180e1da7a5d6c8f103ea7815`
- **Independent-completion gate**: Completed under `SOL-GMGN-WALLET-PROFILE-BATCH-100-LIVE-SMOKE-AUDIT-001` (remote SHA `aeaa5ca4422f022f180e1da7a5d6c8f103ea7815`) and evidence-repaired under `HARNESS-SOL-GMGN-WALLET-PROFILE-BATCH-100-LIVE-SMOKE-EVIDENCE-REPAIR-001`.

## Input Evidence and Deterministic Selection

- **`sol_addresses.txt` SHA-256**: `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C`
- **`sol_address_labels.json` SHA-256**: `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3`
- **Hash gate passed before request eligibility**: `true`
- **Selection rule**: Base58 plus exact 32-byte validation and input-order deduplication; skip the first 20 valid unique pilot wallets and select positions 21–120 only.
- **Selected wallet count**: `100` (target: `100`)
- **Irreversible selected-fingerprint sequence SHA-256**: `5e180ffdf02db99070eae87daf2f37009ebf3e16a21c159003a32652084e0738`

## Request Budget and Aggregate Results

- **Periods**: `7d`, `30d`
- **Expected maximum requests**: `200`
- **Request budget used**: `200`
- **Budget respected**: `true`
- **Serial request minimum interval**: `>= 1,000ms`
- **Normalized records**: `200`
- **Mapped / partial / unavailable**: `0` / `0` / `200`
- **Average completeness**: `0`
- **GMGN classification**: `source: "gmgn"`, `verificationStatus: "unverified"` only.

## Field Coverage

| Allowlisted normalized field | Coverage |
|---|---:|
| `periodPnl` | 0% |
| `realizedProfit` | 0% |
| `realizedProfitPnl` | 0% |
| `winRate` | 0% |
| `tradeCount` | 0% |
| `buyCount` | 0% |
| `sellCount` | 0% |
| `boughtCost` | 0% |
| `soldIncome` | 0% |
| `lastActiveTimestamp` | 0% |
| `tokenNum` | 0% |

## Allowlisted Warning / Error Codes

| Code | Count |
|---|---:|
| `gmgn_request_unavailable` | 200 |

## Safety and Evidence Boundaries

- The external derived files contain only allowlisted normalized metrics, nulls for missing values, safe warning codes, request-budget data, source metadata, irreversible input fingerprints, and fetch timestamps.
- No plaintext addresses or labels, API/private keys, credential URLs, raw provider payloads, or complete provider exceptions are written to Git evidence or the normalized external output.
- The implementation is Solana-only, manual, single-run, read-only, GMGN-only, without Helius, BSC, Robinhood, scraping, browser automation, fallback providers, persistence systems, background/cron work, wallet-quality rankings, UR/N/P grading, or LLM conclusions.
- Harness command outcomes are recorded in the Harness run manifest; this report does not pre-assert verification success.
