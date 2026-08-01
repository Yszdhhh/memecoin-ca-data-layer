# Program preflight

## Scope
Governance-only preflight for `CROSSCHAIN-WALLET-INTELLIGENCE-AND-SHADOW-TRADING-V0-1`.

## Repository facts
- The active repository stage is Solana-only. BSC is explicitly blocked until the documented Solana E2E/Owner gate changes.
- PR #15 is open and unmerged; its historical HUD task is not currently registered in the ledger. Repair-002 retains the PR #15 task as an explicit input/precondition and is blocked by this governance task until the Owner merges the governance PR.
- No task here authorizes trades, credentials, browser sessions, live monitoring, or GMGN automation.

## Private input availability (aggregate only)
See the committed aggregate-only input manifest. Both `sol` and `bsc` roots exist. The BSC root alone is not evidence that BSC implementation is currently authorized.

## BSC data gap
BSC files are present, but their schema, time coverage, source provenance, address type, complete cost basis, transfer accounting, and offline replay completeness remain unverified. The inventory task must resolve these after stage activation; no BSC master is fabricated.

## Reusable components
The repository has existing Solana wallet-intelligence/HUD conventions and Harness validation. No shadow-trading product component is claimed reusable until the contract task proves the boundary.

## Risk register
1. BSC/cross-chain activation would violate the current Solana-first gate without Owner action.
2. PR #15 lacks an independent GREEN audit.
3. Existing Harness doctor has a broad filename-pattern false positive affecting scrubbed artifacts; M0 cannot be called GREEN until a separate narrow repair verifies the rule.
4. Shadow-event count is zero in current SOL HUD evidence, so no followability conclusion is allowed.
5. Private data provenance and field coverage cannot be inferred from directory existence.
