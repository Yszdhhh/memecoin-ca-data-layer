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
- **B** High win rate + trades ≥ 15 + profit > 0 + no HIGH, EXTREME_*, window conflict, or win-rate unit ambiguity (low residuals may still be disclosed)
- **C** Win rate ≤ 35 + high profit — *lead only*, not “golden dog hunter”; excludes unit-ambiguous win rates
- **D** 7d profit ≥ 2× (30d/4.28) with profit_30d > 50 guard
- **E** Strong 30d + recent decay/inactivity → Dormant research pool
- **F** High frequency / asymmetric / extreme / residual — **Suspicious only**
- **G** Typed source-claim vs stats conflict; CLAIM_SMART_MONEY_UNVERIFIED only from explicit smart-money claims (not top/rank/KOL)
- **H** Sparse/missing GMGN but rich original intel → Insufficient Data Review

## research_priority_rank
- Multi-category diversity ordering for research sampling
- Not profitability, not copy-trade priority, not formal Alpha rank

## Coverage status
- 30–50 unique candidates AND ≥6 categories → SUCCESS
- Below min / above max / <6 categories → DEGRADED (artifacts retained)
- Structural contract errors → FAILED

## recommended_next_action vocabulary
HUMAN_REVIEW | GMGN_HISTORY_REVIEW | CHAIN_VERIFICATION | DORMANT_MONITOR | INSUFFICIENT_DATA | EXCLUDE_FROM_FOLLOWING

`recommended_next_action` == `primary_recommended_action`

Forbidden: BUY, SELL, COPY_TRADE
