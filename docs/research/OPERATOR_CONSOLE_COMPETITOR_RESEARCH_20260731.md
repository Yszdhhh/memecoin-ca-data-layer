# Operator Console Competitor Research

**Document ID:** `OPERATOR_CONSOLE_COMPETITOR_RESEARCH_20260731`  
**Access date baseline:** 2026-07-31  
**Research branch:** memecoin-ca-data-layer Operator Console  
**Live provider calls for this task:** 0 (public web knowledge only)  
**Scope:** UX patterns, field surfaces, trust labeling, and adopt/reject decisions for Operator Console research UX  

---

## 0. Trust model (repo binding)

This research evaluates competitors against the project trust model. Conclusions about **what our product may claim** are stricter than **what competitors display**.

| Tier | Sources | Role in Operator Console | Allowed product language |
|------|---------|--------------------------|--------------------------|
| **Tier-A** | Helius / Solana RPC, after local integrity, pagination, and conservation checks | Confirmed on-chain facts (balances, transfers, authorities, holder snapshots computed by us) | “On-chain confirmed”, “computed from RPC after checks” |
| **Tier-B** | GMGN, Birdeye, DexScreener, Rugcheck, Bubblemaps (and similar) labels / market / risk / clusters | External observation only | “External label”, “market observation”, “third-party risk signal” — **never** “confirmed smart money”, “confirmed insider”, “verified entity” |

**Claim taxonomy used below**

| Label | Meaning |
|-------|---------|
| **page claim** | What a public UI page states or strongly implies |
| **official API doc** | What vendor documentation documents as an API field/endpoint |
| **project-usable** | Whether we can technically use the signal in product pipelines (legal/API/availability aside) |
| **trust-allowed** | Whether our trust model allows presenting the signal as Tier-A fact vs Tier-B observation |
| **UNVERIFIED_CLAIM** | Marketing or community claim not independently verified in this pass |

**Adopt conclusion vocabulary (mandatory, exactly one per surface/product block)**

| Code | Meaning |
|------|---------|
| `ADOPT_UI_PATTERN_NOW` | Borrow pattern into Operator Console research UX immediately |
| `DESIGN_FOR_LATER` | Valuable, but needs deeper design / API / cost work |
| `BENCHMARK_ONLY` | Useful for comparison; do not ship as product behavior |
| `REJECT` | Do not copy; conflicts with trust model or product goals |
| `ACCESS_BLOCKED` | Login, paywall, partner-only, or not authoritatively findable |

---

## 1. Research method & limits

### 1.1 Method

- Public product pages, official docs, wiki pages, marketing sites, and secondary technical write-ups.
- No authenticated sessions, no paid plans, no live RPC/provider calls.
- Surfaces evaluated for: user task, fields, data source honesty, freshness, pagination, labels, confidence, errors, login/pay, API, borrowable patterns, misleading risks.

### 1.2 Limits

- UI field lists are **best-effort from public descriptions** as of 2026-07-31; product UIs change frequently.
- “API available” = public documentation or widely documented public endpoints exist; **not** a statement that we hold keys or that ToS allows our use.
- Proprietary label quality (smart money, insider, KOL) is **not** treated as ground truth.
- Hotsniper-class products without authoritative public product identity are marked accordingly.

---

## 2. Product A — GMGN

**Product:** GMGN.ai (multi-chain memecoin discovery / analytics / trading terminal)  
**Public URLs:** https://gmgn.ai/ · ranking/surfaces under same host · mobile apps on App Store / Google Play  
**Access date:** 2026-07-31  

**Product-level summary**  
GMGN positions as a meme trading + research hybrid: new-token monitoring, security-style holder metrics, smart-money/KOL wallet tracking, wallet PnL, alerts, and trade execution / copy-trade coupling. Marketing emphasizes “insider/rat wallets”, “smart money”, and “zero-delay” tracking — treat as **page claim / UNVERIFIED_CLAIM** for accuracy and latency unless independently measured.

### 2.A.1 Token page

| Field | Assessment |
|-------|------------|
| **Product** | GMGN |
| **Page / feature** | Token detail (dashboard, chart, holders, activity/traders, security-style metrics) |
| **Public URL** | https://gmgn.ai/ (token routes under product; exact path patterns not required for UX research) |
| **Access date** | 2026-07-31 |
| **Core user tasks** | Paste/search CA; decide if token is “safe enough / interesting”; see holder concentration; watch recent traders; jump to trade |
| **Key fields (page claim)** | Price / mcap / liquidity (market); insider/rat wallet ratio; bundle buy ratio; DEV holdings %; Top-10 concentration; holder list with visual flags; recent buys/sells; trader profit stats; chart multi-timeframe |
| **Data source declaration** | Page does **not** reliably separate on-chain raw facts vs proprietary heuristics vs market indexers in plain language (typical for the category) |
| **Freshness** | Marketed as real-time / live (**UNVERIFIED_CLAIM** for lag bounds) |
| **Pagination / window** | Top holders / top traders commonly capped (community scrapers cite top ~100 style windows — **not official API doc** for this pass) |
| **Label source** | Proprietary classification for insider/rat/smart-money style tags (**page claim**) |
| **Confidence expression** | Rarely probabilistic; flags presented as categorical (red markings, ratios) without method cards |
| **Error / missing states** | New tokens / low-liquidity tokens often sparse; failure modes not prominently documented publicly |
| **Login required?** | Core browse often available; full tracker/alert/trade features more complete when logged in / app |
| **Paid?** | Freemium + trade fee / bot model (**page claim** economics; not audited here) |
| **API available?** | No first-class public official developer API comparable to Birdeye/DexScreener found; third-party scrapers exist → **not project-usable as Tier-A API** |
| **Borrowable patterns** | Dense token header; holder structure “four metrics” cluster; activity+traders adjacency to chart |
| **Misleading risks** | Branding heuristic “insider/rat” as fact; copy-trade CTAs next to research; opaque ratios without conservation proof |
| **Adopt conclusion** | **BENCHMARK_ONLY** for overall product; **ADOPT_UI_PATTERN_NOW** only for *layout density of concentration metrics* (as Tier-B or Tier-A recomputed) |
| **Reason** | UX density is industry-standard; proprietary labels violate trust-allowed “confirmed insider” language. Recompute Top-10 / dev-holdings from Tier-A where possible; show GMGN-like tags only as external if ever integrated. |

**page claim vs official API doc vs project-usable vs trust-allowed**

| Signal | page claim | official API doc | project-usable | trust-allowed |
|--------|------------|------------------|----------------|---------------|
| Price/mcap/liquidity | yes | no public first-party API found | as Tier-B market only | observation |
| Insider/rat ratio | yes | no | heuristic only | **Tier-B label only; never confirmed** |
| Bundle buy ratio | yes | no | heuristic | Tier-B / recompute carefully if defined |
| DEV holdings % | yes | no | recompute via Tier-A if dev wallets identified | Tier-A only after our identification rules |
| Top-10 concentration | yes | no | yes via Tier-A holders | Tier-A if we compute |

