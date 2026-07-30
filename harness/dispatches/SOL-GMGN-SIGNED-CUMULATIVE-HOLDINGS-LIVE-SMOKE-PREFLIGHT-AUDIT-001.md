# Dispatch: SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-001

## Exact task

Execute only `harness/tasks/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-001.json`.

## Role and identity

- Role: independent auditor
- Required `HARNESS_AGENT_ID`: `auditor-sol-gmgn-signed-cumulative-holdings-live-smoke-preflight-001`
- The auditor identity must differ from the implementer identity.

## Zero-network boundary

- Provider requests: 0.
- Network requests: 0.
- Credential reads: 0.
- External address-file reads: 0.

Audit the live-task design and local source contract only. Do not issue any GMGN command and do not modify the implementation task's files. A GREEN result means only that the preflight design controls are adequate for one bounded request; it does not mean that cumulative data is available or that the later live task has executed.

## Allowlisted write set

- `harness/tasks/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-001.json`
- `harness/ledger/tasks.json`
- `harness/reports/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-001/acceptance.md`