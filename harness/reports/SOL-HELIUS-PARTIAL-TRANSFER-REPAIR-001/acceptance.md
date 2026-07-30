# SOL-HELIUS-PARTIAL-TRANSFER-REPAIR-001 acceptance

## Outcome

**GREEN_WITH_ADVISORY — the strict parser repair preserved valid bounded transaction activity when individual transfer events could not be safely normalized. A post-repair, Helius-only, read-only production-environment smoke completed successfully for all eleven frozen wallets.**

- Executed on: `2026-07-28`
- Chain: Solana only
- Provider: Helius only
- Trigger: one manual invocation
- Query lower bound: `2020-01-01T00:00:00.000Z` (used only to retain the provider's bounded newest returned page)
- Request bounds: one enhanced-address request per wallet, eleven requests total, pagination disabled
- Input validation: all eleven inputs Base58-decoded to exactly 32 bytes before any source was created
- Runtime credential handling: used only at the provider boundary; no credential value was printed, stored, or committed
- Overall status: `OK` for 11 / 11 wallet reads

## Sanitized latest-returned-page summary

All user labels below are user-provided and unverified. No raw provider payload, transaction signature, counterparty, token mint, credential, credential-bearing URL, arbitrary provider text, or full exception text is recorded.

| Wallet | User label | Status | Latest observed activity date | Oldest observed activity date | Returned transactions | Safely normalized token-transfer events | Safely normalized native-transfer events | Bounded-page completeness | Latest observed slot |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |
| `5K3N1vqmdgPNfk79SXJdmdhbR2q5KvcunZiWd6D7iTUT` | 高胜率 | `OK` | 2026-07-28 | 2026-07-23 | 100 | 10 | 474 | `partial` | 435732232 |
| `EzbeF2bADKo6GutJyWmgodyGJFeBPhcrXSdZUXPX5WGc` | profit 小号 | `OK` | 2026-07-28 | 2026-07-28 | 100 | 1 | 367 | `partial` | 435742934 |
| `4jRX4iW2F5wBnfYMyB7RjS2PU5MjXrST3fB9DoV4BjHa` | Sun小号 | `OK` | 2026-07-28 | 2026-07-19 | 100 | 16 | 220 | `partial` | 435713824 |
| `A44rJ9RcW1RhDdtNMr3FHm8GhanM9aQ5Kqhc6VqnCmff` | 0xSun 2 | `OK` | 2026-07-25 | 2025-09-16 | 100 | 0 | 1291 | `partial` | 435149595 |
| `5wQaABAbgA52cBks6zqXmk9nFftZgy18f78im6UxXhNU` | James | `OK` | 2026-01-09 | 2024-10-19 | 100 | 42 | 1121 | `partial` | 392331395 |
| `HyriMMiB1aTi1y6EwUAHUGw2pgF995fzXhiEZAQWF2ib` | 落魄山 | `OK` | 2026-05-02 | 2024-08-15 | 100 | 18 | 900 | `partial` | 417131465 |
| `79CxhdY2TeFHpGNcaHgnHJTWnv7KA3KgMFoeHrJg77ru` | jingtao | `OK` | 2026-07-09 | 2025-02-13 | 100 | 22 | 856 | `partial` | 431749578 |
| `8K5276kWCmRnS1TLTAKxRznM6NehtHkqCVWxcQhzHrwF` | 镭射猫 | `OK` | 2026-07-28 | 2025-08-07 | 100 | 16 | 763 | `partial` | 435738212 |
| `DXAEnomAr94Mt1EQzEVts2pUBjJ32A48iaUinPRh9qrK` | 镭射猫 | `OK` | 2026-03-10 | 2024-05-12 | 100 | 50 | 554 | `partial` | 405503232 |
| `A8CQVwoP5dyb3qmrG8YeZvD5jsrqF5UL8aruLjR6qWbH` | sol挑战赛第二 | `OK` | 2026-07-28 | 2026-07-06 | 100 | 12 | 195 | `partial` | 435710275 |
| `EwTNPYTuwxMzrvL19nzBsSLXdAoEmVBKkisN87csKgtt` | DNF小号 | `OK` | 2026-07-27 | 2026-07-14 | 100 | 358 | 364 | `partial` | 435622902 |

## Repair and boundary evidence

- The tracked parser still rejects malformed transaction identity fields (signature, slot, timestamp) and still refuses to invent token account, user account, mint, or amount fields.
- If an individual token-transfer or native-transfer event cannot be safely normalized, it is omitted and the enclosing source response watermark is marked `partial`; the valid transaction activity record remains available. The focused unit tests cover both the partial-event path and unchanged fail-closed core-transaction validation.
- All eleven returned pages contain the provider limit of 100 transactions, so every row is `partial` regardless of any event-level omission. There was no pagination, retry, fallback provider, GMGN, Dune, Chain.fm, BSC, Robinhood, database, cache, queue, address library, schedule, production write, transaction, signing, swap, or trading action.
- The report retains only bounded dates, aggregate counts, completeness, slot, status and user-provided-unverified labels. Token/native event counts are counts of safely normalized events within the bounded page; they are not total transfer counts or complete history.

## Interpretation

The data now supports a bounded, manual Helius read of the latest returned transaction page for each listed wallet. It does **not** establish PnL, realized profit, win rate, wallet quality, wallet classification, common ownership, address clustering, CA linkage, holder concentration, creator/Dev history, token recommendations, or a complete transaction history. A `partial` watermark means the visible page is capped and must not be treated as a full historical record.