### 2.A.2 Wallet page

| Field | Assessment |
|-------|------------|
| **Page / feature** | Wallet analytics / PnL page |
| **Core user tasks** | Judge wallet quality; see realized/unrealized PnL; win rate; holdings; trade history; creator track record |
| **Key fields** | Realized/unrealized PnL; win rate; risk/reward; holdings valuation; full trade history; developer token creation records; ATH mcap per created token (**page claim**) |
| **Data source declaration** | Aggregated indexer + proprietary PnL engine; not transparent methodology public |
| **Freshness** | Marketed instant on address enter (**UNVERIFIED_CLAIM**) |
| **Pagination / window** | History windows unclear publicly; long histories likely truncated |
| **Label source** | Smart money / KOL tags proprietary |
| **Confidence expression** | PnL shown as hard numbers without uncertainty bands |
| **Error / missing states** | Incomplete history for high-volume wallets; closed-loop transfers can distort PnL |
| **Login required?** | Partial public view common; depth may require account |
| **Paid?** | Freemium dynamics |
| **API available?** | No official public API documented for first-party use |
| **Borrowable patterns** | Single-address → instant dossier; creator portfolio of launches; ATH-mcap-per-token as research cue |
| **Misleading risks** | PnL gaming (wash, transfers, stablecoin loops); “smart money” circular labeling |
| **Adopt conclusion** | **DESIGN_FOR_LATER** (wallet dossier UX); **REJECT** “smart money” as confirmed |
| **Reason** | Wallet dossier is core research UX, but PnL must be our methodology + confidence; never import GMGN labels as truth. |

### 2.A.3 Wallet tracker / radar

| Field | Assessment |
|-------|------------|
| **Page / feature** | KOL & wallet tracker; watchlist; real-time alerts (web/app/Telegram bot surfaces) |
| **Core user tasks** | Follow wallets; get buy/sell/add/exit alerts; react quickly |
| **Key fields** | Wallet list; nickname; event type (buy/sell/add/exit); mcap/liquidity at event; token CA; PnL change alerts (**page claim** / third-party write-ups) |
| **Data source declaration** | On-chain event stream via their infra; not user-verifiable lag |
| **Freshness** | “Zero-delay” / real-time push (**UNVERIFIED_CLAIM**) |
| **Pagination / window** | Free tiers often small wallet caps (e.g. bot write-ups cite low double-digit wallet limits — **secondary source**) |
| **Label source** | User-defined + platform KOL lists |
| **Confidence expression** | Binary alert events |
| **Error / missing states** | Missed events under load; false duplicates not publicly SLA’d |
| **Login required?** | Yes for meaningful tracker |
| **Paid?** | Often freemium / app / trade-coupled |
| **API available?** | No official public developer API found |
| **Borrowable patterns** | Event vocabulary: buy / sell / add / full exit; nicknames; CA one-click copy |
| **Misleading risks** | Alert = advice implication; radar UI that funnels into copy trade |
| **Adopt conclusion** | **DESIGN_FOR_LATER** for research watchlists; **REJECT** copy-trade-coupled radar |
| **Reason** | Operator Console is research/ops, not execution funnel. Alert semantics are useful; coupling to trade CTA is not. |

### 2.A.4 Holder / trader tags

| Field | Assessment |
|-------|------------|
| **Page / feature** | Holder list tags; trader tags (insider, rat, sniper, smart money, KOL, etc.) |
| **Core user tasks** | Spot coordinated / privileged / skilled flow |
| **Key fields** | Tag chips on wallets; color coding; concentration of tagged classes |
| **Data source declaration** | Proprietary |
| **Label source** | GMGN heuristics / community lists (**page claim**) |
| **Confidence expression** | Categorical tags without score + method |
| **Misleading risks** | **Critical:** users treat tags as identity truth |
| **Adopt conclusion** | **REJECT** as Tier-A; **BENCHMARK_ONLY** for visual tag density |
| **Reason** | Trust model: third-party tags = external observation only, never confirmed smart money/insider. |

### 2.A.5 PnL surfaces

| Field | Assessment |
|-------|------------|
| **Page / feature** | Token trader PnL / wallet PnL |
| **Key fields** | Profit stats per trader; realized/unrealized; win rate |
| **Misleading risks** | Incomplete cost basis; multi-wallet fragmentation; inverted wash trades |
| **Adopt conclusion** | **DESIGN_FOR_LATER** with explicit methodology card + confidence |
| **Reason** | High value if *we* define cost basis rules and show missing-data states. |

### 2.A.6 Security surface

| Field | Assessment |
|-------|------------|
| **Page / feature** | Security auditing / holder-structure risk framing on token page |
| **Key fields** | Holder structure metrics used as “security”; may surface mint/freeze-like concerns depending on chain UI (**page claim**) |
| **Adopt conclusion** | **BENCHMARK_ONLY** |
| **Reason** | Prefer Solscan/Rugcheck/RPC authority facts for security; do not treat GMGN security as Tier-A. |

### 2.A.7 Watchlist / alert

| Field | Assessment |
|-------|------------|
| **Page / feature** | Custom watchlist + push notifications |
| **Borrowable patterns** | Named lists; multi-channel alerts; event types |
| **Adopt conclusion** | **DESIGN_FOR_LATER** |
| **Reason** | Useful for ops; not day-1 if CA paste research path is priority. |

### 2.A.8 Trade coupling

| Field | Assessment |
|-------|------------|
| **Page / feature** | Inline buy/sell, copy trade, bot execution |
| **Misleading risks** | Research → impulsive execution; fee opacity; “smart money copy” fallacy |
| **Adopt conclusion** | **REJECT** |
| **Reason** | Operator Console research product should not center trade CTAs or copy-trade. External “open in terminal” deep-links optional later, never primary. |

### 2.A Product-level adopt rollup — GMGN

| Area | Conclusion |
|------|------------|
| Concentration metric cluster UX | **ADOPT_UI_PATTERN_NOW** (recompute Tier-A / label Tier-B) |
| Wallet dossier shell | **DESIGN_FOR_LATER** |
| Tracker / alerts | **DESIGN_FOR_LATER** |
| Smart money / insider / rat as confirmed | **REJECT** |
| Trade / copy-trade coupling | **REJECT** |
| Overall as data dependency | **BENCHMARK_ONLY** (Tier-B observation at most) |

---

## 3. Product B — Birdeye

**Product:** Birdeye (token tracker + Birdeye Data APIs)  
**Public URLs:** https://birdeye.so/ · API docs https://docs.birdeye.so/ · Data services https://birdeye.so/data-api  
**Access date:** 2026-07-31  

### 3.B.1 Token overview (UI)

