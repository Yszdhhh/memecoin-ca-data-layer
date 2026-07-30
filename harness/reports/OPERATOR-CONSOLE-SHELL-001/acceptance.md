# Acceptance — OPERATOR-CONSOLE-SHELL-001

## Verdict

# GREEN

Date: 2026-07-30  
Role: implementer  
Branch: `feature/operator-console-shell-001`  
**M1_BASE_MAIN_SHA:** `a3a96379abfc6b6561783553fbad7a602ae4e66d`

---

## User-visible acceptance

| Question | Answer |
| --- | --- |
| 用户现在可以完成什么操作？ | 浏览器打开 Console：选择/输入 CA 查看持仓与可信度拆分；查看脱敏钱包摘要与详情；地址库搜索/加演示标签备注；任务中心查看状态并创建本地 demo 任务。 |
| 页面可以看到什么结果？ | 6 fixture CA（3 OK / 3 PARTIAL）；Accounting/Exclusion/Concentration 三门闩；TopN 在 unverified 时 ratio 显示「暂不可确认」；Tier-B 钱包 Alpha=0；任务状态 queued/completed/partial/failed/blocked。 |
| 哪些是 fixture？ | 全部 CA/钱包/任务初始数据；`FixtureOperatorConsoleDataSource` only。 |
| 哪些仍未接 Live？ | Helius/GMGN/RPC；HTTP adapter 为 `not_configured` 骨架。 |
| 失败状态如何表达？ | missing fixture empty 状态；PARTIAL/FAILED/BLOCKED badges；issue 表；任务 failureReason。 |

## Pages

| Route | Status |
| --- | --- |
| `/ca` | GREEN |
| `/ca/:mint` | GREEN (OK + PARTIAL trust split) |
| `/wallets` | GREEN |
| `/wallets/:walletId` | GREEN |
| `/addresses` | GREEN (localStorage demo) |
| `/tasks` | GREEN (demo task zero network) |

Screenshots: `screenshots/*.png` + `screenshot-manifest.json`.

## Fixture sources

- Scrubbed pilot: `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-001` + Repair-002 remap semantics
- Wallet counts from desensitized clean-rank replay summary (fingerprints only)
- No `chainfm_out` read at runtime

## Gates

| Command | Result |
| --- | --- |
| harness:doctor | GREEN |
| typecheck / test / build | PASS (407 pass / 1 skip) |
| console:check | PASS (9 vitest) |
| console:build | PASS |
| leak scans | PASS |

## UTF-8 note

Three authority docs had mojibake after prior encoding corruption; fixed in docs-only rewrite (same meaning, correct UTF-8).

## Boundary

Live providers: **0** · credentials: **0** · private wallet bulk: **0**
