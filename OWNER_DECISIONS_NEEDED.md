# Owner decisions needed

No decision is required to build offline Solana adapters, fixtures, decoders, or tests.

The following remain Owner gates:

1. Which Helius plan/key and production RPC endpoint may be used.
2. Which live Pump.fun CA may be recorded in an acceptance manifest.
3. Whether live response payloads may be retained after secret scrubbing, and for how long.
4. PostgreSQL/Redis deployment target and whether a historical backfill may run.
5. Threshold changes that make holder-cluster exclusion less strict.
6. Activation of the BSC stage after Solana E2E is GREEN.
7. Activation of the Robinhood stage after the agreed BSC gate.
