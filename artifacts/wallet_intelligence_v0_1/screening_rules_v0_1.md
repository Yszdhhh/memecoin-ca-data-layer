# Screening rules v0.1

## Principles
1. Scores are for candidate ordering only — not trading ability.
2. Data confidence is separate from performance signals.
3. Each category A–H uses its own rules; no single final total score.
4. Percentiles from the current 1,433-address valid sample.
5. Null stays null; never coerce to 0.
6. Small samples are explicitly penalized.
7. Extreme profit flags concentration *risk*, not measured HHI (no per-token data).

## Category rules (summary)
- **A** Active + 30d profit ≥ p75 (positive subset) + min trades/tokens
- **B** High win rate + trades ≥ 15 + profit > 0
- **C** Win rate ≤ 35 + high profit — *lead only*, not “golden dog hunter”
- **D** 7d profit ≥ 2× (30d/4.28) with profit_30d > 50 guard
- **E** Strong 30d + recent decay/inactivity → Dormant research pool
- **F** High frequency / asymmetric / extreme / residual — **Suspicious only**
- **G** Source label vs stats conflict; claims stay source_claim
- **H** Sparse/missing GMGN but rich original intel → Insufficient Data Review

## GMGN period_unverified
- Lowers confidence_cap
- Blocks formal Alpha / grades
- Does **not** wipe gmgn_lead_score or empty the candidate list

## recommended_next_action vocabulary
HUMAN_REVIEW | GMGN_HISTORY_REVIEW | CHAIN_VERIFICATION | DORMANT_MONITOR | INSUFFICIENT_DATA | EXCLUDE_FROM_FOLLOWING

Forbidden: BUY, SELL, COPY_TRADE
