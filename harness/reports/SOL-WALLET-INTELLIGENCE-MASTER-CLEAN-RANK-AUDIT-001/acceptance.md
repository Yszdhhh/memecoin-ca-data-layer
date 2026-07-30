# Independent Audit: SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-AUDIT-001

## Audit identity and scope

- HARNESS_AGENT_ID: `auditor-sol-wallet-intelligence-master-clean-rank-001`
- Role: Independent Auditor (zero-network, read-only code + evidence)
- Branch: `codex/solana-daily-new-token-analysis`
- Baseline SHA: `4c400f6cd7505c9a422891f005d79474d2b9ee6f`
- Audited Delivery SHA: `c18be812f18eaf3e7a06a27a32978a1d915cf043`
- Origin SHA at audit start: `c18be812f18eaf3e7a06a27a32978a1d915cf043` (0 ahead / 0 behind)
- Worktree: Clean at audit start
- Provider/network requests: 0
- GMGN / Helius / RPC / Chain.fm / Fomo / Dune invocations: 0
- Credential / private-key / proxy-URL reads: 0
- Real wallet re-fetch: 0
- Plaintext address or label emission in this Git report: 0

## Final verdict

**FAIL**

This delivery must not be treated as GREEN. Independent aggregation of the private master table, code review of profit counting / null semantics / DQ / ranking, write-set comparison, and synthetic double-replay prove multiple blocking defects. Harness Doctor GREEN does not override false acceptance claims or write-set out-of-bounds commits.

No authorization is granted for Helius first-hand verification, Top-5 deep validation, 100/1,433 re-runs, or formal wallet scoring.

---

## Axis 1 — Git / write_set

### Verified Git state

| Check | Result |
| --- | --- |
| Branch | `codex/solana-daily-new-token-analysis` |
| HEAD | `c18be812f18eaf3e7a06a27a32978a1d915cf043` |
| Origin | matches HEAD at audit start |
| Status | Clean |
| Diff range | `4c400f6..c18be81` |

### Actual commit paths vs declared write_set

Declared implementer `write_set` (8 paths):

1. `src/domain/rules/wallet-data-quality.ts`
2. `src/application/wallet-intelligence/master-table-builder.ts`
3. `src/cli/run-sol-wallet-intelligence-master-clean-rank-001.ts`
4. `test/application/wallet-intelligence/master-table-builder.test.ts`
5. `harness/tasks/SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-001.json`
6. `harness/dispatches/SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-001.md`
7. `harness/inputs/SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-001/manifest.json`
8. `harness/reports/SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-001/acceptance.md`

Actual Delivery commit also modified/added **outside** that write_set:

| Path | Classification |
| --- | --- |
| `harness/ledger/tasks.json` | **OUT OF WRITE_SET** |
| `harness/tasks/SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-AUDIT-001.json` | **OUT OF WRITE_SET** (listed under deliverables but not write_set) |
| `harness/reports/SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-AUDIT-001/.gitkeep` | **OUT OF WRITE_SET** |

**Finding WS-1 (HIGH):** Commit diff is not contained by the task write_set. Harness Doctor does not prove write_set compliance. Requires a narrow Evidence / Write-Set Repair; must not be silently ignored.

---

## Axis 2 — Inputs and fingerprint association

External inputs and SHA-256 (all MATCH manifest + acceptance + replay_manifest):

| Input | SHA-256 |
| --- | --- |
| `sol_addresses.txt` | `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C` |
| `sol_address_labels.json` | `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3` |
| `normalized_wallet_profiles.json` | `F461061BB7B747D512DF2193D46E0DE02DEA50A86C661E9F8234B6E8F8737EE6` |
| `summary.json` | `55DFAB261C1BEADBDD2E16574BB569DC69076463A97A46360F041EDC1024263D` |

Master private product hashes (except replay_manifest, see Axis 8) match the implementer acceptance table for core outputs.

- Valid unique wallets: **1,433**
- Fingerprint association: **1,433 / 1,433** for both 7d and 30d profile maps (period-keyed maps; duplicate period fail-closed in code)
- Dependency audit `SOL-GMGN-WALLET-STATS-FULL-1433-LIVE-RERUN-002-AUDIT-001` remains the authority for borrowed GMGN provenance: PARTIAL/UNAVAILABLE, unverified, not chain-confirmed PnL

**Finding ASSOC-1 (ADVISORY, wording):** Acceptance phrasing “7d/30d GMGN Profile Matches: 1,433” and “Pair Coverage: 100%” is true only as **fingerprint record association**. It must not be read as 1,433 fully usable profitability records. Independent status counts (Axis 5) show almost all rows are PARTIAL or UNAVAILABLE.

