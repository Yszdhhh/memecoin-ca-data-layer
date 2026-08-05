# Wallet replay MVP

`wallet-replay-v0.1` is a small offline sensitivity runner for historical wallet trade samples. It does not fetch providers, connect wallets, sign, or submit transactions.

The runner keeps four times separate: source trade time, observed time, simulated order time, and simulated fill time. It sorts trades by source time and uses later prices only as the fill outcome after the simulated fill time; later observations never change the decision timestamp.

Each scenario uses one fixed ticket size ($100, $500, or $1,000), a ten-ticket cash ceiling, observation delays of 5/15/30/60/180 seconds, execution delays of 0/5/15 seconds, and slippage of 0.5%/1%/2%/5%. SOL includes network, priority, and DEX fee assumptions. BSC includes gas, DEX fee, and 0%/2%/5%/10% token-tax sensitivity.

Unknown liquidity and unknown token risk have explicit conservative no-fill and sensitivity-only branches. A `proxy_full` or `allow_with_warning` result is an upper-bound mechanical sensitivity, not a chain fact. Provider PnL is carried as reported metadata and is never used as chain-reconstructed profit.

Run:

```text
npm run wallet:replay:v0-1 -- --input <private-standardized-input.json> --output-dir <private-output-dir>
```

The output is deterministic for the same normalized input. The private CLI output contains scenario rows, event rows, failures, assumptions, an anonymized summary, and note suggestions. Real wallet addresses and provider payloads stay outside Git.
