# Runbook: SOL-CA-HOLDER-STABILITY-BATCHES-001

## Purpose

Run 20–30 hand-curated public Solana CA holder tasks on the **real product path**:

```text
Operator Console (optional browser sample)
→ loopback Operator API
→ Helius
→ holder pagination
→ owner aggregation
→ trust split
→ task lifecycle
```

## Prerequisites

1. `HELIUS_API_KEY` in process env only (never commit / never browser).
2. Fresh `main` with Live Wiring merged (PR #8).
3. Branch: `feature/sol-ca-holder-stability-batches-001`.

## Start Operator API (loopback)

```bash
OPERATOR_API_LIVE=1 HELIUS_API_KEY=... npx tsx src/cli/run-operator-api.ts --port 8787 --request-budget 20
```

Health check:

```bash
curl -s http://127.0.0.1:8787/api/v1/health
```

## Run stability batches

```bash
export OPERATOR_API_BASE=http://127.0.0.1:8787
export STABILITY_SCRATCH=<local-scratch>
npx tsx scripts/stability/run-holder-stability-batches.ts \
  --manifest harness/reports/SOL-CA-HOLDER-STABILITY-BATCHES-001/public-ca-manifest.json \
  --report-dir harness/reports/SOL-CA-HOLDER-STABILITY-BATCHES-001
```

- Concurrency is hard-enforced sequential (1).
- Per-task HTTP budget ≤ 20; total ≤ 600.
- Manifest is manual only — **no market auto-discovery**.

## Pause triggers

Stop batches and open a finding when:

- same shape drift on ≥2 different CAs, or rate >10%
- positive balance loss / ratio inconsistency / wrong confirmed
- credential leak
- request over budget

Then: finding → ≤2 bounded repair rounds → targeted tests → re-run affected samples only.

## Offline gates

```bash
npm ci
npm ci --prefix apps/operator-console
npm run harness:doctor   # FAIL_PREEXISTING wallets.json only
npm run typecheck
npm test
npm run build
npm run console:check
npm run console:build
npm run security:scan
```

## Privacy

- Browser direct Helius = 0
- Credential exposure = 0
- No `chainfm_out` reads
- No raw provider payload commits
- Scrubbed reports only under `harness/reports/SOL-CA-HOLDER-STABILITY-BATCHES-001/`

## PR

- Draft at task start; Ready at completion
- **Do not merge** in implementation task
- Later merge: normal merge commit only
