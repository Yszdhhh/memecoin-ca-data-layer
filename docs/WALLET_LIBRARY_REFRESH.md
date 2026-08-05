# Wallet identity library refresh v1

This MVP is a deterministic local refresh over a private, normalized input file. It keeps identity, social influence, trading quality, data confidence, followability, and freshness as separate fields and scores. Follower counts never affect the trading-quality score, and a follower count is eligible for a GMGN note only when the input explicitly records `VERIFIED_WALLET_MATCH`.

The repository does not contain wallet data, provider responses, social cookies, or absolute machine paths. Build a private `wallet-library-input-v1.json` from the existing SOL and BSC masters. The input contains one record per address, normalized statistics, raw labels, and source hashes; it is not a provider raw-response cache.

## Run

```text
npm run wallet:library:refresh -- --input <private-input.json> --output-root <private-output-root> --mode daily --run-id <stable-run-id> --run-at <fixed-iso-time> --cache-replay
```

`--mode` accepts `daily`, `weekly`, or `monthly`. The mode is recorded in the private manifest; all modes use the same deterministic transform. A future upstream refresh can replace the private input without changing the library code.

Use `--dry-run` to validate and summarize without writing files. Use a fixed `--run-id` and `--run-at` for a reproducibility check. The output root is private and contains:

- `snapshots/<run-id>/`: immutable full library, tier CSVs, identity aliases, social fields, cohort benchmarks, and refresh manifest;
- `latest/`: a copy of the current snapshot plus current GMGN exports and the BSC label review;
- `diffs/<run-id>/`: categorized address, identity, social, note, and material-stat changes;
- `exports/<run-id>/`: chain-separated CORE/WATCH JSON, paste text, and export manifest;
- `backups/<run-id>/`: a retained full copy of each snapshot.

GMGN JSON items contain exactly `address`, `name`, and `emoji`. The export status remains `FORMAT_PENDING_UI_SMOKE` until the Owner supplies the current account export template and manually confirms the two-wallet smoke test. This tool never opens a logged-in page.

## Identity rules

Aliases are normalized conservatively: chain prefixes, generic wallet/address words, duplicate emoji, case/space differences, and explicit address-like suffixes are removed. Exact normalized aliases are clustered; similar-looking names are not fuzzy-merged. A repeated alias cluster is still a label-derived identity signal, not a proof that two labels identify a person. Missing identity data remains `UNKNOWN`, while a single unresolved handle remains `HANDLE_ONLY`.

The private BSC review file `bsc_label_review.csv` contains addresses with at least three raw labels, sorted by raw label count. It includes the original current GMGN note, the proposed dynamic note, raw labels, identity confidence, tier, and a retain/review recommendation. This is the Owner's keep/drop review surface; no address is physically deleted by the refresh.

## Data semantics

`null`, `0`, and unknown status are preserved separately. Payoff is emitted only from an explicit payoff ratio or both average-profit and average-loss fields. Provider PnL remains tagged as provider data and is not represented as chain-reconstructed profit. Contracts are retained in the full library with `EXCLUDED_CONTRACT` and are excluded from GMGN exports. Social enrichment in this MVP is cache-only and does not make public claims without a complete-wallet-address match.

