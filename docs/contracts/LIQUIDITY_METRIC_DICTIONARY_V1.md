# Liquidity Metric Dictionary V1

| Metric | Formula / meaning | Window | Source tier |
| --- | --- | --- | --- |
| dexVolumeUsd | Sum DEX notional USD | daily point | B / Dune or public |
| swapCount | Count of swaps | daily point | B |
| activeAddresses | Distinct traders | daily point | B |
| newTokens | New mint launches | daily point | B |
| graduatedTokens | Bonding→AMM graduates | daily point | B |
| newPools | New pool accounts | daily point | B |
| protocolRevenueUsd | Protocol fees USD | daily point | B |
| compositeLevel | mean(log10(part)) over ≥3 available parts; else null | latest | DERIVED |
| dexVolumeUsd7d/30d percentile | median of available daily volumes in window | 7d/30d | DERIVED |

Null stays null. Stale snapshots retain prior values and mark `freshness=stale`.
