# OPERATOR-CONSOLE-LIVE-WIRING-001 鈥?Acceptance

## Pins

| Field | Value |
| --- | --- |
| Task ID | OPERATOR-CONSOLE-LIVE-WIRING-001 |
| Base SHA | `b3c8650c318b2854e773e6cbcb398ea5e4201fc5` |
| Starting tip | `bf9ff3c3c874a489fbed1dceda73a9c85cc87fdf` |
| Branch | `feature/operator-console-live-wiring-001` |
| PR | https://github.com/Yszdhhh/memecoin-ca-data-layer/pull/8 |
| Merge | **NOT_MERGED** (await independent audit) |

## P1 repairs

1. **Typed errors** 鈥?`OperatorApiError` codes; network 鈫?`api_unreachable`; only HTTP 404 鈫?`not_found`; scrubbed causes; data source no longer `catch => null` for transport failures.
2. **Fail-closed mapping** 鈥?missing `observedAt` / `universeDefinition` 鈫?`schema_error`; owner counts null stay null (UI `鈥擿); ratio null stays null; no browser `Date.now()` synthesis.
3. **Readiness** 鈥?`GET /api/v1/health` exposes safe `liveEnabled` + `credentialConfigured`; five flags; Live Submit disabled until READY with reason.
4. **Harness + E2E** 鈥?task JSON, reports, browser Live smoke (鈮?0 Helius, browser hosts only Console + loopback API).

## User-visible flow

```text
/ca 鈫?Ready banner 鈫?mint 鈫?Live Submit 鈫?/tasks/:taskId 鈫?terminal 鈫?/ca/:mint trust strip
```

- Fixture vs Live labels distinct.
- Market Data / Wallet Intelligence: **NOT_WIRED**.
- Retry = new `idempotencyKey` 鈫?new taskId.
- Refresh recovery: versioned task refs max 20, no raw payload.

## Tests

| Suite | Result |
| --- | --- |
| Root `npm test` | 430 pass / 0 fail / 1 skip |
| Console vitest | 64 pass |
| Operator-api tests | 18 pass |
| console:check / build | PASS |

## Browser Live smoke

- Public CA: 1 (fingerprint `1c2c7d3cac226153`)
- taskId: `e024fa79-a9f3-4644-abb5-555ac3f3e3be`
- status: completed 路 providerRequestCount: 6 / budget 10
- accountingEligible: true 路 exclusion: partial 路 concentrationEligible: false
- browserDirectHelius: **0** 路 credentialExposure: **0**
- Screenshots: local manifest only (not uploaded to Git)

## Privacy

- chainfm_out reads = 0
- private wallet reads = 0
- raw payload committed = 0
- credential persisted in browser = 0

## Verdict

**GREEN_FOR_INDEPENDENT_AUDIT**

Independent auditor must re-verify tip after push; Implementer does not merge.


## Final implementation tip

`8be1493d2d883ea1f450c83165a28b0deec14987`

