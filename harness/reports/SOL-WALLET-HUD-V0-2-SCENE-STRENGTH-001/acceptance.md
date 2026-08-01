# Acceptance report: SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-001

## Scope

The runner processed exactly 32 candidate addresses, loaded the declared 1,433-row wallet master, validated every private input hash, and made no network requests. Private outputs are written below `chainfm_out/sol/derived/wallet_hud_v0_2/` and are not committed.

## Acceptance commands

- task validate: GREEN
- typecheck: PASS
- tests: PASS — 461 passed, 1 skipped
- build: PASS
- security scan: PASS — classifiedLeaks=0
- diff check: PASS
- private refresh: SUCCESS — 32 states, 5 CHAIN_SAMPLED states, 0 shadow events
- deterministic replay: PASS — repeated refresh produced identical output hashes

## Scene cohorts

- MULTI_TOKEN_REPEATABILITY: peer_n=3; Pxx=0; unrated=27
- PAYOFF_ASYMMETRY: peer_n=1; Pxx=0; unrated=18
- ACTIVITY_PERSISTENCE: peer_n=22; Pxx=30; unrated=0
- HIGH_FREQUENCY_SIGNAL_VALUE: peer_n=4; Pxx=0; unrated=8
- TRANSFER_ACCOUNTING_RISK: peer_n=2; Pxx=0; unrated=32

Pxx is same-scene only and is suppressed when peer_n < 10. The count of percentile-bearing scores can exceed the primary-scene cohort count because valid secondary scene scores are evaluated against the same primary-scene peer cohort; no cross-scene ranking is emitted.

## Boundaries

No global wallet score, global rank, Alpha grade, direct-follow instruction, or shadow-follow statistics are emitted. `BORROWED_PROXY` and `CHAIN_SAMPLED` remain distinct. Private addresses, raw provider responses, raw transactions, and `chainfm_out` remain outside Git.
