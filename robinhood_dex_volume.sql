WITH baseline_trades AS (
    SELECT
        block_time,
        block_date,
        tx_hash,
        tx_from,
        taker,
        token_bought_address,
        amount_usd,
        'baseline' AS dex
    FROM query_7986129
    WHERE block_date >= DATE '2026-06-30'
),
uniswap_trades AS (
    SELECT
        block_time,
        block_date,
        tx_hash,
        tx_from,
        taker,
        token_bought_address,
        amount_usd,
        CONCAT(project, ' v', CAST(version AS varchar)) AS dex
    FROM dex.trades
    WHERE blockchain = 'robinhood'
      AND block_date >= DATE '2026-06-30'
      AND block_date < CURRENT_DATE
),
all_trades AS (
    SELECT * FROM uniswap_trades
    UNION ALL
    SELECT * FROM baseline_trades
),
wallet_stats AS (
    SELECT
        tx_from AS wallet,
        COUNT(*) / CAST(COUNT(DISTINCT tx_hash) AS DOUBLE) AS legs_per_tx,
        COUNT(DISTINCT block_date) AS days_active,
        COUNT(DISTINCT DATE_TRUNC('hour', block_time)) / CAST(COUNT(DISTINCT block_date) AS DOUBLE) AS avg_hours_per_day
    FROM all_trades
    GROUP BY 1
),
flagged AS (
    SELECT wallet
    FROM wallet_stats
    WHERE legs_per_tx > 5
       OR (avg_hours_per_day > 18 AND days_active >= 3)
)
SELECT
    t.block_date AS day,
    t.dex,
    SUM(t.amount_usd) AS volume_usd
FROM all_trades t
LEFT JOIN flagged fl
    ON t.tx_from = fl.wallet
WHERE fl.wallet IS NULL
  AND t.taker <> 0x1925f52cea3bb3e1b4958dad50346b3c34a98b44
  AND t.tx_from <> 0x1925f52cea3bb3e1b4958dad50346b3c34a98b44
GROUP BY 1, 2
ORDER BY 1 DESC, 2 LIMIT 10;
