# 系统现状收口与下一阶段方向（2026-07-30）

面向：**云端审核 / Owner 决策 / 下一波任务派工**。  
本地主克隆路径见 [`docs/LOCAL_WORKSPACE_PATHS.md`](../LOCAL_WORKSPACE_PATHS.md)（`G:\链上战壕`）。

**本文件可提交 Git。** 不包含密钥、明文钱包地址 bulk 列表、原始 Provider payload。

---

## 0. 一句话现状

系统已形成 **两条并行事实链路**：

1. **钱包情报（GMGN 借用层）**：1433 地址的 7d/30d 已全量抓取并做过 DQ 清洗与候选排序；**累计盈利未打通**。
2. **CA 持仓（Helius Tier-A 试点）**：固定 6 个公开 CA 完成 owner 聚合清洗与 CaScan 映射；**3 OK / 3 PARTIAL**，独立审计待派。

下一阶段不应再「同时大改架构 + 扩 Provider + 全量重跑」，而应 **按信任分层收敛数据用法**，再开有边界的下一任务。

---

## 1. 仓库与分支

| 项 | 值 |
| --- | --- |
| Remote | `https://github.com/Yszdhhh/memecoin-ca-data-layer.git` |
| 本地主路径 | `G:\链上战壕` |
| 本轮实现分支 | `feature/sol-ca-real-data-cleaning-pilot-001` |
| Base | `main@777e0131ec663178c6c4cc5cc0c4584e60be2381` |
| 相关历史分支（worktree） | `codex/solana-daily-new-token-analysis` 等（见 LOCAL_WORKSPACE_PATHS） |

---

## 2. 链路 A — 钱包 1433 / 7d·30d / 清洗分类 / 累计

### 2.1 已完成（有验收）

