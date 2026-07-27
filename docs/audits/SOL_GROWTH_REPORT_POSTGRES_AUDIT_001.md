# 审计报告：离线 Solana 地址挖掘报告 PostgreSQL 持久化

**任务 ID：** SOL-GROWTH-REPORT-POSTGRES-AUDIT-001  
**Run ID：** 20260727_SOL_GROWTH_REPORT_POSTGRES_AUDIT_001  
**审计员身份：** gemini-auditor-growth-report-postgres-001（独立身份，与实施者不同）  
**基线提交：** 审计前 `git status --short` 为空，工作区干净  
**审计日期：** 2026-07-27  
**任务层：** cold_path（T2）  
**依赖任务：** SOL-GROWTH-REPORT-POSTGRES-001

---

## 执行摘要

本报告独立审计了离线 Solana 日/周地址挖掘报告的 PostgreSQL 持久化能力，覆盖六个强制审计目标。所有验收命令通过（`harness:doctor` / `typecheck` / `test` / `build` / `git diff --check` 均为 PASSED，195 个测试全部通过）。代码审查显示持久化实现符合所有审计标准。**Verdict：GREEN。**

---

## 审计目标逐项验证

### AC-1：仅保存结构化运行指标、告警和 token 级摘要；不保存原始 provider payload、密钥或凭证

**状态：PASS**

**迁移文件（`db/migrations/010_address_mining_runs.sql`）验证：**

| 列名 | 类型 | 是否允许原始 payload | 说明 |
|---|---|---|---|
| `window` | `text` | 否 | 枚举 `'daily'` / `'weekly'` |
| `run_at` | `timestamptz` | 否 | 运行时间戳 |
| `rule_version` | `text` | 否 | 规则版本字符串 |
| `status` | `text` | 否 | `GREEN` / `DEGRADED` |
| `tokens_scanned` ~ `wallets_promoted` | `integer` | 否 | 计数指标 |
| `new_labels` | `jsonb` | 否 | 新标签摘要（smartMoney / cluster / bot / other） |
| `quota` | `jsonb` | 否 | firstHandWalletBudget / consumed / skippedWallets |
| `warnings` | `jsonb` | 否 | 告警字符串数组 |
| `token_reports` | `jsonb` | 否 | tokenCa / borrowedLeads / judgedCandidates / confirmationsAttempted / promotedWallets / warnings |

- **零个 `raw_payload` 列**：grep 确认迁移 SQL 中无任何原始 payload 字段。
- **零个密钥/凭证字段**：表结构完全由结构化指标和摘要构成。
- **应用层约束**：`DailyMiningReport` 接口（`daily-toptoken-mining.ts:75-105`）中 `tokenReports` 成员只包含 tokenCa 和统计摘要，不包含任何原始 provider 数据。

---

### AC-2：`daily/weekly + run_at + rule_version` 的幂等身份成立，重复写入走安全 upsert

**状态：PASS**

**迁移层：**

```sql
UNIQUE (window, run_at, rule_version)
```

三列联合唯一约束建立了幂等身份键。`ON CONFLICT (window, run_at, rule_version) DO UPDATE SET` 语法确保：
- 首次写入：正常 INSERT
- 重复写入：现有行所有字段被新值安全覆盖（`status`, `tokens_scanned`, `wallets_mined`, `confirmations_attempted`, `wallets_confirmed`, `wallets_promoted`, `new_labels`, `quota`, `warnings`, `token_reports`, `recorded_at`）
- `recorded_at = now()` 在 upsert 时更新，反映最新写入时间

**迁移唯一约束测试（`postgres-address-mining-report-store.test.ts:77-83`）：**
```typescript
assert.match(sql, /UNIQUE \(window, run_at, rule_version\)/);
```

**Postgres 适配器（`postgres-address-mining-report-store.ts:16-55`）：**
- `$1=$report.window`, `$2=$report.runAt`, `$3=$report.ruleVersion` — 参数化查询，防 SQL 注入
- `ON CONFLICT ... DO UPDATE` 对所有 10 个可更新字段执行完整替换
- 无 `RETURNING` 或触发器依赖

---

### AC-3：持久化失败时任务必须显式 DEGRADED 并包含可识别告警；不得伪称保存成功或伪造结果

**状态：PASS**

**应用层实现（`daily-toptoken-mining.ts:298-306`）：**
```typescript
report.status = warnings.length > 0 ? "DEGRADED" : "GREEN";
if (deps.reportStore) {
  try {
    await deps.reportStore.save(report);
  } catch {
    warnings.push("mining_report_persistence_failed");
    report.status = "DEGRADED";   // 强制降级，不保留前序 GREEN 状态
  }
}
```

