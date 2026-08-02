# Test evidence — HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001

- `npm run harness:task -- validate ...`: GREEN, `errors=[]`.
- `npm run harness:doctor`: GREEN, zero errors and zero warnings.
- `npm run typecheck`: exit 0.
- `npm test`: 463 discovered / 462 passed / 1 skipped / 0 failed.
- `npm run build`: exit 0.
- `npm run security:scan`: PASS, `classifiedLeaks=0`, `matchedLines=317`.
- `git diff --check`: exit 0.
- Rule replay: two runs produced identical result hash `d7609181461cd397d54a262ba5afc1515bf5e96bbe6c55201ddb280f628b4d80`.
- Negative cases: 2 synthetic raw/private wallet-like paths rejected.
- Positive cases: 3 exact documented scrubbed public artifacts accepted.
- Governed project config fields changed: 0.

- Final HEAD / current_commit provenance anchor: `d5230971b98539989e0c8cad427b92ddddbc6661`.
