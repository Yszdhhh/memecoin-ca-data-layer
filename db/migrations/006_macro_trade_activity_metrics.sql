ALTER TABLE macro_daily_chain_metrics
  DROP CONSTRAINT macro_daily_chain_metrics_section_check;

ALTER TABLE macro_daily_chain_metrics
  ADD CONSTRAINT macro_daily_chain_metrics_section_check
  CHECK (section IN ('capital', 'supply', 'activity', 'timing'));

ALTER TABLE macro_daily_chain_metrics
  DROP CONSTRAINT macro_daily_chain_metrics_check;

ALTER TABLE macro_daily_chain_metrics
  ADD CONSTRAINT macro_daily_chain_metrics_check CHECK (
    (chain = 'solana' AND metric_name IN (
      'dex_volume_usd', 'active_trader_count', 'swap_transaction_count', 'trade_leg_count', 'pump_launch_count', 'external_pool_count'
    )) OR
    (chain = 'bsc' AND metric_name IN (
      'dex_volume_usd', 'active_trader_count', 'swap_transaction_count', 'trade_leg_count', 'pancakeswap_pool_created_count', 'pancakeswap_lp_net_change_usd'
    )) OR
    (chain = 'robinhood' AND metric_name IN (
      'dex_volume_usd', 'active_trader_count', 'swap_transaction_count', 'trade_leg_count', 'uniswap_pool_created_count'
    ))
  );
