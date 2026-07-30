# Dispatch: SOL-WALLET-CA-SCAN-FINAL-INTEGRATION-REPAIR-002

- Role: Coordinator / integration verifier
- HARNESS_AGENT_ID: `coordinator-wallet-ca-scan-final-integration-repair-002`
- Main baseline: `e3c7f6ac00ee66ae24dd8cb4bfeeaa58c4cceff0`
- Audited wallet tip: `b5cdeed8b2726be9d7adff2f53835240a2658243`
- Audited CaScan tip: `6a5305d`
- Authorized conflict blob: `bd44904f858f38f2a6ab19b6d4798897ae0bde16`
- Tier / layer: T2 / judgment_layer
- Budget: strictly zero network, provider, credential, and private-data access.

Retry explicit no-fast-forward merges. The only authorized conflict is `docs/designs/ALPHA-TERMINAL-DESIGN-001.md`; resolve it by materializing the exact blob `bd44904f858f38f2a6ab19b6d4798897ae0bde16`, which is identical in both audited feature tips. Do not combine text manually. If any other conflict occurs, abort and report PARK. After both merges, prove main and both audited tips are ancestors, prove the design blob hash, validate the GREEN audit reports, and run all offline gates.

No live requests, secrets/private data, push, main change, or scope expansion.
