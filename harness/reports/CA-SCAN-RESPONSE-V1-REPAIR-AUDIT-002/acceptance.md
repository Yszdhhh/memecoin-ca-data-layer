# Acceptance: CA-SCAN-RESPONSE-V1-REPAIR-AUDIT-002

## Verdict

**GREEN**

Date: 2026-07-30  
Role: independent offline auditor  
Failed-audit baseline: `320a259ae514a1047e22fa8c1087a7f78d0f1e18`  
Sealed repair tip: `aced6461fbe571a84dceeda6cd15fffb4c0e2028`

Repair 002 closes the sole P1 blocker from audit 001 without regressing the previously GREEN CaScanResponse v1 findings.

## Severity-ordered findings

No P0, P1, P2, or P3 findings.

## Semantic evidence

### Alternate decimal zero denominators are rejected

- `RawIntegerString` remains a decimal-digit string (`/^\d+$/`), so leading-zero forms are valid raw representations rather than being silently redefined.
- The new `isPositiveRawIntegerString` predicate first validates the decimal representation and then evaluates `BigInt(value) > 0n`.
- Therefore every finite decimal representation consisting only of zero digits (`"0"`, `"00"`, `"000"`, and longer forms) is numerically zero and fails the positivity predicate.
- `validateRatioMetric` rejects any non-null ratio unless completeness is exactly `1` and the denominator passes that numeric positivity predicate. Alternate-zero denominators therefore require `ratio: null` and cannot carry fake precision.

### `buildRatioMetric` cannot divide by alternate zero

- Both explicit-ratio and derived-ratio paths are nested behind the same numeric-positive-denominator guard.
- For any alternate-zero denominator, execution never constructs the denominator `BigInt` inside the guarded block and never reaches the division expression; the returned ratio remains `null`.
- Direct regressions cover `"00"` and `"000"` for validator rejection, explicit helper input, and automatic helper derivation. The automatic path completes without throwing and returns `null`.

### Previously GREEN findings remain intact

- The sealed implementation diff changes only the denominator positivity predicate and the two validator/helper call sites, plus focused regressions and repair Harness artifacts.
- Required nullable keys, complete nested validation, timestamp validation, finite `[0,1]` ratios, completeness gating, Tier-B confirmation guards, forbidden-leak scanning, and the provider-neutral/no-I/O boundary are otherwise unchanged.
- The complete offline test suite passes: 364 total, 363 passed, 1 skipped, 0 failed.

## Exact write-set compliance

The sealed range changes exactly these five repair-002 paths, matching the task write set with no outside or missing path:

1. `src/domain/contracts/ca-scan-response-v1.ts`
2. `test/domain/contracts/ca-scan-response-v1.test.ts`
3. `harness/tasks/CA-SCAN-RESPONSE-V1-REPAIR-002.json`
4. `harness/dispatches/CA-SCAN-RESPONSE-V1-REPAIR-002.md`
5. `harness/reports/CA-SCAN-RESPONSE-V1-REPAIR-002/acceptance.md`

Result: `EXACT_MATCH` (5/5).

## Acceptance command results

| Command | Result |
| --- | --- |
| `npm run harness:task -- validate harness/tasks/CA-SCAN-RESPONSE-V1-REPAIR-AUDIT-002.json` | GREEN; 0 errors |
| `npm run harness:doctor` | GREEN; 0 errors / 0 warnings on the clean audit baseline before the two authorized audit writes |
| `npm run typecheck` | PASS |
| `npm test` | 364 total / 363 pass / 1 skipped / 0 fail |
| `npm run build` | PASS |
| `git diff --check 320a259ae514a1047e22fa8c1087a7f78d0f1e18..aced6461fbe571a84dceeda6cd15fffb4c0e2028` | PASS |

## Boundary compliance

- Zero network/provider/RPC/GMGN/Helius requests.
- Zero credential, private-key, proxy-secret, live-payload, or private-wallet-data reads.
- No implementation, test, fixture, documentation, package, provider, database, CI, wallet-scoring, or wallet-master-table changes.
- No dispatch modification, dependency change, push, merge, or main-branch modification.
- Audit writes are limited to this report and changing the audit task status to `DONE`.
