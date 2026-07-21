# SOL-PUMP-REPAIR-AUDIT-001 - Independent Pump.fun decoder remediation audit

## Verdict

**FAIL**

The exact account-layout repair is complete, and the retrieval watermark is now present in TypeScript types and asserted against every pinned fixture. However, the decoder still accepts a missing or malformed retrieval watermark at runtime. This violates the task's explicit prohibition on accepting an absent or untyped watermark, so the T2 decoder contract is not yet GREEN.

## Scope and method

Audited task: `SOL-PUMP-REPAIR-AUDIT-001` (T2, auditor, Solana).

Only the declared task inputs were reviewed. No mutable network data, provider credentials, unpinned transaction, source, test, fixture, task, ledger, or original audit report was modified by this audit.

The four fixture SHA-256 values recomputed during this audit match the pinned manifest values:

| Fixture | SHA-256 | Result |
| --- | --- | --- |
| `create-v2.json` | `fb300d0db2bdb5c7f5dfbf8cddc1323d71457eaab075e907954bf9fd5b8cb89a` | match |
| `buy.json` | `c3e3cbe3112f4c7e9b9ad607040d0c361bf3268366b5561a2e531315b1e0aa95` | match |
| `sell.json` | `097134849841c5f1acae2cdb4d9856413c2321957c7e851f3379b7ce83114dbd` | match |
| `migrate.json` | `222df022fd8ae0532696c9860391e68a359682c3ef0a9630075b6b4b381c1632` | match |

## Prior finding status

### F-1: Retrieval watermark - partially remediated, still blocking

The repair adds a typed `PumpRetrievalWatermark` with endpoint, finalized commitment and retrieval time to decoder input and raw decoded provenance ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:19), [`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:35)). The raw builder propagates it ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:150)), and tests assert all three fields for `create-v2`, `buy`, `sell`, and `migrate` ([`pump-instruction-decoder.test.ts`](../../test/solana/pump/pump-instruction-decoder.test.ts:92)).

This satisfies the compile-time and pinned-fixture portions of the requirement, but does not enforce the runtime acceptance boundary. `decode()` performs only program, discriminator and layout checks ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:102)); it never checks `input.retrieval`. The raw builder directly assigns `retrieval: input.retrieval` ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:162)). TypeScript interfaces are erased at runtime, so a JavaScript caller or unvalidated provider payload can supply `undefined`, a non-finalized commitment, or an invalid date and still pass the remaining decode path. The result then claims `status: "decoded"` with absent or untyped provenance.

The audit task expressly prohibits this state, and the provenance rule requires an RPC retrieval watermark with every decoded result ([`SOL-PUMP-PROVENANCE-001.md`](../research/SOL-PUMP-PROVENANCE-001.md):65).

Required remediation: validate at decoder entry that retrieval is an object with a non-empty endpoint, `commitment === "finalized"`, and a valid `Date`; return `unsupported_version` with a safe raw provenance representation when invalid. Add negative tests for absent, non-finalized and invalid-date watermarks.

### F-2: Exact account-layout validation - remediated

Each supported form now has an exact pinned account count (`16`, `18`, `17`, and `25`) and canonical program index ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:10)). The decoder requires equality rather than a minimum count ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:118)). This matches the provenance report's 25-account `migrate` evidence ([`SOL-PUMP-PROVENANCE-001.md`](../research/SOL-PUMP-PROVENANCE-001.md):108).

Tests reject every shorter count and an extended form for all four fixtures, plus a displaced Pump program account ([`pump-instruction-decoder.test.ts`](../../test/solana/pump/pump-instruction-decoder.test.ts:103), [`pump-instruction-decoder.test.ts`](../../test/solana/pump/pump-instruction-decoder.test.ts:118)). This closes the original minimum-only layout finding.

## Preserved T2 contracts

- `create_v2.creator` continues to derive from Borsh instruction data rather than the user account, preserving Constitution creator precedence ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:198)).
- Buy and sell quantities remain `bigint` raw quantities ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:66)).
- Only the four fixture-backed discriminators are accepted; unknown program IDs and discriminators return `unsupported_version` ([`pump-instruction-decoder.ts`](../../src/infrastructure/solana/pump/pump-instruction-decoder.ts:103)).
- Fixture tests read local artifacts only; no mutable network call appears in the declared implementation or test inputs.

## Acceptance reproduction

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 17 tests passed / 0 failed |
| `npm run build` | PASS |

## Unresolved items

- Add and validate runtime failure handling for absent, malformed and non-finalized retrieval watermarks, then re-audit this T2 repair.
- This decoder audit is not Solana E2E acceptance. The Constitution's separate fixture-plus-authorized-live-CA, holder, Dev and large-order evidence gates remain outstanding.
