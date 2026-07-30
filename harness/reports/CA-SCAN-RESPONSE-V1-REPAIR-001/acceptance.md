# Acceptance: CA-SCAN-RESPONSE-V1-REPAIR-001

## Verdict

**READY_FOR_INDEPENDENT_AUDIT (implementer gates GREEN)**

Date: 2026-07-30
Baseline: `5a76fb3dfcbb973a624594d055561beb18f3c4ea`
Implementation commit: `20fadf371748e37b189d3092d64a8c76656b1f67`

This bounded repair closes the known independent-review blockers in the provider-neutral CaScanResponse v1 contract. It remained pure and offline: zero network/provider calls, credential reads, private-data reads, provider additions, dependencies, database work, or wallet-scoring changes.

## Implemented

- Required root keys are enforced even when the declared value is nullable.
- Runtime validators now cover every declared field in token, market, authority, holders, cohorts, wallet signals, clusters, dev behavior, cross-token matches, judgment evidence, provenance, completeness, and root arrays.
- Nested empty objects and malformed array entries fail closed instead of surviving a shallow cast.
- Required nullable fields must be present and must have their declared nullable type.
- `generatedAt`, provenance timestamps, and section timestamps must be valid ISO-8601 values with valid calendar/time components.
- Ratio values must be null or finite in `[0,1]`.
- A non-null ratio is rejected when completeness is below `1` or the denominator is zero.
- `buildRatioMetric` derives a value only for complete evidence with a positive denominator; invalid or impossible derived precision fails closed to null.
- The secret-pattern regression still exercises the runtime scanner without storing a secret-like literal that trips Harness doctor.
- Known trailing whitespace in the contract documentation was removed and runtime guarantees were documented.

## Regression coverage

Focused contract tests now cover:

- required nullable root keys;
- required nullable section fields;
- empty section objects;
- malformed nested array entries across every root collection;
- invalid root, provenance, and wallet timestamps;
- ratio above 1;
- non-null ratio from incomplete evidence;
- automatic ratio derivation refusing incomplete evidence;
- all original fixture, holder-universe, Tier-A/Tier-B, leak, and JSON integer invariants.

## Acceptance commands

| Command | Result |
| --- | --- |
| Repair task validation | GREEN; 0 errors |
| `npm run harness:doctor` | GREEN; 0 errors / 0 warnings on clean implementation commit |
| `npm run typecheck` | PASS |
| Focused contract tests | 20 / 20 pass |
| `npm test` | 363 total / 362 pass / 1 skipped / 0 fail |
| `npm run build` | PASS |
| `git diff --check 5a76fb3dfcbb973a624594d055561beb18f3c4ea..HEAD` | PASS |

## Retained boundaries

- Contract remains provider-neutral and has no I/O or provider imports.
- Tier-B evidence remains unverified and cannot become a confirmed conclusion.
- No fixture, package manifest, provider, API, worker, database, migration, CI, wallet-scoring, or wallet-master-table file changed.
- No push, merge, or main-branch modification occurred.
- Final T2 acceptance requires a fresh independent audit.
