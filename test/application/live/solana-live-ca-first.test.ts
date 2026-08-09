import assert from "node:assert/strict";
import test from "node:test";
import {
  isSolanaAddress,
  readSolanaLiveCaFirst,
  readSolanaLiveCaFirstCard,
  readSolanaLiveCaFirstWithFactory,
  SOLANA_LIVE_CA_FIRST_VERSION,
  type SolanaLiveCaFirstCardDeps,
  type SolanaLiveCaFirstSource,
} from "../../../src/application/live/solana-live-ca-first.js";
import { AnalysisService } from "../../../src/application/analysis-service.js";
import type { AnalysisCache, AnalysisRepository } from "../../../src/application/ports.js";
import type { DeepDiveQueue } from "../../../src/application/hotpath/ca-first-screen.js";
import { InMemoryAddressLibrary } from "../../../src/application/sedimentation/address-library.js";
import type { AnalysisResult, DevBehavior } from "../../../src/domain/types.js";
import type { PumpCreatorEvidence, SolanaDevHistoryResult } from "../../../src/infrastructure/solana/dev/solana-dev-history-service.js";
import {
  HeliusSolanaAdapter,
  SourceDataUnavailableError,
  type SolanaHeliusDataSource,
  type SourceResponse,
} from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";
import type { SolanaHolderSnapshot } from "../../../src/infrastructure/solana/holders/solana-holder-snapshot-service.js";
import { PUMP_IDL_COMMIT, PUMP_IDL_SHA256, PUMP_PROGRAM_ID } from "../../../src/infrastructure/solana/pump/pump-instruction-decoder.js";
import { safeSolanaLiveWarning } from "../../../src/application/live/solana-live-warning.js";

const ca = "DMYA7GexqPCeZeFxjDRjAgPbut24K3DhUAXcMH48JHoX";
const observedAt = new Date("2026-07-27T00:00:00.000Z");

function source(overrides: Partial<SolanaLiveCaFirstSource> = {}): SolanaLiveCaFirstSource {
  return {
    async getMint() {
      return {
        data: { decimals: 6, supplyRaw: "42000000" },
        watermark: { source: "helius", observedAt, finalizedSlot: 101n, completeness: "complete" },
      };
    },
    async getTokenMetadata() {
      return {
        data: { name: "Public token", symbol: "PUB" },
        watermark: { source: "helius", observedAt, finalizedSlot: 102n, completeness: "complete" },
      };
    },
    async getTokenAccounts() {
      return {
        data: [
          { tokenAccount: "AccountOne", owner: "OwnerOne", amountRaw: "5" },
          { tokenAccount: "AccountTwo", owner: "OwnerTwo", amountRaw: "7" },
        ],
        watermark: { source: "helius", observedAt, finalizedSlot: 103n, completeness: "complete" },
      };
    },
    ...overrides,
  };
}

test("manual CA-first result exposes only bounded Helius first-look fields", async () => {
  const result = await readSolanaLiveCaFirst(ca, source());

  assert.equal(result.entrypointVersion, SOLANA_LIVE_CA_FIRST_VERSION);
  assert.equal(result.status, "OK");
  assert.deepEqual(result.mint, { available: true, decimals: 6 });
  assert.deepEqual(result.metadata, { available: true });
  assert.deepEqual(result.holderTokenAccounts, { available: true, count: 2 });
  assert.deepEqual(result.completeness, { state: "complete", availableFields: 3, requiredFields: 3 });
  assert.deepEqual(result.sourceSlots, {
    mintFinalizedSlot: "101",
    metadataIndexedSlot: "102",
    holderAccountsIndexedSlot: "103",
  });
  assert.deepEqual(result.warnings, []);
  assert.equal("supplyRaw" in result.mint, false);
  assert.equal("name" in result.metadata, false);
  assert.equal("accounts" in result.holderTokenAccounts, false);
});

test("manual CA-first degrades safely when one bounded Helius read is unavailable", async () => {
  const result = await readSolanaLiveCaFirst(ca, source({
    async getTokenAccounts() {
      throw new Error("helius_token_accounts_truncated");
    },
  }));

  assert.equal(result.status, "DEGRADED");
  assert.deepEqual(result.holderTokenAccounts, { available: false, count: null });
  assert.deepEqual(result.completeness, { state: "partial", availableFields: 2, requiredFields: 3 });
  assert.equal(result.sourceSlots.holderAccountsIndexedSlot, null);
  assert.ok(result.warnings.includes("helius_token_accounts_truncated"));
});

