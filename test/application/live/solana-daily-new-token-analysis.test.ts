import assert from "node:assert/strict";
import test from "node:test";
import type { GmgnDailyCandidate, GmgnDailySelection } from "../../../src/application/discovery/gmgn-daily-token-selector.js";
import { runSolanaDailyNewTokenAnalysis } from "../../../src/application/live/solana-daily-new-token-analysis.js";
import type { SolanaLiveCaFirstSource } from "../../../src/application/live/solana-live-ca-first.js";

const now = new Date("2026-07-28T08:00:00.000Z");
const cas = [
  "H3GtwGSrYRVqp7dtjkaDfjE2inydLkHwFkFJSPzrpump",
  "EUx9N4UXDyAXJpziyLF36j6Ut3Gu9X3VKEGptbmfpump",
  "H1adbGC578HdoddVNAZT1Bn4uNrPiioTCfYmRjBHpump",
  "Ai66LHZG9MCzg1WKdawwqduVAXpNDUuV8M3uyq5ppump",
  "Ge87EtsjwRQbHaqQmKRno69RFTwh9bfSsm99XNxTpump",
] as const;

function candidate(tokenCa: string, index: number): GmgnDailyCandidate {
  return {
    tokenCa,
    symbol: `T${index}`,
    marketCapUsd: 2_000_000 - index,
    createdAt: new Date(now.getTime() - 60 * 60 * 1_000).toISOString(),
    holderCount: 100 + index,
    creatorAddress: cas[0],
    top10HolderRate: 0.2,
    devTeamHoldRate: 0.03,
    insiderVolumeRate: 0.04,
    bundlerVolumeRate: 0.05,
    sniperCount: index,
    source: "gmgn",
    trust: "unverified_provider_claim",
  };
}

function selection(count = 5): GmgnDailySelection {
  return {
    status: count >= 5 ? "READY" : "INSUFFICIENT",
    criteria: {
      chain: "sol",
      interval: "24h",
      maxAgeHours: 24,
      marketCapUsdExclusiveMin: 1_000_000,
      sort: "market_cap_desc",
      minimumCandidates: 5,
      maximumCandidates: 10,
    },
    candidates: cas.slice(0, count).map(candidate),
    warnings: count >= 5 ? [] : ["gmgn_candidate_count_below_5"],
  };
}

function completeSource(): SolanaLiveCaFirstSource {
  const watermark = { source: "helius" as const, observedAt: now, finalizedSlot: 123n, completeness: "complete" as const };
  return {
    async getMint() { return { data: { decimals: 6, supplyRaw: "1000" }, watermark }; },
    async getTokenMetadata() { return { data: { name: "Safe", symbol: "SAFE" }, watermark }; },
    async getTokenAccounts() { return { data: [{ tokenAccount: "account", owner: "owner", amountRaw: "1000" }], watermark }; },
  };
}

test("daily analysis validates the complete selection before bounded Helius reads", async () => {
  let factories = 0;
  const report = await runSolanaDailyNewTokenAnalysis({
    now: () => now,
    discover: async () => selection(),
    sourceFactory: () => {
      factories += 1;
      return completeSource();
    },
  });

  assert.equal(report.status, "OK");
  assert.equal(report.selectedCount, 5);
  assert.equal(report.analyzedCount, 5);
  assert.equal(factories, 5);
  assert.deepEqual(report.requestBounds, { gmgnRequestsMax: 1, heliusRequestsPerCaMax: 3, heliusRequestsBatchMax: 30 });
  assert.equal(report.candidates.every((item) => item.helius?.completeness.state === "complete"), true);
  assert.equal(report.candidates.every((item) => item.market.trust === "unverified_provider_claim"), true);
});

test("daily analysis does not construct a Helius source when fewer than five candidates remain", async () => {
  let factories = 0;
  const report = await runSolanaDailyNewTokenAnalysis({
    now: () => now,
    discover: async () => selection(4),
    sourceFactory: () => {
      factories += 1;
      return completeSource();
    },
  });

  assert.equal(report.status, "REJECTED");
  assert.equal(report.selectedCount, 4);
  assert.equal(report.analyzedCount, 0);
  assert.equal(factories, 0);
  assert.deepEqual(report.warnings, ["gmgn_candidate_count_below_5"]);
});

test("daily analysis never retains arbitrary Helius exception text or credential URLs", async () => {
  const source = completeSource();
  source.getMint = async () => { throw new Error("provider says https://example.invalid/?api-key=secret raw payload"); };

  const report = await runSolanaDailyNewTokenAnalysis({
    now: () => now,
    discover: async () => selection(),
    sourceFactory: () => source,
  });
  const serialized = JSON.stringify(report);

  assert.equal(report.status, "DEGRADED");
  assert.equal(serialized.includes("api-key=secret"), false);
  assert.equal(serialized.includes("raw payload"), false);
  assert.equal(report.candidates.every((item) => item.helius?.warnings.includes("helius_live_read_unavailable")), true);
});

test("daily analysis maps arbitrary discovery failures to an allowlisted warning", async () => {
  const report = await runSolanaDailyNewTokenAnalysis({
    now: () => now,
    discover: async () => { throw new Error("private GMGN provider response"); },
    sourceFactory: completeSource,
  });

  assert.equal(report.status, "REJECTED");
  assert.deepEqual(report.warnings, ["gmgn_cli_unavailable"]);
  assert.equal(JSON.stringify(report).includes("private GMGN provider response"), false);
});
