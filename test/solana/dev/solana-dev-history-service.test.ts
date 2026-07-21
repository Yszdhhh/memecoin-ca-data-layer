import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SolanaDevHistoryService, type SolanaDevHistoryInput } from "../../../src/infrastructure/solana/dev/solana-dev-history-service.js";

interface FixtureTrade {
  chain: "solana";
  token_id: string;
  tx_hash: string;
  event_index: number;
  block_number: string;
  block_time: string;
  trader: string;
  side: "buy" | "sell";
  token_amount_raw: string;
  quote_amount_raw: string;
  venue: string;
}

interface FixtureTransfer {
  chain: "solana";
  token_id: string;
  tx_hash: string;
  event_index: number;
  block_time: string;
  from: string;
  to: string;
  amount_raw: string;
}

interface CompleteFixture {
  token_id: string;
  total_supply_raw: string;
  creator_evidence: {
    source: "pump_create.creator";
    creator_address: string;
    signature: string;
    slot: string;
    block_time: string;
    program_id: string;
    source_commit: string;
    idl_sha256: string;
  };
  creation_slot: string;
  watermark: {
    oldest_observed_slot: string;
    newest_observed_slot: string;
    finalized_slot: string;
    cursor: string;
    has_gaps: boolean;
    observed_at: string;
  };
  direct_current_balance_raw: string;
  related_current_balances: Array<[string, string]>;
  related_addresses: string[];
  trades: FixtureTrade[];
  transfers: FixtureTransfer[];
}

interface PartialFixture {
  token_id: string;
  creation_slot: string;
  watermark: CompleteFixture["watermark"];
}

const service = new SolanaDevHistoryService();

async function readFixture<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(new URL(`../../fixtures/solana/dev/${name}.json`, import.meta.url), "utf8")) as T;
}

function asInput(fixture: CompleteFixture): SolanaDevHistoryInput {
  return {
    tokenId: fixture.token_id,
    totalSupplyRaw: BigInt(fixture.total_supply_raw),
    creatorEvidence: {
      source: fixture.creator_evidence.source,
      creatorAddress: fixture.creator_evidence.creator_address,
      signature: fixture.creator_evidence.signature,
      slot: BigInt(fixture.creator_evidence.slot),
      blockTime: new Date(fixture.creator_evidence.block_time),
      programId: fixture.creator_evidence.program_id,
      sourceCommit: fixture.creator_evidence.source_commit,
      idlSha256: fixture.creator_evidence.idl_sha256,
    },
    directCurrentBalanceRaw: BigInt(fixture.direct_current_balance_raw),
    relatedCurrentBalances: new Map(fixture.related_current_balances.map(([address, balance]) => [address, BigInt(balance)])),
    relatedAddresses: fixture.related_addresses,
    trades: fixture.trades.map((trade) => ({
      chain: trade.chain,
      tokenId: trade.token_id,
      txHash: trade.tx_hash,
      eventIndex: trade.event_index,
      blockNumber: BigInt(trade.block_number),
      blockTime: new Date(trade.block_time),
      trader: trade.trader,
      side: trade.side,
      tokenAmountRaw: BigInt(trade.token_amount_raw),
      quoteAmountRaw: BigInt(trade.quote_amount_raw),
      venue: trade.venue,
    })),
    transfers: fixture.transfers.map((transfer) => ({
      chain: transfer.chain,
      tokenId: transfer.token_id,
      txHash: transfer.tx_hash,
      eventIndex: transfer.event_index,
      blockTime: new Date(transfer.block_time),
      from: transfer.from,
      to: transfer.to,
      amountRaw: BigInt(transfer.amount_raw),
    })),
    creationSlot: BigInt(fixture.creation_slot),
    watermark: {
      oldestObservedSlot: BigInt(fixture.watermark.oldest_observed_slot),
      newestObservedSlot: BigInt(fixture.watermark.newest_observed_slot),
      finalizedSlot: BigInt(fixture.watermark.finalized_slot),
      cursor: fixture.watermark.cursor,
      hasGaps: fixture.watermark.has_gaps,
      observedAt: new Date(fixture.watermark.observed_at),
    },
    calculatedAt: new Date("2026-07-20T00:11:00.000Z"),
  };
}

