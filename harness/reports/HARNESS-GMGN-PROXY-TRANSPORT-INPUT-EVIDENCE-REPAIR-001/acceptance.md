# Acceptance Report: HARNESS-GMGN-PROXY-TRANSPORT-INPUT-EVIDENCE-REPAIR-001

## 1. Task and Scope

- **Task ID:** `HARNESS-GMGN-PROXY-TRANSPORT-INPUT-EVIDENCE-REPAIR-001`
- **HARNESS_AGENT_ID:** `implementer-harness-gmgn-proxy-transport-input-evidence-repair-001`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Baseline HEAD at task open:** `42c375ec95ac5d6fe2fec49920485114133b7759`
- **Origin HEAD at task open:** `b5ff1c823094fdc62b3e9a41ca989dae43ae9582`
- **Local ahead of origin at open:** `7`
- **Provider / Network Requests:** `0`
- **Credential reads:** `0`
- **Address processing:** `0`

Pure offline Harness input-evidence repair. No GMGN query implementation change. No Live request. No 7d re-run. No 30d/holdings task.

## 2. Defect

`npm run harness:doctor` at HEAD `42c375e` reported:

> `GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-001: declared input is not Git-tracked: node_modules/gmgn-cli/package.json`

Source: `harness/tasks/GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-001.json` `inputs` incorrectly listed `node_modules/gmgn-cli/package.json`.

## 3. Repair Actions

1. Removed `node_modules/gmgn-cli/package.json` from that task's `inputs`.
2. Retained Git-tracked version pin evidence only:
   - `package.json`
   - `package-lock.json`
3. Did **not** add any `node_modules` path to Git.
4. Did **not** commit gmgn-cli install artifacts.
5. Added evidence-correction sections to:
   - `harness/reports/GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-001/acceptance.md`
   - `harness/reports/GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-AUDIT-001/acceptance.md`
   Historical Doctor GREEN claims are preserved; the later reproducible Doctor failure and ledger fix are documented.
6. Pre-created independent audit task `HARNESS-GMGN-PROXY-TRANSPORT-INPUT-EVIDENCE-REPAIR-AUDIT-001` (BLOCKED_DEPENDENCY until this repair is DONE; then READY for a different agent).
7. Ledger updated only for the new repair/audit entries; unrelated DONE tasks unchanged.

## 4. Version evidence statement

- **gmgn-cli@1.5.4** pin is evidenced by Git-tracked `package.json` and `package-lock.json`.
- `node_modules/gmgn-cli/package.json` is a local ephemeral runtime artifact only; it must not be a Harness declared input.
- This repair does **not** change Proxy/Transport implementation.
- This repair does **not** re-interpret or re-run 7d Live.
- Provider/Network request count: **0**.

## 5. Git tracked-input checks

| Check | Result |
| --- | --- |
| `git ls-files --error-unmatch package.json` | PASS (tracked) |
| `git ls-files --error-unmatch package-lock.json` | PASS (tracked) |
| `git ls-files node_modules/gmgn-cli/package.json` | empty / not tracked |
| No new `node_modules` files staged or committed | PASS |

## 6. Offline verification

| Check | Result |
| --- | --- |
| Provider / Network | `0` / `0` |
| Task validate (this repair) | PASS (at verify) |
| `npm run harness:doctor` | PASS / GREEN (at verify; post-correction) |
| `npm run typecheck` | PASS (at verify) |
| `npm test` | PASS (at verify) |
| `npm run build` | PASS (at verify) |
| `git diff --check` | PASS (at verify) |

## 7. Verdict separation

| Axis | Status |
| --- | --- |
| A. Proxy/Transport code | Unchanged by this task |
| B. 7d Live | Not re-run; prior scoped recovery evidence not re-interpreted here |
| C. 30d Live | Not tested |
| D. Signed Holdings | Not tested |
| E. Cumulative pagination | Not tested |
| Harness Doctor ledger defect | **Repaired offline** (pending independent audit) |

## 8. Next gate

Independent auditor must use `HARNESS_AGENT_ID=auditor-harness-gmgn-proxy-transport-input-evidence-repair-001`, zero network/provider, re-run Doctor, confirm Git-tracked inputs, confirm no GMGN implementation code change, and finish GREEN before any push of the current local commit stack to `origin/codex/solana-daily-new-token-analysis`.

This implementer run **does not** execute that audit and **does not** push.
