# Acceptance — SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-002

## Verdict

**DONE (ready for independent AUDIT-002)**

Date: 2026-07-30  
Role: implementer  
Branch: `feature/sol-ca-real-data-cleaning-pilot-001`  
Workspace HEAD at start: `e3c3405009fb86c27c25a827f8edea39a6c5ae2d`  
Audit pin (ancestor): `84b9a8dd424b70e34220f9eb06db47e381838ee1`  
Local root: `G:\链上战壕`

## Baseline confirmation

| Check | Result |
| --- | --- |
| Branch | `feature/sol-ca-real-data-cleaning-pilot-001` |
| Audit pin is ancestor of HEAD | YES (`84b9a8d` → `e3c3405`) |
| Contains PILOT-001 | YES |
| Contains AUDIT-001 | YES |
| Contains SOL-WALLET-CLEAN-RANK-REPLAY-UNDER-REPAIR-003-RULES-001 | YES |
| Auto merge/rebase/history rewrite | NOT performed |

HEAD is one docs commit after the audit pin (audit publish + Repair-003 clean-rank replay). Lineage is consistent; no history rewrite.

## Boundary confirmation

| Boundary | Actual |
| --- | --- |
| Network requests | 0 |
| Provider / Helius / GMGN / RPC | 0 |
| Credential / DPAPI reads | 0 |
| Live 6-CA re-fetch | 0 |
| main modified | 0 |
| push / force-push | 0 |
| Private wallet tables | not touched |
| CaScanResponseV1 base contract | unchanged |

## Blocking findings repaired

### F-MIXED-001 — mixed-owner silent whole-owner exclusion

**Before:** `ownerClassFromAccounts` preferred exclusion classes; zero/closed/invalid siblings dropped positive same-owner balances into excluded universe.

**After:** Explicit `resolveOwnerCleaningClass`:

| Mix | Owner class | Partition |
| --- | --- | --- |
| included + zero_balance | `included_holder` | positive → cleaned |
| included + closed (raw=0) | `included_holder` | positive → cleaned |
| included + closed (raw>0) | `unresolved_exclusion_candidate` | full balance → unresolved + manual review |
| pure zero / pure closed-zero | `zero_balance` / `closed_or_inactive` | excluded only when no positive included |
| hard-evidence burn/infra/pool | whole-owner exclusion | evidence required; not triggered by zero/closed/invalid siblings |

### F-MIXED-002 — invalid mixed owners silent exclude

**After:** included + `invalid_or_unparseable` → `unresolved_exclusion_candidate` + issue `mixed_owner_unparseable_sibling` + `whetherManualReviewRequired=true`. Positive residual never lands solely in excluded universe.

### F-POOL-SCOPE-001 — concentration confirmed without pool coverage

**After:** Domain fields are split:

| Field | Meaning |
| --- | --- |
| `accountingEligible` | pagination complete + mint parseable + partition identity + residual 0 + no accounting-blocking issues |
| `exclusionCoverage` | pilot default `partial` (never claims `complete`) |
| `concentrationEligible` | accountingEligible ∧ exclusionCoverage=complete ∧ no unresolved positive ∧ no concentration blocking |
| `judgmentEligible` | **legacy alias of `accountingEligible` only** |

CaScan mapping:

- Accounting-complete CAs emit **confirmed** `holder_supply_accounting_complete` (owner aggregation + mint supply reconciliation only).
- Top10/Top20 remain **unverified**, completeness ≠ 1, ratio null, warnings include `pool_exclusion_coverage_incomplete`.
- Separate unverified judgment: `holder_concentration_scope_unverified`.
- Misleading single summary (“…with complete pagination”) removed for concentration scope.

## New issue codes

- `mixed_owner_classification_conflict`
- `mixed_owner_positive_closed_balance`
- `mixed_owner_unparseable_sibling`
- `pool_exclusion_coverage_incomplete`
- `owner_partition_identity_failed`

## Regression matrix

See `regression-matrix.json` — **17/17 PASS** (R1–R16 + 6-CA offline remap).

## 6 CA offline remap (no Helius)

| Historical | Count | Remapped accounting | Remapped concentration |
| --- | --- | --- | --- |
| OK | 3 | confirmed | unverified |
| PARTIAL | 3 | unverified | unverified |

- Original 6 CA / 30 Helius request historical facts **unchanged** (Live artifacts not rewritten).
- Diff detail: `remap-diff-summary.json`.

## Gates

| Command | Result |
| --- | --- |
| `npm run harness:doctor` | GREEN (dirty-tree warning expected mid-delivery) |
| `npm run typecheck` | PASS |
| `npm test` | PASS (407 pass / 1 skipped / 0 fail) |
| `npm run build` | PASS |
| Forbidden provider/credential leak scan | PASS on repair write-set (test intentionally injects `apiKey` field to assert schema rejection — not a live secret) |
| Exact write-set | PASS (see `exact-write-set.txt`) |
| Deterministic replay | PASS (R16 + existing hash tests) |
| Positive-balance conservation | PASS (R10/R11 + partition identity gate) |
| git diff hygiene | Only allowed core + harness deliverables |

## Owner gate (not claimed by this task)

Do **not** merge pilot to main.  
Do **not** open hotpath or Live batches.

Next task only:

`SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-AUDIT-002`

Independent zero-network auditor must re-run mixed-owner cases, partition conservation, accounting/concentration split, 6-CA remap, leak + write-set checks, and output **GREEN** or **REQUEST_CHANGES**.

## Artifacts

- `harness/tasks/SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-002.json`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-002/acceptance.md`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-002/regression-matrix.json`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-002/remap-diff-summary.json`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-002/exact-write-set.txt`
