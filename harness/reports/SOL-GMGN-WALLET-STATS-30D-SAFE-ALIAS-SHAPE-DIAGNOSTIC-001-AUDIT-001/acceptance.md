# Independent Audit: SOL-GMGN-WALLET-STATS-30D-SAFE-ALIAS-SHAPE-DIAGNOSTIC-001-AUDIT-001

## Identity and scope

- HARNESS_AGENT_ID: `auditor-sol-gmgn-wallet-stats-30d-safe-alias-shape-diagnostic-001`
- Audited diagnostic delivery SHA: `59dc152`
- Network requests: **0**
- Provider requests: **0**
- GMGN CLI invocations: **0**
- Credential reads: **0**
- Real address processing: **0**

## Findings

1. The diagnostic task and evidence constrain execution to one 30d CLI invocation and report exactly **1 / 1** used.
2. The external summary contains only the allowlisted task metadata, request budget, irreversible target fingerprint, source/verification status, timestamp, alias names, JSON types, numeric lexical classes, and group relations.
3. The summary contains no metric values, wallet identities, wallet-keyed object keys, labels, credentials, proxy URLs, raw payload, raw stdout/stderr, token identifiers, or full errors.
4. The observed 30d conflict is narrowly localized: `bought_cost` and `total_cost` coexist as canonical finite numeric strings but normalize to different values. Other observed canonical groups are either single-location or absent.
5. The pinned `gmgn-cli@1.5.4` portfolio skill documents `total_cost` as period spend and its wallet-score skill separately prefers `bought_cost` with `total_cost` as fallback. This supports treating the fields as distinct provider semantics rather than unconditional aliases.
6. The diagnostic does not establish the numeric value of `last_timestamp`; it only confirms a finite JSON number. A subsequent repair may permit non-negative timestamps only with synthetic zero coverage and must preserve null for missing values.
7. Historical 100-wallet and 1,433-wallet outputs remain invalid for profitability use and were not modified.

## Verdict

**GREEN.** Evidence is sufficient to unlock a narrow offline parser repair for distinct bought-cost/period-total-cost semantics and non-negative timestamp handling. This verdict does not establish 7d/30d live usability and does not authorize a batch run.

## Required next gate

After the narrow parser repair and its independent zero-network audit, run a fresh bounded one-wallet 7d+30d live re-smoke. Only a usable re-smoke plus independent audit may unlock the full 1,433-wallet batch.
