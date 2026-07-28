import type {
  HeliusTokenMetadata,
  RpcMint,
  RpcTokenAccount,
  SourceResponse,
} from "../../infrastructure/solana/helius/helius-solana-adapter.js";
import { normalizeSolanaAddress } from "../../domain/solana-address.js";
import { safeSolanaLiveWarning } from "./solana-live-warning.js";

export { isSolanaAddress } from "../../domain/solana-address.js";

export const SOLANA_LIVE_CA_FIRST_VERSION = "solana-live-ca-first-v1";

export interface SolanaLiveCaFirstSource {
  getMint(ca: string): Promise<SourceResponse<RpcMint | null>>;
  getTokenMetadata(ca: string): Promise<SourceResponse<HeliusTokenMetadata | null>>;
  getTokenAccounts(ca: string): Promise<SourceResponse<RpcTokenAccount[]>>;
}

export interface SolanaLiveCaFirstResult {
  entrypointVersion: typeof SOLANA_LIVE_CA_FIRST_VERSION;
  chain: "solana";
  tokenCa: string;
  status: "OK" | "DEGRADED" | "REJECTED";
  mint: { available: boolean; decimals: number | null };
  metadata: { available: boolean };
  holderTokenAccounts: { available: boolean; count: number | null };
  completeness: {
    state: "complete" | "partial" | "unavailable";
    availableFields: number;
    requiredFields: 3;
  };
  sourceSlots: {
    mintFinalizedSlot: string | null;
    metadataIndexedSlot: string | null;
    holderAccountsIndexedSlot: string | null;
  };
  warnings: string[];
}

type ReadResult<T> =
  | { ok: true; response: SourceResponse<T> }
  | { ok: false; warning: string };

/**
 * Performs the deliberately narrow, manual first look. It does not invoke an
 * AnalysisService, persistence, queues, caches, address-library lookups, or
 * any inference layer. The caller owns the source; production CLI wiring uses
 * the read-only Helius implementation exclusively.
 */
export async function readSolanaLiveCaFirst(
  tokenCa: string,
  source: SolanaLiveCaFirstSource,
): Promise<SolanaLiveCaFirstResult> {
  const ca = normalizeSolanaAddress(tokenCa);
  if (ca === null) return rejectedResult(tokenCa.trim(), "solana_ca_invalid");
  return readValidatedSolanaLiveCaFirst(ca, source);
}

/** Validates before constructing the runtime source, keeping invalid input away from credentials. */
export async function readSolanaLiveCaFirstWithFactory(
  tokenCa: string,
  sourceFactory: () => SolanaLiveCaFirstSource,
): Promise<SolanaLiveCaFirstResult> {
  const ca = normalizeSolanaAddress(tokenCa);
  if (ca === null) return rejectedResult(tokenCa.trim(), "solana_ca_invalid");
  return readValidatedSolanaLiveCaFirst(ca, sourceFactory());
}

async function readValidatedSolanaLiveCaFirst(
  ca: string,
  source: SolanaLiveCaFirstSource,
): Promise<SolanaLiveCaFirstResult> {
  const [mint, metadata, accounts] = await Promise.all([
    safelyRead(() => source.getMint(ca)),
    safelyRead(() => source.getTokenMetadata(ca)),
    safelyRead(() => source.getTokenAccounts(ca)),
  ]);

  const mintAvailable = mint.ok && mint.response.data !== null;
  const metadataAvailable = metadata.ok && metadata.response.data !== null;
  const accountsAvailable = accounts.ok;
  const availableFields = [mintAvailable, metadataAvailable, accountsAvailable].filter(Boolean).length;
  const warnings = [
    ...(mint.ok ? (mint.response.data === null ? ["helius_mint_not_found"] : []) : [mint.warning]),
    ...(metadata.ok ? (metadata.response.data === null ? ["helius_metadata_not_found"] : []) : [metadata.warning]),
    ...(accounts.ok ? (accounts.response.watermark.completeness === "partial" ? ["helius_holder_accounts_partial"] : []) : [accounts.warning]),
  ];
  const complete = availableFields === 3
    && accounts.ok
    && accounts.response.watermark.completeness === "complete";

  return {
    entrypointVersion: SOLANA_LIVE_CA_FIRST_VERSION,
    chain: "solana",
    tokenCa: ca,
    status: complete ? "OK" : "DEGRADED",
    mint: {
      available: mintAvailable,
      decimals: mint.ok && mint.response.data !== null ? mint.response.data.decimals : null,
    },
    metadata: { available: metadataAvailable },
    holderTokenAccounts: {
      available: accountsAvailable,
      count: accountsAvailable && accounts.ok ? accounts.response.data.length : null,
    },
    completeness: {
      state: complete ? "complete" : availableFields === 0 ? "unavailable" : "partial",
      availableFields,
      requiredFields: 3,
    },
    sourceSlots: {
      mintFinalizedSlot: mint.ok ? slot(mint.response) : null,
      metadataIndexedSlot: metadata.ok ? slot(metadata.response) : null,
      holderAccountsIndexedSlot: accounts.ok ? slot(accounts.response) : null,
    },
    warnings,
  };
}

async function safelyRead<T>(read: () => Promise<SourceResponse<T>>): Promise<ReadResult<T>> {
  try {
    return { ok: true, response: await read() };
  } catch (error) {
    return { ok: false, warning: safeSolanaLiveWarning(error) };
  }
}

function slot(response: SourceResponse<unknown>): string | null {
  return response.watermark.finalizedSlot?.toString() ?? null;
}

function rejectedResult(tokenCa: string, warning: string): SolanaLiveCaFirstResult {
  return {
    entrypointVersion: SOLANA_LIVE_CA_FIRST_VERSION,
    chain: "solana",
    tokenCa,
    status: "REJECTED",
    mint: { available: false, decimals: null },
    metadata: { available: false },
    holderTokenAccounts: { available: false, count: null },
    completeness: { state: "unavailable", availableFields: 0, requiredFields: 3 },
    sourceSlots: {
      mintFinalizedSlot: null,
      metadataIndexedSlot: null,
      holderAccountsIndexedSlot: null,
    },
    warnings: [warning],
  };
}
