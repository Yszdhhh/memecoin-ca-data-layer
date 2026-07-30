/**
 * Offline product backend: wires pure rules + local stores for browser-operable console.
 * No Live provider calls. Seeds demo fixtures only.
 */

import path from "node:path";
import { LocalAddressStore } from "../address-store/local-address-store.js";
import { JobQueue, ScheduleStore } from "../orchestrator/job-queue.js";
import { composeCaAnalysisV1, type CaAnalysisResponseV2 } from "../../domain/rules/ca-analysis-composer-v1.js";
import { mapTokenAuthorityObservation } from "../../domain/rules/token-authority-v1.js";
import { evaluatePoolEvidence } from "../../domain/rules/pool-evidence-registry-v1.js";
import { mapDexScreenerPairToMarketSnapshot } from "../../infrastructure/market/dexscreener-market-adapter.js";
import {
  buildLiquiditySnapshotV1,
  renderDailyBriefV1,
  type LiquidityRawPoint,
  type LiquiditySnapshotV1,
} from "../../domain/rules/liquidity-metrics-v1.js";
import { assembleDevBehaviorV1, type DevBehaviorV1 } from "../../domain/rules/creator-dev-facts-v1.js";
import { CrossCaArchive, type CrossTokenMatchV1 } from "../../domain/rules/cross-ca-archive-v1.js";
import { buildEarlyBuyerCohort } from "../../domain/rules/early-buyer-cohort-v1.js";
import { formClustersV1 } from "../../domain/rules/cluster-engine-v1.js";
import { judgeCaFromEvidence } from "../../domain/rules/judgment-engine-v1.js";
import {
  buildWalletTokenLedger,
  computeWalletPerformanceV1,
  type WalletTokenLedgerV1,
  type WalletPerformanceV1,
} from "../../domain/rules/wallet-token-ledger-v1.js";
import {
  assertNoFutureLeak,
  calibrateBinaryThreshold,
  filterLabelsAsOf,
  type CalibrationReport,
} from "../../domain/rules/replay-asof-v1.js";

const DEMO_MINT = "H3GtwGSrYRVqp7dtjkaDfjE2inydLkHwFkFJSPzrpump";
const DEMO_WALLET_A = "So11111111111111111111111111111111111111112";
const DEMO_WALLET_B = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const DEMO_WALLET_C = "11111111111111111111111111111111";

export interface OfflineBackendOptions {
  dataDir: string;
}

export class OfflineBackend {
  readonly addresses: LocalAddressStore;
  readonly jobs: JobQueue;
  readonly schedules: ScheduleStore;
  readonly archive: CrossCaArchive;
  private liquidityHistory: LiquidityRawPoint[] = [];
  private caCards = new Map<string, CaAnalysisResponseV2>();
  private devByMint = new Map<string, DevBehaviorV1>();
  private ledgers = new Map<string, { ledger: WalletTokenLedgerV1; performance: WalletPerformanceV1 }>();

  constructor(options: OfflineBackendOptions) {
    this.addresses = new LocalAddressStore(path.join(options.dataDir, "addresses"));
    this.jobs = new JobQueue({ dataDir: path.join(options.dataDir, "jobs") });
    this.schedules = new ScheduleStore(path.join(options.dataDir, "schedules"));
    this.archive = new CrossCaArchive();
    this.seed();
  }

