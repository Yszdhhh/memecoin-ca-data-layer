import assert from "node:assert/strict";
import test from "node:test";
import {
  GmgnDiscoveryError,
  discoverGmgnDailyCandidates,
  selectGmgnDailyCandidates,
  type GmgnCliRunner,
} from "../../../src/application/discovery/gmgn-daily-token-selector.js";

const now = new Date("2026-07-28T08:00:00.000Z");
const cas = [
  "H3GtwGSrYRVqp7dtjkaDfjE2inydLkHwFkFJSPzrpump",
  "EUx9N4UXDyAXJpziyLF36j6Ut3Gu9X3VKEGptbmfpump",
  "H1adbGC578HdoddVNAZT1Bn4uNrPiioTCfYmRjBHpump",
  "Ai66LHZG9MCzg1WKdawwqduVAXpNDUuV8M3uyq5ppump",
  "Ge87EtsjwRQbHaqQmKRno69RFTwh9bfSsm99XNxTpump",
  "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump",
  "BQYc6c5hivsPrEEmTxBVjGT16setk2gmPvbv7YBxpump",
  "4NBTf8PfLH4oLFnwf3knv46FY9i5oXjDxffCetXRpump",
  "Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump",
  "9ZtbETDNjnST9Y2zs82FZYy49xUMPgqXRh46YjjRpump",
] as const;

function row(address: string, marketCap: number, overrides: Record<string, unknown> = {}) {
  return {
    address,
    symbol: "SAFE",
    creator: cas[0],
    creation_timestamp: (now.getTime() - 60 * 60 * 1_000) / 1_000,
    market_cap: marketCap,
    holder_count: 42,
    top_10_holder_rate: 0.25,
    dev_team_hold_rate: 0.05,
    rat_trader_amount_rate: 0.04,
    bundler_rate: 0.03,
    sniper_count: 2,
    ...overrides,
  };
}

test("GMGN selection independently filters, deduplicates, sorts, and caps candidates", () => {
  const rank = cas.map((address, index) => row(address, 2_000_000 + index * 100_000));
  rank.push(row(cas[0], 99_000_000));
  rank.push(row("not-a-solana-address", 5_000_000));
  rank.push(row(cas[1], 1_000_000));
  rank.push(row(cas[2], 4_000_000, { creation_timestamp: (now.getTime() - 25 * 60 * 60 * 1_000) / 1_000 }));

  const result = selectGmgnDailyCandidates({ data: { rank } }, now);

  assert.equal(result.status, "READY");
  assert.equal(result.candidates.length, 10);
  assert.deepEqual(result.candidates.map((candidate) => candidate.marketCapUsd), [
    99_000_000, 2_900_000, 2_800_000, 2_700_000, 2_600_000, 2_500_000, 2_400_000, 2_300_000, 2_200_000, 2_100_000,
  ]);
  assert.equal(result.candidates.every((candidate) => candidate.source === "gmgn"), true);
  assert.equal(result.candidates.every((candidate) => candidate.trust === "unverified_provider_claim"), true);
  assert.deepEqual(result.warnings, []);
});

test("GMGN selection keeps only allowlisted and bounded provider claims", () => {
  const rank = cas.slice(0, 5).map((address, index) => row(address, 2_000_000 + index, index === 0 ? {
    symbol: "unsafe symbol <secret>",
    creator: "https://provider.invalid/?api-key=secret",
    holder_count: -1,
    top_10_holder_rate: 9,
    dev_team_hold_rate: "0.1",
    rat_trader_amount_rate: 0.2,
    bundler_rate: -0.1,
    sniper_count: 1.5,
    arbitrary_provider_text: "do not retain me",
  } : {}));

  const result = selectGmgnDailyCandidates({ data: { rank } }, now);
  const first = result.candidates.find((candidate) => candidate.tokenCa === cas[0]);

  assert.ok(first);
  assert.equal(first.symbol, null);
  assert.equal(first.creatorAddress, null);
  assert.equal(first.holderCount, null);
  assert.equal(first.top10HolderRate, null);
  assert.equal(first.devTeamHoldRate, 0.1);
  assert.equal(first.insiderVolumeRate, 0.2);
  assert.equal(first.bundlerVolumeRate, null);
  assert.equal(first.sniperCount, null);
  assert.equal(JSON.stringify(result).includes("do not retain me"), false);
  assert.equal(JSON.stringify(result).includes("api-key=secret"), false);
});

test("GMGN discovery uses one fixed bounded Solana query without placing credentials in arguments", async () => {
  let received: readonly string[] = [];
  const runner: GmgnCliRunner = {
    async run(args) {
      received = args;
      return JSON.stringify({ data: { rank: cas.slice(0, 5).map((address, index) => row(address, 2_000_000 + index)) } });
    },
  };

  const result = await discoverGmgnDailyCandidates(now, runner);

  assert.equal(result.status, "READY");
  assert.deepEqual(received, [
    "market", "trending", "--chain", "sol", "--interval", "24h", "--limit", "100",
    "--order-by", "marketcap", "--direction", "desc", "--min-marketcap", "1000000",
    "--max-created", "24h", "--raw",
  ]);
  assert.equal(received.some((value) => value.toLowerCase().includes("key")), false);
});

test("GMGN discovery rejects malformed responses and reports an insufficient set without padding", async () => {
  assert.throws(
    () => selectGmgnDailyCandidates({ data: { rank: "provider private text" } }, now),
    (error: unknown) => error instanceof GmgnDiscoveryError && error.code === "gmgn_response_malformed",
  );

  const result = selectGmgnDailyCandidates({ data: { rank: cas.slice(0, 4).map((address, index) => row(address, 2_000_000 + index)) } }, now);
  assert.equal(result.status, "INSUFFICIENT");
  assert.equal(result.candidates.length, 4);
  assert.deepEqual(result.warnings, ["gmgn_candidate_count_below_5"]);
});
