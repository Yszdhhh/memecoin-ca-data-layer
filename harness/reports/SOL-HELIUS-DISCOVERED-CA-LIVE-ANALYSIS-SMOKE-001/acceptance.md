# SOL-HELIUS-DISCOVERED-CA-LIVE-ANALYSIS-SMOKE-001 acceptance

## Outcome

**GREEN_WITH_ADVISORY — the existing bounded Helius CA-first batch executed exactly once for the two specified Solana CAs and returned sanitized partial results under fail-closed timeout handling.**

- Executed on: `2026-07-28`
- Chain: Solana only
- Provider: Helius only
- Endpoint mode: allowlisted Gatekeeper beta
- Trigger: one manual batch invocation
- Batch status: `DEGRADED`
- Requested CAs: 2
- Batch warnings: none
- Maximum requests: 3 per CA, 6 for this batch

## Sanitized CA-first summary

| CA | Status | Mint | Decimals | Metadata | Holder token accounts | Completeness | Available / required | Mint finalized slot | Holder indexed slot | Warning codes |
| --- | --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | --- |
| `9ufyZ2pyL9Apa7fB7JdHnSujhYTQ4Y19qNdBEgJUpump` | `DEGRADED` | available | 6 | unavailable | unavailable | partial | 1 / 3 | 435704889 | unavailable | `helius_timeout`, `helius_timeout` |
| `EUx9N4UXDyAXJpziyLF36j6Ut3Gu9X3VKEGptbmfpump` | `DEGRADED` | available | 6 | unavailable | available: 1,000 bounded rows | partial | 2 / 3 | 435704914 | 435704941 | `helius_timeout` |

Metadata indexed slots were unavailable for both CAs.

## Safety and boundary evidence

- Both CAs were fixed in the task spec; the run did not discover, add, guess or substitute addresses.
- Address validation and bounded batch construction used the existing reviewed CA-first implementation.
- The run used the current-user DPAPI credential wrapper without displaying the credential value.
- This report records only normalized availability, counts, slots and warning codes.
- No raw provider payload, arbitrary provider text, full exception text, API key or credential-bearing URL was printed or persisted here.
- No database, cache, queue, address library, schedule, production system, transaction, signing or trading action was invoked.
- No holder concentration, owner clustering, creator history, Dev behavior or wallet classification is inferred from these bounded token-account results.

## Interpretation

The Helius CA-first path is operational but the observed provider calls were partially degraded by bounded timeouts. The second CA returned 1,000 token-account rows, which is a bounded count only and is not a holder count or concentration analysis. This diagnostic does not satisfy the daily workflow's required 5–10 candidate batch and does not activate scheduling.
