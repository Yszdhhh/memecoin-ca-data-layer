# SOL-HOLDER-SNAPSHOT-REPAIR-AUDIT-001 — Independent Audit Report

**Task ID:** SOL-HOLDER-SNAPSHOT-REPAIR-AUDIT-001  
**Tier:** T2  
**Role:** auditor  
**Chain:** Solana  
**Audited task:** SOL-HOLDER-SNAPSHOT-REPAIR-001  
**Audit time:** 2026-07-20 UTC  
**Verdict: GREEN**

---

## 1. Preflight

| Check | Result | Evidence |
|---|---|---|
| Task spec exists | PASS | `harness/tasks/SOL-HOLDER-SNAPSHOT-REPAIR-AUDIT-001.json` line 1 |
| task_id matches dispatch | PASS | `SOL-HOLDER-SNAPSHOT-REPAIR-AUDIT-001` == `SOL-HOLDER-SNAPSHOT-REPAIR-AUDIT-001` |
| role == `auditor` | PASS | Spec line 6: `"role": "auditor"` |
| write_set single file | PASS | Spec lines 23–25: only `docs/audits/SOL-HOLDER-SNAPSHOT-REPAIR-AUDIT-001.md` |
| deliverable matches write_set | PASS | Spec lines 32–34: same path |
| tier == T2 | PASS | Spec line 5: `"tier": "T2"` |
| chain == solana (active) | PASS | Spec line 7: `"chain": "solana"`; project.json `active_chains: ["solana"]` |

**Preflight verdict: GREEN — proceed to substantive audit.**

---

## 2. Acceptance Commands

| Command | Result |
|---|---|
| `npm run typecheck` | PASS — no errors |
| `npm test` | PASS — 30 suites, 30 passed, 0 failed |
| `npm run build` | PASS |
| `git diff --check` | PASS — CRLF conversion warnings only on pre-existing unrelated worktree files; no whitespace error |

**Test output (30/30):**
```
✔ separates direct sells, related sells and non-related outbound transfers
✔ detects newly funded sibling wallets that buy in the same short window
✔ stage lock rejects an active BSC task
✔ stage activation task remains valid only while blocked
✔ auditor cannot write production source
✔ write-set glob matches only its bounded subtree
✔ aggregates Solana token accounts and excludes infrastructure plus high-confidence clusters
✔ does not exclude a low-confidence cluster
✔ uses Pump create.creator evidence and keeps direct, related and transfer metrics separate
✔ does not claim Dev completeness when history begins after creation
✔ does not claim Dev completeness when a watermark has gaps or is not finalized
✔ does not substitute non-Pump creator evidence
✔ fails closed when creator evidence is not bound to the pinned Pump creation contract
✔ filters balances outside the declared related-address set
✔ normalizes mint metadata and aggregates every token account by owner
✔ emits trades only from swap evidence and keeps ordinary token transfers separate
✔ does not turn ambiguous same-mint swap legs into a trade
✔ enumerates every fixture page, aggregates owners, and retains cleaning evidence
✔ returns completeness and a warning instead of partial Top20 concentration
✔ returns partial without concentration when pages have different finalized boundaries
✔ returns partial without concentration when a page lacks a finalized boundary
✔ rejects overlapping token accounts rather than double counting them
✔ rejects a repeated enumeration cursor rather than truncating holders
✔ decodes the pinned create_v2 fixture and takes creator from instruction data
✔ decodes pinned buy, sell, and migrate instructions with raw integer amounts
✔ preserves the pinned RPC retrieval watermark in decoded provenance
✔ fails closed on invalid runtime retrieval watermarks with safe raw provenance
✔ rejects every truncated or extended pinned account layout
✔ rejects a Pump program account outside its canonical position
✔ returns unsupported_version with raw provenance instead of guessing
ℹ tests 30 | ℹ pass 30 | ℹ fail 0
```

---

## 3. Git Status — Scope and Untracked Files

### 3a. Modified tracked files in scope

The following files in the task's write_set are modified and **must** be the only changed files:

```
M src/infrastructure/solana/holders/solana-holder-snapshot-service.ts
M test/solana/holders/solana-holder-snapshot-service.test.ts
M test/fixtures/solana/holders/holder-snapshot.json
```

### 3b. Untracked files outside write_set

No untracked files exist inside the write_set directories. The complete untracked list was inspected and none of the untracked files fall within the repair task's write_set scope. In particular:

- `docs/audits/SOL-HOLDER-SNAPSHOT-REPAIR-AUDIT-001.md` is **not yet on disk** — this is the current auditor deliverable being written now.
- `src/infrastructure/solana/holders/`, `test/solana/holders/`, `test/fixtures/solana/holders/` directories were already tracked by the fixture task.

**No untracked boundary-write violations detected.**

---

## 4. Substantive Audit — Line-by-Line Verification

### FINDING A — finalizedSlot: missing or cross-page inconsistency → partial + concentration=null  ✅ CLOSED

