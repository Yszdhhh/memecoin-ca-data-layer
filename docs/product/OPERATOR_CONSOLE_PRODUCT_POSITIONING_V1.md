# Operator Console — Product Positioning V1

**Status:** Product doctrine (binding for UX, copy, and IA decisions)  
**Audience:** Owner, product, implementers, auditors  
**Companion:** `OPERATOR_CONSOLE_INFORMATION_ARCHITECTURE_V2.md`  
**Grounding:** `PROJECT_ARCHITECTURE.md`, `PROJECT_CONSTITUTION.md`, `docs/contracts/CA_SCAN_RESPONSE_V1.md`, `docs/contracts/OPERATOR_CONSOLE_DATA_SOURCE_V1.md`, main shell `apps/operator-console`

---

## Positioning one-liner

**A research operator console that turns a CA (or wallet / task) into a trust-split, evidence-first, replayable research card—and sediments address intelligence you can reverse-search later—without replacing GMGN, Birdeye, or any trade terminal.**

Chinese form (for internal decks):

> 第三方提供事实数据与行情快照；本控制台提供**可拆分可信度、可回放证据、可沉淀地址记忆**的一级市场研究入口——不是交易终端，不是聪明钱发现 feed。

---

## What we do NOT copy

We deliberately **do not** rebuild the strengths of adjacent tools. Copying them dilutes the moat and wastes the trust budget.

### From GMGN

| Do not copy | Why |
| --- | --- |
| Smart Money / Sniper / Bundler / Rat-Trader **as conclusions** | External labels are **features**, never final verdicts (`PROJECT_ARCHITECTURE` §3). Re-displaying a GMGN tag as “our confirmed smart money” is drift. |
| Full portfolio PnL browser / wallet social feed | GMGN already optimizes discovery and narrative speed. |
| Chart-first trading chrome, buy/sell CTAs, Telegram-style hype cards | Conflicts with research-terminal restraint and anti-positioning. |
| Opaque “alpha score” UI that hides numerators / rules | We show gate fields and evidence, not a single neon risk number. |
| Web scraping / Cloudflare bypass for “free” data | Forbidden; official / authorized APIs only. |

### From Birdeye