| Field | Assessment |
|-------|------------|
| **Product** | Birdeye |
| **Page / feature** | Token overview / tracker |
| **Public URL** | https://birdeye.so/ (chain-scoped token routes) |
| **Access date** | 2026-07-31 |
| **Core user tasks** | Multi-chain token research; price/volume/trades; security snapshot; jump to markets |
| **Key fields** | Symbol, name, price, liquidity, volume, trade counts, OHLCV, markets list, security summary fields (**page claim** + API-aligned) |
| **Data source declaration** | Indexer/market aggregation; more “data product” positioning than pure social terminal |
| **Freshness** | Real-time / near-real-time marketed |
| **Pagination / window** | Trades and holders paginated in product/API |
| **Label source** | Platform wallet/trader labels where present — treat as Tier-B |
| **Confidence expression** | Numbers as facts; limited uncertainty UI |
| **Error / missing states** | Unsupported chain / unknown token / thin markets |
| **Login required?** | Browse largely public; advanced may need account |
| **Paid?** | UI freemium; **API paid tiers** (official docs: packages / CU model) |
| **API available?** | **Yes — official API doc** |
| **Borrowable patterns** | Clean token overview composition; security endpoint separate from overview; multi-market list |
| **Misleading risks** | Users confuse Birdeye security with full audit; holder lists incomplete beyond cap |
| **Adopt conclusion** | **ADOPT_UI_PATTERN_NOW** for *overview information architecture*; data as **Tier-B** unless mirrored by Tier-A |
| **Reason** | Strong research IA; trust model still forbids treating Birdeye market/security as on-chain confirmation. |

### 3.B.2 Holders (UI) & distribution

| Field | Assessment |
|-------|------------|
| **Page / feature** | Holders / distribution views |
| **Core user tasks** | Concentration, whale presence, distribution shape |
| **Key fields** | Holder rank, address, amount, % supply, maybe USD value |
| **Pagination / window** | UI typically top-N; API documents large but finite caps |
| **Adopt conclusion** | **ADOPT_UI_PATTERN_NOW** for distribution visualization patterns; **prefer Tier-A recompute** for Operator Console truth |
| **Reason** | Distribution charts are essential; source of truth should be our holder pipeline. |

### 3.B.3 Wallet tags

| Field | Assessment |
|-------|------------|
| **Page / feature** | Wallet / trader tags on holders and top traders |
| **Label source** | Birdeye classification (**page claim**) |
| **trust-allowed** | External observation only |
| **Adopt conclusion** | **REJECT** as confirmed identity; **BENCHMARK_ONLY** for optional Tier-B display |
| **Reason** | Same smart-money/entity risk as GMGN/Nansen. |

### 3.B.4 Market surfaces

| Field | Assessment |
|-------|------------|
| **Page / feature** | Markets / pairs for a token |
| **Key fields** | DEX, pair, liquidity, volume, price |
| **official API doc** | Token all-market list, pair overview endpoints documented |
| **Adopt conclusion** | **ADOPT_UI_PATTERN_NOW** multi-pool awareness (align with DexScreener) |
| **Reason** | Memecoins fragment across pools; single-pool view misleads. |

### 3.B.5 API — Token Holder List (critical)

| Field | Assessment |
|-------|------------|
| **Page / feature** | `GET /defi/v3/token/holder` (Token — Holder list) |
| **Public URL** | https://docs.birdeye.so/ · endpoint `https://public-api.birdeye.so/defi/v3/token/holder` |
| **Access date** | 2026-07-31 |
| **Core user tasks (integrator)** | Programmatic top holders for distribution analytics |
| **Key fields (official API doc / product announcements)** | Holder list descending; richer ownership pattern view; top holders up to large N (product posts cite **top 10,000** on eligible packages — treat package limits as **official product claim**, verify under contract) |
| **Data source declaration** | Birdeye indexed holder state (not user RPC) |
| **Freshness** | Near-real-time indexer (**not** slot-exact guarantee in public marketing) |
| **Pagination / window** | Descending holder list; package-gated depth (**official API / package docs**) |
| **Label source** | N/A for raw balances; any tags separate |
| **Confidence expression** | API returns values without confidence interval |
| **Error / missing states** | 4xx on bad chain/address; empty for unknown; CU exhaustion |
| **Login required?** | API key required |
| **Paid?** | Yes — Starter+ style packaging historically for holder list (**official commercial model**) |
| **API available?** | **Yes — official API doc** |
| **Borrowable patterns** | Dedicated holder endpoint separate from overview; CU cost transparency |
| **Misleading risks** | Presenting Birdeye holders as “on-chain confirmed” without our conservation checks; silent truncation if UI doesn’t show “top N of M” |
| **project-usable** | Yes as **Tier-B observation / cross-check**, not Tier-A truth |
| **trust-allowed** | External observation; may **benchmark** against Tier-A Helius/RPC holders |
| **Adopt conclusion** | **DESIGN_FOR_LATER** as optional Tier-B cross-check; **ADOPT_UI_PATTERN_NOW** the *product pattern* “holders endpoint + explicit top-N window” |
| **Reason** | Pattern is correct; dependency must not replace local integrity/pagination/conservation pipeline. |

### 3.B.6 Related official API surfaces (for Operator Console awareness)

From public docs listing (not live-called):

| Endpoint theme | official API doc | trust-allowed use |
|----------------|------------------|-------------------|
| Token overview | yes | Tier-B market/meta |
| Token security | yes | Tier-B security signals; **do not** replace mint/freeze RPC |
| Top traders | yes | Tier-B |
| OHLCV / price / trades | yes | Tier-B market |
| Wallet portfolio / tx (beta) | yes (beta) | Tier-B; login/key |
| Gainers/losers | yes | Tier-B leaderboard, not “smart money confirmed” |

### 3.B Product-level adopt rollup — Birdeye

| Area | Conclusion |
|------|------------|
| Token overview IA | **ADOPT_UI_PATTERN_NOW** |
| Multi-market list | **ADOPT_UI_PATTERN_NOW** |
| Holders top-N + window honesty | **ADOPT_UI_PATTERN_NOW** (implement on Tier-A) |
| Holder API as system of record | **REJECT** (Tier-B only) |
| Wallet tags as truth | **REJECT** |
| Full Birdeye dependency | **BENCHMARK_ONLY** / selective Tier-B |

---

## 4. Product C — DEX Screener

**Product:** DEX Screener  
**Public URLs:** https://dexscreener.com/ · API https://docs.dexscreener.com/api/reference  
**Access date:** 2026-07-31  

### 4.C.1 Pair pages

