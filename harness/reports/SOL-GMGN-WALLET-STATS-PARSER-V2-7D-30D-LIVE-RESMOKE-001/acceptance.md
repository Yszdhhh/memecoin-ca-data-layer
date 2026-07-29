# Acceptance Report: SOL-GMGN-WALLET-STATS-PARSER-V2-7D-30D-LIVE-RESMOKE-001

- **Task ID:** `SOL-GMGN-WALLET-STATS-PARSER-V2-7D-30D-LIVE-RESMOKE-001`
- **Run ID:** `run-1785347435759`
- **Baseline SHA:** `928c42ca2c48b26c670e89ed57e63279c62e3ccb`
- **Activation SHA:** `928c42ca2c48b26c670e89ed57e63279c62e3ccb`
- **Execution SHA:** `928c42ca2c48b26c670e89ed57e63279c62e3ccb`
- **Delivery SHA:** `928c42ca2c48b26c670e89ed57e63279c62e3ccb`
- **Role:** Implementer (`implementer-sol-gmgn-wallet-stats-parser-v2-7d-30d-live-resmoke-001`)

---

## 1. External Input Verification

- **sol_addresses.txt SHA-256:** `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C` (`MATCH`)
- **sol_address_labels.json SHA-256:** `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3` (`MATCH`)
- **Target Fingerprint:** `5D4F995BAA762A0081532C9E1C434BB9BD26E07EFBD7B8C927AE3A9E423724B4`
- **Credential API Key Present:** `true`

---

## 2. Live Re-smoke Execution & Parser V2 Results

- **Overall Task Status:** `UNAVAILABLE`
- **CLI Invocation Budget Cap / Used:** `2` / `2`
- **Physical Provider Request Upper Bound:** `2`
- **Serial Delay Between Periods:** `1,000ms` (verified >= 1,000ms delay)

### 7d Period Results
- **Status:** `UNAVAILABLE`
- **Parser Status:** `UNAVAILABLE`
- **Completeness:** `0` (0/11 fields, 0%)
- **Diagnostic Code:** `gmgn_wallet_stats_schema_unrecognized`
- **Warning Codes:** `["gmgn_wallet_stats_schema_unrecognized"]`
- **Request Budget Used:** `1`

### 30d Period Results
- **Status:** `UNAVAILABLE`
- **Parser Status:** `UNAVAILABLE`
- **Completeness:** `0` (0/11 fields, 0%)
- **Diagnostic Code:** `gmgn_wallet_stats_schema_unrecognized`
- **Warning Codes:** `["gmgn_wallet_stats_schema_unrecognized"]`
- **Request Budget Used:** `1`

---

## 3. Metadata & Evidence Provenance

- **Source:** `gmgn`
- **Verification Status:** `unverified`
- **External Output Directory:** `C:\Users\10639\chainfm_out\sol\derived\gmgn-wallet-stats-parser-v2-7d-30d-live-resmoke-001\`
- **External Output Files:**
  - `stats_7d.json`
  - `stats_30d.json`
  - `summary.json`

---

## 4. Privacy & Security Audit

- **Plaintext Addresses:** `0` recorded / `0` logged
- **Address Labels:** `0` recorded / `0` logged
- **API Key / Private Key:** `0` recorded / `0` logged
- **Proxy / Credential URLs:** `0` recorded / `0` logged
- **Raw Payload / Stdout / Stderr:** `0` recorded / `0` logged

---

## 5. Independent Audit Authorization

- **Independent Audit Task ID:** `SOL-GMGN-WALLET-STATS-PARSER-V2-7D-30D-LIVE-RESMOKE-AUDIT-001`
- **Audit Task Status:** `READY`
- **Audit Agent ID:** `auditor-sol-gmgn-wallet-stats-parser-v2-7d-30d-live-resmoke-001`
- **Authorization:** `ALLOWED` to proceed to independent audit.
