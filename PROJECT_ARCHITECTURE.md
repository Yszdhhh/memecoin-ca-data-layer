# Project architecture (binding)

This file is **binding**, at the same authority level as `PROJECT_CONSTITUTION.md`.
Every task spec, implementer, and auditor must respect it. Where a task
description conflicts with this file or the constitution, this file and the
constitution win. Its purpose is to keep independent agents from drifting away
from the product's core direction while implementing bounded tasks.

Source of direction: the Owner's 2026-07-26 blueprint and deep-research
documents (`docs/BLUEPRINT_REVISION_PROPOSAL_2026-07-26.md` records the
reconciliation).

## 1. What this product is (and is not)

It **is**: a CA-driven primary-market decision entrypoint + an address-intelligence
asset library + a historical-replay research engine. Paste a token CA (or a
wallet, or an old token) and get a fast, structured, actionable, replayable
on-chain research card, then sediment the wallets/relationships into a reusable,
reverse-searchable library.

It is **not**: a full-coverage on-chain data platform, a data lake, a trading/
signing/execution system, or a UI. It does not re-build data that stable third
parties already expose well; it builds the second-order abstraction on top.

Guiding sentence (Owner): **第三方提供事实数据，自建提供长期认知资产** — third
parties supply factual data; we supply the long-term cognitive asset.

## 2. The four layers (binding separation)

Every module belongs to exactly one layer. A task MUST declare its layer. Layers
do not reach across their boundary (e.g. the judgment layer never fetches live
data; the hot path never runs batch clustering).

1. **Input layer** — accepts CA, wallet address, forwarded Telegram/social
   messages, historical-token lists. Does chain resolution, address validation,
   cache lookup, concurrency dispatch. No reasoning.
2. **Hot path (second-scale)** — a bounded, low-latency first-screen judgment.
   Only a few dozen fields, a small bounded number of provider calls, minimal
   joins: market/pair, price/liquidity/volume, safety, holder concentration,
   top traders / smart-money / sniper / bundler, and **address-library hit
   results**. Target p95 < 2s. See §4 hot/cold rule.
3. **Cold path (sedimentation)** — asynchronous long-term asset formation:
   wallet DB, token history, wallet–token edges, cluster graph, profit
   leaderboards, behavior models. Batch replay, reconstruction, clustering.
4. **Judgment layer** — Alpha Score, cluster identification, sniper
   identification, tracking-value scoring. Consumes the sedimented data +
   first-hand evidence; produces explainable verdicts. Never fetches live data
   itself.

## 3. Data trust tiers (binding)

Classify every data element by trust-criticality; this decides whether it may be
borrowed.

- **Tier-B (borrowable — optimize for speed, tolerate non-reproducibility):**
  price / liquidity / FDV / pair, per-token profit leaderboards, platform wallet
  labels (GMGN Smart Money/Sniper/Bundler/Rat-Trader, Birdeye tags, Rugcheck
  insider graph), display holder snapshots. Sources: GMGN, Birdeye, Dexscreener,
  GoPlus/Honeypot/Rugcheck, Vybe, Dune. **Rule: Tier-B data is NEVER a source of
  on-chain fact.** On ingest it is stored with `source=<platform>` and
  `unverified=true`; it may not be promoted to a "confirmed" judgment until
  Tier-A confirms it. It enriches and hints; it never overrides chain facts
  (constitution rule 7).
- **Tier-A (must be first-hand — optimize for trust, must be reproducible):**
  raw swaps (buy/sell semantics), transfers, holder owner-aggregation, funding
  edges, Pump `create.creator`, first SOL funding source. Sources: Helius
  Enhanced + Solana RPC (idempotent, slot-watermarked); optional hardening via
  Shyft/Solscan. **Rule: a "confirmed" cluster / dev / independent-smart-money
  label may only be produced from Tier-A data by a versioned pure-function rule.**

**External labels are FEATURES, never conclusions.** GMGN/Birdeye/Rugcheck
labels are strong inputs to our detectors; the final verdict is our own scored,
evidenced, reversible output. Re-displaying a platform label as our conclusion is
a drift violation.

## 4. Hot/cold path rule (binding)

