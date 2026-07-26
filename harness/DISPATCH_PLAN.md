# Dispatch plan & handoff — 链上战壕

> Single source of truth for **what to build next, how, and how it's accepted**.
> Any agent picking up work reads this after the required-reading chain
> (`AGENTS.md` → `PROJECT_CONSTITUTION.md` → `PROJECT_ARCHITECTURE.md` →
> `PROJECT_OPERATING_PLAYBOOK.md` → `KNOWN_LIMITATIONS.md` →
> `OWNER_DECISIONS_NEEDED.md`), then executes ONLY the exact
> `harness/tasks/<task_id>.json` it is dispatched. Last updated 2026-07-27.

Owner direction & decisions are locked (see `OWNER_DECISIONS_NEEDED.md`): **all-free
data stack** (Birdeye free + Dexscreener + GMGN free OpenAPI + Helius free 1M, no
scraping), **borrow-then-confirm** leaderboards, **Telegram deferred**. Cost = $0.

---

## 1. Collaboration mechanism (协同机制) — how agents work without colliding

This is binding process, enforced by the harness and the constitution.

1. **One task, one agent identity, one bounded write set.** Set `HARNESS_AGENT_ID`
   to a unique per-agent value. You may only touch files inside your task's
   `write_set`; the harness `verify` fails on any out-of-scope change.
2. **Serialize harness runs on the shared worktree.** `run verify` compares the
   whole tree against the run's `start_commit`, so only ONE harness run may be
   in flight at a time. Do not start a run while another's is open. If your work
   pre-dates a clean tree, use stash → `run start` → stash pop → `run verify` →
   `run finish`.
3. **Non-overlapping READY write sets.** `harness:doctor` fails if two
   READY/IN_PROGRESS tasks have overlapping write sets. The dispatch waves below
   are sequenced so concurrent tasks never overlap; everything else stays
   `BLOCKED_DEPENDENCY` until its dependency is DONE. The coordinator flips
   readiness (or `lifecycle apply-readiness` proposes it — never auto-DONE).
4. **Implementer ≠ final auditor.** Every T2 milestone needs an independent
   auditor run under a DIFFERENT `HARNESS_AGENT_ID`. The lifecycle audit-evidence
   gate now enforces this (a same-identity or FAIL/invalid run does not close the
   gap). Flow per milestone: implement → `run finish GREEN` → dispatch an
   independent auditor → auditor `run finish GREEN|GREEN_WITH_ADVISORY|FAIL`. On
   FAIL, open a REPAIR-00N + REPAIR-AUDIT-00N chain; do not proceed downstream.
5. **Offline-first, live-gated.** Every task below is built and accepted
   **offline against fixtures** in the current stage. Real network/credentials
   are a separate final "go-live" flip per provider, gated by Owner items 1–4 and
   the content-scan. No secrets/keys/.env ever enter the repo or run artifacts.
6. **Evidence, not chat.** Files, hashes, test output, slots, signatures, and
   reproducible commands are evidence. A run is GREEN only when acceptance all
   PASSED and integrity all true (fail-closed).

Standard acceptance for every task (in addition to task-specific suites):
`npm run typecheck`, `npm test`, `npm run build`, `git diff --check`, and
`npm run harness:doctor` for harness-touching tasks.

---

## 2. Task waves (拆解 · 实现方式 · 验收标准)

Layer tags refer to `PROJECT_ARCHITECTURE.md` §2. "Harness dims" are the
`PROJECT_ARCHITECTURE.md` §6 suites a task must pass. Each implementer task has a
paired `*-AUDIT-*` task (independent auditor, write set = its report only).

### Wave A — offline foundations (dispatchable NOW, no live access)

**A1 · SOL-OBSERVATION-SCHEMA-001** (cold/judgment input · T2)
- Approach: implement the `ObservationRecord` + six snapshot structs and the
  versioned-parser interface from `docs/METHODS_...md` Part 3; add additive
  migration `008_address_library_and_observations.sql` (`wallets`,
  `wallet_token_edges`, `observations`). Raw-integer strings for chain amounts;
  borrowed fields carry `origin/verification_status`; partial → completeness.
- Write set: `src/domain/observation/**`, `db/migrations/008_*.sql`,
  `test/observation/**`. Acceptance: standard + a schema round-trip test proving
  no bigint/Date loss and that borrowed observations stay `unverified`.
- Accept when: structs match the methods doc, migration is additive-only, tests
  pin the raw-integer + unverified-borrowed + completeness rules.

**A2 · SOL-HARNESS-SUITES-001** (tooling · T1)
- Approach: implement the four suites (`latency`, `replay`, `source-degradation`,
  `label-decision`) from methods doc Part 3.4 as `tsx --test` suites + offline
  runner CLIs under `src/harness-suites/**`, each exiting non-zero on failure and
  writing `<runDir>/suite-*.json`. Deterministic virtual clock for latency; a
  versioned budget/tolerance file per suite. Invoke via `npx tsx` (do not edit
  package.json).
