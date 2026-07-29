# Acceptance Report: GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-001

## 1. Task and Scope

- **Task ID:** `GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-001`
- **HARNESS_AGENT_ID:** `implementer-gmgn-cli-proxy-transport-root-cause-repair-001`
- **Baseline SHA (audit completion):** `a435992280134e4b2b3cc9a3f31cb84ade630172`
- **Implementation delivery SHA:** `31422e4f53d7fcab0b6b51fb5ddcfb7e28ad943a`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Run ID:** `20260729125249_GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-001`
- **Provider / Network Requests:** `0`
- **External Address Processing:** `0`
- **Credential Value Reads:** `0`
- **Proxy URL Values Written/Printed:** `0`

This task repairs only the offline-provable proxy/transport isolation defect. It does **not** claim 7d, 30d, signed holdings, or cumulative pagination recovery.

## 2. Offline Root-Cause Evidence

1. Parent process had `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, and `ALL_PROXY` set (names and schemes only; values never recorded).
2. Pre-repair `copyRuntimeEnvironment` allowlisted only `PATH`, `SystemRoot`, `ComSpec`, `PATHEXT`, `TEMP`, `TMP` — proxy variables were stripped from the disposable child.
3. Local `gmgn-cli@1.5.4` `dist/index.js` reads `HTTPS_PROXY`/`HTTP_PROXY` (and lowercase) at startup to install undici `ProxyAgent`; without them it enters direct IPv4 mode.
4. Latest three-path live diagnostic: 7d=`gmgn_cli_network_unavailable`, 30d/holdings=`PARK`, CLI invocations=1.

## 3. Implemented Controls

1. Allowlist-forward only `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` (case-insensitive parent lookup; canonical uppercase in child).
2. Do **not** forward `ALL_PROXY`.
3. Proxy URL schemes restricted to `http:` / `https:`; illegal schemes throw `GmgnCliEnvironmentError` with code `gmgn_cli_proxy_configuration_invalid` and **no URL in the message**.
4. Parent `NODE_OPTIONS` never inherited; child fixed to `NODE_OPTIONS=--use-env-proxy --dns-result-order=ipv4first`.
5. Disposable HOME/USERPROFILE/APPDATA/LOCALAPPDATA/CWD isolation retained.
6. Stats path still never forwards `GMGN_PRIVATE_KEY`.
7. Signed path still runs local private-key structural preflight.
8. `GMGN_RATE_LIMIT_AUTO_RETRY_MAX_WAIT_MS=0` retained; 30s timeout contract retained.
9. Expanded in-memory safe failure codes: dns, proxy configuration, proxy connect, connection refused/reset, TLS, plus prior allowlisted codes. Raw stdout/stderr never returned.
10. CLI invocation argument contracts for stats/holdings unchanged by the proxy repair.
11. Doctor blockers from three-path implementer: absolute external input paths removed from task `inputs`; property names renamed away from harness false-positive `INLINE_API_CREDENTIAL` matches; static test PEM header removed in favor of runtime `generateKeyPairSync`.

## 4. Offline Verification

| Check | Result |
| --- | --- |
| Provider / browser requests | `0` |
| `npm run harness:doctor` | GREEN (at original repair verify; see evidence correction below) |
| `npm run typecheck` | PASS (at verify) |
| `npm test` | PASS (at verify) |
| `npm run build` | PASS (at verify) |
| `git diff --check` | PASS (at verify) |

Synthetic coverage includes: proxy forward, no ALL_PROXY, lowercase parent keys, no forged proxy when absent, illegal scheme fail-closed without URL leak, no parent NODE_OPTIONS inheritance, fixed child NODE_OPTIONS, proxy+disposable HOME coexistence, stats private-key exclusion, signed preflight, timeout single settle+kill, safe classifier non-leak, CLI args unchanged with proxy present, real isolated child probe.

## 4b. Evidence correction (Harness declared input — ledger only)

Historical note (not erased): this report originally recorded `npm run harness:doctor` as GREEN during the repair harness verify run.

Reproducible fact at final 7d audit HEAD `42c375ec95ac5d6fe2fec49920485114133b7759`: re-running Doctor failed with:

> `GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-001: declared input is not Git-tracked: node_modules/gmgn-cli/package.json`

Cause: this task's `inputs` incorrectly declared the ephemeral runtime path `node_modules/gmgn-cli/package.json`. `node_modules` is not Git-tracked evidence and must not appear as a Harness declared input.

Correction under `HARNESS-GMGN-PROXY-TRANSPORT-INPUT-EVIDENCE-REPAIR-001` (offline, 0 provider/network):

- Removed `node_modules/gmgn-cli/package.json` from this task's `inputs`.
- Retained Git-tracked pin evidence only: `package.json` and `package-lock.json` (gmgn-cli@1.5.4 lock constraint).
- No Proxy/Transport implementation change; no 7d live re-run or re-interpretation.
- Post-correction Doctor result is recorded on the evidence-repair acceptance report (must re-run to GREEN).

## 5. Version Drift (read-only)

- Local pinned `gmgn-cli`: `1.5.4`
- CLI `--version`: `1.5.4`
- `portfolio stats --help`: periods `7d`/`30d` only
- `portfolio holdings --help`: limit/cursor/hide-closed contract unchanged
- No CLI upgrade performed in this task.

## 6. Verdict Separation (mandatory)

| Axis | Status |
| --- | --- |
| **A. Proxy/Transport code repair offline** | Implemented; pending independent audit |
| **B. 7d Live recovered** | **NOT claimed** (no live request) |
| **C. 30d Live recovered** | **NOT claimed** |
| **D. Signed Holdings recovered** | **NOT claimed** |
| **E. Cumulative full-pagination recovered** | **NOT claimed** |

## 7. Required Next Gate

`GMGN-CLI-PROXY-TRANSPORT-ROOT-CAUSE-REPAIR-AUDIT-001` must run under a **different** `HARNESS_AGENT_ID` with zero network. Only after that audit is GREEN may a separate one-request task `SOL-GMGN-PROXY-TRANSPORT-7D-LIVE-SMOKE-001` be authorized (Solana, 1 wallet, period=7d, max 1 CLI invocation, no retry/pagination/fallback).