The hot path must stay fast: bounded field set, bounded provider fan-out
(target ≤ 4–6 calls per CA, respect provider rate limits — e.g. Birdeye wallet
APIs 5rps/75rpm, Helius free DAS 2rps), heavy caching. Anything requiring batch
history, relationship clustering, old-token recompute, profit-leaderboard
reconstruction, or LLM summarization belongs to the cold path and runs
asynchronously. A task that makes the first screen depend on slow SQL, long
serial API chains, or a large LLM summary is a drift violation and must fail its
latency harness (§6).

## 5. The address library is the asset (binding)

The differentiator is the self-sedimented address intelligence, not queryable
market data. Model per the blueprint's multi-dimensional profile — one address
may hold several labels at once:

- **Identity**: Human Trader / Bot / Sniper / KOL / Cluster member.
- **Capability**: Alpha ability, profitability, stability (→ Alpha Score tier).
- **Behavior**: early-sniping / swing / long-hold / arbitrage / copy-trading.
- **Relationship**: independent wallet / cluster relation / funding source.

Persist **wallet-level conclusions**, not raw swaps (store raw as reproducible
snapshot references). Every label carries `source`, `confidence`, `rule_version`,
and a reversible evidence snapshot (constitution rule 4). Self-computed
(Tier-A) confidence outranks borrowed (Tier-B). Minimal model: an `addresses`
master table + `token_analyses` snapshot table + `clusters` table (see the
blueprint §4 and the methods doc for the object schema token / pair / wallet /
wallet_token_edge / cluster_edge / observation).

**Label display priority** (when an address has conflicting labels): risk
(Insider / Cluster) > behavior (Sniper / Bot) > capability (UR/SSR/SR) > social
(KOL).

## 6. Harness must test like a trading tool, not an ETL job (binding)

Beyond the standard typecheck / unit / build / `git diff --check` acceptance,
the following four harness dimensions are required for tasks that touch the hot
path, providers, or detectors. A task that improves one axis but regresses
another (e.g. speeds the hot path but breaks graceful degradation, or adds a
detector that regresses label accuracy) fails. Detailed designs live in the
methods doc; the binding requirement is that they exist and gate the relevant
tasks:

1. **Latency harness** — CA → first-screen p50/p95, measured deterministically
   on fixtures with simulated provider latency; hot-path budget < 2s.
2. **Replay harness** — replays pinned old-token timelines; asserts the system
   reproduces the same holders / smart-money / cluster leads / safety signals.
3. **Source-degradation harness** — simulates any provider timing out or
   changing fields; asserts a usable DEGRADED result with warnings +
   completeness, never a crash or fake-precise value.
4. **Label-decision harness** — golden labeled cases; asserts detector
   false-positive / false-negative rates stay within a versioned tolerance.

## 7. Parser contract (binding)

All external text/JSON sources (Telegram forwards, bot output, screenshots/OCR,
platform JSON) pass through a **versioned parser** that emits the unified
observation schema (market / security / holder_concentration / wallet_signal /
promotion_and_social / call_source snapshots). When an external template
changes, modify ONLY the parser (bump `parser_version`); never couple raw
external text into the judgment engine. This is what makes replay possible and
keeps template churn from corrupting judgments.

## 8. Telegram / social is a hint layer, not a truth source (binding)

Telegram Bot API cannot receive messages from other bots even as admin with
privacy mode off. Do not architect a bot-scrapes-other-bots data spine.
Telegram/social supplies **hints** — first-caller, group participation, social
links, promotion/ad signals — ingested as `unverified` observations via the
parser, cross-checked against chain facts. Systematic group ingestion (TDLib /
user-client) carries account/ToS risk and is an Owner-gated decision, never a
"convenient side feature."

## 9. How this prevents drift (for auditors)

An auditor reviewing any task checks, in addition to the constitution: (a) the
task declares and stays within one layer; (b) it respects the hot/cold rule;
(c) Tier-B data is never promoted to fact and external labels are used as
features not conclusions; (d) address-library labels carry source/confidence/
rule_version/reversible evidence; (e) hot-path/provider/detector tasks pass the
relevant harness dimensions in §6; (f) external text goes through the versioned
parser. A violation of any binding rule here is at least a P2 finding.
