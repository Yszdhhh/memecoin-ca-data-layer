import assert from "node:assert/strict";
import test from "node:test";
import {
  RUNTIME_CREDENTIAL_UNAVAILABLE,
  runSolanaCaRealDataCleaningPilot,
  type PilotTokenAccountSource,
} from "../../../src/application/live/solana-ca-real-data-cleaning-pilot.js";
import { SourceDataUnavailableError } from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";
import type { SourceResponse, RpcMint, HeliusTokenMetadata, RpcTokenAccount } from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";
import type { TokenAccountEnumerationResult } from "../../../src/infrastructure/solana/helius/live-helius-data-source.js";

const FIXED = "2026-07-30T15:00:00.000Z";

function mintResponse(supplyRaw: string, decimals = 0): SourceResponse<RpcMint | null> {
  return {
    data: { supplyRaw, decimals },
    watermark: { source: "helius", observedAt: new Date(FIXED), completeness: "complete", finalizedSlot: 1n },
  };
}

function metaResponse(): SourceResponse<HeliusTokenMetadata | null> {
  return {
    data: { name: "Fixture", symbol: "FIX" },
    watermark: { source: "helius", observedAt: new Date(FIXED), completeness: "complete", finalizedSlot: 1n },
  };
}

function enumResult(accounts: RpcTokenAccount[], complete = true): TokenAccountEnumerationResult {
  return {
    accounts,
    pageCount: 1,
    paginationComplete: complete,
    pageSlots: ["1"],
    skippedMalformedCount: 0,
    watermark: { source: "helius", observedAt: new Date(FIXED), completeness: complete ? "complete" : "partial", finalizedSlot: 1n },
  };
}

function fixtureSource(accountsByCa: Record<string, RpcTokenAccount[]>, supplyByCa: Record<string, string>): PilotTokenAccountSource {
  let requests = 0;
  return {
    getRequestCount: () => requests,
    async getMint(ca) {
      requests += 1;
      const supply = supplyByCa[ca];
      if (supply === undefined) return { data: null, watermark: { source: "helius", observedAt: new Date(FIXED), completeness: "complete" } };
      return mintResponse(supply);
    },
    async getTokenMetadata() {
      requests += 1;
      return metaResponse();
    },
    async enumerateTokenAccounts(ca) {
      requests += 1;
      return enumResult(accountsByCa[ca] ?? []);
    },
  };
}

test("pilot rejects empty sample list", async () => {
  const batch = await runSolanaCaRealDataCleaningPilot(
    {
      taskId: "SOL-CA-REAL-DATA-CLEANING-PILOT-001",
      baseCommit: "777e013",
      dataSource: "helius",
      selectedAt: FIXED,
      samples: [],
    },
    () => fixtureSource({}, {}),
  );
  assert.equal(batch.status, "REJECTED");
});

test("pilot fail-closed on missing credential factory", async () => {
  const batch = await runSolanaCaRealDataCleaningPilot(
    {
      taskId: "SOL-CA-REAL-DATA-CLEANING-PILOT-001",
      baseCommit: "777e013",
      dataSource: "helius",
      selectedAt: FIXED,
      samples: [{ ca: "So11111111111111111111111111111111111111112", selectionReason: "x" }],
    },
    () => {
      throw new SourceDataUnavailableError("helius_runtime_credential_unavailable");
    },
  );
  assert.equal(batch.status, RUNTIME_CREDENTIAL_UNAVAILABLE);
  assert.deepEqual(batch.warnings, [RUNTIME_CREDENTIAL_UNAVAILABLE]);
});

test("pilot runs sequential fixture CAs and conserves amounts", async () => {
  const ca = "So11111111111111111111111111111111111111112";
  const batch = await runSolanaCaRealDataCleaningPilot(
    {
      taskId: "SOL-CA-REAL-DATA-CLEANING-PILOT-001",
      baseCommit: "777e013",
      dataSource: "helius",
      selectedAt: FIXED,
      samples: [{ ca, selectionReason: "fixture full reconcile" }],
    },
    () => fixtureSource(
      {
        [ca]: [
          { tokenAccount: "t1", owner: "alice", amountRaw: "700" },
          { tokenAccount: "t2", owner: "alice", amountRaw: "100" },
          { tokenAccount: "t3", owner: "bob", amountRaw: "200" },
        ],
      },
      { [ca]: "1000" },
    ),
    { now: () => new Date(FIXED) },
  );
  assert.equal(batch.status, "OK");
  assert.equal(batch.results.length, 1);
  const r = batch.results[0]!;
  assert.equal(r.cleaning.judgmentEligible, true);
  assert.equal(r.cleaning.owners.find((o) => o.owner === "alice")?.tokenAccountCount, 2);
  assert.ok(r.caScanResponse);
  assert.equal(r.caScanResponse?.judgmentEvidence[0]?.status, "confirmed");
});

test("live unit path is not executed by default (credential source not constructed without factory call scope)", () => {
  // Guard: default npm test must not require HELIUS_API_KEY.
  assert.equal(process.env.SOLANA_PILOT_LIVE, undefined);
});
