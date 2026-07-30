import assert from "node:assert/strict";
import test from "node:test";
import { composeCaAnalysisV1 } from "../../src/domain/rules/ca-analysis-composer-v1.js";
import { evaluatePoolEvidence } from "../../src/domain/rules/pool-evidence-registry-v1.js";
import {
  buildWalletTokenLedger,
  computeWalletPerformanceV1,
} from "../../src/domain/rules/wallet-token-ledger-v1.js";
import { formClustersV1 } from "../../src/domain/rules/cluster-engine-v1.js";
import { judgeCaFromEvidence } from "../../src/domain/rules/judgment-engine-v1.js";
import { buildLiquiditySnapshotV1, renderDailyBriefV1 } from "../../src/domain/rules/liquidity-metrics-v1.js";
import { mapDexScreenerPairToMarketSnapshot } from "../../src/infrastructure/market/dexscreener-market-adapter.js";
import { ProviderExecutor } from "../../src/application/provider-executor/provider-executor.js";
import { scrubValue } from "../../src/application/observability/structured-log.js";
import { JobQueue, ScheduleStore } from "../../src/application/orchestrator/job-queue.js";
import { LocalAddressStore } from "../../src/application/address-store/local-address-store.js";
import { mapTokenAuthorityObservation } from "../../src/domain/rules/token-authority-v1.js";
import { buildEarlyBuyerCohort } from "../../src/domain/rules/early-buyer-cohort-v1.js";
import {
  assertNoFutureLeak,
  calibrateBinaryThreshold,
  filterLabelsAsOf,
} from "../../src/domain/rules/replay-asof-v1.js";
import { assembleDevBehaviorV1 } from "../../src/domain/rules/creator-dev-facts-v1.js";
import { CrossCaArchive } from "../../src/domain/rules/cross-ca-archive-v1.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const env = (overrides: Partial<Parameters<typeof composeCaAnalysisV1>[0]> = {}) =>
  composeCaAnalysisV1({
    mint: "Mint1111111111111111111111111111111111111",
    symbol: "TEST",
    name: "Test",
    observedAt: "2026-07-30T00:00:00.000Z",
    holder: {
      accountingEligible: true,
      exclusionCoverage: "partial",
      concentrationEligible: false,
      paginationComplete: true,
      residualRatio: 0.01,
      ownerCounts: { total: 10, included: 8, excluded: 1, unresolved: 1 },
      concentration: [
        {
          name: "top10",
          numerator: "50",
          denominator: "100",
          ratio: null,
          verificationStatus: "unverified",
        },
      ],
      evidence: {
        source: "helius",
        tier: "A",
        verificationStatus: "partial",
        observedAt: "2026-07-30T00:00:00.000Z",
        sourceWatermark: "slot:1",
        completeness: 0.9,
        ruleVersion: "holder-v1",
        evidenceRefs: ["holder:1"],
        warnings: [],
      },
    },
    market: {
      priceUsd: 0.001,
      liquidityUsd: 1000,
      fdvUsd: 10000,
      volume24hUsd: 500,
      pairAddress: "Pair111",
      pairAgeHours: 12,
      evidence: {
        source: "DEXSCREENER",
        tier: "B",
        verificationStatus: "unverified",
        observedAt: "2026-07-30T00:00:00.000Z",
        sourceWatermark: null,
        completeness: 0.8,
        ruleVersion: null,
        evidenceRefs: ["dex:1"],
        warnings: [],
      },
    },
    authority: {
      mintAuthority: "Auth111",
      freezeAuthority: null,
      decimals: 6,
      supplyRaw: "1000000",
      program: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      evidence: {
        source: "helius",
        tier: "A",
        verificationStatus: "confirmed",
        observedAt: "2026-07-30T00:00:00.000Z",
        sourceWatermark: "slot:1",
        completeness: 1,
        ruleVersion: null,
        evidenceRefs: ["mint:1"],
        warnings: [],
      },
    },
    pool: null,
    addressHits: null,
    ...overrides,
  });

test("composer marks overall partial when exclusion incomplete", () => {
  const card = env();
  assert.equal(card.schemaVersion, "CaAnalysisResponseV2");
  assert.equal(card.dataQuality.overall, "partial");
  assert.equal(card.market.trust, "unverified");
  assert.ok(card.disclaimers.some((d) => /not trade/i.test(d)));
  assert.ok(card.researchPriority.some((p) => p.dimension === "data_quality"));
});

test("pool evidence requires hard program owner for confirmed exclusion", () => {
  const soft = evaluatePoolEvidence([{ address: "PoolSoft", programOwner: null, clueSource: "dexscreener" }]);
  assert.equal(soft.coverage, "partial");
  assert.equal(soft.pools[0]?.exclusionStrength, "soft");
  assert.ok(soft.warnings.some((w) => /no_hard/.test(w)));

  const hard = evaluatePoolEvidence([
    {
      address: "Bonding1",
      programOwner: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    },
  ]);
  assert.equal(hard.coverage, "complete");
  assert.equal(hard.pools[0]?.exclusionStrength, "hard");
});

