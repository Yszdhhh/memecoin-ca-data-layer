# Operator Console Data Source V1

Stable data-source contract for the Operator Console. Pages depend only on this
interface so Fixture → HTTP/hotpath swap does not rewrite UI.

## Modes

| Mode | Class | Phase |
| --- | --- | --- |
| fixture | `FixtureOperatorConsoleDataSource` | default (no env) |
| http | `HttpOperatorConsoleDataSource` | G1 Live Wiring when `VITE_OPERATOR_API_BASE=http://127.0.0.1:8787` (loopback only) |

HTTP mode talks only to loopback Operator API (`/api/v1/ca-holder-tasks*`, results).
Browser never holds `HELIUS_API_KEY`. Wallets/addresses remain fixture in G1.

## Interface (summary)

```ts
listCaScans() / getCaScan(mint)
listWallets() / getWallet(id)
listAddressLabels() / saveLocalDemoLabel(input)
listTasks() / getTask(id) / createCaHolderTask(mint)
getDataSourceMeta()
```

HTTP Live create path is `createCaHolderTask` (not `createLocalDemoTask`).
Fixture mode implements the same method as a local demo with zero provider calls.

Console init probes `GET /api/v1/health` for readiness flags:

```text
HTTP_CONFIGURED · API_REACHABLE · LIVE_ENABLED · CREDENTIAL_AVAILABLE · READY
```

Health may expose only safe fields (`liveEnabled`, `credentialConfigured`, `provider`, `chain`, `bindMode`, …).
Never credential value/hash/length or full provider endpoint. Setting API URL alone is not Live Ready.


## Trust fields (required on CA views)

```text
accountingEligible
exclusionCoverage
concentrationEligible
```

`judgmentEligible` must not be the primary concentration gate (legacy alias of accounting only).

## Privacy

Fixture mode uses scrubbed pilot reports + irreversible fingerprints + synthetic demos.
No `chainfm_out`, no DPAPI, no provider keys, no Live calls.