关键行为：
1. `report.status` 初始为 `"GREEN"`（`daily-toptoken-mining.ts:171`）
2. 保存成功：`status` 保持原值（`GREEN` 或已有 `DEGRADED`）
3. 保存失败：`warnings.push("mining_report_persistence_failed")` 追加可识别告警，**强制** `report.status = "DEGRADED"`
4. 最后返回的 `report` 对象包含完整的计算证据，不丢失计算结果

**单元测试（`daily-toptoken-mining.test.ts:236-251`）：**
```typescript
test("report persistence failure degrades the run without discarding computed evidence", async () => {
  // reportStore.save() throws
  assert.equal(report.status, "DEGRADED");
  assert.ok(report.warnings.includes("mining_report_persistence_failed"));
  assert.equal(report.walletsPromoted, 1);  // 证据未被丢弃
  assert.equal((await library.getWallet("solana", "wallet-1"))?.verificationStatus, "verified");
});
```

---

### AC-4：关键计数和时间输入在发出 SQL 前受校验，非法数据 fail-closed

**状态：PASS**

**`assertReport` 函数（`postgres-address-mining-report-store.ts:59-78`）：**

```typescript
function assertReport(report: DailyMiningReport): void {
  // 1. window 必须是 'daily' 或 'weekly'
  if (report.window !== "daily" && report.window !== "weekly") {
    throw new Error("mining report window must be daily or weekly");
  }
  // 2. runAt 必须是合法 Date 对象
  if (!(report.runAt instanceof Date) || Number.isNaN(report.runAt.getTime())) {
    throw new Error("mining report runAt must be a valid date");
  }
  // 3. 所有整数字段必须为非负整数
  for (const [name, value] of Object.entries({
    tokensScanned, walletsMined, confirmationsAttempted,
    walletsConfirmed, walletsPromoted,
    firstHandWalletBudget, consumed
  })) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`mining report ${name} must be a non-negative integer`);
    }
  }
}
```

**测试验证（`postgres-address-mining-report-store.test.ts:69-75`）：**
```typescript
test("Postgres mining report store rejects invalid metrics before SQL", async () => {
  await assert.rejects(() => store.save(report({ walletsPromoted: -1 })), /walletsPromoted/);
  assert.equal(capture.calls.length, 0);  // 校验失败，SQL 未发出
});
```

- `walletsPromoted: -1` → 抛出异常，**零次 SQL 调用**
- 所有 7 个整数字段均有相同校验覆盖
- `assertReport` 在 `save()` 第一行调用，在 SQL 发出之前拦截

**应用层额外校验（`daily-toptoken-mining.ts:148-149`）：**
```typescript
if (config.firstHandWalletBudget < 0 || !Number.isInteger(config.firstHandWalletBudget)) {
  throw new Error("firstHandWalletBudget must be a non-negative integer");
}
```

---

### AC-5：数据库迁移是增量式的，不修改历史 migration，不存在 destructive 操作

**状态：PASS**

- **迁移文件命名：** `010_address_mining_runs.sql` — 序号化命名，属于增量步骤
- **操作类型：** `CREATE TABLE` + `CREATE INDEX` — 仅新增对象，无 `DROP`、`ALTER TABLE DROP COLUMN`、`TRUNCATE`、`RENAME` 等破坏性操作
- **历史迁移未修改：** 审计员仅读取，未修改任何 migration 文件
- **`KNOWN_LIMITATIONS.md` 备注（第 21 条）：** "PostgreSQL migration has not been exercised against a disposable database in CI." — 这是已知局限，不是阻塞项（migration 本身无破坏性操作）

---

### AC-6：不存在真实 PostgreSQL / Redis 连接，不存在 scheduler 激活，也不存在 Helius、RPC、HTTP 或其他 live 网络调用

**状态：PASS（with scoped notes）**

**Grep 结果分析：**

| 搜索项 | 命中位置 | 性质 |
|---|---|---|
| `new Pool(` | `macro-daily-core-live-run.ts`, `macro-live-timeseries-service.ts` | macro 模块，非 growth-loop |
| `fetch(` / `http` / `axios` | `macro-dune-rest.ts`, `pump-instruction-decoder.ts` | macro/Dune 模块及类型定义 |
| `helius` | helius 数据源、适配器、degradation 测试套件 | helius fixture/adapter，非 live |

**针对本审计目标（`postgres-address-mining-report-store.ts` 及依赖链）：**

