# SOL-GMGN-WALLET-TRADING-STATS-LIVE-SMOKE-001 acceptance

## Outcome

**GREEN_WITH_ADVISORY — one manual, Solana-only, read-only GMGN portfolio-statistics screen completed within the declared two-invocation limit, but it yielded no safely mappable aggregate metrics for the eleven-wallet batch.**

- Executed on: `2026-07-28`
- Chain: Solana only
- Provider: GMGN only
- Trigger: one manual operator invocation
- Credential handling: `GMGN_API_KEY` was required by the child process and was never printed, stored or committed
- Input validation: all eleven frozen inputs Base58-decoded to exactly 32 bytes before either GMGN CLI process was constructed
- Request bound: exactly two `portfolio stats` CLI invocations — one `7d`, one `30d`; no pagination, retry, fallback, discovery or Helius call
- Source trust: all GMGN output is `borrowed_unverified`

## Sanitized result summary

The CLI completed both bounded invocations. Its retained output was reduced in memory to only wallet matching and an allowlisted numeric metric set (`trade_count`, `winrate`, `pnl`). The safe mapper found no allowlisted aggregate metrics. One address-shaped provider record was encountered per period, but it exposed none of the allowlisted metric fields; the other ten frozen wallets had no safely matchable record. No raw output was retained, so this report cannot distinguish a provider batch-response shape mismatch from missing per-wallet data.

All labels are user-provided and unverified. `PARTIAL` and `UNAVAILABLE` below are data-availability results, not wallet-quality, profitability or Alpha-tier judgments.

| Period | Wallet | User label | Status | Source status | Safe warning code |
| --- | --- | --- | --- | --- | --- |
| `7d` | `5K3N1vqmdgPNfk79SXJdmdhbR2q5KvcunZiWd6D7iTUT` | 高胜率 | `PARTIAL` | `borrowed_unverified` | `gmgn_expected_metrics_unavailable` |
| `7d` | `EzbeF2bADKo6GutJyWmgodyGJFeBPhcrXSdZUXPX5WGc` | profit 小号 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `7d` | `4jRX4iW2F5wBnfYMyB7RjS2PU5MjXrST3fB9DoV4BjHa` | Sun小号 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `7d` | `A44rJ9RcW1RhDdtNMr3FHm8GhanM9aQ5Kqhc6VqnCmff` | 0xSun 2 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `7d` | `5wQaABAbgA52cBks6zqXmk9nFftZgy18f78im6UxXhNU` | James | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `7d` | `HyriMMiB1aTi1y6EwUAHUGw2pgF995fzXhiEZAQWF2ib` | 落魄山 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `7d` | `79CxhdY2TeFHpGNcaHgnHJTWnv7KA3KgMFoeHrJg77ru` | jingtao | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `7d` | `8K5276kWCmRnS1TLTAKxRznM6NehtHkqCVWxcQhzHrwF` | 镭射猫 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `7d` | `DXAEnomAr94Mt1EQzEVts2pUBjJ32A48iaUinPRh9qrK` | 镭射猫 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `7d` | `A8CQVwoP5dyb3qmrG8YeZvD5jsrqF5UL8aruLjR6qWbH` | sol挑战赛第二 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `7d` | `EwTNPYTuwxMzrvL19nzBsSLXdAoEmVBKkisN87csKgtt` | DNF小号 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `30d` | `5K3N1vqmdgPNfk79SXJdmdhbR2q5KvcunZiWd6D7iTUT` | 高胜率 | `PARTIAL` | `borrowed_unverified` | `gmgn_expected_metrics_unavailable` |
| `30d` | `EzbeF2bADKo6GutJyWmgodyGJFeBPhcrXSdZUXPX5WGc` | profit 小号 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `30d` | `4jRX4iW2F5wBnfYMyB7RjS2PU5MjXrST3fB9DoV4BjHa` | Sun小号 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `30d` | `A44rJ9RcW1RhDdtNMr3FHm8GhanM9aQ5Kqhc6VqnCmff` | 0xSun 2 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `30d` | `5wQaABAbgA52cBks6zqXmk9nFftZgy18f78im6UxXhNU` | James | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `30d` | `HyriMMiB1aTi1y6EwUAHUGw2pgF995fzXhiEZAQWF2ib` | 落魄山 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `30d` | `79CxhdY2TeFHpGNcaHgnHJTWnv7KA3KgMFoeHrJg77ru` | jingtao | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `30d` | `8K5276kWCmRnS1TLTAKxRznM6NehtHkqCVWxcQhzHrwF` | 镭射猫 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `30d` | `DXAEnomAr94Mt1EQzEVts2pUBjJ32A48iaUinPRh9qrK` | 镭射猫 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `30d` | `A8CQVwoP5dyb3qmrG8YeZvD5jsrqF5UL8aruLjR6qWbH` | sol挑战赛第二 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |
| `30d` | `EwTNPYTuwxMzrvL19nzBsSLXdAoEmVBKkisN87csKgtt` | DNF小号 | `UNAVAILABLE` | n/a | `gmgn_wallet_metric_unavailable` |

## Cross-reference and interpretation

- This task made no Helius request. The previously committed Helius activity evidence remains a separate bounded, partial page observation; it neither confirms nor refutes GMGN portfolio statistics.
- This task does **not** establish a wallet's realized profit, win rate, quality, common ownership, clustering, address-library eligibility, complete history or Alpha N/R/SR/SSR/UR tier.
- The safe conclusion is operational: the current batch `portfolio stats` response cannot yet be consumed by the existing strict allowlisted mapper for these eleven inputs. A future repair must first add a committed, sanitized response-shape fixture and parser test, then use a new, separately dispatched live task if a fresh GMGN call is warranted. It must not silently retry this run.

## Boundary evidence

- No API key, credential-bearing URL, raw GMGN response, arbitrary provider text, full exception text, transaction signature, counterparty, mint or per-trade data is present in this report.
- No database, cache, queue, address library, scheduler, production write, order, signing, swap or trade was created.
- A local pre-spawn script syntax failure occurred before a GMGN CLI child process was created; it issued no provider request and did not affect the two bounded GMGN invocations recorded above.

## Harness acceptance status

`HARNESS-GMGN-WALLET-INPUT-EVIDENCE-REPAIR-001` replaced the nonexistent Helius audit-report input with the existing tracked audit document, then reran local Harness acceptance only. No GMGN, Helius or other provider request occurred during the repair. The repaired task spec validates and the local acceptance gate is reproducible.
