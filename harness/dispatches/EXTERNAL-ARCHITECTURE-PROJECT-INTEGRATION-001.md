# Dispatch: EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001

- **Role:** Researcher
- **Agent identity:** `researcher-external-architecture-project-integration-001`
- **Task spec:** `harness/tasks/EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001.json`
- **Tier:** T1
- **Chain:** none (cross-chain research, chain-agnostic synthesis)

## Prerequisite gate (MANDATORY — PARK until both conditions are met)

1. **PR #16 independent governance audit must be GREEN** and merged into `main` by the Owner using a **merge commit** (no squash, no rebase). Verify with:
   ```
   git log --merges --oneline origin/main | findstr /i "crosschain"
   ```
2. **External research directory must exist and be non-empty.** Verify:
   ```
   powershell -Command "if (Test-Path $env:EXTERNAL_RESEARCH_ROOT) { Get-ChildItem $env:EXTERNAL_RESEARCH_ROOT -Recurse -File | Measure-Object | Select-Object -ExpandProperty Count } else { Write-Error 'EXTERNAL_RESEARCH_ROOT missing' }"
   ```

If either condition fails, return `PARK` and make zero file changes.

## Objective

Read the landed external research verification package, current project architecture,
PR #15 acceptance evidence, and PR #16 governance files; then produce six
integration-decision reports in `%EXTERNAL_RESEARCH_ROOT%\synthesis\`.

Also produce one acceptance evidence file in `harness/reports/EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001/acceptance.md`
(scrubbed — no real addresses, no transaction hashes, no private paths).

## Governance branch

Create a feature branch from the merge-commit HEAD of `origin/main` after PR #16 lands:

```
git checkout -b chore/external-architecture-project-integration-task-spec origin/main
```

## Read set (repository)

Must read before writing anything:

1. `PROJECT_CONSTITUTION.md`
2. `PROJECT_ARCHITECTURE.md`
3. `PROJECT_OPERATING_PLAYBOOK.md`
4. `KNOWN_LIMITATIONS.md`
5. `OWNER_DECISIONS_NEEDED.md`
6. `AGENTS.md`
7. `docs/LOCAL_WORKSPACE_PATHS.md`
8. `harness/schemas/task-spec.schema.json`
9. `harness/config/project.json`
10. `harness/ledger/tasks.json`
11. `harness/tasks/EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001.json` (this task)
12. Selected existing task specs listed in the task `inputs` field
13. Current SOL wallet cleaning, filtering, chain-verification, HUD, and Shadow Contract source files listed in the task `inputs` field

## Read set (external research — via EXTERNAL_RESEARCH_ROOT)

`EXTERNAL_RESEARCH_ROOT` defaults to `G:\链上战壕-external-research`. The agent MUST
read this value from the environment; never hardcode a path.

Permitted relative paths under `EXTERNAL_RESEARCH_ROOT`:

- `raw-reports/**`
- `source-catalog/**`
- `verified-findings/**`
- `repos/sol-parser-sdk/**`
- `repos/ethereum-etl/**`
- `repos/onchain-sybil-detector/**`

**Forbidden external paths:** `chainfm_out/**`, GMGN private exports, any directory
not listed above.

## Write set

### Repository (committed)

| Path | Content |
|------|---------|
| `harness/reports/EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001/acceptance.md` | Scrubbed acceptance evidence — no real addresses, no tx hashes, no private paths |
| `harness/ledger/tasks.json` | Add this task entry |
| `harness/tasks/EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001.json` | Already created (this task spec) |

### External synthesis (not committed — authorized via env var and this dispatch)

Root: `%EXTERNAL_RESEARCH_ROOT%\synthesis\`

| File | Purpose |
|------|---------|
| `project-capability-overlap.md` | Map external research findings against existing project capabilities |
| `verified-architecture-decisions.md` | Architecture decisions confirmed or refuted by external research |
| `poc-decision-matrix.md` | ADOPT\_AS\_TOOL / ADAPT\_BEHIND\_INTERFACE / REFERENCE\_ONLY / POC / LATER / REJECT for each external tool |
| `existing-task-impact.md` | Impact of integration findings on current task specs and sequencing |
| `implementation-sequence.md` | Recommended ordering for adoption decisions, given current SOL E2E stage |
| `open-questions.md` | Unresolved questions requiring Owner decision before next step |

## Task objective detail

### 1. Capability overlap analysis

Map each external research finding to one of:

- **ADOPT_AS_TOOL**: The tool/library is a direct drop-in that improves an existing component with no architecture change.
- **ADAPT_BEHIND_INTERFACE**: The tool is worth using, but must be isolated behind the existing Parser Interface (`src/domain/interfaces/parser-interface.ts`) or a new equivalent abstraction.
- **REFERENCE_ONLY**: Methodology or data from the external source is useful to read, but the code/library is not adopted.
- **POC**: Insufficient data to decide; a bounded POC is required before the decision.
- **LATER**: Not relevant at current SOL-E2E stage; revisit after BSC activation.
- **REJECT**: Incompatible with project constraints (trust tiers, Windows-local, no live trades, license, etc.).

### 2. Evaluate these specific technologies

For each, produce a decision and rationale:

| Technology | Key constraint to evaluate |
|-----------|---------------------------|
| Rust (sol-parser-sdk Rust core) | Build toolchain on Windows-local; FFI vs. WASM vs. subprocess isolation |
| DuckDB | Fit for cold-path batch analytics on parquet files; Windows-local; license |
| Parquet | Storage format for address-library cold snapshots |
| Yellowstone gRPC | SOL real-time stream; Owner constraint: no live transactions; cost |
| ethereum-etl | BSC/EVM ingestion; stage-blocked until SOL E2E GREEN |
| Subsquid | Indexing; cost model; fits Owner's free-stack preference |
| sol-parser-sdk | Parser isolation; comparison against current helius-solana-adapter |
| Sybil clustering | Fit vs. existing `funding_clusters` rule v1; trust-tier compliance |

### 3. Owner daily-use constraints (non-negotiable)

All evaluations must score tools against:

- Address library scale: **~1,000 addresses**, with **~50 focus wallets**
- Windows-local execution
- Low cost (free-tier preferred; see OWNER\_DECISIONS\_NEEDED.md D-A, D-B)
- Latency: **second or minute scale acceptable**; microsecond performance not required
- **No live transactions / no signing**
- No batch re-crawl of 10,000+ blocks by default

### 4. Three minimum POC proposals

Describe (do not implement) these three POCs with their scope, success criteria, and constraints:

#### SOL-PARSER-COMPARISON-POC-001

- Use first **100–300 representative transactions** (existing fixtures preferred)
- Do **not** connect Yellowstone; use existing Helius fixture path
- `sol-parser-sdk` MUST be isolated behind the existing Parser Interface; no direct coupling
- Compare: current `helius-solana-adapter` output vs. `sol-parser-sdk` output vs. balance-diff result
- Success criterion: structured diff table with field coverage, discrepancy rate, and performance on Windows-local

#### SHADOW-REPLAY-MINIMUM-LOOP-POC-001

- Use the existing **five SOL chain-verification samples** already in the project
- Offline replay only — no live RPC calls
- Enforce strict timestamp semantics: `source_trade_at`, `observed_at`, `simulated_order_at` must be distinct fields
- Success criterion: replay is **deterministic** (same input → same output) and contains **no future-data functions**; profitability is irrelevant at this stage

#### BSC-EXISTING-DATA-INVENTORY-POC-001

- Read the existing **~five BSC fixture files** in the repository first
- Do **not** default to crawling 10,000 blocks
- Only if specific field gaps are confirmed after reading existing files, propose a minimal `ethereum-etl` experiment (not execute it)
- Success criterion: inventory manifest listing available fields, confirmed gaps, and ethereum-etl experiment scope (if needed)

## Forbidden actions

- Do not modify product source code
- Do not modify PR #15 or PR #16
- Do not modify any existing task spec other than `harness/ledger/tasks.json` (ledger update only)
- Do not add third-party dependencies to `package.json`
- Do not run third-party code
- Do not make network requests
- Do not execute live transactions
- Do not read `chainfm_out/**`
- Do not commit the external research workspace into this repository
- Do not copy third-party repositories into this project
- Do not generate or dispatch any subsequent POC task spec

## Acceptance commands

Run these in order. All must pass GREEN before creating the acceptance report:

```
npm run harness:task -- validate harness/tasks/EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001.json
npm run harness:doctor
npm run typecheck
npm test
npm run build
npm run security:scan
git diff --check
```

### Harness doctor baseline note

As of the governance branch creation date, `npm run harness:doctor` reports **one pre-existing
FAIL** for three `wallet*.json` files in the baseline (forbidden tracked files). This agent
MUST NOT introduce any new hits. Document the pre-existing hit count in `acceptance.md`
and confirm this task added zero new hits.

## Verification checklist for acceptance.md

The acceptance report must confirm:

| Check | Result |
|-------|--------|
| Task JSON parses as valid JSON | ✓ / ✗ |
| Schema validation PASS (`harness:task validate`) | ✓ / ✗ |
| Ledger entry present and consistent | ✓ / ✗ |
| No unknown dependencies | ✓ / ✗ |
| No dependency cycle introduced | ✓ / ✗ |
| write\_set has no conflicts with other READY tasks | ✓ / ✗ |
| All deliverables within authorized paths | ✓ / ✗ |
| `npm run harness:doctor` — new hits = 0 | ✓ / ✗ |
| `npm run typecheck` | ✓ / ✗ |
| `npm test` | ✓ / ✗ |
| `npm run build` | ✓ / ✗ |
| `npm run security:scan` | ✓ / ✗ |
| `git diff --check` | ✓ / ✗ |
| No product source code modified | ✓ / ✗ |
| No private data accessed | ✓ / ✗ |

## Git delivery

```
git add harness/tasks/EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001.json \
        harness/dispatches/EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001.md \
        harness/reports/EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001/acceptance.md \
        harness/ledger/tasks.json
git commit --no-edit -m "chore(harness): add EXTERNAL-ARCHITECTURE-PROJECT-INTEGRATION-001 task spec, dispatch, and acceptance stub"
git push origin chore/external-architecture-project-integration-task-spec
```

Then open a PR targeting `main`. Do **not** merge. Do not squash or rebase. Keep PR OPEN for Owner merge commit.

## Verdict vocabulary

- `GREEN`: all checks pass, all six synthesis documents produced, acceptance.md complete
- `GREEN_WITH_ADVISORY`: correct with non-blocking follow-up items noted in acceptance.md
- `PARK`: prerequisite gate not met (PR #16 not merged OR `EXTERNAL_RESEARCH_ROOT` missing)
- `FAIL`: any acceptance command fails, boundary violation, or private data accessed