  private seed(): void {
    if (this.addresses.count() === 0) {
      for (const [addr, labels] of [
        [DEMO_WALLET_A, ["tierb_usable_pool", "demo_shortlist"]],
        [DEMO_WALLET_B, ["tierb_usable_pool"]],
        [DEMO_WALLET_C, ["manual_review"]],
      ] as const) {
        for (const lab of labels) {
          this.addresses.upsertLabel(addr, {
            label: lab,
            source: "offline_seed",
            tier: "B",
            confidence: 0.5,
            verificationStatus: "unverified",
            note: "Offline seed — Tier-B only",
          });
        }
      }
      this.addresses.save();
    }

    this.liquidityHistory = [
      {
        observedAt: "2026-07-24T00:00:00.000Z",
        dexVolumeUsd: 9_000_000,
        swapCount: 300_000,
        activeAddresses: 70_000,
        newTokens: 900,
        graduatedTokens: 30,
        newPools: 700,
        protocolRevenueUsd: 40_000,
        source: "offline_fixture",
        freshness: "fresh",
      },
      {
        observedAt: "2026-07-27T00:00:00.000Z",
        dexVolumeUsd: 11_000_000,
        swapCount: 380_000,
        activeAddresses: 80_000,
        newTokens: 1100,
        graduatedTokens: 40,
        newPools: 850,
        protocolRevenueUsd: 55_000,
        source: "offline_fixture",
        freshness: "fresh",
      },
      {
        observedAt: "2026-07-30T00:00:00.000Z",
        dexVolumeUsd: 12_500_000,
        swapCount: 420_000,
        activeAddresses: 88_000,
        newTokens: 1200,
        graduatedTokens: 45,
        newPools: 900,
        protocolRevenueUsd: null,
        source: "offline_fixture",
        freshness: "stale",
      },
    ];

    // Seed CA analysis card via shipped composer (not hardcoded response).
    this.caCards.set(DEMO_MINT, this.composeDemoCa(DEMO_MINT));

    const dev = assembleDevBehaviorV1({
      mint: DEMO_MINT,
      creatorCandidate: DEMO_WALLET_C,
      creatorEvidence: { signature: "DemoCreateSig11111111111111111111111111111", account: DEMO_WALLET_C },
      events: [
        {
          kind: "allocation",
          signature: "DemoAllocSig11111111111111111111111111111",
          account: DEMO_WALLET_C,
          slot: 100,
          blockTime: "2026-07-01T00:00:00.000Z",
          amountRaw: "1000000",
          counterparty: null,
        },
        {
          kind: "transfer",
          signature: "DemoXferSig111111111111111111111111111111",
          account: DEMO_WALLET_C,
          slot: 200,
          blockTime: "2026-07-02T00:00:00.000Z",
          amountRaw: "100000",
          counterparty: DEMO_WALLET_A,
        },
      ],
      currentHoldingsRaw: "900000",
    });
    this.devByMint.set(DEMO_MINT, dev);

    this.archive.addHit({
      wallet: DEMO_WALLET_A,
      mint: DEMO_MINT,
      role: "early_buyer",
      observedAt: "2026-07-01T00:00:00.000Z",
      result: "profit",
      evidenceRef: "seed:early",
    });
    this.archive.addHit({
      wallet: DEMO_WALLET_A,
      mint: "OtherMint1111111111111111111111111111111",
      role: "holder",
      observedAt: "2026-06-01T00:00:00.000Z",
      result: "profit",
      evidenceRef: "seed:hist",
    });
    this.archive.addHit({
      wallet: DEMO_WALLET_B,
      mint: DEMO_MINT,
      role: "holder",
      observedAt: "2026-07-01T00:00:00.000Z",
      result: "unknown",
      evidenceRef: "seed:hold",
    });
    this.archive.addCluster("cluster-demo-1", [DEMO_WALLET_A, DEMO_WALLET_B]);

    const ledger = buildWalletTokenLedger({
      wallet: DEMO_WALLET_A,
      tokenMint: DEMO_MINT,
      events: [
        {
          signature: "w1",
          slot: 1,
          blockTime: "2026-07-01T00:00:00.000Z",
          tokenMint: DEMO_MINT,
          eventType: "swap",
          amountDeltaRaw: "100",
          quoteMint: "So11111111111111111111111111111111111111112",
          quoteDeltaRaw: "-2",
          counterparty: "pool",
          completeness: "complete",
        },
        {
          signature: "w2",
          slot: 2,
          blockTime: "2026-07-03T00:00:00.000Z",
          tokenMint: DEMO_MINT,
          eventType: "swap",
          amountDeltaRaw: "-40",
          quoteMint: "So11111111111111111111111111111111111111112",
          quoteDeltaRaw: "3",
          counterparty: "pool",
          completeness: "complete",
        },
      ],
    });
    const performance = computeWalletPerformanceV1({ ledger, markPrice: 0.05, decimals: 0 });
    this.ledgers.set(DEMO_WALLET_A, { ledger, performance });

    if (this.jobs.list(1).length === 0) {
      this.jobs.enqueue("ca_analysis_offline", { mint: DEMO_MINT }, 5);
      const j = this.jobs.claim("seed-worker");
      if (j) {
        this.jobs.markRunning(j.jobId);
        this.jobs.complete(j.jobId, `ca-card:${DEMO_MINT}`, 0, false);
      }
    }
  }

