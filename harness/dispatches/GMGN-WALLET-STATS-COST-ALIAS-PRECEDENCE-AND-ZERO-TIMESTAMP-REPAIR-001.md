# Dispatch: GMGN-WALLET-STATS-COST-ALIAS-PRECEDENCE-AND-ZERO-TIMESTAMP-REPAIR-001

- Role: Implementer
- HARNESS_AGENT_ID: `implementer-gmgn-wallet-stats-cost-alias-precedence-zero-timestamp-repair-001`
- Baseline SHA: `c672bbc8addb53e4110926698068a74abf42a944`
- Zero network/provider/credential/address budget.

Implement only the audited narrow parser correction. The pinned GMGN skill uses `bought_cost` preferentially with `total_cost` as fallback, while the live safe diagnostic proves both can coexist with different values. Do not merge or compare the fallback when a primary bought-cost alias is present. Preserve conflicts inside each chosen alias family. Treat explicit timestamp zero as unavailable and leave the normalized field null/undefined without claiming activity. Add focused synthetic tests and retain all other fail-closed contracts.
