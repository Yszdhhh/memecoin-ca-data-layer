import { createHash } from "node:crypto";
import {
  PUMP_IDL_COMMIT,
  PUMP_IDL_SHA256,
  PUMP_PROGRAM_ID,
} from "./pump-instruction-decoder.js";

export const PUMP_DECODER_REGISTRY_VERSION = "pump-decoder-registry-v1";

export interface PumpInstructionFormRecord {
  instructionForm: "create_v2" | "buy" | "sell" | "migrate";
  discriminator: readonly number[];
  accountCount: number;
  programIndex: number;
}

export interface PumpProgramVersionRecord {
  programId: string;
  idlCommit: string;
  idlSha256: string;
  forms: readonly PumpInstructionFormRecord[];
  /** When true, create.creator from instruction data outranks payer/signer/metadata. */
  creatorPrecedence: "create.creator";
}

/** Pinned registry — live IDL fetch is forbidden in offline stage. */
export const PUMP_PROGRAM_VERSIONS: readonly PumpProgramVersionRecord[] = [
  {
    programId: PUMP_PROGRAM_ID,
    idlCommit: PUMP_IDL_COMMIT,
    idlSha256: PUMP_IDL_SHA256,
    creatorPrecedence: "create.creator",
    forms: [
      { instructionForm: "create_v2", discriminator: [214, 144, 76, 236, 95, 139, 49, 180], accountCount: 16, programIndex: 15 },
      { instructionForm: "buy", discriminator: [102, 6, 61, 18, 1, 218, 235, 234], accountCount: 18, programIndex: 11 },
      { instructionForm: "sell", discriminator: [51, 230, 133, 164, 1, 127, 131, 173], accountCount: 17, programIndex: 11 },
      { instructionForm: "migrate", discriminator: [155, 234, 231, 146, 236, 158, 162, 30], accountCount: 25, programIndex: 23 },
    ],
  },
];

export function resolvePumpProgramVersion(
  programId: string,
  idlSha256?: string,
): PumpProgramVersionRecord | null {
  return PUMP_PROGRAM_VERSIONS.find((row) =>
    row.programId === programId && (!idlSha256 || row.idlSha256 === idlSha256)) ?? null;
}

export function resolvePumpInstructionForm(
  version: PumpProgramVersionRecord,
  discriminator: readonly number[],
): PumpInstructionFormRecord | null {
  const key = discriminator.join(",");
  return version.forms.find((form) => form.discriminator.join(",") === key) ?? null;
}

export interface FixtureManifestEntry {
  action: string;
  instruction_form: string;
  fixture_path: string;
  fixture_sha256: string;
  program_id: string;
  idl_sha256: string;
  discriminator: number[];
}

export function verifyFixtureManifestEntry(
  entry: FixtureManifestEntry,
  fixtureBody: string,
): { ok: boolean; reason?: string } {
  const version = resolvePumpProgramVersion(entry.program_id, entry.idl_sha256);
  if (!version) return { ok: false, reason: "unknown_program_or_idl" };
  const form = resolvePumpInstructionForm(version, entry.discriminator);
  if (!form) return { ok: false, reason: "unknown_discriminator" };
  if (form.instructionForm !== entry.instruction_form) {
    return { ok: false, reason: "instruction_form_mismatch" };
  }
  const hash = createHash("sha256").update(fixtureBody).digest("hex");
  if (hash !== entry.fixture_sha256) {
    return { ok: false, reason: `fixture_sha256_mismatch expected=${entry.fixture_sha256} got=${hash}` };
  }
  return { ok: true };
}

export function creatorOutranksPayer(): true {
  // Binding: create.creator always outranks payer/signer/metadata for the pinned program.
  return true;
}
