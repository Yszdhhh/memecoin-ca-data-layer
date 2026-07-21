# Agent operating playbook

## 1. Roles

| Role | Responsibility | Write policy |
|---|---|---|
| coordinator | scope, dispatch, integration, test evidence, final acceptance | repository-wide only when integrating |
| implementer | one bounded code or fixture slice | only task `write_set` |
| researcher | source/ABI/API investigation with provenance | task deliverable only |
| auditor | independent review of code, manifests and claims | read-only; report only |

## 2. Task tiers

- `T1`: read-only research, fixtures, tests, documentation, isolated additive code.
- `T2`: schema, normalized event semantics, rule versions, creator precedence,
  canonical source mapping. Requires coordinator acceptance and an independent review.
- `T3`: credentials, paid-provider changes, production webhooks, destructive DB
  migrations/backfills, threshold relaxation, enabling BSC/Robinhood, or any trading
  capability. Requires an explicit Owner decision.

The Owner has already selected the chain order: Solana first, then BSC, then
Robinhood. This does not implicitly authorize credentials, paid plans, destructive
backfills, or activation of a future-chain adapter.

## 3. Dispatch contract

Every dispatch message must name:

- agent and role;
- exact `task_id`, tier, and task-spec path;
- objective and dependencies;
- exact read/write sets;
- forbidden actions;
- deliverable path;
- acceptance commands and verdict vocabulary.

Agents read the shared documents, then only their named task. Task ID, role, path,
or dependency mismatch means `PARK`.

## 4. Parallelism

Parallel work is allowed only when write sets do not overlap and neither task
depends on the other's unfinished output. Recommended Solana wave:

- Helius/RPC normalization implementation;
- Pump.fun decoder implementation against pinned fixtures;
- independent API/IDL provenance research or read-only audit.

Holder integration begins only after the ingestion and Pump decoder contracts are
stable. BSC and Robinhood tasks stay `BLOCKED_STAGE`.

In a shared worktree, acceptance and commits are serialized by the coordinator.
If two implementers truly edit concurrently, they must use isolated Git worktrees;
non-overlapping paths alone do not provide trustworthy per-Agent Git provenance.

## 5. Acceptance

The coordinator verifies:

1. task spec validates and stage lock permits it;
2. changed files are inside the write set;
3. deliverables and referenced inputs exist;
4. facts, inference, recommendation, and Owner decisions are separated;
5. manifest has git state, rule/config versions, source watermarks, hashes and tests;
6. `npm run check` and task-specific acceptance commands pass;
7. a milestone has an auditor other than its implementer.

Verdicts:

- `GREEN`: reproducible, complete for declared scope, all gates pass.
- `GREEN_WITH_ADVISORY`: correct with non-blocking follow-up.
- `PARK`: missing input, inactive stage, credential/Owner gate, or unresolved provenance.
- `FAIL`: regression, unsupported claim, or boundary violation.
- `QUARANTINED`: run exists but must not be used for judgment.

## 6. Harness commands

```text
npm run harness:doctor
npm run harness:task -- validate harness/tasks/<TASK>.json
npm run harness:run -- start harness/tasks/<TASK>.json
npm run harness:run -- verify harness/runs/<RUN_ID>
npm run harness:run -- finish harness/runs/<RUN_ID> GREEN "reason"
npm run harness:status
```

`finish ... GREEN` is rejected unless required acceptance commands have passed.
