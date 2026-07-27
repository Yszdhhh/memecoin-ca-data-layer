# SOL-HELIUS-LIVE-SMOKE-E2E-001

## Verdict

PARK

## Safe findings

1. The manually authorized read-only smoke reached Helius through the configured
   runtime proxy path. Mint and metadata reads completed within the bounded
   request budget.
2. The token-account phase rejected the returned records as malformed. The
   live provider uses the documented flat account shape (`address`, `owner`, and
   integer `amount`), while the current adapter accepts only the older nested
   fixture shape. It failed closed and made no holder or analysis claim.

No provider payload, credential, credential-bearing URL, database write,
scheduler, or secondary provider was retained or activated.

## Follow-up

A narrow account-shape compatibility repair, with fixture coverage for both
accepted documented and legacy shapes, is required before the public CA smoke
can be rerun. The public CA live smoke remains unclaimed as GREEN.