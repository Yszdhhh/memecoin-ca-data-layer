# Dispatch: CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1-001

## Scope
Create an evidence-bound program graph and governance-only dispatch set. Preserve the repository's Solana-first gate: BSC and cross-chain implementation remain blocked until the documented Owner stage decision changes.

## Required reading
Read `PROJECT_REQUIRED_READING.md` in full before inspecting code. Follow the exact task spec: `harness/tasks/CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1-001.json`.

## Current status
`IN_PROGRESS`. Do not begin implementation unless the Harness lifecycle state is moved to `READY` by an authorized coordinator.

## Dependencies
- None

## Write boundary
- `harness/ledger/tasks.json`
- `harness/inputs/CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1/private-input-manifest.json`
- `harness/reports/CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1/`
- `docs/programs/crosschain-wallet-intelligence-and-shadow-trading-v0-1.md`
- `harness/tasks/CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1-001.json`
- `harness/tasks/SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-001-REPAIR-002.json`
- `harness/tasks/SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-002-AUDIT-001.json`
- `harness/tasks/BSC-WALLET-SOURCE-INVENTORY-001.json`
- `harness/tasks/BSC-WALLET-MASTER-CLEAN-RANK-V0-1-001.json`
- `harness/tasks/BSC-WALLET-CANDIDATE-SCREENING-V0-1-001.json`
- `harness/tasks/BSC-WALLET-CHAIN-VERIFICATION-PILOT-001.json`
- `harness/tasks/WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001.json`
- `harness/tasks/WALLET-SHADOW-REPLAY-ENGINE-V0-1-001.json`
- `harness/tasks/SOL-WALLET-SHADOW-REPLAY-PILOT-001.json`
- `harness/tasks/BSC-WALLET-SHADOW-REPLAY-PILOT-001.json`
- `harness/tasks/WALLET-SHADOW-LIVE-OBSERVATION-PILOT-001.json`
- `harness/tasks/CROSSCHAIN-WALLET-HUD-V0-3-001.json`
- `harness/dispatches/CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1-001.md`
- `harness/dispatches/SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-001-REPAIR-002.md`
- `harness/dispatches/SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-002-AUDIT-001.md`
- `harness/dispatches/BSC-WALLET-SOURCE-INVENTORY-001.md`
- `harness/dispatches/BSC-WALLET-MASTER-CLEAN-RANK-V0-1-001.md`
- `harness/dispatches/BSC-WALLET-CANDIDATE-SCREENING-V0-1-001.md`
- `harness/dispatches/BSC-WALLET-CHAIN-VERIFICATION-PILOT-001.md`
- `harness/dispatches/WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001.md`
- `harness/dispatches/WALLET-SHADOW-REPLAY-ENGINE-V0-1-001.md`
- `harness/dispatches/SOL-WALLET-SHADOW-REPLAY-PILOT-001.md`
- `harness/dispatches/BSC-WALLET-SHADOW-REPLAY-PILOT-001.md`
- `harness/dispatches/WALLET-SHADOW-LIVE-OBSERVATION-PILOT-001.md`
- `harness/dispatches/CROSSCHAIN-WALLET-HUD-V0-3-001.md`

## Required evidence
- Run the task acceptance commands.
- Run once against authorized private input and replay the same input deterministically where applicable.
- Produce `acceptance.md`, `desensitized_metrics.json`, `replay_manifest.json`, `source_hashes.json`, `deterministic_replay_result.json`, `test_evidence.md`, and `git_delivery_status.md` in the task report area.
- Keep all raw private data outside Git.
