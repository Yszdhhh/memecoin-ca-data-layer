# Test evidence — HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001

- Original RED manifest `f463bedd31caa991e890808798f5a1bade8413fe9e3265f6aa923cc782fe509f` / comment `5159384652`; P1 fixed: `P1-FORBIDDEN-PATH-CASE-FAIL-CLOSED`.
- Base `fce42eeb560c85e4924399bdf08419f9ea7ba642`; starting HEAD `c7adf7376118e1c04fe139639a402940cc6b6559`; audited anchor `d5230971b98539989e0c8cad427b92ddddbc6661`; repair anchor `d167e2d72b964ef9513e2bb8614250d781db7352`; evidence parent `d167e2d72b964ef9513e2bb8614250d781db7352`.
- Required validate, doctor, typecheck, test, build, security scan, and diff check all exited 0. Doctor: GREEN, zero errors/warnings. Tests: 463 discovered / 462 passed / 1 skipped / 0 failed. Security: PASS, `classifiedLeaks=0`, `matchedLines=318`.
- Independent path-boundary test ran twice with identical output. PASS categories: canonical allowlist (3), separator variants (3), filename cases (7), directory cases (7), dot-relative (2), traversal (2), private/raw (6), chainfm_out (2), unrelated wallet-like (6).
- No real wallet address, transaction hash, GMGN raw detail, provider output, private path, credential, key, or chainfm_out content written.
- P0: none. P1: none after repair. P2: independent re-audit required before merge.