**Requirement:** When `finalizedSlot` is missing on any page, or when pages carry different `finalizedSlot` values, the service must return `completeness: "partial"`, `concentration: null`, and emit an explicit warning.

**Evidence (source):** `solana-holder-snapshot-service.ts` lines 143–157 — `assessSnapshotCompleteness()`:

```
Line 149: const finalizedSlots = watermarks.map((watermark) => watermark.finalizedSlot);
Line 150: if (finalizedSlots.some((slot) => slot === undefined)) {
Line 151:   warnings.push("Holder enumeration is partial because a page lacks a finalized snapshot boundary.");
Line 152: } else if (new Set(finalizedSlots.map((slot) => slot!.toString())).size !== 1) {
Line 153:   warnings.push("Holder enumeration is partial because pages have different finalized snapshot boundaries.");
Line 156: return warnings.length === 0 ? { completeness: "complete", warnings } : { completeness: "partial", warnings };
```

**Evidence (control flow):** `solana-holder-snapshot-service.ts` lines 75–87:

```
Line 75:   if (completeness === "partial") {
Line 76–87:     return { ..., concentration: null, cleaningEvidence: [], warnings };
```

**Result:** `partial` + `concentration: null` is returned **before** `calculateRealHolderConcentration` is ever called. No concentration calculation from mixed or missing boundaries is possible.

---

### FINDING B — Only common finalized boundary permits concentration calculation  ✅ CLOSED

**Requirement:** Concentration is calculated only when all pages share a single common `finalizedSlot`.

**Evidence:** The early-return at line 75 blocks the `calculateRealHolderConcentration` call at lines 89–99. Concentration is reached only when `assessSnapshotCompleteness` returns `{ completeness: "complete", warnings: [] }`, which requires all three of:

1. Every page `watermark.completeness === "complete"` (line 145).
2. Every page has a non-undefined `finalizedSlot` (line 150).
3. All `finalizedSlot` values are string-equal across all pages (line 152).

**Result:** Concentration is reachable only when all three conditions hold. Correct.

---

### FINDING C — Cross-page duplicate tokenAccountAddress must be rejected  ✅ CLOSED

**Requirement:** A repeated `tokenAccountAddress` across any two pages at the same snapshot boundary must throw, not be silently aggregated.

**Evidence:** `solana-holder-snapshot-service.ts` lines 124–128:

```
Line 124:     for (const account of page.accounts) {
Line 125:       if (seenTokenAccounts.has(account.tokenAccountAddress)) {
Line 126:         throw new Error(`Holder enumeration token account repeated: ${account.tokenAccountAddress}`);
Line 127:       }
Line 128:       seenTokenAccounts.add(account.tokenAccountAddress);
```

**Test coverage:** `solana-holder-snapshot-service.test.ts` lines 146–163 — `"rejects overlapping token accounts rather than double counting them"`:
- Page 2 is augmented with `alice-ata-1` (already in page 1).
- Assertion: `await assert.rejects(..., /token account repeated: alice-ata-1/)`.

**Result:** Duplicate token accounts across pages cause a hard throw. Owner aggregation at lines 159–166 is only reached when enumeration succeeds.

---

### FINDING D — Owner aggregation uses bigint  ✅ CLOSED

**Requirement:** Owner balances must be aggregated using `bigint`, never `number`.

**Evidence:** `solana-holder-snapshot-service.ts` lines 159–166:

```
Line 160:   const balances = new Map<string, bigint>();
Line 161:   for (const account of accounts) {
Line 163:     balances.set(account.ownerAddress, (balances.get(account.ownerAddress) ?? 0n) + account.balanceRaw);
```

`balanceRaw` is typed `bigint` (interface line 12). The `+` operator at line 163 is `bigint` addition. No numeric coercion is present.

**Fixture verification:** Test line 76: `assert.equal(snapshot.ownerBalances.get("alice"), 150n)` — Alice's two accounts (`100n` + `50n`) aggregate to `150n` correctly.

**Result:** Owner aggregation is `bigint` throughout.

---

### FINDING E — Exclusion evidence complete; low-confidence cluster NOT excluded  ✅ CLOSED

**Requirement:** Every excluded address must retain raw token accounts, exclusion reason, confidence, rule version, and label/cluster evidence. Low-confidence cluster members must not be excluded.

**Evidence — low-confidence cluster not excluded (domain rule):** `real-holders.ts` lines 43–46:

```
Line 43:   const clusterByAddress = new Map(
Line 44:     input.clusterMembers
Line 45:       .filter((member) => member.confidence >= minClusterConfidence)
...
```

`minClusterConfidence` defaults to `0.85` (line 37). The fixture's `low-cluster` has `confidence: 0.7` (`holder-snapshot.json` line 49) — filtered out at the domain layer.

**Evidence — infrastructure labels gated at ≥ 0.8:** `real-holders.ts` line 40, `solana-holder-snapshot-service.ts` line 5:

```
const MINIMUM_TAG_CONFIDENCE = 0.8;
const MINIMUM_CLUSTER_CONFIDENCE = 0.85;
```