| Field | Assessment |
|-------|------------|
| **Product** | DEX Screener |
| **Page / feature** | Pair page (chart + stats + txns) |
| **Public URL** | https://dexscreener.com/ (chain/pair routes) |
| **Access date** | 2026-07-31 |
| **Core user tasks** | Price discovery; liquidity/volume sanity; multi-timeframe momentum; social links; which pool is “main” |
| **Key fields** | `priceUsd`, `priceNative`, `txns` (buys/sells by m5/h1/h6/h24), `volume` windows, `priceChange` windows, `liquidity` (usd/base/quote), `fdv`, `marketCap`, `pairCreatedAt`, token metadata, socials/websites, `boosts.active`, pair labels |
| **Data source declaration** | DEX pair indexing across many chains; market observation |
| **Freshness** | Near-real-time pair stats |
| **Pagination / window** | Time windows m5/h1/h6/h24 first-class; search results limited (community reports ~30 for some search — secondary) |
| **Label source** | Pair labels array; boosts are **paid promotion**, not quality |
| **Confidence expression** | Point estimates; no confidence intervals |
| **Error / missing states** | Missing liquidity/priceUsd nullables in API schema; unknown pairs empty |
| **Login required?** | No for core pair research |
| **Paid?** | Free research UI; projects pay for boosts/ads/profiles |
| **API available?** | **Yes — official API doc**, largely free with rate limits |
| **Borrowable patterns** | Time-bucketed txns/volume/priceChange; multi-pool via token-pairs; nullable-aware fields |
| **Misleading risks** | **Boosts/ads mistaken for organic traction**; single pair ≠ token; wash volume |
| **Adopt conclusion** | **ADOPT_UI_PATTERN_NOW** for multi-window market stats IA + multi-pool listing; **REJECT** boosts as quality signal |
| **Reason** | Best-in-class pair market UX; boosts are advertising. |

### 4.C.2 Price / liquidity / volume

| Field | Assessment |
|-------|------------|
| **official API doc** | Pair objects document price, liquidity, volume, txns, priceChange |
| **trust-allowed** | Tier-B market observation only |
| **Adopt conclusion** | **ADOPT_UI_PATTERN_NOW** display pattern; Tier-B badge in our UI |
| **Reason** | Operators need market context; must not be sold as Tier-A. |

### 4.C.3 Boosts / ads

| Field | Assessment |
|-------|------------|
| **Page / feature** | Token boosts, ads, paid profiles |
| **Public URL** | UI on dexscreener.com; API: `/token-boosts/latest/v1`, `/token-boosts/top/v1`, `/ads/latest/v1` (**official API doc**) |
| **Core user tasks (for token teams)** | Paid visibility |
| **Core user tasks (for researchers)** | Should filter/discount paid amplification |
| **Key fields** | `boosts.active`; ad date/type/duration/impressions |
| **Label source** | Payment, not fundamentals |
| **Misleading risks** | Highest — boosts correlate with marketing spend |
| **Adopt conclusion** | **REJECT** as trust/quality signal; **ADOPT_UI_PATTERN_NOW** only as optional “paid promotion detected” warning if we ever show Dex data |
| **Reason** | Advertising ≠ organic demand. |

### 4.C.4 Multi-pool

| Field | Assessment |
|-------|------------|
| **Page / feature** | Token → multiple pairs; search; `token-pairs` API |
| **official API doc** | `GET /token-pairs/v1/{chainId}/{tokenAddress}`; `GET /tokens/v1/{chainId}/{tokenAddresses}`; search `/latest/dex/search` |
| **Borrowable patterns** | Rank pools by liquidity; show fragmented liquidity; warn if user is on thin pool |
| **Adopt conclusion** | **ADOPT_UI_PATTERN_NOW** |
| **Reason** | Memecoin CA research without multi-pool is incomplete. |

### 4.C.5 API summary (official)

| Endpoint (examples) | Rate limit (docs) | Notes |
|---------------------|-------------------|-------|
| token-profiles latest/recent | 60 rpm | Marketing profiles |
| community-takeovers | 60 rpm | Social claim surface |
| ads latest | 60 rpm | Paid ads |
| token-boosts latest/top | 60 rpm | Paid boosts |
| pairs by chain/pairId | 300 rpm | Core pair stats |
| search | 300 rpm | Discovery |
| token-pairs by token | 300 rpm | Multi-pool |
| tokens by addresses | 300 rpm | Batch pairs |
| metas trending | 60 rpm | Narrative clusters |

**project-usable:** yes for Tier-B market enrichment.  
**trust-allowed:** market observation only.

### 4.C Product-level adopt rollup — DEX Screener

| Area | Conclusion |
|------|------------|
| Pair stats time windows | **ADOPT_UI_PATTERN_NOW** |
| Multi-pool | **ADOPT_UI_PATTERN_NOW** |
| Free public API for market Tier-B | **DESIGN_FOR_LATER** integration |
| Boosts as quality | **REJECT** |
| Ads-driven ranking UX | **REJECT** |

---

## 5. Product D — Bubblemaps

**Product:** Bubblemaps V2  
**Public URLs:** https://bubblemaps.io/ · V2 https://bubblemaps.io/v2 · wiki https://wiki.bubblemaps.io/ · B2B docs https://docs.bubblemaps.io/  
**Access date:** 2026-07-31  

### 5.D.1 Clusters / top holders map

| Field | Assessment |
|-------|------------|
| **Product** | Bubblemaps |
| **Page / feature** | Bubble map of top holders + transfer links + clusters |
| **Public URL** | https://bubblemaps.io/ · map app surfaces (v2 maps) |
| **Access date** | 2026-07-31 |
| **Core user tasks** | See concentration visually; detect coordinated wallets; investigate linked holders |
| **Key fields** | Bubbles = wallets (size ~ holdings); edges = transfers; cluster coloring; supply % in cluster |
| **Data source declaration** | Transfer graph among (primarily) top holders; indexed chain data |
| **Freshness** | Real-time distribution marketed |
| **Pagination / window** | Default map focuses on **top holders** (wiki: direct links between top holders) |
| **Label source** | Clustering algorithm; optional custom labels (partner) |
| **Confidence expression** | Visual certainty high; statistical confidence low/absent |
| **Error / missing states** | Missing map for unsupported tokens/chains; incomplete early history |
| **Login required?** | Core maps often public; pro/API gated |
| **Paid?** | Free consumer maps; B2B iframe/API paid/partner |
| **API available?** | **Yes — partner/pro**: Data API (holders, transfers, clusters) + iframe embed (**official docs**) |
| **Borrowable patterns** | Cluster-first visual; supply % in cluster; click-through from holder table to graph |
| **Misleading risks** | Cluster ≠ single entity; exchange deposit clustering false positives; visual “guilt by proximity” |
| **Adopt conclusion** | **ADOPT_UI_PATTERN_NOW** for *cluster visual as investigation affordance* with hard disclaimer; data **Tier-B** unless we build graph from Tier-A transfers |
| **Reason** | Best category UX for distribution investigation; must not claim “confirmed related entity.” |

### 5.D.2 Transfers

