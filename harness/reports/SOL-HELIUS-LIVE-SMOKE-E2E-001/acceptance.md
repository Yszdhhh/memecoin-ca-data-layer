# SOL-HELIUS-LIVE-SMOKE-E2E-001

## Verdict

PARK

## Safe finding

The manually authorized read-only smoke reached Helius through the configured
runtime proxy path. The existing mint request was rejected at the provider's
JSON-RPC boundary, and the source failed closed. No provider payload,
credential, credential-bearing URL, database write, scheduler, or secondary
provider was retained or activated.

## Follow-up

A narrowly scoped source-contract repair is required before this smoke can be
re-run. The public CA and live smoke remain unclaimed as GREEN.