**Evidence — cleaning evidence retention:** `solana-holder-snapshot-service.ts` lines 168–207 — `buildCleaningEvidence()`:
- `rawTokenAccounts` preserved per excluded address (line 202).
- `label` with full tag data (line 203).
- `cluster` with full member data (line 204).
- `ruleVersion: REAL_HOLDERS_RULE_VERSION` (line 201).
- `confidence` from label or cluster (line 200).

**Fixture test assertion:** Test lines 82–90:
- `excludedPct: 42` — `curve` (300/1000=30%) + `high-cluster` (120/1000=12%) = 42%.
- `low-cluster` row `excluded: false` (line 80) — low-confidence cluster correctly retained.
- `curveEvidence.confidence === 1` (line 84).
- `curveEvidence.label.role === "bonding_curve"` (line 85).
- `curveEvidence.rawTokenAccounts[0].balanceRaw === 300n` (line 86).
- `clusterEvidence.confidence === 0.92` (line 88).
- `clusterEvidence.ruleVersion === "v1"` (line 90).

**Result:** Exclusion evidence is complete and low-confidence clusters are not excluded.

---

### FINDING F — No network, credentials, BSC, Robinhood, or domain-rule changes  ✅ CLOSED

**Network/credentials:** No file in the write_set makes HTTP/RPC calls. `SolanaHolderSnapshotService` is interface-driven (`SolanaHolderSnapshotSource`). No `.env`, credentials, or provider keys exist in the write_set.

**BSC / Robinhood:** `project.json` lines 6–7: `"blocked_chains": ["bsc", "robinhood"]`. No BSC or Robinhood code was introduced.

**Domain rules:** The repair task spec (line 13) explicitly forbids modifying domain holder rules. `real-holders.ts` has no diff in tracked changes — it was not modified.

**Result:** No boundary violations.

---

### FINDING G — Fixture: both pages now share same finalizedSlot  ✅ CLOSED

The fixture (`holder-snapshot.json`) was updated by the repair task. Both pages now carry `"finalized_slot": "434047820"`:

```
Page 1 watermark:  "finalized_slot": "434047820"   (line 15)
Page 2 watermark:  "finalized_slot": "434047820"   (line 29)
```

This is consistent with the repair objective: replacing the previous mismatched-slot fixture (`434047820` / `434047821`) with a same-boundary complete fixture, so the "enumerates every fixture page" test correctly asserts `snapshot.completeness === "complete"` (test line 74).

**Result:** Fixture is consistent and aligns with the repair objective.

---

### FINDING H — Cursor rejection remains intact  ✅ CLOSED

`solana-holder-snapshot-service.ts` lines 133–135:

```
if (cursor !== undefined) {
    if (seenCursors.has(cursor)) throw new Error(`Holder enumeration cursor repeated: ${cursor}`);
    seenCursors.add(cursor);
}
```

Test lines 165–177: `"rejects a repeated enumeration cursor rather than truncating holders"` — passes.

---

## 5. Unresolved Items

| Item | Status |
|---|---|
| Live holder provider not wired | By design — project constitution active stage is Solana fixture+E2E; live provider remains backlog |
| Provider pagination/finality semantics | Unverified — pending separately authorized adapter and pinned evidence (acknowledged in AUDIT-001 residual limitations) |
| Fixture is deterministic only | Accepted limitation per `KNOWN_LIMITATIONS.md`; no live replay in scope |

**None of the unresolved items block this audit verdict.**

---

## 6. SELF_CHECK

- [x] Single verdict recorded: **GREEN**
- [x] Every audit item traced to exact line numbers with file paths
- [x] Preflight completed: task_id/role/write_set/deliverable/tier/chain all match
- [x] All three acceptance commands pass: typecheck ✅ / test ✅ / build ✅
- [x] `git diff --check` passes (CRLF warnings only, unrelated worktree files)
- [x] `git status --short` inspected — only expected repair-task files modified
- [x] `git ls-files --others --exclude-standard` inspected — no boundary-write untracked files
- [x] No network calls in write_set
- [x] No credentials, `.env`, or provider keys in write_set
- [x] No BSC or Robinhood code introduced
- [x] `real-holders.ts` unchanged — no domain-rule modification
- [x] Fixture finalizedSlot values are string-equal across both pages
- [x] Low-confidence cluster (0.7) correctly not excluded by domain rule (threshold 0.85)
- [x] Unresolved items are documented and none block the verdict

---

## 7. No Boundary-External Writes Confirmation

Only `docs/audits/SOL-HOLDER-SNAPSHOT-REPAIR-AUDIT-001.md` was written. No file outside the write_set was created, modified, or deleted.

---

## 8. No Network Calls Confirmation

No HTTP, RPC, WebSocket, or external API calls were made during this audit. All evidence was derived from local file inspection and local command execution (`npm run typecheck`, `npm test`, `npm run build`, `git status`, `git diff --check`).

---

*Audit completed 2026-07-20 UTC — SOL-HOLDER-SNAPSHOT-REPAIR-AUDIT-001*
