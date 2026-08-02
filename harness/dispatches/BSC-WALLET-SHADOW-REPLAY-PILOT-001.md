# Dispatch: BSC-WALLET-SHADOW-REPLAY-PILOT-001

## Scope
Build the BSC-only offline replay adapter after BSC activation and verification. Cover fee-on-transfer, sell-blocked/honeypot evidence, router and multi-hop logs, BNB/WBNB, pool migration, decimals anomalies, tax uncertainty, and deterministic no-lookahead replay. It remains BSC-offline-only and BLOCKED_STAGE until the activation audit is GREEN and Owner-merged.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/BSC-WALLET-SHADOW-REPLAY-PILOT-001.json`.

## Current status
`BLOCKED_STAGE`. BLOCKED_STAGE. Do not start until the offline-stage activation audit is GREEN, its implementation PR is Owner-merged with a merge commit, and the ledger lifecycle is authorized to READY.

## Dependencies
- `BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001-AUDIT-001`
- `BSC-WALLET-CHAIN-VERIFICATION-PILOT-001-AUDIT-001`
- `WALLET-SHADOW-REPLAY-ENGINE-V0-1-001-AUDIT-001`

## Write boundary
- `src/application/shadow-trading/bsc-adapter-v0-1.ts`
- `src/cli/run-bsc-wallet-shadow-replay-pilot.ts`
- `test/application/shadow-trading/bsc-adapter-v0-1.test.ts`
- `docs/bsc_shadow_replay_pilot_v0_1.md`
- `harness/reports/BSC-WALLET-SHADOW-REPLAY-PILOT-001/`
- `artifacts/bsc_shadow_replay_pilot_v0_1/`

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