test("manual CA-first rejects an invalid CA without calling the live source", async () => {
  let calls = 0;
  const result = await readSolanaLiveCaFirst("not a Solana CA", source({
    async getMint() {
      calls += 1;
      throw new Error("should not run");
    },
  }));

  assert.equal(result.status, "REJECTED");
  assert.deepEqual(result.completeness, { state: "unavailable", availableFields: 0, requiredFields: 3 });
  assert.deepEqual(result.warnings, ["solana_ca_invalid"]);
  assert.equal(calls, 0);
});

test("manual CA-first validates a 32-byte Base58 address before source construction", async () => {
  let created = 0;
  const result = await readSolanaLiveCaFirstWithFactory("not-a-solana-ca", () => {
    created += 1;
    return source();
  });

  assert.equal(result.status, "REJECTED");
  assert.deepEqual(result.warnings, ["solana_ca_invalid"]);
  assert.equal(created, 0);
  assert.equal(isSolanaAddress(ca), true);
  assert.equal(isSolanaAddress(` ${ca} `), true);
  assert.equal(isSolanaAddress("1".repeat(31)), false);
  assert.equal(isSolanaAddress("1".repeat(33)), false);
  assert.equal(isSolanaAddress(`${ca}0`), false);
});

test("manual CA-first never returns arbitrary transport error text", async () => {
  const result = await readSolanaLiveCaFirst(ca, source({
    async getMint() {
      throw new Error("transport failure: private-response-text");
    },
  }));

  assert.equal(result.status, "DEGRADED");
  assert.ok(result.warnings.includes("helius_live_read_unavailable"));
  assert.equal(result.warnings.some((warning) => warning.includes("private-response-text")), false);
});

test("live warning output uses an exact allowlist", async () => {
  const result = await readSolanaLiveCaFirst(ca, source({
    async getMint() {
      throw new Error("helius_private_response_text");
    },
  }));

  assert.ok(result.warnings.includes("helius_live_read_unavailable"));
  assert.equal(result.warnings.includes("helius_private_response_text"), false);
  assert.equal(
    safeSolanaLiveWarning(new Error("helius_runtime_credential_unavailable")),
    "helius_runtime_credential_unavailable",
  );
  assert.equal(safeSolanaLiveWarning(new Error("helius_http_429")), "helius_http_error");
  assert.equal(safeSolanaLiveWarning(new Error("unknown internal detail")), "helius_live_read_unavailable");
});

// ---------------------------------------------------------------------------
// Full CA judgment card (fixture path, no network)
// ---------------------------------------------------------------------------

const cardCreatedAt = new Date("2026-07-20T00:00:00.000Z");

const cardCreatorEvidence: PumpCreatorEvidence = {
  source: "pump_create.creator",
  creatorAddress: "creator",
  signature: "create-signature",
  slot: 500n,
  blockTime: cardCreatedAt,
  programId: PUMP_PROGRAM_ID,
  sourceCommit: PUMP_IDL_COMMIT,
  idlSha256: PUMP_IDL_SHA256,
};

function cardResponse<T>(data: T): SourceResponse<T> {
  return {
    data,
    watermark: {
      source: "helius",
      observedAt,
      finalizedSlot: 600n,
      completeness: "complete",
    },
  };
}

