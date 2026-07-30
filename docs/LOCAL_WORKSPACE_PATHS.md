# Local workspace paths (Windows operator)

Cloud agents and remote CI do **not** see this machine’s drive layout.
This file is the checked-in map for local Solana CA work so later tasks can
reuse the same locations without rediscovery.

## Canonical local clone (primary)

| Role | Path |
| --- | --- |
| Primary repo root | `G:\链上战壕` |
| Git remote | `https://github.com/Yszdhhh/memecoin-ca-data-layer.git` |
| Default base for this wave | `main@777e0131ec663178c6c4cc5cc0c4584e60be2381` |

## Named worktrees on G: (same remote)

These are additional worktrees under `G:\`, each checked out to a feature branch:

| Worktree directory | Typical branch |
| --- | --- |
| `G:\链上战壕` | `main` / current feature |
| `G:\链上战壕-codex-ca-scan-response-v1-001` | `codex/ca-scan-response-v1-001` |
| `G:\链上战壕-codex-ca-scan-response-v1-repair-001` | `codex/ca-scan-response-v1-repair-001` |
| `G:\链上战壕-codex-solana-daily-new-token-analysis` | `codex/solana-daily-new-token-analysis` |
| `G:\链上战壕-codex-solana-live-ca-first` | `codex/solana-live-ca-first` |
| `G:\链上战壕-codex-solana-manual-ca-batch-live-smoke` | `codex/solana-manual-ca-batch-live-smoke` |
| `G:\链上战壕-codex-wallet-ca-scan-final-integration` | `codex/wallet-ca-scan-final-integration` |

## AO worktrees (secondary / may lag main)

| Path | Notes |
| --- | --- |
| `C:\Users\10639\.ao\data\worktrees\memecoin-ca-data-layer\` | AO-managed worktrees; often behind `origin/main` |
| Project base dirs under `C:\Users\10639\.ao\project-bases\` | Bootstrap / audit bases |

Prefer **`G:\链上战壕`** for SOL-CA pilot work unless a dispatch names another worktree.

## Runtime credentials (never commit)

| Item | Path / env |
| --- | --- |
| DPAPI secret directory | `%LOCALAPPDATA%\memecoin-ca-data-layer\secrets` |
| Helius key file | `%LOCALAPPDATA%\memecoin-ca-data-layer\secrets\HELIUS_API_KEY.dpapi` |
| Runtime env | `HELIUS_API_KEY` (process-only), optional `HELIUS_RPC_ENDPOINT_MODE` |
| Configure script | `scripts/configure-solana-daily-credentials.ps1` |

Missing `HELIUS_API_KEY` must fail closed as `RUNTIME_CREDENTIAL_UNAVAILABLE`.
Do not write keys, credential-bearing URLs, raw headers, or unscrubbed provider payloads into git.

### Helius endpoint note (this operator host)

On the Windows operator machine used for this pilot, public DNS for
`mainnet.helius-rpc.com` has been observed to resolve to `127.0.0.1`, which
breaks Node `fetch` with `ECONNREFUSED`. Prefer:

```text
HELIUS_RPC_ENDPOINT_MODE=gatekeeper_beta
```

(`https://beta.helius-rpc.com/` — already allowlisted in `LiveHeliusDataSource`).
Also clear process `HTTP(S)_PROXY` if a local proxy interferes with that path.
The pilot script `scripts/run-solana-ca-real-data-cleaning-pilot.ps1` defaults to
`gatekeeper_beta` and clears proxy env vars for the Node process.

## Local-only run output (not acceptance evidence)

| Path | Policy |
| --- | --- |
| `harness/runs/` | Gitignored; ephemeral |
| `harness/logs/` | Gitignored; ephemeral |
| `%LOCALAPPDATA%\memecoin-ca-data-layer\reports\` | Local operator reports |
| Provider raw payloads | Max 7 days local retention; never commit |

Public acceptance evidence must be scrubbed and written under `harness/reports/<TASK_ID>/` (and related fixed evidence paths).

## How later tasks should reference this

1. Open this file first when the dispatch says “local path” or “G 盘 / 链上战壕”.
2. `cd` to the primary root unless the task freezes another worktree.
3. Create feature branches from the task’s `Base` commit on that root.
4. Keep secrets outside the repo; inject only at process start via scripts.

## Task that introduced this note

`SOL-CA-REAL-DATA-CLEANING-PILOT-001` — Solana CA-first real holder cleaning pilot.
