CREATE TABLE macro_query_registry (
  blueprint_id text PRIMARY KEY,
  query_id bigint NOT NULL UNIQUE,
  sql_sha256 text NOT NULL,
  query_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE macro_daily_delivery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_day date NOT NULL,
  blueprint_id text NOT NULL REFERENCES macro_query_registry(blueprint_id),
  result_sha256 text NOT NULL,
  source_as_of timestamptz NOT NULL,
  brief_sha256 text NOT NULL,
  delivery_mode text NOT NULL CHECK (delivery_mode IN ('dry_run', 'hermes_sent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_day, blueprint_id, result_sha256)
);
