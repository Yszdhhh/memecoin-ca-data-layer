# SOL-PUMP-RETRIEVAL-AUDIT-001 - Independent final Pump retrieval audit

## Verdict

**GREEN**

`SOL-PUMP-RETRIEVAL-REPAIR-001` closes all blocking findings from
`SOL-PUMP-AUDIT-001` and `SOL-PUMP-REPAIR-AUDIT-001`. A decoded instruction
now requires verified, finalized retrieval provenance and the four registered
forms retain exact pinned account-layout validation.

## Scope and evidence

Audited task: `SOL-PUMP-RETRIEVAL-AUDIT-001` (T2, auditor, Solana).

Only the declared task inputs were reviewed. No mutable network data, provider
credentials, unpinned transaction, source, test, fixture, task, ledger, or
prior audit report was modified by this audit.

All fixed fixture hashes match [`manifest.json`](../../test/fixtures/solana/pump/manifest.json):

| Fixture | SHA-256 | Result |
| --- | --- | --- |
| `create-v2.json` | `fb300d0db2bdb5c7f5dfbf8cddc1323d71457eaab075e907954bf9fd5b8cb89a` | match |
| `buy.json` | `c3e3cbe3112f4c7e9b9ad607040d0c361bf3268366b5561a2e531315b1e0aa95` | match |
| `sell.json` | `097134849841c5f1acae2cdb4d9856413c2321957c7e851f3379b7ce83114dbd` | match |
| `migrate.json` | `222df022fd8ae0532696c9860391e68a359682c3ef0a9630075b6b4b381c1632` | match |

## Historical finding closure

### F-1: Retrieval provenance and runtime failure closure

`PumpRetrievalWatermark` remains typed in both the input and decoded-provenance
contracts ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:19),
[`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:35)).
The decoder now normalizes and validates retrieval before any decode path;
invalid retrieval returns `unsupported_version`
([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:105)).

The runtime validator rejects absent/non-object retrieval, blank endpoints,
non-`finalized` commitment, and invalid dates
([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:282)).
For an invalid watermark, `raw()` independently normalizes again and stores
`retrieval: null`, preventing an unsupported result from claiming verified
retrieval provenance ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:159)).

The local test suite asserts each valid retrieval field against all four pinned
fixtures and verifies missing, non-finalized, invalid-date and blank-endpoint
inputs return `unsupported_version` with `raw.retrieval === null`
([`pump-instruction-decoder.test.ts`](../../test/solana/pump/pump-instruction-decoder.test.ts:92),
[`pump-instruction-decoder.test.ts`](../../test/solana/pump/pump-instruction-decoder.test.ts:103)).
This satisfies the provenance rule requiring an RPC retrieval watermark for
every decoded result ([`SOL-PUMP-PROVENANCE-001.md`](../research/SOL-PUMP-PROVENANCE-001.md):65).

### F-2: Exact account-layout validation closure

Each accepted instruction form declares its fixed fixture account count and
canonical program position ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:10)).
The decoder requires exact count equality rather than minimum length
([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:127)).
This includes the pinned 25-account `migrate` form required by provenance
([`SOL-PUMP-PROVENANCE-001.md`](../research/SOL-PUMP-PROVENANCE-001.md):108).

Tests reject every truncated layout, extended layout and a displaced Pump
program account ([`pump-instruction-decoder.test.ts`](../../test/solana/pump/pump-instruction-decoder.test.ts:124),
[`pump-instruction-decoder.test.ts`](../../test/solana/pump/pump-instruction-decoder.test.ts:139)).

## Preserved contracts

- `create_v2.creator` remains derived from Borsh instruction data, never from
  the mutable user account ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:222)).
- Buy/sell values remain raw `bigint` quantities
  ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:70)).
- Unknown program IDs, discriminators and layouts fail as `unsupported_version`;
  the decoder accepts only the pinned fixture-backed forms.
- Tests and fixtures remain offline and local; no mutable provider query appears
  in the declared implementation or test inputs.

## Acceptance reproduction

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 18 tests passed / 0 failed |
| `npm run build` | PASS |

## Unresolved items

No unresolved item blocks this decoder T2 contract. This `GREEN` is not
Solana end-to-end acceptance: the Constitution's independent authorized-live-CA,
holder, Dev, large-order and provider-integration gates remain outside this
task's scope.
