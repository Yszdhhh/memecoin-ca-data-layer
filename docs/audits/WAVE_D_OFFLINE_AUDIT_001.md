# WAVE-D-OFFLINE-AUDIT-001 — Independent audit of Wave D offline growth loop

**Verdict: GREEN_WITH_ADVISORY**

| Field | Value |
| --- | --- |
| Auditor identity | `grok-auditor-wave-d-001` |
| Role | auditor (T2) |
| Run id | `20260727_WAVE_D_OFFLINE_AUDIT_001` |
| Base commit | `2aa9731` (+ reaudit commit does not change Wave D sources) |
| Write set | `docs/audits/WAVE_D_OFFLINE_AUDIT_001.md` only |
| Live network | not used |

Dependencies: `SOL-LEADERBOARD-001`, `SOL-DAILY-TOPTOKEN-MINING-001` (DONE).

---

## Scope

Independently verify:

1. **Deterministic replay** of offline mining / leaderboard fixtures.
2. **Borrowed → confirmed promotion gates** (no library write of borrowed-only).
3. **Quota guard** on first-hand confirmation budget.
4. **Partial-provider degradation**.
5. **Evidence provenance** on confirmed records.

---

## Method

| Step | Evidence |
| --- | --- |
| Line review | `token-profit-leaderboard.ts`, `daily-toptoken-mining.ts` |
| Tests | `test/application/leaderboard/*`, `test/application/growth-loop/*` |
| Acceptance | doctor / typecheck / test (184) / build |

---

## Findings

### 1. Borrowed path is lead-only and contract-locked — PASS

- `normalizeBorrowedLeaderboard` forces `origin: "borrowed"`,
  `verificationStatus: "unverified"` (`token-profit-leaderboard.ts:54-57`).
- Mining filters top tokens and leads to borrowed+unverified only
  (`daily-toptoken-mining.ts:150-154`, `:187-193`); invalid contracts warn.

### 2. Promotion requires first-hand confirmation — PASS

- `promoteConfirmedLeaderboardWallet` requires
  `origin === "first_hand"`, `verificationStatus === "verified"`, complete
  status (`token-profit-leaderboard.ts` ~238–262 region).
- Mining only promotes after `confirmBorrowedLeads` / Tier-A swap recompute path
  and within quota (`daily-toptoken-mining.ts` eligible slice + confirmation
  loop after line 218).

### 3. Quota guard — PASS

- `firstHandWalletBudget` validated non-negative integer (`:142-144`).
- `remaining = budget - consumed`; only `eligible.slice(0, remaining)` selected
  (`:218-219`); excess listed in `quota.skippedWallets`.
- Report exposes `quota.consumed` and budget.

### 4. Deterministic offline structure — PASS

- Fixture providers sort by rank / address.
- Rule versions: `PROFIT_LEADERBOARD_RULE_VERSION`,
  `DAILY_TOPTOKEN_MINING_RULE_VERSION`.
- Confirmed records carry `evidence.signatures`, `swapCount`, `inputsHash`
  (hash of swap set).

### 5. Degradation — PASS

- Top-token provider throw → `top_token_provider_unavailable`, continues.
- Leaderboard throw → `borrowed_leaderboard_unavailable` per token.
- Judgment throw → `judgment_failed:<wallet>`.
- Report `status` becomes `DEGRADED` when warnings present (report assembly).

### Advisories (non-blocking)

**ADV-1.** Live scheduling of the growth loop remains Owner-gated (D-F);
offline pipeline correctly does not fetch live top lists.

**ADV-2.** First-hand confirmation still depends on fixture swap providers in
tests; production Helius flip is a separate live task.

**ADV-3.** Judgment engine is injected (`WalletJudgmentEngine`); wiring real
Alpha/detectors is composition, not a gap in the mining orchestrator itself.

---

## Acceptance reproduction

| Command | Result |
| --- | --- |
| `npm run harness:doctor` | GREEN |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 184 |
| `npm run build` | PASS |
| `git diff --check` | PASS |

---

## Verdict

**GREEN_WITH_ADVISORY** — Wave D offline loop preserves borrow≠confirm,
quota caps first-hand work, degrades without crashing, and attaches provenance
on confirmed promotions. Live mining trigger and live Helius remain PARK.

No Owner decision required for this audit.
