# Provider Capability and Trust Matrix

| Field | Value |
| --- | --- |
| Task | `OPERATOR-CONSOLE-PRODUCT-RESEARCH-AND-UX-SPEC-001` |
| Document | `PROVIDER_CAPABILITY_AND_TRUST_MATRIX_20260731` |
| Access date | **2026-07-31** |
| Scope | Solana-only operator-console provider map (facts, enrichment, labels, macro) |
| Authority | Research / UX product input. Does **not** authorize live multi-provider flip, paid plans, scrapers, or confirmed-label promotion. |
| Binding peers | `PROJECT_ARCHITECTURE.md` §3 trust tiers · `PROJECT_CONSTITUTION.md` · `docs/contracts/CA_SCAN_RESPONSE_V1.md` · `docs/designs/SOL-MARKET-DATA-DESIGN-001.md` · `OWNER_DECISIONS_NEEDED.md` |

---

## 0. Purpose

This matrix answers, for each capability the Operator Console may show:

1. **Who can supply it** (Helius, Solana RPC, DexScreener, GMGN, Birdeye, Rugcheck, Bubblemaps, Dune, Solscan).
2. **What trust class it may carry in *our* product** (Tier-A first-hand vs Tier-B borrowed).
3. **Whether the UI may treat it as confirmed**, observation-only, or blocked.
4. **What fails**, what falls back, and **which milestone** should surface it.

It is written for implementers, auditors, and UX so that fixture → hotpath → live enrichment does not silently upgrade borrowed numbers into chain facts.

---

## 1. Binding rules (must be encoded in product + adapters)

These rules are **non-negotiable** for any page, fixture, HTTP adapter, or judgment composition that consumes the providers below.

| ID | Rule | Product consequence |
| --- | --- | --- |
| BR-1 | **DexScreener market data = Tier-B enrichment** | Price, FDV/mcap, liquidity, volume, pair age, pair address from DexScreener are `sourceTier=B`, `verificationStatus=unverified` (or selected observation with trust class C in market-observation language). Never chain fact. |
| BR-2 | **GMGN / Birdeye labels = Tier-B observation** | Smart money, sniper, bundler, rat/insider, KOL, security hints are features / observations. They may never alone set `status=confirmed` on a judgment, wallet label, or cluster. |
| BR-3 | **Bubblemaps cluster = external cross-check / future benchmark** | Bubblemaps links and cluster visuals are **not** confirmed concentration and **not** a substitute for local owner-aggregated holder universes + funding-edge cluster rules. |
| BR-4 | **Helius chain data still needs local integrity** | Mint, token accounts, transfers, Enhanced history from Helius are Tier-A *candidates*. Confirmed requires local pagination completeness, supply conservation / accounting gates, owner aggregation, exclusion evidence, and (for concentration) pool evidence coverage. Partial enumeration ⇒ `PARTIAL`, not fake complete. |
| BR-5 | **Third-party Top10 / concentration cannot override local holder universe semantics** | Birdeye/GMGN/Rugcheck/Solscan “top10%”, “holder concentration”, “insider %” must never replace `raw_top_holders` / `owner_aggregated_holders` / `cleaned_top_holders` or write `concentrationEligible=true` without local gates. |
| BR-6 | **`null` ratios never display as `0`; `PARTIAL` ≠ `SUCCESS`** | Incomplete denominators, missing exclusion coverage, or truncated holder pages yield `ratio: null` + warnings. UI must show “—” / “unavailable” / partial chip, never zero-as-safe. Completeness chips must distinguish `PARTIAL` from full success. |
| BR-7 | **External labels are FEATURES, never conclusions** | Architecture §3: re-displaying a platform label as *our* conclusion is a drift violation. |
| BR-8 | **Market enrichment never overrides chain fact** | Constitution market rule: price/liquidity/volume do not rewrite balances, creator, transfers, or supply. |
| BR-9 | **Current live runtime boundary (Owner)** | As of 2026-07-28 Owner decision: runtime is **Helius-only** for live CA. Multi-provider live fan-out remains Owner-gated even when this matrix says `ADOPT_UI_PATTERN_NOW` for design/fixture contracts. |

## G0–G8 binding (post-Hotpath)

Hotpath (G0) merged PR #7 `ae60368`. Helius-only live holder path is the Owner boundary. `ADOPT_UI_PATTERN_NOW` never means “enable Birdeye/GMGN live from browser.” Implementation of Console wiring is **IMPLEMENT_IN_G1**.

| BR-10 | **Official free APIs only (Owner)** | No scrapers, no Cloudflare bypass. Free official paths first (Birdeye free, DexScreener free, GMGN free OpenAPI where available, Helius free 1M). Paid upgrades only against proven bottleneck. |

### 1.1 Project tier shorthand used in matrix columns

| Source tier in our project | Meaning |
| --- | --- |
| **A** | First-hand / reproducible chain (or local pure-function over chain). May become `confirmed` only after local integrity + versioned rule. |
| **B** | Borrowed enrichment / labels / third-party aggregates. Ingest as `unverified`; never alone `confirmed`. |

Market-design trust classes C/D/E map into product tier **B** for UI trust badges unless a separate B-class *local* derivation (saved Dune query with hash/version) is documented as macro-only.

### 1.2 Column legend (capability rows)

| Column | Meaning |
| --- | --- |
| Provider | Named external or local chain surface |
| Capability | Product capability family |
| Example fields | Illustrative field names (not a committed OpenAPI schema pin) |
| Source tier in our project (A/B) | Product trust tier after ingest |
| Verification status | Default product verification after ingest (`unverified` / `confirmed` possible only via local gates) |
| Freshness | Typical latency / staleness character for solo on-demand use |
| Pagination | How complete lists are obtained |
| Rate limit | Order-of-magnitude public/plan limits (re-verify before production automation) |
| Pricing/credential | Key / plan posture relevant to Owner gates |
| Schema stability | Expected churn risk for parsers |
| Historical availability | Whether history / replay is first-class |
| Evidence granularity | How fine the retained evidence can be |
| Can recompute locally | Whether we can rebuild the claim from Tier-A inputs |
| Can support confirmed | Whether *this provider path* can ever justify product `confirmed` |
| Failure modes | Typical degradation |
| Fallback | What the product does when this path fails |
| UI placement | Operator Console surface |
| Milestone | G0–G8 binding map (see executive summary / gap matrix) |
| Recommendation | `ADOPT_UI_PATTERN_NOW` \| `IMPLEMENT_IN_G<n>` \| `DESIGN_FOR_LATER` \| `BENCHMARK_ONLY` \| `REJECT` \| `ACCESS_BLOCKED` |

### 1.3 Recommendation meanings

| Code | Use when |
| --- | --- |
| **ADOPT_UI_PATTERN_NOW** | Adopt UI/IA/fixture semantics now; does **not** authorize paid multi-provider live fan-out |
| **IMPLEMENT_IN_G<n>** | Ship product/backend work only in the named G lane (G0 Hotpath done; G1 = Live Wiring + Stability + Observability) |
| **DESIGN_FOR_LATER** | Needed for product vision; adapters/parsers/Owner gate not ready; design + ports only |
| **BENCHMARK_ONLY** | Useful for offline comparison / research; never drives confirmed UI state |
| **REJECT** | Wrong trust model or ToS/risk posture for this product |
| **ACCESS_BLOCKED** | Capability exists externally but we lack key/plan/ToS path; do not pretend available |

