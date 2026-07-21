CREATE TABLE macro_daily_global_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_day date NOT NULL,
  metric_name text NOT NULL CHECK (metric_name IN (
    'dex_volume_usd', 'active_trader_count', 'btc_transaction_count', 'btc_fee_usd'
  )),
  subject text NOT NULL,
  value numeric(38, 12) NOT NULL,
  unit text NOT NULL,
  history_window_days smallint,
  percentile numeric(6, 5),
  source text NOT NULL,
  query_ref text NOT NULL,
  query_version text NOT NULL,
  source_as_of timestamptz NOT NULL,
  computed_at timestamptz NOT NULL,
  completeness numeric(5, 4) NOT NULL CHECK (completeness BETWEEN 0 AND 1),
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (report_day, metric_name, subject, source, query_ref, query_version)
);

CREATE INDEX macro_daily_global_metrics_day_idx
  ON macro_daily_global_metrics (report_day DESC, metric_name, subject);

CREATE TABLE macro_daily_chain_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_day date NOT NULL,
  chain text NOT NULL CHECK (chain IN ('solana', 'bsc', 'robinhood')),
  section text NOT NULL CHECK (section IN ('capital', 'supply', 'timing')),
  metric_name text NOT NULL CHECK (
    (chain = 'solana' AND metric_name IN (
      'dex_volume_usd', 'active_trader_count', 'pump_launch_count', 'external_pool_count'
    )) OR
    (chain = 'bsc' AND metric_name IN (
      'dex_volume_usd', 'active_trader_count', 'pancakeswap_pool_created_count', 'pancakeswap_lp_net_change_usd'
    )) OR
    (chain = 'robinhood' AND metric_name IN (
      'dex_volume_usd', 'active_trader_count', 'uniswap_pool_created_count'
    ))
  ),
  value numeric(38, 12) NOT NULL,
  unit text NOT NULL,
  registry_version text NOT NULL,
  coverage_status text NOT NULL CHECK (coverage_status IN ('declared_registry', 'partial_coverage')),
  source text NOT NULL,
  query_ref text NOT NULL,
  query_version text NOT NULL,
  source_as_of timestamptz NOT NULL,
  computed_at timestamptz NOT NULL,
  completeness numeric(5, 4) NOT NULL CHECK (completeness BETWEEN 0 AND 1),
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  CHECK (chain <> 'robinhood' OR coverage_status = 'partial_coverage'),
  UNIQUE (report_day, chain, metric_name, source, query_ref, query_version)
);

CREATE INDEX macro_daily_chain_metrics_day_idx
  ON macro_daily_chain_metrics (report_day DESC, chain, metric_name);

CREATE TABLE macro_hourly_chain_profile (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain text NOT NULL CHECK (chain IN ('solana', 'bsc', 'robinhood')),
  profile_window_days smallint NOT NULL CHECK (profile_window_days IN (60, 90)),
  metric_name text NOT NULL CHECK (
    (chain = 'solana' AND metric_name IN (
      'dex_volume_usd', 'active_trader_count', 'pump_launch_count', 'external_pool_count'
    )) OR
    (chain = 'bsc' AND metric_name IN (
      'dex_volume_usd', 'active_trader_count', 'pancakeswap_pool_created_count', 'pancakeswap_lp_net_change_usd'
    )) OR
    (chain = 'robinhood' AND metric_name IN (
      'dex_volume_usd', 'active_trader_count', 'uniswap_pool_created_count'
    ))
  ),
  hour_utc smallint NOT NULL CHECK (hour_utc BETWEEN 0 AND 23),
  sample_day_count smallint NOT NULL CHECK (sample_day_count >= 0),
  metric_value numeric(38, 12) NOT NULL,
  metric_share numeric(8, 7) NOT NULL CHECK (metric_share BETWEEN 0 AND 1),
  registry_version text NOT NULL,
  coverage_status text NOT NULL CHECK (coverage_status IN ('declared_registry', 'partial_coverage')),
  source text NOT NULL,
  query_ref text NOT NULL,
  query_version text NOT NULL,
  source_as_of timestamptz NOT NULL,
  computed_at timestamptz NOT NULL,
  completeness numeric(5, 4) NOT NULL CHECK (completeness BETWEEN 0 AND 1),
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  CHECK (chain <> 'robinhood' OR coverage_status = 'partial_coverage'),
  UNIQUE (chain, profile_window_days, metric_name, hour_utc, source, query_ref, query_version)
);

CREATE INDEX macro_hourly_chain_profile_lookup_idx
  ON macro_hourly_chain_profile (chain, profile_window_days, metric_name, hour_utc);
