# Independent Audit — SOL-WALLET-CANDIDATE-SCREENING-V0-1-001-AUDIT-001

## Identity

| Field | Value |
| --- | --- |
| Audit task | `SOL-WALLET-CANDIDATE-SCREENING-V0-1-001-AUDIT-001` |
| Feature branch | `feat/sol-wallet-candidate-screening-v0-1` |
| Feature commit (baseline) | `8ff01bd2f2f415012bba503426e835d038415bad` |
| Feature PR | https://github.com/Yszdhhh/memecoin-ca-data-layer/pull/10 |
| Audit branch | `audit/sol-wallet-candidate-screening-v0-1-001` |
| Auditor role | Independent zero-network re-run + code review |
| Worktree at audit start | Clean at feature commit `8ff01bd` |

This report was produced by re-executing gates and the real offline pipeline into a **separate** output directory, then comparing hashes and reviewing source logic. It does **not** copy Implementer acceptance text as evidence.

---

## Verdict

# **YELLOW**

**PR #10 must NOT be merged** until P0/P1 blockers below are closed (or explicitly Owner-waived with a repair task). Only **GREEN** permits merge.

---

## Commands re-executed (auditor)

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS (exit 0) |
| `npm test` | PASS — 435 pass / 1 skip / 0 fail |
| `npm run build` | PASS (exit 0) |
| `npm run security:scan` | PASS — `classifiedLeaks: 0` |
| `git diff --check` | PASS (clean) |
| `npm run wallet:screening:v0-1` | PASS — wrote `wallet_intelligence_v0_1_audit_rerun` |

Environment for real run (local only):

- `SOL_INPUT_DIR=C:\Users\10639\chainfm_out\sol`
- `SOL_GMGN_OUTPUT_DIR=...\gmgn-wallet-stats-full-1433-live-rerun-002`
- `SOL_SCREENING_OUTPUT_DIR=...\wallet_intelligence_v0_1_audit_rerun`

---

## Independent hash / count verification

| Check | Auditor result | Match implementer claim |
| --- | --- | --- |
| sol_addresses.txt SHA-256 | `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C` | YES |
| sol_address_labels.json SHA-256 | `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3` | YES |
| GMGN profiles SHA-256 | `F461061BB7B747D512DF2193D46E0DE02DEA50A86C661E9F8234B6E8F8737EE6` | YES |
| GMGN summary SHA-256 | `55DFAB261C1BEADBDD2E16574BB569DC69076463A97A46360F041EDC1024263D` | YES |
| Address set hash (ordered unique + trailing newline) | `A6FF9CCCC5384CA2AABBA9AC904A101BDF8585B7D2F847CFC104FF6438F07049` | YES |
| Master rows / unique addresses | 1433 / 1433 | YES |
| Unique candidates | 32 | YES |
| Research packs (JSON+MD) | 15 + 15 | YES |
| Master SHA-256 (audit rerun) | `D21D6D768D53E2C50234DB21F92CB6C2EC3BDDBA4A96450224B59D32DE05B027` | Identical to implementer private master |
| Candidate set + screening_rank map | Bit-identical vs implementer private union | YES (reproducible) |
| `alpha_score` / `final_wallet_score` / `final_wallet_grade` | Always null | PASS |
| `confirmed_label` / `confirmed_behavior_labels` | Always null | PASS |
| `source_type` / `verification_status` | `borrowed` / `unverified` on all rows | PASS |
| `provider_attested_period` | `{7d:null,30d:null}` | PASS |
| `data_confidence` | all `low` (1433) under period_unverified | PASS (consistent with confidence_cap) |
| Private paths in feature commit tree | No `wallet_master_v0_1*`, no `candidate_union_v0_1*`, no `research_packs/`, no `chainfm_out/` | PASS |
| Artifacts under Git | Desensitized only; sample address not present | PASS |

### Data tier / DQ (audit rerun)

| Dimension | Distribution |
| --- | --- |
| data_tier | TIER_PARTIAL 1349, TIER_SPARSE 84, TIER_COMPLETE 0, TIER_MISSING 0 |
| data_quality_tier | DQ-C 1433 |
| gmgn_lead_score non-null | 1352 |

### Research pack category coverage (membership counts)

