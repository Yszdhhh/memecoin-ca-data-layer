# Dispatch: CA-SCAN-RESPONSE-V1-001

- **Task ID:** `CA-SCAN-RESPONSE-V1-001`
- **Role:** implementer
- **Tier:** T2
- **Layer:** judgment_layer
- **HARNESS_AGENT_ID:** `implementer-ca-scan-response-v1-001`
- **Branch:** `codex/ca-scan-response-v1-001`
- **Worktree:** `G:\链上战壕-codex-ca-scan-response-v1-001` (isolated; do not touch `codex/solana-daily-new-token-analysis`)
- **Baseline SHA:** `f561ab5b7f67f271e2697dafbb7181c7f09085cb`
- **Network budget:** Strictly 0 (offline-only task)
- **Independent auditor (must not be implementer):** `auditor-ca-scan-response-v1-001` (follow-up audit task, not this dispatch)

## Assignment objective

Design and implement a **provider-neutral, versioned, fixture-driven**
`CaScanResponse` **v1** domain output contract. The contract only composes
already-normalized data and judgment evidence. It must not fetch live data,
implement any provider, or change the current Helius-only provider boundary.

## Required structures

- token identity
- market snapshot
- authority facts
- holder universes
- cohort metrics
- wallet-token signals
- cluster summaries
- dev behavior
- cross-token matches
- judgment evidence
- source provenance
- completeness
- warnings

### HolderUniverse keys (all required when section present)

- `raw_top_holders`
- `owner_aggregated_holders`
- `cleaned_top_holders`
- `excluded_infrastructure`
- `excluded_pools`
- `excluded_burn_addresses`

### Ratio / concentration metrics must carry

- `numerator`
- `denominator`
- `universeDefinition`
- `ruleVersion`
- `completeness`
- `provenance`

### JudgmentEvidence must carry

- `judgmentCode`
- `humanReadableSummary`
- `evidenceRefs`
- `confidence`
- `ruleVersion`
- `sourceTier`
- `completeness`
- `warnings`

## Write set (exact)

- `src/domain/contracts/ca-scan-response-v1.ts`
- `test/domain/contracts/ca-scan-response-v1.test.ts`
- `fixtures/ca-scan-response/v1/minimal-complete.json`
- `fixtures/ca-scan-response/v1/degraded-partial.json`
- `docs/contracts/CA_SCAN_RESPONSE_V1.md`
- `harness/tasks/CA-SCAN-RESPONSE-V1-001.json`
- `harness/dispatches/CA-SCAN-RESPONSE-V1-001.md`
- `harness/reports/CA-SCAN-RESPONSE-V1-001/acceptance.md`

## Forbidden

- Hotsniper API / private fields / cookies / secrets
- DexScreener, Birdeye, GMGN, Rugcheck, or new providers
- Any network request
- LLM judgment
- Tier-B labels as confirmed conclusions
- Wallet scoring / GMGN parser / master-table builder / parallel repair write set
- Whole-repo directory migration
- New dependencies / `package.json` edits
- API server, worker, DB migration, UI
- Merge / push / commit to main without Owner authorization
- Editing the existing `codex/solana-daily-new-token-analysis` worktree

## Acceptance commands

```text
npm run typecheck
npm test
npm run build
git diff --check
```

## Acceptance criteria

1. schema/version explicit
2. complete fixture validates
3. degraded fixture retains warnings + completeness; no fake precision
4. Tier-A / Tier-B provenance distinguishable
5. numerator, denominator, universe definition never missing on ratio metrics
6. judgment layer has no network calls or provider imports
7. no Hotsniper private fields / cookies / secrets / private APIs
8–11. quality commands above pass
12. report actual changed files, test results, git status before/after any commit
13. do not expand into provider, database, directory migration, or scoring work

## Verdict vocabulary

`GREEN` | `GREEN_WITH_ADVISORY` | `PARK` | `FAIL` | `QUARANTINED`