### 1.4 Verification status vocabulary (UI)

| Status | Allowed when |
| --- | --- |
| `confirmed` | Tier-A inputs + local integrity gates + versioned pure rule; never Tier-B alone |
| `unverified` | Default for all borrowed observations; also Tier-A that failed completeness |
| `partial` / completeness partial | Some pages or fields present; ratios may be `null` |
| `unavailable` | Provider/error/budget; section empty with warning |

**Invariant (CaScanResponse v1):** `sourceTier === "B"` ∧ `status === "confirmed"` is rejected.

---

## 2. Provider posture (access date 2026-07-31)

| Provider | Role in product | Project wiring status (repo fact) | Owner / access posture |
| --- | --- | --- | --- |
| **Helius** | Primary Solana Tier-A transport (RPC + Enhanced + DAS-style token account reads) | Live read-only source exists (`LiveHeliusDataSource`); holder pilot 3 OK / 3 PARTIAL; Helius-only live boundary | Free 1M credit plan in use; `HELIUS_API_KEY` outside repo; fail closed if missing |
| **Solana RPC** | Generic chain RPC (may be Helius-hosted or public). Same semantic facts as Helius RPC methods | Used *via* Helius endpoint in live path; no multi-RPC failover without Owner decision | Public RPC insufficient for large holder enumeration; production endpoint Owner-gated |
| **DexScreener** | Free market pair / price / liq / volume enrichment | Fixture free-provider ports + offline `market_observations` selection; **live adapter not wired** | No key; free HTTP; rate ~60 rpm class on public endpoints |
| **GMGN** | Wallet stats / labels / discovery borrow layer | Wallet 7d/30d batch evidence exists (Tier-B); parsers versioned; not confirmed smart money | Free OpenAPI / official only; live CA fan-out still Owner-gated; cumulative PnL not complete |
| **Birdeye** | Market + holder hints + tags (free tier first) | Fixture ports only for market/holder hints | Free key Owner-gated; wallet APIs historically tight (e.g. ~5 rps / 75 rpm class — re-verify) |
| **Rugcheck** | Safety / authority / risk report borrow | Not a first-class live adapter in hot path | Public site + limited API posture; treat as B; mint/freeze still prefer chain parse |
| **Bubblemaps** | Visual cluster / distribution cross-check | Not wired | API/partner access often commercial; UI link-out OK; no confirmed concentration |
| **Dune** | Macro daily / saved-query aggregates | Macro daily path with allowlisted saved queries + SQL hash gates | `DUNE_API_KEY` / CLI auth Owner-local; not CA concentration truth |
| **Solscan** | Explorer-grade meta / holders / activities | Not wired as CA fact source | Pro API paid from ~$199/mo; free explorer is UI only — **ACCESS_BLOCKED** for bulk Pro without Owner buy |

---

## 3. Capability matrix (full rows)

> Notes: “Example fields” are **illustrative**. Rate limits and plan prices change; treat as planning order-of-magnitude.  
> “Can support confirmed” means *this provider row can feed a confirmed product state* — almost always only Helius/Solana RPC + **local** rules.

### 3.1 Token identity

| Provider | Capability | Example fields | Source tier in our project (A/B) | Verification status | Freshness | Pagination | Rate limit | Pricing/credential | Schema stability | Historical availability | Evidence granularity | Can recompute locally | Can support confirmed | Failure modes | Fallback | UI placement | Milestone | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Helius | token identity | `mint`, `decimals`, program id, DAS asset id | A | confirmed after parse + address normalize | slot-fresh | n/a (single account) | plan credits / DAS rps | free 1M + key | high (RPC JSON parsed) | mint account current; creation via history | account+slot watermark | yes (same RPC) | **yes** (local gates) | malformed account, wrong program, timeout | fail closed / unavailable section | CA header | G0–G1 | **ADOPT_UI_PATTERN_NOW** |
| Solana RPC | token identity | `getAccountInfo` mint jsonParsed | A | same as Helius | slot-fresh | n/a | endpoint-dependent | public or paid RPC | high | same | same | yes | **yes** | public RPC lag/ban | Helius-hosted RPC (Owner) | CA header | G0–G1 | **ADOPT_UI_PATTERN_NOW** (via Helius endpoint) |
| DexScreener | token identity | `baseToken.address/name/symbol` | B | unverified | seconds–minutes | n/a | ~60 rpm class | free, no key | medium | weak | pair-centric | partial | **no** | wrong chain pair, multi-pair ambiguity | Helius mint | CA header secondary label only | G0 fixture / G1+ live enrich | **ADOPT_UI_PATTERN_NOW** (enrichment only) |
| GMGN | token identity | token CA, symbol, launchpad flags | B | unverified | seconds | n/a | free-tier fragile | free OpenAPI / Owner | medium–low | limited | token card | partial | **no** | field rename, geo/WAF | Helius | discovery / trenches, not identity truth | G3+ | **DESIGN_FOR_LATER** |
| Birdeye | token identity | address, symbol, name | B | unverified | seconds | n/a | free-tier limited | free API key | medium | limited | token meta | partial | **no** | 401/429 | Helius | secondary | G1+ | **DESIGN_FOR_LATER** |
| Rugcheck | token identity | mint in report | B | unverified | minutes | n/a | public API soft limits | free/public | medium | point-in-time report | report blob | no | **no** | report missing | Helius | security panel id only | G1+ | **DESIGN_FOR_LATER** |
| Bubblemaps | token identity | token address for map | B | unverified | map refresh | n/a | partner/API | often paid | n/a | map history product | visual | no | **no** | no Solana map | omit embed | external link | G7+ | **BENCHMARK_ONLY** |
| Dune | token identity | not primary | B (macro) | n/a | batch | SQL | API CU | paid/free tiers | query-defined | strong if tables | row | n/a | **no** for CA id | wrong chain filter | — | not CA card | macro only | **REJECT** for CA identity |
| Solscan | token identity | token meta name/symbol/icon | B | unverified | explorer-fresh | n/a | Pro CU | Pro paid | medium | explorer | meta | partial | **no** as sole truth | 401 without Pro | Helius + Metaplex parse | optional explorer deep-link | — | **ACCESS_BLOCKED** (Pro) / link-out OK |

### 3.2 Supply

