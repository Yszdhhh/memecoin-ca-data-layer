# Acceptance — SOL-CA-REAL-DATA-CLEANING-PILOT-001

## Verdict

**GREEN_WITH_ADVISORY**

## Task

Solana CA-first real holder data cleaning pilot on branch
`feature/sol-ca-real-data-cleaning-pilot-001` from base
`main@777e0131ec663178c6c4cc5cc0c4584e60be2381`.

## Local path note (for cloud agents)

Operator primary clone: **`G:\链上战壕`** (documented in `docs/LOCAL_WORKSPACE_PATHS.md`).
Cloud runners cannot see this path; subsequent local dispatches should open that file first.

## Scope delivered

1. Full token-account enumeration (Helius DAS `getTokenAccounts` cursor pagination)
2. Deterministic owner aggregation
3. Cleaning classification with evidence (no silent exclusion)
4. Supply vs enumerated accounting (BigInt)
5. raw / cleaned / excluded / unresolved universes
6. Concentration metrics with numerator/denominator/completeness
7. Strict `CaScanResponseV1` mapping + validation
8. Real-data gap matrix (`gap-matrix.md`)
9. Offline unit coverage for the 12 required cases
10. Local path documentation for later tasks

## Live sample results (fixed manifest, 6 CAs)

| CA (prefix) | Status | Owners | Pagination | Residual | Judgment |
| --- | --- | --- | --- | --- | --- |
| H3GtwGSr… | OK | 2265 | complete | 0 | eligible |
| EUx9N4UX… | OK | 653 | complete | 0 | eligible |
| H1adbGC5… | PARTIAL | 1846 | complete | >0 supply mismatch | not confirmed |
| BQYc6c5h… | OK | 571 | complete | 0 | eligible |
| Ce2gx9KG… | PARTIAL | 996 | incomplete | large | not confirmed |
| 9ZtbETDN… | PARTIAL | 1993 | incomplete | large | not confirmed |

- Sample count: **6** (within 5–10)
- Rejected (no holders): **0** after one manual re-fetch of two flaky first-page failures
- Provider: **Helius only**, read-only, sequential, manual trigger
- Endpoint mode: **`gatekeeper_beta`** (mainnet hostname resolves to localhost on this network)

## Blocking criteria check

| Criterion | Result |
| --- | --- |
| 5–10 distinct public CAs executed | PASS (6) |
| Helius-only read-only | PASS |
| No credential / raw header / credential URL leak in git artifacts | PASS (scan below) |
| Pagination state determined for every CA | PASS (complete or incomplete, never unknown) |
| Amount accounting for every CA | PASS |
| raw/cleaned/excluded/unresolved traceable | PASS |
| Owner aggregation no double-count | PASS (tests + live multi-ATA deltas) |
| Ratios recompute from integers | PASS |
| PARTIAL not promoted to confirmed | PASS |
| Replay deterministic offline | PASS (test 12) |
| Offline gates | PASS |
| Independent audit | PENDING (this report is implementer acceptance) |

## Advisories (non-blocking)

1. **Provider flakiness**: intermittent non-JSON/transport on `getTokenAccounts`; mitigated by retries, partial-page return, and one re-fetch of two CAs.
2. **Supply residual with complete pagination** (H1adb…): real DAS gap; correctly blocks confirmed judgment.
3. **Incomplete pagination** on larger holder sets under request/time budget: correctly PARTIAL.
4. **No pool/liquidity exclusions** without first-hand evidence: by design for this pilot.
5. **DNS**: do not use `mainnet` mode on this operator host until `mainnet.helius-rpc.com` stops resolving to `127.0.0.1`.

## Explicit non-goals (not expanded)

Pump decode, creator/Dev sell, funding clusters, wallet PnL, auto discovery, new providers, production DB, frontend, BSC, full SOL-E2E.

## Offline gates

```text
npm run harness:doctor  → GREEN (dirty tree warning expected during implementer work)
npm run typecheck       → PASS
npm test                → PASS (live e2e remains skipped unless RUN_HELIUS_LIVE_E2E=1)
npm run build           → PASS
```

## Forbidden leak scan (tracked paths)

See implementer scan log in this report folder / session: no API keys, cookies, or credential-bearing Helius URLs in committed report JSON/MD.

## Artifacts

- `harness/inputs/SOL-CA-REAL-DATA-CLEANING-PILOT-001/input-manifest.json`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-001/batch-summary.json`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-001/execution-manifest.json`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-001/gap-matrix.md`
- `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-001/cas/<CA>/{input-manifest,cleaning-summary,holder-universes,concentration-metrics,data-quality-issues,ca-scan-response-v1}.json`

## How to re-run (manual)

```powershell
# From G:\链上战壕
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-solana-ca-real-data-cleaning-pilot.ps1
```

Requires DPAPI secret `%LOCALAPPDATA%\memecoin-ca-data-layer\secrets\HELIUS_API_KEY.dpapi`.
Missing credential → fail-closed `RUNTIME_CREDENTIAL_UNAVAILABLE` (no fixture masquerade).
