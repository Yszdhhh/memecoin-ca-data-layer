CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text NOT NULL CHECK (chain IN ('solana', 'bsc', 'robinhood')),
  ca text NOT NULL,
  name text,
  symbol text,
  decimals smallint NOT NULL,
  total_supply_raw numeric(78, 0) NOT NULL CHECK (total_supply_raw >= 0),
  creator_address text,
  creator_confidence numeric(5, 4),
  creator_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  launchpad text NOT NULL DEFAULT 'unknown',
  creation_tx text,
  created_at timestamptz,
  first_indexed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, ca)
);

CREATE TABLE token_markets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  pair_address text,
  venue text,
  is_canonical boolean NOT NULL DEFAULT false,
  is_bonding_curve boolean NOT NULL DEFAULT false,
  is_liquidity_pool boolean NOT NULL DEFAULT false,
  quote_token_address text,
  created_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (token_id, pair_address)
);

CREATE TABLE address_labels (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain text NOT NULL CHECK (chain IN ('solana', 'bsc', 'robinhood')),
  address text NOT NULL,
  role text NOT NULL CHECK (role IN (
    'bonding_curve', 'official_proxy', 'liquidity_pool', 'burn', 'exchange',
    'router', 'whitelist', 'blacklist', 'unknown'
  )),
  source text NOT NULL,
  confidence numeric(5, 4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  valid_from timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, address, role, source)
);
CREATE INDEX address_labels_lookup_idx ON address_labels (chain, address) WHERE expires_at IS NULL;

CREATE TABLE funding_edges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain text NOT NULL CHECK (chain IN ('solana', 'bsc', 'robinhood')),
  funder text NOT NULL,
  recipient text NOT NULL,
  amount_native_raw numeric(78, 0) NOT NULL,
  tx_hash text NOT NULL,
  event_index integer NOT NULL DEFAULT 0,
  block_number numeric(30, 0) NOT NULL,
  funded_at timestamptz NOT NULL,
  recipient_first_seen_at timestamptz,
  UNIQUE (chain, tx_hash, event_index)
);
CREATE INDEX funding_edges_recipient_time_idx ON funding_edges (chain, recipient, funded_at DESC);
CREATE INDEX funding_edges_funder_time_idx ON funding_edges (chain, funder, funded_at DESC);

CREATE TABLE address_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text NOT NULL CHECK (chain IN ('solana', 'bsc', 'robinhood')),
  token_id uuid REFERENCES tokens(id) ON DELETE CASCADE,
  cluster_type text NOT NULL CHECK (cluster_type IN ('same_funder_synchronized_buy')),
  confidence numeric(5, 4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  rule_version text NOT NULL,
  evidence jsonb NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE address_cluster_members (
  cluster_id uuid NOT NULL REFERENCES address_clusters(id) ON DELETE CASCADE,
  address text NOT NULL,
  confidence numeric(5, 4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (cluster_id, address)
);
CREATE INDEX address_cluster_members_address_idx ON address_cluster_members (address);

CREATE TABLE normalized_trades (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain text NOT NULL CHECK (chain IN ('solana', 'bsc', 'robinhood')),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  tx_hash text NOT NULL,
  event_index integer NOT NULL,
  block_number numeric(30, 0) NOT NULL,
  block_time timestamptz NOT NULL,
  trader_address text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  token_amount_raw numeric(78, 0) NOT NULL CHECK (token_amount_raw >= 0),
  quote_amount_raw numeric(78, 0) NOT NULL CHECK (quote_amount_raw >= 0),
  quote_usd numeric(30, 8),
  venue_address text,
  venue text,
  raw_source text NOT NULL,
  raw_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (chain, tx_hash, event_index)
);
CREATE INDEX normalized_trades_token_time_idx ON normalized_trades (token_id, block_time DESC);
CREATE INDEX normalized_trades_trader_time_idx ON normalized_trades (chain, trader_address, block_time DESC);

CREATE TABLE token_transfers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain text NOT NULL CHECK (chain IN ('solana', 'bsc', 'robinhood')),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  tx_hash text NOT NULL,
  event_index integer NOT NULL,
  block_number numeric(30, 0) NOT NULL,
  block_time timestamptz NOT NULL,
  from_address text NOT NULL,
  to_address text NOT NULL,
  amount_raw numeric(78, 0) NOT NULL CHECK (amount_raw >= 0),
  UNIQUE (chain, tx_hash, event_index)
);
CREATE INDEX token_transfers_token_time_idx ON token_transfers (token_id, block_time DESC);

CREATE TABLE holder_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  block_number numeric(30, 0) NOT NULL,
  block_time timestamptz NOT NULL,
  total_supply_raw numeric(78, 0) NOT NULL,
  raw_holder_count integer NOT NULL,
  eligible_holder_count integer NOT NULL,
  real_top10_pct numeric(12, 8) NOT NULL,
  real_top20_pct numeric(12, 8) NOT NULL,
  excluded_pct numeric(12, 8) NOT NULL,
  cleaning_rule_version text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_id, block_number, cleaning_rule_version)
);
CREATE INDEX holder_snapshots_latest_idx ON holder_snapshots (token_id, block_time DESC);

