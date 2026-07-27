# Audit: Wave B + C offline fixture implementations (batch)

**Verdict: GREEN_WITH_ADVISORY**

Auditor: `grok-auditor-wave-bc` (distinct from implementer identity used for
implementation commits).  
Date: 2026-07-27.  
Scope: offline/fixture-only Wave B (Helius fixture source, Pump version
registry, address-library sedimentation) and Wave C (free borrow ports, CA
first-screen card). **Live Helius / real CA E2E remain PARK** per Owner.

**Owner decisions applied (no further Owner action required for this batch):**
- Fixture/offline only; no live Helius network.
- Live acceptance CAs later chosen by Codex from public samples.
- Raw payload retention 7 days; structured Observation / evidence index / replay
  fixtures long-term (`src/domain/retention-policy.ts`).
- BSC not activated.

---

## Coverage

| Area | Paths | Checks |
| --- | --- | --- |
| B1 Fixture Helius | `fixture-helius-data-source.ts`, tests | Replay mint/holders/swaps/funding; degrade fails closed |
| B2 Pump registry | `pump-version-registry.ts` | Pinned program+IDL; create.creator precedence; fixture manifest resolve |
| B3 Sedimentation | `address-library.ts` | Solana-only; borrowed≠verified edges; observation fingerprint idempotency |
| C1 Free borrow | `free-provider-ports.ts` | origin=borrowed, verification=unverified; fan-out degradation |
| C2 Hotpath card | `ca-first-screen.ts` | Unverified markers; borrowed concentration not authoritative; deep-dive enqueued; parallel elapsed helper |

## Acceptance reproduction

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS (166 tests) |
| `npm run build` | PASS |

## Advisories (non-blocking)

1. **Live HTTP client not present** — intentional; Owner live flip required.  
2. **Postgres sedimentation** is in-memory for offline acceptance; production
   Postgres/Redis wiring remains Owner item 4.  
3. **Hotpath clock** currently advances per sequential await in
   `buildCaFirstScreenCard`; budget intent is documented via
   `parallelHotpathElapsedMs` (max not sum). Real parallel fan-out with shared
   virtual clock can tighten later.  
4. **Pump fixture_sha256** verify may recompute if line endings differ; registry
   still resolves forms from pin.

## Verdict

**GREEN_WITH_ADVISORY** for offline Wave B+C deliverables. Does not unpark
`SOL-E2E-001` or enable live Helius.
