# Program preflight

- **Recorded at:** 2026-08-02T00:00:00Z
- **Branch:** `chore/crosschain-wallet-shadow-program-spec`
- **Draft PR:** #16 (open; not merged)
- **Repository fact:** PR #15 remains open on `feat/sol-wallet-hud-v0-2-scene-strength`; no agent merge is authorized.
- **Program registration:** 27 task-v1 specs, including 13 report-only independent audit specs.
- **Private inputs:** aggregate-only manifest retained at `harness/inputs/CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1/private-input-manifest.json`; no raw private records were added to Git.
- **Stage fact:** Solana is the sole Live/production chain. This governance PR registers, but does not execute, the separately audited BSC offline activation path; its config write is serialized after the Harness Doctor audit to avoid concurrent project-config edits.
- **Harness Doctor baseline:** the broad `wallet*.json` rule reports the same three tracked scrubbed fixture/aggregate files; this remains an unwaived PARK condition pending the narrow repair task.

## Corrected preconditions

1. Chain-neutral Shadow Contracts depend on Harness Doctor Repair Audit GREEN, not BSC stage activation.
2. Replay Engine depends on Shadow Contracts Audit GREEN.
3. SOL Shadow Replay Pilot depends on Replay Engine Audit GREEN and SOL HUD Audit GREEN.
4. BSC work remains offline-stage gated through BSC Offline Activation Audit GREEN and Owner merge.
5. HUD v0.3 depends on the named audited research/replay outputs, not Live Observation.

## Status consistency repair — 2026-08-02

Task Specs are the single status source of truth. The Program ledger and DAG are synchronized to all 27 Program Task Specs; BSC Offline Activation remains `BLOCKED_DEPENDENCY`, BSC Source Inventory remains `BLOCKED_STAGE`, and BSC Source Inventory Audit remains `BLOCKED_STAGE`.