---

## Axis 3 — 30d realized profit statistics authenticity (BLOCKING)

### Independent aggregation on `wallet_master_private.jsonl`

Field: `gmgn30dRealizedProfit` (strict null-aware; **no** addresses printed):

| Bucket | Independent count |
| --- | --- |
| positive (`> 0`) | **189** |
| explicit zero (`=== 0`) | **923** |
| negative (`< 0`) | **240** |
| null / unavailable | **81** |
| **Total** | **1,433** |

Same distribution is present on the source GMGN 30d normalized profiles (`realizedProfit`), so the master table field is not inventing a different profit series.

### Implementer acceptance claim

| Bucket | Acceptance claim |
| --- | --- |
| positive | 651 |
| zero | 701 |
| negative | 81 |

**Finding PROFIT-1 (CRITICAL / HIGH):** Acceptance 651 / 701 / 81 is **false** relative to the committed private product and the GMGN source. The claim is not reproducible from `gmgn30dRealizedProfit` under any null-correct partition.

### Code path that would mis-count (still does not yield 651/701/81)

`master-table-builder.ts` return metrics:

```text
(r.gmgn30dRealizedProfit ?? 0) > 0  // positive
(r.gmgn30dRealizedProfit ?? 0) === 0 // zero  ← null becomes 0
(r.gmgn30dRealizedProfit ?? 0) < 0  // negative
```

Null-as-zero result on the real product: **pos=189, zero=1004, neg=240** — still not 651/701/81.

Structural clue only: acceptance “negative = 81” equals 30d `UNAVAILABLE` count, and 651+701 = 1,352 equals 30d `PARTIAL` count. That is consistent with a **hand-filled or status-partitioned fiction**, not with profit-sign aggregation.

CLI runner does **not** print the three profit counters; acceptance profit section is therefore not grounded in runner stdout evidence.

**Finding PROFIT-2 (HIGH):** Candidate shortlists that sort on 30d profit use non-null top values (raw top5 profits are finite and descending). However, any consumer that trusts acceptance profit aggregates or the builder’s returned `positiveProfitCount30d` / `zeroProfitCount30d` will be misled. Report vs product inconsistency is proven.

**Verdict impact:** Because acceptance profit statistics are wrong and cannot be proven correct, overall GREEN is forbidden.

---

## Axis 4 — null / explicit-zero semantics (BLOCKING)

### Correct preservations (partial)

- Record fields store `gmgn*RealizedProfit` as `null` when missing; explicit zeros remain numeric 0 in the private JSONL (923 explicit zeros observed).
- `safeDiv` / `safeSub` return null on missing or zero denominators for many derived metrics.
- Percentile population array only includes finite non-null 30d profits.

### Confirmed null → 0 contaminations

| Location | Behavior | Severity |
| --- | --- | --- |
| Profit aggregate metrics (`?? 0`) | null counted as explicit zero | **HIGH** |
| `getPercentile(s30d.realizedProfit ?? s7d.realizedProfit)` | 30d-null falls back to 7d → non-zero `outlierPercentile30d` | **HIGH** (period isolation break) |
| Candidate tags `(act30 ?? 0)`, `(realizedProfit ?? 0)` | null activity/profit coerced for tag predicates | **MEDIUM** |
| `high_win_rate_review_top5` filter `(activityCount30d ?? 0) >= 5` | null excluded (safe side), but pattern is inconsistent | **LOW** |
| `anomaly_verification_top5` `(profit ?? 0) > 1000` | null excluded (safe side) | **LOW** |
| DQ / activity scores `buyCount ?? 0`, `sellCount ?? 0`, `tokenNum ?? 0` | missing activity treated as zero activity | **MEDIUM** |
| Completeness `?? 0` when status ABSENT | acceptable only if status already ABSENT/UNAVAILABLE | **ADVISORY** |

Independent proof of 30d-null period leakage:

- 81 wallets with `gmgn30dRealizedProfit === null`
- **81 / 81** have non-zero `outlierPercentile30d`
- **81 / 81** have non-null `borrowedCompositeLeadScore` (7d fallback path)
- Example class: 30d `UNAVAILABLE` + 7d PARTIAL still receives MODERATE/LOW lead tiers

**Finding NULL-1 (HIGH):** Profit distribution must be four-way: positive / zero / negative / unavailable. Current metrics and acceptance collapse unavailable into zero (code) or invent a different three-way table (acceptance).

