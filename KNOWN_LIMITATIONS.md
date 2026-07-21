# Known limitations

- Real Helius, Solana RPC, Dexscreener, Pump.fun and PumpSwap adapters are not yet wired.
- Current tests cover rule behavior, not provider payload drift or live chain replay.
- Pump.fun program/IDL version registry and pinned transaction fixtures are pending.
- Holder enumeration must fetch beyond RPC `getTokenLargestAccounts`; the exact
  production provider/path is not selected yet.
- Dev history currently assumes normalized trades are complete from creation time.
- Funding clusters do not yet suppress exchange/bridge/batch-service funders.
- PostgreSQL migration has not been exercised against a disposable database in CI.
- The repository has no CI workflow yet; the local Harness is the current gate.
- BSC and Robinhood are intentionally stage-blocked.