function completeCardSnapshot(): SolanaHolderSnapshot {
  return {
    tokenAddress: ca,
    totalSupplyRaw: 1_000n,
    completeness: "complete",
    rawTokenAccounts: [
      { tokenAccountAddress: "creator-ata", ownerAddress: "creator", balanceRaw: 400n },
      { tokenAccountAddress: "related-ata", ownerAddress: "related", balanceRaw: 30n },
      { tokenAccountAddress: "alice-ata", ownerAddress: "alice", balanceRaw: 570n },
    ],
    ownerBalances: new Map([["creator", 400n], ["related", 30n], ["alice", 570n]]),
    watermarks: [{
      source: "fixture",
      observedAt,
      finalizedSlot: 600n,
      completeness: "complete",
    }],
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

function completeCardDevHistory(): SolanaDevHistoryResult {
  const dev: DevBehavior = {
    creatorAddress: "creator",
    currentHoldingPct: 40,
    relatedHoldingPct: 3,
    grossBoughtPct: 20,
    grossSoldPct: 5,
    netDisposedPct: 0,
    soldOfAcquiredPct: 25,
    directSellCount: 1,
    relatedGrossSoldPct: 4,
    outboundTransferPct: 2.5,
    relatedAddresses: ["related"],
    calculatedAt: observedAt,
  };
  return {
    creatorEvidence: cardCreatorEvidence,
    coverage: {
      creationSlot: 500n,
      oldestObservedSlot: 500n,
      newestObservedSlot: 600n,
      finalizedSlot: 600n,
      cursor: "dev-history-1",
      hasGaps: false,
      observedAt,
      completeFromCreation: true,
    },
    dev,
    warnings: [],
  };
}

function cardSource(overrides: Partial<SolanaHeliusDataSource> = {}): SolanaHeliusDataSource {
  return {
    async getMint() {
      return cardResponse({ decimals: 6, supplyRaw: "1000" });
    },
    async getTokenMetadata() {
      return cardResponse({ createdAt: cardCreatedAt.toISOString(), creationTx: "create-signature" });
    },
    async getTokenAccounts() {
      return cardResponse([
        { tokenAccount: "creator-ata", owner: "creator", amountRaw: "400" },
        { tokenAccount: "related-ata", owner: "related", amountRaw: "30" },
        { tokenAccount: "alice-ata", owner: "alice", amountRaw: "570" },
      ]);
    },
    async getTransactions() {
      return cardResponse([{
        signature: "fund-related",
        slot: "550",
        blockTime: "2026-07-23T00:00:00.000Z",
        tokenTransfers: [],
        nativeTransfers: [{ eventIndex: 0, from: "creator", to: "related", amountRaw: "1" }],
      }]);
    },
    async getAddressTags() {
      return cardResponse([]);
    },
    async getWalletFacts() {
      return cardResponse([]);
    },
    async getHolderSnapshot() {
      return cardResponse(completeCardSnapshot());
    },
    async getPumpCreatorEvidence() {
      return cardResponse(cardCreatorEvidence);
    },
    async getDevHistory() {
      return cardResponse(completeCardDevHistory());
    },
    ...overrides,
  };
}

function cardDeps(
  source: SolanaHeliusDataSource,
  options: {
    library?: InMemoryAddressLibrary;
    repo?: AnalysisRepository;
    cache?: AnalysisCache;
    deepDiveQueueFactory?: (analysis: AnalysisService) => DeepDiveQueue;
  } = {},
): SolanaLiveCaFirstCardDeps {
  const noopRepo: AnalysisRepository = { findLatest: async () => null, save: async () => undefined };
  const noopCache: AnalysisCache = { get: async () => null, set: async () => undefined, delete: async () => undefined };
  return {
    sourceFactory: () => source,
    analysisFactory: (src) => new AnalysisService(
      [new HeliusSolanaAdapter(src)],
      { getMarket: async () => null },
      options.repo ?? noopRepo,
      options.cache ?? noopCache,
    ),
    library: options.library ?? new InMemoryAddressLibrary(),
    ...(options.deepDiveQueueFactory ? { deepDiveQueueFactory: options.deepDiveQueueFactory } : {}),
  };
}

test("live CA card composes holder facts, judgment, library hits, and completeness", async () => {
  const library = new InMemoryAddressLibrary();
  await library.upsertWallet({
    chain: "solana",
    address: "alice",
    origin: "first_hand",
    verificationStatus: "verified",
    labels: ["independent_smart_money", "alpha_SSR"],
    alphaScoreTier: "SSR",
    dataCompleteness: 0.8,
    updatedAt: observedAt,
  });

  const result = await readSolanaLiveCaFirstCard(ca, cardDeps(cardSource(), { library }));

  assert.equal(result.entrypointVersion, SOLANA_LIVE_CA_FIRST_VERSION);
  assert.equal(result.status, "OK");
  // Bounded summary fields are preserved alongside the card extension.
  assert.deepEqual(result.completeness, { state: "complete", availableFields: 3, requiredFields: 3 });
  // Holder facts come from the owner-aggregated audited snapshot.
  assert.deepEqual(result.holderFacts, {
    available: true,
    completeness: "complete",
    ownerAggregated: true,
    ownerCount: 3,
    top10Pct: 100,
    top20Pct: 100,
    eligibleHolderCount: 3,
    snapshotFinalizedSlot: "600",
  });
  // Library hit is driven by holder owners (not an arbitrary caller list).
  assert.deepEqual(result.libraryHits, [{
    address: "alice",
    labels: ["independent_smart_money", "alpha_SSR"],
    alphaScoreTier: "SSR",
    verificationStatus: "verified",
  }]);
  // Clear judgment: complete Tier-A facts confirm; nothing Tier-B is confirmed.
  assert.ok(result.judgment.some((item) => item.judgmentCode === "ca_live_read_complete" && item.status === "confirmed"));
  const holderJudgment = result.judgment.find((item) => item.judgmentCode === "holder_concentration_confirmed");
  assert.ok(holderJudgment);
  assert.equal(holderJudgment.status, "confirmed");
  assert.equal(holderJudgment.sourceTier, "A");
  assert.ok(result.judgment.every((item) => !(item.sourceTier === "B" && item.status === "confirmed")));
  assert.equal(result.deepDiveEnqueued, true);
  assert.ok(Array.isArray(result.warnings));
});

test("live CA card degrades with warnings when tags/facts are unavailable and the snapshot is partial", async () => {
  const partialSnapshot = (): SolanaHolderSnapshot => ({
    ...completeCardSnapshot(),
    completeness: "partial",
    concentration: null,
    warnings: ["holder_enumeration_truncated"],
  });

  const result = await readSolanaLiveCaFirstCard(ca, cardDeps(cardSource({
    async getAddressTags() {
      throw new SourceDataUnavailableError("helius_address_tags_unavailable");
    },
    async getWalletFacts() {
      throw new SourceDataUnavailableError("helius_wallet_facts_unavailable");
    },
    async getHolderSnapshot() {
      return cardResponse(partialSnapshot());
    },
  })));

  // The card is still produced instead of being rejected.
  assert.equal(result.entrypointVersion, SOLANA_LIVE_CA_FIRST_VERSION);
  assert.equal(result.status, "DEGRADED");
  assert.equal(result.holderFacts.available, true);
  assert.equal(result.holderFacts.completeness, "partial");
  assert.equal(result.holderFacts.ownerAggregated, true);
  assert.equal(result.holderFacts.top10Pct, null);
  const holderJudgment = result.judgment.find((item) => item.judgmentCode === "holder_concentration_partial");
  assert.ok(holderJudgment);
  assert.equal(holderJudgment.status, "unverified");
  assert.ok(holderJudgment.warnings.length > 0);
  assert.ok(result.warnings.includes("HOLDER_CONCENTRATION_INDETERMINATE"));
  assert.ok(result.warnings.some((warning) => warning.includes("HOLDER_EXCLUSION")));
  assert.equal(result.deepDiveEnqueued, true);
});

test("live CA card repeated analysis reuses the stored result without duplicating observations", async () => {
  let pumpCreatorCalls = 0;
  let saveCalls = 0;
  let stored: AnalysisResult | null = null;
  const repo: AnalysisRepository = {
    findLatest: async () => stored,
    save: async (result) => {
      saveCalls += 1;
      stored = result;
    },
  };
  const cache: AnalysisCache = { get: async () => null, set: async () => undefined, delete: async () => undefined };

  const deps = cardDeps(cardSource({
    async getPumpCreatorEvidence() {
      pumpCreatorCalls += 1;
      return cardResponse(cardCreatorEvidence);
    },
  }), { repo, cache });

  const first = await readSolanaLiveCaFirstCard(ca, deps);
  const second = await readSolanaLiveCaFirstCard(ca, deps);

  assert.equal(first.status, "OK");
  assert.equal(second.status, "OK");
  // The second card call is served from the stored analysis; nothing re-runs.
  assert.equal(pumpCreatorCalls, 1);
  assert.equal(saveCalls, 1);
});

test("live CA card rejects an invalid CA without constructing the source", async () => {
  let created = 0;
  const result = await readSolanaLiveCaFirstCard("not-a-solana-ca", {
    ...cardDeps(cardSource()),
    sourceFactory: () => {
      created += 1;
      return cardSource();
    },
  });

  assert.equal(result.status, "REJECTED");
  assert.deepEqual(result.warnings, ["solana_ca_invalid"]);
  assert.deepEqual(result.holderFacts, {
    available: false,
    completeness: "unavailable",
    ownerAggregated: false,
    ownerCount: null,
    top10Pct: null,
    top20Pct: null,
    eligibleHolderCount: null,
    snapshotFinalizedSlot: null,
  });
  assert.deepEqual(result.libraryHits, []);
  assert.deepEqual(result.judgment, []);
  assert.equal(result.deepDiveEnqueued, false);
  assert.equal(created, 0);
});
