# Acceptance Report: SOL-GMGN-WALLET-PROFILE-BATCH-100-LIVE-SMOKE-001

## Task Identity

- **Task ID**: `SOL-GMGN-WALLET-PROFILE-BATCH-100-LIVE-SMOKE-001`
- **Role**: implementer
- **Agent ID**: `implementer-sol-gmgn-wallet-profile-batch-100-live-smoke-001`
- **Chain**: solana
- **Layer**: cold_path
- **Status**: SUCCESS

## External Inputs & Selection Evidence

- **Input Directory**: `C:\Users\10639\chainfm_out\sol`
- **Expected & Verified SHA-256 Hashes**:
  - `sol_addresses.txt`: `64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C` (1,433 records)
  - `sol_address_labels.json`: `B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3` (1,433 records)
- **Input Manifest Hash Match**: `true`
- **Selection Rule**: Deterministic Base58 + 32-byte validated Solana addresses from cleaned.jsonl after SHA-256 verification: skip first 20 addresses (used in pilot), select next 100 addresses (21st to 120th in sequence).
- **Selected Address Count**: `100` (exact target: 100)

### Selected Address Fingerprints (Irreversible Hashes, 100 Wallets)

| # | Address Fingerprint (SHA-256) |
|---|---|
| 1 | `35968e7f81c45c8dc5bdc5455068e83b79d3bae91f5fa485e87818e0cdc98189` |
| 2 | `45233aeabd0e187e374641411b793c8a71fa07e275dc92c82e5b02b6ec9f96f8` |
| 3 | `fdd411c6f846f32083a9aad70403c06d28529f47063b13930acad9658f5eac22` |
| 4 | `f55a15b1db28ceabc87e8f3d94fd73e62632fb910ce1ee81d8b7af94bc449d8c` |
| 5 | `9634e65fecd05309ea0a610b57317312ee1fa1972679a6379cac8c2543cf3929` |
| 6 | `cf8377ed298ec9a49576a7d6add9405dc9d51e44c97f09b502ac16fd874ccf0e` |
| 7 | `4cf32e60c06ca103b6d26ecdb8f53a0d2df34cbdb961779c5aec01f67b0e8f55` |
| 8 | `4624647bbbb077edcb9ef52b165bf888f44ae4388baf74da05e9f639a921e726` |
| 9 | `909949d2c9c52004eb14006a576aa7e2d78e16d4cbe99e02e970ae83b056f66f` |
| 10 | `c296aac1357a8421a1c9622f09abaed90f7b4ac56ddb2a90b024fdb363092283` |
| 11 | `fca9936d73d1f87977585e0e0d5f277fd131a72289b16364b904212971c30472` |
| 12 | `4678342dcdae8e22abbee5c15f270e941065185d28d89dfa400d29d8191305fa` |
| 13 | `7c12f1c8ab4c32914aa91fd84e6c72e00b1ed26072fa1424d473e6c2758cd731` |
| 14 | `2f58d31c5403ad2a8bdcc929a4dfef7ed3f9a07bc523079383b6d00a469ca5ad` |
| 15 | `f28aec0d5ff9c3357ae7cb18957c4913eaffeb4979b651738fac43b08b86e003` |
| 16 | `8abb3cea06d1dab738305e47ec2a40be1d9eee0eaed4aebbbbeede4a711f59ab` |
| 17 | `38b44749d5a6019eae128845b6398df25698fd64e514f3df7db6a8cd8d3f9421` |
| 18 | `1a50f95e2e4133f75c0a070065c1d8119d9c59da3de9c49412ee411d43509e40` |
| 19 | `218219e45025fa78c44505f38ceb43b822d3574ec147b2c0ef6f537f5d3c45cc` |
| 20 | `2198c0361e51e0b8e575588331995ad9018c1c4ee294983bcdb6428871d5bbcc` |
| 21 | `80cde165e8d597cd149af74322c8654e78e4673081680571fb1eb003e89c7d61` |
| 22 | `0b0be36e69bd9631719f26d31ff3b594400169f806e3e07d8cdf14a83ea1c619` |
| 23 | `2380336d93fb41cab72f9ddf92f79ec9da9938d76370fae217895b54c6249e4e` |
| 24 | `b9bb621786ffd1889693b31bae837f90cf7da7b077c8a5cc0f90e735bd6b1b83` |
| 25 | `1e415fd3886eb256241d7fed066953c8473457125004ee50602c639a0da0e0c0` |
| 26 | `d0b9fe07d45bf85ad269f774fca0de22385cd0e487ef1d94c6a933c99d32e0a4` |
| 27 | `72003864311a91b181a85b3941826d8c8e81dba05cfaacfaacb904487d91bd92` |
| 28 | `4ec0c6d801b031024d02606a70c0faaeb63ef730986f25013302884a6f37c026` |
| 29 | `4eeef2b24d0bcec6f2e480645420cf6b520fbf67c5759f768b74bff36d9a5abe` |
| 30 | `4898a6a618f4a7654e0e97955cf7e7fc58952bf627103b1c879f8c27af136f3a` |
| 31 | `a094c43e90c50b3599d92dafbc1a7b2ea1c9a7fddf2a626c60a3b0678d109f82` |
| 32 | `8073e73998c55bb0f9b6870216c70918013f2e556e58fad2e37924dddcf48bb2` |
| 33 | `41fe4fdb697469f246680cb271edc09b387f5e65f711b71e2caf790beba8e9ba` |
| 34 | `b7e6c865d865c044033e4afd500ba9b1f84d5b9b811e1be7ca2103de31176900` |
| 35 | `889aa35044c2c8fd25ed8cb745761b23f694755e6b3b579dc433a8161363e6fe` |
| 36 | `582ce626c41566bd76cb909be807c846850986f64b8a0aa6358170e880eb0f32` |
| 37 | `ad2e23a7272dfe09a760364a79b97d98ff23c10389e13c52b6efb753bfdd63eb` |
| 38 | `ef51f0053c8facb3151680413f867b463ca0545d65206dfdbeda24b3d87cfa18` |
| 39 | `0d8a378bffb28efbe17bbc73a1a63ddc15bea88a93363894ca1c65d00ed33521` |
| 40 | `b45f9b74bf7138c4e45cf774717dcbcc5c942937febbccc8005925c8ae9acf58` |
| 41 | `3b618ad0435453118a2afea2d9debd1438ca3245f3549d20856685bc580a8637` |
| 42 | `0d2c506dcd59e5dcfaf5bfe34b80dbc2c9d78ae6385608a6ee291c6482ceb978` |
| 43 | `7477a41d0be2ca5b043fb116ae3cc4b578941e0b928c64f64771a9d323c9e834` |
| 44 | `63d76996e2e72753379171f4a2565d42410b9cdd095db0838e5f9e3b1a1b76ed` |
| 45 | `ec296f19200b3cb2f81c3902e3d07c613722aff73b21d769ab606ff1861f126e` |
| 46 | `aa22768b63574a3f22c1b60115ece61e2eb6714836fcbb0fa2eb7efafeb6d921` |
| 47 | `42c91a8bf5b17ddc70c8366d7e2ec3c62fd0c3f501adb8bb7e2f7dae0f08d0a0` |
| 48 | `e3dc9cf31169118d4d9de36bb55239e4ec3b8e146c8df7a7fc409df55f2b013a` |
| 49 | `f0ad229422da6329a5dbc6fa5677c161dcf484f10d795bb4967a787f35ba2c5a` |
| 50 | `a796e416952ad495ea14a24a385c932b5ccc006acb4c84082bbda3f4da00e071` |
| 51 | `fde1bdb0dd95b2cce456016682344c5510d4f034dc94c60136d6a1550d0c63bc` |
| 52 | `c691f0a0c717ae8b6d64b8f847da77ca98455b6589061d532e0c1c32a3c6f3b9` |
| 53 | `f9eb5305b6036be07c743a975c6db6b6deab06238c151abb2efd7fe26e5d7e31` |
| 54 | `32ff640f2830f4cc7a190d64863bd513dab46de9b6cbc34a39a2611d25cd22c2` |
| 55 | `bc5a93e58c9778227c1ac7df83eb2682ee247b017d9cf046ac1082823c280440` |
| 56 | `ffdff599bdc12a9adcfb8d5191ff5048b423efaad93ff4bfecf2a17497d32e9b` |
| 57 | `6754a202b6d09d70be5644c05565d9cffa2ddc1b2eb59f7c02c6feebd6efb103` |
| 58 | `f0729f369c099e71453d0dbd963c9115e3b153a4758263881355f27bc1a56cd8` |
| 59 | `3c2d03d1ec9b873a416c7c7fdd8cbc65613665ba531f43c4a9b33705fd9caa6b` |
| 60 | `032b2ff256e9cd94c5644cea6563c902895bd657e29e8b5ca1cbd95ac6c98ff6` |
| 61 | `f6fa3b5341c3839ee4ab3b92977372454231efbfd0df2acd1e2b3ba300442de2` |
| 62 | `e68a2448ecbbdb88e34f7f5119fd4212d3d7efc603b87b74def84c114c4b3326` |
| 63 | `07324f478eefc12f8f842d37c76a296574cf5dd4db77da7e625de4742f98b472` |
| 64 | `50336cf82bd0d4524e2da8b57fc7f6f8bb0112de5a1ff8208bafcc6a58f1bba2` |
| 65 | `1e2589f5e42865efb85761241b06a7006df9ad1b1bfbdf298d80dadad2a973ca` |
| 66 | `853d51ce977c81eb57e1ef4717dd1216c518f9e6a803ad9ad98ef7ac496204a2` |
| 67 | `0a780f0e87f3887cc702a0d628c81dd80f3088a521530dd96b4d805b8ab87570` |
| 68 | `a94363888b945eef686b997fd53ea252c95cd8d2a1d82c76cffe286b64e8da34` |
| 69 | `c6434a0b4a3c6286a16983d12cb1ba3ecb498fea5fd63ffaa1fb03111edd7bd6` |
| 70 | `b3e80b046307dc93bf132b3b9b9e0407aef61a64b16727de11d3d035b02dca62` |
| 71 | `a3993f6611ad61d222161402b8cc9ff0912bcbf5120330673b933acb76950f81` |
| 72 | `aaefb8773a3e39f77d100f1076ff522b04d0175e58b4ba86d8200e22ca7d52cf` |
| 73 | `88093c3d204d49f654e57a27fb08885e304717daafa207b9134101e4d314c89c` |
| 74 | `78d03da56033a1a04bcf45c70a9283b8714254802459567d493a3d72f8a9bc15` |
| 75 | `654db2bcb4c1f363630c175bb596a6410fded0818fc23e8ff86dfd8c075455b0` |
| 76 | `3754f2ee2a035a16dd30e10a27bf9c12345a046b0013afc7d04e634fe8bbc592` |
| 77 | `34753bcda53fdb310346ae1b4e0ea26c8f96a2691207affe0c93b20aac052d18` |
| 78 | `9dd02c50887f202048056cd6c8d5ac6fb1646fc5677541cca9c0010eaa741df4` |
| 79 | `0eeafb965a00dff09095e8326c68d2a5aad4560c95a3067c1a8b19b9290a0ed2` |
| 80 | `f9ee1405a467ee23fd57203c7a5acdca35e1d0c790a4fe20b0e2d126828d3f1e` |
| 81 | `1ee5509e36307043dffc903d0272c9cc11afc16f7f937c0b2152d778501d0518` |
| 82 | `55ed71de12bc85edbf89a1e1868816f4c2c9ed1c6e6a8b1e2701b9af1453e4df` |
| 83 | `0d109724a7d0336de63b144696e7071f96ae4b25fe1affd303b876b82ac56f30` |
| 84 | `ac65eed9230761c57731b5bba0bddb97c8e4235075b55eadeb9f7f9e3c2bf961` |
| 85 | `b09946b1ce7328d57844cf60a989948dbad1b0c31beb55ffab16df836e26cbe9` |
| 86 | `8270fc641a18591626da4828b3230762725a8823f58c62659cf69928011bf24d` |
| 87 | `a061640bc71af3073f05390a0cb66fac834e0598ff5b5f0ba9a5f1fa0efa00da` |
| 88 | `481e0764b8c95c6c9919889f1e3cb16a8aa11e897a48834d29a08b4ded65591f` |
| 89 | `ca74361469cdc3127083a1ac073259d196fcf0f46bb491edbd26718ce5c97dfe` |
| 90 | `b0fd6dd9ea9c1393a03820b5921a4dbd5f07ba74c2978fc7b9fdae16685c2cac` |
| 91 | `450eea01774c8a3daf2d4e68cfe35bc9f454d9ff3469659f1359fafdc51558c2` |
| 92 | `480a94ff94d1e96ca51f1b6c729889f85558f3176bdc0158055906aa2013d83a` |
| 93 | `dc87a4424b49a833d1f949313ec0080fbb1813566c4d70bf342acbaf6c07b462` |
| 94 | `e76e013a4c463229a7cde5656c8643a5106b6a299dc240a71b3f2851aefe965c` |
| 95 | `0bd44536076db61d135727a3e17f51b7c762f8e182c242e20a7b4eb868c6686b` |
| 96 | `acffb25fe95227e9415f638c00fea219e32914323970d23d6fa63c383d6462d4` |
| 97 | `ed4d5a145b3e2cd8547ff172449013db5de1a7687570a1030c53420d6c0806e7` |
| 98 | `6840407937ffcb2b114241eb61cc055a9c950cb9a19156da59c2727510d5f5e7` |
| 99 | `be3316b6881ce461ce6904a729e96fe779d1511ed02b452bf4d9aa8238d964c7` |
| 100 | `b0a427f87a5f5296a859dea2dc9e53c8ea97cd8d7e7744d5b4d9adbd28129396` |

