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

## New decisions from the 2026-07-26 blueprint revision

See `docs/BLUEPRINT_REVISION_PROPOSAL_2026-07-26.md` for full context. The
direction shifted to a hybrid "borrowed platform data + first-hand chain data"
tool optimized for instant CA analysis. These need Owner sign-off before the
Phase 1+ tasks in that proposal can start:

8.  **Borrowed-data ToS risk (D-A):** whether it is acceptable to consume
    platform data (GMGN, Birdeye, Dexscreener, etc.), including the ToS /
    rate-limit / IP-ban risk of GMGN — official OpenAPI vs. web scraping.
9.  **Hot-path main engine (D-B):** which analysis engine to license —
    Birdeye (~$99, unique wallet_tags), Moralis (~$199, native snipers-by-pair),
    or SolanaTracker (~€50, plainest leaderboards, unmetered paid tier).
10. **Profit-leaderboard policy (D-C):** default to borrowed (fast, not
    reproducible), first-hand reconstruction (slow, auditable), or borrow-then-
    confirm before a wallet is promoted in the address library.
11. **First-hand source + budget (D-D):** Helius plan/key selection — this is
    the same gate as item 1, now load-bearing because the hot path depends on it.
    Entry stack estimated at ~$150–250/month.
12. **Address-library confidence thresholds (D-E):** how strict the bar is to
    label a wallet smart-money / bot / cluster member.
