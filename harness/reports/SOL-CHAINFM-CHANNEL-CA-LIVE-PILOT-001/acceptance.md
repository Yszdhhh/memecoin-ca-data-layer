# SOL-CHAINFM-CHANNEL-CA-LIVE-PILOT-001 acceptance

## Outcome

**DEGRADED — the fixed seven-CA Helius-only pilot was invoked once, but the approved transport was unavailable for every bounded lookup. No raw provider response or exception text was retained.**

- Executed on: `2026-07-28`
- Chain: Solana only
- Provider: Helius only
- Trigger: one manual batch invocation
- Requested CAs: 7
- Request limit: 3 per CA, 21 maximum for this batch
- Batch status: `DEGRADED`
- Batch warnings: none

## Candidate provenance

The CAs below were manually frozen from Owner-directed visual review of the three specified Chain.fm channels. Channel labels and displayed market-cap figures are external, borrowed and unverified; they are not used as on-chain conclusions. The visible sample from channel `1307532946063757359` did not contribute a candidate represented as above USD 1 million.

## Sanitized CA-first summary

| CA | Status | Mint | Metadata | Holder token accounts | Completeness | Available / required | Mint finalized slot | Holder indexed slot | Warning codes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `H1adbGC578HdoddVNAZT1Bn4uNrPiioTCfYmRjBHpump` | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | 0 / 3 | unavailable | unavailable | `helius_transport_unavailable` x3 |
| `5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2` | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | 0 / 3 | unavailable | unavailable | `helius_transport_unavailable` x3 |
| `4N4DnNo3qpPks9aQCkcWkzoir8tnvT6diS4TnnZibonk` | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | 0 / 3 | unavailable | unavailable | `helius_transport_unavailable` x3 |
| `3BgwJ8b7b9hHX4sgfZ2KJhv9496CoVfsMK2YePevsBRw` | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | 0 / 3 | unavailable | unavailable | `helius_transport_unavailable` x3 |
| `9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump` | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | 0 / 3 | unavailable | unavailable | `helius_transport_unavailable` x3 |
| `Ge87EtsjwRQbHaqQmKRno69RFTwh9bfSsm99XNxTpump` | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | 0 / 3 | unavailable | unavailable | `helius_transport_unavailable` x3 |
| `Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs` | `DEGRADED` | unavailable | unavailable | unavailable | unavailable | 0 / 3 | unavailable | unavailable | `helius_transport_unavailable` x3 |

## Safety and boundary evidence

- The seven CAs were frozen in the tracked task spec; the batch did not discover, add, guess or substitute an address.
- Existing reviewed Base58 and strict 32-byte validation ran before data-source construction.
- The batch was Helius-only, read-only, manually triggered and bounded to at most three lookups per CA.
- This report contains only normalized availability, counts, slots and warning codes. It contains no credential, credential-bearing URL, raw provider payload, arbitrary provider text or full exception text.
- No Chain.fm page was automated, scraped, reverse engineered or used as a runtime provider. Chain.fm opaque account identifiers were not submitted as wallet addresses.
- No database, cache, queue, address library, schedule, production system, transaction, signing or trading action was invoked.
- The all-unavailable result supports no conclusion about token quality, holder concentration, creator or Dev behavior, wallet PnL, win rate or wallet classification.

## Interpretation

The CA-first execution boundary worked as designed: it accepted only the frozen valid CAs and failed closed with sanitized transport warning codes. This run did **not** produce usable on-chain mint, metadata or bounded token-account evidence because the Helius transport was unavailable. A later retry requires a separately dispatched task; this task forbids a second batch.