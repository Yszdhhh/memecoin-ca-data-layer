# Dispatch: CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1-001

## Scope
Create and repair an evidence-bound program graph and governance-only dispatch set. This Draft PR records the BSC offline-stage activation task but does not change active-stage configuration. Solana remains the only Live/production chain until the activation task is independently audited GREEN and Owner-merged with a merge commit.

## Required reading
Read `AGENTS.md`, then `PROJECT_REQUIRED_READING.md` and every shared file it names, then the exact task spec `harness/tasks/CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1-001.json`.

## Current status
`IN_PROGRESS`. READY only after this governance PR is Owner-merged with a merge commit. Do not self-merge.

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
- `harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001.json`
- `harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001-AUDIT-001.json`
- `harness/dispatches/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001.md`
- `harness/dispatches/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001-AUDIT-001.md`
- `harness/tasks/BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001.json`
- `harness/dispatches/BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001.md`
- `harness/tasks/BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001-AUDIT-001.json`
- `harness/dispatches/BSC-OFFLINE-RESEARCH-STAGE-ACTIVATION-001-AUDIT-001.md`
- `harness/tasks/BSC-WALLET-SOURCE-INVENTORY-001-AUDIT-001.json`
- `harness/dispatches/BSC-WALLET-SOURCE-INVENTORY-001-AUDIT-001.md`
- `harness/tasks/BSC-WALLET-MASTER-CLEAN-RANK-V0-1-001-AUDIT-001.json`
- `harness/dispatches/BSC-WALLET-MASTER-CLEAN-RANK-V0-1-001-AUDIT-001.md`
- `harness/tasks/BSC-WALLET-CANDIDATE-SCREENING-V0-1-001-AUDIT-001.json`
- `harness/dispatches/BSC-WALLET-CANDIDATE-SCREENING-V0-1-001-AUDIT-001.md`
- `harness/tasks/BSC-WALLET-CHAIN-VERIFICATION-PILOT-001-AUDIT-001.json`
- `harness/dispatches/BSC-WALLET-CHAIN-VERIFICATION-PILOT-001-AUDIT-001.md`
- `harness/tasks/WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001-AUDIT-001.json`
- `harness/dispatches/WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001-AUDIT-001.md`
- `harness/tasks/WALLET-SHADOW-REPLAY-ENGINE-V0-1-001-AUDIT-001.json`
- `harness/dispatches/WALLET-SHADOW-REPLAY-ENGINE-V0-1-001-AUDIT-001.md`
- `harness/tasks/SOL-WALLET-SHADOW-REPLAY-PILOT-001-AUDIT-001.json`
- `harness/dispatches/SOL-WALLET-SHADOW-REPLAY-PILOT-001-AUDIT-001.md`
- `harness/tasks/BSC-WALLET-SHADOW-REPLAY-PILOT-001-AUDIT-001.json`
- `harness/dispatches/BSC-WALLET-SHADOW-REPLAY-PILOT-001-AUDIT-001.md`
- `harness/tasks/WALLET-SHADOW-LIVE-OBSERVATION-PILOT-001-AUDIT-001.json`
- `harness/dispatches/WALLET-SHADOW-LIVE-OBSERVATION-PILOT-001-AUDIT-001.md`
- `harness/tasks/CROSSCHAIN-WALLET-HUD-V0-3-001-AUDIT-001.json`
- `harness/dispatches/CROSSCHAIN-WALLET-HUD-V0-3-001-AUDIT-001.md`

## Required evidence
- Run every acceptance command in the declared order.
- Record exact inputs, source hashes, output counts, deterministic replay evidence, security-scan result, and Git delivery status.
- Keep raw private data outside Git.
- Report task_id, role, UTC time, changed paths, command exit codes, evidence, verdict, and unresolved items.
