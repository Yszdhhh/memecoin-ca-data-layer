# Acceptance Report: SOL-GMGN-WALLET-STATS-SAFE-VALUE-SHAPE-DIAGNOSTIC-001

- **HARNESS_AGENT_ID:** `implementer-sol-gmgn-wallet-stats-safe-value-shape-diagnostic-001`
- **Baseline SHA:** `c0d8c95e01ba7899ab01fce2e33faf11838162ff`
- **Execution status:** **SUCCESS**

## Controlled execution

- Both allowlisted external input SHA-256 values matched exactly before the request.
- API-key presence: true; the value was neither displayed nor persisted.
- CLI invocation budget: 1 / 1.
- Physical provider request upper bound: 1.
- Period: 7d only.
- No retry, pagination, holdings, fallback, Helius, browser automation, database, queue, cache, or production write.
- Raw provider payload and stdout/stderr existed only transiently in process memory and were cleared after classification.

## Sanitized value-shape observations

Only allowlisted alias names, recognized locations, JSON types, and non-value lexical classes were retained:

| Location | Alias | JSON type | Numeric-string lexical class |
|---|---|---|---|
| root | bought_cost | string | canonical_integer |
| root | buy | number | n/a |
| root | last_timestamp | number | n/a |
| root | realized_profit | string | canonical_integer |
| root | realized_profit_pnl | string | canonical_integer |
| root | sell | number | n/a |
| root | sold_income | string | canonical_integer |
| root | total_cost | string | canonical_integer |
| root.pnl_stat | token_num | number | n/a |
| root.pnl_stat | winrate | number | n/a |

No value, address, wallet-keyed object key, label, credential, proxy URL, raw payload, raw stdout/stderr, token identifier, or complete exception was retained.

## Finding

The remaining parser blocker is confirmed: documented monetary/profit aliases can be returned as canonical numeric strings, while counts, timestamp, token count, and documented `pnl_stat.winrate` are JSON numbers. The parser currently rejects every string, causing `gmgn_wallet_stats_invalid_field_type` and loss of all core profit metrics. A narrow value-encoding repair may accept only canonical finite numeric strings for explicitly allowlisted numeric aliases, while continuing to reject whitespace, units, commas, hexadecimal notation, non-finite values, objects, arrays, and ambiguous generic win-rate encodings.

## Verdict

**GREEN.** The one-request diagnostic completed within budget and produced only sanitized evidence. This verdict authorizes the independent zero-network audit and, after that audit is GREEN, a narrow parser value-encoding repair. It does not authorize a batch run.
