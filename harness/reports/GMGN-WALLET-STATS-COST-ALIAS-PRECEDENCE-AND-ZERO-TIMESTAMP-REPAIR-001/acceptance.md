# Acceptance Report: GMGN-WALLET-STATS-COST-ALIAS-PRECEDENCE-AND-ZERO-TIMESTAMP-REPAIR-001

## Verdict

GREEN — offline repair implementation complete; independent audit remains required.

## Git evidence

- Baseline SHA: `c672bbc8addb53e4110926698068a74abf42a944`
- Task activation SHA: `165d605`
- Implementation SHA: `f36465b`
- Branch: `codex/solana-daily-new-token-analysis`

## Changes

- The `bought_cost_7d|30d` / `bought_cost` family is authoritative when present.
- The `total_cost_7d|30d` / `total_cost` / `buy_volume` family is consulted only when the authoritative family is absent.
- Conflicting values inside the selected family remain fail-closed with `gmgn_wallet_stats_alias_conflict`.
- A present null authoritative bought-cost field does not silently fall through to a fallback value.
- Explicit timestamp zero is treated as an unavailable provider sentinel: it is omitted and does not generate an invalid-type warning or fabricated activity.
- Positive timestamps remain accepted; negative or malformed timestamps remain invalid.

## Offline verification

- task validation: GREEN
- audit task validation: GREEN
- Harness Doctor: GREEN, 0 errors, 0 warnings
- typecheck: PASS
- tests: 325 total, 324 passed, 1 skipped, 0 failed
- build: PASS
- git diff --check: PASS

## Resource and safety counters

- network_requests: 0
- provider_requests: 0
- gmgn_cli_invocations: 0
- credential_reads: 0
- real_address_processing: 0

No raw provider payload, stdout/stderr, credential, proxy URL, wallet address, or label was persisted. This report does not claim live recovery or authorize a full batch before independent audit and bounded re-smoke.
