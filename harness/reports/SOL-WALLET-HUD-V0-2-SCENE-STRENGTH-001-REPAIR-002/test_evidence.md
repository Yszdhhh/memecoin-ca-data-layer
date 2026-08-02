# Repair-002 test evidence

## Green checks

- HUD regression suite: 8/8 passed.
- Full repository test suite: 468 passed, 1 skipped, 0 failed.
- Typecheck, build, security scan, and git diff --check: passed.
- Offline HUD refresh: 32 wallets, 0 shadow events, 0 network requests.

## Repair-specific assertions

- Active activity tier with unknown event count remains eligible and reports ACTIVITY_EVENT_COUNT_UNKNOWN.
- Loss-only chain sample fails the reproduction threshold.
- Existing scene qualification and primary/debounce tests remain green.

## Reproduction

Two explicit-private-root offline replays completed at the fixed evaluation timestamp with identical source snapshot and output hashes. A repeat run increased the history file byte length, confirming append-only write behavior without reading private raw content.
