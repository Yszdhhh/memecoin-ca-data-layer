# Manual daily Solana candidate discovery and address-analysis assessment

## Decision

Keep daily discovery manual. The operator supplies a short candidate list, then
chooses individual CAs for the bounded Helius first look. There is no cron,
background loop, automatic list fetch, automatic address promotion, or database
write in this plan.

## Independent task slices

| Slice | Purpose | Allowed output | Boundary |
|---|---|---|---|
| Manual candidate intake | Record a user-supplied CA list for one review session | A validated, de-duplicated in-memory list | No discovery fetch and no scheduled trigger |
| Bounded CA first look | Manually read mint, metadata presence, holder-account count, completeness, slots, and warnings | A restricted Helius-only result per selected CA | No deep analysis, labels, queues, cache, or persistence |
| Candidate triage | Let the operator choose whether a CA merits later offline research | A manual review decision, not a scored conclusion | No automatic recommendation or provider fan-out |
| Offline evidence reconstruction | Use pinned fixtures or separately authorised first-hand evidence for holders, creator, Dev activity, and trades | Reproducible evidence and explicit completeness warnings | Separate tasks; never inferred from the first look |
| Address-analysis rules | Apply existing versioned detectors only to complete, first-hand evidence | Versioned, reversible candidate labels | Borrowed platform labels remain leads, not conclusions |
| Address-library sedimentation | Persist a confirmed wallet-level conclusion only after its evidence gate passes | Append-only evidence references and versioned conclusion | Requires a separately authorised real storage target; no production write now |

## Execution order

1. An operator manually supplies a small list of Solana CAs.
2. The operator manually runs the bounded CA-first command for a chosen CA.
3. A degraded or rejected result stops at that result; it does not retry another
   provider or queue deeper work.
4. Only a separately dispatched offline evidence task may investigate a selected
   CA further.
5. Only a separately dispatched, evidence-complete rule task may produce a
   wallet conclusion. Storage remains disabled until its own Owner-gated task.

## Owner decision points

| Decision | Current default | Owner action needed before change |
|---|---|---|
| Daily popular-token collection | Manual and off | Enable an automatic daily trigger or list fetch |
| Provider set | Helius only for the live first look | Add, replace, or fall back to another provider |
| Runtime credential | Process-only and fail-closed | Missing credential recovery, rotation, or plan change |
| Address-library storage | No real database or cache write | Select and authorise a real storage target or backfill |
| Chain scope | Solana only | Activate BSC or Robinhood |

## Not an Owner decision

Creating the manual intake contract, bounded first-look tests, offline fixture
tasks, evidence schemas, and task-specific acceptance checks can proceed under
the existing Solana-only boundaries. They must remain separate dispatches with
their own write sets.
