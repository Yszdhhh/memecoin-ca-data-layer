# Acceptance Report: SOL-GMGN-WALLET-STATS-FULL-1433-LIVE-RERUN-001

## Execution verdict

**PARKED_DATA_QUALITY** - transport completed within budget, but the normalized dataset is not acceptable for completion.

## Input and selection evidence

- Input SHA-256 verification: MATCH
- Approved sol_addresses.txt SHA-256: `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C`
- Approved sol_address_labels.json SHA-256: `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3`
- Selection rule: all valid unique Solana Base58 strict-32-byte addresses in deterministic cleaned-input order
- Selected count: 1433
- Aggregate irreversible selection fingerprint: `4A00CEC89A6C353527670C935DED799F3EC03BC066D9A0EEF9C0D9F30ECA0088`

## Request budget and outcomes

- Periods: `7d`, `30d`
- Wallets per CLI invocation cap: 20
- Planned invocations per period: 72
- CLI invocation/provider upper bound: 144
- CLI invocation budget used: 144
- Budget respected: true
- Execution ordering: strictly serial, at least 1,000ms between adjacent invocations
- Normalized records: 2866
- MAPPED / PARTIAL / UNAVAILABLE: 0 / 114 / 2752
- Average completeness: 0.0306
- Source semantics: `source: "gmgn"`, `verificationStatus: "unverified"`

## Field coverage

| Allowlisted normalized field | Coverage ratio |
|---|---:|
| `periodPnl` | 0 |
| `realizedProfit` | 0.0398 |
| `realizedProfitPnl` | 0.0398 |
| `winRate` | 0.0398 |
| `tradeCount` | 0 |
| `buyCount` | 0.0398 |
| `sellCount` | 0.0398 |
| `boughtCost` | 0.0398 |
| `soldIncome` | 0.0398 |
| `lastActiveTimestamp` | 0.0178 |
| `tokenNum` | 0.0398 |

## Allowlisted warning/error codes

| Code | Count |
|---|---:|
| `gmgn_expected_metrics_unavailable` | 30 |
| `gmgn_wallet_stats_partial_fields` | 114 |
| `gmgn_wallet_stats_period_unverified` | 114 |
| `gmgn_wallet_stats_schema_unrecognized` | 2152 |

## Safety boundaries

- External normalized output was written only under `C:/Users/10639/chainfm_out/sol/derived/gmgn-wallet-stats-full-1433-live-rerun-001/`.
- No plaintext address or label, API/private key, credential or proxy URL, raw provider payload, raw stdout/stderr, token or transaction identifier, counterparty data, or complete exception is stored in Git evidence or external normalized output.
- Missing fields remain null. Provider-supplied zeros remain explicit zeros and are not interpreted as verified profitability.
- No Helius, signed holdings, other provider, fallback, retry, pagination, concurrency, persistence system, ranking, or LLM conclusion was used.
- Historical 100-wallet and 1,433-wallet outputs were not overwritten or reinterpreted.

## Completion boundary

This execution is preserved as immutable diagnostic evidence and is **not** an accepted full dataset: 2,752 / 2,866 records are UNAVAILABLE, including 2,152 `gmgn_wallet_stats_schema_unrecognized` outcomes. The exact batch-position pattern shows only one parseable record in each successful 20-wallet provider response, so the 20-wallet batching assumption requires a narrow transport/schema diagnostic and repair. The downstream audit remains blocked, and any corrected full rerun must use a new task ID and a new external output directory rather than overwriting this evidence.
