import { TextDecoder } from "node:util";

export const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const PUMP_IDL_COMMIT = "9c82f61cb711b044a17f770ab8ce9f9bdf78f333";
export const PUMP_IDL_SHA256 = "b90bc471327f671449271d5d1d42354d1fae6f5a06502f5834459a3108138e49";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

const SUPPORTED_INSTRUCTIONS = {
  create_v2: { discriminator: [214, 144, 76, 236, 95, 139, 49, 180], accountCount: 16, programIndex: 15 },
  buy: { discriminator: [102, 6, 61, 18, 1, 218, 235, 234], accountCount: 18, programIndex: 11 },
  sell: { discriminator: [51, 230, 133, 164, 1, 127, 131, 173], accountCount: 17, programIndex: 11 },
  migrate: { discriminator: [155, 234, 231, 146, 236, 158, 162, 30], accountCount: 25, programIndex: 23 },
} as const;

type SupportedInstructionName = keyof typeof SUPPORTED_INSTRUCTIONS;

export interface PumpRetrievalWatermark {
  rpcEndpoint: string;
  commitment: "finalized";
  retrievedAt: Date;
}

export interface PumpInstructionInput {
  programId: string;
  accounts: readonly string[];
  dataBase58: string;
  signature: string;
  slot: bigint;
  blockTime: Date;
  retrieval: PumpRetrievalWatermark;
}

export interface PumpRawProvenance {
  programId: string;
  instructionName: SupportedInstructionName | null;
  discriminator: readonly number[] | null;
  signature: string;
  slot: bigint;
  blockTime: Date;
  retrieval: PumpRetrievalWatermark | null;
  accounts: readonly string[];
  dataBase58: string;
  sourceCommit: string;
  idlSha256: string;
}

interface VerifiedPumpRawProvenance extends PumpRawProvenance {
  retrieval: PumpRetrievalWatermark;
}

interface DecodedPumpInstructionBase {
  provenance: VerifiedPumpRawProvenance;
}

export interface DecodedPumpCreateV2 extends DecodedPumpInstructionBase {
  kind: "create";
  instructionName: "create_v2";
  mint: string;
  user: string;
  creator: string;
  name: string;
  symbol: string;
  uri: string;
  isMayhemMode: boolean;
  isCashbackEnabled: boolean;
}

export interface DecodedPumpBuy extends DecodedPumpInstructionBase {
  kind: "buy";
  instructionName: "buy";
  mint: string;
  trader: string;
  amountRaw: bigint;
  maxSolCostRaw: bigint;
}

export interface DecodedPumpSell extends DecodedPumpInstructionBase {
  kind: "sell";
  instructionName: "sell";
  mint: string;
  trader: string;
  amountRaw: bigint;
  minSolOutputRaw: bigint;
}

export interface DecodedPumpMigrate extends DecodedPumpInstructionBase {
  kind: "migrate";
  instructionName: "migrate";
  mint: string;
  user: string;
}

export type DecodedPumpInstruction =
  | DecodedPumpCreateV2
  | DecodedPumpBuy
  | DecodedPumpSell
  | DecodedPumpMigrate;

export type PumpDecodeResult =
  | { status: "decoded"; instruction: DecodedPumpInstruction }
  | { status: "unsupported_version"; reason: string; raw: PumpRawProvenance };

export class PumpInstructionDecoder {
  decode(input: PumpInstructionInput): PumpDecodeResult {
    const retrieval = normalizeRetrievalWatermark(input.retrieval);
    if (retrieval === null) {
      return this.unsupported(input, null, null, "retrieval watermark must have a non-empty endpoint, finalized commitment, and valid timestamp");
    }

    if (input.programId !== PUMP_PROGRAM_ID) {
      return this.unsupported(input, null, null, "program ID is not in the pinned Pump registry");
    }

    const data = decodeBase58(input.dataBase58);
    if (data === undefined || data.length < 8) {
      return this.unsupported(input, null, null, "instruction data is not a valid Pump discriminator payload");
    }

    const discriminator = [...data.subarray(0, 8)];
    const instructionName = findInstructionName(discriminator);
    if (instructionName === undefined) {
      return this.unsupported(input, null, discriminator, "discriminator is not in the pinned fixture registry");
    }

    const layout = SUPPORTED_INSTRUCTIONS[instructionName];
    if (input.accounts.length !== layout.accountCount || input.accounts[layout.programIndex] !== PUMP_PROGRAM_ID) {
      return this.unsupported(input, instructionName, discriminator, "account layout does not match the pinned instruction form");
    }

    const raw = this.raw(input, instructionName, discriminator, retrieval);
    const instruction = this.decodeSupported(instructionName, data, input.accounts, raw);
    if (instruction === undefined) {
      return this.unsupported(input, instructionName, discriminator, "instruction arguments do not match the pinned instruction form");
    }

    return { status: "decoded", instruction };
  }

