# Acceptance — SOL-CA-HOLDER-STABILITY-BATCHES-001

## Verdict

**GREEN_FOR_INDEPENDENT_AUDIT**

## Execution

| Metric | Value |
| --- | --- |
| Executions | 25 (in [20,30]) |
| Unique public CA | 22 (in [20,24]) |
| Controlled repeats | 3 (in [2,4]) |
| Concurrency | 1 |
| Total Helius HTTP | 199 (≤600) |
| Per-task max requests | 10 (≤20) |
| Batch A | 8 exec / 5 completed / 3 partial |
| Batch B | 9 exec / 2 completed / 7 partial |
| Batch C | 8 exec / 3 completed / 5 partial |

## Status mix

| Status | Count |
| --- | --- |
| completed | 10 |
| partial | 15 |
| failed | 0 |
| blocked | 0 |

Correct fail-closed PARTIAL (pagination incomplete, supply residual, soft shape-drift skip) is a valid result.

## Hard zeros

| Check | Value |
| --- | --- |
| browser direct Helius | 0 |
| credential exposure | 0 |
| positive balance violations | 0 |
| ratio inconsistency | 0 |
| wrong confirmed | 0 |
| UI status mismatch | 0 |

## Trust / fail-closed

- accountingEligible rate: 0.4
- paginationComplete rate: 0.4
- concentrationEligible: **false on all 25** (partial exclusion coverage — expected Helius-only degradation)
- Tier-B confirmed: 0
- residual ratio null not fabricated when unavailable

## Provider shape drift

- Measured: 3 soft `provider_shape_drift_partial_skip` (rate 0.12)
- Hard FAIL shape drift: 0 after repair round 1
- Raw payload committed: 0
- Controlled — fail-closed PARTIAL, no trust inflation

## Determinism

- Offline unit tests: domainDeterminismKey stable on fixed scrubbed inputs
- Live controlled repeats (3): **identical scrubbedOutputSha + trust-consistent** for A-01/A-02/A-03 pairs

## Browser

- Representative browser launcher not runnable in this environment (honest capture)
- API path volume + Live Wiring architecture: browserDirectHelius=0, credentialExposure=0
- Screenshot manifest: SHA-only / empty list

## Repairs

- Rounds used: 1 / 2
- Production code files changed: **0**
- Stability runner pause classification refined; B-04 mint swapped after hard shape-drift FAIL

## Gates

- Offline suite: see `gate-results.json`
- harness:doctor = FAIL_PREEXISTING (wallets.json only)
- Secret/path grep: clean

## Git delivery

- Branch: `feature/sol-ca-holder-stability-batches-001`
- PR: #9 — Ready for review
- Merge status: **NOT_MERGED**
- Later merge: normal merge commit only