| Provider | Capability | Example fields | Source tier (A/B) | Verification status | Freshness | Pagination | Rate limit | Pricing/credential | Schema stability | Historical availability | Evidence granularity | Can recompute locally | Can support confirmed | Failure modes | Fallback | UI placement | Milestone | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Helius | supply | `supplyRaw`, decimals | A | confirmed when mint parse OK | slot | n/a | credits | free plan key | high | current; historical via archives | raw integer string | yes | **yes** | malformed supply string | unavailable / null ratios | CA facts / accounting denom | G0–G1 | **ADOPT_UI_PATTERN_NOW** |
| Solana RPC | supply | `getTokenSupply` / mint supply | A | same | slot | n/a | endpoint | same | high | current | raw | yes | **yes** | lag | Helius | same | G0–G1 | **ADOPT_UI_PATTERN_NOW** |
| DexScreener | supply | usually absent; FDV implies | B | unverified | n/a | n/a | free | free | n/a | no | weak | no | **no** | inventing supply from FDV | never use for denom | do not show as supply | — | **REJECT** as supply source |
| GMGN | supply | platform supply/mcap fields | B | unverified | seconds | n/a | free | free | medium | weak | opaque | no | **no** | non-integer display units | Helius supplyRaw | market chrome only | — | **REJECT** as accounting denom |
| Birdeye | supply | total supply fields | B | unverified | seconds | n/a | free | key | medium | weak | opaque | no | **no** | float precision | Helius | optional badge | — | **REJECT** as accounting denom |
| Rugcheck | supply | report supply claims | B | unverified | minutes | n/a | public | free | medium | snapshot | report | no | **no** | stale report | Helius | security context only | — | **REJECT** as accounting denom |
| Bubblemaps | supply | distribution % of “supply” | B | unverified | map | n/a | partner | paid? | n/a | product | visual | no | **no** | unknown supply def | local holders | never accounting | — | **REJECT** as supply |
| Dune | supply | SQL aggregates | B | unverified unless local B-class macro | batch | SQL | CU | key | query pin | strong | query row | if SQL pinned | macro only | SQL drift | allowlist hash fail closed | macro dashboard | G7 | **DESIGN_FOR_LATER** (macro) |
| Solscan | supply | token meta supply | B | unverified | explorer | n/a | Pro | paid | medium | explorer | string | partial | **no** alone | Pro required | Helius | link-out | — | **ACCESS_BLOCKED** / not denom |

### 3.3 Mint / freeze authority

| Provider | Capability | Example fields | Source tier (A/B) | Verification status | Freshness | Pagination | Rate limit | Pricing/credential | Schema stability | Historical availability | Evidence granularity | Can recompute locally | Can support confirmed | Failure modes | Fallback | UI placement | Milestone | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Helius | mint/freeze authority | mintAuthority, freezeAuthority (jsonParsed / DAS) | A | confirmed after parse | slot | n/a | credits | free key | high | current; history via txs | authority pubkey or null | yes | **yes** | Token-2022 extension miss | mark partial + warning | AuthorityFacts panel | G0–G1 | **ADOPT_UI_PATTERN_NOW** |
| Solana RPC | mint/freeze authority | same via getAccountInfo | A | confirmed after parse | slot | n/a | endpoint | RPC | high | current | same | yes | **yes** | wrong encoding | Helius | same | G0–G1 | **ADOPT_UI_PATTERN_NOW** |
| DexScreener | mint/freeze | not authoritative | B | n/a | n/a | n/a | free | free | n/a | no | none | no | **no** | N/A | chain parse | do not use | — | **REJECT** |
| GMGN | mint/freeze / safety | honeypot, tax, authority flags | B | unverified | seconds | n/a | free | free | medium | weak | feature flags | recheck on chain | **no** alone | false positive safety | Helius authorityFacts | security *hints* | G1+ | **DESIGN_FOR_LATER** |
| Birdeye | security tags | authority-related security fields | B | unverified | seconds | n/a | free | key | medium | weak | tags | recheck chain | **no** | missing free-tier fields | Helius | hints | G1+ | **DESIGN_FOR_LATER** |
| Rugcheck | mint/freeze report | mintAuthority, freezeAuthority, risks[] | B | unverified | minutes | n/a | public | free | medium | snapshot | report risks | **must** recheck chain | **no** alone | stale vs chain | Helius authorityFacts primary | Security strip (borrowed) | G1+ | **ADOPT_UI_PATTERN_NOW** as **hint only** (design: dual-display chain first) |
| Bubblemaps | authority | none | — | — | — | — | — | — | — | — | — | — | **no** | — | — | — | — | **REJECT** |
| Dune | authority | rare custom SQL | B | unverified | batch | SQL | CU | key | low | possible | weak | prefer chain | **no** | lag | chain | not CA hot path | — | **REJECT** for hot path |
| Solscan | authority display | explorer authority UI / meta | B | unverified | explorer | n/a | Pro/UI | paid/free UI | medium | explorer | medium | recheck chain | **no** alone | Pro | Helius | deep-link | — | **BENCHMARK_ONLY** |

### 3.4 Metadata

| Provider | Capability | Example fields | Source tier (A/B) | Verification status | Freshness | Pagination | Rate limit | Pricing/credential | Schema stability | Historical availability | Evidence granularity | Can recompute locally | Can support confirmed | Failure modes | Fallback | UI placement | Milestone | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Helius | metadata | DAS `getAsset` name, symbol, uri, json | A (account) / B (off-chain JSON) | on-chain meta fields confirmable; off-chain uri content unverified | slot + URI fetch | n/a | DAS rps | free key | medium (DAS) | current | asset id + uri | uri may 404 | on-chain fields **yes**; image/social **no** | DAS miss, URI timeout | symbol from mint only | CA header | G0–G1 | **ADOPT_UI_PATTERN_NOW** |
| Solana RPC | metadata | Metaplex account parse | A / B off-chain | same | slot | n/a | endpoint | RPC | medium | current | account | yes | on-chain **yes** | complex Token-2022 | Helius DAS | same | G1 | **DESIGN_FOR_LATER** (if not via Helius) |
| DexScreener | metadata | imageUrl, socials, websites | B | unverified | minutes | n/a | free | free | medium | weak | pair info | no | **no** | boosted/spam profiles | Helius/uri | chrome | G0+ | **ADOPT_UI_PATTERN_NOW** (display only) |
| GMGN | metadata | icons, social scores | B | unverified | seconds | n/a | free | free | low–medium | weak | card | no | **no** | CDN fail | DexScreener/Helius | discovery | G3 | **DESIGN_FOR_LATER** |
| Birdeye | metadata | logo, extensions | B | unverified | seconds | n/a | free | key | medium | weak | meta | no | **no** | 429 | DexScreener | chrome | G1 | **DESIGN_FOR_LATER** |
| Rugcheck | metadata | name in report | B | unverified | minutes | n/a | public | free | medium | snapshot | weak | no | **no** | missing | Helius | security card | — | **BENCHMARK_ONLY** |
| Bubblemaps | metadata | n/a | — | — | — | — | — | — | — | — | — | — | **no** | — | — | — | — | **REJECT** |
| Dune | metadata | n/a | — | — | — | — | — | — | — | — | — | — | **no** | — | — | — | — | **REJECT** |
| Solscan | metadata | token meta icon/name | B | unverified | explorer | n/a | Pro | paid | medium | explorer | meta | no | **no** | Pro | Helius | link-out | — | **ACCESS_BLOCKED** bulk |

### 3.5 Holders / token accounts / owner aggregation

