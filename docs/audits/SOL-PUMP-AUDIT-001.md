# SOL-PUMP-AUDIT-001 - Independent Pump.fun decoder audit

## Verdict

**FAIL**

`SOL-PUMP-001` may not yet be consumed as a stable T2 decoder contract by the
Holder or Dev work. The implementation correctly decodes the four pinned
fixtures and all declared acceptance commands pass, but it does not preserve
the required RPC retrieval watermark and it accepts incomplete account layouts
for registered instruction forms.

## Scope and evidence

Audited task: `SOL-PUMP-AUDIT-001` (T2, auditor, Solana).

Only the task-spec inputs were reviewed. No mutable network data, provider
credentials, unpinned transactions, source, test, fixture, task, or ledger
files were modified by this audit.

The provenance report pins Pump program ID
`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`, source commit
`9c82f61cb711b044a17f770ab8ce9f9bdf78f333`, and IDL SHA-256
`b90bc471327f671449271d5d1d42354d1fae6f5a06502f5834459a3108138e49`.
The four local fixture SHA-256 values recomputed during this audit match
[`manifest.json`](../../test/fixtures/solana/pump/manifest.json):

| Fixture | Recomputed SHA-256 | Result |
| --- | --- | --- |
| `create-v2.json` | `fb300d0db2bdb5c7f5dfbf8cddc1323d71457eaab075e907954bf9fd5b8cb89a` | match |
| `buy.json` | `c3e3cbe3112f4c7e9b9ad607040d0c361bf3268366b5561a2e531315b1e0aa95` | match |
| `sell.json` | `097134849841c5f1acae2cdb4d9856413c2321957c7e851f3379b7ce83114dbd` | match |
| `migrate.json` | `222df022fd8ae0532696c9860391e68a359682c3ef0a9630075b6b4b381c1632` | match |

## Findings

### F-1: Decoded provenance omits the required RPC retrieval watermark (blocking)

The pinned provenance contract requires every decoded result to retain its
matching discriminator, instruction name, signature, slot, **and RPC retrieval
watermark** ([`SOL-PUMP-PROVENANCE-001.md`](../research/SOL-PUMP-PROVENANCE-001.md):65).
The fixed fixtures record `rpc_endpoint`, `commitment`, and `retrieved_at_utc`.
However, [`PumpInstructionInput`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:19)
has no retrieval-watermark input, and
[`PumpRawProvenance`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:28)
has no corresponding output fields. The raw builder only copies program,
instruction, signature, slot, block time, accounts, data, source commit and IDL
hash ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:145)).

This violates the T2 provenance requirement and prevents a downstream consumer
from showing which finalized RPC retrieval established a decoded fact.

Required remediation: add a typed retrieval watermark to decoder input and
`PumpRawProvenance`, propagate the fixture's endpoint, commitment and retrieval
time, and assert those fields for all decoded fixture results.

### F-2: Account-layout validation permits incomplete registered forms (blocking)

The provenance rule permits only an explicitly listed pinned form and requires
an unknown account layout to return `unsupported_version`
([`SOL-PUMP-PROVENANCE-001.md`](../research/SOL-PUMP-PROVENANCE-001.md):62).
The decoder instead validates only a minimum account count and the account at
the program index ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:10),
[`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:111)).

For example, the pinned `migrate` evidence specifies a 25-account layout
([`SOL-PUMP-PROVENANCE-001.md`](../research/SOL-PUMP-PROVENANCE-001.md):108),
but the implementation declares `minimumAccounts: 24`; it will accept the first
24 accounts when the program account remains at index 23. The existing negative
test removes enough accounts to fall below the minimum
([`pump-instruction-decoder.test.ts`](../../test/solana/pump/pump-instruction-decoder.test.ts:112)),
so it does not cover this accepted truncated-form case.

Required remediation: define an exact account-count/layout expectation for each
supported fixture form and reject truncation, unexpected account count, or a
program account at a non-canonical position. Add boundary tests that retain the
current minimum count while removing each trailing account where applicable.

## Confirmed behavior

- `create_v2` takes `creator` from Borsh instruction data, independently of the
  mutable user account ([`pump-instruction-decoder.test.ts`](../../test/solana/pump/pump-instruction-decoder.test.ts:31)). This is consistent with the Constitution's creator-precedence rule.
- Buy and sell decoded amounts are represented as `bigint` raw quantities
  ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:50)), consistent with the raw-integer requirement.
- Unknown program IDs, discriminators and clearly short layouts return
  `unsupported_version` while preserving available raw fields
  ([`pump-instruction-decoder.test.ts`](../../test/solana/pump/pump-instruction-decoder.test.ts:101)).
- The decoder and tests operate on local JSON fixtures; no mutable RPC query is
  present in the declared inputs.

## Acceptance reproduction

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 14 tests passed / 0 failed |
| `npm run build` | PASS |

These checks establish type and fixture-test health only; they do not resolve
F-1 or F-2 because the current tests omit the required watermark and
minimum-versus-exact account-layout cases.

## Unresolved items

- Re-audit after F-1 and F-2 are fixed and covered by local fixture tests.
- This is not Solana E2E acceptance. The Constitution still requires a pinned
  fixture plus an explicitly authorized live CA, source watermarks, holder and
  Dev evidence, and quality-labelled large orders before that later milestone
  can be GREEN.
