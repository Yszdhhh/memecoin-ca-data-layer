# SOL-HELIUS-MANUAL-CA-BATCH-LIVE-SMOKE-001

## Verdict

PARK

## Scope

- Manual one-time trigger; ten fixed public Solana CAs.
- Helius-only, read-only, fail-closed.
- Started UTC: 2026-07-28T05:46:45.5519797Z
- Finished UTC: 2026-07-28T05:46:50.0047979Z
- CLI status: DEGRADED; CLI exit code: 1.
- Request budget: at most 3 Helius reads per CA, at most 30 for the batch.

## Sanitized results

| CA | Status | Completeness | Holder token-account count | Source slots (mint/metadata/holders) | Warning codes | Budget satisfied |
|---|---:|---:|---:|---|---|---|
| `H3GtwGSrYRVqp7dtjkaDfjE2inydLkHwFkFJSPzrpump` | DEGRADED | unavailable (0/3) | - | - | `helius_transport_unavailable` | yes (<=3/CA) |
| `EUx9N4UXDyAXJpziyLF36j6Ut3Gu9X3VKEGptbmfpump` | DEGRADED | unavailable (0/3) | - | - | `helius_transport_unavailable` | yes (<=3/CA) |
| `H1adbGC578HdoddVNAZT1Bn4uNrPiioTCfYmRjBHpump` | DEGRADED | unavailable (0/3) | - | - | `helius_transport_unavailable` | yes (<=3/CA) |
| `Ai66LHZG9MCzg1WKdawwqduVAXpNDUuV8M3uyq5ppump` | DEGRADED | unavailable (0/3) | - | - | `helius_transport_unavailable` | yes (<=3/CA) |
| `Ge87EtsjwRQbHaqQmKRno69RFTwh9bfSsm99XNxTpump` | DEGRADED | unavailable (0/3) | - | - | `helius_transport_unavailable` | yes (<=3/CA) |
| `9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump` | DEGRADED | unavailable (0/3) | - | - | `helius_transport_unavailable` | yes (<=3/CA) |
| `BQYc6c5hivsPrEEmTxBVjGT16setk2gmPvbv7YBxpump` | DEGRADED | unavailable (0/3) | - | - | `helius_transport_unavailable` | yes (<=3/CA) |
| `4NBTf8PfLH4oLFnwf3knv46FY9i5oXjDxffCetXRpump` | DEGRADED | unavailable (0/3) | - | - | `helius_transport_unavailable` | yes (<=3/CA) |
| `Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump` | DEGRADED | unavailable (0/3) | - | - | `helius_transport_unavailable` | yes (<=3/CA) |
| `9ZtbETDNjnST9Y2zs82FZYy49xUMPgqXRh46YjjRpump` | DEGRADED | unavailable (0/3) | - | - | `helius_transport_unavailable` | yes (<=3/CA) |

## Assessment

The fixed batch executed fail-closed, but no CA produced a complete Helius result in this environment. All retained warning evidence is the allowlisted code `helius_transport_unavailable`; arbitrary transport/provider text was discarded.

No credential value, credential-bearing URL, provider payload, full exception text, database/cache/queue write, scheduler, fallback provider, BSC, Robinhood, creator/Dev profile, holder-concentration claim, or address-library write was recorded or enabled.