## Execution & Metric Normalization Results

- **Periods Checked**: `7d` and `30d` (2 periods per wallet)
- **Total Profile Records Produced**: `200`
- **Mapped Records**: `200`
- **Partial Records**: `0`
- **Unavailable Records**: `0`
- **Average Field Completeness**: `0.95` (across all records)
- **Request Count**: `200` (Limit: <= 200; Satisfied: `true`)
- **Serial Rate Limit Delay**: `>= 1,000ms` enforced between adjacent requests

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

- **Derived Profiles Directory**: `C:\Users\10639\chainfm_out\sol\derived\gmgn-wallet-profile-batch-100-live-smoke-001`
- **Files**:
  - `normalized_wallet_profiles.json`
  - `summary.json`

## Boundaries & Constraints Compliance

1. **Solana-Only**: Verified. Zero BSC or Robinhood calls.
2. **Official CLI / OpenAPI Only**: Verified. Zero web scraping, zero Cloudflare bypass, zero GMGN Web pages.
3. **Read-Only**: Verified. Zero trading, zero signing, zero order placement.
4. **Manual Single Execution**: Verified. Zero cron, zero background loops, zero auto-discovery.
5. **No Helius Calls**: Verified. Zero Helius network invocations.
6. **No Production Database Writes**: Verified. Outputs restricted to local external directory.
7. **Zero Leakage**: Verified. No API keys, private keys, raw provider payloads, raw stdout/stderr, or plaintext addresses saved or committed to Git.
8. **No LLM Interpretations / Confirmations**: Verified. GMGN metrics strictly classified as `source: "gmgn"`, `verificationStatus: "unverified"`.
