# Dispatch: GMGN-PORTFOLIO-QUERY-TRANSPORT-DIAGNOSTICS-REPAIR-001

- **Task ID:** `GMGN-PORTFOLIO-QUERY-TRANSPORT-DIAGNOSTICS-REPAIR-001`
- **Role:** Internal Coordinator + Implementer
- **HARNESS_AGENT_ID:** `implementer-gmgn-portfolio-query-transport-diagnostics-repair-001`
- **Branch:** `codex/solana-daily-new-token-analysis`
- **Baseline:** `acca1888e3e5e9490396ed6c10e9032d86cfeaf8`
- **Network budget:** `0`

## Exact Assignment

Repair only the known offline defects in the GMGN Solana portfolio path. The prior evidence proves that the query chain is not restored: the 100-wallet stats run mapped `0/200`, the 1,433-wallet stats run mapped `5/2866`, and the signed holdings smoke returned `UNAVAILABLE` with only the generic code `gmgn_request_unavailable`.

Implement the smallest auditable change that:

1. makes `portfolio stats` batch-capable for multiple strict Solana wallet inputs instead of forcing one child/provider request per wallet;
2. replaces the stats path's 5-second process ceiling and the signed path's unbounded process with one explicit bounded timeout contract;
3. runs GMGN child processes with an exact IPv4-first Node DNS policy while preserving disposable HOME/CWD isolation;
4. validates signed private-key PEM structure and supported key type locally before child spawn, returning only an allowlisted safe code and zero request use on failure;
5. expands the safe diagnostic taxonomy for clock/timestamp rejection, request-contract rejection, provider 5xx/unavailable, CLI contract mismatch, and malformed signing material without retaining provider text;
6. corrects the signed holdings acceptance report's baseline/delivery SHA wording, mojibake, and exact physical-request claim, and makes its post-run zero-network audit task READY;
7. adds only pure synthetic offline tests.

## Non-Negotiable Boundaries

No live request. No external address-file read. No secret value read/display. No raw provider output in fixtures or reports. No new dependency. No retry/pagination/background loop. No production persistence. No upgrade of GMGN evidence beyond `source: "gmgn"` and `verificationStatus: "unverified"`.

## Follow-on Gate

Create `GMGN-PORTFOLIO-QUERY-TRANSPORT-DIAGNOSTICS-REPAIR-AUDIT-001` for an independent auditor with a different HARNESS_AGENT_ID and zero network. Only after that audit is GREEN may a separate exact-budget live diagnostic test one API-key-only stats batch (7d and 30d) and one signed holdings request.