CREATE TABLE holder_snapshot_balances (
  snapshot_id uuid NOT NULL REFERENCES holder_snapshots(id) ON DELETE CASCADE,
  owner_address text NOT NULL,
  token_account_address text,
  balance_raw numeric(78, 0) NOT NULL,
  supply_pct numeric(12, 8) NOT NULL,
  clean_rank integer,
  excluded boolean NOT NULL,
  exclusion_reason text,
  cluster_id uuid REFERENCES address_clusters(id) ON DELETE SET NULL,
  cleaning_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (snapshot_id, owner_address)
);

CREATE TABLE dev_behavior_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  creator_address text NOT NULL,
  current_holding_pct numeric(12, 8) NOT NULL,
  related_holding_pct numeric(12, 8) NOT NULL,
  gross_bought_pct numeric(12, 8) NOT NULL,
  gross_sold_pct numeric(12, 8) NOT NULL,
  net_disposed_pct numeric(12, 8) NOT NULL,
  sold_of_acquired_pct numeric(16, 8),
  direct_sell_count integer NOT NULL,
  related_gross_sold_pct numeric(12, 8) NOT NULL,
  outbound_transfer_pct numeric(12, 8) NOT NULL,
  related_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculation_rule_version text NOT NULL,
  calculated_at timestamptz NOT NULL
);
CREATE INDEX dev_behavior_latest_idx ON dev_behavior_snapshots (token_id, calculated_at DESC);

CREATE TABLE large_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trade_id bigint NOT NULL REFERENCES normalized_trades(id) ON DELETE CASCADE,
  threshold_usd numeric(30, 8) NOT NULL,
  wallet_primary_label text NOT NULL,
  wallet_labels jsonb NOT NULL,
  wallet_quality_score smallint NOT NULL CHECK (wallet_quality_score BETWEEN 0 AND 100),
  label_reasons jsonb NOT NULL,
  classification_rule_version text NOT NULL,
  classified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trade_id, classification_rule_version)
);

CREATE TABLE creator_profiles (
  chain text NOT NULL CHECK (chain IN ('solana', 'bsc', 'robinhood')),
  creator_address text NOT NULL,
  token_count integer NOT NULL,
  graduated_count integer NOT NULL,
  graduation_rate numeric(12, 8),
  highest_fdv_usd numeric(30, 8),
  successful_token_count integer NOT NULL,
  data_completeness numeric(5, 4) NOT NULL CHECK (data_completeness BETWEEN 0 AND 1),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL,
  PRIMARY KEY (chain, creator_address)
);

CREATE TABLE creator_launches (
  chain text NOT NULL CHECK (chain IN ('solana', 'bsc', 'robinhood')),
  creator_address text NOT NULL,
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  graduated boolean,
  peak_fdv_usd numeric(30, 8),
  launch_at timestamptz,
  source text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (chain, creator_address, token_id)
);

CREATE TABLE analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('quick', 'deep')),
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
  source_watermarks jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX analysis_runs_token_time_idx ON analysis_runs (token_id, started_at DESC);

-- Read-optimized materialization. Normalized tables above remain the source of truth;
-- this payload keeps quick-analysis reads to one indexed query.
CREATE TABLE analysis_materializations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  data_as_of timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_id, data_as_of)
);
CREATE INDEX analysis_materializations_latest_idx ON analysis_materializations (token_id, data_as_of DESC);