test("wallet ledger conserves amounts and withholds PnL without cost basis", () => {
  const ledger = buildWalletTokenLedger({
    wallet: "Wallet1",
    tokenMint: "Mint1",
    events: [
      {
        signature: "sig1",
        slot: 1,
        blockTime: "2026-07-01T00:00:00.000Z",
        tokenMint: "Mint1",
        eventType: "transfer_in",
        amountDeltaRaw: "100",
        quoteMint: null,
        quoteDeltaRaw: null,
        counterparty: "A",
        completeness: "complete",
      },
      {
        signature: "sig2",
        slot: 2,
        blockTime: "2026-07-02T00:00:00.000Z",
        tokenMint: "Mint1",
        eventType: "transfer_out",
        amountDeltaRaw: "-40",
        quoteMint: null,
        quoteDeltaRaw: null,
        counterparty: "B",
        completeness: "complete",
      },
    ],
  });
  assert.equal(ledger.openBalanceRaw, "60");
  assert.equal(ledger.conservationOk, true);

  const pnl = computeWalletPerformanceV1({ ledger });
  assert.equal(pnl.realizedPnlQuote, null);
  assert.equal(pnl.completeness, "unavailable");
  assert.ok(pnl.warnings.includes("cost_basis_unknown"));
});

test("cluster engine never confirms single weak edge", () => {
  const clusters = formClustersV1([
    {
      from: "A",
      to: "B",
      edgeType: "same_window",
      weight: 0.2,
      source: "derived",
      evidenceRef: "e1",
    },
  ]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]!.status, "coincidental");
});

test("judgment engine is fail-closed on incomplete holders", () => {
  const j = judgeCaFromEvidence({
    mint: "M",
    accountingEligible: false,
    concentrationEligible: false,
    mintAuthorityPresent: true,
    poolCoverage: "partial",
    liquidityUsd: 1000,
    addressHitCount: 0,
    paginationComplete: false,
  });
  assert.ok(j.dimensions.some((d) => d.dimension === "holders" && d.verdict === "insufficient_data"));
  assert.ok(j.disclaimers.some((d) => /not trade/i.test(d)));
});

test("liquidity snapshot withholds composite when parts missing", () => {
  const snap = buildLiquiditySnapshotV1([
    {
      observedAt: "2026-07-30T00:00:00.000Z",
      dexVolumeUsd: 1_000_000,
      swapCount: null,
      activeAddresses: null,
      newTokens: null,
      graduatedTokens: null,
      newPools: null,
      protocolRevenueUsd: null,
      source: "fixture",
      freshness: "fresh",
    },
  ]);
  assert.equal(snap.metrics.compositeLevel, null);
  assert.ok(snap.warnings.includes("composite_withheld_insufficient_parts"));
  const md = renderDailyBriefV1(snap);
  assert.match(md, /Liquidity Daily Brief/);
  assert.match(md, /null/);
});

test("dexscreener mapper never invents price and tags Tier-B unverified", () => {
  const empty = mapDexScreenerPairToMarketSnapshot("Mint", null);
  assert.equal(empty.priceUsd, null);
  assert.equal(empty.verificationStatus, "unverified");
  assert.equal(empty.source, "DEXSCREENER");

  const ok = mapDexScreenerPairToMarketSnapshot("Mint", {
    pairAddress: "Pair",
    priceUsd: "1.5",
    liquidity: { usd: 9000 },
    volume: { h24: 100 },
    fdv: 50_000,
  });
  assert.equal(ok.priceUsd, 1.5);
  assert.equal(ok.liquidityUsd, 9000);
  assert.equal(ok.tier, "B");
});

test("provider executor hard-stops on budget", async () => {
  const ex = new ProviderExecutor({ taskId: "t", budget: 2, maxRetries: 0 });
  const a = await ex.execute("dex", "p1", async () => 1);
  const b = await ex.execute("dex", "p2", async () => 2);
  const c = await ex.execute("dex", "p3", async () => 3);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(c.ok, false);
  if (!c.ok) assert.equal(c.errorClass, "budget_exhausted");
});

test("structured log scrub strips secrets", () => {
  const cleaned = scrubValue({
    apiKey: "SECRET",
    url: "https://example.com?api_key=abc&x=1",
    ok: true,
  }) as Record<string, unknown>;
  assert.equal(cleaned.apiKey, "***");
  assert.match(String(cleaned.url), /\*\*\*/);
  assert.equal(cleaned.ok, true);
});

