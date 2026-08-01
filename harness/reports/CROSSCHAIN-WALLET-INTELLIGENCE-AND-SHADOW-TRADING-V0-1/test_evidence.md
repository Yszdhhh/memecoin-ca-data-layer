# Test evidence

## Program graph and write-set replay

- Registered new task specs: 15
- Registered ledger entries: 15
- Unknown dependencies: 0
- Dependency cycles: 0
- New-task write-set conflicts: 0
- Governance diff out-of-scope paths: 0
- Deterministic governance replay: PASS (same-input hash recorded in `deterministic_replay_result.json`)

## Repository quality commands

- `npm run typecheck`: PASS
- `npm test`: PASS — 460 passed, 1 skipped, 0 failed
- `npm run build`: PASS
- `npm run security:scan`: PASS — `classifiedLeaks: 0`
- `git diff --check`: PASS
- `npm run harness:doctor`: FAIL only because the existing broad `wallet*.json` forbidden-name rule matches three tracked scrubbed fixture/artifact files.

The registered Harness repair must prove a narrow fix that keeps synthetic raw/private wallet-like artifacts rejected. No private source record was read into this report.
