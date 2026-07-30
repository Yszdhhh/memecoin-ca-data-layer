# Acceptance Report: GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-001

## 1. Metadata

| Field | Value |
| --- | --- |
| Task ID | `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-001` |
| HARNESS_AGENT_ID | `implementer-gmgn-wallet-stats-schema-contract-parser-hardening-repair-001` |
| Branch | `codex/solana-daily-new-token-analysis` |
| Baseline SHA | `214c010c3200601657b509bbb49431b4fb2e1412` |
| Network Budget | 0 |
| Provider Requests | 0 |
| GMGN CLI Invocations | 0 |
| Credential Reads | 0 |
| Real Address Processing | 0 |

## 2. Git Baseline & Parity

- Branch: `codex/solana-daily-new-token-analysis`
- HEAD = `214c010c3200601657b509bbb49431b4fb2e1412`
- Remote `origin/codex/solana-daily-new-token-analysis` = `214c010c3200601657b509bbb49431b4fb2e1412`
- Ahead / Behind: 0 / 0
- Workspace clean at start: YES (`git status --short` empty)

## 3. Explicit Questionnaire & Answers

1. **原交付 SHA 214c010c3200601657b509bbb49431b4fb2e1412 的 Write Set 越界问题是否修复？**
   YES. The original task's write set boundary overrun has been acknowledged via an append-only post-delivery section (§5) in `harness/reports/GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-001/acceptance.md`. This Repair task's write set explicitly tracks `harness/gmgn-wallet-stats-live-smoke.ts`, `src/application/gmgn/portfolio-three-path-live-diagnostic.ts`, and `test/application/gmgn/portfolio-three-path-live-diagnostic.test.ts`. Original Audit task `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-AUDIT-001` has been set to `BLOCKED_DEPENDENCY` until `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-AUDIT-001` passes GREEN.

2. **expectedPeriod 是否已成为 mandatory 契约？**
   YES. `parseGmgnWalletStats` now mandates `expectedPeriod: "7d" | "30d"`. Optional parameters, default fallbacks ("7d"), and undefined fallbacks have been removed. Attempting to call `parseGmgnWalletStats` without an explicit `"7d"` or `"30d"` fails at compile-time and throws a runtime exception. All callers (`wallet-profile-pilot.ts`, `proxy-transport-7d-live-smoke.ts`, `proxy-transport-30d-live-smoke.ts`, `portfolio-three-path-live-diagnostic.ts`, `harness/gmgn-wallet-stats-live-smoke.ts`, and all unit tests) have been updated to pass `expectedPeriod` explicitly.

3. **是否彻底禁止跨节点 aggregate composition？**
   YES. Metric extraction is container-isolated. A wallet record evaluates candidate metric containers (`record` root scalars, `record.pnl_stat`, `record.stats`). Metrics are extracted strictly from a single, uniquely selected metric container. If multiple containers contain valid metrics (cross-node splitting or conflicting values), the parser fails closed with `UNAVAILABLE` and warning `gmgn_wallet_stats_schema_unrecognized`.

4. **completeness 是否仅包含 Provider 明确存在的合法指标？**
   YES. Completeness is calculated strictly as `validCount / 11` for fields explicitly present and valid in the selected container. `tradeCount` is NO LONGER derived from `buyCount + sellCount`. If a provider returns 10/11 fields (missing `trade_count` key), completeness is `10/11 = 0.91`, status is `PARTIAL`, and status is NOT `MAPPED`.

5. **显式但不支持的 period 是否 fail-closed？**
   YES. Self-describing period fields ("period", "window", "time_frame", "timeframe", "bucket") with unsupported values (e.g. "90d", "all", "1d", "unknown", "") return status `UNAVAILABLE` with warning code `gmgn_wallet_stats_period_mismatch` and do NOT attempt to read general PnL fields.

6. **winRate 单位是否按字段别名显式契约化？**
   YES. `winRate` keys nominally representing percentage (`win_rate`, `winrate`, `win_rate_percent`, `winning_rate`) require values in range [0, 100]. If a value `v` is strictly between 0 and 1 (`0 < v < 1`, e.g. `0.4`), it is treated as ambiguous, `winRate` is set to undefined, and warning `gmgn_wallet_stats_win_rate_unit_ambiguous` is added. Explicit ratio fields (`win_rate_ratio`, `winrate_ratio`) in range [0, 1] convert to percentage. Out-of-range values fail closed safely.

7. **Numeric string 是否按字段契约处理？**
   YES. Numbers and audited numeric strings matching `/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/` are parsed strictly. `NaN`, `Infinity`, `-Infinity`, scientific notation (`1e5`), text with trailing units (`"10.5 SOL"`), empty strings, objects, and arrays are rejected with warning `gmgn_wallet_stats_invalid_field_type`.

8. **Consumer 状态是否保持语义一致？**
   YES. `proxy-transport-7d-live-smoke.ts` and `proxy-transport-30d-live-smoke.ts` now map Parser `MAPPED` to top-level `SUCCESS`, Parser `PARTIAL` to top-level `PARTIAL`, and Parser `UNAVAILABLE` to top-level `UNAVAILABLE`. `PARTIAL` is no longer wrapped into `SUCCESS`.

9. **测试是否增加了全面的反例覆盖？**
   YES. Unit tests cover:
   - Cross root/stats composition rejection
   - pnl_stat/stats conflict rejection
   - Provider 10/11 fields without tradeCount -> PARTIAL (completeness 0.91)
   - Mandatory expectedPeriod (compile-time & runtime)
   - 30d caller passing 30d
   - Unsupported explicit period fail-closed ("90d", "all", "1d", "unknown", "")
   - Ambiguous winRate fail-closed (`win_rate = 0.4`)
   - Consumer PARTIAL -> PARTIAL status propagation
   - Decoy node rejection
   - Explicit 0 preservation
   - Missing field null/undefined representation
   - Invalid numeric types (NaN, Infinity, "10.5 SOL", {}, [])
   - All modified files in write_set and audit inputs.

10. **预算消耗**
    - `network_requests`: 0
    - `provider_requests`: 0
    - `gmgn_cli_invocations`: 0
    - `credential_reads`: 0
    - `real_address_processing`: 0

## 4. Declaration

本 Repair 任务 GREEN 证明 Wallet Stats Parser 及 Consumer 状态映射层修复完成，并通过了完整的离线单元测试与 Harness 质量关卡。不包含任何 Live Provider/CLI 调用。
