# MACRO-DUNE-LIVE-SOLANA-019 ¡ª controlled Dune REST path

## Declared scope

This implementation creates a **Solana-only, aggregate-only** executable path. It does not activate a scheduler, BSC/Four.meme, Robinhood, sentiment, token-level liquidity retention, launch-to-external-pool conversion, lifecycle decay, users, demand, buy/sell interpretation, or a trading signal.

The selected persistence target is the existing PostgreSQL macro schema, injected only at runtime as `DATABASE_URL`. It stores aggregate daily chain metrics plus the existing per-query execution/brief manifest fields. Required migrations are `002_macro_daily_metrics.sql`, `003_macro_query_registry.sql`, `004_macro_lark_card_delivery.sql`, and `006_macro_trade_activity_metrics.sql`. Raw Dune responses are parsed in memory and discarded; they are not stored, logged, returned, or included in manifests.

The approved Feishu destination is **test-only** and is supplied at runtime as `FEISHU_TEST_CHAT_ID`. The delivery adapter uses the configured Lark bot CLI and a stable UTC-day idempotency key. It does not contain a chat identifier or Lark credential in source code. Production delivery remains blocked until seven consecutive independently verified GREEN test deliveries.

## Runtime contract

`MacroLiveSolanaTimeSeriesService` accepts exactly these saved-query blueprints:

| blueprint | aggregates |
| --- | --- |
| `S1_solana_capital_day` | DEX USD trade-leg volume, active-trader address count |
| `S2_solana_pump_launch_day` | Pump launch count |
| `S3_solana_pumpswap_pool_day` | PumpSwap pool event count |
| `S4_solana_trade_activity_day` | deduplicated swap transaction count, trade-leg count |

For every blueprint, the caller supplies a fixed saved Dune query ID and expected Dune query version. Before execution the runner requires an exact match in `macro_query_registry` for the blueprint and SQL SHA-256, then calls the Dune REST metadata endpoint and verifies:

1. query ID and Dune version match the explicit allowlist;
2. saved query SQL SHA-256 exactly matches the local approved definition;
3. query is not archived, temporary, or unsaved;
4. result columns exactly equal `report_day` plus the explicitly mapped aggregate columns;
5. exactly one row has non-negative numeric aggregate values and a valid UTC ISO report date.

The runner sends no SQL text to Dune. It executes only `POST /api/v1/query/<saved-query-id>/execute` and polls the returned execution ID. `DUNE_API_KEY` is accessed only at execution time, only from the runtime environment, and only in the `X-DUNE-API-KEY` header. No key value is returned by the adapter or written to a result.

## UTC, persistence, and delivery

A run specifies `reportDay` as `YYYY-MM-DD` UTC and rejects calls before **D+1 14:00 UTC**. All four results must state that same report day. Aggregate observations are marked complete only after these checks pass.

The Feishu test message is sent after Dune and registry checks pass. Its idempotency key is:

```text
macro-live:solana:<report-day>:<allowlist-sha256-prefix>
```

The Lark-side idempotency key prevents an identical retry from creating a second test message. After a successful dry run or test delivery, the existing PostgreSQL macro store records the aggregate observations, query-result SHA-256 values, source timestamps, report hash, and delivery mode. A later scheduler must preserve the preflight retry policy (5m, 15m, 60m) and 400-day aggregate/manifest/report retention policy; it is deliberately not started by this task.

## Runtime configuration (non-secret names only)

| input | source | policy |
| --- | --- | --- |
| `DUNE_API_KEY` | approved runtime secret manager/environment | newly rotated Dune Team `Read` key; never committed or logged |
| `DATABASE_URL` | approved runtime secret manager/environment | PostgreSQL aggregate/manifest target; never committed or logged |
| `FEISHU_TEST_CHAT_ID` | approved runtime configuration | test target only; no source-code default |
| S1¨CS4 saved query IDs and expected Dune versions | deployment configuration passed to the service | exact fixed allowlist; no arbitrary query ID accepted |

Saved-query provisioning and query-registry registration are separate controlled actions. This task intentionally does not create, update, or infer a Dune query. A query must first be created/reviewed by an authorized operator from the approved static SQL, then registered with its exact SQL SHA-256 and ID before the runner will execute it.

## Current live-activation blocker

The approved core SQL definitions currently use `CURRENT_DATE - INTERVAL '2' DAY`, while the live-operation policy requires a `D+1 14:00 UTC` run for complete day `D` (which normally needs `D = CURRENT_DATE - 1` at that run time). This task **does not change that definition**, because it is outside the declared write set. The service intentionally fails closed if Dune returns a day other than its requested `reportDay`.

Therefore, code and tests can be GREEN, but the first real live run remains `PARK` until a separately dispatched, reviewed task reconciles the approved static query window and supplies/records the four saved query IDs and their expected Dune versions. No exposed chat credential is used.

## Validation

```text
npm run harness:task -- validate harness/tasks/MACRO-DUNE-LIVE-SOLANA-019.json
npm run typecheck
npm test
npm run build
git diff --check
```
## Delivery-route evidence

On **2026-07-22**, the test-only Feishu delivery adapter successfully sent one explicitly synthetic route-check message using its stable idempotency path. The message stated that no Dune query was executed and contained no on-chain metric. No destination identifier, credential, provider payload, or query result was retained in this document. This verifies only test-destination connectivity; it is not a live market-data run and does not count toward the seven consecutive GREEN data-delivery gate.
