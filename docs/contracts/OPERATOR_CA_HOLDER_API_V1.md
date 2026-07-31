# Operator CA Holder API V1

Loopback-only HTTP API for manual single-CA holder analysis (Hotpath).

## Bind

```text
127.0.0.1 only
```

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/health` | Liveness |
| POST | `/api/v1/ca-holder-tasks` | Body: `{ "mint": "<solana mint>" }` optional `idempotencyKey` |
| GET | `/api/v1/ca-holder-tasks/:taskId` | Status summary |
| GET | `/api/v1/ca-holder-results/:taskId` | Scrubbed result summary |

## Browser-origin protection

Even on loopback:

- POST requires `Content-Type: application/json`
- Reject `Sec-Fetch-Site: cross-site`
- When `Origin` is present, only allowlisted Console origins (defaults `http://127.0.0.1:5173`, `http://localhost:5173`)
- Never `Access-Control-Allow-Origin: *`
- OPTIONS only for allowlisted origins
- Non-localhost Host fail-closed
- Hotpath POST rejects unknown fields and client credential/RPC fields

## Live gate

```text
OPERATOR_API_LIVE=1
HELIUS_API_KEY=<runtime env only>
```

Without live gate, POST returns `live_gate_disabled`.  
Missing credential → `status=blocked`, `failureReason=credential_unavailable`,
`providerRequestCount=0` (must not also claim `request_budget_exhausted`).
Never invent fixture as Live. Key is never read from body, browser, or CLI args.

## Provider accounting metrics (required)

```text
providerRequestCount   # real HTTP attempts (pages + retries)
providerOperationCount # logical ops (getMint/enumerate/...)
pageCount
retryCount
timeoutCount
budgetUsed
requestBudget
providerBudgetExhausted
```

Every real Helius HTTP attempt consumes one unit from a single task-level budget.

Budget exhaustion → `status=partial`, `request_budget_exhausted`,
`accountingEligible=false`, `concentrationEligible=false`, ratios null,
incomplete pagination retained; no HTTP beyond hard budget.

## Trust fields (required)

```text
accountingEligible
exclusionCoverage
concentrationEligible
```

These are authoritative. Do not treat legacy `judgmentEligible` as the authority.

## Limits

- 1 CA per task  
- concurrency 1  
- request budget default 20 (CLI: `1 <= requestBudget <= 20`)  
- max pages CLI: `1 <= maxPages <= 20`  
- memory tasks only (restart drops state)  
- no client-supplied keys/providers/chain  
- no auto discovery / cron  

## Privacy

Responses and logs must not include API keys, credential-bearing URLs, query
strings with secrets, raw provider payloads, or absolute user paths.
