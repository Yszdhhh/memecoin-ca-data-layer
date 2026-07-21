# MACRO-DAILY-DESIGN-AUDIT-001 — Independent audit of daily global and chain macro contract

## Header

| Field | Value |
| --- | --- |
| `task_id` | `MACRO-DAILY-DESIGN-AUDIT-001` |
| `tier` | `T2` |
| `role` | `auditor` |
| `agent` / `model` | Claude Opus 4.6 (Thinking) |
| `report_utc` | `2026-07-20T16:08:00Z` |
| `write_set` | `docs/audits/MACRO-DAILY-DESIGN-AUDIT-001.md` only |
| `verdict` | **GREEN_WITH_ADVISORY** |

---

## Preflight

### Task spec validation

| Check | Result |
| --- | --- |
| Spec path | `harness/tasks/MACRO-DAILY-DESIGN-AUDIT-001.json` — present |
| `task_id` | `MACRO-DAILY-DESIGN-AUDIT-001` — matches dispatch |
| `tier` | `T2` — matches dispatch |
| `role` | `auditor` — matches dispatch |
| `status` | `READY` |
| `dependencies` | `["MACRO-DAILY-DESIGN-001"]` — dependency task status `DONE` in `harness/tasks/MACRO-DAILY-DESIGN-001.json:8` |
| `write_set` | `["docs/audits/MACRO-DAILY-DESIGN-AUDIT-001.md"]` — matches only deliverable allowed by dispatch |
| Stage lock | `harness/config/project.json:4–6`: `active_stage=solana-pumpfun-e2e`, `active_chains=["solana"]`, `blocked_chains=["bsc","robinhood"]` |
| Forbidden actions | No source, migration, test, task spec, ledger, provider config, credential, or schedule modification. No BSC/Robinhood CA activation. No unresearched Dune assumption. |

### Inputs read

| Input | Path | Status |
| --- | --- | --- |
| Constitution | `PROJECT_CONSTITUTION.md` | Read L1–45 |
| Playbook | `PROJECT_OPERATING_PLAYBOOK.md` | Read L1–88 |
| Known Limitations | `KNOWN_LIMITATIONS.md` | Read L1–13 |
| Owner Decisions | `OWNER_DECISIONS_NEEDED.md` | Read L1–14 |
| Project config | `harness/config/project.json` | Read L1–28 |
| Design task spec | `harness/tasks/MACRO-DAILY-DESIGN-001.json` | Read L1–39; status=DONE |
| Dune research task spec | `harness/tasks/MACRO-DUNE-RESEARCH-001.json` | Read L1–36; status=DONE |
| Macro design | `docs/designs/DAILY-MARKET-MACRO-DESIGN-001.md` | Read L1–218 |
| Dune research | `docs/research/MACRO-DUNE-RESEARCH-001.md` | Read L1–470 |
| SOL market data design | `docs/designs/SOL-MARKET-DATA-DESIGN-001.md` | Read L1–232 |

### Workspace state

| Check | Result |
| --- | --- |
| `git status` | Modified tracked: 4 harness/tasks JSON, 1 ledger, 1 research, 1 CURRENT_WAVE. Untracked: various audit reports, designs, research, test fixtures, SQL files. No file `docs/audits/MACRO-DAILY-DESIGN-AUDIT-001.md` exists — no overwrite risk. |
| `git diff --check` | PASS (warnings only: LF→CRLF in 7 tracked files, no trailing whitespace or conflict markers) |

**Preflight: PASS.**

---

## Audit Item 1 — Global macro layer vs per-chain battle reports: strict separation

**Requirement:** The global crypto attention layer and Solana/BSC/Robinhood battle reports must be structurally separated. No uninterpretable cross-chain trading score.

### Evidence

