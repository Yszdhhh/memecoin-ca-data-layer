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

## Decisions from the 2026-07-26 blueprint revision — DECIDED (Owner, 2026-07-26)

See `docs/BLUEPRINT_REVISION_PROPOSAL_2026-07-26.md`. Owner steer: **free
interfaces first; Helius is already on the free 1M-credit plan.** Because the
Owner is a solo, on-demand analyst (one CA at a time, not mass scale), the free
providers' ~1 req/s limits are sufficient, so the "which paid provider" gates
collapse.

8.  **Borrowed-data ToS risk (D-A):** DECIDED — consume platform data via
    **official/free APIs only** (Birdeye free, Dexscreener free/no-key, GMGN free
    official OpenAPI, Helius free). No web scraping / no Cloudflare bypass.
9.  **Hot-path stack (D-B):** DECIDED — **all-free stack first**: Birdeye free +
    Dexscreener free + GMGN free OpenAPI + Helius free 1M. No paid engine until a
    free rate limit is proven to block real use. Reason: zero-cost validation that
    the tool is actually useful before spending; upgrade only against a proven
    bottleneck.
10. **Profit-leaderboard policy (D-C):** DECIDED — **borrow first, confirm before
    persisting**: use free platform leaderboards for day-to-day speed (lead only);
    reconstruct from first-hand Helius swaps only when a wallet is to be promoted
    into the address library as confirmed.
11. **First-hand source + budget (D-D):** DECIDED — **Helius free 1M plan** (Owner
    already has it). Reconstruction jobs must budget against the 1M credit ceiling
    (batch recompute can exhaust it — throttle/queue, cache `token_analyses`).
12. **Telegram/social ingestion (D-G):** DECIDED — **do not ingest for now**;
    chain data first. Revisit (manual forward, then possibly TDLib) after the
    first-screen + address library are stable. No account/ToS risk taken now.

## Still open (safe defaults applied until Owner revisits)

- **Address-library confidence thresholds (D-E):** defaulting to the method-doc
  values (`cluster` fires at fused C ≥ 0.85 reusing the existing exclusion gate;
  `bot_sniper` S ≥ 0.75; `independent_smart_money` I ≥ 0.80 with Tier-A PnL).
  Tunable later via a versioned `label-tolerance` file; no blocker.
- **Daily growth-loop automation (D-F):** defaulting to **manual/off** — the
  auto-scan of hot tokens (which consumes provider quota) stays a manual trigger
  until Owner enables it. No blocker.

## Decisions from Wave B/C go-ahead — DECIDED (Owner, 2026-07-27)

13. **Wave B/C build mode:** DECIDED — implement **fixture/offline only**. Do
    **not** enable live Helius network calls or production RPC until a later
    explicit live flip. Live Helius + real CA E2E stay **PARK**.
14. **Live acceptance CA selection (item 2 partial):** DECIDED for process —
    when E2E is unparked, **Codex chooses public sample CAs** for the acceptance
    manifest (not a secret list; no private bags). Until then `SOL-E2E-001` remains
    PARK.
15. **Payload retention (item 3):** DECIDED —
    - **Raw provider payloads** (after secret scrubbing): retain **7 days** by default.
    - **Structured Observation records**, evidence indexes, and cleaned **replay
      fixtures**: **long-term** retention (append-only library / repo fixtures).
16. **BSC stage (item 6):** DECIDED for now — **do not activate BSC**. Remains
    `BLOCKED_STAGE` until Solana E2E is GREEN and Owner revisits.