| Field | Assessment |
|-------|------------|
| **Page / feature** | Transfer edges on map; API transfers |
| **official API doc** | Data API exposes holders, transfers, clusters (**docs.bubblemaps.io**) |
| **trust-allowed** | Edges as observed transfers OK if from Tier-A; Bubblemaps edges = Tier-B unless recomputed |
| **Adopt conclusion** | **DESIGN_FOR_LATER** full graph; **ADOPT_UI_PATTERN_NOW** “show evidence transfer list when asserting link” |
| **Reason** | Evidence drill-down > opaque blobs. |

### 5.D.3 Magic Nodes

| Field | Assessment |
|-------|------------|
| **Page / feature** | Magic Nodes (wiki-documented) |
| **Public URL** | https://wiki.bubblemaps.io/bubblemaps-v2/magic-nodes |
| **Access date** | 2026-07-31 |
| **Core user tasks** | Reveal hidden clusters via non-holder intermediaries |
| **Key fields** | Extra nodes (often 0 balance) with dotted borders; gas-funder / deposit hub patterns |
| **Data source declaration** | **official wiki:** expands beyond top holders to intermediaries (shared gas funders, shared deposit addresses, emptied distributors) |
| **Freshness** | On-demand expansion |
| **Pagination / window** | Heuristic expansion, not full chain graph |
| **Label source** | Algorithmic “magic” inclusion — name itself is product marketing |
| **Confidence expression** | Visual only |
| **Misleading risks** | Shared CEX deposit or popular router mis-cluster; users over-trust “hidden links” |
| **Adopt conclusion** | **DESIGN_FOR_LATER** (powerful investigation mode); **REJECT** mystical branding without method panel |
| **Reason** | Intermediary-aware graph is high value; must ship with method + false-positive education. |

### 5.D.4 Historical map / time travel

| Field | Assessment |
|-------|------------|
| **Page / feature** | Time Travel — rewind holder/distribution history |
| **page claim** | Every holder and shift since launch (marketing absolute — treat **UNVERIFIED_CLAIM** for completeness) |
| **Core user tasks** | See if concentration was always present; post-launch distribution evolution |
| **Adopt conclusion** | **DESIGN_FOR_LATER** |
| **Reason** | Historical concentration is gold for research; expensive to do correctly on Solana without strong infra. |

### 5.D.5 API / partner embed

| Field | Assessment |
|-------|------------|
| **Page / feature** | iFrame embed + Data API |
| **Public URL** | https://docs.bubblemaps.io/introduction · iframe quickstart · data API auth |
| **Access date** | 2026-07-31 |
| **official API doc** | iFrame with `partnerId` (demo on localhost); Data API via `X-ApiKey` from pro platform |
| **Known embeds** | Docs claim battle-testing by CoinGecko, DexScreener, etc. (**page claim**) |
| **Login required?** | Partner onboarding for production domains |
| **Paid?** | Basic iframe for simple token sites may be free; production partner id / API commercial |
| **project-usable** | Yes via partnership |
| **trust-allowed** | Visualization Tier-B; do not rebrand clusters as confirmed insider rings |
| **Adopt conclusion** | **DESIGN_FOR_LATER** (embed or API); day-1 can link-out |
| **Reason** | Cost/partner gate; research UX can deep-link until we own graph. |

### 5.D Product-level adopt rollup — Bubblemaps

| Area | Conclusion |
|------|------------|
| Cluster visual + % supply | **ADOPT_UI_PATTERN_NOW** (with disclaimers; prefer own graph later) |
| Evidence transfers on click | **ADOPT_UI_PATTERN_NOW** |
| Magic Nodes style expansion | **DESIGN_FOR_LATER** |
| Time travel history | **DESIGN_FOR_LATER** |
| Treating clusters as confirmed entities | **REJECT** |
| Silent iframe without Tier badge | **REJECT** |

---

## 6. Product E — Rugcheck + Solscan

### 6.E.1 Rugcheck

**Product:** RugCheck (rugcheck.xyz)  
**Public URLs:** https://rugcheck.xyz/ · about https://rugcheck.xyz/about · API swagger https://api.rugcheck.xyz/swagger/index.html  
**Access date:** 2026-07-31  

#### Token risk report

| Field | Assessment |
|-------|------------|
| **Product** | Rugcheck |
| **Page / feature** | Token risk scanner / report |
| **Public URL** | https://rugcheck.xyz/ |
| **Access date** | 2026-07-31 |
| **Core user tasks** | Fast pre-trade safety scan; see risk factors; holder concentration warnings; authority-related risks; insider network beta signals (**page claim**) |
| **Key fields** | Aggregate score / risk items with levels (e.g. danger) and item scores; mint authority; freeze-related risks; LP/liquidity risks; top-10 ownership; single holder ownership; sniper/bundler style flags; insider graph (beta/API) — mixed **page claim** + community API wrappers |
| **Data source declaration** | On-chain derived checks + heuristics; score aggregation proprietary |
| **Freshness** | Instant scan marketed |
| **Pagination / window** | Top holders subset for concentration rules |
| **Label source** | Rule engine labels (“Mint Authority Enabled”, “Top 10 holders…”) |
| **Confidence expression** | Numeric score + categorical level; **not** calibrated probability of rug |
| **Error / missing states** | New tokens false positives (low holders/liquidity) called out by third-party reviews |
| **Login required?** | Core check public |
| **Paid?** | Free UI common; API key for programmatic (**secondary + swagger existence**) |
| **API available?** | **Yes** — public swagger; endpoints discussed publicly include token report, insiders graph, wallet risk (**official swagger surface**; exact auth/productization may change) |
| **Borrowable patterns** | **Itemized risks with names + descriptions + severity**, not only a single score; link each item to evidence |
| **Misleading risks** | **Opaque composite score as safety warranty**; good score ≠ non-scam; bad score ≠ scam |
| **Adopt conclusion** | **ADOPT_UI_PATTERN_NOW** itemized risk checklist UX; **REJECT** single opaque score as primary; scores only as Tier-B if shown |
| **Reason** | Checklist matches operator mental model; composite scores invite false confidence. |

**page claim vs API vs trust**

| Signal | trust-allowed |
|--------|---------------|
| Mint/freeze authority | Prefer **Tier-A RPC** confirmation; Rugcheck as cross-check Tier-B |
| Top-10 ownership thresholds | Recompute Tier-A; show threshold policy in UI |
| Insider network graph | **Tier-B only**, never confirmed insider |
| Aggregate rug score | Tier-B observation; never “safe” certification |

#### Rugcheck adopt rollup

| Area | Conclusion |
|------|------------|
| Itemized risks + evidence | **ADOPT_UI_PATTERN_NOW** |
| Insider graph as investigation aid | **DESIGN_FOR_LATER** / Tier-B |
| Primary trust on composite score | **REJECT** |
| Replacing RPC authority checks | **REJECT** |

### 6.E.2 Solscan

