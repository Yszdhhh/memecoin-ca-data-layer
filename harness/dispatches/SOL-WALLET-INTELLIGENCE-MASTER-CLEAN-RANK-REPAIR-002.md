# Dispatch: SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-REPAIR-002

- Role: Implementer
- HARNESS_AGENT_ID: `implementer-sol-wallet-intelligence-master-clean-rank-repair-002`
- Baseline SHA: `1f9856140dbfc1cf30334343b196678ead56b6cd`
- Tier / layer: T2 / cold_path
- Budget: strictly zero network, provider, GMGN CLI, Helius/RPC, credential, and private-address processing.

Close every remaining finding in the independent FAIL report. Validate finite completeness values in `[0,1]`; ensure any present row with missing or incomplete completeness, `partial_fields`, or a `MAPPED`/completeness inconsistency is capped below DQ-A and cannot enter Alpha candidate ranking. Preserve explicit null versus zero and strict 30d semantics.

Add focused synthetic regression tests for explicit-zero and negative aggregation, all four mutually exclusive profit buckets, duplicate period records, address deduplication/source order, label merge/deduplication, output field allowlist, incomplete-MAPPED and partial-fields caps, PARTIAL provisional-score semantics, and direct Alpha/review union disjointness. Correct the accounting-residual dictionary text and make the implementer report accurately describe PARTIAL as provisional-score-capable but Alpha-ineligible unless code is intentionally made stricter.

Stay inside the exact write set. Do not access private inputs, perform live calls, rerun production batches, change architecture, or work on CaScanResponse.
