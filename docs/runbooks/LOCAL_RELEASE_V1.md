# Local release v1.0 (LOCAL-RELEASE-V1-001)

## Prerequisites

- Node.js 20+
- Optional: PostgreSQL (file-backed address store works without it)
- Optional Live: `HELIUS_API_KEY` in process env only (never commit)

## Start (fixture console)

```bash
npm install
npm run console:dev
```

Open the printed local URL. Fixture mode needs no credentials.

## Start Operator API (loopback)

```bash
# fail-closed create (default)
npm run operator-api -- --port 8787

# live create (Owner-provisioned key only)
# OPERATOR_API_LIVE=1 HELIUS_API_KEY=... npm run operator-api -- --port 8787
```

## Console → API

```bash
# apps/operator-console
VITE_OPERATOR_API_BASE=http://127.0.0.1:8787 npm run dev
```

## Import Tier-B address pool (local only)

```bash
npx tsx src/cli/import-local-address-pool.ts --input <path-to-local-chainfm-json> --data-dir .local-data/address-store
```

Git-safe outputs: counts + `irreversibleDigest` only.

## Gates

```bash
npm run typecheck
npm test
npm run console:check
node scripts/security-retention-scan.mjs
```

## Upgrade / rollback

- Upgrade: `git pull` + `npm install` + re-run gates
- Rollback: `git checkout <previous-tag>` and restore `.local-data/` from backup
- Do not force-push audited main history

## Boundaries

- Research aid only — no trading, signing, or custody
- No full-market auto-scan; schedules default off
- Tier-B never brands as Alpha / confirmed smart money
