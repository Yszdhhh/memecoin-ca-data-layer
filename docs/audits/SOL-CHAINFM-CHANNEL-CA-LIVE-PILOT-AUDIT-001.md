# SOL-CHAINFM-CHANNEL-CA-LIVE-PILOT-AUDIT-001

## Verdict

**GREEN_WITH_ADVISORY** — the implementation run is reproducible from the frozen task, its sanitized report, the local Harness manifest and the reviewed CA-first code path. It honored the stated scope and fail-closed behavior. The advisory is operational: every lookup returned the sanitized `helius_transport_unavailable` warning code, so the run produced no usable on-chain data and no token- or wallet-level conclusion.

## Independent audit boundary

- Audit task: `SOL-CHAINFM-CHANNEL-CA-LIVE-PILOT-AUDIT-001`
- Audited task: `SOL-CHAINFM-CHANNEL-CA-LIVE-PILOT-001`
- Implementation Harness identity: `codex-chainfm-live-implementer-001`
- Auditor Harness identity: `codex-chainfm-live-auditor-001`
- Mode: read-only; no provider, Chain.fm or other network call was made during this audit.

## Evidence reviewed

1. The implementation task freezes exactly seven CA strings and describes the three Owner-specified Chain.fm channel IDs. It explicitly treats labels and displayed market-cap figures as borrowed/unverified and says the visible sample from channel `1307532946063757359` did not contribute a candidate represented as above USD 1 million.
2. `src/domain/solana-address.ts` Base58-decodes the input and accepts it only when it is exactly 32 bytes. `src/application/live/solana-live-ca-batch.ts` validates every candidate before calling the source factory; its batch maximum is ten, so the frozen seven-CAs are in range.
3. `src/application/live/solana-live-ca-first.ts` independently normalizes the CA before source construction and makes only the three bounded reads (mint, metadata and token accounts). It sanitizes thrown errors through `safeSolanaLiveWarning`.
4. The implementation manifest records one `GREEN_WITH_ADVISORY` run from the different implementer identity, a clean start commit, only the acceptance-report path as changed output, all six acceptance commands passed, and every integrity flag true.
5. The implementation report records all seven CAs, `0 / 3` available fields, no slots, and exactly three `helius_transport_unavailable` warning codes per CA. It contains no raw provider response, exception text, credential or credential-bearing URL.

## Control checks

| Check | Result | Basis |
| --- | --- | --- |
| CA validation before Helius source construction | PASS | strict Base58 + 32-byte normalization, followed by all-CAs validation before `sourceFactory()` |
| Batch freeze / no discovery or substitution | PASS | seven CAs are explicit in the task; report matches the fixed list |
| Helius-only, manual, read-only and bounded | PASS | task forbids other providers; code has three reads per CA; report records one seven-CA invocation and a 21-request maximum |
| Error / secret sanitization | PASS | only normalized warning codes are recorded; audit found no raw payload, arbitrary provider text, full exception or credential in the report |
| Chain.fm privacy boundary | PASS | opaque account route identifiers are not treated as wallet addresses or passed to Helius |
| External labels and market caps | PASS | reported as borrowed/unverified, not as on-chain facts |
| Unsupported wallet / creator claims | PASS | no holder concentration, creator/Dev behavior, PnL, win-rate or wallet-classification claim is made |
| Harness evidence / acceptance | PASS | task validation, doctor, typecheck, tests, build and diff check all passed in the implementation manifest |

## Advisory and interpretation

The audit does **not** attest that any candidate is a good token, has a particular market cap, or is associated with a profitable / high-quality wallet. The live transport outcome was unavailable for all three CA-first fields on every candidate. A future retry must be a newly dispatched, separately bounded task after diagnosing the Helius transport; it must not reuse this task for an additional request batch.