| Location | Finding |
| --- | --- |
| Design L1–16 | Scope declares two separate layers: (1) global crypto attention, (2) three independent battle reports. Explicit: "They share provenance rules but do not need identical indicators or thresholds." |
| Design L37–53 | Global Attention Layer table: metrics are per-asset/per-chain, not a synthetic index. L39: "must report values separately by asset or chain rather than making a synthetic index from incomparable sources." |
| Design L55–97 | Per-chain battle reports each have dedicated subsections (Solana, BSC, Robinhood) with independent metric tables. |
| Design L186–190 | Brief Shape: chains are independent. L188–190: "It must not say that a chain is objectively better using an unversioned cross-chain score, or make a trading recommendation." |
| Design L48 | Market regime history: "Each metric is normalized against its own history. Do not average percentiles into an unversioned score." |
| Output contracts L139–175 | `macro_daily_global_metrics` and `macro_daily_chain_metrics` are separate schemas with separate `chain` scoping. |
| Research L129 | "Do not invent a synthetic global index from incomparable sources (design constraint)." |

**Verdict: PASS.** Separation is structurally enforced in schemas, narrative rules, and brief shape. No cross-chain composite score found.

---

## Audit Item 2 — No activation of BSC/Robinhood CA adapters, production collection, webhooks, backfills, credentials, Dune paid execution, Feishu push, or trading

### Evidence

| Location | Finding |
| --- | --- |
| Design L17–20 | "This design activates cross-chain macro **definitions** only. It does not activate BSC or Robinhood CA adapters, production collectors, credentials, webhooks, backfills, or the chain-specific E2E stage." |
| Design L174–175 | Output contracts: "These are contracts only. No migration or collector is authorized by this document." |
| Design L210–217 | Owner and Audit Gates: "Provider credentials, paid plans, payload retention, database deployment, backfill, schedules and Feishu delivery are separate Owner-gated tasks." L216–217: "BSC and Robinhood CA adapter activation remains blocked." |
| Research L22 | Forbidden actions: "no paid Dune execute; no dashboard/repo/SQL/task/DB mutation; no BSC/Robinhood CA authorization." |
| Research L37–42 | Access boundary: Dune CLI/API not used. No credential read/print/store. Paid query intentionally skipped. |
| Research L449–457 | No-network-credential confirmation: did not call Dune API/CLI, did not print/store keys, DUNE_API_KEY never accessed. |
| Design task spec L26–29 | Forbidden actions include all listed items. |
| Audit task spec L25–28 | Confirms forbidden actions. |
| `project.json:6` | `blocked_chains: ["bsc","robinhood"]` |
| `OWNER_DECISIONS_NEEDED.md:6–7` | BSC/Robinhood activation are Owner gates. |

**No Feishu delivery, trading capability, or execution gate language found in any audited document.**

**Verdict: PASS.**

---

## Audit Item 3 — Dune research verified metrics limited to: daily DEX volume, active traders, declared DEX registry, Solana Pump create/external pool path, BSC Pancake pool path, UTC hour profile

### Evidence

| Location | Finding |
| --- | --- |
| Research §3.1 L137–162 | Solana capital: DEX volume, active traders, project universe (registry list verified in SQL), bot-labelled volume. All "VERIFIED schema." |
| Research §3.2 L166–175 | Supply: Pump launch (create), PumpSwap pool create (external pool path), first external listing (constructible). Migrate event NOT verified (L171: "UNVERIFIED on Dune for migrate event table"). |
| Research §4.1 L196–203 | BSC: DEX volume/traders VERIFIED. Pancake pool create + LP events VERIFIED. |
| Research §4.2 L207–211 | Four.meme: "No path in recursive tree search … PARK for official spell." |
| Research §5.1 L230–243 | Robinhood: Uniswap v2/v3/v4 only. `partial_coverage` required. |
| Research §6 L285–301 | Historical active time: UTC hour of `block_time` per chain. Store UTC, render Shanghai as view. |
| Research §2.1 L103–116 | Global: stablecoin supply → PARK, bridge net flow → PARK, global pool TVL → PARK. Market cap → PARK for on-chain. |
| Research §3.3 L179–184 | Survival valuations (drawdown, 24H avg/peak/residual): all PARK. Market cap UNVERIFIED. |

**Verified metrics are correctly scoped to: daily DEX volume, active traders, declared DEX registry snapshots, Pump create + external pool creation paths, Pancake pool/LP paths, and UTC hour profiles. No other metrics have been promoted to VERIFIED.**

