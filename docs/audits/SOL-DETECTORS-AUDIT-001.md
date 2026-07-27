# Audit: SOL-DETECTORS-001

**Verdict: GREEN_WITH_ADVISORY**

Auditor: `grok-auditor-detectors` (≠ implementer).  
Run: `20260727_SOL_DETECTORS_AUDIT_001`.  
**Owner decisions: none** (methods doc notes optional design flag that C is split from exclusion gate — already chosen; no new decision).

---

## Confirmed

1. `HOLDER_EXCLUSION_CLUSTER_THRESHOLD === 0.85` exported and used for `eligibleForHolderExclusion`; weak seed cannot authorize exclusion even if fused C is high.  
2. Service-funder suppression still works via untouched `detectFundingClusters`.  
3. Tier-B-only external labels cannot fire cluster (G-2b).  
4. Bot-sniper G-3a: lone early wallet does not fire.  
5. Independent smart money vetoes C≥0.85 and S≥0.75 (I=0).  
6. Offline pure functions; tests PASS (152 suite total at implementer finish).

## Advisories

**A1** — Detectors consume precomputed feature scalars; not yet wired from live timeline extraction (Wave B/C).  
**A2** — `label-decision` harness still uses stubs; should rebind to these modules in a follow-up (non-blocking for this milestone).  
**A3** — Fusion C is display/risk overlay only; exclusion remains seed≥0.85 — intentional per methods §2.4.

## Acceptance

typecheck / test / build / write-set PASS under harness verify.

**GREEN_WITH_ADVISORY** — core safety gates hold. No Owner decision required.
