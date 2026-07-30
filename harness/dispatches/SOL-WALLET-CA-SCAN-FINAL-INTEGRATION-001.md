# Dispatch: SOL-WALLET-CA-SCAN-FINAL-INTEGRATION-001

- Role: Coordinator / integration verifier
- HARNESS_AGENT_ID: `coordinator-wallet-ca-scan-final-integration-001`
- Main baseline: `e3c7f6ac00ee66ae24dd8cb4bfeeaa58c4cceff0`
- Audited wallet tip: `b5cdeed8b2726be9d7adff2f53835240a2658243`
- Audited CaScan tip: `6a5305d`
- Integration branch: `codex/wallet-ca-scan-final-integration`
- Tier / layer: T2 / judgment_layer
- Budget: strictly zero network, provider, credential, and private-data access.

Merge the two exact audited tips into this local branch using explicit no-fast-forward merges. Do not edit imported implementation, tests, fixtures, or documentation. Resolve no semantic conflict by invention: if a merge conflict appears outside the integration Harness artifacts, stop and report FAIL/PARK. Preserve the main baseline as an ancestor, verify both audited tips are ancestors, validate both GREEN audit reports, then run clean Harness doctor, typecheck, the full offline test suite, build, diff checks, and persist exact commit/test evidence.

Do not push, merge into main, run live requests, read secrets/private data, or expand scope.