test("uses Pump create.creator evidence and keeps direct, related and transfer metrics separate", async () => {
  const fixture = await readFixture<CompleteFixture>("complete-history");
  const result = service.analyze(asInput(fixture));

  assert.equal(result.coverage.completeFromCreation, true);
  assert.equal(result.creatorEvidence?.creatorAddress, "creator-wallet");
  assert.deepEqual(result.warnings, []);
  assert.notEqual(result.dev, null);
  if (result.dev === null) assert.fail("expected complete Dev history");
  assert.equal(result.dev.grossBoughtPct, 20);
  assert.equal(result.dev.grossSoldPct, 5);
  assert.equal(result.dev.relatedGrossSoldPct, 4);
  assert.equal(result.dev.outboundTransferPct, 2.5);
  assert.equal(result.dev.directSellCount, 1);
  assert.equal(result.dev.netDisposedPct, 0);
  assert.equal(result.dev.relatedHoldingPct, 3);
});

test("does not claim Dev completeness when history begins after creation", async () => {
  const [complete, partial] = await Promise.all([
    readFixture<CompleteFixture>("complete-history"),
    readFixture<PartialFixture>("partial-history"),
  ]);
  const input = asInput(complete);
  input.creationSlot = BigInt(partial.creation_slot);
  input.watermark = {
    oldestObservedSlot: BigInt(partial.watermark.oldest_observed_slot),
    newestObservedSlot: BigInt(partial.watermark.newest_observed_slot),
    finalizedSlot: BigInt(partial.watermark.finalized_slot),
    cursor: partial.watermark.cursor,
    hasGaps: partial.watermark.has_gaps,
    observedAt: new Date(partial.watermark.observed_at),
  };

  const result = service.analyze(input);
  assert.equal(result.coverage.completeFromCreation, false);
  assert.equal(result.coverage.cursor, "history-page-1");
  assert.equal(result.creatorEvidence?.creatorAddress, "creator-wallet");
  assert.equal(result.dev, null);
  assert.deepEqual(result.warnings, ["DEV_HISTORY_INCOMPLETE_FROM_CREATION"]);
});

test("does not claim Dev completeness when a watermark has gaps or is not finalized", async () => {
  const fixture = await readFixture<CompleteFixture>("complete-history");
  const withGap = asInput(fixture);
  withGap.watermark = { ...withGap.watermark, hasGaps: true };
  const beforeFinality = asInput(fixture);
  beforeFinality.watermark = { ...beforeFinality.watermark, finalizedSlot: 579n };

  for (const input of [withGap, beforeFinality]) {
    const result = service.analyze(input);
    assert.equal(result.coverage.completeFromCreation, false);
    assert.equal(result.dev, null);
    assert.deepEqual(result.warnings, ["DEV_HISTORY_INCOMPLETE_FROM_CREATION"]);
  }
});

test("does not substitute non-Pump creator evidence", async () => {
  const fixture = await readFixture<CompleteFixture>("complete-history");
  const input = asInput(fixture);
  input.creatorEvidence = { ...input.creatorEvidence!, source: "payer" as "pump_create.creator" };

  const result = service.analyze(input);
  assert.equal(result.creatorEvidence, null);
  assert.equal(result.dev, null);
  assert.deepEqual(result.warnings, ["CREATOR_EVIDENCE_MISSING_OR_UNTRUSTED"]);
});

test("fails closed when creator evidence is not bound to the pinned Pump creation contract", async () => {
  const fixture = await readFixture<CompleteFixture>("complete-history");
  const invalidEvidence = [
    { programId: "other-program" },
    { sourceCommit: "other-commit" },
    { idlSha256: "other-idl" },
    { slot: 501n },
  ];

  for (const invalid of invalidEvidence) {
    const input = asInput(fixture);
    input.creatorEvidence = { ...input.creatorEvidence!, ...invalid };
    const result = service.analyze(input);
    assert.equal(result.creatorEvidence, null);
    assert.equal(result.dev, null);
    assert.deepEqual(result.warnings, ["CREATOR_EVIDENCE_MISSING_OR_UNTRUSTED"]);
  }
});

test("filters balances outside the declared related-address set", async () => {
  const fixture = await readFixture<CompleteFixture>("complete-history");
  const input = asInput(fixture);
  input.relatedCurrentBalances = new Map([...input.relatedCurrentBalances, ["unrelated-wallet", 900_000n]]);

  const result = service.analyze(input);
  assert.notEqual(result.dev, null);
  if (result.dev === null) assert.fail("expected complete Dev history");
  assert.equal(result.dev.relatedHoldingPct, 3);
});
