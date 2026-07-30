# Dispatch: SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-REPAIR-003

- Role: Implementer
- Baseline: `5d8e1ef`
- Tier / layer: T2 / cold_path
- Budget: zero live/network/provider/credential/private-address processing.

Make the smallest repair: Alpha eligibility must explicitly reject provider incompleteness in either 7d or 30d. For each period require `MAPPED`, completeness exactly 1, and no `period_unverified` or `partial_fields` warning. Preserve the existing finite 30d profit, borrowed-score, quality-tier, and manual-review gates.

Add builder-level tests proving duplicate 7d and duplicate 30d both fail closed; 7d incomplete-MAPPED, PARTIAL, and partial-fields rows receive no Alpha rank; and Alpha/review unions are both non-empty and address-disjoint. Do not change scoring or unrelated modules.
