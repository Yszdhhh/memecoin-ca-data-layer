# Audit: SOL-ALPHA-SCORE-001 (alpha-score-v1)

**Verdict: GREEN_WITH_ADVISORY**

Auditor: `grok-auditor-alpha-score` (≠ implementer `grok-implementer-alpha-score`).  
Run: `20260727_SOL_ALPHA_SCORE_AUDIT_001`.  
Implementer HEAD: `e85c998`. **Owner decisions: none.**

---

## Scope

Verify offline pure scoring against methods doc Part 1 / task objective:

- Deterministic population scoring  
- `insufficient` ≠ tier `N`  
- Borrowed PnL → `provisional` + confidence ≤ 0.6  
- Anti-gaming penalties (luck / supertoken / cluster / bot)  
- Dual rule versions + inputsHash  
- No network; no transfer-as-PnL path  
- Does not lower 0.85 cluster exclusion in `funding-clusters.ts`

---

## Method

| Step | Result |
| --- | --- |
| Line review | `src/domain/rules/alpha-score.ts`, types in `src/domain/types.ts` |
| Tests | `npm test` includes 6 alpha tests — PASS (146 total) |
| Typecheck/build | PASS |
| Spot checks | insufficient path; provisional; rank strong>weak; cluster/bot pen; haircut |

---

## Confirmed controls

1. **Evidence bar** (`meetsMinimumEvidence`): distinctTokens≥5, closed≥3, span≥7d → else `status: insufficient`, `tier: null`, warning `alpha_status_insufficient_not_N` (`alpha-score.ts` scoreWallet early return).  
2. **Borrowed-only** → `provisional` + `confidence` min with `borrowedConfidenceCap` 0.6 + `alpha_pnl_borrowed_unverified`.  
3. **EWM half-life 14d** in `ewmWeight` / `buildFeatureVector`.  
4. **Robust-z + weighted CoreAlpha + percentile map** (`scoreWallet`).  
5. **Penalties** with #4-shaped payload (`computePenalties`: pen_luck, pen_supertoken, pen_cluster, pen_bot).  
6. **Liquidity haircut** multiplies excess in feature build.  
7. **Provenance**: `alphaScoreRuleVersion`, `marketBaselineVersion`, `inputsHash`, `bandCutpoints`.  
8. **Positions** typed with `pnlSource` only `first_hand_swap | borrowed_unverified` — no transfer PnL field.  
9. **funding-clusters.ts** not modified (write set respected by implementer commit).

---

## Advisories (non-blocking)

**A1** — Market baseline is an **input** (`MarketBaselineInput`); engine does not yet build regime/universe from raw token population. Acceptable for pure scoring module; growth-loop / baseline job is a later task.

**A2** — Win-rate market baseline fixed at 0.45 for `winRateExcess` feature; should be replaced by `MarketBaseline.market_win_rate` when baseline builder exists.

**A3** — Population must be large enough for stable robust-z; thin universes warn `market_baseline_thin` but still score — callers must enforce MIN_UNIVERSE_TOKENS operationally.

**A4** — Cluster/bot flags are **caller-supplied** booleans until `SOL-DETECTORS-001` wires real detectors.

---

## Acceptance reproduction

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS (audit write set only) |

---

## Verdict

**GREEN_WITH_ADVISORY** — Core alpha-score-v1 invariants for offline fixture scoring hold. Follow-ups A1–A4 are integration, not gate failures.

No Owner decision required. Does not accept live scoring, detectors, or E2E.
