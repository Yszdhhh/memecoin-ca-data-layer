# Acceptance Report: SOL-GMGN-WALLET-STATS-FULL-1433-LIVE-RERUN-002

## Execution verdict

**SUCCESS** - independent zero-network audit remains required.

## Input and selection evidence

- Input SHA-256 verification: MATCH
- Approved sol_addresses.txt SHA-256: `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C`
- Approved sol_address_labels.json SHA-256: `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3`
- Selection rule: all valid unique Solana Base58 strict-32-byte addresses in deterministic cleaned-input order
- Selected count: 1433
- Aggregate irreversible selection fingerprint: `4A00CEC89A6C353527670C935DED799F3EC03BC066D9A0EEF9C0D9F30ECA0088`

## Request budget and outcomes

- Periods: `7d`, `30d`
- Wallets per CLI invocation: 1
- Planned invocations per period: 1,433
- CLI invocation/provider upper bound: 2866
- CLI invocation budget used: 2866
- Budget respected: true
- Execution ordering: strictly serial, at least 1,000ms between adjacent invocations
- Normalized records: 2866
- MAPPED / PARTIAL / UNAVAILABLE: 0 / 2782 / 84
- Average completeness: 0.7449
- Source semantics: `source: "gmgn"`, `verificationStatus: "unverified"`

## Field coverage

| Allowlisted normalized field | Coverage ratio |
|---|---:|
| `periodPnl` | 0 |
| `realizedProfit` | 0.9707 |
| `realizedProfitPnl` | 0.9707 |
| `winRate` | 0.9707 |
| `tradeCount` | 0 |
| `buyCount` | 0.9707 |
| `sellCount` | 0.9707 |
| `boughtCost` | 0.9707 |
| `soldIncome` | 0.9707 |
| `lastActiveTimestamp` | 0.4033 |
| `tokenNum` | 0.9707 |

## Allowlisted warning/error codes

| Code | Count |
|---|---:|
| `gmgn_cli_network_unavailable` | 7 |
| `gmgn_expected_metrics_unavailable` | 77 |
| `gmgn_wallet_stats_partial_fields` | 2782 |
| `gmgn_wallet_stats_period_unverified` | 2782 |

## Safety boundaries

- External normalized output was written only under `C:/Users/10639/chainfm_out/sol/derived/gmgn-wallet-stats-full-1433-live-rerun-002/`.
- No plaintext address or label, API/private key, credential or proxy URL, raw provider payload, raw stdout/stderr, token or transaction identifier, counterparty data, or complete exception is stored in Git evidence or external normalized output.
- Missing fields remain null. Provider-supplied zeros remain explicit zeros and are not interpreted as verified profitability.
- No Helius, signed holdings, other provider, fallback, retry, pagination, concurrency, persistence system, ranking, or LLM conclusion was used.
- Historical 100-wallet and 1,433-wallet outputs were not overwritten or reinterpreted.

## Completion boundary

This implementer delivery is not final. The batch may be marked complete only after `SOL-GMGN-WALLET-STATS-FULL-1433-LIVE-RERUN-002-AUDIT-001` performs a zero-network independent audit and returns GREEN.

## Execution provenance and quality advisory

- Clean-tree implementation/run baseline SHA: `452c2635ac32df179969ee27f0ad545de3e932be`.
- Live execution completed on July 29, 2026 with exactly 2,866 bounded single-wallet invocations.
- Usable identity-bound observations: 2,782 / 2,866 (97.07%), all conservatively classified `PARTIAL` because the provider omitted `periodPnl` and `tradeCount` and did not explicitly attest the requested period in the response body.
- Unavailable observations: 84 / 2,866 (2.93%): 7 safely classified transport/network failures and 77 responses without the minimum expected profitability metrics. The no-retry contract was preserved; these observations were not fabricated or silently filled.
- This result establishes completion of the bounded fetch, not verified profitability or complete provider coverage. Independent audit remains mandatory.