  composeDemoCa(mint: string): CaAnalysisResponseV2 {
    const market = mapDexScreenerPairToMarketSnapshot(mint, {
      pairAddress: "DemoPair1111111111111111111111111111111",
      priceUsd: "0.0012",
      fdv: 120_000,
      liquidity: { usd: 18_000 },
      volume: { h24: 45_000 },
      pairCreatedAt: Date.parse("2026-07-20T00:00:00.000Z"),
      url: "https://dexscreener.com/solana/demo",
    }, "2026-07-30T12:00:00.000Z");

    const authority = mapTokenAuthorityObservation({
      mint,
      decimals: 6,
      supplyRaw: "1000000000000",
      program: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      mintAuthority: null,
      freezeAuthority: null,
      observedAt: "2026-07-30T12:00:00.000Z",
      source: "offline_fixture",
      sourceWatermark: "slot:fixture",
    });

    const pool = evaluatePoolEvidence([
      {
        address: "DemoBonding11111111111111111111111111111",
        programOwner: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
      },
      {
        address: "DemoSoftPair111111111111111111111111111",
        programOwner: null,
        clueSource: "dexscreener",
      },
    ]);

    const hits = this.addresses.hitOwners([DEMO_WALLET_A, DEMO_WALLET_B]);

    return composeCaAnalysisV1({
      mint,
      symbol: "DEMO",
      name: "Offline Demo CA",
      observedAt: "2026-07-30T12:00:00.000Z",
      holder: {
        accountingEligible: true,
        exclusionCoverage: pool.coverage === "complete" ? "complete" : "partial",
        concentrationEligible: pool.coverage === "complete",
        paginationComplete: true,
        residualRatio: 0,
        ownerCounts: { total: 12, included: 9, excluded: 2, unresolved: 1 },
        concentration: [
          {
            name: "top10",
            numerator: "400",
            denominator: "1000",
            ratio: pool.coverage === "complete" ? 0.4 : null,
            verificationStatus: pool.coverage === "complete" ? "confirmed" : "unverified",
          },
        ],
        evidence: {
          source: "offline_fixture",
          tier: "A",
          verificationStatus: "partial",
          observedAt: "2026-07-30T12:00:00.000Z",
          sourceWatermark: "slot:fixture",
          completeness: 0.95,
          ruleVersion: "holder-offline-v1",
          evidenceRefs: ["fixture:holders"],
          warnings: pool.warnings,
        },
      },
      market: {
        priceUsd: market.priceUsd,
        liquidityUsd: market.liquidityUsd,
        fdvUsd: market.fdvUsd,
        volume24hUsd: market.volume24hUsd,
        pairAddress: market.pairAddress,
        pairAgeHours: market.pairAgeHours,
        evidence: {
          source: market.source,
          tier: "B",
          verificationStatus: "unverified",
          observedAt: market.observedAt,
          sourceWatermark: null,
          completeness: market.completeness,
          ruleVersion: market.adapterVersion,
          evidenceRefs: market.pairAddress ? [`pair:${market.pairAddress}`] : [],
          warnings: market.warnings,
        },
      },
      authority: {
        mintAuthority: authority.mintAuthority,
        freezeAuthority: authority.freezeAuthority,
        decimals: authority.decimals,
        supplyRaw: authority.supplyRaw,
        program: authority.program,
        evidence: {
          source: authority.source,
          tier: "A",
          verificationStatus: authority.verificationStatus,
          observedAt: authority.observedAt,
          sourceWatermark: authority.sourceWatermark,
          completeness: authority.verificationStatus === "confirmed" ? 1 : 0.5,
          ruleVersion: authority.ruleVersion,
          evidenceRefs: Object.keys(authority.fieldSources).map((k) => `field:${k}`),
          warnings: authority.warnings,
        },
      },
      pool: {
        pools: pool.pools.map((p) => ({
          address: p.address,
          programOwner: p.programOwner,
          role: p.role,
          exclusionStrength: p.exclusionStrength,
        })),
        coverage: pool.coverage,
        evidence: {
          source: "pool_registry",
          tier: "A",
          verificationStatus: pool.coverage === "complete" ? "confirmed" : "partial",
          observedAt: "2026-07-30T12:00:00.000Z",
          sourceWatermark: null,
          completeness: pool.coverage === "complete" ? 1 : 0.5,
          ruleVersion: pool.ruleVersion,
          evidenceRefs: pool.pools.flatMap((p) => p.evidenceRefs),
          warnings: pool.warnings,
        },
      },
      addressHits: {
        hits: hits.map((h) => ({
          owner: h.owner,
          labels: h.labels.map((l) => l.label),
          verificationStatus: h.verificationStatus === "confirmed" ? "confirmed" : "unverified",
          tier: h.tier,
        })),
        evidence: {
          source: "local_address_store",
          tier: "DERIVED",
          verificationStatus: "unverified",
          observedAt: "2026-07-30T12:00:00.000Z",
          sourceWatermark: null,
          completeness: 1,
          ruleVersion: "ca-address-hit-v1",
          evidenceRefs: ["address_store:local"],
          warnings: [],
        },
      },
    });
  }