**Verdict: PASS.**

---

## Audit Item 4 — PARK/UNVERIFIED items not miswritten as implementable facts

### 4a. Stablecoin supply

| Location | Status |
| --- | --- |
| Research L109 | "No Spellbook model named global stablecoin supply found … **PARK**" |
| Research L110 | `labels_stablecoins` is "VERIFIED as label registry only" — not supply. |
| Design L46 | Listed under Global Attention with "stablecoin liquidity" but L50–53: "Global asset price, market-cap, derivatives and stablecoin datasets are **UNVERIFIED** until MACRO-DUNE-RESEARCH-001 establishes exact Dune source coverage." |
| Research §8 item 3 | "No verified global stablecoin supply." |

**Verdict: PASS.** Stablecoin supply remains PARK. Design does not present it as implementable.

### 4b. Global bridge net flow

| Location | Status |
| --- | --- |
| Research L111 | `bridge.flows` tagged `prod_exclude`, only Hop + Optimism native. "PARK for global macro." |
| Research §8 item 3 | "No verified … production-ready bridge net flow." |
| Design L46 | Listed as a field under stablecoin liquidity, but gated by the UNVERIFIED clause at L50–53. |

**Verdict: PASS.** Bridge flow remains PARK.

### 4c. Global TVL

| Location | Status |
| --- | --- |
| Research L114 | "UNVERIFIED as global TVL; VERIFIED partial project paths." |
| Research §8 item 3 | Implicit. |
| Research §10 L419 | "PARK global TVL." |

**Verdict: PASS.** Global TVL is PARK.

### 4d. Four.meme launch data

| Location | Status |
| --- | --- |
| Research L208–211 | "No path in recursive tree search … **PARK** for official spell." |
| Research §4.4 L222 | "Four.meme supply metrics are PARK." |
| Design L75 | BSC Supply lists "Four.meme-style launches" — but this is a contract field definition; the design does not claim it is verified. |
| Research §10 L420 | "Launches: … BSC: PARK Four.meme." |

**P1 ADVISORY:** Design L75 uses the phrase "Four.meme-style launches" without an inline `UNVERIFIED` or `PARK` qualifier at the point of use in the BSC battle report table. While the research clearly marks it PARK, and the design's §"Required Dune Research Before SQL Implementation" (L192–208) gates all unresearched metrics, a reader scanning only the BSC table might not immediately notice the gate. This is a presentation risk, not a factual error.

**Verdict: PASS with P1 advisory.**

### 4e. Robinhood all-chain coverage

| Location | Status |
| --- | --- |
| Design L94–96 | "Robinhood metrics must never claim all-chain coverage … partial_coverage is a normal report state, not an error to hide." |
| Research L238 | "Full-chain all-DEX claim: **False** … **partial_coverage required.**" |
| Research §5.3 L277 | "All-chain Robinhood claim: **Forbidden** without expanded registry." |

**Verdict: PASS.**

### 4f. Community Dune dashboard SQL / Query ID

| Location | Status |
| --- | --- |
| Research §1.1 L50–60 | All dashboards: "UNVERIFIED" — no Query ID or SQL body obtained. |
| Research §7 Card F L371–373 | Query IDs 7986129 etc. SQL body "Not retrieved (403)". Conclusion: "UNVERIFIED." |
| Research §7 Card G L379–380 | Community dashboards: "UNVERIFIED — do not implement collectors from chart titles." |
| Research §8 item 6 | "Community Query IDs in repo are references only until SQL hash + execution watermark stored." |

**Verdict: PASS.** Community queries remain UNVERIFIED.

### 4g. Market Cap vs FDV mixing

| Location | Status |
| --- | --- |
| Design L114–117 | "market_cap and FDV must remain separate. When circulating supply is not verified, report fdv with valuation_basis=fdv; do not rename it market cap." |
| Research L184 | "market_cap = UNVERIFIED; if total supply × price used, label valuation_basis=fdv. Never rename FDV to market cap." |
| Research §10 L424 | "market_cap vs FDV: FDV only unless supply verified." |
| SOL-MARKET-DATA-DESIGN L64 | `price_usd`, `fdv_usd`, `market_cap_usd` are separate nullable fields. L128: "FDV and market cap remain source-labelled. Do not average them." |

