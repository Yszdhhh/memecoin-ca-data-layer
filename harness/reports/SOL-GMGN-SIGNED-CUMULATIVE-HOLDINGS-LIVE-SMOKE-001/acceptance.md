# Acceptance Report: SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-001

## Run Identity and Execution Summary

- **Run ID:** `20260729_SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-001`
- **Activation Baseline SHA:** `3acfe48e30a36e4b8d0ac3713e49edd4ccbd90b2`
- **Delivery Commit SHA:** `acca1888e3e5e9490396ed6c10e9032d86cfeaf8`
- **Task Status:** `DONE`
- **HARNESS_AGENT_ID:** `implementer-sol-gmgn-signed-cumulative-holdings-live-smoke-001`
- **CLI Invocation Count:** `1 / 1`
- **Physical Provider Request Upper Bound:** `<= 1`
- **Exact HTTP Request Count:** Not independently instrumented at the child-process boundary.

## Input Hash Verification and Target Selection

- **sol_addresses.txt SHA-256:** `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C` (MATCH)
- **sol_address_labels.json SHA-256:** `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3` (MATCH)
- **Hash Gate Result:** PASS - both external input hashes were verified before child-process execution.
- **Target Selection:** First valid unique strict Base58 32-byte address selected in memory only.
- **Irreversible Target Fingerprint:** `D1193F4330C060D51AD5B47AAC3264047049790D088A2B6BB05B3FD34D4220EC`

## Single Bounded Execution Result

- **Result Outcome Status:** `UNAVAILABLE`
- **Is PARK:** No. Credential-presence checks passed and one bounded CLI invocation was attempted.
- **Diagnostic Code:** `gmgn_request_unavailable`
- **Warning Codes:** `[]`
- **Field Coverage / Completeness:** No normalized record was returned; completeness is therefore 0%.
- **Source Contract:** Any successfully normalized record would remain `source: "gmgn"`.
- **Verification Contract:** Any successfully normalized record would remain `verificationStatus: "unverified"`.
- **Post-run Independent Audit:** Pending; `SOL-GMGN-SIGNED-CUMULATIVE-HOLDINGS-LIVE-SMOKE-AUDIT-001` is READY and must make zero provider requests.

## Data Statement and Privacy Verification

- **Data Scope Limitation:** This smoke represents at most one single-page holdings observation attempt. It is **not** complete all-time cumulative PnL, chain-confirmed fact, wallet tier, Alpha classification, or an LLM conclusion.
- **Sanitization & Privacy:** No addresses, labels, token mints, transaction signatures, counterparties, raw provider payloads, raw stdout/stderr, complete provider exceptions, API keys, or private keys are retained in Git evidence.
- **Availability Statement:** The invocation returned `UNAVAILABLE`; this report does not claim that signed cumulative holdings is operational.
