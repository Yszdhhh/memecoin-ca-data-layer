# GMGN-PORTFOLIO-CUMULATIVE-ADAPTER-AND-DIAGNOSTICS-REPAIR-001 acceptance

## Outcome

**IMPLEMENTATION COMPLETE — pending an independent, offline audit before any separately dispatched GMGN live re-test.**

This repair made **zero provider or browser requests**. It did not re-run, alter, reinterpret, or overwrite the historical 100-wallet or 1,433-wallet outputs.

## Implemented controls

- Added a minimal GMGN CLI boundary that separates API-key-only `portfolio stats` calls (strictly `7d` / `30d`) from the signed cumulative holdings command contract.
- API-key-only child processes receive an allowlisted runtime environment plus `GMGN_API_KEY` only. They never read or forward `GMGN_PRIVATE_KEY`.
- Each real child invocation receives an empty disposable working directory and home directory, preventing ambient project or user GMGN configuration files from silently changing its credential mode.
- Cumulative holdings uses the pinned local CLI contract: `portfolio holdings --limit 50 --hide-closed false --raw`. No unsupported command flag is emitted.
- Child stdout/stderr are reduced in-memory to one finite allowlisted diagnostic code and are not retained in records, external files, reports, or Git evidence.
- The new cumulative holdings page normalizer returns only aggregate realized profit, bought cost, sold income, latest activity timestamp, token count, completeness, and allowlisted warnings. Missing values are `null`.
- Only an explicit next-page cursor makes the page `PARTIAL`; an echoed request cursor cannot be mistaken for proof of an unfinished result. A page with a next cursor is never presented as an all-time complete result.

## Offline verification

| Check | Result |
| --- | --- |
| Provider / browser requests during task | `0` |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 253 passed, 1 skipped, 0 failed |
| `npm run build` | PASS |
| `git diff --check` | PASS |

Synthetic coverage confirms API-key-only private-key exclusion, disposable process isolation, signed holdings command construction, rejected unsupported flags, finite diagnostic classification, aggregate-only parsing, null-for-missing semantics, and cursor-aware partialness. Synthetic fixtures contain no external address library or credential values.

## Data and evidence boundary

- Any future GMGN observation remains `source: "gmgn"` and `verificationStatus: "unverified"`.
- This task does not establish cumulative profitability, wallet quality, UR/N/P classification, LLM conclusions, or any chain-confirmed fact.
- No raw provider payload, raw child output/error, address, label, cursor value, credential, credential-bearing URL, database/cache/queue record, or production write was created by this task.

## Required next gate

`GMGN-PORTFOLIO-CUMULATIVE-ADAPTER-AND-DIAGNOSTICS-REPAIR-AUDIT-001` is now READY. A distinct auditor identity must perform a read-only, zero-network audit and return `GREEN` or `GREEN_WITH_ADVISORY` before a new bounded cumulative-holdings live smoke task may be dispatched.