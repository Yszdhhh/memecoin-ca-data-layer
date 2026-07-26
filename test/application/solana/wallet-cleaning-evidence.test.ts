import assert from "node:assert/strict";
import test from "node:test";
import { AnalysisService } from "../../../src/application/analysis-service.js";
import type { AnalysisCache, AnalysisRepository } from "../../../src/application/ports.js";
import type { DevBehavior } from "../../../src/domain/types.js";
import { HeliusSolanaAdapter, type SolanaHeliusDataSource, type SourceResponse } from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";
import { PUMP_IDL_COMMIT, PUMP_IDL_SHA256, PUMP_PROGRAM_ID } from "../../../src/infrastructure/solana/pump/pump-instruction-decoder.js";
import type { PumpCreatorEvidence, SolanaDevHistoryResult } from "../../../src/infrastructure/solana/dev/solana-dev-history-service.js";
import type { SolanaHolderSnapshot } from "../../../src/infrastructure/solana/holders/solana-holder-snapshot-service.js";

const mint = "FixtureMintWalletCleaning1111111111111111111";
const createdAt = new Date("2026-07-20T00:00:00.000Z");
const creatorEvidence: PumpCreatorEvidence = {
  source: "pump_create.creator",
  creatorAddress: "creator",
  signature: "create-signature",
  slot: 500n,
  blockTime: createdAt,
  programId: PUMP_PROGRAM_ID,
  sourceCommit: PUMP_IDL_COMMIT,
  idlSha256: PUMP_IDL_SHA256,
};

function response<T>(data: T): SourceResponse<T> {
  return {
    data,
    watermark: {
      source: "helius",
      observedAt: new Date("2026-07-24T00:00:00.000Z"),
      finalizedSlot: 600n,
      cursor: "fixture-cursor",
      completeness: "complete",
    },
  };
}

function completeSnapshot(): SolanaHolderSnapshot {
  return {
    tokenAddress: mint,
    totalSupplyRaw: 1_000n,
    completeness: "complete",
    rawTokenAccounts: [
      { tokenAccountAddress: "creator-ata", ownerAddress: "creator", balanceRaw: 400n },
      { tokenAccountAddress: "a-ata", ownerAddress: "a", balanceRaw: 300n },
      { tokenAccountAddress: "b-ata", ownerAddress: "b", balanceRaw: 300n },
    ],
    ownerBalances: new Map([["creator", 400n], ["a", 300n], ["b", 300n]]),
    watermarks: [{ source: "fixture", observedAt: new Date("2026-07-24T00:00:00.000Z"), finalizedSlot: 600n, cursor: "holders-1", completeness: "complete" }],
    concentration: {
      top10Pct: 100,
      top20Pct: 100,
      eligibleHolderCount: 3,
      excludedPct: 0,
      rows: [],
    },
    cleaningEvidence: [],
    warnings: [],
  };
}

function completeDevHistory(): SolanaDevHistoryResult {
  const dev: DevBehavior = {
    creatorAddress: "creator",
    currentHoldingPct: 40,
    relatedHoldingPct: 0,
    grossBoughtPct: 20,
    grossSoldPct: 5,
    netDisposedPct: 0,
    soldOfAcquiredPct: 25,
    directSellCount: 1,
    relatedGrossSoldPct: 0,
    outboundTransferPct: 0,
    relatedAddresses: [],
    calculatedAt: new Date("2026-07-24T00:00:00.000Z"),
  };
  return {
    creatorEvidence,
    coverage: {
      creationSlot: 500n,
      oldestObservedSlot: 500n,
      newestObservedSlot: 600n,
      finalizedSlot: 600n,
      cursor: "dev-history-1",
      hasGaps: false,
      observedAt: new Date("2026-07-24T00:00:00.000Z"),
      completeFromCreation: true,
    },
    dev,
    warnings: [],
  };
}

