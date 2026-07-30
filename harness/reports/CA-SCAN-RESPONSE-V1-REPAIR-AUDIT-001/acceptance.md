# Acceptance: CA-SCAN-RESPONSE-V1-REPAIR-AUDIT-001

## Verdict

**FAIL**

Date: 2026-07-30  
Role: independent auditor  
Sealed range: `5a76fb3dfcbb973a624594d055561beb18f3c4ea..5a9a6e9f3b9323dfa8494c2208df02af670dae69`  
Audit worktree: `G:\链上战壕-codex-ca-scan-response-v1-001`

The repair closes the previously reported shallow-structure, required nullable-key, malformed-array, timestamp, Tier-B confirmation, provider-boundary, Harness-doctor, and whitespace defects. It does **not** fully close the zero-denominator/no-fake-precision requirement, so the sealed repair cannot be accepted as GREEN.

## Severity-ordered findings

### P1 — Alternate decimal encodings of zero bypass the ratio guard and can crash the helper

Evidence:

- `RawIntegerString` accepts any decimal-digit string, including `"00"` and `"000"` (`src/domain/contracts/ca-scan-response-v1.ts:324`, `:361-366`).
- `validateRatioMetric` treats only the exact string `"0"` as a zero denominator (`:541-543`). A complete metric with `denominator: "00"` and a non-null ratio validates successfully.
- `buildRatioMetric` uses the same exact-string guard (`:885-890`). With an explicit ratio it returns fake precision for `denominator: "00"`; with numerator and denominator both alternate-zero strings it reaches BigInt division and throws `RangeError: Division by zero` (`:891-897`).
- The focused tests cover incomplete ratios and values above `1`, but do not cover alternate zero encodings.

Independent offline probes against the built module:

```text
validate denominator="00", completeness=1, ratio=0.5 -> ok=true
validate denominator="000", completeness=1, ratio=0.5 -> ok=true
build numerator="0", denominator="00", ratio=0.5 -> returns ratio=0.5
build numerator="0", denominator="00", ratio omitted -> RangeError: Division by zero
```

Required repair: determine zero numerically/canonically rather than by exact string equality, ensure every zero representation forces `ratio: null`, ensure the helper never divides by zero, and add direct validator/helper regressions for leading-zero denominator forms.

## Semantic audit checklist

| Area | Result | Evidence |
| --- | --- | --- |
| Required nullable root keys | PASS | Root keys use `requireField`; omission regressions pass. |
| Required nullable nested keys | PASS | Declared nullable fields are presence-checked and type-checked. |
| Empty section objects | PASS | Token/market/authority/cohort/dev/holder/completeness structures fail closed. |
| Malformed root array entries | PASS | Wallet, cluster, cross-token, judgment, and provenance entries are validated individually. |
| Every declared section field runtime-checked | PASS | Interface-to-validator review found coverage for required fields and type checks for optional fields. |
| ISO calendar/time validation | PASS | Root and nested timestamp validators reject malformed dates/times; leap-day and offset probes behaved fail-closed. |
| Ratio finite and in `[0,1]` | PASS | Non-null ratios are bounded and finite. |
| Incomplete evidence has no ratio | PASS | Validator and helper require completeness exactly `1` for precision. |
| Zero denominator has no ratio | **FAIL** | Alternate raw-integer zero encodings bypass exact `"0"` checks; helper can throw. |
| Tier-B cannot be confirmed | PASS | Provenance, wallet labels, clusters, cross-token matches, and judgments reject Tier-B confirmation. |
| Pure/provider-neutral boundary | PASS | Contract has no imports, I/O, provider calls, or infrastructure dependency. |
| Harness doctor | PASS | 0 errors / 0 warnings. |
| Exact repair write set | PASS | `EXACT_MATCH`: 6 changed files, all and only the repair task write set. |

## Acceptance command results

| Command | Result |
| --- | --- |
| `npm run harness:task -- validate harness/tasks/CA-SCAN-RESPONSE-V1-REPAIR-AUDIT-001.json` | GREEN; 0 errors |
| `npm run harness:doctor` | GREEN; 0 errors / 0 warnings on the clean sealed baseline |
| `npm run typecheck` | PASS |
| `npm test` | 363 total / 362 pass / 1 skipped / 0 fail |
| `npm run build` | PASS |
| `git diff --check 5a76fb3dfcbb973a624594d055561beb18f3c4ea..5a9a6e9f3b9323dfa8494c2208df02af670dae69` | PASS |
| Exact write-set comparison | `EXACT_MATCH` (6/6; no outside or missing paths) |

Passing gates do not override the semantic P1 failure. After writing the two authorized audit files, a final doctor recheck remained GREEN and emitted only the expected dirty-working-tree warning; `git diff --check` remained PASS.

## Boundary compliance

- Zero network/provider/RPC requests.
- Zero credential or private-data reads.
- No implementation, test, fixture, contract-document, package, provider, database, migration, CI, wallet-scoring, or main-branch changes.
- No push or merge.
- Audit modifications are limited to this report and the audit task status.
