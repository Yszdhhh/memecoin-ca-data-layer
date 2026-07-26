-- Additive-only: address-intelligence library (wallets, wallet_token_edges) and
-- the unified observation ingress table (observations), per the versioned-parser
-- contract in docs/METHODS_ALPHA_SCORE_AND_DETECTORS.md Part 3 and
-- PROJECT_ARCHITECTURE.md §5/§7. No ALTER/DROP against existing tables.
--
-- token -> existing `tokens` (unchanged); pair -> existing `token_markets` +
-- `market_observations`; cluster_edge -> existing `address_clusters` +
-- `address_cluster_members`. Only wallet/wallet_token_edge/observation are new.

CREATE TABLE wallets (
  chain text NOT NULL CHECK (chain IN ('solana', 'bsc', 'robinhood')),
  address text NOT NULL,
  first_seen_at timestamptz,
  -- Helius first-SOL funder cluster seed (constitution: funding source always first-hand).
  funding_source text,
  funding_source_confidence numeric(5, 4) CHECK (funding_source_confidence BETWEEN 0 AND 1),
  alpha_score numeric(6, 2),
  alpha_score_tier text CHECK (alpha_score_tier IN ('UR', 'SSR', 'SR', 'R', 'N')),
  alpha_score_status text CHECK (alpha_score_status IN ('scored', 'provisional', 'insufficient')),
  -- Derived from address_labels; source-of-truth precedence lives in application code.
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_completeness numeric(5, 4) NOT NULL DEFAULT 0 CHECK (data_completeness BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain, address)
);

CREATE TABLE wallet_token_edges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain text NOT NULL CHECK (chain IN ('solana', 'bsc', 'robinhood')),
  wallet_address text NOT NULL,
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  -- Raw-integer amounts (constitution #1); transfers never counted as sales (#2) —
  -- first-hand rows derive exclusively from normalized_trades.
  gross_bought_raw numeric(78, 0) NOT NULL DEFAULT 0 CHECK (gross_bought_raw >= 0),
  gross_sold_raw numeric(78, 0) NOT NULL DEFAULT 0 CHECK (gross_sold_raw >= 0),
  current_balance_raw numeric(78, 0) CHECK (current_balance_raw >= 0),
  realized_pnl_usd numeric(30, 8),
  unrealized_pnl_usd numeric(30, 8),
  pnl_source text NOT NULL CHECK (pnl_source IN (
    'birdeye', 'moralis', 'solanatracker', 'bitquery', 'gmgn', 'self_computed'
  )),
  origin text NOT NULL CHECK (origin IN ('first_hand', 'borrowed')),
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified')),
  confidence numeric(5, 4) CHECK (confidence BETWEEN 0 AND 1),
  first_trade_at timestamptz,
  last_trade_at timestamptz,
  calculation_rule_version text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (chain, wallet_address) REFERENCES wallets (chain, address) ON DELETE CASCADE,
  UNIQUE (chain, wallet_address, token_id, pnl_source)
);
CREATE INDEX wallet_token_edges_wallet_idx ON wallet_token_edges (chain, wallet_address);
CREATE INDEX wallet_token_edges_token_idx ON wallet_token_edges (token_id, calculated_at DESC);

-- Unified observation ingress (A.1): one row per parsed external observation,
-- one typed snapshot per row, keyed for idempotent re-parse (PD-3 replay
-- determinism). Shares the trust_class/completeness/warnings vocabulary with
-- market_observations (007).
CREATE TABLE observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text NOT NULL CHECK (chain IN ('solana', 'bsc', 'robinhood')),
  subject_kind text NOT NULL CHECK (subject_kind IN ('token', 'wallet')),
  subject_ref text NOT NULL,
  snapshot_kind text NOT NULL CHECK (snapshot_kind IN (
    'market', 'security', 'holder_concentration', 'wallet_signal',
    'promotion_and_social', 'call_source'
  )),
  source text NOT NULL,
  -- Borrowed rows are always inserted unverified; only confirm_* columns below
  -- may later flip verification_status (origin itself never changes).
  origin text NOT NULL CHECK (origin IN ('first_hand', 'borrowed')),
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified')),
  trust_class text NOT NULL CHECK (trust_class IN ('A', 'B', 'C', 'D', 'E')),
  parser_version text NOT NULL,
  parser_input_kind text NOT NULL CHECK (parser_input_kind IN (
    'forwarded_text', 'tdlib_client', 'ocr', 'manual', 'platform_json'
  )),
  raw_text_or_json text,
  raw_ref text,
  raw_hash text,
  observation_fingerprint text NOT NULL,
  confidence numeric(5, 4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  completeness numeric(5, 4) NOT NULL CHECK (completeness BETWEEN 0 AND 1),
  snapshot jsonb NOT NULL,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  captured_at timestamptz NOT NULL,
  source_observed_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by_source text,
  confirmation_rule_version text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, observation_fingerprint)
);
CREATE INDEX observations_subject_time_idx
  ON observations (chain, subject_kind, subject_ref, COALESCE(source_observed_at, captured_at) DESC);
CREATE INDEX observations_snapshot_kind_idx ON observations (snapshot_kind, captured_at DESC);