test("exposes service-funder suppression and keeps wallet quality out of holder exclusion", async () => {
  // Stay inside AnalysisService's recentTradeWindowMinutes (30) so first-buys exist.
  const now = Date.now();
  const fundA = new Date(now - 10 * 60_000).toISOString();
  const fundB = new Date(now - 9 * 60_000).toISOString();
  const buyA = new Date(now - 5 * 60_000).toISOString();
  const buyB = new Date(now - 4 * 60_000).toISOString();
  const source: SolanaHeliusDataSource = {
    getMint: async () => response({ decimals: 6, supplyRaw: "1000" }),
    getTokenMetadata: async () => response({ createdAt: createdAt.toISOString(), creationTx: "create-signature" }),
    getTokenAccounts: async () => response([
      { tokenAccount: "creator-ata", owner: "creator", amountRaw: "400" },
      { tokenAccount: "a-ata", owner: "a", amountRaw: "300" },
      { tokenAccount: "b-ata", owner: "b", amountRaw: "300" },
    ]),
    getTransactions: async () => response([
      {
        signature: "fund-a",
        slot: "550",
        blockTime: fundA,
        tokenTransfers: [],
        nativeTransfers: [{ eventIndex: 0, from: "cex-hot", to: "a", amountRaw: "1" }],
      },
      {
        signature: "fund-b",
        slot: "551",
        blockTime: fundB,
        tokenTransfers: [],
        nativeTransfers: [{ eventIndex: 0, from: "cex-hot", to: "b", amountRaw: "1" }],
      },
      {
        signature: "buy-a",
        slot: "560",
        blockTime: buyA,
        tokenTransfers: [],
        nativeTransfers: [],
        swap: {
          user: "a",
          tokenInputs: [],
          tokenOutputs: [{ mint, amountRaw: "300" }],
        },
      },
      {
        signature: "buy-b",
        slot: "561",
        blockTime: buyB,
        tokenTransfers: [],
        nativeTransfers: [],
        swap: {
          user: "b",
          tokenInputs: [],
          tokenOutputs: [{ mint, amountRaw: "300" }],
        },
      },
    ]),
    getAddressTags: async () => response([{
      address: "cex-hot",
      role: "exchange",
      source: "system",
      confidence: 0.99,
    }]),
    getWalletFacts: async () => response([]),
    getHolderSnapshot: async () => response(completeSnapshot()),
    getPumpCreatorEvidence: async () => response(creatorEvidence),
    getDevHistory: async () => response(completeDevHistory()),
  };

  const repository: AnalysisRepository = { findLatest: async () => null, save: async () => undefined };
  const cache: AnalysisCache = { get: async () => null, set: async () => undefined, delete: async () => undefined };
  const service = new AnalysisService(
    [new HeliusSolanaAdapter(source)],
    { getMarket: async () => null },
    repository,
    cache,
  );
  const result = await service.getQuickAnalysis(mint, { chainHint: "solana" });

  assert.ok(result.walletCleaningEvidence);
  assert.equal(result.walletCleaningEvidence?.holderExclusionUsesWalletQuality, false);
  assert.equal(result.walletCleaningEvidence?.exclusionInputsAlignedToSnapshot, true);
  assert.equal(result.walletCleaningEvidence?.clusterMembers.length, 0);
  assert.equal(result.walletCleaningEvidence?.suppressedServiceFunders.length, 1);
  assert.equal(result.walletCleaningEvidence?.suppressedServiceFunders[0]?.funder, "cex-hot");
  assert.equal(result.walletCleaningEvidence?.suppressedServiceFunders[0]?.role, "exchange");
  assert.ok((result.walletCleaningEvidence?.suppressedServiceFunders[0]?.suppressedEdgeCount ?? 0) >= 1);
});

// --- Funder-tag coverage repair (SOL-WALLET-CLEANING-FUNDER-TAGS-001) ---

