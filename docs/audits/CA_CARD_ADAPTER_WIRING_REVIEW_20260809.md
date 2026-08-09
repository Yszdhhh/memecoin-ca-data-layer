# CA Card Implementation Review — 2026-08-09

> Review agent: reviewer (Grok 4.5) | Base: main @ 38fbb17 | Scope: `df5dc8a..38fbb17` (CA-CARD-ADAPTER-001 + wiring)
> 结论：**CHANGES_REQUESTED**（confidence 0.91）

## Findings

| # | 级别 | 问题 | 位置 | 影响 |
|---|---|---|---|---|
| 1 | P0 | `AnalysisService` 恒 await `adapter.getHolders`（非分页），live `getTokenAccounts` 在 total>1000 时 hard-fail `helius_token_accounts_truncated` → `getQuickAnalysis` 整链 reject，audited 三方法到不了；任何 >1000 ATA 的币卡片无 holder 事实 | `src/application/analysis-service.ts:124-129` | 与 live smoke 2026-08-09 的 `holderFacts.available=false` 吻合 |
| 2 | P0 | `getFundingEdges` 对 snapshot owners 逐地址 HTTP 扇出，无分块/上限；数百 owners 会耗尽 CLI 250 预算或串行数十秒，远超 p95<2s | `src/application/analysis-service.ts:195-207` | 热路径预算失守 |
| 3 | P1 | 卡片 `library.lookupByAddresses` 失败被 catch 为 `[]` 且无 warning（ca-first-screen 有 `address_library_unavailable`，live 入口没有） | `src/application/live/solana-live-ca-first.ts:141-150` | 空命中与死库不可区分，违反降级契约 |
| 4 | P1 | `getPumpCreatorEvidence` 取 Enhanced 页（newest-first 100）的**最后** 4 条当"最旧"；≥100 tx 的币永远找不到 create tx → creator precedence 不触发 | `src/infrastructure/solana/helius/live-helius-data-source.ts:365-369` | dev/creator 证据系统性缺失 |
| 5 | P1 | tags 降级为 `[]` 后，完整 owner 枚举+空 exclusion 仍产出 `holder_concentration_confirmed`（confidence 1）；bonding curve 在 eligible 集合内 → top10/20 虚高却标 Tier-A confirmed | `src/application/live/solana-live-ca-first.ts:319-329` | **违反 fail-closed**：排除输入缺失不得 confirmed |

## 正面确认

- audited 三方法 fixture 行为正确；tags/facts 降级不整链 reject 的设计成立
- 14 个新测试覆盖完整/截断/解码失败/降级路径；ca-analysis-orchestration 回归锚点语义保持
- 无凭据/路径注入/无界循环问题

## 修复要求（对应 P0/P1）

1. `getHolders` 截断 → 返回 partial + warning（或 audited 分页枚举先行），不再 reject 整链
2. `getFundingEdges` 扇出：分块 + owner 上限（或 budget 共享），超限降级 warning
3. live 入口 library lookup 失败 → 显式 warning（DEGRADED）
4. creator 证据：oldest-first 分页或 creationTx-targeted 查询
5. exclusion 输入为空时 concentration 保持 unverified/partial，绝不 confirmed
