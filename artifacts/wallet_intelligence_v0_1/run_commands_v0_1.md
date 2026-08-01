# Run commands

```bash
npx tsx src/cli/run-sol-wallet-candidate-screening-v0-1.ts
```

Environment overrides:
- `SOL_INPUT_DIR` (default: local cleaned sol directory)
- `SOL_GMGN_OUTPUT_DIR` (default: gmgn-wallet-stats-full-1433-live-rerun-002)
- `SOL_SCREENING_OUTPUT_DIR` (default: artifacts/wallet_intelligence_v0_1)

Acceptance tests:
```bash
npm run typecheck
npm test
npm run build
```