  private decodeSupported(
    instructionName: SupportedInstructionName,
    data: Uint8Array,
    accounts: readonly string[],
    provenance: VerifiedPumpRawProvenance,
  ): DecodedPumpInstruction | undefined {
    switch (instructionName) {
      case "create_v2":
        return decodeCreateV2(data, accounts, provenance);
      case "buy":
        return decodeBuy(data, accounts, provenance);
      case "sell":
        return decodeSell(data, accounts, provenance);
      case "migrate":
        return decodeMigrate(data, accounts, provenance);
    }
  }

  private raw(
    input: PumpInstructionInput,
    instructionName: SupportedInstructionName | null,
    discriminator: readonly number[] | null,
    retrieval: PumpRetrievalWatermark,
  ): VerifiedPumpRawProvenance;
  private raw(
    input: PumpInstructionInput,
    instructionName: SupportedInstructionName | null,
    discriminator: readonly number[] | null,
  ): PumpRawProvenance;
  private raw(
    input: PumpInstructionInput,
    instructionName: SupportedInstructionName | null,
    discriminator: readonly number[] | null,
    retrieval = normalizeRetrievalWatermark(input.retrieval),
  ): PumpRawProvenance {
    return {
      programId: input.programId,
      instructionName,
      discriminator,
      signature: input.signature,
      slot: input.slot,
      blockTime: input.blockTime,
      retrieval,
      accounts: input.accounts,
      dataBase58: input.dataBase58,
      sourceCommit: PUMP_IDL_COMMIT,
      idlSha256: PUMP_IDL_SHA256,
    };
  }

  private unsupported(
    input: PumpInstructionInput,
    instructionName: SupportedInstructionName | null,
    discriminator: readonly number[] | null,
    reason: string,
  ): PumpDecodeResult {
    return { status: "unsupported_version", reason, raw: this.raw(input, instructionName, discriminator) };
  }
}

function decodeCreateV2(
  data: Uint8Array,
  accounts: readonly string[],
  provenance: VerifiedPumpRawProvenance,
): DecodedPumpCreateV2 | undefined {
  let offset = 8;
  const name = readString(data, offset);
  if (name === undefined) return undefined;
  offset = name.nextOffset;

  const symbol = readString(data, offset);
  if (symbol === undefined) return undefined;
  offset = symbol.nextOffset;

  const uri = readString(data, offset);
  if (uri === undefined || uri.nextOffset + 34 !== data.length) return undefined;
  offset = uri.nextOffset;

  const creator = encodeBase58(data.subarray(offset, offset + 32));
  const isMayhemMode = readBoolean(data, offset + 32);
  const isCashbackEnabled = readBoolean(data, offset + 33);
  const mint = accounts[0];
  const user = accounts[5];
  if (creator === undefined || isMayhemMode === undefined || isCashbackEnabled === undefined || mint === undefined || user === undefined) {
    return undefined;
  }

  return {
    kind: "create",
    instructionName: "create_v2",
    mint,
    user,
    // This comes from the Borsh creator argument, never from the user account.
    creator,
    name: name.value,
    symbol: symbol.value,
    uri: uri.value,
    isMayhemMode,
    isCashbackEnabled,
    provenance,
  };
}

function decodeBuy(data: Uint8Array, accounts: readonly string[], provenance: VerifiedPumpRawProvenance): DecodedPumpBuy | undefined {
  if (data.length !== 24) return undefined;
  const amountRaw = readU64(data, 8);
  const maxSolCostRaw = readU64(data, 16);
  const mint = accounts[2];
  const trader = accounts[6];
  if (amountRaw === undefined || maxSolCostRaw === undefined || mint === undefined || trader === undefined) return undefined;

  return { kind: "buy", instructionName: "buy", mint, trader, amountRaw, maxSolCostRaw, provenance };
}

