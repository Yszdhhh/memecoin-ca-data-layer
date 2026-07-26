# Fable 审查交接 — SOL-CA-ORCHESTRATION-REPAIR-001

**给谁：** Claude Fable（实现者 / 协调者，额度恢复后）  
**写作者：** Grok（xAI），在 Fable 因 session limit 中断后接续  
**项目：** `G:\链上战壕`  
**日期：** 2026-07-26  

---

## 1. 你离开时的状态

会话 `195e5e8d-c85a-4f74-b0a7-f91a0e253836`（推进链上战壕项目至最终版本）在
`SOL-CA-ORCHESTRATION-001` GREEN 之后，启动了独立对抗审计工作流
`wf_e41f111b-420`，随后 hit session limit。

中断后磁盘上已有审计报告（未走完 harness finish）：

- `docs/audits/SOL-CA-ORCHESTRATION-AUDIT-001.md` → **FAIL（P1）**

---

## 2. 我做了什么（按时间）

### 2.1 收尾审计 FAIL（协调 / 记录）

| 项 | 值 |
|---|---|
| Run | `harness/runs/20260726_SOL_CA_ORCH_AUDIT_001` |
| Agent | `claude-auditor-orchestration`（原 run）→ 由 Grok 完成 verify/finish |
| Verdict | **FAIL** |
| 原因摘要 | P1 `ownerBalances` Map 经 Redis/Postgres 静默变 `{}`；另有 P2 完整性矩阵问题 |

相关提交：

- `e0c8ccd` — `chore(harness): record CA orchestration audit FAIL and register repair`

### 2.2 注册修复与再审任务

- `harness/tasks/SOL-CA-ORCHESTRATION-REPAIR-001.json`（implementer）
- `harness/tasks/SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001.json`（auditor，**留给你**）
- `SOL-WALLET-CLEANING-003` 依赖改为：审计 FAIL **且** repair 再审通过后才解锁  
  （`SOL-CA-ORCHESTRATION-AUDIT-001` + `SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001`）

### 2.3 实现修复（implementer）

| 项 | 值 |
|---|---|
| Task | `SOL-CA-ORCHESTRATION-REPAIR-001` |
| Run | `harness/runs/20260726_SOL_CA_ORCH_REPAIR_001` |
| Agent | `grok-implementer-orchestration-repair` |
| Verdict | **GREEN**（acceptance 全过；**尚未**经独立再审） |

#### 代码改动（write set 内）

| 文件 | 改动 |
|---|---|
| `src/domain/types.ts` | 新增 `OwnerBalanceEntry`；`HolderSnapshotEvidence.ownerBalances` 从 `ReadonlyMap` 改为 `ReadonlyArray<OwnerBalanceEntry>`（JSON/JSONB 可序列化） |
| `src/application/analysis-service.ts` | (1) `holderSnapshotEvidence` 输出数组而非 Map；(2) `devCompleteness`：缺 creator → `unavailable`；`dev===null` 永不 `complete`；(3) FIND-4 显式 warning；(4) complete+null concentration → `holderCompleteness: unavailable` |
| `test/application/solana/ca-analysis-orchestration.test.ts` | 更新断言；新增 null-dev 矩阵用例 |
| `test/application/solana/analysis-persistence-roundtrip.test.ts` | **新增**：Redis in-memory + Postgres stub 往返，断言 `ownerBalances` 不丢 |

#### 未改（故意）

- 未改 Pump decoder / holder snapshot service / Dev history service
- 未改 Redis/Postgres 实现本身（审计允许「证据类型改为可序列化」）
- 未实现 FIND-4 的「从 snapshot 自身枚举取 tag/cluster」全量重接线（需 live source 前做；现用 warning + `KNOWN_LIMITATIONS.md`）
- **未写** `SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001` 报告（独立审计，应由你或另一身份执行）

#### 验收命令（本机已绿）

```text
npm run typecheck   # PASS
npm test            # 106 passed / 0 failed（原 103 + 本轮新增）
npm run build       # PASS
git diff --check    # PASS
```

Harness：

```text
npm run harness:run -- verify harness/runs/20260726_SOL_CA_ORCH_REPAIR_001  # GREEN
npm run harness:run -- finish ... GREEN
```

---

## 3. 对照原 FAIL 报告的关闭状态（实现者自检，非正式裁决）

| Finding | 原级 | 我的处理 | 请你验证 |
|---|---|---|---|
| FIND-1 ownerBalances Map 持久化丢失 | P1 | 改为可序列化数组 + Redis/PG 往返测试 | 复现旧攻击路径是否仍能造 `{}` |
| FIND-2 `devCompleteness=complete` 且 `dev=null` | P2 | 仅当 `dev!=null && completeFromCreation` 才 complete | 用 rejected creator 的 history fixture |
| FIND-3 无 creator 报 `partial` | P2 | 改为 `unavailable` | 编排测试已改 pin |
| FIND-4 排除输入来自 top100/30m 窗口 | P2 | **未消根因**；显式 warning + KNOWN_LIMITATIONS | 是否接受「warning 先挡 live」；是否要求 repair 二期重接线 |
| Advisories 1–7 | 建议 | 仅做了 complete+null concentration 防御性降级 | 其余可记 follow-up |

---

## 4. 请你额度恢复后做的事（建议顺序）

1. **读**  
   - 本文件  
   - `docs/audits/SOL-CA-ORCHESTRATION-AUDIT-001.md`  
   - `harness/tasks/SOL-CA-ORCHESTRATION-REPAIR-001.json`  
   - 本轮 diff（相对 `e0c8ccd` 或 repair run 的 `start_commit`）

2. **独立审计** `SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001`  
   - 只写：`docs/audits/SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001.md`  
   - 不要改实现代码  
   - 重点：Redis/Postgres 往返证据完整性 + 完整性矩阵 + 门闩未放宽  

3. 若 GREEN：ledger/task 标 DONE，解锁 `SOL-WALLET-CLEANING-003`  
   若 FAIL：再开 repair 链，不要直接进 wallet cleaning

4. 可选并行（write set 不冲突时）：`SOL-E2E-GAP-RESEARCH-002`、`HARNESS-AO-AUTOMATION-001`

---

## 5. Git / 仓库指针

| 项 | 值 |
|---|---|
| 分支 | `main`（相对 origin 超前，未 push） |
| 审计登记提交 | `e0c8ccd` |
| 修复代码提交 | 见后续 commit（若存在 `feat(solana): repair CA orchestration evidence integrity`） |
| 工作树 | 实现后应干净或仅剩 handoff 文档 |

检查命令：

```bash
cd "/g/链上战壕"   # 或 G:\链上战壕
git log --oneline -8
git status
git show --stat HEAD
npm test
```

---

## 6. 风险与诚实声明

- 我是**修复实现者**，不是独立审计员；GREEN harness finish **不等于** 再审通过。  
- FIND-4 仅 warning，**live 数据源接线前必须处理**，否则完整 snapshot 上仍可能漏排基础设施地址。  
- 非 Solana 分支仍硬编码 `holderCompleteness=complete`（原 advisory；BSC 未激活）。  
- CA 小写 cache key 问题（审计 advisory）未动，属预存 persistence 硬化项。

---

## 7. 一句话

Fable：请把 `SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001` 当正式 T2 再审做完；通过后再动钱包清洗与 E2E。
