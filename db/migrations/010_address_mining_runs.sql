-- Durable, idempotent summaries for the fixture/offline daily and weekly
-- address-mining loop. This contains only structured metrics, warnings, and
-- token-level evidence summaries; raw provider payloads remain out of storage.
CREATE TABLE address_mining_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window text NOT NULL CHECK (window IN ('daily', 'weekly')),
  run_at timestamptz NOT NULL,
  rule_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('GREEN', 'DEGRADED')),
  tokens_scanned integer NOT NULL CHECK (tokens_scanned >= 0),
  wallets_mined integer NOT NULL CHECK (wallets_mined >= 0),
  confirmations_attempted integer NOT NULL CHECK (confirmations_attempted >= 0),
  wallets_confirmed integer NOT NULL CHECK (wallets_confirmed >= 0),
  wallets_promoted integer NOT NULL CHECK (wallets_promoted >= 0),
  new_labels jsonb NOT NULL,
  quota jsonb NOT NULL,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  token_reports jsonb NOT NULL DEFAULT '[]'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (window, run_at, rule_version)
);

CREATE INDEX address_mining_runs_window_time_idx
  ON address_mining_runs (window, run_at DESC);