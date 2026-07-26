import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarketObservation,
  InMemoryMarketObservationStore,
  MARKET_SELECTION_RULE_VERSION,
  selectMarketSnapshot,
} from "../src/domain/rules/market-observation.js";
import { ObservationMarketDataProvider } from "../src/infrastructure/market/observation-market-data-provider.js";
import { AnalysisService } from "../src/application/analysis-service.js";
import type { AnalysisCache, AnalysisRepository } from "../src/application/ports.js";
import { HeliusSolanaAdapter, type SolanaHeliusDataSource, type SourceResponse } from "../src/infrastructure/solana/helius/helius-solana-adapter.js";
import { PUMP_IDL_COMMIT, PUMP_IDL_SHA256, PUMP_PROGRAM_ID } from "../src/infrastructure/solana/pump/pump-instruction-decoder.js";
import type { PumpCreatorEvidence, SolanaDevHistoryResult } from "../src/infrastructure/solana/dev/solana-dev-history-service.js";
import type { SolanaHolderSnapshot } from "../src/infrastructure/solana/holders/solana-holder-snapshot-service.js";
import type { DevBehavior } from "../src/domain/types.js";

const at = new Date("2026-07-26T12:00:00.000Z");

test("selects freshest non-rejected C observation and never invents liquidity", () => {
  const older = buildMarketObservation({
    id: "obs-old",
    tokenId: "tok-1",
    source: "fixture-a",
    sourceRequestRef: "fixture/pair-x",
    retrievedAt: new Date("2026-07-26T11:00:00.000Z"),
    sourceObservedAt: new Date("2026-07-26T11:00:00.000Z"),
    pairAddress: "pair-x",
    priceUsd: 1,
    liquidityUsd: 10_000,
    fdvUsd: 100_000,
  });
  const newer = buildMarketObservation({
    id: "obs-new",
    tokenId: "tok-1",
    source: "fixture-b",
    sourceRequestRef: "fixture/pair-y",
    retrievedAt: new Date("2026-07-26T11:50:00.000Z"),
    sourceObservedAt: new Date("2026-07-26T11:50:00.000Z"),
    pairAddress: "pair-y",
    priceUsd: 1.2,
    liquidityUsd: 50_000,
    fdvUsd: 120_000,
  });
  const selected = selectMarketSnapshot([older, newer], { at, tokenId: "tok-1" });
  assert.equal(selected?.selectedObservationId, "obs-new");
  assert.equal(selected?.liquidityUsd, 50_000);
  assert.equal(selected?.selectionRuleVersion, MARKET_SELECTION_RULE_VERSION);
  assert.ok(selected?.selectionWarnings?.includes("market_provider_behavior_unverified"));
});

test("idempotent store rejects duplicate fingerprint and accepts correction append", () => {
  const store = new InMemoryMarketObservationStore();
  const first = buildMarketObservation({
    id: "obs-1",
    tokenId: "tok-1",
    source: "fixture",
    sourceRequestRef: "route/v1",
    retrievedAt: at,
    sourceObservedAt: at,
    pairAddress: "pair-1",
    priceUsd: 1,
    liquidityUsd: 1_000,
    fdvUsd: null,
  });
  assert.equal(store.append(first).accepted, true);
  assert.equal(store.append({ ...first, id: "obs-dup" }).accepted, false);

  const correction = buildMarketObservation({
    id: "obs-2",
    tokenId: "tok-1",
    source: "fixture",
    sourceRequestRef: "route/v1",
    retrievedAt: new Date(at.getTime() + 60_000),
    sourceObservedAt: new Date(at.getTime() + 60_000),
    pairAddress: "pair-1",
    priceUsd: 1.1,
    liquidityUsd: 1_100,
    fdvUsd: null,
    supersedesObservationId: "obs-1",
  });
  assert.equal(store.append(correction).accepted, true);
  assert.equal(store.list("tok-1").length, 2);
});

test("prefers A-class chain-confirmed observation over fresher C", () => {
  const chainConfirmed = buildMarketObservation({
    id: "obs-a",
    tokenId: "tok-1",
    source: "local-pool-decode",
    trustClass: "A",
    sourceRequestRef: "pump-migrate/v1",
    retrievedAt: new Date("2026-07-26T11:00:00.000Z"),
    sourceObservedAt: new Date("2026-07-26T11:00:00.000Z"),
    pairAddress: "confirmed-pool",
    priceUsd: null,
    liquidityUsd: 20_000,
    fdvUsd: null,
  });
  const fresherC = buildMarketObservation({
    id: "obs-c",
    tokenId: "tok-1",
    source: "unverified-agg",
    trustClass: "C",
    sourceRequestRef: "agg/v1",
    retrievedAt: new Date("2026-07-26T11:55:00.000Z"),
    sourceObservedAt: new Date("2026-07-26T11:55:00.000Z"),
    pairAddress: "agg-pool",
    priceUsd: 2,
    liquidityUsd: 99_000,
    fdvUsd: 200_000,
  });
  const selected = selectMarketSnapshot([chainConfirmed, fresherC], { at, tokenId: "tok-1" });
  assert.equal(selected?.selectedObservationId, "obs-a");
  assert.equal(selected?.trustClass, "A");
});

