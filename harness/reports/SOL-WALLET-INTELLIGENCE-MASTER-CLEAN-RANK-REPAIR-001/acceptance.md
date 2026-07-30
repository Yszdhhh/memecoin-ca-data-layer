# Acceptance: SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-REPAIR-001

## Verdict

**READY_FOR_INDEPENDENT_AUDIT (implementer gates GREEN)**

Date: 2026-07-30  
Baseline SHA: `f561ab5b7f67f271e2697dafbb7181c7f09085cb`  
Branch: `codex/solana-daily-new-token-analysis`

This repair stayed inside the declared write set. It did not read credentials or private wallet inputs, issue network/provider requests, invoke GMGN/Helius/RPC, or rerun the external 1,433-wallet product.

## Implemented repairs

| Audit finding | Repair evidence |
| --- | --- |
| PROFIT-1 / PROFIT-2 / NULL-1 | Builder now emits a four-way 30d partition: positive, explicit zero, negative, and unavailable. Null is never counted as zero. Synthetic acceptance asserts the four buckets sum to the full population. |
| NULL-2 | 30d percentile and candidate scoring use only the 30d value. Missing, partial, unavailable, or period-unverified 30d profitability is unqualified and does not fall back to 7d. |
| Win-rate unit defect | Normalized GMGN win rate is treated explicitly as a 0-100 percentage. A 65% fixture contributes 65 win-rate points before weighting, rather than being multiplied to the 100-point cap. Small samples scale down the win-rate contribution. |
| DQ-1 | PARTIAL rows are capped below DQ-A; any `period_unverified` row is capped at DQ-C or lower. |
| DQ-2 | Summary fields are now named `walletsWithAnomaliesCount` and `anomalyFlagsTotalCount`, separating affected-wallet count from total flags. |
| Accounting semantics | Provider profit residuals remain observable evidence but are LOW observations, not assumed accounting errors and not direct consistency penalties. |
| RANK-1 | `alphaCandidateRank` and `reviewPriorityRank` are assigned independently. `borrowedLeadRank` remains only as a compatibility alias of `alphaCandidateRank`. Master export order is source order, not a hidden mixed ranking. |
| RANK-2 | Alpha-candidate and review-priority groups/unions have explicit `shortlistType` values and separate JSON collections. Manual-review rows are excluded from alpha ranking and alpha union. |
| RANK-3 | High-win-rate requires at least 20 30d trades. Activity eligibility is bounded, and the activity score declines after the healthy range instead of monotonically rewarding extreme frequency. |
| REPLAY-1 / REPLAY-2 | Replay manifest uses deterministic `evaluation_time`, sourced from caller-controlled `evalTimeMs` or the latest input `fetchedAt`; no write-time wall clock is included. The synthetic double-run asserts replay-manifest hash equality. |
| PRIV-1 | Invalid-address errors identify the failing input position and redact the raw value; regression coverage asserts the secret test value is absent from the error. |

## Synthetic generated metrics

The full builder fixture contains 1,433 generated Base58 addresses only. Its 30d profit partition is generated and asserted as:

- Positive: 1,432
- Explicit zero: 0
- Negative: 0
- Unavailable: 1
- Total: 1,433

One synthetic row is deliberately manual-review-only. Acceptance asserts it receives `reviewPriorityRank` and no `alphaCandidateRank`; the unavailable-profit row receives neither a composite lead score nor an alpha rank.

## Acceptance commands

| Command | Result |
| --- | --- |
| `npm run harness:task -- validate harness/tasks/SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-REPAIR-001.json` | GREEN |
| `npm run harness:doctor` | GREEN; expected dirty-worktree warning during implementation |
| `npm run typecheck` | PASS |
| `npm test` | PASS: 348 tests, 347 passed, 1 skipped, 0 failed |
| `npm run build` | PASS |
| `git diff --check` | PASS |

## Boundaries retained

- GMGN values remain borrowed and unverified.
- First-hand verification, formal Alpha scoring, and final wallet grades remain null.
- No provider, schema, database, CI, directory-layout, jobs/experiments, CaScanResponse, or broader architecture work was performed.
- No private output hashes or hand-entered production profit counts are asserted by this repair report.


## Seal status

Implementation is sealed for an independent T2 auditor. This implementer report is not the final milestone verdict.

