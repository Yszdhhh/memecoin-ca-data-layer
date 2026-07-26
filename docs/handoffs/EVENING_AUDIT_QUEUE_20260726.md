# 晚间审计队列 — 2026-07-26

Owner 指示：白天继续实现，**有要审的晚上一起审**。

## 队列（建议顺序）

| # | 任务 | 类型 | 输入/报告路径 | 前置 |
|---|---|---|---|---|
| 1 | `SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001` | T2 auditor | `docs/audits/SOL-CA-ORCHESTRATION-REPAIR-AUDIT-001.md` | repair run GREEN |
| 2 | `SOL-WALLET-CLEANING-AUDIT-003` | T2 auditor | `docs/audits/SOL-WALLET-CLEANING-AUDIT-003.md` | wallet implementer DONE |
| 3 | `HARNESS-AO-AUTOMATION-AUDIT-001` | T2 auditor | `docs/audits/HARNESS-AO-AUTOMATION-AUDIT-001.md` | lifecycle implementer DONE |

## 实现侧今日提交指针（审前先 `git log`）

- CA orchestration repair + fable handoff：见 `docs/handoffs/FABLE_REVIEW_SOL_CA_ORCHESTRATION_REPAIR_001_20260726.md`
- Wallet cleaning：`src/domain/rules/funding-clusters.ts`、`AnalysisResult.walletCleaningEvidence`
- Harness lifecycle：`tsx harness/cli.ts lifecycle plan|verify|apply-readiness`
- E2E gap research refresh：`docs/research/SOL-E2E-GAP-RESEARCH-002.md`

## 审计硬规则（提醒）

- 审计员 **只写** 报告路径，不改业务代码  
- 不得把 implementer run 当成独立审计  
- FAIL 就开 repair 链，不要直接解锁 `SOL-E2E-001` live 腿  

## 快速命令

```bash
cd "G:/链上战壕"
git status
git log --oneline -12
npm test
npm run harness:doctor
npx tsx harness/cli.ts lifecycle plan
npx tsx harness/cli.ts lifecycle verify
```