| Provider | Capability | Example fields | Source tier (A/B) | Verification status | Freshness | Pagination | Rate limit | Pricing/credential | Schema stability | Historical availability | Evidence granularity | Can recompute locally | Can support confirmed | Failure modes | Fallback | UI placement | Milestone | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Helius | token accounts | `getTokenAccounts` / DAS pages: address, owner, amount | A | **unverified until** paginationComplete + conservation; then accounting may confirm | slot/index | **cursor pages** (pageSize e.g. 1000; maxPages budget) | credits + rps; free DAS often ~2 rps class | free 1M | medium | snapshot only unless re-pull | per-account + page slots | **yes** (local owner sum) | **accounting yes** if complete; **concentration only with** exclusion+pool gates | truncated pages → PARTIAL; mixed owner; index lag | PARTIAL card; null concentration ratios | Holder universes | G0 pilot done · G0 hotpath merged · G1 live wiring | **ADOPT_UI_PATTERN_NOW** |
| Helius | holders (derived) | owner balances after local aggregate | A (derived) | confirmed only if snapshot complete + ruleVersion | as-of snapshot | derived | same | same | local rules stable | recompute on demand | owner rows + evidence | **yes** | **yes** under gates | incomplete exclusion coverage | concentration unverified | cleaned_top_holders | G1 | **ADOPT_UI_PATTERN_NOW** |
| Solana RPC | token accounts | `getProgramAccounts` / largest accounts | A | same integrity rules | slot | GPA heavy; largest is **top-N only** | public often unusable | RPC cost | high | snapshot | account | yes | top-N alone **cannot** confirm full universe | GPA limits, top20 trap | Helius enumeration | do not use largest-only for cleaned universe | G1 | **ADOPT_UI_PATTERN_NOW** only as complement; **REJECT** largest-only concentration |
| DexScreener | holders | none reliable | — | — | — | — | free | free | — | — | — | — | **no** | — | Helius | — | — | **REJECT** |
| GMGN | holders / top holders | top holder list, holder count | B | unverified; `isBorrowedConcentration=true` | seconds | platform page | free fragile | free | low–medium | weak | list without full universe proof | no full recompute | **no** | opaque filters, bots | local Helius universes | optional “platform top” strip | G1+ | **DESIGN_FOR_LATER** (hint) |
| Birdeye | holders / Top10 | `top10Pct`, holderCount | B | unverified; never override local | seconds | often top-only | free tight | free key | medium | weak | aggregates | **no** | **no** | different universe def | local holders | **never** primary concentration | G0 contract already forbids | **REJECT** as concentration authority; optional hint **DESIGN_FOR_LATER** |
| Rugcheck | holders / concentration | top holders, risks | B | unverified | minutes | top-N | public | free | medium | snapshot | report | no | **no** | unknown exclusions | local holders | security risks only | G1+ | **REJECT** as concentration authority |
| Bubblemaps | holders visual | bubble sizes, top N | B | unverified | map refresh | top N visual | partner | often paid | n/a | product history | visual edges | no | **no** | missing wallets | local graph later | external map link | G3–G7 | **BENCHMARK_ONLY** |
| Dune | holders | custom holder SQL | B | unverified | batch hours | SQL | CU | key | query pin | good if table | row | if SQL local | not hot-path confirmed | lag, table lag | Helius snapshot | research | cold path | **BENCHMARK_ONLY** |
| Solscan | holders | `/token/holders` page_size limited | B | unverified | explorer | page/offset; **not full universe proof** | Pro CU / rpm | **paid Pro** | medium | explorer | account rows | partial | **no** alone | max page caps; Pro required | Helius | optional secondary | — | **ACCESS_BLOCKED** without Pro; else **BENCHMARK_ONLY** |

**Local invariant:** `raw_top_holders` ≠ `owner_aggregated_holders` ≠ `cleaned_top_holders`. Third parties do not populate cleaned universe.

### 3.6 Market price / market cap / liquidity / volume / pair age / primary pool

| Provider | Capability | Example fields | Source tier (A/B) | Verification status | Freshness | Pagination | Rate limit | Pricing/credential | Schema stability | Historical availability | Evidence granularity | Can recompute locally | Can support confirmed | Failure modes | Fallback | UI placement | Milestone | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Helius | market price | not primary (unless parse pool reserves) | A if reserves decoded | unverified until local pool decode rule | slot | n/a | credits | free | depends IDL | txs | reserves raw | **yes** with pool decoder | price from reserves possible later | IDL churn | DexScreener B | advanced pool panel | G7+ | **DESIGN_FOR_LATER** |
| Solana RPC | pool reserves | vault token amounts | A | same | slot | n/a | endpoint | RPC | IDL risk | snapshot | raw amounts | yes | with local USD oracle policy | multi-pool | DexScreener | pool evidence | G7 | **DESIGN_FOR_LATER** |
| DexScreener | market price | `priceUsd`, `priceNative` | **B** | **unverified** | seconds–minutes | multi-pair array | ~60 rpm | **free no key** | medium | weak OHLCV on free | per-pair | no | **no** | multi-pair pick error | Birdeye / null market | MarketSnapshot | G0 fixture · G1+ live | **ADOPT_UI_PATTERN_NOW** (Tier-B enrichment) |
| DexScreener | market cap / FDV | `marketCap`, `fdv` | **B** | unverified | same | pairs | same | free | medium | weak | per-pair | no | **no** | supply def mismatch | show source-labelled; null if missing | MarketSnapshot | G0–G1 | **ADOPT_UI_PATTERN_NOW** (B) |
| DexScreener | liquidity | `liquidity.usd/base/quote` | **B** | unverified | same | pairs | same | free | medium | weak | per-pair | partial via reserves | **no** as chain fact | stale liq | null + warning | MarketSnapshot / large-order floor | G0–G1 | **ADOPT_UI_PATTERN_NOW** (B) |
| DexScreener | volume | `volume.m5/h1/h6/h24`, txns buys/sells | **B** | unverified | same | pairs | same | free | medium | windowed only | per-pair windows | no | **no** | double-count multi-pair | do not sum providers | MarketSnapshot | G0–G1 | **ADOPT_UI_PATTERN_NOW** (B) |
| DexScreener | pair age | `pairCreatedAt` | **B** | unverified until chain event | same | pairs | same | free | medium | pair birth claim | timestamp | confirm via chain | **no** alone | wrong pair | pool create event | pair strip | G1 | **ADOPT_UI_PATTERN_NOW** as clue |
| DexScreener | primary pool clue | best liq pairAddress, dexId | **B** | unverified | same | list pairs | same | free | medium | n/a | pair list | local select rule | **no** until A-confirm | boosts/spam pairs | selection_rule_version + warnings | pair selector | G1 / market-select-v1 | **ADOPT_UI_PATTERN_NOW** (clue) |
| GMGN | market fields | price, mcap, liq, vol on token cards | B | unverified | seconds | n/a | free | free | low–medium | weak | card | no | **no** | schema churn | DexScreener first | optional dual quote | G3 | **DESIGN_FOR_LATER** |
| Birdeye | market fields | price, liq, v24h, OHLCV | B | unverified | seconds | OHLCV pages | free limited | free key | medium | better OHLCV | candle | no | **no** | 429, plan walls | DexScreener | dual source conflict UI | G1+ | **DESIGN_FOR_LATER** |
| Rugcheck | market/liq risks | LP locked, liq flags | B | unverified | minutes | n/a | public | free | medium | snapshot | risk codes | recheck chain LP | **no** | false LP status | pool token accounts | security | G1+ | **DESIGN_FOR_LATER** |
| Bubblemaps | market | none | — | — | — | — | — | — | — | — | — | — | **no** | — | — | — | — | **REJECT** |
| Dune | market macro | dex volume, TVL-like | B | macro observation | daily/hours | SQL | CU | key | pin SQL | strong | aggregate | yes if SQL ours | not CA price | query drift | allowlist | Macro / liquidity dashboard | **G7** | **ADOPT_UI_PATTERN_NOW** (macro path exists) |
| Solscan | markets / price | token price, markets | B | unverified | explorer | pages | Pro | paid | medium | some history | medium | no | **no** | Pro | DexScreener | link-out | — | **ACCESS_BLOCKED** / **BENCHMARK_ONLY** |

