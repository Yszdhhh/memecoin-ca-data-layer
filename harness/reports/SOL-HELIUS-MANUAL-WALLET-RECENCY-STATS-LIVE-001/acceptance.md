# SOL-HELIUS-MANUAL-WALLET-RECENCY-STATS-LIVE-001 acceptance

## Outcome

**GREEN_WITH_ADVISORY — one bounded Helius-only production-environment read was attempted for all eleven frozen, valid public Solana wallets. The configured Helius enhanced-address path did not return usable history, so no activity date or aggregate statistic is inferred.**

- Executed on: `2026-07-28`
- Chain: Solana only
- Provider: Helius only
- Trigger: one manual invocation
- Query lower bound: `2020-01-01T00:00:00.000Z` (used only to retain the bounded newest returned page, not complete history)
- Request bounds: one enhanced-address request per wallet, eleven attempted requests total, pagination disabled
- Input validation: all eleven inputs Base58-decoded to exactly 32 bytes before any source was created
- Runtime credential handling: the configured credential was used only at the provider boundary; its value was not printed, stored, or committed
- Overall status: `DEGRADED`

## Sanitized latest-returned-page summary

All user labels below are user-provided and unverified. No raw provider payload, transaction signature, counterparty, token mint, credential, credential-bearing URL, arbitrary provider text, or full exception text is recorded.

| Wallet | User label | Status | Latest observed activity date | Oldest observed activity date | Returned transactions | Token-transfer events | Native-transfer events | Bounded-page completeness | Latest observed slot | Warning code |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| `5K3N1vqmdgPNfk79SXJdmdhbR2q5KvcunZiWd6D7iTUT` | 高胜率 | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable | `helius_live_read_unavailable` |
| `EzbeF2bADKo6GutJyWmgodyGJFeBPhcrXSdZUXPX5WGc` | profit 小号 | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable | `helius_live_read_unavailable` |
| `4jRX4iW2F5wBnfYMyB7RjS2PU5MjXrST3fB9DoV4BjHa` | Sun小号 | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable | `helius_live_read_unavailable` |
| `A44rJ9RcW1RhDdtNMr3FHm8GhanM9aQ5Kqhc6VqnCmff` | 0xSun 2 | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable | `helius_live_read_unavailable` |
| `5wQaABAbgA52cBks6zqXmk9nFftZgy18f78im6UxXhNU` | James | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable | `helius_live_read_unavailable` |
| `HyriMMiB1aTi1y6EwUAHUGw2pgF995fzXhiEZAQWF2ib` | 落魄山 | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable | `helius_live_read_unavailable` |
| `79CxhdY2TeFHpGNcaHgnHJTWnv7KA3KgMFoeHrJg77ru` | jingtao | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable | `helius_live_read_unavailable` |
| `8K5276kWCmRnS1TLTAKxRznM6NehtHkqCVWxcQhzHrwF` | 镭射猫 | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable | `helius_live_read_unavailable` |
| `DXAEnomAr94Mt1EQzEVts2pUBjJ32A48iaUinPRh9qrK` | 镭射猫 | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable | `helius_live_read_unavailable` |
| `A8CQVwoP5dyb3qmrG8YeZvD5jsrqF5UL8aruLjR6qWbH` | sol挑战赛第二 | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable | `helius_live_read_unavailable` |
| `EwTNPYTuwxMzrvL19nzBsSLXdAoEmVBKkisN87csKgtt` | DNF小号 | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable | `helius_live_read_unavailable` |

## Boundary evidence

- The task froze exactly the eleven Owner-supplied wallet addresses. It did not discover, add, infer, substitute, classify, or cluster any wallet.
- Each address was normalized by the existing strict Solana Base58/32-byte validation before construction of any Helius source and before every provider request.
- The run attempted one Helius enhanced-address history read for each frozen wallet, for eleven attempted reads total. There was no pagination, retry, fallback provider, GMGN, Dune, Chain.fm, BSC, Robinhood, database, cache, queue, address library, schedule, production write, transaction, signing, swap, or trading action.
- The report stores only allowlisted status, bounded aggregate fields, bounded-page completeness, slot availability, and stable warning codes. The unusable response path is represented by the safe `helius_live_read_unavailable` code rather than provider text.

## Interpretation

This run does **not** establish a recent activity date, wallet PnL, realized profit, win rate, wallet quality, wallet classification, common ownership, address clustering, CA linkage, holder concentration, creator/Dev history, token recommendation, or a complete transaction history. Although the runtime credential was present, the configured Helius enhanced-address read did not yield usable data in this one bounded attempt. The result is therefore availability evidence only; all activity metrics remain unavailable rather than being inferred from user labels.
