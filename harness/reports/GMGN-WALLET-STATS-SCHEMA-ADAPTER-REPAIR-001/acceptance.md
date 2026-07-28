# GMGN wallet stats schema-adapter repair acceptance

## Scope

- Manual, read-only Solana GMGN portfolio-stats batch for exactly eleven Owner-supplied public wallets.
- Credential presence checked: true; key value was not read or emitted.
- Base58/32-byte validation before spawn: passed for all eleven.
- GMGN CLI invocations: 2 (one 7d, one 30d); no pagination, retry, Helius call, fallback or other GMGN command.
- Parser version: `gmgn-wallet-stats-v1`.

## Sanitized borrowed observations

| Period | Wallet | User label (unverified) | Status | Source | Mapping | Provider-reported period PnL (unverified) | Provider-reported win rate (unverified) | Provider-reported trade count (unverified) | Safe code |
|---|---|---|---|---|---|---:|---:|---:|---|
7d | 5K3N1vqmdgPNfk79SXJdmdhbR2q5KvcunZiWd6D7iTUT | 高胜率 | MAPPED | borrowed_unverified | direct_identity | 27578.206025720632 | 0.7142857142857143 | n/a | none
7d | EzbeF2bADKo6GutJyWmgodyGJFeBPhcrXSdZUXPX5WGc | profit 小号 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
7d | 4jRX4iW2F5wBnfYMyB7RjS2PU5MjXrST3fB9DoV4BjHa | Sun小号 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
7d | A44rJ9RcW1RhDdtNMr3FHm8GhanM9aQ5Kqhc6VqnCmff | 0xSun 2 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
7d | 5wQaABAbgA52cBks6zqXmk9nFftZgy18f78im6UxXhNU | James | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
7d | HyriMMiB1aTi1y6EwUAHUGw2pgF995fzXhiEZAQWF2ib | 落魄山 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
7d | 79CxhdY2TeFHpGNcaHgnHJTWnv7KA3KgMFoeHrJg77ru | jingtao | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
7d | 8K5276kWCmRnS1TLTAKxRznM6NehtHkqCVWxcQhzHrwF | 镭射猫 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
7d | DXAEnomAr94Mt1EQzEVts2pUBjJ32A48iaUinPRh9qrK | 镭射猫 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
7d | A8CQVwoP5dyb3qmrG8YeZvD5jsrqF5UL8aruLjR6qWbH | sol挑战赛第二 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
7d | EwTNPYTuwxMzrvL19nzBsSLXdAoEmVBKkisN87csKgtt | DNF小号 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
30d | 5K3N1vqmdgPNfk79SXJdmdhbR2q5KvcunZiWd6D7iTUT | 高胜率 | MAPPED | borrowed_unverified | direct_identity | 137995.41856632265 | 0.5364238410596026 | n/a | none
30d | EzbeF2bADKo6GutJyWmgodyGJFeBPhcrXSdZUXPX5WGc | profit 小号 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
30d | 4jRX4iW2F5wBnfYMyB7RjS2PU5MjXrST3fB9DoV4BjHa | Sun小号 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
30d | A44rJ9RcW1RhDdtNMr3FHm8GhanM9aQ5Kqhc6VqnCmff | 0xSun 2 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
30d | 5wQaABAbgA52cBks6zqXmk9nFftZgy18f78im6UxXhNU | James | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
30d | HyriMMiB1aTi1y6EwUAHUGw2pgF995fzXhiEZAQWF2ib | 落魄山 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
30d | 79CxhdY2TeFHpGNcaHgnHJTWnv7KA3KgMFoeHrJg77ru | jingtao | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
30d | 8K5276kWCmRnS1TLTAKxRznM6NehtHkqCVWxcQhzHrwF | 镭射猫 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
30d | DXAEnomAr94Mt1EQzEVts2pUBjJ32A48iaUinPRh9qrK | 镭射猫 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
30d | A8CQVwoP5dyb3qmrG8YeZvD5jsrqF5UL8aruLjR6qWbH | sol挑战赛第二 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable
30d | EwTNPYTuwxMzrvL19nzBsSLXdAoEmVBKkisN87csKgtt | DNF小号 | UNAVAILABLE | borrowed_unverified | n/a | n/a | n/a | n/a | gmgn_wallet_metric_unavailable

## Interpretation and boundaries

- Any mapped numeric field is a GMGN **borrowed/unverified** aggregate for the requested `7d` or `30d` period only. It is not cumulative/all-time profit and does not establish realized chain-verified PnL, wallet quality, clustering, address-library eligibility, complete history or Alpha N/R/SR/SSR/UR tier.
- User labels are user-provided and unverified. The frozen wallet list was neither discovered nor expanded.
- The report deliberately contains no API key, credential-bearing URL, raw provider payload, arbitrary provider text, full exception text, signature, counterparty, mint or per-trade record.
- No database, cache, queue, scheduler, address-library or production write occurred.
