# Dispatch: SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-001

## Role
Implementer — cold path, offline only.

## Goal
Implement Wallet HUD v0.2 on top of existing Wallet HUD v0.1 and 32 SOL candidate addresses, supporting primary/secondary scene evaluation across 5 initial scenes, scene strength and percentile, peer_n and effective sample counts, evidence tier/confidence, recent trend, followability status, full and incremental GMGN notes export, and HUD change history.

## Scenes
- MULTI_TOKEN_REPEATABILITY
- PAYOFF_ASYMMETRY
- ACTIVITY_PERSISTENCE
- HIGH_FREQUENCY_SIGNAL_VALUE
- TRANSFER_ACCOUNTING_RISK

## Boundaries
- Process strictly 32 SOL candidate addresses only.
- Suppress Pxx percentile when same-scene peer_n < 10.
- No global wallet overall score or global ranking.
- No Alpha score, S/SSR/EX grades, direct copy-trade, or heavy position conclusions.
- Suppress simulated win rate, PF, latency, or follow percentile when shadow follow events equal 0.
- Never treat null as 0.
- Offline execution only: zero network requests to GMGN, Helius, RPC, or third parties.
- No background daemons, monitoring, Cron, or shadow follow runners.
- Private addresses, GMGN details, raw transactions, and `chainfm_out` must not enter Git.