### 3.7 Pool evidence (chain)

| Provider | Capability | Example fields | Source tier (A/B) | Verification status | Freshness | Pagination | Rate limit | Pricing/credential | Schema stability | Historical availability | Evidence granularity | Can recompute locally | Can support confirmed | Failure modes | Fallback | UI placement | Milestone | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Helius | pool evidence | vault owners, LP mints, swap txs, Pump migrate | A | confirmed when decoded + linked to mint | slot | tx pagination | credits | free | IDL/program risk | Enhanced history | instruction-level | **yes** with decoders | **yes** for vault exclusion | unknown AMM, partial history | concentration stays unverified | exclusion: `excluded_pools` | G1 Stability | **ADOPT_UI_PATTERN_NOW** (extend pilot) |
| Solana RPC | pool evidence | same accounts/txs | A | same | slot | signatures pages | endpoint | RPC | same | same | same | yes | **yes** | history truncation | Helius Enhanced | same | G1 | **ADOPT_UI_PATTERN_NOW** via Helius |
| DexScreener | pool evidence | pairAddress only (claim) | B | unverified | minutes | n/a | free | free | medium | weak | address claim | confirm on chain | **no** | spoofed pair | Helius vault proof | pair clue → confirm queue | G1 | **ADOPT_UI_PATTERN_NOW** as clue only |
| GMGN | pool | pair/pool hints | B | unverified | seconds | n/a | free | free | low | weak | weak | recheck | **no** | wrong venue | DexScreener+Helius | — | — | **DESIGN_FOR_LATER** |
| Birdeye | pool | markets list | B | unverified | seconds | pages | free | key | medium | weak | medium | recheck | **no** | incomplete venues | Helius | — | G1+ | **DESIGN_FOR_LATER** |
| Rugcheck | LP risk | LP burned/locked flags | B | unverified | minutes | n/a | public | free | medium | snapshot | risk | recheck mint/LP | **no** alone | wrong LP token | Helius | security | G1 | **DESIGN_FOR_LATER** |
| Bubblemaps | pool | n/a | — | — | — | — | — | — | — | — | — | — | **no** | — | — | — | — | **REJECT** |
| Dune | pool | decoded dex tables | B | unverified | batch | SQL | CU | key | table lag | good | row | possible | not hot-path | lag | Helius | research | cold | **BENCHMARK_ONLY** |
| Solscan | defi activities | pool-related activities | B | unverified | explorer | pages | Pro | paid | medium | explorer | tx list | recheck | **no** alone | Pro | Helius | link-out | — | **ACCESS_BLOCKED** |

**Pilot fact:** all 6 public CA concentration remain **unverified** without adequate pool exclusion evidence — do not UI-promote concentration confirmed from accounting alone.

### 3.8 Wallet PnL / wallet labels / dev / sniper / bundler / insider

| Provider | Capability | Example fields | Source tier (A/B) | Verification status | Freshness | Pagination | Rate limit | Pricing/credential | Schema stability | Historical availability | Evidence granularity | Can recompute locally | Can support confirmed | Failure modes | Fallback | UI placement | Milestone | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Helius | wallet PnL (raw) | Enhanced swaps, token transfers, SOL funding | A inputs | PnL **confirmed only** after local swap≠transfer rules + venue decode | history window | signature/cursor pages | **credit heavy** | free 1M ceiling | medium | windowed by pull budget | per-tx | **yes** (cold path) | **yes** for library promotion | budget exhaustion, partial history | PARTIAL PnL / keep Tier-B lead | wallet detail / cold promote | G3–G4 | **ADOPT_UI_PATTERN_NOW** for promote path design; live budget throttle |
| Solana RPC | wallet history | `getSignaturesForAddress` + txs | A inputs | same | window | pages | public weak | RPC | high | same | per-tx | yes | **yes** with decode | rate ban | Helius Enhanced | same | G3 | **ADOPT_UI_PATTERN_NOW** via Helius |
| DexScreener | wallet PnL/labels | none | — | — | — | — | — | — | — | — | — | — | **no** | — | — | — | — | **REJECT** |
| GMGN | wallet PnL | `pnl_7d`, `pnl_30d`, realized, winrate | **B** | **unverified** always as observation | seconds | wallet batch | free fragile; 1433 run ~97% PARTIAL fielding | free OpenAPI | **low–medium** (parser versions already) | 7d/30d stronger than cumulative | period stats | reconstruct later from A | **no** alone | PARTIAL fields, alias churn | leave null; never 0 | wallet table Tier-B columns | G0 show · G3 library | **ADOPT_UI_PATTERN_NOW** as **Tier-B observation** |
| GMGN | wallet labels | smart_degen, sniper, bundler, rat_trader, renowned, dev | **B** | **unverified** feature only | seconds | n/a | free | free | low–medium | label may flip | tag + time | detectors recompute | **no** alone | silent tag renames | show as `borrowed_label` | wallet / CA signals | G0–G3 | **ADOPT_UI_PATTERN_NOW** (feature); **REJECT** as conclusion |
| GMGN | dev / sniper / bundler / insider | token-level ratios + wallet tags | **B** | unverified | seconds | n/a | free | free | low–medium | weak | counts/ratios | **yes** later via detectors | **no** alone | inflated sniper % | local bot-sniper-v1 / cluster-fusion-v1 | CA signals strip | G1–G3 | **ADOPT_UI_PATTERN_NOW** feature; confirm offline |
| Birdeye | wallet labels / PnL | tags, trader metrics (plan-dependent) | **B** | unverified | seconds | pages | **tight** wallet RPM | free/paid | medium | limited free | tags | recompute A | **no** alone | plan wall | GMGN feature + Helius | optional second feature | G3 | **DESIGN_FOR_LATER** |
| Rugcheck | insider graph / risks | insider networks, risk scores | **B** | unverified | minutes | n/a | public | free | medium | snapshot | graph/report | funding-edge local | **no** alone | opaque graph | local funding clusters | security / cluster *hint* | G1–G3 | **DESIGN_FOR_LATER** |
| Bubblemaps | cluster labels | magic nodes, linked wallets | **B** | unverified cross-check | map | visual | partner | often paid | n/a | product | visual | funding+transfer local | **no** | false clusters | local cluster-fusion | external benchmark | G3+ | **BENCHMARK_ONLY** |
| Dune | wallet cohorts | smart money tables (if any) | B | unverified | batch | SQL | CU | key | query | strong | aggregate | possible | **no** for CA labels | definition drift | local library | research | cold | **BENCHMARK_ONLY** |
| Solscan | wallet activities | transfers, defi acts | B | unverified | explorer | pages | Pro | paid | medium | explorer | tx list | prefer Helius | **no** alone | Pro | Helius | link-out | — | **ACCESS_BLOCKED** / link-out |

