import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PumpInstructionDecoder,
  type PumpDecodeResult,
  type PumpInstructionInput,
} from "../../../src/infrastructure/solana/pump/pump-instruction-decoder.js";

interface Fixture {
  action: string;
  retrieval: { rpc_endpoint: string; commitment: "finalized"; retrieved_at_utc: string };
  transaction: { signature: string; slot: number; block_time: number; status: string };
  instruction: { program_id: string; accounts: string[]; data_base58: string };
}

const decoder = new PumpInstructionDecoder();

async function loadFixture(name: string): Promise<Fixture> {
  return JSON.parse(
    await readFile(new URL(`../../fixtures/solana/pump/${name}.json`, import.meta.url), "utf8"),
  ) as Fixture;
}

function asInput(fixture: Fixture): PumpInstructionInput {
  return {
    programId: fixture.instruction.program_id,
    accounts: fixture.instruction.accounts,
    dataBase58: fixture.instruction.data_base58,
    signature: fixture.transaction.signature,
    slot: BigInt(fixture.transaction.slot),
    blockTime: new Date(fixture.transaction.block_time * 1_000),
    retrieval: {
      rpcEndpoint: fixture.retrieval.rpc_endpoint,
      commitment: fixture.retrieval.commitment,
      retrievedAt: new Date(fixture.retrieval.retrieved_at_utc),
    },
  };
}

function decoded(result: PumpDecodeResult) {
  if (result.status !== "decoded") assert.fail(result.reason);
  return result.instruction;
}

test("decodes the pinned create_v2 fixture and takes creator from instruction data", async () => {
  const input = asInput(await loadFixture("create-v2"));
  const result = decoded(decoder.decode(input));

  assert.equal(result.kind, "create");
  if (result.kind !== "create") assert.fail("expected create instruction");
  assert.deepEqual(
    {
      mint: result.mint,
      user: result.user,
      creator: result.creator,
      name: result.name,
      symbol: result.symbol,
      uri: result.uri,
      isMayhemMode: result.isMayhemMode,
      isCashbackEnabled: result.isCashbackEnabled,
    },
    {
      mint: "GyjN383QnJvUPbgNxaJBcWsKK35wU8HUnorKACsDpump",
      user: "AjqkgiKvFqDs44wZQ3Zzd1FwkzrGN2hQ68FgrkyS6J9t",
      creator: "AjqkgiKvFqDs44wZQ3Zzd1FwkzrGN2hQ68FgrkyS6J9t",
      name: "Cash Cow",
      symbol: "DATACENTER",
      uri: "https://m.rapidlaunch.io/m/1zXsAuqvm",
      isMayhemMode: false,
      isCashbackEnabled: true,
    },
  );

  const accounts = [...input.accounts];
  accounts[5] = "different-user-account";
  const altered = decoded(decoder.decode({ ...input, accounts }));
  assert.equal(altered.kind, "create");
  if (altered.kind !== "create") assert.fail("expected create instruction");
  assert.equal(altered.creator, result.creator);
  assert.equal(altered.user, "different-user-account");
});

test("decodes pinned buy, sell, and migrate instructions with raw integer amounts", async () => {
  const [buy, sell, migrate] = await Promise.all([loadFixture("buy"), loadFixture("sell"), loadFixture("migrate")]);
  const decodedBuy = decoded(decoder.decode(asInput(buy)));
  const decodedSell = decoded(decoder.decode(asInput(sell)));
  const decodedMigrate = decoded(decoder.decode(asInput(migrate)));

  assert.equal(decodedBuy.kind, "buy");
  if (decodedBuy.kind !== "buy") assert.fail("expected buy instruction");
  assert.equal(decodedBuy.amountRaw, 29_407_150_588_527n);
  assert.equal(decodedBuy.maxSolCostRaw, 991_556_550n);
  assert.equal(decodedBuy.trader, "41Dm9DmaGvCeg26LMjuvoofqNeHgL6xojy6mCzPpgL95");

  assert.equal(decodedSell.kind, "sell");
  if (decodedSell.kind !== "sell") assert.fail("expected sell instruction");
  assert.equal(decodedSell.amountRaw, 10_667_046_869_107n);
  assert.equal(decodedSell.minSolOutputRaw, 280_538_969n);
  assert.equal(decodedSell.trader, "BEpMLdAatqijj7NdvrrfL9SbaxErYFoKMog2gFf9ThPi");

  assert.equal(decodedMigrate.kind, "migrate");
  if (decodedMigrate.kind !== "migrate") assert.fail("expected migrate instruction");
  assert.equal(decodedMigrate.mint, "26zfQ7oyNtQYB3EV2g1vQLFTPCekTMsPQQRg5i4Vpump");
  assert.equal(decodedMigrate.user, "4qCkSySxS8EwW5dKLBSeoE8WHUsUdApyUxDFE84261T9");
});