**Product:** Solscan explorer  
**Public URLs:** https://solscan.io/  
**Access date:** 2026-07-31  

#### Authority / holders / evidence drill-down

| Field | Assessment |
|-------|------------|
| **Product** | Solscan |
| **Page / feature** | Token page: overview, holders, transfers, authority section |
| **Public URL** | https://solscan.io/token/{mint} (pattern) |
| **Access date** | 2026-07-31 |
| **Core user tasks** | Verify mint; read authorities; inspect holders; drill to tx/account evidence |
| **Key fields** | Supply, decimals, holder count, top holders, mint authority, freeze authority (null = revoked/burnt authority pattern documented in Solscan education content), update/metadata authorities where shown, transfer list, account links |
| **Data source declaration** | Explorer over Solana ledger (indexer); closest public mental model to “on-chain” for users |
| **Freshness** | Near tip; explorer lag possible under load |
| **Pagination / window** | Holders/transfers paginated |
| **Label source** | Limited labels vs Arkham/Nansen; more raw |
| **Confidence expression** | Explorer facts as deterministic UI; still indexer-dependent |
| **Error / missing states** | Unknown token; indexing delay; Token-2022 edge cases |
| **Login required?** | No for core |
| **Paid?** | Free core; API products may be commercial (not required for UX research) |
| **API available?** | Solscan has API products historically; for Operator Console, **Helius/RPC is Tier-A**, Solscan is UI competitor + optional link-out |
| **Borrowable patterns** | **Authority section with null/revoked clarity**; every number clickable to account/tx; holders table → address page |
| **Misleading risks** | Users assume explorer = complete forensic graph; authority null not always “safe token” |
| **Adopt conclusion** | **ADOPT_UI_PATTERN_NOW** authority presentation + evidence drill-down pattern |
| **Reason** | Gold standard for trust-aligned research UX; mirrors what we should compute via Tier-A. |

### 6.E Combined (Rugcheck + Solscan) workflow note

Industry user flow often is: **Rugcheck score glance → Solscan authority/holders proof**.  
Operator Console should **invert** that: **Tier-A authority/holders first → itemized risks → optional Tier-B scores last**.

| Pattern | Conclusion |
|---------|------------|
| Evidence-first, score-second | **ADOPT_UI_PATTERN_NOW** |
| Score-first gatekeeping | **REJECT** |

---

## 7. Product F — Arkham / Nansen (public surfaces only)

### 7.F.1 Arkham Intelligence

**Product:** Arkham Intel  
**Public URLs:** https://intel.arkm.com/ · research https://info.arkm.com/research  
**Access date:** 2026-07-31  

| Field | Assessment |
|-------|------------|
| **Page / feature** | Entity pages, address explorer, tags/labels, custom entities, alerts |
| **Core user tasks** | Deanonymize / group addresses into entities; tag behaviors; track entity flows |
| **Key fields** | **Entities** (who), **labels** (address name), **tags** (behavioral history) — **official product education** |
| **Data source declaration** | AI + community intel marketplace + on-chain; proprietary Ultra labeling (**page claim** scale numbers = **UNVERIFIED_CLAIM** for exact counts) |
| **Freshness** | Platform-dependent |
| **Pagination / window** | Entity-centric, not full memecoin holder windows |
| **Label source** | Arkham proprietary + marketplace submissions |
| **Confidence expression** | Entity attribution often presented confidently; method not fully public |
| **Error / missing states** | Wrong attribution risk is systemic for deanonymization products |
| **Login required?** | **Yes for meaningful depth** → many surfaces **ACCESS_BLOCKED** without account |
| **Paid?** | Freemium / intel marketplace / API commercial dynamics (**page claim**) |
| **API available?** | Arkham API marketed for entity DB access — **ACCESS_BLOCKED** for this research pass (no live key); treat as partner/paid |
| **Borrowable patterns** | Taxonomy: entity vs label vs tag (excellent conceptual hygiene) |
| **Misleading risks** | False entity merges; “smart money trader” custom entities shared socially as truth |
| **Adopt conclusion** | **BENCHMARK_ONLY** for taxonomy; **ACCESS_BLOCKED** for deep public verification; **REJECT** branding Arkham entities as confirmed in our UI without Tier policy |
| **Reason** | Labels are the product — and exactly what our trust model forbids elevating to confirmed. |

**Solana memecoin CA ops note:** Arkham is stronger on entity intelligence broadly; not a drop-in holder-risk console for pump-style tokens.

### 7.F.2 Nansen

**Product:** Nansen  
**Public URLs:** https://nansen.ai/ · academy/support articles on labels  
**Access date:** 2026-07-31  

| Field | Assessment |
|-------|------------|
| **Page / feature** | Smart Money labels, token god mode style analytics, wallet labels, increasingly trade-coupled product |
| **Core user tasks** | Follow smart money flows; token screens; labeled wallet interpretation |
| **Key fields** | Smart Trader windows (30D/90D/180D/2Y), Smart Fund, whales, public figures, etc. (**official label explainers**) |
| **Data source declaration** | Proprietary labeling on large address sets (**page claim** “500M+ labels” = marketing scale, treat carefully) |
| **Freshness** | Real-time positioning |
| **Label source** | Nansen methodology; labels change over time (retired labels documented historically) |
| **Confidence expression** | Emoji/label as categorical authority |
| **Login required?** | **Yes** for full product; some Solana analytics marketed freer than multi-chain Pro — still account-gated → partial **ACCESS_BLOCKED** |
| **Paid?** | **Yes** for Pro-depth analytics (public mentions of high monthly Pro pricing — figures vary by source/time; treat specific $ as **UNVERIFIED_CLAIM** unless taken from live billing page) |
| **API available?** | Commercial; not free public research API in this pass → **ACCESS_BLOCKED** for integration verification |
| **Borrowable patterns** | Time-windowed performance labels (if we ever score wallets, show window explicitly) |
| **Misleading risks** | Smart money survivorship bias; copy trading cascades; trade fee product conflict with pure research |
| **Adopt conclusion** | **REJECT** “Smart Money” as confirmed; **BENCHMARK_ONLY** for windowed wallet performance *if we compute ourselves*; **ACCESS_BLOCKED** for full surface audit |
| **Reason** | Category king of labels — exactly what we must demote to Tier-B or avoid. |

### 7.F Product-level adopt rollup — Arkham / Nansen

| Area | Conclusion |
|------|------------|
| Entity / label / tag vocabulary clarity | **ADOPT_UI_PATTERN_NOW** (our own wording) |
| Display third-party smart money as fact | **REJECT** |
| Deep feature parity | **ACCESS_BLOCKED** / **BENCHMARK_ONLY** |
| Trade-coupled analytics | **REJECT** |

---

## 8. Product G — Hotsniper-class meme tools & trade terminals

### 8.G.1 Hotsniper (or equivalent named “hotsniper”)

