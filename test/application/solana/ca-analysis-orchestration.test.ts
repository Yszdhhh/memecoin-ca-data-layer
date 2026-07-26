import assert from "node:assert/strict";
import test from "node:test";
import { AnalysisService } from "../../../src/application/analysis-service.js";
import type { AnalysisCache, AnalysisRepository } from "../../../src/application/ports.js";
import type { DevBehavior } from "../../../src/domain/types.js";
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

function response<T>(data: T, completeness: "complete" | "partial" = "complete"): SourceResponse<T> {
  return {
    data,
    watermark: {
      source: "helius",
      observedAt: new Date("2026-07-24T00:00:00.000Z"),
      finalizedSlot: 600n,
      cursor: "fixture-cursor",
      completeness,
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

function partialSnapshot(): SolanaHolderSnapshot {
  return {
    ...completeSnapshot(),
    completeness: "partial",
    concentration: null,
    warnings: ["Holder enumeration is partial; concentration metrics were not calculated."],
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

function partialDevHistory(): SolanaDevHistoryResult {
  return {
    ...completeDevHistory(),
    coverage: { ...completeDevHistory().coverage, oldestObservedSlot: 501n, completeFromCreation: false },
    dev: null,
    warnings: ["DEV_HISTORY_INCOMPLETE_FROM_CREATION"],
  };
}

function fixtureAdapter(options: {
  snapshot?: SolanaHolderSnapshot | null;
  creator?: PumpCreatorEvidence | null;
  devHistory?: SolanaDevHistoryResult | null;
  auditedServices?: boolean;
}) {
  let devHistoryRequests = 0;
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
    ...(options.auditedServices === false ? {} : {
      getHolderSnapshot: async () => response(options.snapshot ?? completeSnapshot(), options.snapshot?.completeness ?? "complete"),
      getPumpCreatorEvidence: async () => response(options.creator === undefined ? creatorEvidence : options.creator),
      getDevHistory: async (input: { relatedAddresses: string[]; holderSnapshot: SolanaHolderSnapshot }) => {
        devHistoryRequests += 1;
        assert.deepEqual(input.relatedAddresses, ["related"]);
        assert.equal(input.holderSnapshot.completeness, "complete");
        return response(options.devHistory === undefined ? completeDevHistory() : options.devHistory!);
      },
    }),
  };
  return { adapter: new HeliusSolanaAdapter(source), devHistoryRequests: () => devHistoryRequests };
}

function serviceFor(adapter: HeliusSolanaAdapter): AnalysisService {
  const repository: AnalysisRepository = {
    findLatest: async () => null,
    save: async () => undefined,
  };
  const cache: AnalysisCache = {
    get: async () => null,
    set: async () => undefined,
    delete: async () => undefined,
  };
  return new AnalysisService([adapter], { getMarket: async () => null }, repository, cache);
}

test("uses pinned Pump creator plus complete audited facts and preserves direct, related, and transfer metrics", async () => {
  const fixture = fixtureAdapter({});
  const result = await serviceFor(fixture.adapter).getQuickAnalysis(mint, { chainHint: "solana" });

  assert.equal(result.token.creatorAddress, "creator");
  assert.equal(result.holderCompleteness, "complete");
  assert.equal(result.devCompleteness, "complete");
  assert.equal(result.holders?.top10Pct, 100);
  assert.equal(result.solanaEvidence?.creator?.source, "pump_create.creator");
  assert.equal(result.solanaEvidence?.holderSnapshot?.ownerBalances.get("creator"), 400n);
  assert.equal(result.dev?.grossSoldPct, 5);
  assert.equal(result.dev?.relatedGrossSoldPct, 4);
  assert.equal(result.dev?.outboundTransferPct, 2.5);
  assert.equal(fixture.devHistoryRequests(), 1);
});

test("rejects holder concentration and Dev totals when the audited holder snapshot is partial", async () => {
  const fixture = fixtureAdapter({ snapshot: partialSnapshot() });
  const result = await serviceFor(fixture.adapter).getQuickAnalysis(mint, { chainHint: "solana" });

  assert.equal(result.holders, null);
  assert.equal(result.holderCompleteness, "partial");
  assert.equal(result.dev, null);
  assert.equal(result.devCompleteness, "partial");
  assert.ok(result.warnings.includes("HOLDER_CONCENTRATION_INDETERMINATE"));
  assert.ok(result.warnings.includes("DEV_TOTALS_INDETERMINATE"));
  assert.equal(fixture.devHistoryRequests(), 0);
});

test("does not query Dev history or report Dev totals without pinned Pump creator evidence", async () => {
  const fixture = fixtureAdapter({ creator: null });
  const result = await serviceFor(fixture.adapter).getQuickAnalysis(mint, { chainHint: "solana" });

  assert.equal(result.token.creatorAddress, undefined);
  assert.equal(result.dev, null);
  assert.equal(result.devCompleteness, "partial");
  assert.equal(result.solanaEvidence?.creator, null);
  assert.ok(result.warnings.includes("CREATOR_EVIDENCE_MISSING_OR_UNTRUSTED"));
  assert.ok(result.warnings.includes("DEV_TOTALS_INDETERMINATE"));
  assert.equal(fixture.devHistoryRequests(), 0);
});

test("retains creator and Dev coverage but refuses totals when Dev history is incomplete from creation", async () => {
  const fixture = fixtureAdapter({ devHistory: partialDevHistory() });
  const result = await serviceFor(fixture.adapter).getQuickAnalysis(mint, { chainHint: "solana" });

  assert.equal(result.token.creatorAddress, "creator");
  assert.equal(result.dev, null);
  assert.equal(result.devCompleteness, "partial");
  assert.equal(result.solanaEvidence?.devHistory?.completeFromCreation, false);
  assert.ok(result.warnings.includes("DEV_HISTORY_INCOMPLETE_FROM_CREATION"));
  assert.ok(result.warnings.includes("DEV_TOTALS_INDETERMINATE"));
  assert.equal(fixture.devHistoryRequests(), 1);
});

test("rejects creator evidence that is not bound to the pinned Pump contract", async () => {
  const fixture = fixtureAdapter({ creator: { ...creatorEvidence, sourceCommit: "not-the-pinned-idl" } });
  const result = await serviceFor(fixture.adapter).getQuickAnalysis(mint, { chainHint: "solana" });

  assert.equal(result.solanaEvidence?.creator, null);
  assert.equal(result.dev, null);
  assert.equal(fixture.devHistoryRequests(), 0);
});

test("does not fall back to generic holder or Dev calculations when Solana audited services are unavailable", async () => {
  const fixture = fixtureAdapter({ auditedServices: false });
  const result = await serviceFor(fixture.adapter).getQuickAnalysis(mint, { chainHint: "solana" });

  assert.equal(result.holders, null);
  assert.equal(result.holderCompleteness, "unavailable");
  assert.equal(result.dev, null);
  assert.equal(result.devCompleteness, "unavailable");
  assert.ok(result.warnings.includes("SOLANA_AUDITED_FACT_SERVICES_UNAVAILABLE"));
  assert.ok(result.warnings.includes("HOLDER_CONCENTRATION_INDETERMINATE"));
  assert.ok(result.warnings.includes("DEV_TOTALS_INDETERMINATE"));
});
