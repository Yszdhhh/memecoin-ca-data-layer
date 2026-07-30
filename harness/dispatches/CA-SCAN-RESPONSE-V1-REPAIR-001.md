# Dispatch: CA-SCAN-RESPONSE-V1-REPAIR-001

- Role: Implementer
- HARNESS_AGENT_ID: `implementer-ca-scan-response-v1-repair-001`
- Baseline: `5a76fb3dfcbb973a624594d055561beb18f3c4ea`
- Tier / layer: T2 / judgment_layer
- Budget: zero network/provider/credential/private-data access.

Apply only the smallest repair for the known blockers:

1. Reject missing required root keys even when their declared value is nullable.
2. Replace shallow optional-section checks with complete runtime validation of every declared field in TokenIdentity, MarketSnapshotSection, AuthorityFacts, CohortMetrics, WalletTokenSignal, ClusterSummary, DevBehaviorSection, CrossTokenMatch, RatioMetric, SourceProvenance, CompletenessReport, and root arrays.
3. Validate timestamps as real ISO-8601 strings, not merely arbitrary strings.
4. Require RatioMetric.ratio to be null or finite in [0,1], and require null when completeness is below 1 or denominator is zero. `buildRatioMetric` may derive precision only when completeness equals 1 and denominator is positive.
5. Add direct malformed-object regression tests, including missing nullable keys, empty objects, invalid timestamps, ratio above 1, incomplete explicit/derived ratios, and malformed nested array entries.
6. Rewrite the secret-leak regression input so Harness doctor sees no secret-like literal in repository text while the runtime pattern is still exercised.
7. Remove the known trailing whitespace in the contract documentation.

Do not expand schema scope, add providers/dependencies, or touch fixtures unless strictly necessary. Run all declared gates, write the acceptance report, and stop for independent audit. No push or main changes.