function decodeSell(data: Uint8Array, accounts: readonly string[], provenance: VerifiedPumpRawProvenance): DecodedPumpSell | undefined {
  if (data.length !== 24) return undefined;
  const amountRaw = readU64(data, 8);
  const minSolOutputRaw = readU64(data, 16);
  const mint = accounts[2];
  const trader = accounts[6];
  if (amountRaw === undefined || minSolOutputRaw === undefined || mint === undefined || trader === undefined) return undefined;

  return { kind: "sell", instructionName: "sell", mint, trader, amountRaw, minSolOutputRaw, provenance };
}

function decodeMigrate(data: Uint8Array, accounts: readonly string[], provenance: VerifiedPumpRawProvenance): DecodedPumpMigrate | undefined {
  if (data.length !== 8) return undefined;
  const mint = accounts[2];
  const user = accounts[5];
  if (mint === undefined || user === undefined) return undefined;

  return { kind: "migrate", instructionName: "migrate", mint, user, provenance };
}

function findInstructionName(discriminator: readonly number[]): SupportedInstructionName | undefined {
  const key = discriminator.join(",");
  return (Object.keys(SUPPORTED_INSTRUCTIONS) as SupportedInstructionName[]).find(
    (name) => SUPPORTED_INSTRUCTIONS[name].discriminator.join(",") === key,
  );
}

function normalizeRetrievalWatermark(value: unknown): PumpRetrievalWatermark | null {
  try {
    if (typeof value !== "object" || value === null) return null;

    const retrieval = value as {
      rpcEndpoint?: unknown;
      commitment?: unknown;
      retrievedAt?: unknown;
    };
    if (typeof retrieval.rpcEndpoint !== "string" || retrieval.rpcEndpoint.trim().length === 0) return null;
    if (retrieval.commitment !== "finalized") return null;
    if (!(retrieval.retrievedAt instanceof Date) || Number.isNaN(retrieval.retrievedAt.getTime())) return null;

    return {
      rpcEndpoint: retrieval.rpcEndpoint,
      commitment: "finalized",
      retrievedAt: new Date(retrieval.retrievedAt.getTime()),
    };
  } catch {
    return null;
  }
}

function decodeBase58(value: string): Uint8Array | undefined {
  let decoded = 0n;
  for (const character of value) {
    const index = BASE58_ALPHABET.indexOf(character);
    if (index === -1) return undefined;
    decoded = decoded * 58n + BigInt(index);
  }

  const bytes: number[] = [];
  while (decoded > 0n) {
    bytes.push(Number(decoded & 0xffn));
    decoded >>= 8n;
  }
  bytes.reverse();

  let leadingZeroes = 0;
  while (value[leadingZeroes] === "1") leadingZeroes += 1;
  return Uint8Array.from([...Array<number>(leadingZeroes).fill(0), ...bytes]);
}

function encodeBase58(bytes: Uint8Array): string | undefined {
  if (bytes.length !== 32) return undefined;

  let encoded = 0n;
  for (const byte of bytes) encoded = (encoded << 8n) + BigInt(byte);

  let output = "";
  while (encoded > 0n) {
    output = BASE58_ALPHABET[Number(encoded % 58n)] + output;
    encoded /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    output = `1${output}`;
  }
  return output;
}

function readU32(data: Uint8Array, offset: number): number | undefined {
  if (offset < 0 || offset + 4 > data.length) return undefined;
  return data[offset]! + data[offset + 1]! * 2 ** 8 + data[offset + 2]! * 2 ** 16 + data[offset + 3]! * 2 ** 24;
}

function readU64(data: Uint8Array, offset: number): bigint | undefined {
  if (offset < 0 || offset + 8 > data.length) return undefined;
  let value = 0n;
  for (let index = 0; index < 8; index += 1) {
    value |= BigInt(data[offset + index]!) << BigInt(index * 8);
  }
  return value;
}

function readString(data: Uint8Array, offset: number): { value: string; nextOffset: number } | undefined {
  const length = readU32(data, offset);
  if (length === undefined) return undefined;
  const valueOffset = offset + 4;
  const nextOffset = valueOffset + length;
  if (nextOffset > data.length) return undefined;

  try {
    return { value: UTF8_DECODER.decode(data.subarray(valueOffset, nextOffset)), nextOffset };
  } catch {
    return undefined;
  }
}

function readBoolean(data: Uint8Array, offset: number): boolean | undefined {
  const value = data[offset];
  if (value === 0) return false;
  if (value === 1) return true;
  return undefined;
}
