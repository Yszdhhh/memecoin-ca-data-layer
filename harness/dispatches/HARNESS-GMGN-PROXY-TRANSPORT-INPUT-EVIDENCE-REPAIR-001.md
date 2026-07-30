# Dispatch: HARNESS-GMGN-PROXY-TRANSPORT-INPUT-EVIDENCE-REPAIR-001

- **Task ID:** `HARNESS-GMGN-PROXY-TRANSPORT-INPUT-EVIDENCE-REPAIR-001`
- **Role:** Implementer
- **HARNESS_AGENT_ID:** `implementer-harness-gmgn-proxy-transport-input-evidence-repair-001`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Baseline HEAD:** `42c375ec95ac5d6fe2fec49920485114133b7759`
- **Network budget:** `0`
- **Provider budget:** `0`

## Exact Assignment

1. Remove `node_modules/gmgn-cli/package.json` from `inputs` of `GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-001`.
2. Keep Git-tracked `package.json` and `package-lock.json` as gmgn-cli pin evidence.
3. Add evidence-correction notes to the original repair and repair-audit acceptance reports (do not erase historical Doctor GREEN claims).
4. Create this repair's dispatch, input manifest, acceptance report, and independent audit task (status READY for a different agent).
5. Update ledger only for the new repair/audit entries; do not reopen unrelated DONE tasks.

## Non-Negotiable Boundaries

Zero network/provider/credential/address work. No GMGN implementation changes. No live re-run. No node_modules Git add. Implementer must not execute the independent audit.
