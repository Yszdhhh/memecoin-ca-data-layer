# Operator Console v2 鈥?Offline Design Prototype

**Task:** `OPERATOR-CONSOLE-PRODUCT-RESEARCH-AND-UX-SPEC-001`  
**Status:** DESIGN PROTOTYPE / SYNTHETIC + SCRUBBED PUBLIC FIXTURE only  
**Live Provider calls:** 0  

## Open locally

Double-click or open in browser:

```text
docs/prototypes/operator-console-v2/index.html
```

Uses plain `<script>` tags (not ES modules), so `file://` works without a server.

Optional static server:

```bash
npx --yes serve docs/prototypes/operator-console-v2
```

## Pages

- CA list / CA detail
- Task list / Task detail
- Wallet list / Wallet detail
- Address Library
- Placeholders: Watchlist, Schedules, Replay, Liquidity, Settings (`NOT_WIRED`)

## State switcher

Header control simulates:

`success` 路 `partial` 路 `credential blocked` 路 `budget exhausted` 路 `stale` 路 `schema error` 路 `empty`

## Trust rules demonstrated

- Five trust domains split: Accounting / Exclusion Coverage / Concentration / Market Data / Wallet Intelligence
- `ratio=null` 鈫?**涓嶅彲纭** (not `0%`)
- Tier-B labeled **unverified / external observation**
- No Swap / Buy / Sell / Copy Trade CTAs
- Watermark always visible

## Tests

```bash
node docs/prototypes/operator-console-v2/lib/render-helpers.test.cjs
```