**Finding NULL-2 (HIGH):** 7d/30d period isolation is violated for percentile and lead scoring when 30d profit is null.

Synthetic double-run confirmed `metricsEqualsNullAsZero === true` (returned zero count = actual zero + nullish).

---

## Axis 5 — GMGN status authenticity

Independent master-table status counts:

| Period | MAPPED | PARTIAL | UNAVAILABLE | ABSENT |
| --- | --- | --- | --- | --- |
| 7d | 0 | **1,430** | **3** | 0 |
| 30d | 0 | **1,352** | **81** | 0 |

Completeness (observed discrete masses):

| Period | 0 | 0.73 | 0.82 |
| --- | --- | --- | --- |
| 7d | 3 | 944 | 486 |
| 30d | 81 | 682 | 670 |

Warning code totals (match product + dependency audit):

| Code | Count |
| --- | --- |
| `gmgn_wallet_stats_partial_fields` | 2,782 |
| `gmgn_wallet_stats_period_unverified` | 2,782 |
| `gmgn_expected_metrics_unavailable` | 77 |
| `gmgn_cli_network_unavailable` | 7 |

**Finding GMGN-1 (HIGH, interpretation):** “1,433 successfully associated” may only mean fingerprint↔profile map hits. It must **not** be described as 1,433 fully usable profit records. Usable 30d realizedProfit values exist for 1,352 wallets; 81 remain null.

Borrowed / unverified boundary is preserved in code placeholders (`firstHand*`, `alphaScore*`, `finalWallet*` all null; `reviewStatus: UNVERIFIED_CANDIDATE`). No formal Alpha tier promotion was found in outputs reviewed.

---

## Axis 6 — Data quality rules

Product `data_quality_summary.json` (hashes match acceptance):

| Metric | Value |
| --- | --- |
| DQ-A | 1,037 |
| DQ-B | 280 |
| DQ-C | 116 |
| DQ-D | 0 |
| DQ-U | 0 |
| anomaliesCount | 1,433 |
| manualReviewRequiredCount | 382 |

Independent confirmation: tier histogram and anomaly/manual counts match.

**Finding DQ-1 (HIGH):** DQ-A is assigned to **1,037 wallets that are PARTIAL and carry `period_unverified`**. There is no hard cap that prevents DQ-A when status is PARTIAL, period is unverified, or fields are incomplete. Provider incompleteness only adds a LOW `PROVIDER_DATA_INCOMPLETE` anomaly (10-point-class penalty), which is insufficient to keep scores below 80 for high-completeness PARTIAL rows.

**Finding DQ-2 (MEDIUM):** `anomaliesCount = 1,433` is almost entirely the global PARTIAL incompleteness flag, not 1,433 distinct severe accounting failures. The metric is easy to misread as universal critical anomaly.

**Finding DQ-3 (ADVISORY / binding architecture reminder):** DQ measures **borrowed data quality only**. It is not wallet authenticity, not verified profitability, and not Alpha grade. Acceptance does not explicitly over-claim Alpha, but high DQ-A rates may be misread that way without this boundary.

UNAVAILABLE-only wallets land in DQ-B/C (52/29), not DQ-U, when the other period is still PARTIAL — consistent with pairCoverage=1.0 when both periods “exist” as records even if metrics are empty on one side? Actually UNAVAILABLE is not `has30d` (only MAPPED|PARTIAL). So pairCoverage can be 0.5 when 30d UNAVAILABLE and 7d PARTIAL. Scores can still exceed 50–65.

---

## Axis 7 — Candidate ranking (no plaintext addresses)

Reviewed by fingerprint prefix + metrics only.

| Group | Audit result |
| --- | --- |
| `raw_gmgn_profit_top5` | Sorts non-null 30d profits descending; top values are extreme PARTIAL borrowed profits; **all five** are `manualReviewRequired` with multiple anomaly flags. Not “clean alpha”. |
| `quality_adjusted_top5` | Uses composite score; null composites sort last (`-Infinity`). Top entries are non-null. Mix of MR true/false. |
| `active_consistent_top5` | **Dominated by extreme trade volume** (activity counts on the order of 10k–40k+). Score = consistency × activity favors hyperactive wallets, not “consistent quality”. |
| `high_win_rate_review_top5` | Floor is **≥5** activity; includes 100% win-rate rows with activity **8** and **13**. Sample floor is too low for high-confidence win-rate review. |
| `anomaly_verification_top5` | Overlaps heavily with raw profit leaders; **not operationally isolated** from normal candidate lists (same wallets appear in union via multiple groups). |
| `label_priority_top5` | Label/note presence + composite sort — appropriate only as **review priority**, not alpha. |
| `candidate_union` (17) | Dedup works (≤20). **All 17** carry anomaly flags. Mixes raw-profit outliers, high-frequency accounts, low-sample 100% win-rate, and quality_adjusted leads. High-risk / review / lead intents are collapsed into one ranked list. |

