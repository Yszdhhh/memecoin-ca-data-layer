# Known limitations

- Real Helius, Solana RPC, Dexscreener, Pump.fun and PumpSwap adapters are not yet wired.
- Solana CA orchestration still derives holder exclusion tags/clusters from the generic
  top-100 owner list and the recent-trade window, not from the audited snapshot's full
  enumeration. Explicit warnings are emitted; live wiring must narrow this residual
  (FIND-4 in `docs/audits/SOL-CA-ORCHESTRATION-AUDIT-001.md`).
- Current tests cover rule behavior, not provider payload drift or live chain replay.
- Pump.fun program/IDL version registry and pinned transaction fixtures are pending.
- Holder enumeration must fetch beyond RPC `getTokenLargestAccounts`; the exact
  production provider/path is not selected yet.
- Dev history currently assumes normalized trades are complete from creation time.
- Funding clusters suppress high-confidence `exchange`/`router` service funders with
  retained evidence (`service-funder-v1`). Bridge/batch-service funders still need
  explicit evidence-backed roles before they can be suppressed the same way.
- PostgreSQL migration has not been exercised against a disposable database in CI.
- The repository has no CI workflow yet; the local Harness is the current gate.
- BSC and Robinhood are intentionally stage-blocked.