**Verdict: PASS.** Strict separation enforced.

### 4h. Drawdown 50%/90%, 24H valuation SQL as production-grade

| Location | Status |
| --- | --- |
| Research L182–183 | Time to −50%/−90%: "PARK until valuation series SQL pinned and executed." 24H avg/peak/residual: "PARK until pinned." |
| Research §10 L423 | "Drawdown / residual valuation: PARK" for all chains. |
| Design L67 | Lists "time to 50% and 90% drawdown" and "24H residual valuation" as contract fields, but these are contract-level definitions, not claims of verified implementation. |
| Design L107–108 | Defines semantics: "first verified interval where valuation is at or below 50%/10% of listing baseline." |

**P2 note:** Design L108 says "at or below 10% of listing baseline" for the 90% drawdown metric. This is semantically correct (a 90% drawdown = 10% remaining value) but could be misread. This is a notation style choice, not an error; the label `time_to_90pct_drawdown` unambiguously names the drawdown percentage.

**Verdict: PASS.** Drawdown/valuation metrics remain PARK, not promoted to production SQL.

---

## Audit Item 5 — Robinhood scoped to Uniswap v2/v3/v4 registry with forced `partial_coverage`

### Evidence

| Location | Finding |
| --- | --- |
| Research L232–233 | "DEX projects in sector model: **Uniswap only**: v2, v3, v4" |
| Research L238 | "Full-chain all-DEX claim: **False** … **partial_coverage required**" |
| Research L240–243 | Always emit `coverage_status=partial_coverage`, `registry_version=spellbook:dex_robinhood:uniswap_v2_v3_v4@<git_sha_pin>`, missing-source warnings. |
| Design L84–96 | Robinhood section requires: Coverage section with "registry version, DEX/project inclusion list, missing-source warnings and coverage status." L94–96: "must never claim all-chain coverage … partial_coverage is a normal report state." |
| Design L152–155 | `macro_daily_chain_metrics` schema includes `registry_version` and `coverage_status` fields. |

**Verdict: PASS.**

---

## Audit Item 6 — Cohort semantics correctness

### 6a. First external listing

| Location | Finding |
| --- | --- |
| Design L105 | `first_external_listing_time`: "first verified DEX pool or trade outside the launchpad/bonding-curve venue." |
| Research L172 | "First external listing: First dex_solana.trades row for mint where project ∉ bonding-curve venue, or first Raydium/PumpSwap pool." VERIFIED as constructible; exact inclusion list must be versioned. |

**Verdict: PASS.**

### 6b. Valuation basis

| Location | Finding |
| --- | --- |
| Design L106 | `listing_baseline`: "price and verified supply at first external listing; valuation basis is stored with the metric." |
| Design L114–117 | `market_cap` and `FDV` separated. When circulating supply not verified → `fdv` with `valuation_basis=fdv`. |
| Design L116–117 | Per-cohort metric: store `pair_address`, `valuation_basis`, source class, interval, source timestamp, completeness. |

**Verdict: PASS.**

### 6c. 24H boundary

| Location | Finding |
| --- | --- |
| Design L109 | `avg_valuation_24h`: "token-level average over the first 24 hours after listing, with interval and basis recorded." |
| Design L111 | `residual_valuation_24h`: "latest verified valuation at the 24-hour boundary; never silently use a later value." |

**Verdict: PASS.** 24H boundary is anchored to listing time, not calendar day.

### 6d. Right censoring

| Location | Finding |
| --- | --- |
| Design L119–122 | "Tokens that have not reached a drawdown threshold by the observation cutoff are right-censored. Daily reports show both the reach rate within a declared horizon and the median time among reached tokens. They must not treat censored tokens as having reached the threshold at the report cutoff." |
| Design L162–164 | `macro_listing_cohort_metrics` schema includes `reached_50pct` and `reached_90pct` boolean fields — correctly distinguishing reached vs censored. |

**Verdict: PASS.** Right censoring is explicitly handled.

