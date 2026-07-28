# SOL-GMGN-WALLET-HOLDINGS-HISTORY-PILOT-001 acceptance

## Outcome

**PARK — the signed GMGN holdings request could not produce a safely parseable response in this one bounded live invocation.**

- Executed on: `2026-07-28`
- Chain: Solana only
- Provider: GMGN only
- Trigger: one manual operator invocation
- Frozen wallet: `5K3N1vqmdgPNfk79SXJdmdhbR2q5KvcunZiWd6D7iTUT`
- Credential presence: both `GMGN_API_KEY` and `GMGN_PRIVATE_KEY` were present; neither value was read, printed, stored or committed.
- Input validation: strict Base58 decoding and exact 32-byte validation passed before the GMGN CLI child process was constructed.
- Request bound: exactly one `portfolio holdings` CLI invocation; no cursor, pagination, retry, fallback, discovery, Helius call or other GMGN command.
- Request parameters: Solana; limit `50`; total-profit descending; interval `24h`; hide abnormal positions; hide airdrops; include closed positions.
- Source trust: GMGN results would be `borrowed_unverified` only.

## Sanitized result

The single CLI child process did not return a successful, safely parseable holdings response. The raw stdout, stderr, exit detail and any provider text were retained only in process memory and were discarded. Therefore this run records only the stable safe status code:

| Status | GMGN invocations | First-page holdings | Historical-profit fields | Safe code |
| --- | ---: | ---: | --- | --- |
| `PARK` | `1` | unavailable | unavailable | `gmgn_request_unavailable` |

This shows that adding a private-key environment variable is **not yet sufficient evidence** that this machine can retrieve GMGN holdings/history-profit data. It does not identify the cause because diagnostic text was intentionally not persisted, and it must not be read as a statement about the wallet's profitability, activity, win rate, complete history, quality, clustering or Alpha tier.

## Boundary evidence

- No API key, private key, credential-bearing URL, raw GMGN payload, arbitrary provider text, full exception text, token mint/name, transaction signature, counterparty or per-trade record is present in this report.
- No chain transaction, signing operation, swap, order, trade, database, cache, queue, address-library write, scheduler or production write occurred.
- No Helius request occurred.

## Next step

A separate no-network, credential/CLI diagnostic task is required before another GMGN live request. Its scope must establish the local signed-CLI configuration path without emitting sensitive details. The independent audit task `SOL-GMGN-WALLET-HOLDINGS-HISTORY-PILOT-AUDIT-001` is dispatched separately and must use a different `HARNESS_AGENT_ID`.