| 能力 | 任务/证据 | 结论 |
| --- | --- | --- |
| 地址清单固定 | `sol_addresses.txt` SHA `64764807…` | 1433 合法唯一 Solana 地址 |
| 7d+30d 全量拉取 | `SOL-GMGN-WALLET-STATS-FULL-1433-LIVE-RERUN-002` + AUDIT | **DONE / GREEN_WITH_ADVISORY** |
| 归一化落盘（本地） | `C:\Users\10639\chainfm_out\sol\derived\gmgn-wallet-stats-full-1433-live-rerun-002\` | 2866 条记录；**不进 Git** |
| DQ 清洗 + 候选排序 | `SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-001` + repairs/audits | **DONE / GREEN**（规则层后续收紧见 2.3） |
| 排序产物（本地） | `...\wallet-intelligence-master-clean-rank-001\` | master 表 + 17 候选 union；**不进 Git** |
| 钱包清洗规则（领域） | `SOL-WALLET-CLEANING-003` 等 | DONE（标签/规则，非 1433 表） |
| 小预算 7d/30d 修复烟测 | proxy / parser / single-wallet transport 等 | 多条 DONE（为全量服务） |

### 2.2 全量 7d/30d 数据质量（审计数字）

| 指标 | 值 |
| --- | --- |
| 调用预算 | 2866 / 2866（每钱包 1 次 CLI × 2 周期） |
| MAPPED | **0** |
| PARTIAL | **2782（~97%）** |
| UNAVAILABLE | **84** |
| 平均 completeness | ~0.74 |
| 语义 | 全部 `source=gmgn` + `verificationStatus=unverified` |
| 缺失严重字段 | `periodPnl`、`tradeCount` 覆盖 **0%** |
| 可用字段 | realizedProfit / winRate / buy-sell 等 ~97% |

**解释给云端**：这是 **可复用的借用统计快照**，不是链上确认 PnL，不能直接标 confirmed。

### 2.3 Clean-rank 注意点

- 初版 clean-rank 在当时规则下产出 DQ-A ~72%、候选 union 17。
- Repair-003 将 Alpha 资格收紧为：**7d 与 30d 各自** `MAPPED` + completeness=1 + 无 `partial_fields`。
- 与 2.2 对照：当前 1433 抓数几乎全是 PARTIAL + partial_fields → **若用新规则离线重放，Alpha 会极严甚至为空**。  
  **建议下一阶段先做「规则重放对照」再决定是否重抓。**

### 2.4 未完成：累计盈利 / Signed Holdings

| 任务 | 结果 |
| --- | --- |
| 累计 adapter / runner 离线修复 | 契约与隔离 DONE |
| Signed holdings live smoke | **UNAVAILABLE**（`gmgn_request_unavailable`） |
| 三路径诊断（7d/30d/holdings） | 7d 网络失败后 30d/holdings PARK |
| 1433 累计全量 | **从未执行** |

---

## 3. 链路 B — CA 真实持仓清洗试点（本轮代码）

### 3.1 任务

`SOL-CA-REAL-DATA-CLEANING-PILOT-001`  
分支：`feature/sol-ca-real-data-cleaning-pilot-001`  
验收：`harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-001/` → **GREEN_WITH_ADVISORY**（实现方；**独立审计未做**）

### 3.2 交付物（进 Git）

- 域：`src/domain/rules/holder-data-cleaning.ts`、`src/domain/mapping/map-holder-cleaning-to-ca-scan.ts`
- 应用/CLI：`solana-ca-real-data-cleaning-pilot` + PS1 凭据注入
- Helius：全量 `enumerateTokenAccounts`（分页、容错、PARTIAL 回退）
- 固定样本：`harness/inputs/SOL-CA-REAL-DATA-CLEANING-PILOT-001/input-manifest.json`（6 CA）
- 报告：batch-summary / gap-matrix / acceptance / 每 CA 脱敏 JSON
- 测试：12 项离线用例
- 本地路径说明：`docs/LOCAL_WORKSPACE_PATHS.md`

### 3.3 Live 结果（6 公开 CA，Helius only）

| 状态 | 数 | 含义 |
| --- | --- | --- |
| OK | 3 | 分页完整 + residual=0 → 允许 confirmed 持仓判断 |
| PARTIAL | 3 | 分页不全 **或** supply residual → **禁止** confirmed |
| REJECTED | 0 | — |

操作机注意：`mainnet.helius-rpc.com` 曾解析到 `127.0.0.1` → 默认 **`gatekeeper_beta`**。

### 3.4 明确未做（CA 试点）

Pump 解码、Creator/Dev sell、funding cluster、钱包 PnL、自动选币、新 Provider、生产库、完整 SOL-E2E。

---

## 4. 信任分层（后续任务必须遵守）

| 数据 | 层 | 可用途 | 不可用途 |
| --- | --- | --- | --- |
| GMGN 7d/30d 1433 | Tier-B 借用 | 候选筛选、展示、研究排序（标注 unverified） | confirmed 盈利/聪明钱判决 |
| Helius holder 聚合（试点） | Tier-A 一手 | 持仓 universe / 集中度（完整对账时） | 替代市场价/社交标签 |
| Signed holdings 累计 | 目标 Tier-B→待确认 | 尚未可用 | 任何「累计已证实」话术 |
| 生产地址库 / DB | Cold path | 未接生产 | 本阶段禁止写入生产 |

---

## 5. 本地 vs Git（云端必读）

| 内容 | Git | 本地 only |
| --- | --- | --- |
| 代码、任务 JSON、脱敏 harness 报告 | ✅ | |
| 1433 `normalized_wallet_profiles.json` | ❌ | `chainfm_out\sol\derived\...` |
| clean-rank master / shortlist 含私密映射 | ❌ | 同上 `wallet-intelligence-master-clean-rank-001` |
| DPAPI 密钥 | ❌ | `%LOCALAPPDATA%\memecoin-ca-data-layer\secrets` |
| Helius 原始响应 | ❌ | 最多本地 7 天，禁止提交 |

云端 **没有** 1433 明细文件时，只能基于 harness 验收文档与 SHA 指纹做策略审核，不能假定能直接重算表。

---

## 6. 建议的下一阶段任务方向（供审核圈选）

按 **风险从低到高 / 依赖清晰** 排序。每项应单独 task JSON，禁止合并成「大而全」。

### P0 — 收口与对照（优先，零或极少网络）

1. **`SOL-CA-REAL-DATA-CLEANING-PILOT-AUDIT-001`**  
   独立审计本轮 CA 试点（write-set、泄漏、confirmed 门闩、对账恒等式）。

2. **`SOL-WALLET-CLEAN-RANK-REPLAY-UNDER-REPAIR-003-RULES-001`**（离线）  
   用当前 master-builder 规则对 rerun-002 摘要/已有输入 **重放**，输出：  
   - 新规则下 DQ / Alpha / 候选数量变化  
   - 是否需要「PARTIAL 可进入 review 但不可进 Alpha」的产品决策  

3. **把 1433 + clean-rank 的「云端可读摘要」**（仅计数、覆盖率、warning 直方图、候选 fingerprint，无明文地址）固化进 `harness/reports/`（若尚未齐全）。

### P1 — 数据可用性（有边界 live）

4. **累计盈利通路诊断修复**（先 transport，再 smoke，再审计）  
   目标：signed holdings 从 `UNAVAILABLE` → 单钱包 PARTIAL/SUCCESS 可复现。  
   **禁止** 未 GREEN 前开 1433 累计。

5. **CA 持仓试点增量**（可选）  
   - 分页预算/残差原因分类增强  
   - 仅对 residual 的 CA 做「第二数据源」研究任务（仍须 Owner 批 Provider）  
   - **不要** 因此改核心契约，除非 ≥2 CA 且会导致错误 confirmed（见 gap-matrix）

### P2 — 产品收敛（在 P0/P1 清晰后）

6. **短名单 17 → 人工复核清单**（私密本地）+ 可选 Helius 钱包活动只读抽检（已有 manual wallet 任务族）。  
7. **CA 热路径**：把清洗后的 holder 段挂到 CaScan 热路径（仍限 Helius、限字段、限预算）。  
8. **地址库沉降**：仅 verified Tier-A 写入；GMGN 只作 feature。

### 明确暂缓

- 再次 1433 全量重抓（除非 parser/契约证明旧数据不可用）  
- BSC / Robinhood  
- 全量 SOL-E2E（Pump/Dev/cluster）  
- 生产 PostgreSQL/Redis 接线  
- 自动选币 cron  

---

## 7. 审核清单（云端可直接勾选）

- [ ] 是否接受 1433 GMGN 数据 **仅作 Tier-B 候选输入**？  
- [ ] 是否要求先跑 **clean-rank 新规则离线重放** 再决定是否重抓 7d/30d？  
- [ ] 累计盈利：先修 transport 还是直接放弃 GMGN 累计改走链上？  
- [ ] CA 试点：是否立即派 **独立审计**？审计 GREEN 后是否允许扩到每日 5–10 手工 CA？  
- [ ] 下一实现波默认 Owner 门：仍 **Helius-only + 手工触发**？  

---

## 8. 相关入口文件

| 用途 | 路径 |
| --- | --- |
| 本地路径 | `docs/LOCAL_WORKSPACE_PATHS.md` |
| CA 试点验收 | `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-001/acceptance.md` |
| CA 缺口矩阵 | `harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-001/gap-matrix.md` |
| 1433 全量验收 | `harness/reports/SOL-GMGN-WALLET-STATS-FULL-1433-LIVE-RERUN-002/acceptance.md` |
| 1433 审计 | `harness/reports/SOL-GMGN-WALLET-STATS-FULL-1433-LIVE-RERUN-002-AUDIT-001/acceptance.md` |
| Clean-rank | `harness/reports/SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-001/acceptance.md` |
| Clean-rank repair 审计 | `harness/reports/SOL-WALLET-INTELLIGENCE-MASTER-CLEAN-RANK-REPAIR-AUDIT-003/acceptance.md` |
| 累计 smoke | `harness/reports/SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-001/acceptance.md` |
| 架构信任分层 | `PROJECT_ARCHITECTURE.md` §3 |

---

## 9. 本轮上传范围说明

推送到 GitHub 的分支包含：**CA 持仓清洗试点代码 + 脱敏报告 + 本系统现状文档 + 本地路径说明**。  
**不包含** chainfm_out 下 1433/排序明细文件与任何密钥。云端审核数据下一阶段时，以本文件 §6–§7 为决策输入即可。
