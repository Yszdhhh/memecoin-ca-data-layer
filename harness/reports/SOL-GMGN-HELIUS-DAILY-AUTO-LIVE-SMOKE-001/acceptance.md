# SOL-GMGN-HELIUS-DAILY-AUTO-LIVE-SMOKE-001 acceptance

## Outcome

**PARK — live GMGN discovery succeeded, but the bounded workflow correctly rejected Helius analysis because only 2 eligible candidates remained after strict filtering.**

- Executed at: `2026-07-28T07:56:07.410Z`
- Chain: Solana only
- Discovery provider: GMGN only
- Chain-data provider: Helius only, but not invoked in this run
- Trigger: one manual invocation
- Result status: `REJECTED`
- Selected candidates: 2
- Analyzed candidates: 0
- Warning code: `gmgn_candidate_count_below_5`
- Sanitized local report: `C:\Users\10639\AppData\Local\memecoin-ca-data-layer\reports\2026-07-28T07-56-07-410Z.json`

## Criteria and request bounds

- created no more than 24 hours before the observation time
- provider-reported market capitalization strictly above USD 1,000,000
- market-cap-descending order
- minimum 5, maximum 10
- no padding, guessing, substitution or provider fallback
- GMGN maximum: 2 HTTP attempts for one fixed CLI discovery invocation
- Helius maximum: 3 requests per CA and 30 per batch
- actual Helius source constructions and requests in this run: 0

## Sanitized candidate summary

All market, holder, creator and risk values below are GMGN `unverified_provider_claim` fields, not independently verified Helius facts.

| CA | Symbol | Market cap USD | Created at UTC | Holder count | Top-10 rate | Dev-team hold rate | Insider rate | Bundler rate | Sniper count | Helius status |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `9ufyZ2pyL9Apa7fB7JdHnSujhYTQ4Y19qNdBEgJUpump` | `USOP` | 13,434,300 | 2026-07-28T05:50:22.000Z | 3,092 | 0.0931 | 0.0910228444 | 0 | 0.0906 | 4 | not invoked; batch below minimum |
| `EUx9N4UXDyAXJpziyLF36j6Ut3Gu9X3VKEGptbmfpump` | `bulltom` | 1,171,370 | 2026-07-27T22:47:28.000Z | 2,174 | 0.1624 | 0 | 0 | 0.0539 | 20 | not invoked; batch below minimum |

## Safety evidence

- DPAPI credentials were successfully decrypted by the current-user runner without displaying their values.
- The application emitted only its normalized report contract and a local sanitized report path.
- No raw GMGN payload, Helius payload, credential, credential-bearing URL or arbitrary provider error was persisted in this acceptance report.
- Strict minimum-candidate enforcement prevented construction of any Helius source when fewer than 5 candidates were eligible.
- No database, cache, queue, address library, schedule, production system or trading action was written or invoked.

## Interpretation

The live discovery and filtering path is operational. The Helius batch-analysis path was intentionally not exercised because the live eligible set contained only 2 tokens. A later scheduled or manual run may proceed automatically when at least 5 candidates satisfy the same fixed criteria; this task must not broaden the query or pad the batch merely to force an analysis.
