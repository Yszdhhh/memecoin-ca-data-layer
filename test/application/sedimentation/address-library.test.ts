import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryAddressLibrary,
  sedimentAnalysis,
} from "../../../src/application/sedimentation/address-library.js";
import { evaluateWalletForensics } from "../../../src/domain/rules/forensic-signals.js";

test("sedimentation writes wallets/edges and rejects borrowed+verified edges", async () => {
  const library = new InMemoryAddressLibrary();
  const forensics = evaluateWalletForensics({
    seed: { address: "w1", clusterId: "c1", confidence: 0.9, evidence: {} },
    clusterFeatures: { fFund: 0.9, fBlock: 0.9, fCosell: 0.8, fXtoken: 0.5, fDevlink: 0.1 },
    sniperFeatures: { fSlot: 0.1, fFreq: 0.1, fHold: 0.1, fDist: 0 },
    independenceFeatures: {
      fProfit: 0.2,
      fSellIndep: 0.2,
      fMultitoken: 0.2,
      profitableTokenCount: 1,
      pnlTierA: false,
    },
  });

  const result = await sedimentAnalysis(library, {
    chain: "solana",
    tokenId: "token-1",
    tokenCa: "Mint111111111111111111111111111111111111111",
    analyzedAt: new Date("2026-07-27T00:00:00.000Z"),
    wallets: [{
      address: "w1",
      fundingSource: "funder-a",
      fundingSourceConfidence: 0.95,
      forensics,
      origin: "first_hand",
      verificationStatus: "verified",
      grossBoughtRaw: "100",
      grossSoldRaw: "40",
      pnlSource: "self_computed",
    }],
    observations: [{
      id: "obs-1",
      chain: "solana",
      subjectKind: "wallet",
      subjectRef: "w1",
      snapshotKind: "wallet_signal",
      source: "fixture",
      origin: "first_hand",
      verificationStatus: "verified",
      trustClass: "A",
      parserVersion: "obs-parser@1",
      observationFingerprint: "fp-1",
      snapshot: { labels: ["cluster"] },
      warnings: [],
      capturedAt: new Date("2026-07-27T00:00:00.000Z"),
    }],
  });

  assert.equal(result.walletsWritten, 1);
  assert.equal(result.edgesWritten, 1);
  assert.equal(result.observationsAccepted, 1);
  const wallet = await library.getWallet("solana", "w1");
  assert.ok(wallet);
  assert.ok(
    wallet!.labels.includes("cluster")
      || wallet!.labels.includes("insider_cluster")
      || wallet!.labels.includes("cluster_suspected"),
  );
  const hits = await library.lookupByAddresses("solana", ["w1", "missing"]);
  assert.equal(hits.length, 1);

  await assert.rejects(() => library.upsertWalletTokenEdge({
    chain: "solana",
    walletAddress: "w1",
    tokenId: "token-1",
    grossBoughtRaw: "1",
    grossSoldRaw: "0",
    pnlSource: "gmgn",
    origin: "borrowed",
    verificationStatus: "verified",
    evidence: {},
    calculatedAt: new Date(),
  }));
});

test("observation append is idempotent on fingerprint", async () => {
  const library = new InMemoryAddressLibrary();
  const obs = {
    id: "obs-2",
    chain: "solana" as const,
    subjectKind: "token" as const,
    subjectRef: "mint",
    snapshotKind: "market",
    source: "dexscreener",
    origin: "borrowed" as const,
    verificationStatus: "unverified" as const,
    trustClass: "C" as const,
    parserVersion: "p@1",
    observationFingerprint: "same-fp",
    snapshot: { priceUsd: 1 },
    warnings: [],
    capturedAt: new Date(),
  };
  assert.equal((await library.appendObservation(obs)).accepted, true);
  assert.equal((await library.appendObservation({ ...obs, id: "obs-3" })).accepted, false);
});


test("borrowed verified observations and wallet conclusions fail closed", async () => {
  const library = new InMemoryAddressLibrary();
  const observation = await library.appendObservation({
    id: "bad-obs",
    chain: "solana",
    subjectKind: "wallet",
    subjectRef: "w-bad",
    snapshotKind: "wallet_signal",
    source: "gmgn",
    origin: "borrowed",
    verificationStatus: "verified",
    trustClass: "C",
    parserVersion: "fixture@1",
    observationFingerprint: "bad-fp",
    snapshot: { labels: ["smart_money"] },
    warnings: [],
    capturedAt: new Date("2026-07-27T00:00:00.000Z"),
  });
  assert.deepEqual(observation, { accepted: false, reason: "invalid_verified_borrowed" });

  await assert.rejects(() => library.upsertWallet({
    chain: "solana",
    address: "w-bad",
    origin: "borrowed",
    verificationStatus: "verified",
    labels: ["independent_smart_money"],
    dataCompleteness: 0.5,
    updatedAt: new Date("2026-07-27T00:00:00.000Z"),
  }));
});

test("an unverified refresh cannot overwrite a verified wallet conclusion", async () => {
  const library = new InMemoryAddressLibrary();
  const at = new Date("2026-07-27T00:00:00.000Z");
  await library.upsertWallet({
    chain: "solana",
    address: "w1",
    origin: "first_hand",
    verificationStatus: "verified",
    labels: ["independent_smart_money"],
    dataCompleteness: 1,
    updatedAt: at,
  });
  await library.upsertWallet({
    chain: "solana",
    address: "w1",
    origin: "borrowed",
    verificationStatus: "unverified",
    labels: ["external_candidate"],
    dataCompleteness: 0.4,
    updatedAt: new Date("2026-07-27T01:00:00.000Z"),
  });
  const wallet = await library.getWallet("solana", "w1");
  assert.deepEqual(wallet?.labels, ["independent_smart_money"]);
  assert.equal(wallet?.verificationStatus, "verified");
});
