# Independent Audit Report: GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-003-AUDIT-001

## 1. Audit Metadata

| Field | Value |
| --- | --- |
| Task ID | `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-003-AUDIT-001` |
| HARNESS_AGENT_ID | `auditor-gmgn-wallet-stats-schema-contract-parser-hardening-repair-003` |
| Role | `auditor` |
| Branch | `codex/solana-daily-new-token-analysis` |
| Takeover Baseline SHA | `840f1dd1a7426613e19ee55ea5e07e2a861ef290` |
| Audited Implementation SHA | `0b7ce3c8c5efc11d6c625cc4df99395caf39c004` |
| Evidence Repair SHA | `f7259bcaf7b59302c09b43842d1c615c6ebbf000` |
| Evidence Repair Audit SHA | `a93ae1956f39dba6f94777f55eaaed73b8d0672c` |
| Dependency Unlock SHA | `840f1dd1a7426613e19ee55ea5e07e2a861ef290` |
| Network Budget | 0 |
| Provider Requests | 0 |
| GMGN CLI Invocations | 0 |
| Credential Reads | 0 |
| Real Address Processing | 0 |
| Final Verdict | **GREEN** |

## 2. Code Audit Findings

### A. WinRate Unit Contract (WinRate 单位契约)
1. **Explicit Percent Alias (`win_rate_percent`)**:
   - Accepts only finite JSON numbers in range `[0, 100]`.
   - Test cases verify values 0, 0.4, 1, 45.5, 100 are deterministically accepted as percentages.
   - Values < 1 are NOT guessed to be ratios; `win_rate_percent: 0.4` is strictly parsed as `0.4%`.
2. **Explicit Ratio Alias (`win_rate_ratio`, `winrate_ratio`)**:
   - Accepts only finite JSON numbers in range `[0, 1]`.
   - Values 0, 0.4, 1 map deterministically to percentages 0, 40, 100 (`Math.round(num * 100 * 100) / 100`).
3. **Generic Aliases (`win_rate`, `winrate`, `winning_rate`, `win_rate_7d`, `win_rate_30d`)**:
   - When no explicit schema unit evidence is present, unit is NOT guessed based on value magnitude.
   - `winRate` aggregate is omitted from output.
   - An allowlisted `gmgn_wallet_stats_win_rate_unit_ambiguous` warning is appended.
   - Parsing of other valid profit and volume metrics is NOT interrupted.
4. **Alias Family Conflict**:
   - Co-existence of conflicting alias families (e.g., both percent and ratio aliases present, or generic and explicit aliases co-present) triggers `gmgn_wallet_stats_alias_conflict` and fails closed.

### B. Strict Field Type Enforcement (严格字段类型)
1. **JSON Number Validation**:
   - Uses `parseStrictNumber` (`typeof val === "number" && Number.isFinite(val)`).
   - Numeric strings (e.g. `"123.45"`), `NaN`, `Infinity`, `{}` (object), `[]` (array), `""` (empty string), and strings with units are strictly rejected.
2. **Zero Value & Null Handling**:
   - Explicit numeric `0` is preserved as `0`.
   - Missing fields remain `null`/`undefined`; numeric metrics are never fabricated or defaulted to 0.

### C. Precise Diagnostic Retention (精确诊断保留)
1. **Invalid Field Type Retention**:
   - When fields contain invalid types (e.g., `pnl: "123.45"`, `realized_profit: {}`, `bought_cost: []`), `gmgn_wallet_stats_invalid_field_type` warning code is preserved and returned.
   - When no core profit metrics exist, `gmgn_expected_metrics_unavailable` is added to the warnings set alongside any `invalid_field_type` warnings, ensuring diagnostic specifics are retained rather than swallowed.
2. **Alias Conflicts**:
   - Alias conflicts accurately retain `gmgn_wallet_stats_alias_conflict`.

### D. Envelope and Period Contract Safety (Envelope 与 period 契约)
1. **Envelope Robustness**:
   - Handles malformed `data`, `result`, `stats`, and `pnl_stat` containers gracefully without throwing unhandled exceptions.
2. **Container Isolation**:
   - Evaluates metric candidate containers (`root`, `pnl_stat`, `stats`).
   - If multiple containers exhibit metric intent, fails closed with `gmgn_wallet_stats_schema_unrecognized`.
3. **Period Verification**:
   - `expectedPeriod` is strictly enforced to `"7d"` or `"30d"`.
   - Period declarations across `record`, `root`, `data`, `result`, and `selectedContainer` are collected. Any unsupported period or mismatch with `expectedPeriod` returns `status: "UNAVAILABLE"` with `gmgn_wallet_stats_period_mismatch`.

