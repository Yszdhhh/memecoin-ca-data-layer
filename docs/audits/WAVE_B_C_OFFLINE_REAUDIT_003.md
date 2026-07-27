# Wave B/C Offline Re-audit Report (WAVE-B-C-OFFLINE-REAUDIT-003)

- **Task ID**: `WAVE-B-C-OFFLINE-REAUDIT-003`
- **Auditor ID**: `gemini-auditor-wave-bc-reaudit-003`
- **Harness Run ID**: `20260727_WAVE_B_C_OFFLINE_REAUDIT_003`
- **Baseline Commit**: `4c05e32`
- **Verdict**: `GREEN_WITH_ADVISORY`
- **Date**: 2026-07-27

---

## 1. Executive Summary & Audit Scope

本报告为对 Solana Wave B/C 离线实现（包括地址库沉淀、首屏热路径卡片、免费 Borrowed Provider 契约、并行与离线约束）的独立二次重审。

审计确认为：代码库在当前 Stage (`solana-pumpfun-e2e`) 下完全遵循离线/Fixture-only 原则，未引入任何真实 live HTTP、RPC、Helius、Birdeye、GMGN 或其他外部 API 调用。全部 186 项单元与集成测试、5 项 Harness Suite 测试及类型检查、构建均 100% 成功通过。

---

## 2. Verified Key Behaviors & Evidence Matrix

### A. 地址库沉淀 (Address Library Sedimentation)