- Write set: `src/harness-suites/**`, `test/fixtures/harness/**`,
  `test/harness-suites/**`. Acceptance: standard + each suite runs green on its
  own seed fixtures.
- Accept when: all four suites exist, are offline+deterministic, fail-closed, and
  their budgets/tolerances are versioned files.

**A3 · SOL-ALPHA-SCORE-001** (judgment · T2)
- Approach: implement `alpha-score-v1` (methods doc Part 1) as a pure, versioned
  `src/domain/rules/alpha-score.ts` over fixture wallet/edge inputs — relative
  percentile, four factor groups, EWM half-life 14d, `insufficient≠N`, confidence
  caps, rule_version dual-axis. No live data.
- Write set: `src/domain/rules/alpha-score.ts`, `src/domain/types.ts` (additive
  interfaces), `test/alpha-score.test.ts`. Harness dims: **label-decision**
  (score monotonicity + anti-gaming golden cases).
- Accept when: deterministic, honest-under-partial (insufficient path pinned),
  anti-gaming (wash/sybil/single-luck) tests pass, thresholds versioned.

**A4 · SOL-DETECTORS-001** (judgment · T2, depends A3 for the Alpha-Score interface)
- Approach: implement the three detectors (methods doc Part 2) —
  `cluster-fusion-v1` (extends `funding-clusters.ts`, never lowers 0.85),
  `bot-sniper-v1` (new module), `independent-smart-money-v1` (new module, cluster/
  bot vetoes). Export `WalletForensicSignals`.
- Write set: `src/domain/rules/bot-sniper.ts`,
  `src/domain/rules/independent-smart-money.ts`,
  `src/domain/rules/cluster-fusion.ts`, `test/detectors/**`. Harness dims:
  **label-decision**.
- Accept when: existing 0.85 gate + service-funder suppression + owner-aggregation
  untouched; display precedence enforced by construction; FP/FN within tolerance.

### Wave B — first-hand adapters (offline fixture impl now; live flip Owner-gated)

**B1 · SOL-HELIUS-ADAPTER-001** (hot/first-hand · T2)
- Approach: implement the real `SolanaDataAdapter` against Helius Enhanced-Tx +
  DAS + Transfers/Funding-Source, behind the existing `SolanaHeliusDataSource`
  interface, driven by **pinned fixtures** (no live calls in-stage). Idempotent,
  slot-watermarked. Funding-source = first inbound SOL (cluster seed).
- Write set: `src/infrastructure/solana/helius/**`,
  `test/fixtures/solana/helius/**`, `test/solana/helius/**`. Harness dims:
  **replay**, **source-degradation**.
- Accept when: fixture replay reproduces holders/swaps/funding; degradation of any
  Helius call yields DEGRADED + completeness, never fake precision or a borrowed
  substitute for authoritative concentration.

**B2 · SOL-PUMP-DECODER-VERSION-001** (hot/first-hand · T2)
- Approach: version the Pump decoder by program+IDL+discriminator registry with
  hash-pinned `create_v2/buy/sell/migrate` fixtures; `create.creator` outranks
  payer/signer/metadata. Extends existing pump modules.
- Write set: `src/infrastructure/solana/pump/**`,
  `test/fixtures/solana/pump/**`, `test/solana/pump/**`. Harness dims: **replay**.

**B3 · SOL-ADDRESS-LIBRARY-SEDIMENTATION-001** (cold · T2, depends A1)
- Approach: implement the sedimentation writer — after each analysis, persist
  wallet-level conclusions into `wallets`/`wallet_token_edges`/`observations` per
  the trust rules; new-token analysis JOINs the library for instant cross-ref
  (the "paste-CA hit" path). Postgres repo + Redis read model.
- Write set: `src/infrastructure/postgres/**`, `src/application/sedimentation/**`,
  `test/application/sedimentation/**`. Harness dims: **replay**.

### Wave C — borrow layer + hot path (offline impl now; live flip Owner-gated)

**C1 · SOL-FREE-PROVIDERS-001** (hot/borrow · T2)
- Approach: implement free-tier borrow adapters — Birdeye free, Dexscreener
  (no-key), GMGN free OpenAPI, Jupiter — each behind a provider port, output
  routed through the A1 parser into `observations` marked `origin=borrowed,
  unverified`. Rate-limit aware (≤1rps free), cache. Offline fixture tests.
- Write set: `src/infrastructure/providers/**`, `test/providers/**`. Harness
  dims: **source-degradation**.
- Accept when: every borrowed field is `unverified`; no field overrides chain
  facts; graceful degradation on any provider failure.

**C2 · SOL-HOTPATH-CARD-001** (hot · T2, depends B1/C1/A3/A4)
- Approach: implement the second-scale first-screen orchestrator — bounded 4–6
  provider fan-out + address-library hit → card (price/liq/safety/holders/smart-
  money/sniper/cluster hits) with `unverified` markers; enqueue async first-hand
  deep-dive. p95 < 2s.
- Write set: `src/application/hotpath/**`, `test/application/hotpath/**`. Harness
  dims: **latency** (P95<2s, P50<900ms), **source-degradation**.

