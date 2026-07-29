# Acceptance Report: SOL-GMGN-WALLET-STATS-SINGLE-WALLET-TRANSPORT-7D-30D-LIVE-RESMOKE-001

## Live verdict

**GREEN_PENDING_AUDIT**

- Input hashes: MATCH
- Selection: first 2 valid unique strict-32-byte Solana addresses, plaintext never persisted
- Aggregate irreversible fingerprint: `28B0B1B4D6C450D6991D6EA75D8821A5954B509E4BD4F23DFEAC396AC3A6D144`
- Periods: 7d and 30d
- Wallets per invocation: 1
- CLI/provider budget used/cap: 4 / 4
- Strict serial spacing: at least 1,000ms
- Records: 4
- MAPPED / PARTIAL / UNAVAILABLE: 0 / 4 / 0
- All four wallet-period observations usable: true
- Source: `gmgn`; verificationStatus: `unverified`

## Field coverage

| Field | Ratio |
|---|---:|
| `periodPnl` | 0 |
| `realizedProfit` | 1 |
| `realizedProfitPnl` | 1 |
| `winRate` | 1 |
| `tradeCount` | 0 |
| `buyCount` | 1 |
| `sellCount` | 1 |
| `boughtCost` | 1 |
| `soldIncome` | 1 |
| `lastActiveTimestamp` | 0.25 |
| `tokenNum` | 1 |

## Allowlisted warnings

| Code | Count |
|---|---:|
| `gmgn_wallet_stats_partial_fields` | 4 |
| `gmgn_wallet_stats_period_unverified` | 4 |

## Boundary

No full rerun is authorized until the independent audit returns GREEN. No raw payload, raw stdout/stderr, address, label, key, proxy URL, or complete exception is retained.
