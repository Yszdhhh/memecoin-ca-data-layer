# External CA Review Alignment — 2026-07-21

## Scope and provenance

This record summarizes the external mid-term review supplied to the project
coordinator on 2026-07-21. It is a planning input, not a replacement for
fixture evidence, source watermarks, tests or an independent audit.

## Locally verified findings

1. The pinned Pump decoder, complete-only holder snapshot service and
   complete-from-creation Dev-history service have passed their respective
   independent remediation audits.
2. The final `AnalysisService` and Helius adapter do not yet compose those
   audited services: creator evidence is omitted by the adapter, holder
   concentration bypasses the snapshot completeness gate, and Dev behavior
   bypasses the Dev-history coverage gate.
3. Wallet quality currently labels large orders. It must remain separate from
   holder exclusion. Funding-cluster service-funder suppression remains a known
   limitation.
4. An externally supplied review identified an exposed Dune credential in a
   tracked instruction document. Its value is not retained in this record.
   The current Harness checks forbidden tracked file names but not sensitive
   content in ordinary documentation.

## Decisions translated into tasks

| Task | Decision |
| --- | --- |
| `SOL-CA-ORCHESTRATION-001` | Final CA output must consume audited creator, holder and Dev services and expose structured completeness/evidence. |
| `SOL-WALLET-CLEANING-003` | Wallet quality and holder exclusion remain separate; service funders require evidence-backed suppression. |
| `SEC-HARNESS-CONTENT-SCAN-001` | Credential containment and content scanning are Owner-gated and separate from CA implementation. |
| `SOL-E2E-001` | Fixture plus an explicitly authorized live CA remains the only Solana E2E completion gate. |

## Boundaries

- Solana/Pump.fun remains the only active CA delivery chain.
- BSC and Robinhood stay stage-blocked.
- Macro and liquidity reporting is owned by the separate PC-side workstream;
  it cannot change CA facts, wallet cleaning, holder concentration or Dev
  behavior.
- No task in this wave authorizes a provider credential, live request,
  database backfill, message delivery or trading behavior.
