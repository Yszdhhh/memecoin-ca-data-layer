# Acceptance — SOL-CA-HOLDER-HOTPATH-INTEGRATION-001

## Verdict

# GREEN

(Live smoke portion: **BLOCKED** — no runtime `HELIUS_API_KEY`; offline implementation and tests GREEN.)

## Base

| Item | Value |
| --- | --- |
| HOTPATH_BASE_MAIN_SHA | `5cc414c83d5b0d602d55eac9bc392953a3161196` |
| Branch | `feature/sol-ca-holder-hotpath-integration-001` |

## API

| Endpoint | Status |
| --- | --- |
| GET /api/v1/health | implemented |
| POST /api/v1/ca-holder-tasks | implemented |
| GET /api/v1/ca-holder-tasks/:id | implemented |
| GET /api/v1/ca-holder-results/:id | implemented |

Bind: **127.0.0.1 only** · Live gate: `OPERATOR_API_LIVE=1` · CLI: `npm run operator-api`

## Offline tests (9/9)

- invalid mint / unknown fields / client key rejection  
- live gate disabled  
- accounting confirmed + concentration unverified  
- pagination partial  
- idempotency / same-mint dedupe  
- credential unavailable  
- no secrets in public summaries  
- HTTP health + validation  

## Live smoke

Not executed (credential absent). Must not be faked with fixtures.

## Trust output

API summaries expose `accountingEligible`, `exclusionCoverage`, `concentrationEligible`.  
Concentration ratios null when not eligible. Legacy alias marked deprecated.

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
```

## Owner next

1. Optional: re-run Live smoke with runtime HELIUS key (1–2 public CA, budget≤20)  
2. Review PR — **do not auto-merge**  
3. Then `OPERATOR-CONSOLE-LIVE-WIRING-001` or `SOL-CA-HOLDER-STABILITY-BATCH-001`  
