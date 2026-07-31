# Acceptance — SOL-CA-HOLDER-HOTPATH-INTEGRATION-001

## Verdict

```text
Offline: GREEN
Live: EXECUTED (bounded, ≤20 total Helius requests)
Overall: GREEN_FOR_INDEPENDENT_AUDIT
```

Implementer does **not** self-GREEN the merge. Independent auditor must review
tip before merge. Do not claim G0–G8 completed, Live Wiring done, or Stability ready.

## Base

| Item | Value |
| --- | --- |
| HOTPATH_BASE_MAIN_SHA | `5cc414c83d5b0d602d55eac9bc392953a3161196` |
| Branch | `feature/sol-ca-holder-hotpath-integration-001` |
| PR | #7 |

## Scope containment

G2–G8 offline product surfaces withdrawn via reverse-order `git revert` of
`6e043e49…`, `7953a19`, `85f6291`. Allowed governance retainers only:

- `docs/blueprints/GOAL_EXECUTION_BLUEPRINT_V1.md`
- `docs/architecture/OPERATOR_CONSOLE_ACCESS_LAYER_CLARIFICATION.md`

## API

| Endpoint | Status |
| --- | --- |
| GET /api/v1/health | implemented |
| POST /api/v1/ca-holder-tasks | implemented (strict fields, application/json) |
| GET /api/v1/ca-holder-tasks/:id | implemented |
| GET /api/v1/ca-holder-results/:id | implemented |

Bind: **127.0.0.1 only** · Live gate: `OPERATOR_API_LIVE=1` · CLI: `npm run operator-api`

Browser-origin protection: Origin allowlist, reject `Sec-Fetch-Site: cross-site`,
no `Access-Control-Allow-Origin: *`, non-loopback Host fail-closed.

## Provider accounting

Every real Helius HTTP attempt (pagination page + 429/5xx/timeout retry)
consumes one unit from a single task-level `ProviderExecutor` budget injected
into `LiveHeliusDataSource` request transport.

Public metrics: `providerRequestCount`, `providerOperationCount`, `pageCount`,
`retryCount`, `timeoutCount`, `budgetUsed`, `requestBudget`,
`providerBudgetExhausted`.

## Offline tests

- Provider accounting 4/4
- API security 7/7
- Trust regressions 9/9
- Root suite 427 pass / 0 fail / 1 skipped
- Wallet summary fixture contract (`manualReview=9`, fingerprints only)
- console:check / console:build / typecheck / build / security:scan PASS
- harness:doctor FAIL pre-existing (wallet*.json fixture already on main)

## Live smoke

Executed with runtime `HELIUS_API_KEY`. 2 public sample CAs. Total provider
requests = 11 (≤20). See `live-smoke-summary.json`.

## Trust output

API summaries expose `accountingEligible`, `exclusionCoverage`,
`concentrationEligible` directly. Concentration ratios null when not eligible.

## Boundaries confirmed

```text
M0 未重跑
1433 未重抓
累计 PnL 未启动
chainfm_out 未读取/未上传
私密钱包明细未上传
DPAPI 未上传
无自动发现
无 cron
无生产数据库写入
无 force-push / rebase / history rewrite
```

## Owner next

1. Independent audit of tip (implementer does not self-GREEN merge)
2. Only after offline GREEN + Live smoke + independent audit GREEN → merge
3. Then `OPERATOR-CONSOLE-LIVE-WIRING-001` (not Stability)
