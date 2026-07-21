# Project constitution

## Mission

Build an auditable data layer that returns cleaner holder concentration, Dev
behavior, large-order quality, and creator history for a submitted token address.
This repository does not implement Telegram, UI, trading, signing, or order execution.

## Current stage

Solana and Pump.fun are the only active delivery chain. BSC/Four.meme and
Robinhood Chain adapters remain contract-only backlog until the Solana end-to-end
acceptance gate is GREEN and the Owner activates the next stage.

## Non-negotiable data rules

1. Store chain quantities as raw integers; decimals are display metadata.
2. Token transfers are not sales without swap/venue evidence.
3. On Solana, aggregate token accounts by owner before holder ranking.
4. Every exclusion from Real Top Holders needs a reason, confidence, evidence,
   rule version, and a reversible raw snapshot.
5. Creator identity must retain provenance. Pump `create.creator` outranks payer,
   signer, metadata inference, and third-party labels.
6. Related-wallet activity is shown separately from direct Dev activity.
7. Market APIs enrich price/FDV/liquidity; they do not override on-chain facts.
8. Partial data produces warnings and completeness fields, never fake precision.

## Collaboration rules

- One stable task ID, one role, one task spec, one bounded write set.
- Parallel implementers may only use non-overlapping write sets.
- The implementer cannot be the sole final auditor of a Solana milestone.
- Only verified artifacts can become `GREEN`. Unverified external research stays
  `UNVERIFIED`; missing prerequisites are `PARK`; contaminated runs are `QUARANTINED`.
- No secret values, `.env`, wallet keys, browser state, raw provider credentials,
  or production database dumps may enter the repository or run artifacts.

## Definition of Solana end-to-end GREEN

A pinned Pump.fun fixture and at least one explicitly authorized live CA must both
produce a reproducible analysis manifest containing source watermarks, hashes,
holder cleaning evidence, creator evidence, Dev sell totals, quality-labelled
large orders, and passing typecheck/unit/integration tests. Live-only success is
insufficient; fixture-only success is not production readiness.
