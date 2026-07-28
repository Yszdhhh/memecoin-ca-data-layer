# SOL-HELIUS-LIVE-SMOKE-E2E-001 upstream evidence

## Published evidence boundary

This file replaces references to local, Git-ignored Harness run directories.
It contains only committed task metadata, commit identifiers, reproducible
offline commands, and safe conclusions. It contains no credential, raw
provider payload, credential-bearing URL, or acceptance log.

## Upstream repairs

| Task | Status | Committed implementation |
| --- | --- | --- |
| `SOL-HELIUS-LIVE-MINT-CONTRACT-REPAIR-001` | DONE | `8e67d7a3b80d7afecdce329cdfa20ef1bbfbcb98` |
| `SOL-HELIUS-LIVE-ACCOUNT-CURSOR-REPAIR-001` | DONE | `44cef32f70654d67e21c4e8fbce95ef0f159bda4` |
| `SOL-HELIUS-LIVE-ACCOUNT-SHAPE-REPAIR-001` | DONE | `b4a8d67c81783ecd0650ef1e7538dcefae8e19af` |

Their committed task specifications declare the exact objective, dependency,
write scope, forbidden actions, deliverables, and acceptance commands used for
each repair. Git history preserves the corresponding implementation changes.

## Read-only reproduction

An independent reviewer can inspect each repair without a live credential:

```text
git show --stat 8e67d7a3b80d7afecdce329cdfa20ef1bbfbcb98
git show --stat 44cef32f70654d67e21c4e8fbce95ef0f159bda4
git show --stat b4a8d67c81783ecd0650ef1e7538dcefae8e19af
npm run typecheck
npm test
npm run build
```

The real-CA result remains represented only by the scrubbed
`acceptance.md` summary. Re-running the live smoke still requires explicit
manual authorization and a runtime-only credential; it is skipped by default.
