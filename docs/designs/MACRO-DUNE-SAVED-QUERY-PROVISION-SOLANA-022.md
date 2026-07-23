# MACRO-DUNE-SAVED-QUERY-PROVISION-SOLANA-022

## Scope

This controlled one-time operation provisions or reconciles only the four reviewed, parameterized Solana aggregate queries: `S1_solana_capital_day`, `S2_solana_pump_launch_day`, `S3_solana_pumpswap_pool_day`, and `S4_solana_trade_activity_day`.

The query text is imported exactly from `LIVE_SOLANA_QUERY_DEFINITIONS`. Each query accepts only the saved-query `report_day` parameter and returns exactly one aggregate UTC-day row. Runtime Dune and PostgreSQL configuration stays external. No credential, database URL, raw Dune response, destination ID, or query-result rows are written here.

## Required verification sequence

1. Compute SHA-256 values from the reviewed local S1-S4 SQL definitions.
2. For an existing saved query, read its metadata without retaining the response; update only when its SQL differs from the reviewed definition. Create the missing query only when no registered query exists.
3. Re-read metadata and require exact query ID, non-temporary/non-archived state, Dune version, and SQL hash equality.
4. In one transaction, upsert only the corresponding four `macro_query_registry` entries with the exact query ID, SQL hash, Dune version, and verification timestamp.
5. Require a read-back exact match of the registry.
6. Only after all four checks pass, run exactly one eligible Solana report day with `sendTestDelivery: false`.

## Boundaries

- The first execution is **manual query only**; Feishu is not used.
- Dune output is parsed in memory by the existing live service. Only reviewed aggregates and manifest hashes may persist.
- `S3` counts valid PumpSwap pool events and must retain its warnings: it is not a migration, external listing, graduation, or token-level conversion measure.
- DEX volume is trade-leg volume, not liquidity, users, demand, or a trading signal.
- BSC and Robinhood remain unexecuted.

## Evidence record

The final outcome records only: per-blueprint query presence, SQL-hash match, Dune version, registry-attestation result, manual-run verdict, report day, aggregate persistence result, and manifest/report hashes. It deliberately omits query IDs, database URLs, credentials, raw results, and any delivery destination.
## Dune 网页端一次性操作包（免费 API Key 的替代路径）

当前 API Key 可以读取和执行保存查询，但 Dune 拒绝它创建或更新查询。因此请在 **Dune 网页端**完成下列一次性配置；这不需要暴露 API Key，也不会启用飞书、BSC 或 Robinhood。

1. 打开现有 S1 查询（ID `8050422`），用下面的 **S1 SQL** 完整替换并保存。
2. 打开现有 S2 查询（ID `8050424`），用下面的 **S2 SQL** 完整替换并保存。
3. 打开现有 S3 查询（ID `8050430`），用下面的 **S3 SQL** 完整替换并保存。
4. 新建私有查询，名称为 `Macro Solana S4 trade activity daily`，粘贴 **S4 SQL** 并保存。
5. 若网页要求设置参数，创建一个文本参数 `report_day`，默认值可填 `2026-07-21`。四段 SQL 均将它显式转换为 UTC 日期。
6. 回复时只需发送新建 S4 的数字 Query ID；它不是密钥。S1–S3 的 ID 已记录，无需重复发送。

### S1 SQL

```sql
SELECT CAST('{{report_day}}' AS date) AS report_day,
       SUM(amount_usd) AS dex_volume_usd,
       COUNT(DISTINCT trader_id) AS active_trader_count
FROM dex_solana.trades
WHERE block_date = CAST('{{report_day}}' AS date)
  AND amount_usd IS NOT NULL
```

### S2 SQL

```sql
SELECT CAST('{{report_day}}' AS date) AS report_day,
       COUNT(*) AS pump_launch_count
FROM solana.instruction_calls
WHERE executing_account = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'
  AND bytearray_substring(data, 1, 8) = 0x181ec828051c0777
  AND tx_success = true
  AND CAST(block_time AS date) = CAST('{{report_day}}' AS date)
```

### S3 SQL

```sql
SELECT CAST('{{report_day}}' AS date) AS report_day,
       COUNT(*) AS external_pool_count
FROM pumpswap_solana.pools
WHERE CAST(created_at AS date) = CAST('{{report_day}}' AS date)
  AND is_valid_pool = true
```

### S4 SQL

```sql
WITH trade_legs AS (
  SELECT DISTINCT tx_id, outer_instruction_index, inner_instruction_index, tx_index, block_month
  FROM dex_solana.trades
  WHERE block_date = CAST('{{report_day}}' AS date)
)
SELECT CAST('{{report_day}}' AS date) AS report_day,
       COUNT(DISTINCT tx_id) AS swap_transaction_count,
       COUNT(*) AS trade_leg_count
FROM trade_legs
```

After the S4 ID is supplied, the controlled runner will re-read all four saved-query metadata records, verify SQL hashes and Dune versions, attest the PostgreSQL registry, then run one eligible UTC day with `sendTestDelivery: false`.
