# Acceptance: SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-REPAIR-002

## Verdict

**READY_FOR_INDEPENDENT_AUDIT (implementer gates GREEN)**

Date: 2026-07-30
Baseline: `1f9856140dbfc1cf30334343b196678ead56b6cd`
Implementation commit: `6a0a7f22968a11d926a55be1533db4edfbaf1f77`

This narrow repair closes the remaining findings from `SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-REPAIR-AUDIT-001`. It used only synthetic fixtures and zero network, provider, credential, GMGN/Helius/RPC, or private-address processing.

## Implemented

- Completeness is validated as a finite value in `[0,1]` at the builder boundary.
- Present rows with missing or invalid completeness receive a HIGH anomaly and a DQ-C-or-lower cap.
- `MAPPED` rows with completeness below 1 receive an explicit status-consistency anomaly, require manual review, and are capped below DQ-A.
- `partial_fields` warnings cap quality below DQ-A.
- Alpha eligibility now independently requires complete 30d coverage and rejects both period-unverified and partial-fields warnings.
- PARTIAL rows retain explicitly provisional borrowed scores when finite, but remain capped and Alpha-ineligible.
- Duplicate labels merge deterministically with label deduplication and distinct note preservation.
- The data dictionary now states that accounting residuals are observational provider-semantic differences rather than direct consistency penalties.
- The rule version advances to `wallet-data-quality-v3`.

## Regression coverage

Synthetic tests now directly cover:

- explicit positive, zero, negative, and unavailable 30d profit buckets, all populated and totaling 1,433;
- duplicate 7d period records failing closed;
- input-address deduplication while preserving first source order;
- label merge/deduplication;
- exact master-output field allowlist;
- incomplete `MAPPED`, partial-fields, null, out-of-range, and NaN completeness behavior;
- PARTIAL provisional score/tier semantics and Alpha exclusion;
- direct disjointness of Alpha and review union wallet sets;
- deterministic replay hashes and prior null/period/rank/privacy regressions.

Generated 30d test partition:

- positive: 1,430
- explicit zero: 1
- negative: 1
- unavailable: 1
- total: 1,433

## Acceptance commands

| Command | Result |
| --- | --- |
| Repair task validation | GREEN |
| `npm run harness:doctor` | GREEN; only expected dirty-worktree warning during implementation |
| `npm run typecheck` | PASS |
| `npm test` | 350 total / 349 pass / 1 skipped / 0 fail |
| `npm run build` | PASS |
| `git diff --check` | PASS |

## Retained boundaries

- GMGN data remains borrowed/unverified.
- Formal Alpha score/tier and first-hand verification remain null.
- No private 1,433-wallet batch was read or rerun.
- No architecture migration, provider addition, database/CI work, jobs extraction, or CaScanResponse work was performed.
- This implementer seal is not the final T2 verdict; an independent audit is still required.