| 信任边界与行为要求 | 源码实现位置 | 测试验证位置 | 验证结论 |
| :--- | :--- | :--- | :--- |
| Borrowed 数据绝对不能以 `verified` 身份进入地址库 | [address-library.ts](file:///G:/链上战壕/src/application/sedimentation/address-library.ts#L105-L123) | [address-library.test.ts](file:///G:/链上战壕/test/application/sedimentation/address-library.test.ts#L108-L137) | **PASSED**: `upsertWallet` 与 `upsertWalletTokenEdge` 对 `origin === "borrowed" && verificationStatus === "verified"` 显式抛错阻断；`appendObservation` 返回 `{ accepted: false, reason: "invalid_verified_borrowed" }`。 |
| 已 `verified` 的记录不能被后续 `unverified` borrowed 记录覆盖 | [address-library.ts](file:///G:/链上战壕/src/application/sedimentation/address-library.ts#L110-L112) | [address-library.test.ts](file:///G:/链上战壕/test/application/sedimentation/address-library.test.ts#L139-L163) | **PASSED**: `existing.verificationStatus === "verified" && record.verificationStatus === "unverified"` 时直接跳过更新，保护权威记录。 |
| Observation, Wallet, WalletTokenEdge 信任边界一致 | [address-library.ts](file:///G:/链上战壕/src/application/sedimentation/address-library.ts#L7-L53) <br> [008_address_library_and_observations.sql](file:///G:/链上战壕/db/migrations/008_address_library_and_observations.sql#L73-L74) | [address-library.test.ts](file:///G:/链上战壕/test/application/sedimentation/address-library.test.ts#L9-L83) | **PASSED**: 三者均要求 `origin` (first_hand / borrowed) 与 `verificationStatus` 严格匹配，Migration SQL 包含类型与 Check 约束。 |

### B. 首屏热路径 (First-screen Hot Path)

| 信任边界与行为要求 | 源码实现位置 | 测试验证位置 | 验证结论 |
| :--- | :--- | :--- | :--- |
| Deep-dive 必须显式进入 `AnalysisService` / 队列 | [ca-first-screen.ts](file:///G:/链上战壕/src/application/hotpath/ca-first-screen.ts#L156) <br> [analysis-deep-dive-queue.ts](file:///G:/链上战壕/src/application/hotpath/analysis-deep-dive-queue.ts#L33-L49) | [analysis-deep-dive-queue.test.ts](file:///G:/链上战壕/test/application/hotpath/analysis-deep-dive-queue.test.ts#L1-L50) | **PASSED**: `ca-first-screen.ts` 并行发起 `deepDiveQueue.enqueue(tokenCa)`；队列 `AnalysisServiceDeepDiveQueue` 在 `drainAll` 时显式调用 `analysis.getDeepAnalysis(tokenCa)`。 |
| Enqueue 失败必须降级并暴露 `DEGRADED` / warning | [ca-first-screen.ts](file:///G:/链上战壕/src/application/hotpath/ca-first-screen.ts#L157-L194) | [ca-first-screen.test.ts](file:///G:/链上战壕/test/application/hotpath/ca-first-screen.test.ts#L114-L126) | **PASSED**: Enqueue 捕获异常后将 `deepDiveEnqueued` 置为 `false`，生成 `"deep_dive_enqueue_failed"` warning，并将 card status 设为 `"DEGRADED"`，绝不伪造成功。 |
| 地址库命中、借用数据、持仓提示保留 `unverified` 语义 | [ca-first-screen.ts](file:///G:/链上战壕/src/application/hotpath/ca-first-screen.ts#L204-L225) | [ca-first-screen.test.ts](file:///G:/链上战壕/test/application/hotpath/ca-first-screen.test.ts#L19-L62) | **PASSED**: `market.unverified: true`、`security.unverified: true`、`holders.isBorrowedConcentration: true`、`holders.ownerAggregated: false`、`holders.unverified: true` 均为硬编码明确语义。 |

### C. 免费 Borrowed Provider (Free Borrowed Provider Contract)

| 信任边界与行为要求 | 源码实现位置 | 测试验证位置 | 验证结论 |
| :--- | :--- | :--- | :--- |
| Provider 输入/输出契约拒绝非法 borrowed 形状 | [free-provider-ports.ts](file:///G:/链上战壕/src/infrastructure/providers/free-provider-ports.ts#L156-L160) | [ca-first-screen.test.ts](file:///G:/链上战壕/test/application/hotpath/ca-first-screen.test.ts#L128-L153) | **PASSED**: `collectBorrowedMarket` 及 `collectSecurity` 校验 `quote.origin === "borrowed" && quote.verificationStatus === "unverified"`，若试图越权标记为 `verified`，直接拒绝并报警 `${provider.name}_invalid_borrow_contract`。 |
| Borrowed 数据不能绕过 first-hand confirmation 晋升 | [free-provider-ports.ts](file:///G:/链上战壕/src/infrastructure/providers/free-provider-ports.ts#L67-L74) | [address-library.test.ts](file:///G:/链上战壕/test/application/sedimentation/address-library.test.ts#L108-L126) | **PASSED**: 所有免费 Borrowed Provider 统一在构造辅助中强制设定 `origin: "borrowed"` 与 `verificationStatus: "unverified"`。 |
| 不能因 Provider 故障伪造成功数据 | [free-provider-ports.ts](file:///G:/链上战壕/src/infrastructure/providers/free-provider-ports.ts#L165-L168) | [ca-first-screen.test.ts](file:///G:/链上战壕/test/application/hotpath/ca-first-screen.test.ts#L64-L81) | **PASSED**: Provider 抛错时捕获异常并返回 `null`，暴露 `*_unavailable` 警告，card 降级为 `"DEGRADED"`，流动性保持 `null`。 |

### D. 并行与离线约束 (Parallelism & Offline Constraints)

| 信任边界与行为要求 | 源码实现位置 | 测试验证位置 | 验证结论 |
| :--- | :--- | :--- | :--- |
| 并行耗时应按 `max` 而不是 `sum` 记账 | [ca-first-screen.ts](file:///G:/链上战壕/src/application/hotpath/ca-first-screen.ts#L241-L243) | [ca-first-screen.test.ts](file:///G:/链上战壕/test/application/hotpath/ca-first-screen.test.ts#L83-L86) <br> [suites.test.ts](file:///G:/链上战壕/test/harness-suites/suites.test.ts#L1-L8) | **PASSED**: `parallelHotpathElapsedMs` 实现为 `latencies.reduce((max, value) => Math.max(max, value), 0)`，并通过断言测试。 |
| 所有验收只能使用 fixtures/offline | [fixture-helius-data-source.ts](file:///G:/链上战壕/src/infrastructure/solana/helius/fixture-helius-data-source.ts#L40-L44) | 全部 186 项单元测试 | **PASSED**: 所有的 Solana 链上数据、Pump 指令解码、Provider 数据均来自 Pinned Fixtures。 |
| 不得引入 live network 调用、凭证或真实 CA | 代码库全文全局检索 | 全部测试套件 | **PASSED**: 未在 Solana Hotpath / Ingest / Provider 核心路径发现任何 live HTTP / fetch / RPC 调用。 |

---

## 3. Live Network Path Inspection

经全面审查：
- **Solana 核心卡片及沉淀路径**：完全由纯内存/本地 Fixture 驱动，无 HTTP 网络驱动模块。
- **Dune 模块**：仅包含离线 Mock 及结构定义（`macro-dune-rest.ts`），独立属于宏观任务，且未在 Solana 热路径中被依赖或触发。
- **凭证与密钥**：未在 repository 中发现 `.env`、私钥、API Secret 或真实 CA 凭证。

---

## 4. Advisories (非阻断建议)

1. **Advisory 1 (Postgres 沉淀数据校验边界)**:
   - *说明*: `InMemoryAddressLibrary` 已经在应用内存层严格限制 `borrowed + verified` 的阻断逻辑。当项目后续将 `InMemoryAddressLibrary` 正式替换为 Postgres 数据库存储实现时，建议在 Postgres SQL 语句（或触发器）中继续保持对 `origin='borrowed' AND verification_status='verified'` 的阻断校验，以提供双重深度防御。
2. **Advisory 2 (Virtual Clock 与 Real-world CPU Latency 区分)**:
   - *说明*: `ca-first-screen.ts` 结合 `VirtualClock` 进行 P95 预算（<2000ms）测算。由于 `parallelHotpathElapsedMs` 取 `max(latencies)`，此设计符合低延迟首屏的算法预期。建议在未来上线 Live 阶段保持与真实 APM 监控指引一致。

---

## 5. Acceptance Command Execution Results

已实际运行全套验收指令，结果如下：

1. `npm run harness:doctor`: **PASSED** (Status: `GREEN`)
2. `npm run typecheck`: **PASSED** (TypeScript 校验零错误)
3. `npm test`: **PASSED** (186/186 单元与集成测试全部通过)
4. `npx tsx test/harness-suites/suites.test.ts`: **PASSED** (5/5 4维 Harness Suite 测试全部通过)
5. `npm run build`: **PASSED** (编译构建成功)
6. `git diff --check`: **PASSED** (无空白字符或冲突残留)

---

## 6. Verdict & Final Summary

- **Verdict**: `GREEN_WITH_ADVISORY`
- **Blocking Issues**: 无 (0 blocking items)
- **Advisories**: 2 项非阻断建议 (详见 §4)
- **Out of Scope Check**: `write_set` 仅包含 `docs/audits/WAVE_B_C_OFFLINE_REAUDIT_003.md`，无任何越界修改。
