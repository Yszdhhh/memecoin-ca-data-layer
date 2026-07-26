# SOL-E2E-GAP-RESEARCH-002: Solana E2E gap and dispatch research

**Role:** researcher (T1, read-only)  
**Updated:** 2026-07-26 (post CA orchestration + evidence-integrity repair + wallet cleaning wave)  
**Owner bound:** no live CA, credentials, or provider selection

## 1. Executive summary

Standalone Solana fact services (Pump decoder, holder snapshot, Dev history) are
accepted. Final CA **orchestration** is implemented and repair-implemented; independent
repair/wallet/harness audits are queued for an evening batch.

Remaining gaps to constitution-defined **fixture + Owner-authorized live** E2E
(`SOL-E2E-001`) are no longer “wire adapter only.” They are:

1. **Independent audit batch** on recent implementer work  
2. **Wallet cleaning acceptance** (implementer done or in flight; auditor pending)  
3. **FIND-4 residual** — exclusion tags/clusters still narrower than full snapshot  
4. **Live provider + CA Owner decisions** (T3)  
5. **Security containment** (`SEC-HARNESS-CONTENT-SCAN-001`)  
6. **Fixture E2E package + optional live run** under Owner gates  

Verdict for this research task: **GREEN for dispatch mapping** (offline).  
`SOL-E2E-001` itself remains **PARK** until Owner gates and audits close.

## 2. Current state (facts, not chat)

| Building block | Status | Evidence |
|---|---|---|
| Pump retrieval decoder | Accepted | `SOL-PUMP-RETRIEVAL-AUDIT-001` GREEN |
| Holder snapshot + repair | Accepted | `SOL-HOLDER-SNAPSHOT-REPAIR-AUDIT-001` |
| Dev history + repair | Accepted | `SOL-DEV-REPAIR-AUDIT-001` |
| CA orchestration | Implementer DONE | run `20260726_SOL_CA_ORCHESTRATION_001` GREEN |
| Orchestration audit | DONE **FAIL** | `docs/audits/SOL-CA-ORCHESTRATION-AUDIT-001.md` |
| Orchestration repair | Implementer DONE | run `20260726_SOL_CA_ORCH_REPAIR_001` GREEN |
| Orchestration repair audit | **Queued evening** | task READY |
| Wallet cleaning | Implementer wave | service-funder suppression + evidence on result |
| Wallet cleaning audit | **Queued evening** | blocked until implementer DONE + batch |
| Harness AO automation | Implementer wave | offline `lifecycle plan/verify/apply-readiness` |
| Live Helius/RPC | Not wired | `KNOWN_LIMITATIONS.md` |
| Live CA / credentials | Owner-gated | `OWNER_DECISIONS_NEEDED.md`, `SOL-E2E-001` PARK |

### 2.1 What the stale 2026-07 earlier draft got wrong

An older draft claimed creator/holder/Dev were unwired into `AnalysisService`. That is
**obsolete** after `SOL-CA-ORCHESTRATION-001`: audited Solana facts are composed into
the final result with fail-closed completeness gates. Do not re-dispatch
“adapter integration” as if orchestration never landed.

## 3. Residual technical gaps (before live E2E)

### G1 — Independent audit backlog (process)

Implementer GREEN ≠ accepted T2 milestone. Evening batch should cover at least:

- `SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001`
- `SOL-WALLET-CLEANING-AUDIT-003` (after wallet implementer finish)
- `HARNESS-AO-AUTOMATION-AUDIT-001`

### G2 — FIND-4 exclusion input width

Orchestration still derives tag/cluster exclusion inputs from generic top-100 owners
and the recent-trade window, then passes them into the audited snapshot. Warnings are
emitted; root rewiring (enumerate from snapshot itself) is still required **before**
any live source is trusted for concentration.

### G3 — Service funder coverage

Wallet cleaning suppresses `exchange` / `router` tags at confidence ≥ 0.8. Bridge and
batch-service funders are not first-class roles yet; expand only with evidence-backed
tags (no silent heuristic).

### G4 — Persistence / CA case keys (advisories)

Base58 case-folding on cache/Postgres keys remains a pre-existing advisory. Optional
hardening task, not E2E-blocking for fixture-only acceptance.

### G5 — Non-Solana completeness hardcodes

Non-Solana branch still hard-codes completeness; unreachable while BSC/Robinhood
stage-blocked. Future stage tasks must not inherit blindly.

### G6 — Live data plane

No live adapter, credentials, payload retention policy, or Owner-named CA. Fixture E2E
can proceed offline; live leg cannot.

## 4. Recommended dispatch sequence

```text
[evening] SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001
       → if GREEN: accept repair; else REPAIR-00N
[impl]    SOL-WALLET-CLEANING-003 (this wave)
[evening] SOL-WALLET-CLEANING-AUDIT-003
[impl]    HARNESS-AO-AUTOMATION-001 (this wave)
[evening] HARNESS-AO-AUTOMATION-AUDIT-001
[design]  SOL-HOLDER-EXCLUSION-INPUT-REPAIR (FIND-4; name TBD) before live
[owner]   T3 decisions: CA, endpoint/plan, retention, credential containment
[sec]     SEC-HARNESS-CONTENT-SCAN-001
[coord]   SOL-E2E-001 fixture package + optional Owner live run
```

### Task sketch — FIND-4 follow-up (not registered in this research write)

- **Objective:** Derive exclusion tags/clusters from the audited snapshot’s own owner set
  (or emit hard fail if inputs are narrower than completeness claims).  
- **Must not:** lower cluster confidence threshold; call live providers.

### Task sketch — fixture E2E

- Offline multi-service fixture under `test/integration/solana/**`  
- Assert watermarks, cleaning evidence, creator pin, Dev completeness gates, wallet
  cleaning evidence, and absence of network.

## 5. Owner decisions still required (unchanged gates)

From `OWNER_DECISIONS_NEEDED.md` / `SOL-E2E-001`:

1. Authorize a specific live Pump.fun CA (or explicitly fixture-only acceptance).  
2. Authorize Helius/RPC endpoint or plan and credential containment.  
3. Define live payload retention / redaction policy.  
4. Any threshold relaxation remains a separate Owner decision.

## 6. Acceptance of this research task

Commands (local, offline):

```text
npm run harness:task -- validate harness/tasks/SOL-E2E-GAP-RESEARCH-002.json
npm run typecheck
npm test
npm run build
git diff --check
```

**No network, no CA selection, no code changes outside the research write set.**

## 7. Conclusion

The path to E2E is **audit batch → finish wallet/harness acceptance → FIND-4 repair
before live → Owner T3 gates → SOL-E2E-001**. Orchestration wiring is no longer the
primary gap; evidence integrity, independent review, exclusion-input honesty, and
Owner-gated live policy are.
