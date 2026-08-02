# Wallet HUD v0.2 methodology

This implementation is a deterministic, offline refresh for exactly the 32-address SOL candidate union. It does not fetch GMGN, Helius, Solana RPC, or any other provider, and it does not start a monitor or shadow-follow process.

## Evidence and samples

- Provider aggregates remain `BORROWED_PROXY`; they are not chain-verified.
- The five wallet-chain pilot rows are marked `CHAIN_SAMPLED`, but all derived values remain sample-bounded proxies and must not be read as complete wallet PnL.
- Missing, partial, unverified-period, transfer-cost, and pagination evidence lowers confidence; null values remain null.
- Effective sample counts are explicitly labelled as `tokens` or `events` and are not lifetime counts.

## Scene comparison

The five supported scenes are `MULTI_TOKEN_REPEATABILITY`, `PAYOFF_ASYMMETRY`, `ACTIVITY_PERSISTENCE`, `HIGH_FREQUENCY_SIGNAL_VALUE`, and `TRANSFER_ACCOUNTING_RISK`. Each scene is scored independently. Percentiles are computed only against wallets sharing the same primary scene, and are suppressed when that cohort has fewer than ten wallets. No cross-scene percentile or global wallet score is emitted.

`TRANSFER_ACCOUNTING_RISK` is a risk indicator: a higher value means greater accounting risk, not stronger trading ability. `HIGH_FREQUENCY_SIGNAL_VALUE` is observation value only and is not followability.

## Labels and exports

GMGN names use the bounded format `主场景｜Pxx或强度待标｜Nxx｜趋势或主要风险`. The local state stores sample units, evidence tier, confidence, and reason codes. Full and delta imports contain only the 32 candidate addresses in private output. The delta is evaluated against the existing v0.1 state and is therefore a model-migration preview on first refresh.

## History and determinism

Every refresh records the previous state, new state, reason codes, source snapshot hash, evaluation timestamp, and label version. The evaluation timestamp is fixed by the offline runner unless explicitly supplied. With identical input hashes and timestamp, output is deterministic. Since shadow event count is zero, no shadow win rate, profit factor, latency, or followability percentile is generated.

## Scope boundary

This is a scene-strength HUD, not a formal Alpha Score, global ranking, direct follow recommendation, or trading instruction. Private addresses, raw provider responses, raw transactions, and `chainfm_out` outputs remain outside Git.

## Repair-002 controls

- `ACTIVITY_PERSISTENCE` eligibility follows a non-inactive provider activity tier even when `trade_count_proxy` is null; the score emits `ACTIVITY_EVENT_COUNT_UNKNOWN` instead of collapsing to zero.
- Reproduction thresholds use verified profit-token counts for chain-sampled rows: `MULTI_TOKEN_REPEATABILITY >= 3` and `PAYOFF_ASYMMETRY >= 2`. Loss-only samples do not satisfy either threshold.
- GMGN delta debounce compares against the last emitted baseline; below-threshold movement is held with `GMGN_NAME_HELD_FOR_CUMULATIVE_DEBOUNCE`.
- State history is append-only. A deterministic `source_snapshot_hash` and redacted `source_hashes.json` are emitted; no raw addresses or provider payloads are included in evidence reports.
