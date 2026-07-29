# Acceptance Report: GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-001

## 1. Metadata

| Field | Value |
| --- | --- |
| Task ID | `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-001` |
| HARNESS_AGENT_ID | `implementer-gmgn-wallet-stats-schema-contract-and-parser-hardening-001` |
| Branch | `codex/solana-daily-new-token-analysis` |
| Takeover Baseline SHA | `85f9503b2d68fecb328a8902db29575dcb4395e2` |
| Delivery SHA | `f3f0e32c506c019a442bf567a42e999b856bb359` |
| Network Budget | 0 |
| Provider Requests | 0 |
| GMGN CLI Invocations | 0 |
| Credential Reads | 0 |
| Address Processing | 0 |

## 2. Git Baseline & Parity

- Branch: `codex/solana-daily-new-token-analysis`
- Local HEAD = Remote SHA = `85f9503b2d68fecb328a8902db29575dcb4395e2`
- Ahead / Behind: 0 / 0
- Workspace clean before task: YES

## 3. Explicit Questionnaire & Answers

1. **是否彻底移除 arbitrary recursive candidate scanning？**
   YES. The recursive `collectCandidates` / `collectAggregates` functions and arbitrary deep traversal have been completely removed.

2. **是否移除 depth scoring？**
   YES. `candidateScore` and depth-weighted scoring logic have been removed.

3. **是否禁止跨节点字段拼接？**
   YES. All metrics for a parsed result must originate from the exact same validated wallet record within a recognized envelope. Cross-node or multi-depth field splicing is forbidden.

4. **支持哪些明确 envelope？**
   - Direct wallet record envelope: Object containing single wallet record fields (with matching wallet/address field or expected wallet context).
   - Wallet-keyed dictionary envelope: Object keyed by wallet address (`{ [walletAddress]: record }`).
   - Record-list envelope: Object containing array of records under `data`, `list`, `wallets`, or `results` where each record has a matching `wallet` or `address` field.

5. **支持哪些明确字段路径？**
   Explicit allowlist of metrics defined per supported period:
   - PnL: `realized_pnl`, `pnl`, `realized_profit`, `profit` (and period-bound `pnl_7d`/`pnl_30d` matching `expectedPeriod`).
   - Win Rate: `win_rate`, `winrate` (when explicitly fractional or percentage with clear schema).
   - Trade Count: `buy_count`, `sell_count`, `trade_count`, `tx_count`, `total_trades`.
   - Volume / Turnover: `volume`, `turnover`, `total_volume`.
   - Last Active Timestamp: `last_active_timestamp`, `last_active`, `updated_at`.

6. **字段契约证据来自哪里？**
   From offline inspecting local installed `gmgn-cli@1.5.4` type definitions/parser contracts and historical synthetic fixture assertions, without including `node_modules` in inputs/Git or invoking live APIs.

7. **哪些字段因证据不足而 fail-closed？**
   - Win Rate when unit (fraction vs percentage) is ambiguous: returns `winRate: null` with warning `gmgn_wallet_stats_win_rate_unit_ambiguous`.
   - Unknown/unsupported envelope formats or unexpected keys: fail-closed to `UNAVAILABLE` with `gmgn_wallet_stats_schema_unrecognized`.

8. **expectedPeriod 如何传入并验证？**
   `parseGmgnWalletStats` accepts `expectedPeriod: "7d" | "30d"`. If the payload self-describes period (e.g. `period`, `window`, `time_frame`), it must match `expectedPeriod`. If period-keyed fields (e.g. `pnl_7d` vs `pnl_30d`) are present, only fields matching `expectedPeriod` are read.

9. **period 冲突如何处理？**
   If explicit payload period conflicts with `expectedPeriod`, parsing returns status `UNAVAILABLE` with warning code `gmgn_wallet_stats_period_mismatch`. If payload does not self-describe period, warning `gmgn_wallet_stats_period_unverified` is emitted while binding to `expectedPeriod`.

10. **MAPPED/PARTIAL/UNAVAILABLE 的精确定义是什么？**
    - `MAPPED`: Envelope & wallet identity verified, expectedPeriod matches/bound, all core profit/trade metrics present and strictly typed, completeness = 1.0.
    - `PARTIAL`: Envelope, wallet identity, and expectedPeriod verified, but only a subset of allowlisted fields present (or non-fatal ambiguity in secondary fields); completeness < 1.0; includes allowlisted warning code.
    - `UNAVAILABLE`: Unrecognized envelope, identity mismatch, period conflict, missing all core profit fields, or invalid field types.

11. **completeness 如何计算？**
    Calculated as `(number of present and valid allowlisted fields) / (total allowlisted schema metrics)`. Missing or null fields do not count towards completeness. Explicit 0 values count as covered. completeness = 1.0 ONLY when all allowlisted fields are present and valid.

12. **显式 0 与字段缺失如何区分？**
    Missing fields yield `null` in output metrics. Explicit numeric `0` values from provider are preserved as `0`. Numbers are strictly parsed (no loose `Number(...)` casting of strings unless explicitly integer/float strictly validated). Explicit `0` is never interpreted as chain-verified zero profit.

13. **winRate 单位如何确定？**
    If the field schema is known to be in [0, 1] range (fractional) or [0, 100] range (percentage), it is mapped according to explicit contract. If ambiguous without contract proof, set `winRate: null` and emit `gmgn_wallet_stats_win_rate_unit_ambiguous`.

14. **未知 Schema 如何处理？**
    Fail-closed to `UNAVAILABLE` with warning `gmgn_wallet_stats_schema_unrecognized`. Unknown keys are ignored and never leaked.

15. **wallet-profile-pilot、7d smoke、30d smoke 是否都使用新的 completeness？**
    YES. All consumers now consume the genuine `completeness` returned by `parseGmgnWalletStats` instead of overriding `MAPPED => 1`.

16. **source/verificationStatus 是否保持 gmgn/unverified？**
    YES. `source` is strictly `"gmgn"`, `verificationStatus` is strictly `"unverified"`.

17. **是否发送过任何网络或 Provider 请求？**
    0. Strictly offline.

18. **是否读取过任何凭证？**
    0.

19. **是否读取过任何真实地址？**
    0. Synthetic test addresses only.

20. **是否修改历史 Live 输出？**
    NO.

21. **是否授权重跑 100/1,433？**
    NO.

22. **是否声明 Signed Holdings/累计盈利恢复？**
    NO.

## 4. Declaration

本任务 GREEN 只证明 Wallet Stats Parser 的离线 Schema Contract、安全降级和 Consumer 完整度逻辑通过；不证明 GMGN 当前 Live Schema 与 Parser V2 实际兼容。实际兼容性必须由后续独立、小预算 Live Regression 任务验证。

## 5. Post-Delivery Write Set Boundary Correction

> Added by repair task `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-001`.

Historical commit `214c010c3200601657b509bbb49431b4fb2e1412` modified the following files outside the original task's declared write_set:
- `harness/gmgn-wallet-stats-live-smoke.ts`
- `src/application/gmgn/portfolio-three-path-live-diagnostic.ts`
- `test/application/gmgn/portfolio-three-path-live-diagnostic.test.ts`

Repair task `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-001` explicitly includes these files within its tracked write_set, repairs all schema/parser/consumer contracts, and provides dedicated tests. Original audit task `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-AUDIT-001` is set to `BLOCKED_DEPENDENCY` until `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-AUDIT-001` completes GREEN.
