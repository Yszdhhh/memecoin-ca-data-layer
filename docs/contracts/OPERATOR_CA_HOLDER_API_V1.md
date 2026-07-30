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

## Live gate

```text
OPERATOR_API_LIVE=1
HELIUS_API_KEY=<runtime env only>
```

Without live gate, POST returns `live_gate_disabled`.  
Missing credential → `credential_unavailable` (fail-closed). Never invent fixture as Live.

## Trust fields (required)

```text
accountingEligible
exclusionCoverage
concentrationEligible
```

`judgmentEligibleDeprecated` may appear as alias of accounting only.

## Limits

- 1 CA per task  
- concurrency 1  
- request budget default 20  
- memory tasks only (restart drops state)  
- no client-supplied keys/providers/chain  
- no auto discovery / cron  

## Privacy

Responses and logs must not include API keys or credential-bearing URLs.
