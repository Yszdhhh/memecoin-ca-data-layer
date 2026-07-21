WITH volume_by_hour AS (
    SELECT
        MOD(EXTRACT(HOUR FROM block_time) + 17, 24) AS hour_mst,
        project,
        SUM(amount_usd) AS volume
    FROM dex_solana.trades
    WHERE project IN ('raydium', 'pumpdotfun')
      AND block_time >= (NOW() - INTERVAL '7' DAY)
    GROUP BY 1, 2
),
pivoted_volume AS (
    SELECT
        hour_mst,
        SUM(CASE WHEN project = 'pumpdotfun' THEN volume ELSE 0 END) AS pump_fun_volume,
        SUM(CASE WHEN project = 'raydium' THEN volume ELSE 0 END) AS raydium_volume
    FROM volume_by_hour
    GROUP BY 1
),
constants AS (
    SELECT
        MOD(EXTRACT(HOUR FROM NOW()) + 17, 24) AS current_hour_mst
),
final AS (
    SELECT
        p.hour_mst AS hours_mst,
        p.pump_fun_volume AS "pump fun volume",
        p.raydium_volume AS "raydium volume",
        CASE
            WHEN p.hour_mst IN (18,19,20) THEN 1
            WHEN p.hour_mst IN (11,12,13) THEN 1
            WHEN p.hour_mst IN (15,16)    THEN 1
            ELSE 0
        END AS is_launch_window,
        c.current_hour_mst
    FROM pivoted_volume p
    CROSS JOIN constants c
)
SELECT
    hours_mst,
    "pump fun volume",
    "raydium volume",
    is_launch_window,

    CASE
        WHEN hours_mst = current_hour_mst
            THEN GREATEST("pump fun volume","raydium volume") * 1.15
        ELSE NULL
    END AS current_hour_marker
FROM final
ORDER BY hours_mst;
