# Acceptance: SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-REPAIR-AUDIT-001

## Verdict

**FAIL**

Date: 2026-07-30

- Role: independent auditor
- Baseline: `f561ab5b7f67f271e2697dafbb7181c7f09085cb`
- Sealed repair tip: `0ede95098f6aa01af3686d594f921bce44b1225b`
- Implementation commit: `8a5e30363ea4471f125b92e27688b31545a30e27`
- Layer / tier: `cold_path` / `T2`
- Network/provider/credential/private-address budget used: 0

All declared offline commands passed and the sealed write set matched exactly, but two HIGH findings remain open.

## Blocking findings

### DQ-REPAIR-1 — HIGH

A provider row explicitly marked `MAPPED` can retain `completeness < 1`. The quality rule caps `PARTIAL` and `period_unverified`, but not incomplete or null completeness, `partial_fields` warnings, or a `MAPPED`/completeness inconsistency. A 30d row with `status=MAPPED` and `completeness=0.5` can therefore receive DQ-A and an Alpha candidate rank.

Required repair:

1. Validate completeness in `[0,1]`.
2. Cap every present row with completeness below 1 below DQ-A.
3. Treat `MAPPED` plus incomplete completeness as a consistency anomaly.
4. Cap `partial_fields` warnings.
5. Add deterministic tests for these cases.

### TEST-REPAIR-1 — HIGH

Prior TEST-1 remains partially open. Required regression coverage is still missing for:

- explicit-zero and negative builder aggregation;
- all four profit buckets populated and mutually exclusive;
- duplicate period records failing closed;
- address deduplication and source order;
- label merge/deduplication;
- output field allowlist;
- incomplete `MAPPED` and `partial_fields` quality caps;
- PARTIAL score/tier semantics;
- direct Alpha/review union address disjointness.

The current 1,433-row synthetic fixture has 1,432 positive, 0 zero, 0 negative and 1 unavailable row, so its sum assertion does not prove zero or negative classification.

## Other findings

### EVIDENCE-1 — MEDIUM

The implementer report says PARTIAL 30d profitability is unqualified. The code may retain provisional borrowed scores/tier for a finite PARTIAL row, while correctly excluding it from Alpha ranking. Either make PARTIAL fully unqualified or correct the report to describe the provisional-score boundary.

### DOC-1 — LOW

The generated data dictionary still says realized profit is checked against sold income minus bought cost. The repaired rule now records that residual as a LOW provider-semantic observation without reducing consistency. Align the dictionary with the implemented behavior.

## Prior finding disposition

| Finding | Disposition |
| --- | --- |
| PROFIT-1, PROFIT-2, NULL-1, NULL-2 | Resolved in code/report |
| WS-1, GMGN-1 | Resolved |
| DQ-1 | Partially resolved; blocking |
| RANK-1, RANK-2, RANK-3 | Resolved |
| TEST-1 | Partially resolved; blocking |
| DQ-2, REPLAY-1, REPLAY-2, PRIV-1, ASSOC-1, DQ-3 | Resolved or boundary retained |

## Acceptance evidence

| Command | Result |
| --- | --- |
| Audit task validation | GREEN, exit 0 |
| `npm run harness:doctor` | GREEN, 0 errors / 0 warnings |
| `npm run typecheck` | PASS |
| `npm test` | 348 total / 347 pass / 1 skipped / 0 fail |
| `npm run build` | PASS |
| `git diff --check f561ab5..0ede950` | PASS |
| Declared versus actual write set | Exact match |

No private inputs were read and no live request, provider call, GMGN/Helius/RPC invocation, push, merge, or main modification occurred.

## Required next action

Create a narrow second repair covering the two HIGH findings and evidence/documentation mismatches, then seal and independently re-audit it before proceeding to the CaScanResponse repair.
