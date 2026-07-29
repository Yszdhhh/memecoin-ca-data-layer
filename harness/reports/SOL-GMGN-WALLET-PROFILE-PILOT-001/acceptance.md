# Acceptance Report: SOL-GMGN-WALLET-PROFILE-PILOT-001

## Task Identity

- **Task ID**: `SOL-GMGN-WALLET-PROFILE-PILOT-001`
- **Role**: implementer
- **Chain**: solana
- **Layer**: cold_path
- **Status**: SUCCESS

## External Inputs & Evidence

- **Input Directory**: `C:\Users\10639\chainfm_out\sol`
- **Expected & Verified SHA-256 Hashes**:
  - `sol_addresses.txt`: `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C` (1,433 records)
  - `sol_address_labels.json`: `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3` (1,433 records)
- **Input Manifest Hash Match**: `true`
- **Selection Rule**: First 20 unique valid Solana addresses in order from cleaned.jsonl after input hash verification.
- **Selected Address Count**: `20` (exact target: 20)

### Selected Address Fingerprints (Irreversible Hashes)

| # | Address Fingerprint (SHA-256) |
|---|---|
| 1 | `2ab741591574cf0b8980e9d519c6783dd0274b266835e62d03591ed39e354e18` |
| 2 | `2664f3facd88d26f0e2c0db7a5bcc2d7bda041309fe9e7b165f1b2c3753608e7` |
| 3 | `1d5468068783404bc1e26b7f2a99414f2d3aa049a9b055dfd643fd10addd5a16` |
| 4 | `91e9d7124f6c4b3ab638bc77a7b85a6d73f2ffcc34117188deea54574a2b497a` |
| 5 | `d6772f9652d7272574d086826e6c19cae78c70c6941c732d95196dd851a5d99b` |
| 6 | `6dfe07e486f7fe2618015d2291b9e6ec627f3a6f4b8d384dd88e4ab5ceb700da` |
| 7 | `a4edf621b04110aa1571c83c248a041f2172748650c0ebd1115a961294a38cba` |
| 8 | `908ed1087da98174d25bf800cbdf59c04df034ff744b26fd723d0a689138c601` |
| 9 | `2a49bd771c7288bd4ccc664350828f1235fa261c1c4445623acbf550f55c04f8` |
| 10 | `649741808461436e2ba816aecde1aa090b05c9792b26779f843a2523a9794330` |
| 11 | `3e025e83b1e3704340a184cd1600fc3b2a217d2e047f45efd38efe4e41d9f24a` |
| 12 | `bab53f5805c57571b6a5f743783a60d4600f898bfbbbfae293a54448bbc4d009` |
| 13 | `012525cc4c5e4ea5534f9633cd74a38540d29ff6dac4be4970622a7e1eac1c21` |
| 14 | `d269fd4d7e1abde1f2ce6f26d7263b0bded653ee055e20a43ce960a5ee956068` |
| 15 | `6f16447197c187dd73a8a6b0d833808db304b988a6fefd4deb705ad61365eaa5` |
| 16 | `a00ddd9082099d7bfc8bd4f120c03e09fcba0b99deb53f0d1bd37c4c3c242670` |
| 17 | `3b872a604183a0807f65220f1396ab4499bc484aa89a8723b21fcb3a11aa2676` |
| 18 | `b27e5784ac3684b28d83f3427883e7f8d8a51bd23f238b2a5fde165b75835b45` |
| 19 | `d274ed29c7611822e188784bfa77445fa6feb405a2a9841a8344077643c75b6d` |
| 20 | `a4742fc2399c7851ebf0819b1b4527b2b8270c10872dcd5e09bca61a71e73ec4` |

## Execution & Metric Normalization Results

- **Periods Checked**: `7d` and `30d` (2 periods per wallet)
- **Total Profile Records Produced**: `40`
- **Mapped Records**: `40`
- **Partial Records**: `0`
- **Unavailable Records**: `0`
- **Request Count**: `40` (Limit: <= 40; Satisfied: `true`)

### Allowlisted Safe Error / Warning Code Counts

| Code | Count |
|---|---:|
| none | 0 |

## Verification Commands Passed

- `npm run harness:doctor`: Passed
- `npm run typecheck`: Passed
- `npm test`: Passed
- `npm run build`: Passed
- `git diff --check`: Passed

## External Output Directory

- **Derived Profiles Directory**: `C:\Users\10639\chainfm_out\sol\derived\gmgn-wallet-profile-pilot-001`
- **Files**:
  - `normalized_wallet_profiles.json`
  - `summary.json`

## Boundaries & Constraints Compliance

1. **Solana-Only**: Verified. Zero BSC or Robinhood calls.
2. **Official CLI / OpenAPI Only**: Verified. Zero web scraping, zero Cloudflare bypass.
3. **Read-Only**: Verified. Zero trading, zero signing, zero order placement.
4. **Manual Single Execution**: Verified. Zero cron, zero background loops.
5. **No Helius Calls**: Verified. Zero Helius network invocations.
6. **No Production Database Writes**: Verified. Outputs restricted to local external directory.
7. **Zero Leakage**: Verified. No API keys, private keys, raw provider payloads, raw stdout/stderr, or plaintext addresses saved or committed to Git.
8. **No LLM Interpretations / Confirmations**: Verified. GMGN metrics strictly classified as `source: "gmgn"`, `verificationStatus: "unverified"`.