**Display law:** GMGN/Birdeye “smart money” → UI copy **“platform label (unverified)”** or feature chip — never “confirmed smart money” / Alpha tier.

### 3.9 Funding source / cluster

| Provider | Capability | Example fields | Source tier (A/B) | Verification status | Freshness | Pagination | Rate limit | Pricing/credential | Schema stability | Historical availability | Evidence granularity | Can recompute locally | Can support confirmed | Failure modes | Fallback | UI placement | Milestone | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Helius | funding source | first SOL transfer in, Enhanced native transfers | A | confirmed with history completeness + service-funder rules | as-of pull | tx pages | credits | free | medium | windowed | edge list | **yes** | **yes** (`funding-clusters` + evidence) | missing early txs; bridge opacity | partial cluster | cluster / funder panel | G1–G3 | **ADOPT_UI_PATTERN_NOW** |
| Solana RPC | funding | same raw txs | A | same | same | pages | endpoint | RPC | high | same | edges | yes | **yes** | public RPC history holes | Helius | same | G1–G3 | **ADOPT_UI_PATTERN_NOW** |
| DexScreener | funding/cluster | none | — | — | — | — | — | — | — | — | — | — | **no** | — | — | — | — | **REJECT** |
| GMGN | funding/cluster hints | bundled wallets, insider % | B | unverified | seconds | n/a | free | free | low | weak | opaque | local edges | **no** | marketing definitions | Helius edges | feature only | G3 | **DESIGN_FOR_LATER** |
| Birdeye | funding tags | limited | B | unverified | seconds | n/a | free | key | medium | weak | tags | local | **no** | sparse free | Helius | feature | G3 | **DESIGN_FOR_LATER** |
| Rugcheck | insider cluster | insider graph | B | unverified | minutes | n/a | public | free | medium | snapshot | graph | local | **no** | non-reproducible | Helius | hint | G3 | **DESIGN_FOR_LATER** |
| Bubblemaps | cluster | transfer-linked bubbles, magic nodes | **B** | **unverified external cross-check** | map | top-N | partner | often paid | n/a | product | visual edges | **local funding/transfer graph is authority** | **no** for confirmed concentration | incomplete top-N; CEX hubs | local cluster-fusion-v1 | “Open Bubblemaps” + benchmark note | G3–G7 | **BENCHMARK_ONLY** |
| Dune | cluster research | custom entity SQL | B | unverified | batch | SQL | CU | key | pin | good | row | yes if SQL | research only | lag | Helius | research | cold | **BENCHMARK_ONLY** |
| Solscan | funding view | transfer lists | B | unverified | explorer | pages | Pro | paid | medium | explorer | transfers | prefer Helius | **no** alone | Pro | Helius | link-out | — | **ACCESS_BLOCKED** |

### 3.10 Historical replay / liquidity dashboard / alerts

| Provider | Capability | Example fields | Source tier (A/B) | Verification status | Freshness | Pagination | Rate limit | Pricing/credential | Schema stability | Historical availability | Evidence granularity | Can recompute locally | Can support confirmed | Failure modes | Fallback | UI placement | Milestone | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Helius | historical replay inputs | Enhanced tx history, slot watermarks | A inputs | replay confirmed only with pinned fixtures + complete pulls | historical | heavy pagination | **credit risk** | free 1M | medium | yes with budget | per-tx + watermark | **yes** (product core) | **yes** for chain facts | free tier exhaust | fixture replay harness | cold path / task runs | G4 | **ADOPT_UI_PATTERN_NOW** (budgeted) |
| Solana RPC | historical | signatures + blocks | A inputs | same | historical | heavy | public weak | RPC | high | archives needed for deep | per-tx | yes | **yes** | prune | Helius | cold | G4 | **ADOPT_UI_PATTERN_NOW** via Helius |
| DexScreener | historical market | limited free history | B | unverified | windowed | n/a | free | free | medium | **weak** free | pair windows | no full tape | **no** | gaps | append-only local observations | market history chart lite | G1–G7 | **DESIGN_FOR_LATER** |
| GMGN | historical wallet | period stats not full tape | B | unverified | period | n/a | free | free | low | 7d/30d partial product | period | cold A rebuild | **no** | cumulative incomplete | Helius promote | wallet history B columns | G3 | **ADOPT_UI_PATTERN_NOW** observation only |
| Birdeye | OHLCV history | candles | B | unverified | candles | time pages | free/paid | key | medium | better than Dex free | candle | no | **no** | plan wall | local observations | charts | G7 | **DESIGN_FOR_LATER** |
| Rugcheck | historical | report snapshots if stored | B | unverified | point | n/a | public | free | medium | only if we archive | report | no | **no** | lost reports | local observation store | audit trail | cold | **DESIGN_FOR_LATER** |
| Bubblemaps | historical distribution | token history maps | B | unverified | product | n/a | partner | paid? | n/a | product strength | visual | no | **no** | access | local snapshots | research link | G7 | **BENCHMARK_ONLY** |
| Dune | historical macro / liquidity | saved query rows, report_day | B (macro B-class when pinned) | execution-evidenced, not CA confirmed | daily/hours | SQL / result pages | API CU | key / CLI | **high if allowlisted hash** | **strong** | query+execution id | yes (SQL) | macro metrics yes; CA no | SQL drift, timeout | fail closed allowlist | **Liquidity / macro dashboard** | **G7** (+ existing macro) | **ADOPT_UI_PATTERN_NOW** (macro) |
| Solscan | historical explorer | charts, holders over time UI | B | unverified | explorer | pages | Pro | paid | medium | explorer | medium | no | **no** | Pro | Dune+Helius | link-out | G7 | **ACCESS_BLOCKED** / link |
| *(local product)* | alerts | threshold on liq/price/labels | A/B mix | never silent confirmed | policy | n/a | local | n/a | versioned policy | local store | event | yes | only if A gates | alert spam | DEGRADED quiet | task center / future | G4–G7 | **DESIGN_FOR_LATER** (Owner: no cron yet) |

---

## 4. Cross-capability quick map (who is primary)