test("job queue idempotent enqueue and schedule forbids full market", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobq-"));
  const q = new JobQueue({ dataDir: dir });
  const j1 = q.enqueue("ca_holder", { mint: "M1" }, 10);
  const j2 = q.enqueue("ca_holder", { mint: "M1" }, 10);
  assert.equal(j1.jobId, j2.jobId);
  const worker = q.claim("w1");
  assert.ok(worker);
  q.complete(worker!.jobId, "out:1", 3);

  const schedules = new ScheduleStore(dir);
  assert.throws(() => schedules.create({ type: "full_market_scan", subjects: ["*"], intervalHours: 24, budgetPerRun: 1 }), /forbidden|subjects/);
  const s = schedules.create({ type: "ca_watch", subjects: ["M1"], intervalHours: 24, budgetPerRun: 5, enabled: false });
  assert.equal(s.enabled, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("token authority mapper does not invent fields", () => {
  const bad = mapTokenAuthorityObservation({ mint: "M", decimals: "nope", supplyRaw: "abc" });
  assert.equal(bad.decimals, null);
  assert.equal(bad.supplyRaw, null);
  assert.ok(bad.warnings.includes("decimals_parse_failed"));

  const ok = mapTokenAuthorityObservation({
    mint: "Mint1111111111111111111111111111111111111",
    decimals: 6,
    supplyRaw: "1000",
    program: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    mintAuthority: null,
    freezeAuthority: null,
  });
  assert.equal(ok.verificationStatus, "confirmed");
  assert.equal(ok.mintAuthority, null);
  assert.equal(ok.fieldSources.decimals, "helius");
});

test("early buyer cohort does not force sell when disposition unknown", () => {
  const c = buildEarlyBuyerCohort({
    mint: "M",
    events: [
      {
        buyer: "B1",
        signature: "s1",
        slot: 1,
        blockTime: null,
        amountRaw: "10",
        dispositionKnown: false,
        stillHoldingRaw: null,
        transferredOutRaw: null,
        soldRaw: null,
      },
    ],
  });
  assert.equal(c.buyers[0]!.disposition, "unknown");
  assert.equal(c.completeness, "partial");
});

test("replay as-of rejects future labels and withholds calibration without samples", () => {
  const labels = filterLabelsAsOf(
    [
      { label: "x", observedAt: "2026-01-01T00:00:00.000Z", verificationStatus: "unverified" },
      { label: "y", observedAt: "2026-06-01T00:00:00.000Z", verificationStatus: "unverified" },
    ],
    "2026-03-01T00:00:00.000Z",
  );
  assert.equal(labels.length, 1);
  const leak = assertNoFutureLeak({
    decisionAt: "2026-03-01T00:00:00.000Z",
    subjectId: "M",
    features: {},
    labelsAsOf: [{ label: "future", observedAt: "2026-04-01T00:00:00.000Z", verificationStatus: "unverified" }],
  });
  assert.equal(leak.ok, false);
  const cal = calibrateBinaryThreshold([{ score: 1, positive: true }]);
  assert.equal(cal.threshold, null);
  assert.ok(cal.warnings.includes("insufficient_samples_for_calibration"));
});

test("creator-dev requires signature evidence", () => {
  const noSig = assembleDevBehaviorV1({
    mint: "M",
    creatorCandidate: "C1",
    creatorEvidence: null,
    events: [],
  });
  assert.equal(noSig.creator, null);
  assert.ok(noSig.warnings.includes("creator_without_signature_evidence"));

  const ok = assembleDevBehaviorV1({
    mint: "M",
    creatorCandidate: "Creator1111111111111111111111111111111",
    creatorEvidence: { signature: "Sig111", account: "Creator1111111111111111111111111111111" },
    events: [
      {
        kind: "allocation",
        signature: "A1",
        account: "Creator1111111111111111111111111111111",
        slot: 1,
        blockTime: null,
        amountRaw: "10",
        counterparty: null,
      },
    ],
  });
  assert.equal(ok.creator, "Creator1111111111111111111111111111111");
  assert.equal(ok.verificationStatus, "confirmed");
});

test("cross-ca archive is local-only reverse index", () => {
  const a = new CrossCaArchive();
  a.addHit({
    wallet: "W1",
    mint: "M1",
    role: "holder",
    observedAt: "2026-01-01T00:00:00.000Z",
    result: "profit",
    evidenceRef: "e1",
  });
  a.addHit({
    wallet: "W1",
    mint: "M2",
    role: "early_buyer",
    observedAt: "2026-02-01T00:00:00.000Z",
    result: "profit",
    evidenceRef: "e2",
  });
  const q = a.queryByWallet("W1");
  assert.equal(q.walletToTokens[0]?.mints.length, 2);
  assert.equal(q.repeatWinners[0]?.profitHits, 2);
});

test("address store import is Tier-B unverified and hit is local set intersection", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "addr-"));
  const store = new LocalAddressStore(dir);
  const file = path.join(dir, "in.json");
  fs.writeFileSync(
    file,
    JSON.stringify([
      { address: "WalletHit1111111111111111111111111111111", labels: ["usable_pool"] },
      { address: "WalletOther11111111111111111111111111111", labels: ["usable_pool"] },
    ]),
    "utf8",
  );
  const summary = store.importFromLocalFile(file);
  assert.equal(summary.imported, 2);
  assert.match(summary.irreversibleDigest, /^[a-f0-9]{64}$/);
  const hits = store.hitOwners(["WalletHit1111111111111111111111111111111", "Unknown"]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.labels[0]!.verificationStatus, "unverified");
  assert.equal(hits[0]!.labels[0]!.tier, "B");
  fs.rmSync(dir, { recursive: true, force: true });
});