| Category | Packs including category |
| --- | ---: |
| A_ACTIVE_HIGH_PROFIT_LEAD | 6 |
| B_HIGH_WINRATE_ADEQUATE_SAMPLE | 5 |
| C_LOW_WINRATE_HIGH_PROFIT_LEAD | 4 |
| D_RECENT_OUTPERFORMANCE | 2 |
| E_HISTORICAL_STRONG_RECENT_DECAY | 4 |
| F_HIGH_FREQ_OR_ANOMALY_SUSPICIOUS | 3 |
| G_LABEL_STAT_CONFLICT | 1 |
| H_INSUFFICIENT_DATA_HIGH_INTEL | 1 |

**A–H all represented** in the 15-pack set (YES). Coverage is uneven (G/H only 1 pack each).

---

## Focused risk review (required)

### 1) `targetCandidateMin=30` artificial inflation — **P1**

**Code:** `while (unionMap.size < targetCandidateMin)` fills from group pools until ≥30; does not invent addresses.

**Evidence:** Unique fingerprints across A–H group pools = **59**. Union size 32 is a subset, not fabricated rows.

**Finding:** Count is **target-driven selection**, not metric fabrication. However:

- If natural pool were &lt;30, code **stops early without fail-closed** (`if (!added) break`) — would report SUCCESS with e.g. 12 candidates while docs claim 30–50.
- No test asserts fail or WARN when below min.

**Severity:** P1 process/semantics (acceptance band can be silently missed).

### 2) `screening_rank` multi-category priority vs value rank — **P1**

**Code sort:** (1) more `candidate_categories` first, (2) then `gmgn_lead_score`, (3) fingerprint.

**Evidence:** ranks 1–11 are multi-category (n=2); ranks 12–32 are single-category.

**Finding:** Rank is a **research-diversity ordering**, not trading value. UI/docs string says “screening-only”, but field name `screening_rank` without explicit `diversity_priority` is easy to misread as “best wallets”.

**Severity:** P1 product semantics / misuse risk (not a hash bug).

### 3) Research packs cover A–H — **PASS with note**

All eight categories appear in at least one pack. G and H are under-sampled (1 each). Acceptable for v0.1 but thin for “cover different candidate types” spirit.

### 4) D/E and period_unverified wording — **P2**

- Packs / `what_is_not_known` state period attestation missing; auditor found **0** “confirmed window” claims in D/E pack text.
- Category reason codes (`SEVEN_D_GT_2X_THIRTY_D_WEEKLY_AVG`, `STRONG_30D_PROFIT`) do **not** embed `PERIOD_UNVERIFIED` themselves (lead reasons may separately include it).

**Severity:** P2 documentation/reason-code completeness, not false confirmation of windows.

### 5) B reason `NOT_SINGLE_FIELD_ANOMALY_ONLY` — **P1 (confirmed false stamp)**

**Code:** Always appended for every B selectee; **no filter** excludes multi-anomaly or zero-income outliers.

**Evidence (audit rerun, fingerprints only):**

- `f785e19d074a…` in B pool with flags including `ZERO_INCOME_HIGH_PROFIT_30D`, `EXTREME_PROFIT_OUTLIER`, `EXTREME_TOKEN_NUM`, `EXTREME_BUY_ONLY_RATIO` **and still** reason `NOT_SINGLE_FIELD_ANOMALY_ONLY`.
- `dd678722d319…` with `EXTREME_BUY_ONLY_RATIO` + same false reason.
- 2/10 B pool members have extreme/zero-income flags; **all 10** carry the reason.

**Severity:** P1 — reason codes are not fully evidence-backed (violates “每个候选都有可复算 reason code” spirit).

### 6) G/H label keyword breadth — **P1**

`labelKeywords.smartMoney` matches: `聪明|smart money|高手|kol|alpha|top\d*|rank\d*`.

**Evidence:** All 8 G pool members stamped `CLAIM_SMART_MONEY_UNVERIFIED`. `top*` / `rank*` will fire on common ranking labels (e.g. TopNNN / RankNNN), not only “聪明钱” claims.

`sniper` includes `内盘` — conflates board-segment slang with sniper identity (**P2**).

H uses same smartMoney OR `labels.length >= 3` — label count alone is weak “intel” (**P2**).

