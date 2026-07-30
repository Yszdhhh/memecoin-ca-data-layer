# SOL-HELIUS-MANUAL-CA-BATCH-LIVE-SMOKE-AUDIT-001

## Verdict

GREEN

The audit scope passes with no P0, P1, P2 or P3 findings. This verdict certifies
the integrity and safety of the fixed ten-CA smoke evidence. It does not upgrade
the implementation task's `PARK` result and does not claim that any CA returned
complete live Helius data.

## Independence and boundary

- Auditor identity: `codex-auditor-sol-helius-batch-live-smoke-001`.
- Audit was read-only apart from this report and Harness-owned ignored run evidence.
- No Helius, GMGN or other provider call was made by the auditor.
- No credential, ignored live log, raw payload or arbitrary provider text was inspected.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.

## Evidence

### Fixed input identity

The ten CAs frozen in
`harness/tasks/SOL-HELIUS-MANUAL-CA-BATCH-LIVE-SMOKE-001.json` are present once
each and in the same order in
`harness/reports/SOL-HELIUS-MANUAL-CA-BATCH-LIVE-SMOKE-001/acceptance.md`.
An independent offline comparison found ten task addresses, ten report addresses,
no duplicates and no mismatch.

### Strict validation before source construction

- `src/domain/solana-address.ts` decodes Base58 locally and accepts only a decoded
  length of exactly 32 bytes.
- Independent offline decoding accepted all ten fixed CAs and found zero invalid
  addresses.
- `src/application/live/solana-live-ca-batch.ts` validates the count, uniqueness
  and every address before entering the loop that invokes `sourceFactory()`.
- `test/application/live/solana-live-ca-batch.test.ts` proves an invalid batch
  creates zero sources.

### Bounded Helius-only execution

- `src/cli/run-solana-live-ca-batch.ts` wires only `LiveHeliusDataSource` and sets
  `requestBudget: 3` for each CA.
- `src/application/live/solana-live-ca-first.ts` performs only the bounded mint,
  metadata and holder-token-account reads.
- `src/infrastructure/solana/helius/live-helius-data-source.ts` reserves budget
  before requests and documents the read-only, in-memory credential, no-fallback
  boundary.
- The batch receives CAs only from manually supplied CLI arguments; no scheduler,
  discovery loop, persistence, cache, queue, BSC or Robinhood path is activated.

### Sanitization and committed evidence

- `src/application/live/solana-live-warning.ts` exposes only an exact safe warning
  allowlist and collapses arbitrary errors to a safe fallback code.
- `src/application/live/solana-live-ca-first.ts` retains only the sanitized code
  when a read fails.
- The acceptance report contains only CA, status, completeness, bounded count,
  slot, warning code and budget outcome.
- Focused scanning found zero HTTP/HTTPS URLs, credential query parameters,
  Helius hostnames or raw JSON-RPC envelopes in the committed report.

### PARK result accuracy

All ten rows report `DEGRADED`, `unavailable (0/3)`, no source slot and the
allowlisted warning `helius_transport_unavailable`. The report explicitly says
that no CA produced a complete Helius result. `PARK` is therefore the accurate,
fail-closed implementation verdict; the result is not represented as live data
success.

## Offline acceptance

- `npm run harness:doctor`: exit 0, GREEN.
- `npm run typecheck`: exit 0.
- `npm test`: exit 0; 218 tests, 217 passed, 0 failed, 1 live test skipped.
- `npm run build`: exit 0.
- `git diff --check`: exit 0.

## Conclusion

The fixed-input live attempt, its scrubbed report and the repository controls are
internally reproducible and preserve the approved Solana-only, Helius-only,
manual, read-only, bounded and fail-closed boundary. The outstanding operational
fact remains unchanged: this environment returned only
`helius_transport_unavailable`, so live completeness is not demonstrated.