| Do not copy | Why |
| --- | --- |
| Full multi-chain market data terminal | Market price/liquidity/FDV is **Tier-B enrichment**, not chain fact (Constitution #7). |
| Wallet API depth as truth for holdings | Borrowed snapshots stay `unverified` until Tier-A confirms. |
| Token screener / trending leaderboard as product core | Discovery is not the differentiator; **library + judgment** is. |

### From Bubblemaps

| Do not copy | Why |
| --- | --- |
| Pretty cluster graph as primary UX | Graphs are optional later; **tables + reversible exclusion evidence** come first. |
| Visual “connected wallets” without rule_version / residual accounting | Aesthetics must never outrank accounting eligibility and exclusion coverage. |

### From DexScreener

| Do not copy | Why |
| --- | --- |
| Pair chart + volume heat as the home surface | Charts are secondary context; concentration and address hits are primary. |
| Pair discovery / multi-DEX browser | Out of scope; we consume pair/price when needed as Tier-B. |

### From trade terminals (Photon, BullX, Trojan, etc.)

| Do not copy | Why |
| --- | --- |
| Swap, limit, sniper bots, signing, custody | Explicit non-goals (Constitution mission + Architecture §1). |
| Latency-optimized trade hotkeys | Our hot path is **research first-screen** (p95 target), not execution. |
| PnL sharing / leaderboards as gamification | Profit leaderboards, if used, are **mining inputs** for address sedimentation—not a social feed. |

### Global anti-copy

- No neon crypto aesthetic, no emoji status, no “SAFE / RUG” badge replacing multi-domain trust.
- No single composite risk score that collapses Accounting / Exclusion / Concentration / Market / Wallet into one color.
- No claiming “cleaned investor concentration” when `concentrationEligible === false` or exclusion coverage is incomplete.

---

## What we complement

The console sits **beside** existing tools in a dual-monitor (or dual-tab) workflow.

| User already has… | This console adds… |
| --- | --- |
| GMGN charts, tags, traders lists | **Re-verification**: owner aggregation, exclusion reasons, residual accounting, partial visibility |
| Birdeye / DexScreener price & liq | Explicit **Market Data domain** labeled Tier-B / unverified; never overrides mint supply or holders |
| Bubblemaps intuition | **Numerator / denominator / ratio / status** tables; reversible universes (`raw` ≠ `owner_aggregated` ≠ `cleaned`) |
| Trade terminal execution | **No execution**—only research cards, tasks, library, replay |
| Spreadsheets / memory | **Address memory**, cross-CA history, rule versions, as-of replay |

Guiding sentence (Owner / Architecture):

> **第三方提供事实数据，自建提供长期认知资产** — third parties supply factual data; we supply the long-term cognitive asset.

Complement model in practice:

```text
Hot path (seconds):  borrow Tier-B snapshot + library hits → first screen
Cold path (async):   Tier-A rebuild / cluster / dev / profit mining → refresh card
Judgment layer:      versioned pure rules → confirmed labels only from Tier-A evidence
```

---

## Long-term moat

The moat is **not** “another holder table.” It is a stack of properties competitors optimize against (speed, charts, social) and we optimize for (trust, memory, replay).

### 1. Trust split (multi-domain, independent gates)

First screen never collapses trust into one light. Domains are **separately** badged:

| Domain | What it answers | Shell / contract grounding |
| --- | --- | --- |
| **Accounting** | Did holder enumeration reconcile to mint supply? pagination complete? residual? | `accountingEligible`, `accounting.completeness`, residual fields |
| **Exclusion Coverage** | Are pool / LP / bonding-curve / burn exclusions complete enough? | `exclusionCoverage`: `complete` \| `partial` \| `unavailable` |
| **Concentration** | May TopN ratios be treated as cleaned investor concentration? | `concentrationEligible` — **must not** be confirmed when exclusion incomplete |
| **Market Data** | Price / liq / FDV provenance | Tier-B + `unverified` typical; Constitution #7 |
| **Wallet Intelligence** | Library hits, labels, pools | Tier-B usable / shortlist ≠ smart money; confirmed only via Tier-A rules |

Shell labels (do not invent new semantics):

- `accountingLabel(eligible, completeness)` → `CONFIRMED` / `PARTIAL` / `UNVERIFIED`
- `exclusionLabel(coverage)` → `COMPLETE` / `PARTIAL` / `UNAVAILABLE`
- `concentrationLabel(eligible)` → `CONFIRMED` / `UNVERIFIED`

**Invariant:** Accounting confirmed **does not** imply concentration confirmed.

### 2. Replayable evidence

Every material judgment carries:

- `ruleVersion` (or equivalent watermark)
- numerators / denominators as **raw integer strings** (Constitution #1)
- `universeDefinition`
- `source` + `sourceTier` (`A` \| `B`)
- `verificationStatus` (`unverified` \| `confirmed`)
- evidence refs / residual reasons / issues list

JudgmentEvidence invariant from `CA_SCAN_RESPONSE_V1`: **Tier-B + `confirmed` is invalid.**

### 3. Address memory

The differentiator is the **self-sedimented address-intelligence library**, not queryable market data:

- Multi-label per address (identity / capability / behavior / relationship)
- Label display priority: risk > behavior > capability > social
- Persist **wallet-level conclusions** with reversible evidence—not only raw swaps
- Self-computed (Tier-A) confidence outranks borrowed (Tier-B)

### 4. Cross-CA history

An address is valuable because it appears across mints:

- “Hit on this CA” vs “historical hits on related / prior CAs”
- Early buyer / sniper / cluster membership as **library-backed** overlays
- Cross-token matches on the card are placeholders until cold-path sedimentation lands (`NOT_WIRED` until G2+)

### 5. Rule versions

Exclusions, concentration, detectors, and labels are **versioned pure functions**. Changing a rule bumps `rule_version` so historical cards can be re-evaluated without silent rewrite of the past.

### 6. As-of replay

Operators can ask: *Given watermarks W and rules R at time T, what did we believe?*

- Fixture + pinned snapshots first
- Live as-of is a later milestone (`/replay`)
- Partial and failed runs remain visible (no rewrite history into success)

### 7. Partial / error visibility

Constitution #8: **Partial data produces warnings and completeness fields, never fake precision.**

Shell contract:

- `formatRatio(null | undefined | NaN)` → **`暂不可确认`** (never `0%`)
- `null ≠ 0`
- `PARTIAL ≠ SUCCESS` / `PARTIAL ≠ COMPLETE` / `PARTIAL ≠ CONFIRMED`
- Status and color: color is **never sole semantic**; text labels + fields must stand alone
- Issues table: code, severity, affected records/balance, manual review flag, evidence

### 8. Tier-B vs on-chain verification layering

| Tier | Role | May be `confirmed` alone? |
| --- | --- | --- |
| **Tier-B** (GMGN, Birdeye, DexScreener, Rugcheck, …) | Speed, enrichment, shortlist, hints | **No** |
| **Tier-A** (Helius / RPC watermarks, owner aggregation, funding edges, Pump creator) | On-chain fact foundation | Yes, via versioned rules |

Wallet pool language (binding for copy and UI):

| Allowed | Forbidden |
| --- | --- |
| Tier-B usable pool (~1370 in pilot) | Calling that pool “smart money” / “Alpha winners” |
| Tier-B shortlist | “Confirmed smart money” without Tier-A rule |
| Alpha = 0 (when clean-rank says so) | Inflating Alpha from Tier-B completeness |
| Manual review queue | Hiding incomplete periods |

Shell wallet disclaimer pattern: *Third-party Tier-B observation · Not confirmed on-chain smart money.*

---

## Why users keep GMGN open AND use this console

This is intentional dual-use, not competitive replacement.

| Keep GMGN open for… | Open this console for… |
| --- | --- |
| Charts, social flow, platform tags, trader lists | **Can I trust the concentration number?** |
| Fast narrative (“who is buying”) | **Is exclusion coverage complete? residual non-zero?** |
| Discovery and relative price action | **Which of *my* library addresses hit this mint?** |
| Execution context (elsewhere) | **Task budget / partial failure / request used** |
| Short-lived attention | **Will this wallet still mean something next CA?** |

Product promise in one workflow:

```text
1. See CA on GMGN / TG / Discord
2. Paste mint into Operator Console
3. Read Trust Strip (5 domains) before any ratio
4. Expand evidence if any gate is PARTIAL / UNVERIFIED
5. Optionally enqueue Tier-A task; watch tasks for partial/fail honestly
6. Sediment interesting wallets into address memory
7. Next CA: reverse-search library hits first
```

If the console ever becomes “GMGN but uglier,” positioning has failed.

---

## What must be re-verified in this system

Anything used for **primary-market decisions** that platforms present as fact must be re-verified or explicitly labeled borrowed.

### Always re-verify (Tier-A path / local rules)

1. **Holder universes** — token-account rows vs owner aggregation (Constitution #3).
2. **Exclusions** — pool / LP / bonding curve / burn: reason, confidence, evidence, rule version, reversible snapshot (Constitution #4).
3. **Accounting residual** — mint supply vs enumerated balances; pagination completeness.
4. **Concentration eligibility** — TopN ratios only when accounting + exclusion gates allow; else `ratio: null` → `暂不可确认`.
5. **Creator / Dev identity** — Pump `create.creator` outranks payer, signer, metadata, third-party labels (Constitution #5).
6. **Transfer ≠ sale** — no sales without swap/venue evidence (Constitution #2).
7. **Related-wallet vs direct Dev** — shown separately (Constitution #6).
8. **Confirmed labels** — cluster / independent smart money / sniper conclusions only from Tier-A + versioned pure functions.

### May borrow, must never silently promote

1. Price, liquidity, FDV, pair metadata (Market Data domain).
2. Platform wallet tags (GMGN Smart Money, sniper, bundler, etc.).
3. Third-party holder display snapshots used only as warm start.
4. Per-token profit leaderboards used as **mining candidates**, not truth.

### Operator must always see

- Source mode: `fixture` \| `http`, `live=true|false`
- `observedAt` / `sourceWatermark`
- Warnings, issues, request budget used
- Domain gates before any “clean concentration” language

---

## Anti-positioning

### Not a trade terminal

We **do not**:

- Swap, snipe, limit, DCA, copy-trade, or sign transactions
- Show primary **Buy / Sell / Trade** CTAs
- Optimize for execution latency or wallet connect UX
- Hold custody or API keys for trading

Any future “open in terminal” deep-link is **egress**, not product core, and must not dominate the first screen.

### Not a smart-money discovery feed

We **do not**:

- Rank the internet’s wallets as a social product
- Brand Tier-B usable pool or shortlist as “smart money”
- Infinite-scroll “alpha feed” or influencer-style cards
- Treat Telegram/social as truth (hint layer only; Architecture §8)

We **do**:

- Maintain **operator-owned** address memory
- Shortlist for **manual review**
- Show verification status per label
- Prefer reverse lookup on a CA over feed gambling

### Not a full-coverage data platform

We are not a data lake, multi-chain indexer product, or Birdeye replacement. Scope is **CA-driven primary-market research + address sedimentation + task orchestration + (later) liquidity board / replay**.

---

## Visual & interaction doctrine (product-facing)

| Do | Do not |
| --- | --- |
| High-density research terminal | Neon cyber / meme casino chrome |
| Bloomberg-like efficiency (tables, sticky keys) | Marketing landing density |
| Claude-like restraint (neutral light bg, quiet type) | Emoji status, confetti, gamification |
| Tables first, evidence first | Chart-first or score-first |
| Explicit PARTIAL / UNAVAILABLE / 暂不可确认 | Fake zeros, greenwashing incomplete data |
| Text labels + fields | Color as sole semantic |
| Five trust domains separate | One opaque risk score |

---

## Shell-bound facts (do not contradict in copy)

From main shell `apps/operator-console`:

| Fact | Implication for positioning |
| --- | --- |
| `accountingEligible`, `exclusionCoverage`, `concentrationEligible` on CA views | Trust is **split gates**, not `judgmentEligible` alone |
| `formatRatio` → `暂不可确认` for null/undefined/NaN | Incomplete concentration is never 0% |
| Wallet pool: Tier-B usable / shortlist / manual review | Not smart-money branding |
| Data source shell phase: **fixture**, `live=false` | UI must say fixture / scrubbed; no Live provider calls in shell |
| `OperatorConsoleDataSource` is the only page dependency | Fixture → HTTP swap without rewriting product meaning |

---

## Success criteria for this positioning

1. A new user who already uses GMGN can state, in one sentence, what only this console does.
2. Auditors can find Tier-A vs Tier-B and confirmed vs unverified without reading code.
3. No first-screen copy claims “cleaned investor concentration” when `concentrationEligible` is false.
4. Wallet surfaces never market Tier-B pools as confirmed smart money.
5. Partial and failed tasks remain visible and non-rewritten.
6. Product roadmap (library, tasks, replay, liquidity) extends the **cognitive asset**, not a trade terminal.

---

## Document control

| Field | Value |
| --- | --- |
| Version | V1 |
| Path | `docs/product/OPERATOR_CONSOLE_PRODUCT_POSITIONING_V1.md` |
| Supersedes | Informal shell banners / ad-hoc positioning notes |
| Must stay aligned with | Constitution, Architecture, CA Scan Response v1, Data Source v1, IA V2 |
