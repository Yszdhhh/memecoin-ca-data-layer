# OPERATOR-CONSOLE-LIVE-WIRING-001 — Acceptance

## Pins

| Field | Value |
| --- | --- |
| Task ID | OPERATOR-CONSOLE-LIVE-WIRING-001 |
| Base SHA | `b3c8650c318b2854e773e6cbcb398ea5e4201fc5` |
| Starting tip | `bf9ff3c3c874a489fbed1dceda73a9c85cc87fdf` |
| Final implementation tip | 61d1817414ef7ebebd9d550cfbdb14f57b612d0a |
| Branch | `feature/operator-console-live-wiring-001` |
| PR | https://github.com/Yszdhhh/memecoin-ca-data-layer/pull/8 |
| Merge | **NOT_MERGED** (await independent audit) |

## P1 repairs

1. **Typed errors** — OperatorApiError codes; network → api_unreachable; only HTTP 404 → not_found; no catch=>null.
2. **Fail-closed mapping** — missing observedAt/universeDefinition → schema_error; no observedAt injection from task endedAt in getTask; owner counts null ≠ 0; ratio null ≠ 0%.
3. **Readiness** — five flags; Live Submit disabled until READY.
4. **Harness + E2E** — reports, browser smoke ≤10 Helius, browser→Helius=0; running≠terminal screenshot SHAs.

## Tests

| Suite | Result |
| --- | --- |
| Root npm test | 430 pass / 0 fail / 1 skip |
| Console vitest | 66 pass |
| console:check | PASS |
| harness:doctor | FAIL_PREEXISTING (wallets.json only) |

## Browser Live smoke

- taskId e024fa79-a9f3-4644-abb5-555ac3f3e3be · completed · 6/10 requests
- browserDirectHelius=0 · credentialExposure=0
- task-running sha256 50ce0a44… ≠ task-terminal sha256 0c5b2d89…

## Verdict

**GREEN_FOR_INDEPENDENT_AUDIT**


