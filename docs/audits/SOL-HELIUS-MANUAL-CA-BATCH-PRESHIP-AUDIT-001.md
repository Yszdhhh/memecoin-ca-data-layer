# SOL-HELIUS-MANUAL-CA-BATCH-PRESHIP-AUDIT-001

## Verdict

GREEN

## Scope reviewed

The audit covered the manual Solana CA batch, its bounded CA-first reader,
command-line wiring, focused tests, default test command, and the committed
repair task. The review was offline and made no provider request.

## Evidence and findings

- The batch accepts only 1 to 10 non-empty, distinct, syntactically valid
  Solana CAs supplied on the command line.
- Count, duplicate, and CA-format checks complete before the source factory is
  called. The focused test confirms rejected batches construct zero sources.
- The command-line path constructs only `LiveHeliusDataSource`, with a
  three-request budget, minimum request interval, and timeout for each CA.
  There is no provider fallback.
- Results retain only the bounded CA-first fields: mint availability and
  decimals, metadata availability, token-account count, completeness, source
  slots, and fixed warning codes. Raw provider rows and arbitrary error text
  are not returned.
- Static review found no token discovery, scheduler, cron, background loop,
  AnalysisService, persistence, database, cache, queue, or address-library
  path in the batch.
- The default test command now quotes its recursive pattern and executes the
  complete test suite rather than only shallow test files.
- The committed repair task, source, CLI and focused tests form the public
  review surface. Local Harness run directories are intentionally Git-ignored
  and are not claimed as public evidence.
- This audit runs under the distinct agent identity
  `codex-preship-auditor`.

## Boundary statement

This is a manual, read-only batch of bounded first looks. It does not select
daily tokens, run automatically, persist results, build an address library, or
provide Pump, creator, Dev, holder-concentration, or full-depth analysis.
