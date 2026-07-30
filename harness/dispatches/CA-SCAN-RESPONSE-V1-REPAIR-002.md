# Dispatch: CA-SCAN-RESPONSE-V1-REPAIR-002

- Role: Implementer
- HARNESS_AGENT_ID: `implementer-ca-scan-response-v1-repair-002`
- Baseline: `320a259ae514a1047e22fa8c1087a7f78d0f1e18`
- Tier / layer: T2 / judgment_layer
- Budget: zero network/provider/credential/private-data access.

Make only the narrow repair identified by audit 001. Denominators such as `"00"` and `"000"` are numerically zero: validator must require `ratio: null`; helper must never preserve explicit precision for them and must never execute division by zero. Add direct tests for validator bypass, explicit helper input, and automatic derivation. Preserve all other contract behavior and stop for independent re-audit.
