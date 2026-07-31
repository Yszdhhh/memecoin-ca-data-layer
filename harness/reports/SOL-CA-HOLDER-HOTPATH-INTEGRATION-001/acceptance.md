# Acceptance — SOL-CA-HOLDER-HOTPATH-INTEGRATION-001

## Verdict

```text
Offline: GREEN
Live: BLOCKED
Overall: BLOCKED_BY_LIVE_SMOKE
```

Live smoke is **not optional**. Without a completed bounded Live smoke against
runtime `HELIUS_API_KEY`, the overall verdict remains `BLOCKED_BY_LIVE_SMOKE`.
Do not claim G0–G8 completed, Live Wiring done, or Stability ready.

## Base

| Item | Value |
| --- | --- |
| HOTPATH_BASE_MAIN_SHA | `5cc414c83d5b0d602d55eac9bc392953a3161196` |
| Branch | `feature/sol-ca-holder-hotpath-integration-001` |
| PR | #7 |

## Scope containment

G2–G8 offline product surfaces (Watchlist / Schedules / Replay / Liquidity
domain engines / offline backend) were withdrawn via reverse-order `git revert`
of rejected-audit commits. Allowed governance retainers only:

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

Budget exhaustion → `status=partial`, `request_budget_exhausted`,
`accountingEligible=false`, `concentrationEligible=false`, ratios null.
Missing credential → `status=blocked`, `credential_unavailable`,
`providerRequestCount=0` (must not also claim budget exhausted).

## Offline tests

- Provider accounting (3-page / 429-retry / budget=2 / credential)
- API security (Origin / Sec-Fetch-Site / Content-Type / Host / CORS / fields)
- Trust regressions (accounting + exclusion + concentration, pagination, idempotency, ratios null)
- Wallet summary fixture contract (`manualReview=9`, fingerprints only)

## Live smoke

Not executed when `HELIUS_API_KEY` is absent. Must not be faked with fixtures.
See `live-smoke-summary.json`.

## Trust output

API summaries expose `accountingEligible`, `exclusionCoverage`,
`concentrationEligible` directly (no legacy `judgmentEligible` as authority).
Concentration ratios null when not eligible.

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

1. Run bounded Live smoke with runtime HELIUS key (1–2 public CA, total budget ≤20)
2. Independent audit of tip (implementer does not self-GREEN merge)
3. Only after offline GREEN + Live smoke + independent audit GREEN → merge
4. Then `OPERATOR-CONSOLE-LIVE-WIRING-001` (not Stability)