| Capability | Primary for product truth | Allowed enrichment | Forbidden as sole authority |
| --- | --- | --- | --- |
| token identity / supply / authorities | **Helius / Solana RPC** + local parse | DexScreener names; Rugcheck hint | GMGN/Birdeye/Solscan meta alone |
| metadata display | Helius DAS + uri | DexScreener socials | any as on-chain authority without parse |
| holders / owner aggregation / cleaned universe | **Helius enumeration + local rules** | GMGN/Birdeye top lists as **hint** | third-party Top10% / concentration |
| market price/liq/vol/pair age | **DexScreener (B)** first free | Birdeye dual; later pool reserves (A) | treating price as balance fact |
| primary pool clue | DexScreener pair list (B) | Birdeye markets | without chain vault confirm for exclusion |
| pool evidence / exclusion | **Helius + decoders** | Rugcheck LP flags | Dex pair alone |
| wallet PnL confirmed | **Helius swaps + local PnL** | GMGN 7d/30d lead | GMGN alone → address library confirmed |
| labels sniper/bundler/smart money | **local detectors** | GMGN/Birdeye/Rugcheck features | platform label as conclusion |
| funding / cluster confirmed | **Helius edges + cluster-fusion** | Bubblemaps / Rugcheck cross-check | Bubblemaps as confirmed concentration |
| macro liquidity dashboard | **Dune allowlisted queries** + local SQL | Dex venue volumes (B) | CA concentration from Dune |
| explorer deep links | Solscan / SolanaFM URLs | — | Pro API bulk without Owner |

---

## 5. Summary recommendation table

| Provider | Overall recommendation | Primary adopt surface | Do not use for | Owner gate before live multi-use |
| --- | --- | --- | --- | --- |
| **Helius** | **ADOPT_UI_PATTERN_NOW** | mint, supply, authorities, token accounts, funding, enhance history, promote-to-library | unconstrained full-history without credit budget | key already; budget/throttle; optional paid plan if free exhausted |
| **Solana RPC** | **ADOPT_UI_PATTERN_NOW** (via Helius endpoint) | same Tier-A methods | public RPC as production holder GPA | production endpoint selection |
| **DexScreener** | **ADOPT_UI_PATTERN_NOW** (Tier-B market) | price, liq, vol, pair age, primary pair **clue** | supply denom, concentration, labels | none for free HTTP; still Owner flip for live CA fan-out |
| **GMGN** | **ADOPT_UI_PATTERN_NOW** observation / **REJECT** as conclusion | wallet 7d/30d, borrowed labels, discovery leads | confirmed smart money, cleaned holders, Alpha tier | OpenAPI terms; no scrape; live CA attach gated |
| **Birdeye** | **DESIGN_FOR_LATER** | dual market quote, optional tags | concentration authority | free API key; rate budget |
| **Rugcheck** | **DESIGN_FOR_LATER** (hints **ADOPT** in UX copy) | security risk chips; authority **hint** beside chain facts | overriding chain authority or concentration | confirm official API ToS |
| **Bubblemaps** | **BENCHMARK_ONLY** | external cluster visual cross-check | confirmed concentration / cluster conclusions | partner/API access if embed beyond link-out |
| **Dune** | **ADOPT_UI_PATTERN_NOW** for **macro/G7**; **REJECT** for CA facts | liquidity dashboard, daily macro, reconciliation | holder concentration, wallet labels | `DUNE_API_KEY` / CLI; saved-query allowlist only |
| **Solscan** | **ACCESS_BLOCKED** (Pro bulk) / link-out **ADOPT** | human explorer links | Tier-A replacement; free bulk holders truth | paid Pro if Owner wants secondary API |

### 5.1 Recommendation by capability family

| Capability family | Recommendation | Notes |
| --- | --- | --- |
| token identity / supply / mint-freeze | **ADOPT_UI_PATTERN_NOW** (Helius) | Rugcheck dual-display hint OK later |
| metadata chrome | **ADOPT_UI_PATTERN_NOW** (Helius + DexScreener B) | |
| holders + owner aggregation | **ADOPT_UI_PATTERN_NOW** (Helius + local) | PARTIAL ≠ SUCCESS |
| market price/mcap/liq/vol/pair | **ADOPT_UI_PATTERN_NOW** (DexScreener B) | never confirmed |
| primary pool clue | **ADOPT_UI_PATTERN_NOW** (DexScreener B) | confirm vaults on Helius before exclusion complete |
| pool evidence | **ADOPT_UI_PATTERN_NOW** design · continue G1 | blocks concentration confirmed |
| wallet PnL B | **ADOPT_UI_PATTERN_NOW** (GMGN observation) | |
| wallet PnL A promote | **DESIGN_FOR_LATER** cold path | credit budget |
| labels sniper/bundler/insider/smart | **ADOPT_UI_PATTERN_NOW** as features | detectors confirm later |
| funding source | **ADOPT_UI_PATTERN_NOW** (Helius path) | service-funder rules |
| cluster confirmed | **DESIGN_FOR_LATER** local; Bubblemaps **BENCHMARK_ONLY** | |
| historical replay | **ADOPT_UI_PATTERN_NOW** fixtures + budgeted Helius | harness replay |
| liquidity dashboard | **ADOPT_UI_PATTERN_NOW** design **G7** (Dune) | |
| alerts | **DESIGN_FOR_LATER** | Owner: no auto cron |

---

## 6. Owner Gates (paid APIs, login, credentials, ToS)

Gates below block **implementation or live enablement**, not offline fixture UX.

| Gate ID | Decision | Blocks | Safe default until decided |
| --- | --- | --- | --- |
| OG-1 | Live multi-provider fan-out beyond Helius-only boundary | DexScreener/GMGN/Birdeye/Rugcheck live in CA hot path | Fixture + offline observations only; Helius-only live CA |
| OG-2 | `HELIUS_API_KEY` + plan (free 1M vs paid) | any live Helius | fail closed; throttle to preserve 1M |
| OG-3 | Production RPC endpoint mode | non-local live | `mainnet` Helius RPC with key; no silent public fallback |
| OG-4 | Birdeye free API key issuance | Birdeye live | DESIGN_FOR_LATER; DexScreener first |
| OG-5 | GMGN official OpenAPI credentials / ToS scope | live GMGN attach to console | keep batch evidence offline; no scrape |
| OG-6 | Rugcheck API / automated use ToS | live security poll | manual link-out or offline fixtures |
| OG-7 | Bubblemaps API / partner / embed license | in-app map | external URL only; BENCHMARK_ONLY |
| OG-8 | Dune API key / CLI auth + query spend | macro live runs | allowlisted saved queries only; no ad-hoc SQL from UI |
| OG-9 | Solscan Pro subscription (~$199+/mo class) | Solscan Pro API | **ACCESS_BLOCKED**; explorer hyperlinks only |
| OG-10 | Scrubbed payload retention (7d raw / long-term observations) | retaining live bodies | already decided 7d scrubbed raw; no secrets in git |
| OG-11 | Paid Helius / Birdeye / others after free bottleneck proof | plan upgrade spend | free stack first (Owner 2026-07-26) |
| OG-12 | Automation / cron / alerts firing | unattended quota burn | manual triggers only |
| OG-13 | Cumulative PnL full rebuild | mass Helius replay | PARK full 1433 rebuild |
| OG-14 | BSC / multichain providers | non-Solana rows | stage blocked |