  getLiquidityLatest(): { snapshot: LiquiditySnapshotV1; briefMarkdown: string } {
    const snapshot = buildLiquiditySnapshotV1(this.liquidityHistory);
    return { snapshot, briefMarkdown: renderDailyBriefV1(snapshot) };
  }

  getLiquidityHistory(): LiquidityRawPoint[] {
    return this.liquidityHistory;
  }

  listAddresses(q?: string) {
    return this.addresses.search(q ?? "", 100).map((r) => ({
      id: r.address,
      display: r.alias ?? `${r.address.slice(0, 4)}…${r.address.slice(-4)}`,
      labels: r.labels
        .filter((l) => l.validTo === null)
        .map((l) => ({
          label: l.label,
          source: l.source,
          confidence: l.confidence,
          verificationStatus: l.verificationStatus,
          tier: l.tier,
        })),
      note: r.labels.find((l) => l.validTo === null && l.note)?.note ?? "",
      reviewStatus: r.reviewStatus,
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
    }));
  }

  addLabel(input: {
    address: string;
    label: string;
    note?: string;
    confidence?: number;
    source?: string;
  }) {
    if (!input.address || input.address.length < 32) throw new Error("invalid_address");
    if (!input.label.trim()) throw new Error("label_required");
    const rec = this.addresses.upsertLabel(input.address, {
      label: input.label.trim(),
      source: input.source ?? "manual_operator",
      tier: "B",
      confidence: input.confidence ?? 0.7,
      verificationStatus: "unverified",
      ...(input.note !== undefined ? { note: input.note } : {}),
    });
    this.addresses.save();
    return rec;
  }

  listWallets() {
    const rows = this.addresses.search("", 200);
    const items = rows.map((r) => {
      const active = r.labels.filter((l) => l.validTo === null);
      const shortlist = active.some((l) => /shortlist/i.test(l.label));
      const review = r.reviewStatus === "queued" || active.some((l) => /review/i.test(l.label));
      return {
        id: r.address,
        fingerprint: `${r.address.slice(0, 4)}…${r.address.slice(-4)}`,
        tier: shortlist ? "tierb_shortlist" : review ? "manual_review" : "tierb_usable",
        status7d: "UNVERIFIED",
        status30d: "UNVERIFIED",
        completeness: 0.5,
        warnings: ["tier_b_observation_only"],
        verificationStatus: "unverified" as const,
      };
    });
    return {
      summary: {
        alpha: 0,
        tierBUsablePool: items.length,
        tierBShortlist: items.filter((i) => i.tier === "tierb_shortlist").length,
        manualReview: items.filter((i) => i.tier === "manual_review").length,
        unavailablePeriodWallets: 0,
        mapped: 0,
        partialApproxPct: 0,
        source: "local_address_store",
        verificationStatus: "unverified",
        disclaimer: "Tier-B local labels only — not Alpha / confirmed smart money. Live PnL Owner-gated.",
        observedAt: new Date().toISOString(),
        wallets: items,
      },
      items,
    };
  }