| Field | Assessment |
|-------|------------|
| **Product** | “Hotsniper” as a distinct authoritative public product |
| **Public URL** | **Not established authoritatively in this pass** |
| **Access date** | 2026-07-31 |
| **Finding** | No durable, official product site + docs surface identified that cleanly matches a single canonical “Hotsniper” research console comparable to GMGN/Birdeye. Sniper-bot SEO space is crowded with low-authority clones. |
| **Adopt conclusion** | **SOURCE_NOT_AUTHORITATIVE** / **ACCESS_BLOCKED** |
| **Reason** | Cannot benchmark fields without authoritative primary source; do not invent feature matrices from SEO spam. |

### 8.G.2 Photon / BullX / Axiom (trade terminals)

**Public URLs (examples):**  
- Photon: https://photon-sol.tinyastro.io/  
- Axiom: https://axiom.trade/ (widely referenced)  
- BullX: multi-chain bot/terminal (NEO), widely referenced  

| Field | Assessment |
|-------|------------|
| **Page / feature** | Memecoin trading terminals: discovery lists, fast buy/sell, sniping, copy trade, wallet track, security chips as secondary |
| **Core user tasks** | Execute fast; snipe launches; copy wallets; manage TP/SL |
| **Key fields** | Speed, fees, multi-wallet, snipe modes, chart+buy UI, sometimes lightweight safety flags |
| **Data source declaration** | Mixed RPC + indexers + their order routing |
| **Login / wallet** | Wallet connect / embedded trading wallet common |
| **Paid?** | Trading fees primary monetization |
| **API available?** | Not the point — execution platforms |
| **Borrowable patterns** | Almost none for **research trust UX**; speed-oriented list density is trade UX |
| **Misleading risks** | Copy-trade CTAs; fee obfuscation; safety theater next to one-click buy |
| **Adopt conclusion** | **REJECT** for Operator Console research product (especially copy-trade CTAs and sniper-primary IA) |
| **Reason** | Product category conflict: they optimize execution latency and conversion; we optimize evidence, conservation, and honest labels. Optional outbound “trade elsewhere” is enough. |

| Terminal | Notes | Conclusion |
|----------|-------|------------|
| Photon | Lightweight SOL discovery + quick trade | **REJECT** copy for research console |
| BullX | Multi-chain bot + web | **REJECT** |
| Axiom | High-share SOL terminal, analytics + execution | **REJECT** as research template; **BENCHMARK_ONLY** for density of discovery tables if ever building a *separate* trade product |

---

## 9. Optional brief — Dune, SolanaFM, Jupiter

### 9.H.1 Dune

| Field | Assessment |
|-------|------------|
| **Product** | Dune Analytics |
| **URL** | https://dune.com/ |
| **Role** | SQL dashboards for ecosystem research (bot volume wars, protocol metrics) |
| **Core user tasks** | Ad-hoc research, shareable dashboards, not per-CA sub-second ops |
| **API** | Dune API exists (paid tiers) |
| **trust-allowed** | Query-defined; still not a substitute for per-token Tier-A holder integrity |
| **Adopt conclusion** | **BENCHMARK_ONLY** / **DESIGN_FOR_LATER** for offline research notebooks |
| **Reason** | Wrong latency/UX for CA paste operator path; excellent for methodology validation. |

### 9.H.2 SolanaFM

| Field | Assessment |
|-------|------------|
| **Product** | SolanaFM explorer |
| **URL** | https://solana.fm/ |
| **Notes** | Acquired by Jupiter (2024); public commentary mixed on maintenance vs forensic strengths (inner ix decoding, tx flow visuals) |
| **Borrowable patterns** | Transaction flow diagrams for complex multi-ix txs |
| **Adopt conclusion** | **DESIGN_FOR_LATER** for tx-flow visualization; **BENCHMARK_ONLY** as primary explorer vs Solscan |
| **Reason** | Tx-flow is valuable for evidence; product stability/strategy coupled to Jupiter. |

### 9.H.3 Jupiter (research workflow only)

| Field | Assessment |
|-------|------------|
| **Product** | Jupiter (aggregator + ecosystem tools) |
| **Role for us** | Route existence, price impact intuition, token lists — **not** holder truth |
| **Adopt conclusion** | **DESIGN_FOR_LATER** deep-links for “swap venue context”; **REJECT** as authority/holder source |
| **Reason** | Execution/aggregation layer; research console should not become a swap UI. |

---

## 10. Cross-product comparison matrix

| Capability | GMGN | Birdeye | DexScreener | Bubblemaps | Rugcheck | Solscan | Arkham | Nansen | Trade terminals |
|------------|------|---------|-------------|------------|----------|---------|--------|--------|-----------------|
| CA paste speed | high | high | high | med | high | high | med | med | high |
| Holders depth | med | high (API) | low | top-N graph | top-N rules | high paginated | low | med | low |
| Authority facts | weak | security API | weak | weak | rules | **strong UI** | n/a | n/a | weak chips |
| Market multi-pool | med | high | **strong** | n/a | n/a | weak | n/a | med | med |
| Cluster graph | weak | weak | weak/embed | **strong** | insider beta | weak | entity | weak | none |
| Label intensity | **high** | med | low | med | rule labels | low | **high** | **high** | med |
| Trade CTA pressure | **high** | med | low-med | low | low | none | med | high | **max** |
| Official public API | poor | **strong** | **strong free** | partner | swagger | explorer APIs | paid | paid | n/a |
| Trust fit for Tier-A | poor | poor | poor | poor | partial | good *as UI pattern* | poor | poor | poor |
| Best adopt mode | UX density only | IA + Tier-B | market IA | cluster UX | checklist | evidence UI | taxonomy | window labels DIY | reject |

---

## 11. Synthesis for Operator Console

### 11.1 Five patterns to **ADOPT_UI_PATTERN_NOW**

1. **Evidence-first token header (Solscan × Rugcheck inversion)**  
   On CA paste, immediately show Tier-A: mint validity, decimals/supply, **mint authority**, **freeze authority**, holder count progress, last integrity check status. Itemized risks secondary; no giant “safe/unsafe” stamp.

2. **Holder concentration metric cluster (GMGN-like layout, our math)**  
   Surface Top-10 %, largest holder %, creator/dev % (only if creator identification is explicit), LP vault %, known program accounts — each with **method + as-of slot/time** and **top-N window** (Birdeye/Dex honesty pattern).

3. **Multi-pool market strip (DexScreener / Birdeye)**  
   List pools with liquidity/volume/priceChange windows (m5/h1/h6/h24). Badge all market numbers **Tier-B**. Warn when active pool is not the deepest pool. Never show boosts as quality.

4. **Itemized risk checklist with drill-down (Rugcheck UX, Tier-A evidence)**  
   Each risk row: name, severity, short description, **Open evidence** (account/tx/holder rows). Composite third-party scores optional, collapsed, labeled external.