### 6e. Time granularity

| Location | Finding |
| --- | --- |
| Design L30–33 | "runs once per day … must not collapse a time-to-event metric into a daily close; cohort calculations use the finest verified historical interval available and state that interval." |
| Design L163 | `interval_seconds` field in cohort output. |
| Research L299 | Recommendation: "Exclude CURRENT_DATE for closed daily profiles." |

**Verdict: PASS.**

### 6f. FDV / Market Cap separation

Already verified in Item 4g above. **PASS.**

---

## Audit Item 7 — Data quality traceability: query_ref, version/SQL hash, source_as_of, completeness, coverage_status, warnings

### Evidence

| Schema | Fields present | Location |
| --- | --- | --- |
| `macro_daily_global_metrics` | `source`, `query_ref`, `query_version`, `source_as_of`, `computed_at`, `completeness`, `warnings` | Design L143–147 |
| `macro_daily_chain_metrics` | `source`, `query_ref`, `source_as_of`, `computed_at`, `completeness`, `warnings`, `registry_version`, `coverage_status` | Design L149–155 |
| `macro_listing_cohort_metrics` | `source`, `source_as_of`, `completeness`, `warnings` | Design L159–165 |
| `macro_hourly_chain_profile` | `source`, `query_ref`, `completeness`, `computed_at` | Design L168–172 |

**P1 ADVISORY:** `macro_listing_cohort_metrics` (Design L159–165) does not include a `query_ref` or `query_version` field. If a cohort metric is derived from a versioned Dune query, the provenance chain from observation → cohort aggregation should include a reference to the query identity. This is an omission in the schema contract.

**P2 NOTE:** `macro_hourly_chain_profile` (Design L168–172) includes `query_ref` but not `query_version`. If version-pinning is required (as the design states for Dune trust class B at L15–16), the schema should include `query_version` or equivalent hash.

**Verdict: PASS with advisories.** Core traceability fields are present in all schemas. Two schemas have minor field gaps.

---

## Audit Item 8 — No trading advice or execution threshold language

### Evidence

| Location | Finding |
| --- | --- |
| Design L13–14 | "The brief is descriptive. It ranks observation priority for a human scan; it does not authorize trading, execution, or a hard allow/deny gate." |
| Design L186–190 | "The brief may say a chain deserves more human scanning … It must not say that a chain is objectively better using an unversioned cross-chain score, or make a trading recommendation." |
| Design task spec L29 | Forbidden: "Do not define a market indicator as a trading recommendation or execution gate." |
| Design L47 | Risk breadth: "A descriptive breadth signal, not a directional asset call." |
| Design L44 | "Do not equate transfer volume with buying pressure." |
| Constitution L7 | "This repository does not implement … trading, signing, or order execution." |

**Full text scan:** No occurrence of "trade signal", "buy", "sell recommendation", "execute", "threshold gate", or equivalent directive language found in the design. All language is descriptive/observational.

**Verdict: PASS.**

---

## Audit Item 9 — Workspace state: audit does not overwrite uncommitted files

### Evidence

| Check | Result |
| --- | --- |
| `git status --porcelain` | No file `docs/audits/MACRO-DAILY-DESIGN-AUDIT-001.md` exists (tracked or untracked). |
| Modified tracked files | None in `docs/audits/` directory. |
| Write set | This audit writes only `docs/audits/MACRO-DAILY-DESIGN-AUDIT-001.md`. |

**Verdict: PASS.** No overwrite risk.

---

## Command Results

| Command | Exit code | Output summary |
| --- | --- | --- |
| `npm run harness:task -- validate harness/tasks/MACRO-DAILY-DESIGN-AUDIT-001.json` | 0 | `{"task_id":"MACRO-DAILY-DESIGN-AUDIT-001","status":"GREEN","errors":[]}` |
| `npm run typecheck` | 0 | Clean |
| `npm test` | 0 | 30/30 pass, 0 fail |
| `npm run build` | 0 | Clean |
| `git diff --check` | 0 | Warnings only (LF→CRLF in 7 tracked files, no errors) |

---

## Findings Summary

### P0 — None

