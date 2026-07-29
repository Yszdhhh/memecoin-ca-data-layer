# Dispatch: HARNESS-GMGN-PORTFOLIO-CUMULATIVE-AUDIT-EVIDENCE-LEDGER-REPAIR-001

## Exact task

Execute **only** `harness/tasks/HARNESS-GMGN-PORTFOLIO-CUMULATIVE-AUDIT-EVIDENCE-LEDGER-REPAIR-001.json`.

## Role and identity

- Role: implementer / coordinator
- Required `HARNESS_AGENT_ID`: `implementer-harness-gmgn-portfolio-cumulative-audit-evidence-ledger-repair-001`
- This is a **zero-network evidence and ledger reconciliation repair task**.

## Objective & Strict Operational Boundaries

- **Max Network Requests**: 0
- **Max Provider Requests**: 0
- **Max Address Processing Count**: 0
- **Max Wallet Selection Count**: 0
- **Credential Requirements**: Do NOT require, inspect, or test for `GMGN_API_KEY` or `GMGN_PRIVATE_KEY`.
- **Live Tasks**: Do NOT create, dispatch, or execute any downstream live smoke tasks.

## Allowlisted Write Set

- `harness/tasks/HARNESS-GMGN-PORTFOLIO-CUMULATIVE-AUDIT-EVIDENCE-LEDGER-REPAIR-001.json`
- `harness/dispatches/HARNESS-GMGN-PORTFOLIO-CUMULATIVE-AUDIT-EVIDENCE-LEDGER-REPAIR-001.md`
- `harness/inputs/HARNESS-GMGN-PORTFOLIO-CUMULATIVE-AUDIT-EVIDENCE-LEDGER-REPAIR-001/manifest.json`
- `harness/reports/HARNESS-GMGN-PORTFOLIO-CUMULATIVE-AUDIT-EVIDENCE-LEDGER-REPAIR-001/acceptance.md`
- `harness/reports/GMGN-PORTFOLIO-CUMULATIVE-ADAPTER-AND-DIAGNOSTICS-REPAIR-AUDIT-001/acceptance.md`
- `harness/ledger/tasks.json`

## Mandatory Execution Steps

1. Align `harness/ledger/tasks.json` entry for `GMGN-PORTFOLIO-CUMULATIVE-ADAPTER-AND-DIAGNOSTICS-REPAIR-AUDIT-001` from `READY` to `DONE`. Do not touch any unrelated tasks.
2. Correct corrupted budget text in `harness/reports/GMGN-PORTFOLIO-CUMULATIVE-ADAPTER-AND-DIAGNOSTICS-REPAIR-AUDIT-001/acceptance.md` to state clearly: "本审计不授权任何 live 请求。后续 Signed Cumulative Holdings Live Smoke 必须由独立 task spec 和 dispatch 明确规定整数物理请求上限；在该独立任务创建并审计前，不得发起任何 live 请求。"
3. Supplement audit evidence traceability in `harness/reports/GMGN-PORTFOLIO-CUMULATIVE-ADAPTER-AND-DIAGNOSTICS-REPAIR-AUDIT-001/acceptance.md` including baseline SHA `cb6ee46cc420f5cf1c9f3f5dca0e158dc375690f`, completion SHA `9d6729391413c23fa036a67f458ed4995f8719a9`, remote SHA `9d6729391413c23fa036a67f458ed4995f8719a9`, clean workspace verification, and zero network requests.
4. Sanitize subprocess output retention wording in Section 4.D of the audit report to process-boundary reference phrasing.
5. Produce the acceptance report and input manifest for this repair task.
