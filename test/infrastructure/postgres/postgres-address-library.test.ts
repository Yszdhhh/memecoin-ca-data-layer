import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Pool } from "pg";
import { PostgresAddressLibrary } from "../../../src/infrastructure/postgres/postgres-address-library.js";

const at = new Date("2026-07-27T00:00:00.000Z");

class QueryCapture {
  readonly calls: Array<{ text: string; values: readonly unknown[] }> = [];

  constructor(private readonly responses: Array<{ rows: unknown[]; rowCount: number }> = []) {}

  async query(text: string, values: readonly unknown[] = []): Promise<{ rows: unknown[]; rowCount: number }> {
    this.calls.push({ text, values });
    return this.responses.shift() ?? { rows: [], rowCount: 0 };
  }
}

function library(capture: QueryCapture): PostgresAddressLibrary {
  return new PostgresAddressLibrary(capture as unknown as Pool);
}

test("Postgres address library rejects borrowed verified writes before SQL", async () => {
  const capture = new QueryCapture();
  const store = library(capture);

  await assert.rejects(() => store.upsertWallet({
    chain: "solana",
    address: "wallet",
    origin: "borrowed",
    verificationStatus: "verified",
    labels: [],
    dataCompleteness: 0.2,
    updatedAt: at,
  }));
  assert.equal(capture.calls.length, 0);
});

test("Postgres address library preserves verified rows and writes typed observations", async () => {
  const capture = new QueryCapture([
    { rows: [], rowCount: 1 },
    { rows: [{ id: "generated" }], rowCount: 1 },
  ]);
  const store = library(capture);

  await store.upsertWallet({
    chain: "solana",
    address: "wallet",
    origin: "first_hand",
    verificationStatus: "verified",
    labels: ["independent_smart_money"],
    dataCompleteness: 1,
    updatedAt: at,
  });
  const walletWrite = capture.calls[0]!;
  assert.match(walletWrite.text, /wallets\.verification_status = 'verified'/);
  assert.deepEqual(walletWrite.values.slice(0, 4), ["solana", "wallet", "first_hand", "verified"]);

  const appended = await store.appendObservation({
    id: "ignored-by-db",
    chain: "solana",
    subjectKind: "wallet",
    subjectRef: "wallet",
    snapshotKind: "wallet_signal",
    source: "fixture",
    origin: "first_hand",
    verificationStatus: "verified",
    trustClass: "A",
    parserVersion: "fixture@1",
    parserInputKind: "platform_json",
    observationFingerprint: "fp",
    confidence: 1,
    completeness: 1,
    snapshot: { labels: ["independent_smart_money"] },
    warnings: [],
    capturedAt: at,
  });
  assert.deepEqual(appended, { accepted: true });
  const observationWrite = capture.calls[1]!;
  assert.match(observationWrite.text, /parser_input_kind/);
  assert.deepEqual(observationWrite.values.slice(8, 13), ["fixture@1", "platform_json", "fp", 1, 1]);
});

test("Postgres address library returns duplicates and hydrates stored wallet rows", async () => {
  const row = {
    chain: "solana",
    address: "wallet",
    origin: "first_hand",
    verification_status: "verified",
    funding_source: "funder",
    funding_source_confidence: "0.9",
    alpha_score: "88.2",
    alpha_score_tier: "SR",
    alpha_score_status: "scored",
    labels: ["independent_smart_money"],
    data_completeness: "1",
    updated_at: at.toISOString(),
  };
  const capture = new QueryCapture([
    { rows: [], rowCount: 0 },
    { rows: [row], rowCount: 1 },
    { rows: [row], rowCount: 1 },
  ]);
  const store = library(capture);

  const duplicate = await store.appendObservation({
    id: "duplicate",
    chain: "solana",
    subjectKind: "wallet",
    subjectRef: "wallet",
    snapshotKind: "wallet_signal",
    source: "fixture",
    origin: "first_hand",
    verificationStatus: "verified",
    trustClass: "A",
    parserVersion: "fixture@1",
    parserInputKind: "platform_json",
    observationFingerprint: "fp",
    confidence: 1,
    completeness: 1,
    snapshot: {},
    warnings: [],
    capturedAt: at,
  });
  assert.deepEqual(duplicate, { accepted: false, reason: "duplicate_fingerprint" });

  const wallet = await store.getWallet("solana", "wallet");
  assert.deepEqual(wallet, {
    chain: "solana",
    address: "wallet",
    origin: "first_hand",
    verificationStatus: "verified",
    fundingSource: "funder",
    fundingSourceConfidence: 0.9,
    alphaScore: 88.2,
    alphaScoreTier: "SR",
    alphaScoreStatus: "scored",
    labels: ["independent_smart_money"],
    dataCompleteness: 1,
    updatedAt: at,
  });

  assert.deepEqual(await store.lookupByAddresses("solana", ["wallet"]), [wallet]);
  assert.deepEqual(await store.lookupByAddresses("solana", []), []);
  assert.equal(capture.calls.length, 3);
});

test("migration enforces the borrowed data boundary for every durable record", async () => {
  const sql = await readFile(new URL("../../../db/migrations/009_address_library_trust.sql", import.meta.url), "utf8");
  assert.match(sql, /wallets_borrowed_cannot_be_verified/);
  assert.match(sql, /wallet_token_edges_borrowed_cannot_be_verified/);
  assert.match(sql, /observations_borrowed_cannot_be_verified/);
  assert.match(sql, /origin <> 'borrowed' OR verification_status = 'unverified'/);
});