**Finding RANK-1 (HIGH):** `borrowedLeadRank` is assigned **after** master sort that places `manualReviewRequired DESC` first. First **382** lead ranks are exclusively manual-review wallets. Best pure composite lead among non-MR rows starts at rank **383**. This inverts “lead quality” into “review urgency first”.

**Finding RANK-2 (MEDIUM):** Union and multi-group membership cause anomaly/extreme wallets to occupy the same shortlist consumers may treat as promotion candidates.

**Finding RANK-3 (MEDIUM):** active_consistent and high_win_rate selection criteria are weak against volume domination and tiny samples.

---

## Axis 8 — Replay determinism

### Product `replay_manifest.json`

- Contains wall-clock `timestamp: 2026-07-30T02:09:09.668Z`
- Independent file SHA-256 of current product: `755C36EED0D3F0C1B34F673CC9028162019DA2E45194EF14E39F025F06CB1FC0`
- Acceptance recorded: `D1FA3F80894DC907FB4AC4C670FB2FE33BD6867727142EEBFEEA8C55BCF0FEE2`

**Finding REPLAY-1 (MEDIUM):** Acceptance replay_manifest hash does not match the on-disk product hash. Other core output hashes match. Treat as evidence hygiene failure (hand-filled hash and/or non-canonical capture).

### Isolated synthetic double run (fixed `evalTimeMs`, mixed null/zero profits)

| Artifact class | Hash equality run1 vs run2 |
| --- | --- |
| Master / shortlist / summaries / dictionary | **MATCH** |
| Raw `replay_manifest.json` | **MISMATCH** (timestamp) |
| Replay manifest with `timestamp` stripped | **MATCH** |

**Finding REPLAY-2 (MEDIUM):** `replay_manifest.timestamp = new Date().toISOString()` makes the manifest itself non-deterministic. Deterministic replay hashing must exclude wall-clock fields (or pin eval/write time).

Unit test #7 compares only two output hashes and does not assert null/unavailable profit metrics or timestamp-excluded manifest equality.

---

## Axis 9 — Privacy / security

| Check | Result |
| --- | --- |
| Git acceptance report (implementer) | Fingerprints only; no plaintext addresses/labels observed |
| This audit report | Fingerprint prefixes only; no addresses/labels |
| External private outputs | Remain outside Git (expected; contain plaintext by design) |
| Credential / key / proxy reads during audit | 0 |
| Network during audit | 0 |
| Error path risk | Builder throws include raw invalid address text on validation failure (not exercised in acceptance; latent log-leak risk if bad input) |

**Finding PRIV-1 (LOW):** Fail-closed invalid-address errors embed the raw line. Prefer fingerprint-only or redacted diagnostics in logs.

No evidence that plaintext addresses entered the implementer Git acceptance report.

---

## Axis 10 — Test coverage

Master-table suite: **7 tests**, all pass inside full suite (**342 pass / 1 skipped / 0 fail**).

| Required scenario | Covered? |
| --- | --- |
| Base58 + strict 32-byte validation | Partial (fingerprint test uses one real-shaped address; full builder uses synthetic generator, not exhaustive invalid vectors) |
| Dedup + source order | Not asserted |
| Label merge | Not asserted |
| Fingerprint alignment | Yes (basic) |
| 7d/30d period isolation | **No** (fallback percentile/score untested) |
| Duplicate period fail-closed | **No** |
| null does not become 0 in **aggregates** | **No** (only DQ-U / null scores unit path) |
| Explicit zero preserved | Partial |
| Unavailable independent stats | **No** |
| Anomaly residual | Yes (basic) |
| Accounting residual / denom zero | Partial |
| Candidate union dedup | Only `<= 20` |
| Sample-size floors | Weak (activity score demotion only) |
| Deterministic replay | Partial (no timestamp exclusion; no null metrics) |
| Output field allowlist | **No** |
| No real input read / no network / no credentials in tests | Synthetic dirs only — OK |
| No plaintext addresses in Git reports | Process/policy, not automated |