### 6.1 Credential handling (binding ops)

- Credentials live in process env / OS secret store only — never repo, harness artifacts, fixtures, or markdown.
- Missing key ⇒ provider status `unavailable`, not synthetic zeros.
- Parsers must not persist cookies, bearer tokens, or private API paths in CaScanResponse (fail-closed allowlists).

---

## 7. UI encoding rules (Operator Console)

These are product rules for G0 shell and later live pages.

### 7.1 Trust chrome (required)

Every metric tile must be able to show:

- **Source** (helius | dexscreener | gmgn | …)
- **Tier** (A | B)
- **Verification** (confirmed | unverified | unavailable)
- **Completeness** (complete | partial | unavailable) — **PARTIAL ≠ SUCCESS**
- **Warnings[]** (human-readable)

### 7.2 Null and zero

| Case | UI |
| --- | --- |
| `ratio === null` | em dash / “n/a”, not `0%` |
| missing price | “market unavailable”, not `$0` |
| PARTIAL holders | partial chip + “concentration unverified” |
| borrowed top10 | label “platform estimate (B)” and do not drive risk color as confirmed |
| accounting confirmed but concentration unverified | show **both** states; never imply one from the other |

### 7.3 Suggested placements

| Console area | Providers | Default trust |
| --- | --- | --- |
| CA header identity | Helius | A |
| Authority facts | Helius primary; Rugcheck hint secondary | A / B hint |
| Market strip | DexScreener | B |
| Holder tables / concentration | Helius local universes | A gated |
| Wallet signals strip | GMGN/Birdeye features | B |
| Cluster panel | local rules; Bubblemaps link | A gated / B benchmark |
| Security strip | Rugcheck + chain authorities | B + A |
| Wallet intelligence | GMGN stats B; promote via Helius | B / A |
| Task center | local orchestration | n/a |
| Liquidity / macro | Dune + local SQL | macro B-class evidenced |
| Explorer | Solscan URL | link only |

### 7.4 Milestone mapping (console)

| Milestone | Provider emphasis |
| --- | --- |
| **M0** (done) | Helius holder pilot integrity semantics |
| **G0** Shell | Fixtures encoding Tier A/B, PARTIAL, null ratios; no live multi-provider |
| **G1** Holder hotpath | Helius enumeration + pool evidence path; DexScreener B market when Owner flips |
| **G3** Address library | GMGN B observation sediment; Helius confirm on promote |
| **G4** Task orchestrator | budgeted Helius replay; no silent provider spam |
| **G7** Liquidity dashboard | Dune allowlist + market observations; Bubblemaps still benchmark |

---

## 8. Failure modes and fallbacks (product matrix)

| Failure | User-visible state | Forbidden response |
| --- | --- | --- |
| Helius 429 / credit exhaust | CA chain sections unavailable/partial; warnings | invent holders from GMGN |
| Helius pagination incomplete | `PARTIAL`, accounting/concentration gates closed | `SUCCESS` with top page only |
| DexScreener down | market null + warning | $0 liq / $0 price |
| GMGN PARTIAL wallet fields | null metrics + parser warnings | fill 0 winrate / 0 pnl |
| Birdeye 401/429 | skip provider; next fallback | crash hot path |
| Rugcheck missing | hide borrowed risks; keep chain authorities | “safe” default |
| Bubblemaps inaccessible | hide embed; keep local cluster state | “no cluster” as confirmed safe |
| Dune SQL hash drift | fail closed macro cell | serve stale as fresh truth |
| Solscan Pro 401 | link to public page only | scrape HTML |

Source-degradation harness expectation: any single provider failure still yields a usable DEGRADED card with completeness &lt; 1, never a crash, never fake precision.

---

## 9. Evidence: project-local facts (non-web)

| Fact | Where it binds this matrix |
| --- | --- |
| Tier-A vs Tier-B rules | `PROJECT_ARCHITECTURE.md` §3 |
| CaScanResponse rejects B+confirmed | `docs/contracts/CA_SCAN_RESPONSE_V1.md` |
| Free provider ports force `unverified` | `src/infrastructure/providers/free-provider-ports.ts` |
| Live Helius pagination / fail closed | `src/infrastructure/solana/helius/live-helius-data-source.ts` |
| Market offline selection only | `src/infrastructure/market/observation-market-data-provider.ts`, `KNOWN_LIMITATIONS.md` |
| Helius-only live boundary | `OWNER_DECISIONS_NEEDED.md` item 18 |
| Free stack first | `OWNER_DECISIONS_NEEDED.md` items 8–11 |
| Holder pilot PARTIAL / concentration unverified | `docs/handoffs/STATUS_SYSTEM_20260730.md` |
| GMGN Tier-B usable pool not smart money | same + `NEXT_STAGE_EXECUTION_PLAN_20260730.md` |
| Macro Dune allowlist / hash | `src/infrastructure/dune/*`, macro designs |
| G0–G7 roadmap | `docs/handoffs/NEXT_STAGE_EXECUTION_PLAN_20260730.md` |

Public rate/price figures in this document are **planning estimates** as of access date **2026-07-31** and must be re-verified in a dedicated provider-pin task before automation.

---

## 10. Explicit non-goals

- This document does **not** authorize wiring new live providers.
- This document does **not** change CaScanResponse schema.
- This document does **not** promote Bubblemaps, GMGN, Birdeye, Rugcheck, DexScreener, Dune, or Solscan to Tier-A.
- This document does **not** treat PARTIAL holder pages as full universe success.
- This document does **not** allow third-party Top10 to override local holder universe semantics.
- This document does **not** allow null ratios to render as zero.

---

## 11. One-page operator checklist

```text
[ ] Chain facts (mint, supply, authorities, token accounts) → Helius/RPC + local gates
[ ] Market strip → DexScreener Tier-B only; source chip visible
[ ] Concentration → local universes only; else unverified + null ratio
[ ] GMGN/Birdeye labels → feature chips, never confirmed conclusions
[ ] Bubblemaps → external cross-check / benchmark, not confirmed cluster
[ ] Helius complete? pagination + conservation? else PARTIAL ≠ SUCCESS
[ ] Dune → macro/liquidity only with allowlisted query evidence
[ ] Solscan → link-out unless Owner buys Pro (still not Tier-A alone)
[ ] Any null metric → "—", never 0
[ ] Live multi-provider → Owner gate still closed unless explicitly flipped
```

---

## 12. Document control

| Item | Value |
| --- | --- |
| Path | `docs/research/PROVIDER_CAPABILITY_AND_TRUST_MATRIX_20260731.md` |
| Written for | Operator Console product research + UX trust encoding |
| Next expected consumer | `OPERATOR-CONSOLE-*` UX/spec tasks, market provider tasks, auditor checklists |
| Update trigger | Owner flips live multi-provider; paid plan purchase; parser major version; new provider pin |

**End of matrix.**