- `postgres-address-mining-report-store.ts`：仅 `import type { Pool } from "pg"`，**不创建 Pool 实例**，`Pool` 由调用方注入
- `daily-toptoken-mining.ts`：依赖通过 `DailyMiningDeps` 接口注入，所有 provider 均为 mock/fixture
- **零个 scheduler/cron/定时器代码**：grep 确认目标文件中无 `cron`、`schedule`、`setInterval`、`node-cron`、`bull`、`agenda`
- **零个 `.env` / `*.pem` / `*.key` / `wallet*.json` / `*secret*` 文件**（`project.json` forbidden patterns 覆盖，grep 无命中）

**注意事项：** 仓库中存在 `macro-daily-core-live-run.ts` 和 `macro-live-timeseries-service.ts` 中包含 `new Pool({ connectionString })`，但这些属于 **macro 模块**，与本审计目标（growth-loop 地址挖掘报告持久化）无关。Owner 决策 D-D 已 gate 了生产 PostgreSQL 部署（"PostgreSQL/Redis deployment target and whether a historical backfill may run" 为未决 Owner gate）。

---

## 测试覆盖率摘要

| 测试文件 | 测试数量 | 覆盖要点 |
|---|---|---|
| `daily-toptoken-mining.test.ts` | 6 | 确定性、degradation、持久化失败、存储接收、无效合约拒绝、quota 机制 |
| `postgres-address-mining-report-store.test.ts` | 3 | idempotent upsert、fail-closed 校验、迁移安全性 |

**总计：195 个测试全部通过，0 失败。**

---

## 代码边界检查

| 维度 | 结论 |
|---|---|
| 写入集合 | 仅 `docs/audits/SOL_GROWTH_REPORT_POSTGRES_AUDIT_001.md` |
| 修改源代码 | ❌ 未修改 |
| 修改迁移 | ❌ 未修改 |
| 修改测试 | ❌ 未修改 |
| Harness 历史记录 | ❌ 未修改 |
| PostgreSQL 连接 | ❌ 未建立 |
| Redis 连接 | ❌ 未建立 |
| Scheduler 激活 | ❌ 未激活 |
| 网络调用 | ❌ 无 live 调用 |

---

## 阻断项

**无阻断项。**

所有 6 项审计目标均 PASS。验收命令全部通过。代码审查未发现违反 constitution / architecture 的 P2+ 问题。

---

## 建议项（非阻断）

1. **CI 迁移执行（参考 `KNOWN_LIMITATIONS.md` L21）：** 当前 migration 尚未在 CI 的 disposable PostgreSQL 数据库中执行过。建议 Owner 授权后在 CI pipeline 中加入 migration smoke test，确保 `010_address_mining_runs.sql` 在真实 PostgreSQL 上可重复执行且结果一致。

2. **`recorded_at` 列语义：** `ON CONFLICT DO UPDATE` 会将 `recorded_at` 重置为 `now()`。这对于监控 re-run 时间是合理的，但若后续业务需要保留原始插入时间，应添加独立列（如 `first_inserted_at`）。当前语义与需求一致，无需立即修改。

3. **`macro-*` 模块的 `Pool` 实例化（观察性备注）：** `macro-daily-core-live-run.ts:22` 和 `macro-live-timeseries-service.ts:81` 存在 `new Pool({ connectionString })`，属于 macro 模块，与本次审计目标无关，但建议 Owner 在宏观模块激活时审查其凭证传递路径。

---

## 验收命令结果

| 命令 | 状态 | 说明 |
|---|---|---|
| `npm run harness:doctor` | ✅ PASSED | `GREEN`，active_stage: solana-pumpfun-e2e |
| `npm run typecheck` | ✅ PASSED | 0 类型错误 |
| `npm test` | ✅ PASSED | 195/195 通过，0 失败 |
| `npm run build` | ✅ PASSED | 编译成功 |
| `git diff --check` | ✅ PASSED | 无 whitespace 错误 |

---

## Harness 状态

- **Harness Run ID：** 20260727_SOL_GROWTH_REPORT_POSTGRES_AUDIT_001
- **baseline commit：** 审计前 `git status --short` 为空
- **审计提交：** 仅 `docs/audits/SOL_GROWTH_REPORT_POSTGRES_AUDIT_001.md` 被写入
- **Verdict：** **GREEN**

---

*本报告由独立审计员 gemini-auditor-growth-report-postgres-001 生成，依据 PROJECT_CONSTITUTION.md、PROJECT_ARCHITECTURE.md 及 task spec SOL-GROWTH-REPORT-POSTGRES-AUDIT-001。*
