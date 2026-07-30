# Acceptance — SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-AUDIT-002

## Verdict

# GREEN

Date: 2026-07-30 (evening)  
Role: **Independent zero-network auditor**  
Branch: `feature/sol-ca-real-data-cleaning-pilot-001`  
**Exact audit pin (not floating HEAD):** `a1d56dade268d24a1205e010581b6f6c478ac1bb`  
Pre-repair audit pin: `84b9a8dd424b70e34220f9eb06db47e381838ee1`  
Main baseline (unchanged): `777e0131ec663178c6c4cc5cc0c4584e60be2381`  
Local root: `G:\链上战壕`

---

## Boundary confirmation (actual)

| Boundary | Actual |
| --- | --- |
| Network requests | **0** |
| Helius | **0** |
| GMGN | **0** |
| RPC / other providers | **0** |
| Credential reads | **0** |
| DPAPI reads | **0** |
| Private wallet detail reads | **0** |
| Implementation code modifications by auditor | **0** |
| main modifications | **0** |
| merge / rebase / push / force-push | **0** |

Allowed actions only: read fixed pin code + committed scrubbed fixtures/reports; create audit task/report; run offline tests/typecheck/build/leak scan.

---

## Lineage

| Check | Result |
| --- | --- |
| `84b9a8d` is ancestor of `a1d56da` | **YES** |
| `e3c3405` relation to `a1d56da` | **Immediate parent** (linear: `84b9a8d` → `e3c3405` → `a1d56da`) |
| Repair report vs final commit | Repair-002 reports **first appear in `a1d56da`** with the implementation (not after a later silent code change) |
| Claimed write-set vs `git diff e3c3405..a1d56da` | **MATCH** (9 paths: 4 core files + task + 4 report files) |
| Unrelated implementation churn | **NONE** |
| Branch contains PILOT-001 / AUDIT-001 / REPAIR-002 / CLEAN-RANK-REPLAY-003 | **YES** |
| main at 777e013 | **YES** |

Machine-readable: `lineage.json`.

---

## Blocking findings from AUDIT-001 — disposition

| ID | Disposition | Auditor evidence |
| --- | --- | --- |
| F-MIXED-001 | **FIXED** | included+zero / included+closed-zero stay `included_holder`; positives not silently excluded |
| F-MIXED-002 | **FIXED** | included+invalid → `unresolved_exclusion_candidate` + manual review |
| F-POOL-SCOPE-001 | **FIXED** | independent `accountingEligible` / `exclusionCoverage` / `concentrationEligible`; Top10/Top20 not confirmed under partial pool coverage |

No new blocking findings.

Advisory only: `A-SUMMARY-SURFACE-001`, `A-DOMAIN-OBS-RATIO-001` (see `findings.json`).

---

## Mixed-owner matrix (required 15)

All **15/15 PASS** (unit R1–R16 + auditor offline probe). Key expectations verified:

| Mix | Expected | Observed |
| --- | --- | --- |
| included + zero | keep included | PASS |
| included + closed-zero | keep included | PASS |
| included + closed-positive | unresolved + manual review | PASS |
| included + invalid | unresolved + manual review | PASS |
| included + unresolved path | unresolved | PASS |
| hard-evidence infrastructure | whole-owner exclude with evidence | PASS |
| pure zero / pure closed-zero | excluded classes | PASS |
| multi positive ATAs | sum retained | PASS |
| partitions exclusive | yes | PASS |
| no double-count / conservation | identity holds | PASS |
| deterministic replay | hash equal | PASS |

Token-account sibling zero/closed/invalid alone **cannot** force whole-owner infrastructure exclusion. Only owner-level hard evidence does.

---

## Trust state split

Code truly separates (not rename-only):

| Field | Gate |
| --- | --- |
| `accountingEligible` | pagination complete ∧ mint parseable ∧ partition identity ∧ residual 0 ∧ no accounting-blocking issues |
| `exclusionCoverage` | pilot **`partial`** (never claims complete without first-hand pool enum) |
| `concentrationEligible` | accountingEligible ∧ exclusionCoverage=complete ∧ no unresolved positive ∧ no concentration-blocking |
| `judgmentEligible` | **legacy alias of `accountingEligible` only** |

CaScan mapping:

- Accounting judgment may be **confirmed** when accountingEligible.
- Concentration judgment stays **unverified** with warnings including `pool_exclusion_coverage_incomplete`.
- Top10/Top20: `verificationStatus=unverified`, `ratio=null`, completeness ≠ 1.
- Universe definition is observational (`…pool_exclusion_incomplete`), **not** cleaned investor universe.

---

## Offline 6 CA remap (no Helius)

| Historical | Count | Remapped accounting | Remapped concentration |
| --- | --- | --- | --- |
| OK | 3 | confirmed | unverified |
| PARTIAL | 3 | unverified | unverified |

- Live history (6 CA / 30 Helius) **not rewritten**.
- Detail: `remap-diff-summary.json` (this audit run).

---

## Legacy alias

`judgmentEligible` only equals `accountingEligible`.

Call sites use it for batch OK/PARTIAL **accounting** status and summary export.  
**No** call site uses it to confirm concentration / Top10 / Top20 / whale control.

---

## Offline gates (this audit — actual counts)

| Command | Result |
| --- | --- |
| `npm run harness:doctor` | **GREEN** (0 errors, 0 warnings) |
| `npm run typecheck` | **PASS** |
| `npm test` | **PASS** — **407 pass / 1 skipped / 0 fail** (408 tests, ~3662 ms) |
| `npm run build` | **PASS** |
| Targeted holder + pilot tests | **34/34 PASS** |
| Forbidden secret-value leak scan | **PASS** (docs may mention DPAPI path names; no secret material) |
| Tracked raw payload scan | **PASS** |
| Exact write-set (repair commit) | **PASS** |
| Deterministic replay | **PASS** |
| Positive-balance conservation | **PASS** |
| git hygiene | Auditor wrote only task/report/status docs; main untouched |

---

## Owner gate (stop here)

Even with **GREEN**, auditor **must not** and **did not**:

* merge main  
* start hotpath  
* start new Live batches  
* start Web real Provider wiring  
* open Portfolio spike  
* modify wallet rules  

Next actions require **Owner** decision.

### Suggested order after Owner approve

1. Prepare CA pilot merge to main (only audited feature paths; no private data).  
2. `OPERATOR-CONSOLE-MVP-001` (fixtures/desensitized first).  
3. `SOL-CA-HOLDER-HOTPATH-INTEGRATION-001`.  
4. Stability batches 001–003.  
5. `ADDRESS-INTELLIGENCE-LOCAL-STORE-MVP-001`.

---

## Artifacts

- `harness/tasks/SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-AUDIT-002.json`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-AUDIT-002/acceptance.md`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-AUDIT-002/findings.json`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-AUDIT-002/regression-results.json`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-AUDIT-002/lineage.json`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-REPAIR-AUDIT-002/exact-write-set.txt`
- plus supporting: `remap-diff-summary.json`, `_probe.mjs`, `probe-output.json`
