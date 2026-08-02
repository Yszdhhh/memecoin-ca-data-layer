# Dispatch: EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001

- **Role:** Researcher
- **Task spec:** `harness/tasks/EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001.json`
- **Execution owner:** Luna Worker, after this governance task is independently audited GREEN and merged.
- **Chain:** `null` (cross-chain architecture synthesis; does not activate BSC or Live Observation)

## Preconditions

The coordinator must verify before dispatch:

1. PR #16 is merged into `main` by merge commit only, with independent governance audit GREEN.
2. `origin/main` contains the PR #16 merge commit and the local main worktree is clean and equal to `origin/main`.
3. `EXTERNAL_RESEARCH_ROOT` is set in the process and User environment and resolves to an existing non-empty directory.
4. Only the permitted external subtrees exist in the read plan; `chainfm_out`, GMGN private exports, private credentials, and login state are not read.

If a precondition fails, return `PARK` and make no synthesis or repository changes.

## Objective

Using only the exact Task Spec and this Dispatch, produce six files under `%EXTERNAL_RESEARCH_ROOT%\synthesis\`:

- `project-capability-overlap.md`
- `verified-architecture-decisions.md`
- `poc-decision-matrix.md`
- `existing-task-impact.md`
- `implementation-sequence.md`
- `open-questions.md`

This is an integration decision task, not a product implementation task. Explain what the current project already covers, what external research fills, where designs conflict, what is overbuilt for the current daily-use constraints, what belongs in Live Observation later, what existing formal Task Specs would need changes, and what is not worth changing.

## Required external re-evaluation boundaries

Use these decisions as hard constraints, regardless of any earlier external recommendation:

- `yellowstone-grpc`: **LATER / Live-stage POC only**, never direct ADOPT in this task.
- `ethereum-etl`: external supplementation POC only; never a core dependency.
- `sol-parser-sdk`: POC only behind a project-owned Parser Interface; do not connect Yellowstone first.
- `onchain-sybil-detector`: REFERENCE / LATER POC; no algorithm migration now.
- NautilusTrader, hftbacktest, Freqtrade, Hummingbot: design references only; no dependency-tree adoption.
- Do not force Rust, DuckDB, Parquet, Yellowstone, or an indexer.

Evaluate every decision against approximately 1,000 addresses, dozens of focus wallets, Windows-local operation, low cost, second-to-minute latency, no live trades, no microsecond requirement, and explicit unknown/unfillable handling.

## Three minimum POCs (describe only; do not implement)

Every POC section must include: `objective`, `minimum inputs`, `write_set`, `forbidden actions`, `external dependencies`, `fixed upstream commit`, `offline/online boundary`, `success criteria`, `failure criteria`, `maximum code scope`, `maximum data scope`, `expected decision after POC`, and `whether it changes an existing PR #16 Task`.

### SOL-PARSER-COMPARISON-POC-001

Use 100–300 desensitized or locally authorized representative historical transactions, current parser output, a fixed `sol-parser-sdk` commit, and balance-difference results. Compare Swap/Transfer, buy/sell direction, quantities, WSOL, inner instructions, multi-hop, multiple swaps, failed transactions, unknown protocols, and parse failures. Do not connect Yellowstone.

### SHADOW-REPLAY-MINIMUM-LOOP-POC-001

Use the existing five SOL chain-verification samples, offline historical prices or pool snapshots, and manually controlled observed_at/latency scenarios. Validate distinct `source_trade_at`, `observed_at`, and `simulated_order_at`; no future function; fixed notional; delayed price; basic slippage, fees, unfillable; mirror exit; 5m/30m/2h/24h; and bit-for-bit deterministic same-input/same-output behavior. Success is separating wallet-person performance from user-replicable performance, not profitability.

### BSC-EXISTING-DATA-INVENTORY-POC-001

First inspect only the existing five BSC file schemas and aggregate coverage. Report address count, time range, transaction/receipt/log/transfer/trace coverage, Pancake-like Swap recognition, cost basis, offline replayability, and exact missing fields. Only if gaps are confirmed may the report propose a minimal `ethereum-etl` supplementation experiment; do not default to 10,000-block collection.

## Read boundary

Read the project governance and architecture files, Harness schema/ledger and current program reports, PR #15 current code and acceptance/unresolved evidence from the local Git/PR context, landed PR #16 files, current SOL cleaning/filtering/chain-verification/HUD/shadow-event code, and only these external paths:

- `%EXTERNAL_RESEARCH_ROOT%\raw-reports\**`
- `%EXTERNAL_RESEARCH_ROOT%\source-catalog\**`
- `%EXTERNAL_RESEARCH_ROOT%\verified-findings\**`
- `%EXTERNAL_RESEARCH_ROOT%\repos\sol-parser-sdk\**`
- `%EXTERNAL_RESEARCH_ROOT%\repos\ethereum-etl\**`
- `%EXTERNAL_RESEARCH_ROOT%\repos\onchain-sybil-detector\**`

Do not read `chainfm_out`, real address/transaction detail, GMGN private exports, secrets, credentials, cookies, or login state.

## Write boundary

Repository write: only the task's declared acceptance evidence file, and only if the coordinator refreshes evidence. The task spec, dispatch, and ledger are already registered by the governance PR and are read-only during Luna execution. External write: exactly the six synthesis files under `%EXTERNAL_RESEARCH_ROOT%\synthesis\`. Do not modify product source, PR #15, PR #16, existing product Task Specs, dependencies, or third-party repositories. Do not create a POC implementation, a product PR, or a new Task Spec.

## Required final response from the executing worker

Return the six absolute output paths, a concise decision summary, the adopted/rejected/deferred list, the three POC decisions, Rust/DuckDB/Yellowstone/ethereum-etl/sol-parser-sdk recommendations, existing Task Specs requiring adjustment, unresolved questions, and a statement that no forbidden paths, private data, network collection, code changes, dependencies, or POC implementation occurred.

