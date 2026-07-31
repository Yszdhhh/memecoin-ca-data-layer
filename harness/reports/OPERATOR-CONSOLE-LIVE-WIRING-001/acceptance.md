# OPERATOR-CONSOLE-LIVE-WIRING-001 — Acceptance

## Pins

| Field | Value |
| --- | --- |
| Task ID | OPERATOR-CONSOLE-LIVE-WIRING-001 |
| Base SHA | `b3c8650c318b2854e773e6cbcb398ea5e4201fc5` |
| Starting tip | `bf9ff3c3c874a489fbed1dceda73a9c85cc87fdf` |
| Final implementation tip | _(set to branch HEAD / PR headRefOid at freeze — see pr-metadata.json)_ |
| Branch | `feature/operator-console-live-wiring-001` |
| PR | https://github.com/Yszdhhh/memecoin-ca-data-layer/pull/8 |
| Merge | **NOT_MERGED** (await independent audit) |

## P1 repairs

1. **Typed errors** — `OperatorApiError` codes; network → `api_unreachable`; only HTTP 404 → `not_found`; scrubbed causes; data source no longer `catch => null` for transport failures.
2. **Fail-closed mapping** — missing `observedAt` / `universeDefinition` → `schema_error`; owner counts null stay null (UI `—`); ratio null stays null; **no browser synthesis of observedAt from task endedAt** (getTask passes API result through mapper only).
3. **Readiness** — `GET /api/v1/health` exposes safe `liveEnabled` + `credentialConfigured`; five flags; Live Submit disabled until READY with reason.
4. **Harness + E2E** — task JSON, reports, browser Live smoke (≤10 Helius, browser hosts only Console + loopback API).

## User-visible flow

```text
/ca → Ready banner → mint → Live Submit → /tasks/:taskId → terminal → /ca/:mint trust strip
```

- Fixture vs Live labels distinct.
- Market Data / Wallet Intelligence: **NOT_WIRED**.
- Retry = new `idempotencyKey` → new taskId.
- Refresh recovery: versioned task refs max 20, no raw payload.

## Tests

| Suite | Result |
| --- | --- |
| Root `npm test` | 430 pass / 0 fail / 1 skip |
| Console vitest | 66 pass (includes getTask missing observedAt → schema_error) |
| Operator-api tests | 18 pass |
| console:check / build | PASS |
| harness:doctor | FAIL_PREEXISTING (`wallets.json` only) |

## Browser Live smoke

- Public CA: 1 (fingerprint `1c2c7d3cac226153`)
- taskId: `e024fa79-a9f3-4644-abb5-555ac3f3e3be`
- status: completed · providerRequestCount: 6 / budget 10
- accountingEligible: true · exclusion: partial · concentrationEligible: false
- browserDirectHelius: **0** · credentialExposure: **0**
- Screenshots: local manifest only; **task-running SHA ≠ task-terminal SHA**

## Privacy

- chainfm_out reads = 0
- private wallet reads = 0
- raw payload committed = 0
- credential persisted in browser = 0

## Verdict

**GREEN_FOR_INDEPENDENT_AUDIT**

Independent auditor must re-verify tip after push; Implementer does not merge.
