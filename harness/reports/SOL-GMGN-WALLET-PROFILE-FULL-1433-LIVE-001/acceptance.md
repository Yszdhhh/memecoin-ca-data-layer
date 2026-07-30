# Acceptance Report: SOL-GMGN-WALLET-PROFILE-FULL-1433-LIVE-001

## Execution Gate

- **Task ID**: `SOL-GMGN-WALLET-PROFILE-FULL-1433-LIVE-001`
- **Role / HARNESS_AGENT_ID**: implementer / `implementer-sol-gmgn-wallet-profile-full-1433-live-001`
- **Run status**: `SUCCESS`
- **Independent-completion gate**: This full 1433 run is **not complete** until `SOL-GMGN-WALLET-PROFILE-FULL-1433-LIVE-AUDIT-001` produces valid GREEN audit evidence from a different agent identity (`auditor-sol-gmgn-wallet-profile-full-1433-live-001`).

## Input Evidence and Deterministic Selection

- **`sol_addresses.txt` SHA-256**: `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C`
- **`sol_address_labels.json` SHA-256**: `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3`
- **Hash gate passed before request eligibility**: `true`
- **Selection rule**: Base58 plus exact 32-byte validation and input-order deduplication; select all 1,433 valid unique addresses in input sequence.
- **Selected wallet count**: `1433` (target: `1433`)
- **Irreversible selected-fingerprint sequence SHA-256**: `4a00cec89a6c353527670c935ded799f3ec03bc066d9a0eef9c0d9f30eca0088`

## Request Budget and Aggregate Results

- **Periods**: `7d`, `30d`
- **Expected maximum requests**: `2866`
- **Request budget used**: `2866`
- **Budget respected**: `true`
- **Serial request minimum interval**: `>= 1,000ms`
- **Normalized records**: `2866`
- **Mapped / partial / unavailable**: `5` / `0` / `2861`
- **Average completeness**: `0`
- **GMGN classification**: `source: "gmgn"`, `verificationStatus: "unverified"` only.

## Field Coverage

| Allowlisted normalized field | Coverage |
|---|---:|
| `periodPnl` | 0.17% |
| `realizedProfit` | 0.17% |
| `realizedProfitPnl` | 0.17% |
| `winRate` | 0.17% |
| `tradeCount` | 0.17% |
| `buyCount` | 0.17% |
| `sellCount` | 0.17% |
| `boughtCost` | 0.17% |
| `soldIncome` | 0.17% |
| `lastActiveTimestamp` | 0.07% |
| `tokenNum` | 0.17% |

## Allowlisted Warning / Error Codes

| Code | Count |
|---|---:|
| `gmgn_request_unavailable` | 2861 |

## Safety and Evidence Boundaries

- The external derived files contain only allowlisted normalized metrics, nulls for missing values, safe warning codes, request-budget data, source metadata, irreversible input fingerprints, and fetch timestamps.
- No plaintext addresses or labels, API/private keys, credential URLs, raw provider payloads, or complete provider exceptions are written to Git evidence or the normalized external output.
- The acceptance report contains only the single aggregate sequence fingerprint; no per-address fingerprint table is emitted.
- The implementation is Solana-only, manual, single-run, read-only, GMGN-only, without Helius, BSC, Robinhood, scraping, browser automation, fallback providers, persistence systems, background/cron work, wallet-quality rankings, UR/N/P grading, or LLM conclusions.
- Harness command outcomes are recorded in the Harness run manifest; this report does not pre-assert verification success.