  getWallet(address: string) {
    const rec = this.addresses.get(address);
    if (!rec) return null;
    const active = rec.labels.filter((l) => l.validTo === null);
    const pack = this.ledgers.get(address);
    const cross = this.archive.queryByWallet(address);
    return {
      id: rec.address,
      fingerprint: `${rec.address.slice(0, 4)}…${rec.address.slice(-4)}`,
      tier: active.some((l) => /shortlist/i.test(l.label)) ? "tierb_shortlist" : "tierb_usable",
      status7d: "UNVERIFIED",
      status30d: "UNVERIFIED",
      completeness: pack ? (pack.ledger.completeness === "complete" ? 1 : 0.6) : 0.4,
      warnings: pack?.performance.warnings ?? ["no_ledger"],
      verificationStatus: "unverified" as const,
      disclaimer: "Chain ledger offline fixture when present; GMGN not used as confirmed PnL.",
      observedAt: rec.lastSeen,
      caHitsPlaceholder: cross.walletToTokens[0]?.mints.join(", ") || "none",
      labels: active.map((l) => ({
        label: l.label,
        source: l.source,
        confidence: l.confidence,
        verificationStatus: l.verificationStatus,
      })),
      note: active.find((l) => l.note)?.note ?? "",
      ledger: pack?.ledger ?? null,
      performance: pack?.performance ?? null,
      crossCa: cross,
    };
  }

  listCaScans() {
    return [...this.caCards.values()].map((c) => ({
      mint: c.mint,
      status: c.dataQuality.overall === "confirmed" ? "OK" : c.dataQuality.overall === "partial" ? "PARTIAL" : "REJECTED",
      symbol: c.symbol,
      name: c.name,
      accountingEligible: c.dataQuality.accountingEligible ?? false,
      exclusionCoverage: c.dataQuality.exclusionCoverage ?? "unavailable",
      concentrationEligible: c.dataQuality.concentrationEligible ?? false,
      observedAt: c.observedAt,
      dataSource: "offline_composer",
    }));
  }

  getCaScan(mint: string) {
    const card = this.caCards.get(mint) ?? (mint === DEMO_MINT ? this.composeDemoCa(mint) : null);
    if (!card) return null;
    this.caCards.set(mint, card);
    const concentration: Record<string, { numerator: string; denominator: string; ratio: number | null; verificationStatus: "confirmed" | "unverified" }> = {};
    for (const row of card.concentration ?? []) {
      concentration[row.name] = {
        numerator: row.numerator,
        denominator: row.denominator,
        ratio: row.ratio,
        verificationStatus: row.verificationStatus,
      };
    }
    return {
      mint: card.mint,
      status: card.dataQuality.overall === "confirmed" ? "OK" : "PARTIAL",
      symbol: card.symbol,
      name: card.name,
      accountingEligible: card.dataQuality.accountingEligible ?? false,
      exclusionCoverage: card.dataQuality.exclusionCoverage ?? "unavailable",
      concentrationEligible: card.dataQuality.concentrationEligible ?? false,
      observedAt: card.observedAt,
      dataSource: "offline_composer",
      decimals: card.identity.decimals,
      mintSupplyRaw: card.identity.supplyRaw,
      sourceWatermark: "offline",
      provider: "offline",
      judgmentEligibleDeprecated: card.dataQuality.accountingEligible ?? false,
      accounting: {
        mintSupplyRaw: card.identity.supplyRaw ?? "0",
        enumeratedTokenAccountBalanceRaw: "0",
        includedOwnerBalanceRaw: "0",
        excludedBalanceRaw: "0",
        unresolvedBalanceRaw: "0",
        accountingResidualRaw: "0",
        accountingResidualRatio: card.dataQuality.residualRatio,
        completeness: card.dataQuality.overall,
        paginationComplete: card.dataQuality.paginationComplete ?? false,
        residualReasons: card.dataQuality.warnings,
        identity: "offline_composer",
      },
      ownerCounts: {
        total: card.holders?.total ?? 0,
        included: card.holders?.included ?? 0,
        excluded: card.holders?.excluded ?? 0,
        unresolved: card.holders?.unresolved ?? 0,
        tokenAccounts: card.holders?.total ?? 0,
      },
      paginationComplete: card.dataQuality.paginationComplete ?? false,
      concentration,
      concentrationWarnings: card.dataQuality.warnings,
      issues: card.dataQuality.warnings.map((w) => ({
        code: w,
        severity: "info",
        whetherManualReviewRequired: true,
      })),
      universeDefinition: "cleaned_holder_universe",
      analysis: card,
      dev: this.devByMint.get(mint) ?? null,
      earlyBuyers: buildEarlyBuyerCohort({
        mint,
        events: [
          {
            buyer: DEMO_WALLET_A,
            signature: "Early1",
            slot: 10,
            blockTime: "2026-07-01T00:01:00.000Z",
            amountRaw: "50",
            dispositionKnown: false,
            stillHoldingRaw: null,
            transferredOutRaw: null,
            soldRaw: null,
          },
        ],
      }),
      clusters: formClustersV1([
        {
          from: DEMO_WALLET_A,
          to: DEMO_WALLET_B,
          edgeType: "common_token",
          weight: 0.4,
          source: "offline",
          evidenceRef: "seed:edge",
        },
        {
          from: DEMO_WALLET_A,
          to: DEMO_WALLET_B,
          edgeType: "same_window",
          weight: 0.5,
          source: "offline",
          evidenceRef: "seed:window",
        },
      ]),
      judgment: judgeCaFromEvidence({
        mint,
        accountingEligible: card.dataQuality.accountingEligible,
        concentrationEligible: card.dataQuality.concentrationEligible,
        mintAuthorityPresent: card.identity.mintAuthority !== null,
        poolCoverage: card.pools && card.pools.length ? (card.dataQuality.warnings.some((w) => w.includes("pool")) ? "partial" : "partial") : "unavailable",
        liquidityUsd: card.market.liquidityUsd,
        addressHitCount: card.addressHits?.length ?? 0,
        paginationComplete: card.dataQuality.paginationComplete,
      }),
      crossCa: this.archive.queryByMint(mint),
    };
  }

