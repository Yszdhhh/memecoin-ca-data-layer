# Current wave

## Objective

Mainline per `docs/audits/PROJECT_MAINLINE_RESET_AUDIT_2026-08-05.md` (PR #21):
parallel MVP of (1) SOL32+BSC30 observation-wallet structuring & value extraction,
(2) offline wallet replay v0.1, (3) 10–15 key-address chain fact verification,
(4) minimal CA judgment card, (5) incremental library/note refresh — with
macro/liquidity data-source research alongside. Governance is risk-tiered
(Fast/Standard/Strict per audit §5.4), not evidence-style-driven.

## Status as of 2026-08-09 (post-reset re-alignment + 3-branch merge)

| Workstream | Status | Notes |
| --- | --- | --- |
| Mainline reset audit | DONE / MERGED | PR #21; merge `8cbf661` |
| Wallet replay MVP v0.1 | DONE / MERGED | PR #22 (auto-merged on push); `wallet-replay-v0-1` CLI |
| Wallet identity library refresh | DONE / MERGED | PR #23 (auto-merged on push); `wallet-library:refresh` CLI |
| Wallet HUD v0.2 + Repair-002 | DONE / MERGED | Restored after 08-02 revert; merge `9676a0e` |
| Main integration gates | CRITICAL PASS | 2026-08-09: typecheck/test/build/security:scan PASS; 482 tests (481 pass / 0 fail / 1 manual-live skip); git diff --check clean; harness:doctor still FAIL on pre-existing tracked wallet*.json baseline (P2, see below) |
| SOL-CA-HOLDER-STABILITY-BATCHES-001 | CLOSED | PR #9 closed per audit §5.6 (SALVAGE_ONLY; code remains on branch) |
| WALLET-VALUE-EXTRACTION-20260809 | ACTIVE (private) | Build private library input (SOL 1433 + BSC 1034) → daily refresh → tiered snapshot / diffs / exports / bsc_label_review; outputs in `G:\chainfm_out\library_refresh`, never in Git |
| CA-CARD-ADAPTER-001 | ACTIVE | LiveHeliusDataSource audited methods (holder snapshot / pump creator / dev history) + adapter degradation for tags/facts |
| MACRO-DATA-SOURCE-RESEARCH-001 | ACTIVE (research) | Solana DEX activity / meme launch / liquidation data-source survey (free/ official APIs only) |

## ACTIVE

```text
WALLET-VALUE-EXTRACTION-20260809   (private execution; no Git write)
CA-CARD-ADAPTER-001                (implementation in progress)
MACRO-DATA-SOURCE-RESEARCH-001     (research in progress)
```

## NEXT

```text
CA-CARD-WIRING-001      (connect AnalysisService + AddressLibrary + deep-dive queue into live CA-first entry; depends on CA-CARD-ADAPTER-001)
WALLET-CHAIN-FACT-VERIFY-001   (10–15 key addresses; needs HELIUS_API_KEY — Owner gate)
MACRO-LIQUIDITY-DATA-LAYER-001 (depends on research outcome)
```

## AFTER

```text
LIBRARY-NOTE-REFRESH-LOOP-001   (incremental refresh + GMGN note workflow from replay/verify results)
OBSERVABILITY-BASELINE-001      (Parked until CA card wiring GREEN; was G1 next-step pre-reset)
```

## Overall

```text
MAINLINE_RESET_EXECUTION (per PROJECT_MAINLINE_RESET_AUDIT_2026-08-05)
Reset audit + replay MVP + library refresh + HUD restore = DONE / MERGED
Wallet value extraction = ACTIVE (private)
CA card adapter = ACTIVE; wiring = NEXT
Macro/liquidity research = ACTIVE
Overall ≠ CA card live-complete yet
Overall ≠ G2–G8 completed
Overall ≠ research prototype in production
Overall ≠ wallets chain-verified (Tier-B only until chain fact verification)
```

## DONE

```text
PROJECT-MAINLINE-RESET-AUDIT-001 (PR #21)
WALLET-REPLAY-MVP (PR #22)
WALLET-IDENTITY-LIBRARY-REFRESH (PR #23)
SOL-WALLET-HUD-V0-2-SCENE-STRENGTH restore + REPAIR-002 (merge 9676a0e)
OPERATOR-CONSOLE-LIVE-WIRING-001 (PR #8)
SOL-CA-HOLDER-HOTPATH-INTEGRATION-001 (PR #7)
OPERATOR-CONSOLE-SHELL-001 (PR #6)
M0-CA-CLEANING-MAIN-INTEGRATION-001 (PR #4)
G0
```

## PARKED

* 全量 1,433 / 1,034 重抓
* 全量累计 PnL（先 3–5 钱包链上账本，再扩容）
* 自动发现 / cron / 自动沉淀
* BSC / Robinhood 生产 adapter（BSC 私有离线只读观察不受阻）
* Live Shadow Trading / signing / broadcast
* 宏观 Dune 看板、生产 PostgreSQL/Redis Console 路径
* Claiming wallets are chain-verified（未做 10–15 地址事实复核前）

## Known harness baseline (not new)

* `harness:doctor` FAIL on 3 tracked `wallet*.json` (forbidden-pattern rule vs
  existing fixtures/manifests). PRs #19/#20 closed unfixed; audit §5.3/§10 says
  keep the secret/wallet scan but treat unrelated baseline as warning for
  non-code work. Not yet reflected in `harness/config/project.json`.
* 107 historical audit-evidence gaps + 57 unledgered specs = evidence-migration
  debt (audit §6.3), not product defects; archive, do not repair file-by-file.

## Retained smoke evidence

```text
Hotpath smoke = 2 public CA / 11 Helius requests
Browser Live smoke = 1 public CA / 6 of 10 requests
Auditor re-smoke = provider_shape_drift after 1 request
```

## Authority docs

| Doc | Path |
| --- | --- |
| Mainline reset audit | `docs/audits/PROJECT_MAINLINE_RESET_AUDIT_2026-08-05.md` |
| Reset inventory | `docs/audits/PROJECT_MAINLINE_RESET_INVENTORY_2026-08-05.json` |
| Reset diagrams | `docs/audits/PROJECT_MAINLINE_RESET_DIAGRAMS_2026-08-05.md` |
| Goal blueprint | `docs/blueprints/GOAL_EXECUTION_BLUEPRINT_V1.md` |
| Architecture (binding) | `PROJECT_ARCHITECTURE.md` |
| Wallet library refresh | `docs/WALLET_LIBRARY_REFRESH.md` |
| Wallet replay MVP | `docs/WALLET_REPLAY_MVP.md` |
| System status (pre-reset) | `docs/handoffs/STATUS_SYSTEM_20260730.md` |