5. **Cluster / linked-holder investigation affordance (Bubblemaps pattern)**  
   From holders table: “investigate links” → graph or adjacency list with transfer evidence. Disclaimer: **cluster ≠ entity**. Magic-style intermediaries later; day-1 can be direct transfer links among top holders.

**Also adopt immediately as language rules (from Arkham taxonomy, not Arkham data):**  
- Use separate UI terms: **on-chain fact** / **external label** / **heuristic tag**.  
- Never render third-party “smart money” without `Tier-B` / `external observation` chrome.

### 11.2 Five patterns to **REJECT**

1. **Primary trade / copy-trade CTAs** (GMGN, Photon, BullX, Axiom, Nansen trade coupling) — research console is not a sniper terminal.  
2. **Opaque composite risk scores as the hero metric** (Rugcheck-style single number as safety warranty).  
3. **Branding third-party labels as confirmed smart money / insider / KOL identity** (GMGN, Nansen, Arkham, Birdeye tags).  
4. **Boosts, ads, paid rankings as organic traction** (DexScreener boosts/ads).  
5. **Cluster visuals implying proven collusion without transfer evidence and method panel** (Bubblemaps misuse / Magic Nodes mystique).

### 11.3 First 5 seconds after CA paste — **OUR product**

Target experience (research/ops, not trade):

| Second | UI | Source tier | User answer unlocked |
|--------|----|-------------|----------------------|
| **0.0–0.5s** | CA normalized; chain=Solana; mint format validation; skeleton layout | local | “Is this even a mint address?” |
| **0.5–2.0s** | **Authorities strip**: mint authority, freeze authority, (update authority if available); supply/decimals; integrity pipeline status (`checking…` → `passed` / `degraded`) | **Tier-A** | “Can supply be inflated? Can accounts be frozen?” |
| **2.0–3.5s** | **Concentration strip**: Top1 / Top10 / LP / residual; explicit `window=top N`, `as_of`; conservation check badge | **Tier-A** (preferred) | “Is ownership absurdly concentrated?” |
| **3.5–4.5s** | **Market strip** (if available): best pool vs other pools; liq + vol + Δ windows; `Tier-B` chip | **Tier-B** | “Is there real pool depth or only a ghost pool?” |
| **4.5–5.0s** | **Risk checklist preview** (top 3 severities) + CTAs: Holders · Transfers · Clusters · External refs (Solscan/Rugcheck link-out) — **no Buy button** | mixed, labeled | “What should I open next for evidence?” |

**Empty / error / degraded states (must design, competitors often hide):**

- RPC degraded → show partial Tier-A with red `degraded`, suppress overconfident summaries.  
- Token too new → `holders incomplete`, disable fake precision on ratios.  
- No pools → market strip `no DEX pools indexed` (Tier-B miss ≠ token fake).  
- Authority fetch fail → do not inherit Rugcheck score as substitute truth.

**What must never appear in first 5 seconds:**

- “Smart money is buying”  
- “Safe score 92” as hero  
- Copy trade / instant buy  
- Boosted / trending as quality  

---

## 12. Per-product adopt conclusion index (quick reference)

| Product / surface | Adopt conclusion |
|-------------------|------------------|
| GMGN token concentration layout | **ADOPT_UI_PATTERN_NOW** (recompute) |
| GMGN smart money / insider tags | **REJECT** |
| GMGN trade/copy coupling | **REJECT** |
| GMGN wallet dossier / tracker | **DESIGN_FOR_LATER** |
| GMGN as data authority | **BENCHMARK_ONLY** |
| Birdeye overview + multi-market IA | **ADOPT_UI_PATTERN_NOW** |
| Birdeye holders API as SoT | **REJECT** (Tier-B only) |
| Birdeye holder top-N pattern | **ADOPT_UI_PATTERN_NOW** |
| Birdeye wallet tags | **REJECT** as confirmed |
| DexScreener pair windows + multi-pool | **ADOPT_UI_PATTERN_NOW** |
| DexScreener boosts/ads as quality | **REJECT** |
| Bubblemaps cluster UX | **ADOPT_UI_PATTERN_NOW** (disclaimer) |
| Bubblemaps Magic Nodes / time travel | **DESIGN_FOR_LATER** |
| Bubblemaps cluster = entity | **REJECT** |
| Rugcheck itemized risks | **ADOPT_UI_PATTERN_NOW** |
| Rugcheck hero composite score | **REJECT** |
| Solscan authority + drill-down | **ADOPT_UI_PATTERN_NOW** |
| Arkham entity taxonomy (language) | **ADOPT_UI_PATTERN_NOW** |
| Arkham/Nansen deep labels as truth | **REJECT** |
| Arkham/Nansen full surfaces | **ACCESS_BLOCKED** / **BENCHMARK_ONLY** |
| Hotsniper | **ACCESS_BLOCKED** / **SOURCE_NOT_AUTHORITATIVE** |
| Photon / BullX / Axiom | **REJECT** (research console) |
| Dune | **BENCHMARK_ONLY** / **DESIGN_FOR_LATER** |
| SolanaFM tx flow | **DESIGN_FOR_LATER** |
| Jupiter as research deep-link | **DESIGN_FOR_LATER**; not holder SoT |

---

## 13. Implementation implications for memecoin-ca-data-layer

1. **Split UI packages conceptually:** `facts` (Tier-A), `market` (Tier-B), `labels` (Tier-B, default hidden or muted), `actions` (export, link-out — not trade).  
2. **Every panel declares source:** `source=helius_rpc_checked` vs `source=dexscreener_api` vs `source=external_label:nansen` (if ever).  
3. **Pagination contract:** always show `returned`, `window`, `truncated_estimate?`, `conservation_ok`.  
4. **No silent third-party score promotion** into default sort of “safe tokens.”  
5. **Competitor deep-links** are fine: Solscan, Rugcheck, DexScreener, Bubblemaps — labeled external.  
6. **Do not build** copy-trade, sniper, or boost-chasing features in Operator Console research branch.

---

## 14. Open questions (non-blocking)

- Exact production ToS/rate limits for DexScreener, Birdeye CU pricing current tier table (billing pages change).  
- Bubblemaps partner commercial terms for iframe vs Data API.  
- Rugcheck API key issuance process stability (community friction historically).  
- Whether Operator Console will allow *optional* Tier-B label packs behind an advanced toggle (product decision).  
- Historical holder snapshots storage cost for time-travel feature.

---

## 15. Document control

| Item | Value |
|------|-------|
| Written for | Operator Console research branch |
| Access date baseline | 2026-07-31 |
| Live provider calls | 0 |
| Authority | Public web knowledge only; UI details may drift |
| Trust model | Tier-A RPC/Helius checked; Tier-B external observation never confirmed smart money/insider |
| File path | `docs/research/OPERATOR_CONSOLE_COMPETITOR_RESEARCH_20260731.md` |

---

*End of research document.*
