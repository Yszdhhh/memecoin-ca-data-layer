import {
  readSolanaLiveCaFirst,
  type SolanaLiveCaFirstResult,
  type SolanaLiveCaFirstSource,
} from "./solana-live-ca-first.js";

export const SOLANA_MANUAL_CA_BATCH_MAX = 10;

export interface SolanaManualCaBatchResult {
  chain: "solana";
  status: "OK" | "DEGRADED" | "REJECTED";
  requestedCount: number;
  results: SolanaLiveCaFirstResult[];
  warnings: string[];
}

/** Runs a user-supplied, bounded batch only; it never discovers or stores CAs. */
export async function readSolanaManualCaBatch(
  tokenCas: string[],
  sourceFactory: () => SolanaLiveCaFirstSource,
): Promise<SolanaManualCaBatchResult> {
  const normalized = tokenCas.map((ca) => ca.trim()).filter(Boolean);
  if (normalized.length === 0 || normalized.length > SOLANA_MANUAL_CA_BATCH_MAX) {
    return rejected(normalized.length, "manual_ca_batch_count_must_be_1_to_10");
  }
  if (new Set(normalized).size !== normalized.length) return rejected(normalized.length, "manual_ca_batch_duplicate_ca");

  const results: SolanaLiveCaFirstResult[] = [];
  for (const tokenCa of normalized) results.push(await readSolanaLiveCaFirst(tokenCa, sourceFactory()));
  const status = results.every((result) => result.status === "OK")
    ? "OK"
    : results.every((result) => result.status === "REJECTED") ? "REJECTED" : "DEGRADED";
  return { chain: "solana", status, requestedCount: normalized.length, results, warnings: [] };
}

function rejected(requestedCount: number, warning: string): SolanaManualCaBatchResult {
  return { chain: "solana", status: "REJECTED", requestedCount, results: [], warnings: [warning] };
}
