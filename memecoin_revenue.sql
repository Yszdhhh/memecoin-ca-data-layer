SELECT day, platform, daily_revenue_usd FROM query_7342972
UNION ALL
SELECT day, platform, daily_revenue_usd FROM query_7342977
UNION ALL
SELECT dt AS day, platform, daily_revenue_usd FROM query_7342980
UNION ALL
SELECT day, platform, daily_revenue_usd FROM query_7342988
ORDER BY day DESC, platform;