### 7) F entering “core high-value” queue — **PASS this run / residual P2**

- No F∩A or F∩B in union.
- No F with `CHAIN_VERIFICATION`.
- F multi-cat with E/D got `EXCLUDE_FROM_FOLLOWING` when extreme flags present.
- F eligibility includes ubiquitous `ACCOUNTING_RESIDUAL_*` (all 8 F members) — residual alone is low-signal; severity diluted by ranking on extreme trade frequency (**P2** design softness).

### 8) Win rate unit 0–100 vs 0–1 — **P2 (empirically percent-like; not formally attested)**

Population (non-null 30d win rates): min 0, max 100, median 0; **gt1 = 376**, **(0,1] = 2** values (`1` and `0.39`).

Code treats win rate as **0–100 percent** (`Math.min(100, winRate)`). That is consistent with the bulk distribution, but:

- No provider schema assertion in this task;
- Values `0.39` / `1` are ambiguous (percent vs fraction);
- No unit-anomaly test.

**Severity:** P2 residual unit risk on edge rows; bulk path OK.

### 9) Reason codes vs actual conditions — **P1 partial fail**

| Code | Supported by condition? |
| --- | --- |
| Most A–H selection codes | YES (filters match) |
| `NOT_SINGLE_FIELD_ANOMALY_ONLY` (B) | **NO** — unconditional stamp |
| `NOT_CONFIRMED_GOLDEN_DOG_HUNTER` (C) | YES as disclaimer label |
| `PERIOD_UNVERIFIED_CONFIDENCE_CAPPED` (lead) | YES when warning present |
| G `CLAIM_SMART_MONEY_*` | Condition exists but keyword over-fire |

### 10) `recommended_next_action` multi-category priority — **P1**

Priority order: F+EXTREME/ZERO_INCOME → EXCLUDE; else H → INSUFFICIENT_DATA; else E → DORMANT_MONITOR; else G → GMGN_HISTORY_REVIEW; else A/B/C → CHAIN_VERIFICATION.

**Evidence:** `C + E` → `DORMANT_MONITOR` (E overrides C’s chain-verify research path). Correct as coded, but can bury active asymmetric-payoff leads under dormant routing.

No unit test for multi-cat action matrix.

---

## Test coverage vs required matrix

| Required area | Present? |
| --- | --- |
| A–H per-category boundary tests | **NO** (only synthetic full-pipeline smoke) |
| period_unverified degradation (scores retained, DQ capped) | **YES** (partial) |
| B anomaly / false reason | **NO** |
| Multi-category next_action | **NO** |
| Candidates &lt; 30 fail/warn | **NO** |
| Win rate unit anomaly | **NO** |
| Null vs real 0 | **Partial** (score null path; not field-level master export) |
| Status derivation when provider omits status | **YES** |

**Severity:** P1 test gaps for a cold-path screening gate.

---

## Structured audit dimensions

### Harness 遵循

**Mostly PASS.** Offline-only, budget 0 network, harness task + dispatch + desensitized report present. Stage locks (BSC/Robinhood) not violated. Independent audit re-ran real pipeline offline.

Gap: no harness doctor registration of audit task in ledger (optional). Acceptance band 30–50 not fail-closed in code.

### 代码简洁度

**PASS with note.** Single pipeline module (~1.5k lines) is long but mostly linear; no new frameworks/DB/UI. Some duplication with master-table-builder (parse paths). Karpathy-adjacent: acceptable for one-shot cold path; could extract category rules later.

### 代码架构

**PASS for layer.** Cold path only; judgment layer (Alpha) left null. Trust split borrowed vs confirmed is structurally correct. Status derivation for RERUN-002 missing `status` field is necessary and documented via warning codes.

### 数据可信度

**YELLOW core.** period_unverified correctly caps confidence; lead scores not wiped; nulls preserved. **Undermined** by false B reason stamp and broad G keywords — evidence package can over-claim cleanliness of B and “smart money conflict”.

### 产品闭环

**Partial.** Delivers master + multi-scenario candidates + research packs for human review — correct product slice. Ranking/action semantics need clearer contracts before operators treat rank as priority value.

### 测试与可观测性

