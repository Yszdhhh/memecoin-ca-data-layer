# Acceptance: SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-REPAIR-AUDIT-002

## Verdict

**FAIL**

Date: 2026-07-30
Baseline: `1f9856140dbfc1cf30334343b196678ead56b6cd`
Sealed tip: `db8a73a07de8443bade2cb05c54917c77df7cfd3`
Implementation commit: `6a0a7f22968a11d926a55be1533db4edfbaf1f77`

Repair 002 closes completeness validation, 30d Alpha isolation, PARTIAL evidence wording, accounting-residual documentation, four-way profit buckets, and exact write-set isolation. It is not GREEN because provider completeness constraints are not applied symmetrically to 7d during Alpha eligibility.

## Blocking findings

### ALPHA-ISOLATION-1 — HIGH

`alphaEligible()` checks `PARTIAL`, completeness, `period_unverified`, and `partial_fields` only for 30d. A 7d PARTIAL, incomplete-MAPPED, or partial-fields row can remain DQ-B with no manual review and enter Alpha ranking when 30d is complete.

Required: apply explicit provider-completeness eligibility checks to both periods rather than relying on manual-review side effects.

### TEST-REPAIR-2 — HIGH

Missing non-vacuous builder regressions:

- duplicate 30d record fails closed;
- 7d PARTIAL, partial-fields, and incomplete-MAPPED rows cannot enter Alpha ranking;
- both Alpha and review unions are non-empty before asserting disjointness.

## Verified repairs

- present completeness is finite and in `[0,1]`;
- missing/invalid completeness is capped DQ-C or lower;
- incomplete MAPPED and partial-fields are capped below DQ-A;
- 30d incomplete/PARTIAL/unverified rows are Alpha-ineligible;
- PARTIAL finite values may retain provisional borrowed scores;
- accounting residual dictionary matches implementation;
- generated partition is 1,430 positive / 1 zero / 1 negative / 1 unavailable;
- actual repair paths exactly match the seven declared write-set paths.

## Acceptance evidence

| Command | Result |
| --- | --- |
| Audit task validation | GREEN |
| Harness doctor | GREEN, 0 errors / 0 warnings |
| Typecheck | PASS |
| Full tests | 350 total / 349 pass / 1 skipped / 0 fail |
| Build | PASS |
| Baseline-to-tip diff check | PASS |
| Write-set comparison | EXACT_MATCH |
| Worktree | Clean |

No private data, credential, live provider/network call, private batch, push, merge, or main modification occurred.

## Required next action

Create a narrow repair 003 for symmetric 7d/30d Alpha isolation and the remaining non-vacuous tests, then independently re-audit it.