### Wave D — leaderboard mining & the growth loop (offline impl now; live flip Owner-gated)

**D1 · SOL-LEADERBOARD-001** (cold · T2, depends B1/C1/A3)
- Approach: two-path per-token profit leaderboard (methods doc Part 1.4 / §3c):
  path-B borrow (free platform board, `unverified`, lead only) and path-A
  first-hand (Helius swap FIFO/weighted-cost recompute, `confirmed`). Promote a
  wallet into the library only after path-A confirmation.
- Write set: `src/application/leaderboard/**`, `test/application/leaderboard/**`.
  Harness dims: **replay**, **label-decision**.

**D2 · SOL-DAILY-TOPTOKEN-MINING-001** (cold/growth loop · T2, depends D1/B3) — the daily/weekly auto-mining task
- Approach: implement the daily/weekly growth loop (blueprint 九 / architecture §
  daily loop): (1) fetch the **top-traded tokens** for a window (daily & weekly)
  from the free borrow layer (GMGN/Dexscreener/Birdeye top lists, via C1 → parser
  → observations); (2) for each token pull Top Buyers/Sellers/Early Buyers/profit
  leaderboard (D1 path-B for speed); (3) run detectors + Alpha Score over the
  addresses; (4) for wallets crossing the promotion bar, run D1 path-A first-hand
  confirmation; (5) sediment confirmed conclusions into the address library (B3);
  (6) emit a run report (tokens scanned, wallets mined, new smart-money/cluster/
  bot labels, quota consumed).
  - Determinism/quota: the whole pipeline is buildable+testable **offline on
    fixtures** (a fixed top-token list + fixture provider responses); the **live
    trigger and real top-list fetch are Owner-gated (D-F)** and throttled against
    the Helius free 1M ceiling (path-A recompute is the quota hog → queue, cap
    per run, cache `token_analyses`).
  - Windows: daily and weekly top-N are parameters; default manual trigger until
    Owner enables scheduling.
- Write set: `src/application/growth-loop/**`, `test/application/growth-loop/**`.
  Harness dims: **replay** (fixture top-list reproduces the same mined labels),
  **label-decision**, **source-degradation** (a provider down → partial scan +
  warnings, never fake). Acceptance also asserts a **quota-budget guard** (the run
  refuses to exceed a configured path-A recompute budget and reports what it
  skipped — no silent truncation).
- Accept when: offline replay reproduces mined labels deterministically; every
  mined label carries source/confidence/rule_version/reversible evidence and
  borrowed leads stay `unverified` until path-A confirms; quota guard + skip
  reporting present; live fetch stays behind the Owner gate.

### Wave E — go-live flips (Owner-gated, one per provider)
Each flips a fixture adapter to real network + credentials behind the content-scan
and the SEC gate. Separate tasks: `SOL-HELIUS-LIVE-001`, `SOL-FREE-PROVIDERS-LIVE-001`,
`SOL-E2E-001` (authorized live CA). These stay PARK until Owner items 1–4 open.

---

## 3. Recommended dispatch order & concurrency

- **Now (parallel, non-overlapping):** A1, A2 can run concurrently (different write
  sets). A3 then A4 (A4 depends A3). B1, B2 can run alongside A-wave (different
  subtrees). Serialize the actual harness *runs* even when tasks are concurrent.
- **After A1:** B3. **After B1+C1+A3+A4:** C2. **After D1:** D2. **After each
  milestone GREEN:** its independent audit before anything downstream starts.
- Everything in Waves B–D is offline/fixture in-stage; the Wave-E live flips wait
  on Owner gates.

## 4. Handoff — how to pick up a task (每个 agent 入口)

1. Read the required-reading chain + this file.
2. Take the ONE `harness/tasks/<task_id>.json` you were dispatched. Obey its
   `write_set`, `forbidden_actions`, `dependencies`, `acceptance_commands`.
3. `git status` must be clean before `run start`. Set a unique `HARNESS_AGENT_ID`.
4. Implement inside the write set only. Add the harness-dim suites the task lists.
5. `run start <spec> <run_id>` → implement → `run verify` (all PASSED, out_of_scope
   empty) → `run finish GREEN "<reason>"`.
6. Flip the ledger/spec to DONE (coordinator step) and hand to an independent
   auditor (different identity). On FAIL, open the repair chain.
7. Never touch live network/credentials in-stage; never commit secrets; keep runs
   serialized. When unsure, PARK — do not guess or substitute a source.

## 5. Status snapshot (2026-07-27)
- Done: CA orchestration (+repair +audits), wallet-cleaning (+funder-tag repair),
  holder-exclusion alignment, market observation, **harness governance repair**
  (audit-evidence gate now truly enforces). All under independent audit.
- Dispatchable now: Wave A (A1, A2, A3→A4), Wave B (B1, B2). Specs for A1/A2/D2
  are materialized in `harness/tasks/`; remaining specs are authored by the
  coordinator as each wave opens (this file is the authoring brief).
- Owner-gated: all live flips (Wave E) + the D2 live trigger.
