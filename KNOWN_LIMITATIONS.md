# Known limitations

- A bounded read-only Helius source is wired for mint, metadata and complete
  token-account reads, and a public-CA smoke is GREEN. This is not a complete
  live Pump.fun/PumpSwap, creator, Dev-history or address-intelligence adapter.
- The manual CA-first single and 1–10 batch entrypoints return only bounded
  availability/count/completeness summaries. They do not discover tokens,
  calculate holder concentration, persist results or invoke AnalysisService.
- Harness run directories are intentionally local and ignored. Any DONE task
  that needs public review must reference committed, scrubbed evidence rather
  than an ignored local run path.
- When an audited holder snapshot is complete, CA orchestration rebuilds exclusion
  tags/clusters from that snapshot's full owner set and history-window first buys.
  If the snapshot is only partial, exclusion inputs fall back to the generic top-100 /
  recent-trade window with explicit warnings.
- Market liquidity enrichment is offline-capable via append-only `market_observations`
  selection (`market-select-v1`). Live Dexscreener/Gecko/etc. adapters are not wired;
  provider capability claims remain UNVERIFIED until a separate provider task.
- Current tests cover rule behavior and bounded Helius response shapes, not
  general provider payload drift or a full live chain replay.
- Pump.fun program/IDL version registry and pinned transaction fixtures are pending.
- Holder enumeration must fetch beyond RPC `getTokenLargestAccounts`; the exact
  production provider/path is not selected yet.
- Dev history currently assumes normalized trades are complete from creation time.
- Funding clusters suppress high-confidence `exchange`/`router` service funders with
  retained evidence (`service-funder-v1`). Bridge/batch-service funders still need
  explicit evidence-backed roles before they can be suppressed the same way.
- Large-order detection uses max(fixed USD floor, liquidity * 1%) when a selected
  market observation exposes `liquidityUsd`; without market data only the fixed floor applies.
- PostgreSQL migration has not been exercised against a disposable database in CI.
- The repository has no CI workflow yet; the local Harness is the current gate.
- BSC and Robinhood are intentionally stage-blocked.