test("liquidity-aware large-order floor uses market enrichment without inventing trades", async () => {
  const mint = "FixtureMintLiquidity1111111111111111111111";
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
  const response = <T,>(data: T): SourceResponse<T> => ({
    data,
    watermark: {
      source: "helius",
      observedAt: at,
      finalizedSlot: 600n,
      cursor: "c",
      completeness: "complete",
    },
  });
  const snapshot: SolanaHolderSnapshot = {
    tokenAddress: mint,
    totalSupplyRaw: 1_000n,
    completeness: "complete",
    rawTokenAccounts: [
      { tokenAccountAddress: "c-ata", ownerAddress: "creator", balanceRaw: 400n },
      { tokenAccountAddress: "a-ata", ownerAddress: "alice", balanceRaw: 600n },
    ],
    ownerBalances: new Map([["creator", 400n], ["alice", 600n]]),
    watermarks: [{ source: "fixture", observedAt: at, finalizedSlot: 600n, cursor: "h", completeness: "complete" }],
    concentration: { top10Pct: 100, top20Pct: 100, eligibleHolderCount: 2, excludedPct: 0, rows: [] },
    cleaningEvidence: [],
    warnings: [],
  };
  const dev: DevBehavior = {
    creatorAddress: "creator",
    currentHoldingPct: 40,
    relatedHoldingPct: 0,
    grossBoughtPct: 10,
    grossSoldPct: 1,
    netDisposedPct: 0,
    soldOfAcquiredPct: 10,
    directSellCount: 1,
    relatedGrossSoldPct: 0,
    outboundTransferPct: 0,
    relatedAddresses: [],
    calculatedAt: at,
  };
  const devHistory: SolanaDevHistoryResult = {
    creatorEvidence,
    coverage: {
      creationSlot: 500n,
      oldestObservedSlot: 500n,
      newestObservedSlot: 600n,
      finalizedSlot: 600n,
      cursor: "d",
      hasGaps: false,
      observedAt: at,
      completeFromCreation: true,
    },
    dev,
    warnings: [],
  };
  const nowMs = at.getTime();
  const source: SolanaHeliusDataSource = {
    getMint: async () => response({ decimals: 6, supplyRaw: "1000" }),
    getTokenMetadata: async () => response({ createdAt: createdAt.toISOString(), creationTx: "create-signature" }),
    getTokenAccounts: async () => response([
      { tokenAccount: "c-ata", owner: "creator", amountRaw: "400" },
      { tokenAccount: "a-ata", owner: "alice", amountRaw: "600" },
    ]),
    getTransactions: async () => response([{
      signature: "big-buy",
      slot: "580",
      blockTime: new Date(nowMs - 60_000).toISOString(),
      tokenTransfers: [],
      nativeTransfers: [],
      swap: {
        user: "whale",
        tokenInputs: [],
        tokenOutputs: [{ mint, amountRaw: "100" }],
        quoteUsd: 8_000, // above fixed 5k but below 1% of 1_000_000 liquidity
      },
    }]),
    getAddressTags: async () => response([]),
    getWalletFacts: async () => response([]),
    getHolderSnapshot: async () => response(snapshot),
    getPumpCreatorEvidence: async () => response(creatorEvidence),
    getDevHistory: async () => response(devHistory),
  };

  const marketObs = buildMarketObservation({
    id: "m1",
    tokenId: "will-be-replaced",
    source: "fixture-market",
    sourceRequestRef: "fixture/liq",
    retrievedAt: at,
    sourceObservedAt: at,
    pairAddress: "pool-1",
    priceUsd: 1,
    liquidityUsd: 1_000_000,
    fdvUsd: 5_000_000,
  });

  // Provider needs token.id from adapter.getToken — bind after first token fetch via wrapper.
  const adapter = new HeliusSolanaAdapter(source);
  const token = await adapter.getToken(mint);
  const market = new ObservationMarketDataProvider([
    { ...marketObs, tokenId: token.id },
  ], { now: () => at });

  const repo: AnalysisRepository = { findLatest: async () => null, save: async () => undefined };
  const cache: AnalysisCache = { get: async () => null, set: async () => undefined, delete: async () => undefined };
  const result = await new AnalysisService([adapter], market, repo, cache).getQuickAnalysis(mint, { chainHint: "solana" });

  assert.equal(result.market?.liquidityUsd, 1_000_000);
  assert.equal(result.market?.selectedObservationId, "m1");
  assert.equal(result.largeOrders.length, 0);
  assert.ok(result.warnings.includes("LARGE_ORDER_FLOOR_RAISED_BY_LIQUIDITY_RATIO"));
  assert.equal(result.walletCleaningEvidence?.exclusionInputsAlignedToSnapshot, true);
  assert.ok(!result.warnings.includes("HOLDER_EXCLUSION_TAGS_BOUNDED_TO_GENERIC_TOP100"));
});