### E. Status and Completeness (状态与 Completeness)
1. **Status Mapping**:
   - `MAPPED`: Only when all 11 schema metrics are present and valid (`completeness === 1`).
   - `PARTIAL`: When valid metrics exist but < 11 (`completeness < 1`).
   - `UNAVAILABLE`: Returned on identity mismatch, schema/container ambiguity, period mismatch, alias conflict, or zero core profit metrics. Never wrapped as `SUCCESS`.
2. **Provenance & Rules**:
   - Source is fixed to `gmgn`, `verificationStatus` is `unverified`.
   - `tradeCount` is never inferred or fabricated.

## 3. Consumer Audit Findings

Read-only inspection of consumer implementations and test files:
- `src/application/gmgn/wallet-profile-pilot.ts` & `test/application/gmgn/wallet-profile-pilot.test.ts`
- `src/application/gmgn/proxy-transport-7d-live-smoke.ts` & `test/application/gmgn/proxy-transport-7d-live-smoke.test.ts`
- `src/application/gmgn/proxy-transport-30d-live-smoke.ts` & `test/application/gmgn/proxy-transport-30d-live-smoke.test.ts`
- `src/application/gmgn/portfolio-three-path-live-diagnostic.ts` & `test/application/gmgn/portfolio-three-path-live-diagnostic.test.ts`
- `test/gmgn-wallet-stats-parser.test.ts`

**Verification Results**:
1. All consumers strictly propagate Parser statuses (`MAPPED` -> `SUCCESS`, `PARTIAL` -> `PARTIAL`, `UNAVAILABLE` -> `UNAVAILABLE`). `PARTIAL` status is never mislabeled as `SUCCESS`.
2. Synthetic fixtures in tests use explicit `win_rate_percent` aliases.
3. No real addresses, API keys, or credentials are used in fixtures.
4. No network calls or provider requests are made in tests.
5. Generic aliases are not treated as verified percentages.

## 4. Evidence Chain Audit Findings

1. **Original Repair-003 Write-Set Omission**:
   - Confirmed that original `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-003.json` write_set omitted 4 consumer test files (`portfolio-three-path-live-diagnostic.test.ts`, `proxy-transport-30d-live-smoke.test.ts`, `proxy-transport-7d-live-smoke.test.ts`, `wallet-profile-pilot.test.ts`).
2. **Evidence Repair Accuracy**:
   - Task `HARNESS-GMGN-WALLET-STATS-PARSER-REPAIR-003-WRITE-SET-AND-SHA-EVIDENCE-REPAIR-001` truthfully acknowledged this omission, documented actual delivery SHA (`0b7ce3c8c5efc11d6c625cc4df99395caf39c004`), and appended Section 6 correction to Repair-003 acceptance report without altering Git commit history.
3. **External Wrong SHA**:
   - `0b7ce3c62137ea6c9d784bc131fb0b3b44b827ea` was correctly identified as an external incorrect value that does not exist in Git commit history.
4. **Harness Doctor Limitation**:
   - Confirmed that `harness:doctor` GREEN checks write_set non-overlap in task specs but does not check Git commit diffs (`baseline..delivery`). Explicit code review of `git diff --name-only` is required for write_set compliance.
5. **Consumer Test Modification Scope**:
   - Modifications in `0b7ce3c8c5efc11d6c625cc4df99395caf39c004` to the 4 consumer test files were strictly limited to replacing synthetic fixture WinRate field aliases with `win_rate_percent`.
6. **Append-Only Preservation**:
   - Append-only corrections in acceptance reports have been preserved intact.

## 5. Offline Verification Suite Results

Executed in a clean workspace with zero network access:

1. `npm run harness:task -- validate harness/tasks/GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-003-AUDIT-001.json`: **PASSED** (`GREEN`)
2. `npm run harness:doctor`: **PASSED** (`GREEN`)
3. `npm run typecheck`: **PASSED** (0 errors)
4. `npm test`: **PASSED** (292 total, 291 passed, 1 skipped, 0 failed)
5. `npm run build`: **PASSED** (0 errors)
6. `git diff --check`: **PASSED** (0 whitespace warnings)

## 6. Final Audit Verdict & Scope Boundary

- **Final Verdict**: **GREEN**
- **Scope Boundary**: This GREEN verdict certifies that `GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-REPAIR-003` implementation and evidence repair chain fully comply with all WinRate unit contracts, strict field typing, diagnostic retention, envelope/period safety, consumer status propagation, and Harness governance rules.
- **Explicit Exclusions**: This verdict does NOT authorize:
  - Execution of final Parser Hardening Audit (`GMGN-WALLET-STATS-SCHEMA-CONTRACT-AND-PARSER-HARDENING-AUDIT-001`);
  - Re-enabling 7d/30d V2 Live requests or GMGN CLI invocations;
  - Signed Holdings Live Smoke or cumulative pagination tasks;
  - Execution of 100-wallet or 1433-wallet live tasks.
