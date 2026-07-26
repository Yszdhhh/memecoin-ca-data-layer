-- Append-only Solana market enrichment observations (price/FDV/liquidity).
-- Implements the schema contract from docs/designs/SOL-MARKET-DATA-DESIGN-001.md.
-- Does not authorize credentials, live polling, or payload retention.

CREATE TABLE market_observations (
  id uuid PRIMARY KEY,
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  pair_address text,
  venue text,
  source text NOT NULL,
  trust_class text NOT NULL CHECK (trust_class IN ('A', 'B', 'C', 'D', 'E')),
  source_observed_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL,
  source_request_ref text NOT NULL,
  source_observation_id text,
  observation_fingerprint text NOT NULL,
  payload_ref text,
  payload_hash text,
  price_usd numeric,
  liquidity_usd numeric,
  fdv_usd numeric,
  market_cap_usd numeric,
  volume_5m_usd numeric,
  volume_1h_usd numeric,
  volume_6h_usd numeric,
  volume_24h_usd numeric,
  buys_5m integer,
  sells_5m integer,
  buys_1h integer,
  sells_1h integer,
  price_change_5m_pct numeric,
  price_change_1h_pct numeric,
  price_change_6h_pct numeric,
  price_change_24h_pct numeric,
  base_reserve_raw numeric(78, 0),
  quote_reserve_raw numeric(78, 0),
  base_decimals smallint,
  quote_decimals smallint,
  pair_created_at timestamptz,
  completeness numeric(5, 4) NOT NULL CHECK (completeness BETWEEN 0 AND 1),
  freshness_status text NOT NULL CHECK (freshness_status IN ('fresh', 'stale', 'partial', 'rejected', 'unknown')),
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  supersedes_observation_id uuid REFERENCES market_observations(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, observation_fingerprint)
);

CREATE INDEX market_observations_token_time_idx
  ON market_observations (token_id, COALESCE(source_observed_at, retrieved_at) DESC);

-- Immutable candidate lifecycle events (audit advisory: no in-place exited_at update).
CREATE TABLE market_candidate_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  pair_address text,
  event_type text NOT NULL CHECK (event_type IN ('entered', 'tier_changed', 'exited')),
  tier text NOT NULL CHECK (tier IN ('HOT', 'WARM', 'COLD')),
  trigger_type text NOT NULL,
  trigger_source text NOT NULL,
  trust_class text NOT NULL CHECK (trust_class IN ('A', 'B', 'C', 'D', 'E')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy_version text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX market_candidate_events_token_idx
  ON market_candidate_events (token_id, recorded_at DESC);
