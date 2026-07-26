import assert from "node:assert/strict";
import test from "node:test";
import { AnalysisService } from "../../../src/application/analysis-service.js";
import type { AnalysisCache, AnalysisRepository } from "../../../src/application/ports.js";
import type { AnalysisResult, DevBehavior } from "../../../src/domain/types.js";
import { RedisAnalysisCache } from "../../../src/infrastructure/cache/redis-analysis-cache.js";
import { PostgresAnalysisRepository } from "../../../src/infrastructure/postgres/postgres-analysis-repository.js";
import { HeliusSolanaAdapter, type SolanaHeliusDataSource, type SourceResponse } from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";
import { PUMP_IDL_COMMIT, PUMP_IDL_SHA256, PUMP_PROGRAM_ID } from "../../../src/infrastructure/solana/pump/pump-instruction-decoder.js";
import type { PumpCreatorEvidence, SolanaDevHistoryResult } from "../../../src/infrastructure/solana/dev/solana-dev-history-service.js";
import type { SolanaHolderSnapshot } from "../../../src/infrastructure/solana/holders/solana-holder-snapshot-service.js";

const mint = "FixtureMint111111111111111111111111111111111";
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
      { tokenAccountAddress: "related-ata", ownerAddress: "related", balanceRaw: 30n },
      { tokenAccountAddress: "alice-ata", ownerAddress: "alice", balanceRaw: 570n },
    ],
    ownerBalances: new Map([["creator", 400n], ["related", 30n], ["alice", 570n]]),
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
    relatedHoldingPct: 3,
    grossBoughtPct: 20,
    grossSoldPct: 5,
    netDisposedPct: 0,
    soldOfAcquiredPct: 25,
    directSellCount: 1,
    relatedGrossSoldPct: 4,
    outboundTransferPct: 2.5,
    relatedAddresses: ["related"],
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

function fixtureAdapter() {
  const source: SolanaHeliusDataSource = {
    getMint: async () => response({ decimals: 6, supplyRaw: "1000" }),
    getTokenMetadata: async () => response({ createdAt: createdAt.toISOString(), creationTx: "create-signature" }),
    getTokenAccounts: async () => response([
      { tokenAccount: "creator-ata", owner: "creator", amountRaw: "400" },
      { tokenAccount: "related-ata", owner: "related", amountRaw: "30" },
      { tokenAccount: "alice-ata", owner: "alice", amountRaw: "570" },
    ]),
    getTransactions: async () => response([{
      signature: "fund-related",
      slot: "550",
      blockTime: "2026-07-23T00:00:00.000Z",
      tokenTransfers: [],
      nativeTransfers: [{ eventIndex: 0, from: "creator", to: "related", amountRaw: "1" }],
    }]),
    getAddressTags: async () => response([]),
    getWalletFacts: async () => response([]),
    getHolderSnapshot: async () => response(completeSnapshot()),
    getPumpCreatorEvidence: async () => response(creatorEvidence),
    getDevHistory: async () => response(completeDevHistory()),
  };
  return new HeliusSolanaAdapter(source);
}

function ownerBalance(result: AnalysisResult, owner: string): bigint | undefined {
  return result.solanaEvidence?.holderSnapshot?.ownerBalances.find((entry) => entry.owner === owner)?.balanceRaw;
}

/** Minimal Redis surface used by RedisAnalysisCache (no network). */
class MemoryRedis {
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<"OK"> {
    this.store.set(key, value);
    return "OK";
  }
  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

test("RedisAnalysisCache preserves holder ownerBalances through get/set", async () => {
  const cache = new RedisAnalysisCache(new MemoryRedis() as never);
  const noopRepo: AnalysisRepository = { findLatest: async () => null, save: async () => undefined };
  const service = new AnalysisService([fixtureAdapter()], { getMarket: async () => null }, noopRepo, cache);

  const fresh = await service.getQuickAnalysis(mint, { chainHint: "solana", forceRefresh: true });
  assert.equal(fresh.holderCompleteness, "complete");
  assert.equal(ownerBalance(fresh, "creator"), 400n);
  assert.equal(ownerBalance(fresh, "alice"), 570n);
  assert.ok(Array.isArray(fresh.solanaEvidence?.holderSnapshot?.ownerBalances));

  const cached = await cache.get(`analysis:quick:solana:${mint.toLowerCase()}`);
  assert.ok(cached);
  assert.equal(cached.holderCompleteness, "complete");
  assert.equal(ownerBalance(cached, "creator"), 400n);
  assert.equal(ownerBalance(cached, "related"), 30n);
  assert.equal(ownerBalance(cached, "alice"), 570n);
  assert.equal(cached.solanaEvidence?.holderSnapshot?.ownerBalances.length, 3);
  assert.equal(cached.solanaEvidence?.holderSnapshot?.rawTokenAccounts.length, 3);
});

test("PostgresAnalysisRepository encode path keeps ownerBalances in durable payload", async () => {
  let durablePayload: unknown = null;
  const stubPool = {
    connect: async () => ({
      query: async (sql: string, params?: unknown[]) => {
        if (sql.startsWith("BEGIN") || sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) return { rows: [] };
        if (sql.includes("INSERT INTO tokens")) return { rows: [{ id: "token-1" }] };
        if (sql.includes("INSERT INTO analysis_materializations")) {
          durablePayload = JSON.parse(String(params?.[1]));
          return { rows: [] };
        }
        return { rows: [] };
      },
      release: () => undefined,
    }),
    query: async () => ({ rows: durablePayload ? [{ payload: durablePayload }] : [] }),
  };

  const repository = new PostgresAnalysisRepository(stubPool as never);
  const noopCache: AnalysisCache = {
    get: async () => null,
    set: async () => undefined,
    delete: async () => undefined,
  };
  const service = new AnalysisService([fixtureAdapter()], { getMarket: async () => null }, repository, noopCache);
  const fresh = await service.getQuickAnalysis(mint, { chainHint: "solana", forceRefresh: true });
  assert.equal(ownerBalance(fresh, "creator"), 400n);

  assert.ok(durablePayload && typeof durablePayload === "object");
  const payload = durablePayload as {
    solanaEvidence?: { holderSnapshot?: { ownerBalances?: Array<{ owner: string; balanceRaw: string }>; completeness?: string } };
  };
  const balances = payload.solanaEvidence?.holderSnapshot?.ownerBalances;
  assert.ok(Array.isArray(balances));
  assert.equal(balances!.length, 3);
  const creator = balances!.find((entry) => entry.owner === "creator");
  assert.ok(creator);
  assert.match(String(creator!.balanceRaw), /400/);
  assert.notDeepEqual(balances, {});

  const reloaded = await repository.findLatest("solana", mint, 30);
  assert.ok(reloaded);
  assert.equal(reloaded.holderCompleteness, "complete");
  assert.equal(ownerBalance(reloaded, "creator"), 400n);
  assert.equal(ownerBalance(reloaded, "alice"), 570n);
});
