# Acceptance Report: GMGN-WALLET-STATS-SINGLE-WALLET-INVOCATION-TRANSPORT-REPAIR-001

## Verdict

**GREEN (offline implementation repair)**

## Root cause addressed

The independently audited live cardinality diagnostic showed that a 20-wallet GMGN stats invocation returned one top-level identity record and omitted 19 requested identities. Multi-wallet batching is therefore not safe for complete wallet coverage.

## Implementation

- Production wallet-stats invocations now require exactly one wallet.
- The application planner accepts only wallet batch size 1.
- The 20-wallet pilot plans 40 invocations; the 100-wallet job plans 200 invocations; the 1,433-wallet 7d/30d job plans exactly 2,866 invocations.
- Adjacent invocations remain strictly serial with at least 1,000ms delay.
- The historical 20-wallet cardinality diagnostic retains a separate, explicitly named diagnostic-only builder and cannot be reached through the production stats builder.
- API-key-only environment isolation, private-key exclusion, fixed timeout, retry disablement, safe diagnostics, parser status propagation, null-on-missing fields, source `gmgn`, and verification status `unverified` remain unchanged.

## Offline evidence

Synthetic tests assert one wallet per production invocation, reject multi-wallet production invocation construction, and verify exact bounded counts of 40, 200, and 2,866. The historical diagnostic tests continue to prove its diagnostic-only path without network access.

## Verification

- typecheck: PASS
- tests: 333 total, 332 passed, 1 skipped, 0 failed
- build: PASS
- git diff --check: PASS
- network/provider/GMGN CLI requests: 0
- credential reads: 0
- real-address processing: 0

## Completion boundary

This repair does not itself prove live availability and does not authorize the 1,433-wallet rerun. Independent zero-network audit must return GREEN, followed by a bounded post-repair 7d/30d live re-smoke and independent audit.
