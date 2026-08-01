# Dispatch: WALLET-SHADOW-LIVE-OBSERVATION-PILOT-001

## Scope
Remain PARK until contracts, replay engine, one adapter, data-security audit, named provider/budget, and explicit Owner network authorization are all recorded. If activated, observe only, timestamp observed_at, simulate privately, and prepare HUD review files without trading or unattended publishing.

## Required reading
Read `PROJECT_REQUIRED_READING.md` in full before inspecting code. Follow the exact task spec: `harness/tasks/WALLET-SHADOW-LIVE-OBSERVATION-PILOT-001.json`.

## Current status
`PARK`. Do not begin implementation unless the Harness lifecycle state is moved to `READY` by an authorized coordinator.

## Dependencies
- `SOL-WALLET-SHADOW-REPLAY-PILOT-001`
- `BSC-WALLET-SHADOW-REPLAY-PILOT-001`

## Write boundary
- `harness/reports/WALLET-SHADOW-LIVE-OBSERVATION-PILOT-001/`
- `docs/shadow_live_observation_operating_procedure.md`

## Required evidence
- Run the task acceptance commands.
- Run once against authorized private input and replay the same input deterministically where applicable.
- Produce `acceptance.md`, `desensitized_metrics.json`, `replay_manifest.json`, `source_hashes.json`, `deterministic_replay_result.json`, `test_evidence.md`, and `git_delivery_status.md` in the task report area.
- Keep all raw private data outside Git.
