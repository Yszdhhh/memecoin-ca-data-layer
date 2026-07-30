# Operator Console Data Source V1

Stable data-source contract for the Operator Console. Pages depend only on this
interface so Fixture → HTTP/hotpath swap does not rewrite UI.

## Modes

| Mode | Class | Shell phase |
| --- | --- | --- |
| fixture | `FixtureOperatorConsoleDataSource` | **active** |
| http | `HttpOperatorConsoleDataSource` | scaffold only (`not_configured`) |

## Interface (summary)

```ts
listCaScans() / getCaScan(mint)
listWallets() / getWallet(id)
listAddressLabels() / saveLocalDemoLabel(input)
listTasks() / getTask(id) / createLocalDemoTask(mint)
getDataSourceMeta()
```

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