**WEAK (P1).** Smoke + a few unit checks; missing category contracts, action matrix, min-candidate fail-closed, win-rate unit. Replay manifest + quality report exist (good observability for runs).

### 安全与隐私

**PASS.** No private master/candidates/packs/GMGN raw in Git at feature commit. security:scan PASS. Local private outputs only. Auditor did not commit addresses.

### Git / 任务治理

**PASS for implementer PR shape.** Feature branch, single feature commit, PR #10 open unmerged, no squash performed. Auditor does **not** merge #10.

### 是否过度实现

**NO.** No Console/BSC/Robinhood/liquidity/Alpha grade system/live GMGN writes.

---

## P0 / P1 / P2

### P0

**None found.** No privacy leak into Git, no formal grade emission, no address set mismatch, pipeline reproduces 1433/32/15.

### P1 (block merge to GREEN)

1. **False reason code** `NOT_SINGLE_FIELD_ANOMALY_ONLY` on B without supporting filter (observed on multi-anomaly B members including `ZERO_INCOME_HIGH_PROFIT_30D`).
2. **Test gaps:** no A–H boundary tests, no multi-cat next_action tests, no &lt;30 candidate fail-closed/warn test, no B anomaly reason test.
3. **`targetCandidateMin` silent underfill:** SUCCESS even if unique candidates &lt;30; contradicts acceptance band.
4. **`screening_rank` semantics** underspecified (diversity-first); risk of operator misuse as value rank.
5. **G smartMoney keywords** (`top\d*|rank\d*|kol|alpha`) over-fire; weak conflict evidence.
6. **next_action priority** can override A/B/C research path with E/H without documenting multi-label action policy.

### P2 (deferrable after repair or Owner accept)

1. D/E reason codes omit explicit `PERIOD_UNVERIFIED` token (packs still disclose).
2. F includes residual accounting flags for all members; residual alone is weak Suspicious signal.
3. `sniper` keyword includes `内盘`.
4. H intel via label count ≥3 is thin.
5. Win-rate unit not schema-attested; 2 edge values in (0,1].
6. Research pack coverage uneven (G/H=1).
7. Pipeline file length / duplication with master-table-builder.

---

## 必须修复项（before GREEN / before merge）

1. Make B’s `NOT_SINGLE_FIELD_ANOMALY_ONLY` **conditional** (or remove); exclude or re-reason wallets with HIGH anomalies / ZERO_INCOME.
2. Fail-closed or explicit `status: DEGRADED` + acceptance FAIL when unique candidates &lt; `targetCandidateMin` or categories &lt; 6.
3. Add unit tests for: each category predicate smoke, multi-cat next_action matrix, B false-reason regression, underfill behavior, win-rate unit edge (0.39 vs 39).
4. Document or rename `screening_rank` to diversity/research priority; keep category `group_ranks` as primary for within-group ordering.
5. Tighten G smartMoney keywords (drop bare `top\d*|rank\d*` or require stronger tokens).

## 可延后项

- F residual de-weighting; sniper/内盘 split; H label-count policy; pack rebalance; module split; formal GMGN unit attestation doc.

---

## Merge decision

| Question | Answer |
| --- | --- |
| **Allow merge PR #10?** | **NO** |
| Required verdict for merge | GREEN only |
| This verdict | **YELLOW** |
| Merge method when eventually GREEN | **merge commit only** (no squash, no history rewrite) |
| PR #10 state at audit time | **OPEN**, `mergedAt: null`, mergeable |

---

## Desensitized audit metrics summary

```json
{
  "feature_commit": "8ff01bd2f2f415012bba503426e835d038415bad",
  "address_set_hash": "A6FF9CCCC5384CA2AABBA9AC904A101BDF8585B7D2F847CFC104FF6438F07049",
  "master_rows": 1433,
  "unique_candidates": 32,
  "research_packs": 15,
  "categories_represented": 8,
  "master_sha256": "D21D6D768D53E2C50234DB21F92CB6C2EC3BDDBA4A96450224B59D32DE05B027",
  "reproducible_vs_implementer_private": true,
  "formal_scores_null": true,
  "private_paths_in_git": false,
  "verdict": "YELLOW"
}
```

## Auditor note on over-implementation

None. Scope stayed within offline wallet screening.
