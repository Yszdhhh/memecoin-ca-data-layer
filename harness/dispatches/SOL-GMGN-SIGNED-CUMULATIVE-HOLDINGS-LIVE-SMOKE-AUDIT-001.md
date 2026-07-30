# Dispatch: SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-AUDIT-001

## Exact task

Execute only `harness/tasks/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-AUDIT-001.json` after the implementer run finishes.

## Role and identity

- Role: independent auditor
- Required `HARNESS_AGENT_ID`: `auditor-sol-gmgn-signed-cumulative-holdings-live-smoke-001`
- The auditor identity must differ from the implementer identity.

## Zero-network boundary

- Provider requests: 0.
- Network requests: 0.
- Credential reads: 0.
- External address-file reads: 0.

Audit only sanitized evidence and local contracts. Do not repeat, replay or send the live request. A GREEN result does not upgrade GMGN Holdings data to chain-confirmed or complete all-time PnL.

## Allowlisted write set

- `harness/tasks/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-AUDIT-001.json`
- `harness/ledger/tasks.json`
- `harness/reports/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-AUDIT-001/acceptance.md`