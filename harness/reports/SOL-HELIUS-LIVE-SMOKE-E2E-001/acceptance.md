# SOL-HELIUS-LIVE-SMOKE-E2E-001

## Verdict

GREEN

## Scope

One manually invoked, read-only Helius smoke against coordinator-selected public
Solana CA `DMYA7GexqPCeZeFxjDRjAgPbut24K3DhUAXcMH48JHoX` on 2026-07-27.

## Safe evidence

- Finalized mint read passed: decimals `6`; a raw-integer supply shape was
  validated without retaining the returned value.
- Token metadata was present.
- Holder-token-account read was complete: structured total matched `344`
  returned account records; indexed slot `435558285`.
- Mint response finalized slot: `435558248`.
- The live test used three Helius read-only requests within a five-request
  local budget and completed successfully.

No provider payload, credential, credential-bearing URL, database write,
scheduler, secondary provider, Pump creator claim, Dev-history claim,
wallet-tag claim, or wallet-fact claim was retained or activated.

## Reproducibility boundary

The test is skipped by default. It runs only when the explicit manual
`RUN_HELIUS_LIVE_E2E=1` gate is set and a runtime-only Helius credential is
available.