# Field dictionary — wallet intelligence v0.1

## Identity
| Field | Type | Notes |
| --- | --- | --- |
| address | string | Solana base58 |
| wallet_fingerprint | string | sha256(address) |
| existing_labels / existing_label | string[] | source claims only |
| existing_note | string | primary label text |
| source_claims | string[] | union of labels + note |
| confirmed_label / confirmed_behavior_labels | null | never auto-filled |

## GMGN transport / trust
| Field | Notes |
| --- | --- |
| source_type | always `borrowed` |
| verification_status | always `unverified` |
| transport_requested_period | 7d / 30d as requested |
| provider_attested_period | null when period_unverified |
| confidence_cap / data_confidence | low \| medium \| none |
| gmgn_*_status | MAPPED \| PARTIAL \| UNAVAILABLE \| ABSENT |
| gmgn_*_completeness | [0,1] or null |

## Metrics (null if missing; 0 only if provider sent 0)
profit_7d, profit_30d, win_rate_7d, win_rate_30d, buy_count, sell_count, trade_count_proxy, token_count, last_active_at, average_profit_per_trade_proxy, average_profit_per_token_proxy, seven_day_vs_thirty_day_consistency

## Screening
| Field | Notes |
| --- | --- |
| gmgn_lead_score | internal screening score only |
| gmgn_lead_tier | TOP_LEAD…UNQUALIFIED |
| gmgn_lead_reason_codes | reproducible codes |
| candidate_categories | A–H multi-label |
| candidate_reason_codes | per selection rule |
| human_review_status | PENDING_HUMAN_REVIEW |

## Forbidden / always null
alpha_score, final_wallet_score, final_wallet_grade, confirmed_behavior_labels