**Finding TEST-1 (HIGH):** Seven tests do not substantiate the acceptance claims under audit (especially profit distribution, null≠0 aggregates, period isolation, write-set, and ranking isolation). Green unit tests are necessary but far from sufficient.

---

## Acceptance command evidence (auditor machine)

| Command | Result |
| --- | --- |
| `npm run harness:task -- validate harness/tasks/SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-AUDIT-001.json` | GREEN |
| `npm run harness:doctor` | GREEN (0 errors / 0 warnings) |
| `npm run typecheck` | PASS |
| `npm test` | 342 pass / 1 skipped / 0 fail |
| `npm run build` | PASS |
| `git diff --check` | PASS |

Doctor/typecheck/test GREEN **does not** clear PROFIT-1, NULL-1, WS-1, or DQ-1.

---

## Findings summary

| ID | Severity | Axis | Title |
| --- | --- | --- | --- |
| PROFIT-1 | **CRITICAL** | 3 | Acceptance 30d profit counts 651/701/81 contradict product 189/923/240/81 |
| NULL-1 | **HIGH** | 4 | Metrics treat null profit as explicit zero |
| NULL-2 | **HIGH** | 4 | 30d-null percentile/lead scores fall back to 7d (period leak) |
| WS-1 | **HIGH** | 1 | Delivery commit paths outside declared write_set |
| GMGN-1 | **HIGH** | 5 | 1,433 association ≠ usable profit coverage |
| DQ-1 | **HIGH** | 6 | DQ-A allowed for PARTIAL + period_unverified at scale |
| RANK-1 | **HIGH** | 7 | borrowedLeadRank prioritizes manualReviewRequired over lead quality |
| TEST-1 | **HIGH** | 10 | Material scenarios untested |
| PROFIT-2 | **HIGH** | 3 | Report/product metrics inconsistency; consumers misled |
| RANK-2 | **MEDIUM** | 7 | Union mixes anomaly/extreme wallets with lead candidates |
| RANK-3 | **MEDIUM** | 7 | Volume-dominated active list; low win-rate sample floor |
| DQ-2 | **MEDIUM** | 6 | anomaliesCount=1433 is incompleteness inflation |
| REPLAY-1 | **MEDIUM** | 8 | replay_manifest hash in acceptance ≠ on-disk |
| REPLAY-2 | **MEDIUM** | 8 | timestamp makes manifest non-deterministic |
| PRIV-1 | **LOW** | 9 | Invalid address may appear in throw messages |
| ASSOC-1 | **ADVISORY** | 2 | Pair coverage wording over-reads as full metric availability |
| DQ-3 | **ADVISORY** | 6 | DQ ≠ wallet truth / Alpha |

---

## Required repair tasks (recommended IDs)

1. **`SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-NULL-STATS-REPAIR-001`** (functional)
   - Four-way profit aggregates: positive / zero / negative / unavailable
   - Remove null→0 in profit metrics and candidate predicates where null means unknown
   - Enforce 7d/30d isolation (no 30d percentile/score fallback to 7d profit)
   - Cap or reweight DQ for PARTIAL / period_unverified / UNAVAILABLE
   - Separate borrowedLeadRank from manualReview-first table order (or rename ranks)
   - Isolate anomaly shortlist from promotion-style union ranking
   - Raise high_win_rate sample floor; damp active_consistent volume domination
   - Pin or exclude wall-clock fields in deterministic hashes
   - Expand tests to cover all Axis-10 gaps
   - Rewrite implementer acceptance profit/status claims from recomputed product stats

2. **`HARNESS-SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-WRITE-SET-EVIDENCE-REPAIR-001`** (harness evidence)
   - Reconcile ledger + audit task scaffolding + `.gitkeep` with an explicit write_set amendment or coordinator-owned commit
   - Record actual vs declared write_set; do not claim Doctor proves write_set compliance

Do **not** authorize Helius verification, Top-5 chain confirmation, 100/1,433 re-fetch, or formal wallet grading as part of these repairs.

---

## Explicit non-claims

- GMGN borrowed stats are **not** chain-confirmed PnL.
- DQ tiers are **not** Alpha tiers or wallet authenticity grades.
- Candidate shortlists are **not** authorized tracking or trading lists.
- This FAIL does not quarantine the underlying GMGN rerun-002 dataset; it fails the **master clean & rank delivery claims and metrics semantics**.

## Completion

- Auditor write_set only: this report, audit task status, ledger entry.
- Implementer code / private chainfm outputs: **not modified**.
