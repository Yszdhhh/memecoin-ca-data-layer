# Acceptance — SOL-CA-REAL-DATA-CLEANING-PILOT-AUDIT-001

## Verdict

**REQUEST_CHANGES**

Date: 2026-07-30  
Role: Independent offline auditor  
Audited task: `SOL-CA-REAL-DATA-CLEANING-PILOT-001`  
Branch tip: `84b9a8dd424b70e34220f9eb06db47e381838ee1`  
Base main: `777e0131ec663178c6c4cc5cc0c4584e60be2381`  
Local root: `G:\链上战壕`

## Boundary confirmation

| Boundary | Actual |
| --- | --- |
| Network requests | 0 |
| Provider / Helius / GMGN / RPC requests | 0 |
| Credential / DPAPI reads | 0 |
| Implementation or test edits by auditor | 0 |
| Push / merge / main modification | 0 |
| Local private wallet tables | not touched |

## Executive summary

The pilot correctly delivers Helius-only full enumeration plumbing, BigInt supply accounting, PARTIAL fail-closed gates on incomplete pagination/supply residual, scrubbed Live artifacts for 6 public CAs (3 OK / 3 PARTIAL / 30 Helius requests), and offline determinism tests.

**It does not pass independent audit.** Forced mixed-owner classification cases prove that zero-balance, closed, or invalid sibling token accounts can **silently whole-owner-exclude** a positive included balance. Unparseable mixed owners are not escalated to unresolved/manual review. Separately, incomplete pool/liquidity exclusion coverage still allows **confirmed** concentration metrics on OK CAs, which overstates cleaned investor control.

Merge to main, hot-path integration, and multi-batch CA stability runs remain **blocked** until a repair is implemented and re-audited GREEN.

## Forced mixed-owner audit cases

Offline probe against `cleanHolderUniverse` (no network):

| Case | Expected | Observed | Result |
| --- | --- | --- | --- |
| positive included + zero_balance (same owner) | positive owner remains included or unresolved; not wholly dropped | owner class=`zero_balance`, raw=`100`, placed in excluded universe | **FAIL** |
| positive included + closed | same | class=`closed_or_inactive`, raw=`150` excluded | **FAIL** |
| positive included + invalid | unresolved / manual review | class=`invalid_or_unparseable`, raw=`100` excluded, unresolved=0 | **FAIL** |
| positive included + unresolved | unresolved / manual review | no account-level unresolved path; include+exclude never upgrades when priority class is already excluded | **FAIL / gap** |
| positive included + hard-evidence infrastructure (owner is known program id) | exclude with evidence | class=`known_program_or_infrastructure` | **PASS** |

Root cause (code): `ownerClassFromAccounts` prefers exclusion classes; the mixed re-evaluation only sets `unresolved_exclusion_candidate` when `!isExcludedClass(cleaningClass)`, which is unreachable whenever any excluded class is present.

## State separation review

| Concern | Separated? | Notes |
| --- | --- | --- |
| Accounting verification | Partial | residual / identity / completeness present |
| Pagination completeness | Yes | `paginationComplete` + `pagination_incomplete` issue |
| Infrastructure / pool exclusion coverage | Weak | live OK CAs show excludedOwnerCount=0; no coverage flag |
| Holder risk judgment | **Not fully separated** | `judgmentEligible` conflates accounting completeness with concentration confirmation |

Required product rule when pool exclusion coverage is incomplete:

- May confirm **owner aggregation + supply accounting** only.
- Must **not** describe Top10/Top20 as cleaned investor control.
- Holder risk / concentration verification must remain **unverified** or carry an explicit scope string.

## Live scrubbed evidence (6 CA / 30 Helius)

| Metric | Value | Audit |
| --- | --- | --- |
| Sample CAs | 6 | PASS (5–10 bound) |
| OK | 3 | PASS |
| PARTIAL | 3 | PASS |
| REJECTED | 0 | PASS |
| totalHeliusRequests | 30 | PASS |
| PARTIAL upgraded to confirmed | No | PASS |
| Credential / raw header / raw payload in Git reports | None found | PASS |
| Endpoint mode recorded | `gatekeeper_beta` (mode name only; no credential URL) | PASS |

PARTIAL examples (H1adb / Ce2 / 9Ztb): `verificationStatus=unverified`, concentration completeness 0 / ratio null, judgment status unverified.

OK example (H3Gtw): accounting residual 0 and pages complete → currently confirmed concentration. Blocked under F-POOL-SCOPE-001 because pool exclusion coverage is incomplete.

## Write-set

See `exact-write-set.txt`.

- Declared core pilot paths are present.
- Advisory extras on branch: `.gitignore`, `README.md`, `docs/handoffs/STATUS_SYSTEM_20260730.md`.
- Comparison method: `git diff --name-only main...HEAD`.

## Offline gates (auditor session)

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS (389 pass / 1 skipped / 0 fail) |
| `npm run build` | PASS |
| `npm run harness:doctor` | GREEN (dirty-tree warning expected during dual-task delivery) |
| Forbidden leak scan on pilot reports | PASS |

## Blocking findings (must repair)

1. **F-MIXED-001** — zero/closed siblings silently drop positive same-owner balances.  
2. **F-MIXED-002** — invalid mixed owners silently excluded instead of unresolved/manual review.  
3. **F-POOL-SCOPE-001** — incomplete pool exclusion still confirms concentration / holder risk.

Full machine-readable detail: `findings.json`.

## Minimal repair write-set (auditor must not apply)

```text
src/domain/rules/holder-data-cleaning.ts
test/domain/rules/holder-data-cleaning.test.ts
src/domain/mapping/map-holder-cleaning-to-ca-scan.ts
test/application/live/solana-ca-real-data-cleaning-pilot.test.ts
```

Suggested repair semantics (guidance only):

1. Same-owner mix of `included_holder` + (`zero_balance`|`closed_or_inactive`): keep owner **included** with positive included sum (zero/closed ATAs stay out of cleaned universe at account level), **or** mark owner `unresolved_exclusion_candidate` with manual review — never exclude positive residual as pure zero/closed.  
2. Same-owner mix of `included_holder` + `invalid_or_unparseable`: **unresolved** + manual review.  
3. Split CaScan mapping: accounting-complete ≠ investor-concentration-confirmed when pool/liquidity exclusion coverage is incomplete.

## Owner gate implications

Until a repair task is DONE and a follow-up audit is **GREEN**:

1. Do **not** merge the CA pilot to `main`.  
2. Do **not** open `SOL-CA-HOLDER-HOTPATH-INTEGRATION-001`.  
3. Do **not** open consecutive three batches of 5–10 manual CAs for stability validation.

## Artifacts

- `harness/tasks/SOL-CA-REAL-DATA-CLEANING-PILOT-AUDIT-001.json`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-AUDIT-001/acceptance.md`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-AUDIT-001/findings.json`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-AUDIT-001/exact-write-set.txt`