// Builds the two-buyer / one-cex-funder scenario with an address-RESPECTING tag
// mock: the exchange tag for the non-holder funder "cex-hot" is only returned
// when "cex-hot" is actually in the queried address list. Under the old code
// (tags fetched for holders only) the funder was never tagged, so suppression
// could not fire; this fixture would then form a 2-member cluster.
function funderScenarioSource(funderTagConfidence: number | null): SolanaHeliusDataSource {
  const now = Date.now();
  const fundA = new Date(now - 10 * 60_000).toISOString();
  const fundB = new Date(now - 9 * 60_000).toISOString();
  const buyA = new Date(now - 5 * 60_000).toISOString();
  const buyB = new Date(now - 4 * 60_000).toISOString();
  return {
    getMint: async () => response({ decimals: 6, supplyRaw: "1000" }),
    getTokenMetadata: async () => response({ createdAt: createdAt.toISOString(), creationTx: "create-signature" }),
    getTokenAccounts: async () => response([
      { tokenAccount: "creator-ata", owner: "creator", amountRaw: "400" },
      { tokenAccount: "a-ata", owner: "a", amountRaw: "300" },
      { tokenAccount: "b-ata", owner: "b", amountRaw: "300" },
    ]),
    getTransactions: async () => response([
      { signature: "fund-a", slot: "550", blockTime: fundA, tokenTransfers: [], nativeTransfers: [{ eventIndex: 0, from: "cex-hot", to: "a", amountRaw: "1" }] },
      { signature: "fund-b", slot: "551", blockTime: fundB, tokenTransfers: [], nativeTransfers: [{ eventIndex: 0, from: "cex-hot", to: "b", amountRaw: "1" }] },
      { signature: "buy-a", slot: "560", blockTime: buyA, tokenTransfers: [], nativeTransfers: [], swap: { user: "a", tokenInputs: [], tokenOutputs: [{ mint, amountRaw: "300" }] } },
      { signature: "buy-b", slot: "561", blockTime: buyB, tokenTransfers: [], nativeTransfers: [], swap: { user: "b", tokenInputs: [], tokenOutputs: [{ mint, amountRaw: "300" }] } },
    ]),
    // Address-respecting: cex-hot is NOT a holder, so it is only tagged when the
    // funder-tag fetch actually queries it.
    getAddressTags: async (addresses: string[]) => response(
      funderTagConfidence !== null && addresses.includes("cex-hot")
        ? [{ address: "cex-hot", role: "exchange" as const, source: "system" as const, confidence: funderTagConfidence }]
        : [],
    ),
    getWalletFacts: async () => response([]),
    getHolderSnapshot: async () => response(completeSnapshot()),
    getPumpCreatorEvidence: async () => response(creatorEvidence),
    getDevHistory: async () => response(completeDevHistory()),
  };
}

async function runFunderScenario(funderTagConfidence: number | null) {
  const repository: AnalysisRepository = { findLatest: async () => null, save: async () => undefined };
  const cache: AnalysisCache = { get: async () => null, set: async () => undefined, delete: async () => undefined };
  const service = new AnalysisService(
    [new HeliusSolanaAdapter(funderScenarioSource(funderTagConfidence))],
    { getMarket: async () => null },
    repository,
    cache,
  );
  return service.getQuickAnalysis(mint, { chainHint: "solana" });
}

test("suppresses a non-holder exchange funder (funder tags are now fetched)", async () => {
  const result = await runFunderScenario(0.95);
  // The exchange funder is suppressed, so no same-source cluster is formed.
  assert.equal(result.walletCleaningEvidence?.clusterMembers.length, 0);
  assert.equal(result.walletCleaningEvidence?.suppressedServiceFunders.length, 1);
  assert.equal(result.walletCleaningEvidence?.suppressedServiceFunders[0]?.funder, "cex-hot");
});

test("without any funder tag, the same-source cluster forms (control)", async () => {
  const result = await runFunderScenario(null);
  assert.ok((result.walletCleaningEvidence?.clusterMembers.length ?? 0) >= 2);
  assert.equal(result.walletCleaningEvidence?.suppressedServiceFunders.length, 0);
});

test("funder-tag suppression respects the 0.8 confidence boundary", async () => {
  const atBoundary = await runFunderScenario(0.8);
  assert.equal(atBoundary.walletCleaningEvidence?.suppressedServiceFunders.length, 1);
  assert.equal(atBoundary.walletCleaningEvidence?.clusterMembers.length, 0);

  const belowBoundary = await runFunderScenario(0.79);
  assert.equal(belowBoundary.walletCleaningEvidence?.suppressedServiceFunders.length, 0);
  assert.ok((belowBoundary.walletCleaningEvidence?.clusterMembers.length ?? 0) >= 2);
});