test("preserves the pinned RPC retrieval watermark in decoded provenance", async () => {
  const fixtures = await Promise.all(["create-v2", "buy", "sell", "migrate"].map(loadFixture));

  for (const fixture of fixtures) {
    const instruction = decoded(decoder.decode(asInput(fixture)));
    assert.equal(instruction.provenance.retrieval.rpcEndpoint, fixture.retrieval.rpc_endpoint);
    assert.equal(instruction.provenance.retrieval.commitment, fixture.retrieval.commitment);
    assert.equal(instruction.provenance.retrieval.retrievedAt.toISOString(), fixture.retrieval.retrieved_at_utc);
  }
});

test("fails closed on invalid runtime retrieval watermarks with safe raw provenance", async () => {
  const input = asInput(await loadFixture("buy"));
  const invalidInputs: Array<{ name: string; input: PumpInstructionInput }> = [
    { name: "missing", input: { ...input, retrieval: undefined as unknown as PumpInstructionInput["retrieval"] } },
    {
      name: "non-finalized",
      input: { ...input, retrieval: { ...input.retrieval, commitment: "confirmed" } as unknown as PumpInstructionInput["retrieval"] },
    },
    { name: "invalid date", input: { ...input, retrieval: { ...input.retrieval, retrievedAt: new Date("invalid") } } },
    { name: "blank endpoint", input: { ...input, retrieval: { ...input.retrieval, rpcEndpoint: "   " } } },
  ];

  for (const invalid of invalidInputs) {
    const result = decoder.decode(invalid.input);
    assert.equal(result.status, "unsupported_version", `${invalid.name} watermark was accepted`);
    if (result.status !== "unsupported_version") assert.fail("expected unsupported instruction");
    assert.equal(result.raw.retrieval, null);
    assert.equal(result.raw.signature, input.signature);
  }
});

test("rejects every truncated or extended pinned account layout", async () => {
  const fixtures = await Promise.all(["create-v2", "buy", "sell", "migrate"].map(loadFixture));

  for (const fixture of fixtures) {
    const input = asInput(fixture);
    for (let accountCount = 0; accountCount < input.accounts.length; accountCount += 1) {
      const result = decoder.decode({ ...input, accounts: input.accounts.slice(0, accountCount) });
      assert.equal(result.status, "unsupported_version", `${fixture.action} accepted ${accountCount} accounts`);
    }

    const extended = decoder.decode({ ...input, accounts: [...input.accounts, "unexpected-account"] });
    assert.equal(extended.status, "unsupported_version", `${fixture.action} accepted an extended layout`);
  }
});

test("rejects a Pump program account outside its canonical position", async () => {
  const input = asInput(await loadFixture("buy"));
  const accounts = [...input.accounts];
  const programIndex = accounts.indexOf(input.programId);
  assert.notEqual(programIndex, -1);
  [accounts[0], accounts[programIndex]] = [accounts[programIndex]!, accounts[0]!];

  const result = decoder.decode({ ...input, accounts });
  assert.equal(result.status, "unsupported_version");
});

test("returns unsupported_version with raw provenance instead of guessing", async () => {
  const input = asInput(await loadFixture("buy"));
  const unknown = decoder.decode({ ...input, dataBase58: "11111111" });
  assert.equal(unknown.status, "unsupported_version");
  if (unknown.status !== "unsupported_version") assert.fail("expected unsupported instruction");
  assert.equal(unknown.raw.signature, input.signature);
  assert.equal(unknown.raw.dataBase58, "11111111");

  const wrongProgram = decoder.decode({ ...input, programId: "not-the-pump-program" });
  assert.equal(wrongProgram.status, "unsupported_version");

  const wrongLayout = decoder.decode({ ...input, accounts: input.accounts.slice(0, 11) });
  assert.equal(wrongLayout.status, "unsupported_version");
});
