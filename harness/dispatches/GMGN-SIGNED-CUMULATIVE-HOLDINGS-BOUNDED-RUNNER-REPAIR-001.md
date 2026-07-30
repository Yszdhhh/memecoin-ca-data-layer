# Dispatch: GMGN-SIGNED-CUMULATIVE-HOLDINGS-BOUNDED-RUNNER-REPAIR-001

## Exact task
Execute only `harness/tasks/GMGN-SIGNED-CUMULATIVE-HOLDINGS-BOUNDED-RUNNER-REPAIR-001.json`. This is a zero-network repair, not a live data task.

## Required sequence
1. Create the task spec, dispatch, and input evidence manifest before source changes or Harness execution.
2. Keep all test inputs synthetic and in memory. Do not inspect the external directory or process credentials.
3. Add the smallest tracked runner and test seams that mechanically enforce the preflight findings.
4. Update the live smoke dependency to `SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-PREFLIGHT-AUDIT-002` while it remains blocked.
5. Run the required offline acceptance commands and write only safe aggregate evidence.
6. Commit normally and push normally. Then wait for an independent audit; do not run the live smoke.

## Non-negotiable controls
- The actual child environment must contain `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS=0`; tests must assert it.
- One runner operation must construct one fixed `portfolio holdings` invocation with `--chain sol --limit 50 --hide-closed false --raw` and no `--cursor`.
- Hash mismatch and missing credentials must produce safe codes before any spawn.
- Never retain a selected address or raw child output after parsing/classification.

## Scope and evidence
Only the exact task write set is writable. The report must state zero network/provider requests, no external input or credential reads, offline synthetic tests, modified control points, and validation results. It must not contain actual addresses, labels, secrets, raw responses, raw stdout/stderr, or complete errors.
