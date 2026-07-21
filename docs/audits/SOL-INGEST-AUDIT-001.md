# SOL-INGEST-AUDIT-001 independent audit

**Verdict: GREEN_WITH_ADVISORY**

## Scope and evidence

Reviewed the `SOL-INGEST-001` implementation commit `ca2078358ed16ae804d2c63b5eaa9e71d9cda5d6` against the project Constitution, the implementation task specification, its fixture, tests, and run manifest `20260719140600_SOL-INGEST-001`.

The implementation change contains exactly the three paths permitted by its write set:

- `src/infrastructure/solana/helius/helius-solana-adapter.ts`
- `test/solana/helius/helius-solana-adapter.test.ts`
- `test/fixtures/solana/helius/adapter-fixture.json`

No domain rule or future-chain file was changed. The offline fixture contains no provider credentials.

## Constitution and boundary checks

| Check | Evidence | Result |
| --- | --- | --- |
| Aggregate Solana token accounts by owner before ranking | The adapter accumulates every token account in an owner-keyed `Map` using `bigint`, then sorts the owner balances (`helius-solana-adapter.ts:171-180`). The fixture has two accounts for Alice and one for Bob; the test verifies balances of 125 and 75 (`adapter-fixture.json:10-14`, `helius-solana-adapter.test.ts:71-74`). | PASS |
| Keep transfers distinct from sales | Trades require a transaction `swap`; token transfers are emitted only when `kind === "transfer"` (`helius-solana-adapter.ts:195-219`, `282-309`). The fixture marks the buy/sell transfer legs as `swap` and the creator movement as `transfer`; the test returns two trades and only the ordinary transfer (`adapter-fixture.json:15-52`, `helius-solana-adapter.test.ts:77-95`). An ambiguous same-mint input/output is deliberately rejected (`adapter-fixture.json` test override and `adapter-fixture.json:115-132`). | PASS |
| Preserve raw integer chain quantities | Supply, account balances, native transfers, token transfers, quote amounts, and slots flow from decimal strings through `rawInteger` to `bigint`; no conversion through JavaScript `number` is used for those quantities (`helius-solana-adapter.ts:161`, `175-176`, `217`, `239`, `290-300`, `316-319`). `decimals` remains display metadata. | PASS |
| Retain source watermarks | Every source response carries source, observation time, finality slot/cursor, and completeness (`helius-solana-adapter.ts:19-30`). Each adapter call records a copied watermark, and the public accessor returns fresh copies (`139-142`, `275-278`). The fixture test confirms retention across RPC and Helius calls (`helius-solana-adapter.test.ts:101-112`). | PASS |
| Fixture is meaningful and offline | It covers owner aggregation, metadata, a buy, a sell, an ordinary transfer, funding, tags, wallet facts, and a source cursor without a live key (`adapter-fixture.json:1-62`). | PASS |
| Creator provenance is not fabricated | The adapter deliberately leaves `creatorAddress` absent pending the Pump create-instruction decoder (`helius-solana-adapter.ts:164`). | PASS |

## Advisory (non-blocking)

The fixture quantities are all below JavaScript's maximum safe integer. The implementation itself correctly uses `bigint`, but a future test should include a raw quantity larger than `9,007,199,254,740,991` and assert it survives aggregation and trade normalization exactly. This does not block this adapter task because the required boundary is present and its current behavior is covered, but it will guard against future regressions that reintroduce number coercion.

The implementation run manifest correctly records the code task as an offline run and therefore has `source_watermarks.status = NOT_RECORDED` (`harness/runs/20260719140600_SOL-INGEST-001/manifest.json:50-52`). This is not a claim that live data was captured. Any later analysis or E2E manifest must export the adapter's recorded watermarks rather than carrying this offline status forward.

## Verification performed

- `git diff --name-only 7ed8a12..ca20783` — only the permitted implementation, test, and fixture paths.
- `git diff --check 7ed8a12..ca20783` — passed with no whitespace errors.
- `npm run typecheck` — passed.
- `npm test` — passed (11 tests, 0 failures).
- `test -s docs/audits/SOL-INGEST-AUDIT-001.md` — passed.
- `git diff --check` — passed.

The verdict is based on the source, fixture, task boundary, and reproduced checks above; the passing test suite was not used as a substitute for the Constitution review.
