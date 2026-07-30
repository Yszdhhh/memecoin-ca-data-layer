# Dispatch: SOL-GMGN-WALLET-PROFILE-FULL-1433-LIVE-001

- **Role**: implementer
- **Agent ID**: `implementer-sol-gmgn-wallet-profile-full-1433-live-001`
- **Task ID**: `SOL-GMGN-WALLET-PROFILE-FULL-1433-LIVE-001`
- **Tier**: T2
- **Objective**: Execute read-only, strictly bounded GMGN official-API 1433-wallet statistical profile full run for 7d and 30d periods.
- **Input Directory**: `C:\Users\10639\chainfm_out\sol`
- **Output Directory**: `C:\Users\10639\chainfm_out\sol\derived\gmgn-wallet-profile-full-1433-live-001`
- **Address Count**: Exactly 1,433
- **Periods**: 7d, 30d
- **Max Request Budget**: 2,866
- **Request Interval**: Serial, >= 1,000ms
- **Credential**: Check `GMGN_API_KEY` presence only; never display or pass `GMGN_PRIVATE_KEY`.
- **Classification**: `source: "gmgn"`, `verificationStatus: "unverified"`
- **Git Evidence**: Input manifest and acceptance report must contain only single `selected_fingerprint_sequence_sha256`; no per-address fingerprint table.
- **Downstream Audit Task**: `SOL-GMGN-WALLET-PROFILE-FULL-1433-LIVE-AUDIT-001`
