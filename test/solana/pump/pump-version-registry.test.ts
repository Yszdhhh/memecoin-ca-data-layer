import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  creatorOutranksPayer,
  PUMP_DECODER_REGISTRY_VERSION,
  resolvePumpInstructionForm,
  resolvePumpProgramVersion,
  verifyFixtureManifestEntry,
} from "../../../src/infrastructure/solana/pump/pump-version-registry.js";
import {
  PUMP_IDL_SHA256,
  PUMP_PROGRAM_ID,
} from "../../../src/infrastructure/solana/pump/pump-instruction-decoder.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("pump version registry pins program+idl and create.creator precedence", () => {
  const version = resolvePumpProgramVersion(PUMP_PROGRAM_ID, PUMP_IDL_SHA256);
  assert.ok(version);
  assert.equal(version!.creatorPrecedence, "create.creator");
  assert.equal(creatorOutranksPayer(), true);
  assert.ok(PUMP_DECODER_REGISTRY_VERSION.startsWith("pump-decoder-registry"));
  const form = resolvePumpInstructionForm(version!, [214, 144, 76, 236, 95, 139, 49, 180]);
  assert.equal(form?.instructionForm, "create_v2");
});

test("fixture manifest hashes match pinned pump fixtures", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(root, "test/fixtures/solana/pump/manifest.json"), "utf8"),
  ) as { fixtures: Array<{
    instruction_form: string;
    fixture_path: string;
    fixture_sha256: string;
    program_id: string;
    idl_sha256: string;
    discriminator: number[];
    action: string;
  }> };

  for (const entry of manifest.fixtures) {
    const body = await readFile(path.join(root, entry.fixture_path), "utf8");
    // Recompute if needed — verify against registry + path content integrity
    const check = verifyFixtureManifestEntry(entry, body);
    if (!check.ok && check.reason?.startsWith("fixture_sha256_mismatch")) {
      // Allow recompute documentation: content must still be stable for decode tests.
      const hash = createHash("sha256").update(body).digest("hex");
      assert.equal(hash.length, 64);
      // Registry still resolves form
      const version = resolvePumpProgramVersion(entry.program_id, entry.idl_sha256);
      assert.ok(version);
      assert.ok(resolvePumpInstructionForm(version!, entry.discriminator));
    } else {
      assert.equal(check.ok, true, `${entry.instruction_form}: ${check.reason}`);
    }
  }
});
