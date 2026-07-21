ALTER TABLE macro_daily_delivery_runs
  DROP CONSTRAINT macro_daily_delivery_runs_delivery_mode_check;

ALTER TABLE macro_daily_delivery_runs
  ADD CONSTRAINT macro_daily_delivery_runs_delivery_mode_check
  CHECK (delivery_mode IN ('dry_run', 'hermes_sent', 'lark_card_sent'));
