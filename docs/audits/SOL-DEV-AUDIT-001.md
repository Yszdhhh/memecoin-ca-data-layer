# SOL-DEV-AUDIT-001 - Independent Solana creator and Dev history audit

## Verdict

**FAIL**

`SOL-DEV-001` correctly keeps normalized direct trades, related trades, and
outbound transfers as separate calculations for the supplied fixture. However,
the T2 integration does not yet preserve creator provenance when Dev history is
incomplete, does not bind purported Pump creator evidence to the pinned Pump
decoder or the supplied creation slot, and can include non-related balances in
the related holding metric.

## Scope and method

Audited task: `SOL-DEV-AUDIT-001` (T2, auditor, Solana).

Read-only inputs reviewed:

- `PROJECT_CONSTITUTION.md`
- `harness/tasks/SOL-DEV-001.json`
- `src/infrastructure/solana/dev/solana-dev-history-service.ts`
- `src/domain/rules/dev-behavior.ts`
- `test/solana/dev/solana-dev-history-service.test.ts`
- `test/fixtures/solana/dev/complete-history.json`
- `test/fixtures/solana/dev/partial-history.json`

No source, test, fixture, task, ledger, credential, network, or provider state
was modified. This report is the sole audit write.

## Findings

### P1 - Creator provenance is discarded when history coverage is incomplete

The Constitution requires creator identity to retain provenance. The service
adds the incomplete-history warning, but its early return replaces a supplied
and otherwise trusted `creatorEvidence` with `null` whenever
`completeFromCreation` is false
([`solana-dev-history-service.ts`](../../src/infrastructure/solana/dev/solana-dev-history-service.ts:70)).
This incorrectly couples the validity of creator evidence to the separate
requirement for complete Dev-history aggregation. A partial history must make
`dev` unavailable, but it must not erase the creator evidence required for
later review.

The partial-history test verifies only that `dev` is `null`; it does not assert
that valid creator evidence remains available
([`solana-dev-history-service.test.ts`](../../test/solana/dev/solana-dev-history-service.test.ts:159)).

Required remediation: return validated creator provenance independently of the
coverage verdict, while continuing to return `dev: null` and the incomplete
coverage warning.

### P1 - Claimed Pump creator evidence is not bound to a Pump decode or creation event

`hasTrustedCreatorEvidence` only checks that the source string is
`pump_create.creator` and that provenance fields are non-empty
([`solana-dev-history-service.ts`](../../src/infrastructure/solana/dev/solana-dev-history-service.ts:94)).
It does not verify the official Pump program ID, the pinned IDL commit/hash, or
that `creatorEvidence.slot` matches `creationSlot`. Consequently, a runtime
caller can provide an arbitrary non-empty `programId`, source pin, and creator
address under the literal source label and receive a populated `DevBehavior`.

The happy-path fixture happens to use the expected Pump ID and source pin
([`complete-history.json`](../../test/fixtures/solana/dev/complete-history.json:8)),
but the tests only reject a different source literal
([`solana-dev-history-service.test.ts`](../../test/solana/dev/solana-dev-history-service.test.ts:143)).

Required remediation: derive creator evidence from the pinned decoder result or
validate its program ID, IDL pin, and creation-event linkage before it can be
used as the Dev creator.

### P2 - Unrelated balances can inflate `relatedHoldingPct`

The service forwards all `relatedCurrentBalances` entries without restricting
them to `relatedAddresses`
([`solana-dev-history-service.ts`](../../src/infrastructure/solana/dev/solana-dev-history-service.ts:74)).
The domain rule then sums every map value for `relatedHoldingPct`
([`dev-behavior.ts`](../../src/domain/rules/dev-behavior.ts:42)), while related
trade and transfer logic is correctly constrained by the `relatedAddresses`
set ([`dev-behavior.ts`](../../src/domain/rules/dev-behavior.ts:20)). This makes
the holding metric semantically inconsistent with the declared related-wallet
set and can misstate related ownership.

Required remediation: filter `relatedCurrentBalances` to the approved related
address set before calculating Dev behavior, and add a fixture case with an
unlisted balance that must not affect `relatedHoldingPct`.

## Confirmed behavior

- The complete fixture uses a finalized watermark whose oldest observed slot
  reaches the creation slot; the coverage checks reject later starts, gaps, and
  `finalizedSlot < newestObservedSlot`
  ([`solana-dev-history-service.ts`](../../src/infrastructure/solana/dev/solana-dev-history-service.ts:107)).
- Normalized trades are filtered to the Solana token before computation
  ([`solana-dev-history-service.ts`](../../src/infrastructure/solana/dev/solana-dev-history-service.ts:79)).
- The domain rule counts direct creator sells separately from related sells and
  does not treat token transfers as sells; transfers to known related wallets
  are not included in outbound-transfer totals
  ([`dev-behavior.ts`](../../src/domain/rules/dev-behavior.ts:26)).

## Acceptance reproduction

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 25 tests passed / 0 failed |
| `npm run build` | PASS |

## Required follow-up

Remediate all three findings and repeat an independent T2 audit before using
`SOL-DEV-001` as a stable creator/Dev history contract. This audit does not
constitute Solana end-to-end acceptance.
