# Acceptance: SOL-GMGN-WALLET-STATS-30D-SAFE-ALIAS-SHAPE-DIAGNOSTIC-001

## Verdict

**SUCCESS — bounded diagnostic evidence captured.** This verdict does not authorize a batch run.

## Execution evidence

- Baseline / activation SHA: `cbd8d2aa7ebaa104b986a0b1ba2afe51a3b109dd`
- Period: `30d`
- Input hashes: exact match for both allowlisted external files.
- Target fingerprint: `2AB741591574CF0B8980E9D519C6783DD0274B266835E62D03591ED39E354E18`
- CLI invocation budget: **1 / 1**
- Physical Provider request upper bound: **1**
- Source: `gmgn`; verification status: `unverified`
- Safe output: `C:\Users\10639\chainfm_out\sol\derived\gmgn-wallet-stats-30d-safe-alias-shape-diagnostic-001\summary.json`

Two local runner setup attempts failed before process spawn and consumed zero Provider requests. The successful runner then consumed the single authorized request. No retry occurred after that request.

## Sanitized schema observations

No metric values were retained. Only alias, JSON type, canonical lexical class, and within-group relation were recorded.

- `realizedProfit`: only `realized_profit`, canonical finite numeric string.
- `realizedProfitPnl`: only `realized_profit_pnl`, canonical finite numeric string.
- `buyCount`: only `buy`, finite JSON number.
- `sellCount`: only `sell`, finite JSON number.
- `boughtCost`: both `bought_cost` and `total_cost` are canonical finite numeric strings, and their normalized values are **different**.
- `soldIncome`: only `sold_income`, canonical finite numeric string.
- `lastActiveTimestamp`: only `last_timestamp`, finite JSON number.
- `tokenNum`: only `pnl_stat.token_num`, finite JSON number.
- `winRate`: only `pnl_stat.winrate`, finite JSON number.
- `periodPnl` and `tradeCount`: no recognized alias present.

## Root cause supported by evidence

The 30d Parser failure is caused by treating `bought_cost` and `total_cost` as interchangeable aliases of one canonical metric. GMGN emits both fields with different values, so the current alias-conflict rule correctly fails closed but the schema model is incorrect. The pinned GMGN portfolio skill documents `total_cost` as period spend and separately uses `bought_cost` preferentially in its wallet-scoring example. A narrow repair must model these as distinct semantics or establish explicit field precedence; it must not silently merge conflicting values.

The 7d invalid-field warning remains consistent with `last_timestamp` being a finite number that may be zero. A repair must test non-negative timestamp semantics without inventing activity.

## Privacy and safety

No plaintext address, label, credential, proxy URL, provider payload, raw stdout/stderr, full exception, token identifier, or metric value was printed, persisted, or committed. No Helius, holdings, pagination, fallback, database, cache, queue, or production write was used.

## Next gate

Independent zero-network audit task `SOL-GMGN-WALLET-STATS-30D-SAFE-ALIAS-SHAPE-DIAGNOSTIC-001-AUDIT-001` is READY. Parser repair remains blocked until that audit is GREEN.