  getCaAnalysis(mint: string): CaAnalysisResponseV2 | null {
    return this.caCards.get(mint) ?? null;
  }

  enqueueOffline(type: string, input: Record<string, unknown>, budget = 10) {
    return this.jobs.enqueue(type, input, budget);
  }

  listJobs() {
    return this.jobs.list(100);
  }

  runOfflineJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error("job_not_found");
    if (job.state === "completed" || job.state === "partial") return job;
    this.jobs.markRunning(jobId);
    if (job.type === "ca_analysis_offline" && typeof job.input.mint === "string") {
      const card = this.composeDemoCa(job.input.mint);
      this.caCards.set(job.input.mint, card);
      this.jobs.complete(jobId, `ca-card:${job.input.mint}`, 0, card.dataQuality.overall === "partial");
    } else {
      this.jobs.complete(jobId, "noop", 0, false);
    }
    return this.jobs.get(jobId);
  }

  crossCa(kind: "wallet" | "mint" | "cluster", id: string): CrossTokenMatchV1 {
    if (kind === "wallet") return this.archive.queryByWallet(id);
    if (kind === "cluster") return this.archive.queryByCluster(id);
    return this.archive.queryByMint(id);
  }

  replayCalibration(): {
    asOfCheck: { ok: true } | { ok: false; reason: string };
    labelsAsOfCount: number;
    calibration: CalibrationReport;
  } {
    const decisionAt = "2026-07-15T00:00:00.000Z";
    const labels = filterLabelsAsOf(
      [
        { label: "early", observedAt: "2026-07-01T00:00:00.000Z", verificationStatus: "unverified" },
        { label: "future", observedAt: "2026-07-20T00:00:00.000Z", verificationStatus: "unverified" },
      ],
      decisionAt,
    );
    const asOfCheck = assertNoFutureLeak({
      decisionAt,
      subjectId: DEMO_MINT,
      features: { top10: 0.4 },
      labelsAsOf: labels,
    });
    // insufficient samples by design → threshold null
    const calibration = calibrateBinaryThreshold(
      Array.from({ length: 10 }, (_, i) => ({ score: i / 10, positive: i % 2 === 0 })),
    );
    return { asOfCheck, labelsAsOfCount: labels.length, calibration };
  }
}

export const OFFLINE_DEMO_MINT = DEMO_MINT;