No blocking issues found.

### P1 — Advisories (non-blocking)

| ID | Item | Location | Description |
| --- | --- | --- | --- |
| P1-1 | Four.meme inline qualifier | Design L75 | BSC Supply table lists "Four.meme-style launches" without inline PARK/UNVERIFIED marker. Research clearly marks it PARK (Research L208–211, L222, L420), and the design's §"Required Dune Research Before SQL Implementation" gates implementation, but inline annotation would improve scan-readability. |
| P1-2 | `macro_listing_cohort_metrics` missing `query_ref` | Design L159–165 | Cohort schema lacks `query_ref` / `query_version`. If cohort values are derived from versioned queries, provenance should be traceable in the schema. |

### P2 — Notes (informational)

| ID | Item | Location | Description |
| --- | --- | --- | --- |
| P2-1 | `macro_hourly_chain_profile` missing `query_version` | Design L168–172 | Has `query_ref` but not `query_version`. Design L15–16 requires "query version or hash" for trust class B. |
| P2-2 | 90% drawdown notation | Design L108 | "at or below 10% of listing baseline" — semantically correct for 90% drawdown but could be clarified with "i.e. a 90% loss." The field name is unambiguous. |

---

## Scope and Write-Set Check

| Check | Result |
| --- | --- |
| Files written | `docs/audits/MACRO-DAILY-DESIGN-AUDIT-001.md` — matches write_set exactly |
| Source code modified | None |
| Migrations modified | None |
| Tests modified | None |
| Task specs modified | None |
| Ledger modified | None |
| Provider configuration modified | None |
| Credentials accessed | None |
| Schedules modified | None |
| BSC/Robinhood CA activated | No |
| Dune paid query executed | No |
| Feishu delivery activated | No |
| Trading capability introduced | No |

---

## Pending Items

| ID | Item | Owner |
| --- | --- | --- |
| U-1 | Resolve P1-1: add inline `(PARK)` qualifier to Four.meme row in BSC Supply table (Design L75) | MACRO-DAILY-DESIGN-001 author |
| U-2 | Resolve P1-2: add `query_ref` / `query_version` to `macro_listing_cohort_metrics` schema | MACRO-DAILY-DESIGN-001 author |
| U-3 | Consider P2-1: add `query_version` to `macro_hourly_chain_profile` | MACRO-DAILY-DESIGN-001 author |
| U-4 | Dune research open items O1–O8 (Research L400–409) remain for follow-on tasks | Various — see research |

---

## Verdict

**GREEN_WITH_ADVISORY**

The daily global macro design contract (`DAILY-MARKET-MACRO-DESIGN-001.md`) correctly:

1. Separates the global attention layer from per-chain battle reports with no cross-chain composite score.
2. Does not activate BSC/Robinhood CA adapters, production collection, webhooks, backfills, credentials, Dune paid execution, Feishu delivery, or trading capabilities.
3. Scopes verified Dune metrics to daily DEX volume, active traders, declared DEX registries, Solana Pump create/external pool paths, BSC Pancake pool paths, and UTC hour profiles.
4. Preserves PARK/UNVERIFIED status for stablecoin supply, bridge net flow, global TVL, Four.meme launch data, community Query IDs, and drawdown/valuation production SQL.
5. Constrains Robinhood to Uniswap v2/v3/v4 registry with mandatory `partial_coverage`.
6. Defines cohort semantics with correct first-external-listing, valuation basis, 24H boundary, right censoring, time granularity, and FDV/Market Cap separation.
7. Includes data quality traceability fields (`query_ref`, `source_as_of`, `completeness`, `coverage_status`, `warnings`) in output schemas.
8. Uses only descriptive/observational language, never trading advice or execution thresholds.

Two P1 advisories (Four.meme inline annotation, cohort schema `query_ref` gap) and two P2 notes are documented for author follow-up. None are blocking.

The Dune research (`MACRO-DUNE-RESEARCH-001.md`) and SOL market data design (`SOL-MARKET-DATA-DESIGN-001.md`) are consistent with the macro design and governance documents.

All acceptance commands pass. No workspace overwrite occurred.
